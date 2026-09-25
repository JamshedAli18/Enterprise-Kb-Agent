"""
app/voice.py -- STT (Groq Whisper) and TTS (Deepgram Aura-2) helpers for
voice I/O, used by the /voice-chat endpoint in main.py.

Proven via test_voice_io.py: Deepgram TTS -> Groq Whisper STT round-trip
achieved 92% word overlap with the original text (the only differences were
Whisper writing numbers as digits instead of spelled out, which is normal
Whisper formatting, not a transcription error).

Run directly for a self-test (same round-trip check, using these functions
instead of a standalone script):
    python app/voice.py
"""

import io
import os
import time

import httpx
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"
DEEPGRAM_VOICE_MODEL = "aura-2-asteria-en"
WHISPER_MODEL = "whisper-large-v3-turbo"

groq_client = Groq(api_key=GROQ_API_KEY)


def synthesize_speech_bytes(text: str) -> bytes:
    """Text -> mp3 audio bytes via Deepgram Aura-2."""
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json",
    }
    params = {"model": DEEPGRAM_VOICE_MODEL, "encoding": "mp3"}
    response = httpx.post(
        DEEPGRAM_TTS_URL,
        headers=headers,
        params=params,
        json={"text": text},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.content


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.mp3") -> str:
    """Audio bytes -> transcript text via Groq Whisper."""
    buffer = io.BytesIO(audio_bytes)
    buffer.name = filename
    transcription = groq_client.audio.transcriptions.create(
        file=buffer,
        model=WHISPER_MODEL,
    )
    return transcription.text


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

def word_overlap_ratio(original: str, transcribed: str) -> float:
    def normalize(s):
        return set(w.strip(".,!?").lower() for w in s.split())
    orig_words = normalize(original)
    trans_words = normalize(transcribed)
    if not orig_words:
        return 0.0
    return len(orig_words & trans_words) / len(orig_words)


def main():
    test_text = (
        "All new parents are eligible for sixteen weeks of paid parental leave, "
        "which can be taken within the first twelve months after the child arrives."
    )
    print(f"Original text:\n  {test_text!r}\n")

    print(f"Synthesizing speech with Deepgram ({DEEPGRAM_VOICE_MODEL})...")
    t0 = time.time()
    audio_bytes = synthesize_speech_bytes(test_text)
    print(f"  got {len(audio_bytes) / 1024:.1f} KB of audio in {time.time() - t0:.2f}s")

    print("\nTranscribing that audio back with Groq Whisper (in-memory, no temp file)...")
    t0 = time.time()
    transcribed = transcribe_audio_bytes(audio_bytes)
    print(f"  transcribed in {time.time() - t0:.2f}s")
    print(f"  transcription:\n  {transcribed!r}")

    overlap = word_overlap_ratio(test_text, transcribed)
    print(f"\nWord overlap with original: {overlap:.0%}")
    if overlap >= 0.8:
        print("PASS  in-memory round trip matches the file-based test")
    else:
        print("FAIL  in-memory round trip diverges from the file-based test")


if __name__ == "__main__":
    main()
