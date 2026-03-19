"""ElevenLabs TTS voice synthesis for verdict narration."""

import os
import httpx

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"

# Rachel — clear, authoritative narration voice
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


class VoiceSynthesizer:
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise RuntimeError("ELEVENLABS_API_KEY not set")
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def synthesize(
        self,
        text: str,
        voice_id: str = DEFAULT_VOICE_ID,
        model_id: str = "eleven_multilingual_v2",
    ) -> bytes:
        """Convert text to speech, return raw MP3 bytes."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}",
                headers=self.headers,
                json={
                    "text": text,
                    "model_id": model_id,
                    "voice_settings": {
                        "stability": 0.6,
                        "similarity_boost": 0.8,
                        "style": 0.3,
                    },
                },
            )
            resp.raise_for_status()
            return resp.content
