"""
Voice I/O round-trip test: Deepgram TTS (Aura-2) -> Groq Whisper STT.

Replaces ElevenLabs after hitting three separate free-tier API restrictions
in a row (library voices blocked via API, voice creation via API requires a
paid plan, and a permissions gap on top of that). Deepgram's Aura-2 TTS is
used via a plain REST call instead of pulling in another SDK.

Round-trip test, same as before: synthesize speech from known text, save to
a local file, transcribe it back with Groq Whisper, and compare against the
original text.

Run:
    python test_voice_io.py
"""

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

TEST_TEXT = (
    "All new parents are eligible for sixteen weeks of paid parental leave, "
    "which can be taken within the first twelve months after the child arrives."
)

AUDIO_PATH = "voice_test_output.mp3"


def synthesize_speech(text: str, path: str) -> float:
    t0 = time.time()
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
    with open(path, "wb") as f:
        f.write(response.content)
    return time.time() - t0


def transcribe_speech(path: str):
    t0 = time.time()
    with open(path, "rb") as f:
        transcription = groq_client.audio.transcriptions.create(
            file=f,
            model=WHISPER_MODEL,
        )
    return transcription.text, time.time() - t0


def word_overlap_ratio(original: str, transcribed: str) -> float:
    def normalize(s):
        return set(w.strip(".,!?").lower() for w in s.split())
    orig_words = normalize(original)
    trans_words = normalize(transcribed)
    if not orig_words:
        return 0.0
    return len(orig_words & trans_words) / len(orig_words)


def main():
    print(f"Original text:\n  {TEST_TEXT!r}\n")

    print(f"Synthesizing speech with Deepgram ({DEEPGRAM_VOICE_MODEL})...")
    tts_time = synthesize_speech(TEST_TEXT, AUDIO_PATH)
    size_kb = os.path.getsize(AUDIO_PATH) / 1024
    print(f"  saved {AUDIO_PATH} ({size_kb:.1f} KB) in {tts_time:.2f}s")

    print("\nTranscribing that audio back with Groq Whisper...")
    transcribed_text, stt_time = transcribe_speech(AUDIO_PATH)
    print(f"  transcribed in {stt_time:.2f}s")
    print(f"  transcription:\n  {transcribed_text!r}")

    overlap = word_overlap_ratio(TEST_TEXT, transcribed_text)
    print(f"\nWord overlap with original: {overlap:.0%}")
    if overlap >= 0.8:
        print("PASS  transcription closely matches the original text")
    else:
        print("FAIL  transcription diverges significantly from the original text")


if __name__ == "__main__":
    main()
