"""
Minimal diagnostic: list whatever voices this ElevenLabs account actually
has access to via the API, without triggering any TTS/design/library calls
that might be plan-restricted. Run this after fixing the API key's
"voices_read" permission in the ElevenLabs dashboard.

Run:
    python list_voices.py
"""

import os

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

response = client.voices.get_all()
voices = response.voices
print(f"Voices available via API on this account: {len(voices)}")
for v in voices:
    category = getattr(v, "category", "unknown")
    print(f"  - {v.name}  (id={v.voice_id}, category={category})")
