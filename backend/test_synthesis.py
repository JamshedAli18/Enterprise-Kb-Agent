"""
Synthesis test: routing -> multi-source retrieval -> streamed final answer.

v3 change: primary/fallback order swapped. Groq (Qwen) is now tried first
for both routing and synthesis, with Gemini as the fallback. This matches
real-world reliability observed in testing: Gemini's free tier hits a hard
20-requests/day cap and intermittent 503 overloads, while Groq has been
consistently faster and available.

Carried over from v2:
  - Routing prompt does not invent a date_from/date_to window for vague
    recency words ("recently", "lately") -- only applies date filters when
    the question states an actual date/period.
  - Retrieval calls for multiple sources run concurrently via asyncio.gather.
  - Suppresses the noisy (harmless) google-genai AFC log warning.

Run:
    python test_synthesis.py
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from groq import Groq
from langchain_mcp_adapters.client import MultiServerMCPClient

for noisy_logger in ("google_genai", "google_genai.models", "google.genai"):
    logging.getLogger(noisy_logger).setLevel(logging.ERROR)

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GEMINI_MODEL = "gemini-3.6-flash"
GROQ_MODEL = "qwen/qwen3.8-27b"

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

SOURCE_TO_TOOL = {
    "slack": "search_slack",
    "notion": "search_notion",
    "drive": "search_drive",
}

BASE_DIR = Path(__file__).resolve().parent


def server_path(name: str) -> str:
    return str(BASE_DIR / "app" / "mcp_servers" / f"{name}_server.py")


ROUTING_PROMPT = """You are the routing step of a knowledge-base agent. Today's
date is {today}. Given a user question, decide which knowledge source(s) to
search and what filters to apply. Respond with ONLY valid JSON, no markdown
fences, no explanation.

Known slack channels: pricing, engineering, general, hr, support, product, incidents
Notion pages are matched by title (e.g. "Parental Leave Policy", "PTO Policy",
"Remote Work Policy", "Security Policy", "Incident Response Runbook", etc.)
Drive folders: Sales, HR, Engineering, Security, Marketing, Legal

Date filter rules (important):
- Only set date_from/date_to when the question names an explicit date, week,
  month, or event (e.g. "August 22", "last week's outage", "in March").
- Do NOT invent a date range for vague recency words like "recently",
  "lately", "currently", "these days" -- leave date_from and date_to as null
  in that case and let the search consider all time.
- When a question mentions a date without a year (e.g. "August 22"), assume
  the most recent occurrence relative to today's date above, not any other year.

Respond in exactly this JSON shape:
{{ "sources": ["slack", "notion", "drive"], "filters": {{
    "slack": {{"channel": null, "date_from": null, "date_to": null}},
    "notion": {{"page": null}},
    "drive": {{"folder": null, "filetype": null}}
}} }}
Only include sources that are actually relevant to the question.

Question: {question}
"""


def build_prompt(question: str) -> str:
    return ROUTING_PROMPT.format(today=date.today().isoformat(), question=question)


def parse_json_response(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"no JSON object found in response: {text!r}")
    return json.loads(match.group(0))


def route_with_gemini(prompt: str) -> dict:
    response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return parse_json_response(response.text)


def route_with_groq(prompt: str) -> dict:
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_json_response(response.choices[0].message.content)


def route_query(question: str):
    prompt = build_prompt(question)
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


SYNTHESIS_PROMPT = """You are answering a question using retrieved snippets from
a company's Slack, Notion, and Drive. Use only the information in the context
below. If the context does not answer the question, say so plainly instead of
guessing. Be concise and cite which source each piece of information came from
(e.g. "(Slack #engineering)", "(Notion: Parental Leave Policy)").

Question: {question}

Context:
{context}

Answer:
"""


def build_synthesis_prompt(question: str, gathered: dict) -> str:
    context_blocks = []
    for source, text in gathered.items():
        context_blocks.append(f"--- {source.upper()} RESULTS ---\n{text}")
    context = "\n\n".join(context_blocks) if context_blocks else "(no results retrieved)"
    return SYNTHESIS_PROMPT.format(question=question, context=context)


def synthesize_streaming(question: str, gathered: dict):
    prompt = build_synthesis_prompt(question, gathered)
    chunks = []
    used = "groq"
    try:
        stream = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
                print(delta, end="", flush=True)
        full_text = "".join(chunks)
        if not full_text.strip():
            raise RuntimeError("empty stream from Groq")
    except Exception as e:
        used = f"gemini-fallback ({type(e).__name__})"
        print(f"\n      [groq streaming failed: {type(e).__name__}: {e} -- falling back to gemini]\n")
        chunks = []
        stream = gemini_client.models.generate_content_stream(
            model=GEMINI_MODEL, contents=prompt
        )
        for chunk in stream:
            if chunk.text:
                chunks.append(chunk.text)
                print(chunk.text, end="", flush=True)
        full_text = "".join(chunks)
    print()
    return full_text, used


async def fetch_source(tools_by_name: dict, source: str, question: str, filters: dict):
    tool_name = SOURCE_TO_TOOL.get(source)
    if not tool_name or tool_name not in tools_by_name:
        return source, None, 0.0
    t0 = time.time()
    result = await tools_by_name[tool_name].ainvoke({"query": question, **filters})
    t1 = time.time()
    return source, result, t1 - t0


async def run_question(tools_by_name: dict, question: str):
    print(f"\n{'=' * 70}\nQUESTION: {question}\n{'=' * 70}")

    t0 = time.time()
    decision, router_used = route_query(question)
    t1 = time.time()
    print(f"[routed by {router_used} in {t1 - t0:.2f}s] -> {json.dumps(decision)}")

    sources = decision.get("sources", [])
    per_source_filters = {
        s: clean_filters(decision.get("filters", {}).get(s)) for s in sources
    }
    tasks = [
        fetch_source(tools_by_name, s, question, per_source_filters[s]) for s in sources
    ]
    results = await asyncio.gather(*tasks) if tasks else []
    t2 = time.time()

    gathered = {}
    for source, result, elapsed in results:
        if result is None:
            continue
        print(f"  [{SOURCE_TO_TOOL[source]} in {elapsed:.2f}s, filters={per_source_filters[source]}]")
        gathered[source] = result

    print("\n--- STREAMED ANSWER ---")
    t3 = time.time()
    _, synth_used = synthesize_streaming(question, gathered)
    t4 = time.time()
    print(f"--- end of answer (synthesized by {synth_used}) ---")

    print(
        f"\n[timing] routing={t1 - t0:.2f}s  retrieval={t2 - t1:.2f}s (parallel)  "
        f"synthesis={t4 - t3:.2f}s  total={t4 - t0:.2f}s"
    )


async def main():
    config = {
        name: {
            "command": sys.executable,
            "args": [server_path(name)],
            "transport": "stdio",
        }
        for name in ("slack", "notion", "drive")
    }
    client = MultiServerMCPClient(config)
    tools = await client.get_tools()
    tools_by_name = {t.name: t for t in tools}
    print(f"Loaded tools: {sorted(tools_by_name.keys())}")

    questions = [
        "What changed about pricing recently?",
        "What is our parental leave policy and did engineering ship anything about it?",
    ]
    for q in questions:
        await run_question(tools_by_name, q)


if __name__ == "__main__":
    asyncio.run(main())
