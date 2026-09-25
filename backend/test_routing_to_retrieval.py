"""
End-to-end test: route a question, then actually call the matching
MCP tool(s) with the filters the router extracted. Still no final
answer synthesis - just proving routing -> retrieval works together.
"""

import asyncio
import datetime
import json
import os
import re
import sys
import time

from dotenv import load_dotenv
from google import genai
from groq import Groq
from langchain_mcp_adapters.client import MultiServerMCPClient

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

GEMINI_MODEL = "gemini-3.6-flash"
GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b"

ROUTING_PROMPT = """You are the routing step of a knowledge-base agent. Today's
date is {today}. Given a user question, decide which knowledge source(s) to
search and what filters to apply. Respond with ONLY valid JSON, no markdown
fences, no explanation.

Known sources and their filter fields:
- "slack": team chat messages. Known channels: pricing, engineering, general, hr, support, product, incidents.
  Optional filters: channel, date_from (YYYY-MM-DD), date_to (YYYY-MM-DD)
- "notion": policy and planning pages. Optional filter: page (exact title)
- "drive": documents. Known folders: Sales, HR, Engineering, Security, Marketing, Legal.
  Optional filters: folder, filetype

Only include a source if it is actually relevant to the question. Only
include a filter field if the question clearly implies it - do not guess.
When a question mentions a date without a year (e.g. "August 22"), assume
the most recent occurrence relative to today's date above, not any other year.

Respond in exactly this JSON shape:
{{
  "sources": ["slack", "notion", "drive"],
  "filters": {{
    "slack": {{"channel": null, "date_from": null, "date_to": null}},
    "notion": {{"page": null}},
    "drive": {{"folder": null, "filetype": null}}
  }}
}}

Question: {question}
"""


def parse_json_response(text):
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"no JSON object found in response: {text!r}")
    return json.loads(match.group(0))


def build_prompt(question):
    today = datetime.date.today().isoformat()
    return ROUTING_PROMPT.format(today=today, question=question)


def route_with_gemini(prompt):
    response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return parse_json_response(response.text)


def route_with_groq(prompt):
    response = groq_client.chat.completions.create(
        model=GROQ_FALLBACK_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_json_response(response.choices[0].message.content)


def route_query(question):
    prompt = build_prompt(question)
    try:
        return route_with_gemini(prompt), "gemini"
    except Exception as gemini_error:
        try:
            return route_with_groq(prompt), f"groq-fallback ({type(gemini_error).__name__})"
        except Exception as groq_error:
            raise RuntimeError(f"both models failed - gemini: {gemini_error}; groq: {groq_error}")


def server_path(name):
    return os.path.join(BASE_DIR, "app", "mcp_servers", name)


SOURCE_TO_TOOL = {
    "slack": "search_slack",
    "notion": "search_notion",
    "drive": "search_drive",
}


def clean_filters(filters_for_source):
    # drop None values so we only pass filters the router actually set
    if not filters_for_source:
        return {}
    return {k: v for k, v in filters_for_source.items() if v is not None}


async def run_question(tools_by_name, question):
    decision, used_by = route_query(question)
    print(f"Q: {question}")
    print(f"   routed by: {used_by}")
    print(f"   sources: {decision.get('sources')}")

    filters = decision.get("filters", {}) or {}

    for source in decision.get("sources", []):
        tool_name = SOURCE_TO_TOOL.get(source)
        tool = tools_by_name.get(tool_name)
        if not tool:
            print(f"   FAIL  unknown source '{source}' (no matching tool)")
            continue

        kwargs = {"query": question, **clean_filters(filters.get(source))}
        start = time.time()
        try:
            result = await tool.ainvoke(kwargs)
            elapsed = time.time() - start
            text = result[0]["text"] if isinstance(result, list) else str(result)
            print(f"   --- {tool_name}  args={kwargs}  ({elapsed:.2f}s) ---")
            print(f"   {text}")
        except Exception as e:
            elapsed = time.time() - start
            print(f"   FAIL  {tool_name}  ({elapsed:.2f}s)  {type(e).__name__}: {e}")
    print()


async def main():
    client = MultiServerMCPClient(
        {
            "slack": {"command": sys.executable, "args": [server_path("slack_server.py")], "transport": "stdio"},
            "notion": {"command": sys.executable, "args": [server_path("notion_server.py")], "transport": "stdio"},
            "drive": {"command": sys.executable, "args": [server_path("drive_server.py")], "transport": "stdio"},
        }
    )
    tools = await client.get_tools()
    tools_by_name = {t.name: t for t in tools}

    questions = [
        "What changed about pricing recently?",
        "What is our parental leave policy and did engineering ship anything about it?",
    ]

    for question in questions:
        await run_question(tools_by_name, question)


if __name__ == "__main__":
    asyncio.run(main())
