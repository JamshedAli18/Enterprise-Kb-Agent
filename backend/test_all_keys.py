"""
Checks all five API keys/models for the project.
For each: does it work (correctness), and how fast (latency)?
"""

import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

results = []


def check(label, fn):
    start = time.time()
    try:
        detail = fn()
        elapsed = time.time() - start
        print(f"PASS  {label}  ({elapsed:.2f}s)")
        if detail:
            print(f"      {detail}")
        results.append(True)
    except Exception as e:
        elapsed = time.time() - start
        print(f"FAIL  {label}  ({elapsed:.2f}s)")
        print(f"      {type(e).__name__}: {e}")
        results.append(False)


# 1. Gemini (primary LLM)
def test_gemini():
    from google import genai

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY missing from .env")
    client = genai.Client(api_key=key)
    resp = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="Reply with exactly one word: ready",
    )
    assert resp.text and "ready" in resp.text.lower()
    return f"reply: {resp.text.strip()!r}"


# 2. Cohere (embeddings)
def test_cohere():
    import cohere

    key = os.getenv("COHERE_API_KEY")
    if not key:
        raise RuntimeError("COHERE_API_KEY missing from .env")
    co = cohere.ClientV2(api_key=key)
    res = co.embed(
        texts=["The pricing policy was updated in March."],
        model="embed-v4.0",
        input_type="search_document",
        output_dimension=1024,
        embedding_types=["float"],
    )
    vec = res.embeddings.float[0]
    assert len(vec) == 1024
    return f"embedding length: {len(vec)}"


# 3. Pinecone (vector DB connectivity)
def test_pinecone():
    from pinecone import Pinecone

    key = os.getenv("PINECONE_API_KEY")
    if not key:
        raise RuntimeError("PINECONE_API_KEY missing from .env")
    pc = Pinecone(api_key=key)
    indexes = pc.list_indexes()
    return f"reachable, {len(indexes)} index(es) so far"


# 4. Groq - Qwen3.8 27B (fallback LLM)
def test_groq_chat():
    from groq import Groq

    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY missing from .env")
    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": "Reply with exactly one word: ready"}],
    )
    text = resp.choices[0].message.content
    assert text and "ready" in text.lower()
    return f"reply: {text.strip()!r}"


# 5. ElevenLabs TTS -> Groq Whisper STT round trip
def test_voice_roundtrip():
    from elevenlabs.client import ElevenLabs
    from groq import Groq

    el_key = os.getenv("ELEVENLABS_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    if not el_key:
        raise RuntimeError("ELEVENLABS_API_KEY missing from .env")
    if not groq_key:
        raise RuntimeError("GROQ_API_KEY missing from .env")

    phrase = "The pricing policy was updated in March."

    el = ElevenLabs(api_key=el_key)
    audio = el.text_to_speech.convert(
        text=phrase,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    audio_bytes = audio if isinstance(audio, (bytes, bytearray)) else b"".join(audio)

    audio_path = "voice_test.mp3"
    with open(audio_path, "wb") as f:
        f.write(audio_bytes)

    groq = Groq(api_key=groq_key)
    with open(audio_path, "rb") as f:
        transcript = groq.audio.transcriptions.create(
            file=f,
            model="whisper-large-v3-turbo",
            language="en",
            temperature=0.0,
        )

    os.remove(audio_path)

    text_out = transcript.text.lower()
    assert "pricing" in text_out and "march" in text_out, (
        f"transcription drifted too far from original: {text_out!r}"
    )
    return f"said: {phrase!r} -> heard: {transcript.text.strip()!r}"


check("Gemini 3.6 Flash (primary LLM)", test_gemini)
check("Cohere embed-v4.0 (embeddings)", test_cohere)
check("Pinecone (vector DB)", test_pinecone)
check("Groq Qwen3.8 27B (fallback LLM)", test_groq_chat)
check("ElevenLabs TTS -> Groq Whisper STT round trip", test_voice_roundtrip)

print()
if all(results):
    print("All 5 checks passed - every key and model is working.")
else:
    print(f"{results.count(False)} of {len(results)} checks failed - see FAIL lines above.")
    sys.exit(1)
