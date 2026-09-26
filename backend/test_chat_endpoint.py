"""
Streaming test for the /chat endpoint (works against either local or a
deployed server). Requires the target server to already be running/live.

Run against local dev server / local Docker container (default):
    python test_chat_endpoint.py

Run against a deployed server:
    $env:API_BASE_URL = "https://enterprise-kb-agent.onrender.com"
    python test_chat_endpoint.py
"""

import json
import os
import time
from typing import Optional

import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

QUESTIONS = [
    "What changed about pricing recently?",
    "What is our parental leave policy and did engineering ship anything about it?",
]


def run_question(question: str):
    print(f"\n{'=' * 70}\nQUESTION: {question}\n{'=' * 70}")
    t0 = time.time()
    full_text = ""
    meta = None

    with httpx.Client(timeout=90.0) as client:
        with client.stream("POST", f"{BASE_URL}/chat", json={"question": question}) as response:
            response.raise_for_status()
            event_type = None
            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("event:"):
                    event_type = line[len("event:"):].strip()
                    continue
                if line.startswith("data:"):
                    payload = json.loads(line[len("data:"):].strip())
                    if event_type == "done":
                        meta = payload
                        event_type = None
                    elif event_type == "error":
                        print(f"\n[SERVER ERROR] {payload.get('type')}: {payload.get('message')}")
                        event_type = None
                    else:
                        token = payload.get("token", "")
                        full_text += token
                        print(token, end="", flush=True)

    t1 = time.time()
    print("\n--- end of stream ---")
    print(f"[client-observed total time: {t1 - t0:.2f}s]")
    if meta:
        print(f"[router_used={meta.get('router_used')}]")
        print(f"[decision={json.dumps(meta.get('decision'))}]")
        print(f"[synth_used={meta.get('synth_used')}]")
    else:
        print("[WARNING: no 'done' metadata event received]")

    return full_text, meta


def main():
    print(f"Testing against: {BASE_URL}")
    for q in QUESTIONS:
        run_question(q)


if __name__ == "__main__":
    main()
