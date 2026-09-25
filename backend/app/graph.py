"""
app/graph.py -- the real LangGraph StateGraph for the knowledge-base agent.

    route ---> retrieve (parallel per-source MCP calls) ---> synthesize ---> record_turn

Model order: Groq (Qwen) primary, Gemini fallback, for both routing and
synthesis. Streaming: synthesize_node uses get_stream_writer() so the answer
streams token-by-token at the graph level (stream_mode="custom").

Multi-turn conversation memory via LangGraph checkpointing: GraphState has a
"history" field (Annotated with operator.add) that accumulates across turns;
record_turn appends each (question, answer) pair; routing and synthesis
prompts both receive recent history so follow-ups can resolve references.

v5 fix: a live test against the deployed Render instance caught the router
occasionally returning "slacks" instead of "slack" in the sources list. That
silently failed an exact-string lookup against SOURCE_TO_TOOL, dropping the
source entirely with no error -- the answer came back grounded but
incomplete (missing real Slack context) instead of loudly wrong. Fixed with
normalize_source() as a safety net (handles case/whitespace/simple plurals),
plus a stricter instruction in the routing prompt to reduce how often this
happens at the source.

v4 fix (kept): load_tools() explicitly passes "env": dict(os.environ) to
each spawned MCP server subprocess -- required for the subprocess to see
COHERE_API_KEY etc. consistently across platforms (this broke silently
inside Docker even though it worked on Windows directly).

Run directly for a smoke test:
    python app/graph.py
"""

import asyncio
import json
import logging
import operator
import os
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Annotated, Optional, TypedDict

from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.memory import MemorySaver
from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph

for noisy_logger in ("google_genai", "google_genai.models", "google.genai"):
    logging.getLogger(noisy_logger).setLevel(logging.ERROR)

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GEMINI_MODEL = "gemini-3.6-flash"
GROQ_MODEL = "qwen/qwen3.8-27b"
SYNTHESIS_MAX_TOKENS = 1024
MAX_HISTORY_TURNS = 3

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

VALID_SOURCES = ("slack", "notion", "drive")

SOURCE_TO_TOOL = {
    "slack": "search_slack",
    "notion": "search_notion",
    "drive": "search_drive",
}

BASE_DIR = Path(__file__).resolve().parent  # backend/app/


def server_path(name: str) -> str:
    return str(BASE_DIR / "mcp_servers" / f"{name}_server.py")


def normalize_source(name) -> Optional[str]:
    """Maps a router-provided source name back to one of VALID_SOURCES,
    tolerating case differences, whitespace, and simple plural slips
    (e.g. "slacks" -> "slack") instead of silently dropping the source."""
    if not isinstance(name, str):
        return None
    candidate = name.strip().lower()
    if candidate in VALID_SOURCES:
        return candidate
    for valid in VALID_SOURCES:
        if candidate.startswith(valid):
            return valid
    return None


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------

class GraphState(TypedDict, total=False):
    question: str
    history: Annotated[list, operator.add]
    decision: dict
    router_used: str
    routing_time: float
    gathered: dict
    retrieval_time: float
    answer: str
    synth_used: str
    synthesis_time: float


