"""
End-to-end test for /voice-chat, configurable to run against local or a
deployed server. Synthesizes the spoken question itself (via Deepgram,
reusing app/voice.py locally) since there's no microphone here, uploads it,
and verifies the transcript, streamed answer, and returned spoken answer.

Run against local dev server / local Docker container (default):
    python test_voice_chat_endpoint.py

Run against a deployed server:
    $env:API_BASE_URL = "https://enterprise-kb-agent.onrender.com"
    python test_voice_chat_endpoint.py
"""

import base64
import json
import os
import time
from typing import Optional

import httpx

from app.voice import synthesize_speech_bytes

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")


def ask_by_voice(question_text: str, thread_id: Optional[str] = None, save_answer_as: str = "voice_chat_answer.mp3"):
    label = f"[thread={thread_id}]" if thread_id else "[thread=<new>]"
    print(f"\n{'=' * 70}\n{label} SPOKEN QUESTION (text used to synthesize it): {question_text}\n{'=' * 70}")

    print("Synthesizing the question as audio (stand-in for a microphone)...")
    question_audio = synthesize_speech_bytes(question_text)

    files = {"file": ("question.mp3", question_audio, "audio/mpeg")}
    data = {}
    if thread_id:
        data["thread_id"] = thread_id

    t0 = time.time()
    full_text = ""
    meta = None

    with httpx.Client(timeout=90.0) as client:
        with client.stream("POST", f"{BASE_URL}/voice-chat", files=files, data=data) as response:
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
                    if event_type == "transcript":
                        print(f"[transcript] {payload.get('text')!r}")
                        event_type = None
                    elif event_type == "done":
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

    if not meta:
        print("[WARNING: no 'done' metadata event received]")
        return None, None

    print(f"[thread_id={meta.get('thread_id')}]")
    print(f"[router_used={meta.get('router_used')}]")
    print(f"[decision={json.dumps(meta.get('decision'))}]")
    print(f"[synth_used={meta.get('synth_used')}]")

    audio_b64 = meta.get("answer_audio_base64", "")
    if audio_b64:
        audio_bytes = base64.b64decode(audio_b64)
        with open(save_answer_as, "wb") as f:
            f.write(audio_bytes)
        print(f"[spoken answer saved to {save_answer_as} ({len(audio_bytes) / 1024:.1f} KB)]")
    else:
        print("[WARNING: no answer audio returned]")

    return meta.get("thread_id"), full_text


def main():
    print(f"Testing against: {BASE_URL}")
    thread_id, _ = ask_by_voice(
        "What is our parental leave policy?",
        save_answer_as="voice_chat_answer_1.mp3",
    )
    if thread_id:
        ask_by_voice(
            "Did engineering ship anything about it?",
            thread_id=thread_id,
            save_answer_as="voice_chat_answer_2.mp3",
        )


if __name__ == "__main__":
    main()
