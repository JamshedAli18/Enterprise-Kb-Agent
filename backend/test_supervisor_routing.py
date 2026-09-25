"""
Tests the supervisor's routing decision in isolation. Tries Gemini
first; on any error, falls back to Groq's Qwen3.8 27B with the same
prompt. Now also grounds the model with today's actual date, since a
prior run showed it guessing the wrong year for relative dates.
"""

import datetime
import json
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from groq import Groq

load_dotenv()

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
        decision = route_with_gemini(prompt)
        return decision, "gemini"
    except Exception as gemini_error:
        try:
            decision = route_with_groq(prompt)
            return decision, f"groq-fallback (gemini failed: {type(gemini_error).__name__})"
        except Exception as groq_error:
            raise RuntimeError(
                f"both models failed - gemini: {gemini_error}; groq: {groq_error}"
            )


def main():
    test_questions = [
        "What changed about pricing recently?",
        "How many days can I work remotely?",
        "What is in the Sales folder about onboarding?",
        "What happened during the August 22 incident?",
        "What is our parental leave policy and did engineering ship anything about it?",
    ]

    for question in test_questions:
        print(f"Q: {question}")
        start = time.time()
        try:
            decision, used = route_query(question)
            elapsed = time.time() - start
            print(f"PASS  ({elapsed:.2f}s)  answered by: {used}")
            print(f"      sources: {decision.get('sources')}")
            print(f"      filters: {decision.get('filters')}")
        except Exception as e:
            elapsed = time.time() - start
            print(f"FAIL  ({elapsed:.2f}s)  {e}")
        print()


if __name__ == "__main__":
    main()