def format_history(history: list, max_turns: int = MAX_HISTORY_TURNS) -> str:
    if not history:
        return "(no prior conversation)"
    trimmed = history[-(max_turns * 2):]
    lines = []
    for turn in trimmed:
        role = "User" if turn.get("role") == "user" else "Assistant"
        lines.append(f"{role}: {turn.get('content', '')}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

ROUTING_PROMPT = """You are the routing step of a knowledge-base agent. Today's
date is {today}. Given the conversation so far and a new user question,
decide which knowledge source(s) to search and what filters to apply.
Respond with ONLY valid JSON, no markdown fences, no explanation.

Known slack channels: pricing, engineering, general, hr, support, product, incidents
Notion pages are matched by title (e.g. "Parental Leave Policy", "PTO Policy",
"Remote Work Policy", "Security Policy", "Incident Response Runbook", etc.)
Drive folders: Sales, HR, Engineering, Security, Marketing, Legal

The "sources" list must contain ONLY these exact lowercase strings:
"slack", "notion", "drive" -- singular, no other spelling or variant
(not "slacks", not "Slack", not "slack channel").

Date filter rules (important):
- Only set date_from/date_to when the question names an explicit date, week,
  month, or event (e.g. "August 22", "last week's outage", "in March").
- Do NOT invent a date range for vague recency words like "recently",
  "lately", "currently", "these days" -- leave date_from and date_to as null
  in that case and let the search consider all time.
- When a question mentions a date without a year (e.g. "August 22"), assume
  the most recent occurrence relative to today's date above, not any other year.

Use the conversation so far to resolve references like "it", "that", "them",
or a follow-up question that only makes sense given earlier context (e.g. if
the prior turn was about the parental leave policy and the new question is
"did engineering ship anything about it?", "it" means the parental leave
policy).

Conversation so far (may say "no prior conversation" if this is the first message):
{history}

Respond in exactly this JSON shape:
{{ "sources": ["slack", "notion", "drive"], "filters": {{
    "slack": {{"channel": null, "date_from": null, "date_to": null}},
    "notion": {{"page": null}},
    "drive": {{"folder": null, "filetype": null}}
}} }}
Only include sources that are actually relevant to the new question.

New question: {question}
"""


def build_routing_prompt(question: str, history: list) -> str:
    return ROUTING_PROMPT.format(
        today=date.today().isoformat(),
        history=format_history(history),
        question=question,
    )


def parse_json_response(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"no JSON object found in response: {text!r}")
    return json.loads(match.group(0))


def route_with_groq(prompt: str) -> dict:
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_json_response(response.choices[0].message.content)


def route_with_gemini(prompt: str) -> dict:
    response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return parse_json_response(response.text)


def route_query_sync(question: str, history: list):
    prompt = build_routing_prompt(question, history)
    try:
        return route_with_groq(prompt), "groq"
    except Exception as groq_error:
        try:
            return route_with_gemini(prompt), f"gemini-fallback ({type(groq_error).__name__})"
        except Exception as gemini_error:
            raise RuntimeError(
                f"both routers failed: groq={groq_error!r} gemini={gemini_error!r}"
            )


def clean_filters(filters_for_source):
    if not filters_for_source:
        return {}
    return {k: v for k, v in filters_for_source.items() if v is not None}


# ---------------------------------------------------------------------------
# Synthesis
# ---------------------------------------------------------------------------

SYNTHESIS_PROMPT = """You are answering a question using retrieved snippets from
a company's Slack, Notion, and Drive, as part of an ongoing conversation. Use
only the information in the context below. Use the conversation history for
continuity (e.g. resolving "it"/"that"), but do not invent facts that are not
in the context. If the context does not answer the question, say so plainly
instead of guessing. Be concise and cite which source each piece of
information came from (e.g. "(Slack #engineering)", "(Notion: Parental Leave
Policy)").

Conversation so far (may say "no prior conversation" if this is the first message):
{history}

New question: {question}

Context:
{context}

Answer:
"""


def build_synthesis_prompt(question: str, gathered: dict, history: list) -> str:
    context_blocks = [f"--- {source.upper()} RESULTS ---\n{text}" for source, text in gathered.items()]
    context = "\n\n".join(context_blocks) if context_blocks else "(no results retrieved)"
    return SYNTHESIS_PROMPT.format(question=question, context=context, history=format_history(history))


def synthesize_sync(question: str, gathered: dict, history: list, on_token=None):
    prompt = build_synthesis_prompt(question, gathered, history)
    chunks = []
    used = "groq"
    try:
        stream = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=SYNTHESIS_MAX_TOKENS,
        )
        finish_reason = None
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
                if on_token:
                    on_token(delta)
            reason = chunk.choices[0].finish_reason
            if reason:
                finish_reason = reason
        full_text = "".join(chunks)
        if not full_text.strip():
            raise RuntimeError("empty stream from Groq")
        if finish_reason == "length":
            note = "\n\n[note: answer was truncated at the token limit]"
            full_text += note
            if on_token:
                on_token(note)
    except Exception as e:
        used = f"gemini-fallback ({type(e).__name__})"
        chunks = []
        stream = gemini_client.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=SYNTHESIS_MAX_TOKENS),
        )
        last_chunk = None
        for chunk in stream:
            if chunk.text:
                chunks.append(chunk.text)
                if on_token:
                    on_token(chunk.text)
            last_chunk = chunk
        full_text = "".join(chunks)
        finish_reason = None
        if last_chunk is not None and getattr(last_chunk, "candidates", None):
            finish_reason = getattr(last_chunk.candidates[0], "finish_reason", None)
        if finish_reason and str(finish_reason).upper() == "MAX_TOKENS":
            note = "\n\n[note: answer was truncated at the token limit]"
            full_text += note
            if on_token:
                on_token(note)
    return full_text, used


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def route_node(state: GraphState) -> dict:
    t0 = time.time()
    history = state.get("history", [])
    decision, router_used = await asyncio.to_thread(route_query_sync, state["question"], history)
    return {"decision": decision, "router_used": router_used, "routing_time": time.time() - t0}


async def fetch_source(tools_by_name, source, question, filters):
    tool_name = SOURCE_TO_TOOL.get(source)
    if not tool_name or tool_name not in tools_by_name:
        return source, None
    result = await tools_by_name[tool_name].ainvoke({"query": question, **filters})
    return source, result


