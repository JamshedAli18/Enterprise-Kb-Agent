"""
Multi-turn streaming test for the live /chat endpoint (real HTTP).

Mirrors the memory-vs-no-memory contrast already proven in-process via
python app/graph.py, but now over the actual API:
  1. Ask a question with no thread_id -> server generates one, returned in
     the "done" event.
  2. Ask a follow-up reusing that thread_id -> should resolve "it" from the
     prior turn correctly.
  3. Ask the identical follow-up with no thread_id (fresh conversation) ->
     should NOT resolve it (control), proving the memory came from the
     server-side checkpointer, not luck.

Requires the server from app/main.py to already be running:
    uvicorn app.main:app --reload

Run:
    python test_chat_endpoint.py
"""

import json
import time
from typing import Optional

import httpx

BASE_URL = "http://127.0.0.1:8000"


def run_question(question: str, thread_id: Optional[str] = None):
    label = f"[thread={thread_id}]" if thread_id else "[thread=<new>]"
    print(f"\n{'=' * 70}\n{label} QUESTION: {question}\n{'=' * 70}")
    t0 = time.time()
    full_text = ""
    meta = None

    payload = {"question": question}
    if thread_id:
        payload["thread_id"] = thread_id

    with httpx.Client(timeout=60.0) as client:
        with client.stream("POST", f"{BASE_URL}/chat", json=payload) as response:
            response.raise_for_status()
            event_type = None
            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("event:"):
                    event_type = line[len("event:"):].strip()
                    continue
                if line.startswith("data:"):
                    data = json.loads(line[len("data:"):].strip())
                    if event_type == "done":
                        meta = data
                        event_type = None
                    else:
                        token = data.get("token", "")
                        full_text += token
                        print(token, end="", flush=True)

    t1 = time.time()
    print("\n--- end of stream ---")
    print(f"[client-observed total time: {t1 - t0:.2f}s]")
    if meta:
        print(f"[thread_id={meta.get('thread_id')}]")
        print(f"[router_used={meta.get('router_used')}]")
        print(f"[decision={json.dumps(meta.get('decision'))}]")
        print(f"[synth_used={meta.get('synth_used')}]")
    else:
        print("[WARNING: no 'done' metadata event received]")

    return full_text, meta


def main():
    print("### Part 1: same thread -- memory should carry context across turns ###")
    _, meta1 = run_question("What is our parental leave policy?")
    thread_id = meta1["thread_id"] if meta1 else None
    if not thread_id:
        print("Could not get a thread_id from the first response, aborting follow-up test.")
        return
    run_question("Did engineering ship anything about it?", thread_id=thread_id)

    print("\n\n### Part 2: fresh thread, same follow-up, no prior context (control) ###")
    run_question("Did engineering ship anything about it?")


if __name__ == "__main__":
    main()
