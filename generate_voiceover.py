import os
import requests
from dotenv import load_dotenv

load_dotenv('/Users/murchewings/Projects/evidence-agent/backend/.env')
api_key = os.environ['ELEVENLABS_API_KEY']
voice_id = 'k8OsasklrEkKLNYd4ykK'

voiceover_text = """Your boss just told you keto lowers cholesterol. Your doctor says the opposite. Who's right? Let's find out in under 60 seconds.

Type any claim. JudiciAI searches the web, pulls real sources, and classifies each one as FOR, AGAINST, or NEUTRAL.

Verdict: MURKY. Confidence 5 out of 10. The evidence is genuinely split. And unlike ChatGPT, we don't pretend to know when the science doesn't. Every source is cited. Every score is explained. Click through and verify yourself.

Want both sides? Hit the bull for the strongest case FOR. Hit the bear for the strongest case AGAINST. Steel-man both arguments in seconds.

It reads the verdict out loud. Share it with your team. Copy it. Post it. The evidence speaks.

JudiciAI. Built with ElevenLabs voice and Firecrawl search. Because the world doesn't need another AI that's always confident. It needs one that's always honest."""

url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
headers = {
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": api_key
}
data = {
    "text": voiceover_text,
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "speed": 1.15
    }
}
response = requests.post(url, json=data, headers=headers)
if response.status_code == 200:
    with open('/Users/murchewings/Projects/evidence-agent/demo_voiceover.mp3', 'wb') as f:
        f.write(response.content)
    print("Voiceover saved to demo_voiceover.mp3")
    print(f"File size: {len(response.content)} bytes")
else:
    print(f"Error: {response.status_code} - {response.text}")