def make_retrieve_node(tools_by_name):
    async def retrieve_node(state: GraphState) -> dict:
        t0 = time.time()
        decision = state["decision"]
        raw_sources = decision.get("sources", [])
        sources = []
        for s in raw_sources:
            normalized = normalize_source(s)
            if normalized and normalized not in sources:
                sources.append(normalized)
        per_source_filters = {s: clean_filters(decision.get("filters", {}).get(s)) for s in sources}
        tasks = [fetch_source(tools_by_name, s, state["question"], per_source_filters[s]) for s in sources]
        results = await asyncio.gather(*tasks) if tasks else []
        gathered = {source: result for source, result in results if result is not None}
        return {"gathered": gathered, "retrieval_time": time.time() - t0}
    return retrieve_node


async def synthesize_node(state: GraphState) -> dict:
    t0 = time.time()
    writer = get_stream_writer()
    history = state.get("history", [])
    answer, synth_used = await asyncio.to_thread(
        synthesize_sync, state["question"], state.get("gathered", {}), history, on_token=writer
    )
    return {"answer": answer, "synth_used": synth_used, "synthesis_time": time.time() - t0}


async def record_turn_node(state: GraphState) -> dict:
    return {
        "history": [
            {"role": "user", "content": state["question"]},
            {"role": "assistant", "content": state.get("answer", "")},
        ]
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_graph(tools_by_name, checkpointer=None):
    graph = StateGraph(GraphState)
    graph.add_node("route", route_node)
    graph.add_node("retrieve", make_retrieve_node(tools_by_name))
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("record_turn", record_turn_node)
    graph.set_entry_point("route")
    graph.add_edge("route", "retrieve")
    graph.add_edge("retrieve", "synthesize")
    graph.add_edge("synthesize", "record_turn")
    graph.add_edge("record_turn", END)
    return graph.compile(checkpointer=checkpointer)


async def load_tools():
    config = {
        name: {
            "command": sys.executable,
            "args": [server_path(name)],
            "transport": "stdio",
            "env": dict(os.environ),
        }
        for name in ("slack", "notion", "drive")
    }
    client = MultiServerMCPClient(config)
    tools = await client.get_tools()
    return {t.name: t for t in tools}


async def create_app_graph():
    """Call once (e.g. at FastAPI startup) to build the compiled graph."""
    tools_by_name = await load_tools()
    checkpointer = MemorySaver()
    return build_graph(tools_by_name, checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

def _self_test_normalize_source():
    cases = {
        "slack": "slack", "Slack": "slack", " slacks ": "slack", "SLACKS": "slack",
        "notion": "notion", "drive": "drive", "gibberish": None, 123: None,
    }
    for raw, expected in cases.items():
        actual = normalize_source(raw)
        assert actual == expected, f"normalize_source({raw!r}) = {actual!r}, expected {expected!r}"
    print("normalize_source self-test: PASS")


async def run_streaming(graph, question: str, thread_id: str):
    print(f"\n{'=' * 70}\n[thread={thread_id}] QUESTION: {question}\n{'=' * 70}")
    final_state = {}
    config = {"configurable": {"thread_id": thread_id}}
    print("--- STREAMED ANSWER ---")
    async for mode, payload in graph.astream({"question": question}, config=config, stream_mode=["custom", "values"]):
        if mode == "custom":
            print(payload, end="", flush=True)
        elif mode == "values":
            final_state = payload
    print("\n--- end of answer ---")

    print(
        f"\n[routed by {final_state.get('router_used')} in {final_state.get('routing_time', 0):.2f}s] "
        f"-> {json.dumps(final_state.get('decision'))}"
    )
    print(f"[retrieval in {final_state.get('retrieval_time', 0):.2f}s, sources={list(final_state.get('gathered', {}).keys())}]")
    print(f"[synthesized by {final_state.get('synth_used')} in {final_state.get('synthesis_time', 0):.2f}s]")
    print(f"[history now has {len(final_state.get('history', []))} messages for thread={thread_id}]")


async def main():
    _self_test_normalize_source()

    print("Loading MCP tools and building graph...")
    tools_by_name = await load_tools()
    checkpointer = MemorySaver()
    graph = build_graph(tools_by_name, checkpointer=checkpointer)
    print("Graph ready.\n")

    print("### Part 1: same thread -- memory should carry context across turns ###")
    thread_a = "demo-thread-parental-leave"
    await run_streaming(graph, "What is our parental leave policy?", thread_a)
    await run_streaming(graph, "Did engineering ship anything about it?", thread_a)

    print("\n\n### Part 2: brand-new thread, same follow-up, no prior context (control) ###")
    thread_b = "demo-thread-fresh"
    await run_streaming(graph, "Did engineering ship anything about it?", thread_b)


if __name__ == "__main__":
    asyncio.run(main())
