"""Podcatcher API — standalone FastAPI microservice for the podcatcher app.

Exposes two endpoints:
  POST /research  — Firecrawl search + Claude summarization → JSON
  POST /narrate   — ElevenLabs TTS → MP3 audio bytes

Runs on port 8001 (main evidence-agent API is on 8000).
Start with: uvicorn podcatcher_api:app --port 8001
"""

import os
import json
import asyncio

import anthropic
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

from firecrawl_client import FirecrawlClient
from security import cors_allowlist, require_paid_auth
from voice_synthesizer import VoiceSynthesizer

load_dotenv()

app = FastAPI(title="Podcatcher API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowlist(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


class ResearchRequest(BaseModel):
    topic: str


class NarrateRequest(BaseModel):
    text: str
    voice_id: str | None = None


SUMMARIZE_PROMPT = """You are a podcast research assistant. The user is listening to a podcast and wants quick context on a topic they heard. Summarize the key facts from these search results in 2-3 concise sentences. Be direct and informative — no fluff.

TOPIC: {topic}

SEARCH RESULTS:
{results}

Respond with just the summary, no preamble."""


@app.post("/research", dependencies=[Depends(require_paid_auth)])
async def research(req: ResearchRequest):
    """Search Firecrawl for a topic and return a summary + sources."""
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic cannot be empty")

    # Search
    fc = FirecrawlClient()
    results = await fc.search(topic, limit=4)

    if not results:
        return {"summary": "No results found for this topic.", "sources": []}

    # Format results for summarization
    results_text = "\n\n".join(
        f"Source: {r.get('title', 'Unknown')}\n{r.get('content', '')[:500]}"
        for r in results
    )

    # Summarize with Claude
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    resp = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": SUMMARIZE_PROMPT.format(topic=topic, results=results_text)
        }]
    )
    summary = resp.content[0].text.strip()

    # Return slim sources (no raw content)
    sources = [
        {"title": r.get("title", ""), "url": r.get("url", "")}
        for r in results
    ]

    return {"summary": summary, "sources": sources}


@app.post("/narrate", dependencies=[Depends(require_paid_auth)])
async def narrate(req: NarrateRequest):
    """Convert text to speech via ElevenLabs. Returns MP3 audio bytes."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    try:
        synth = VoiceSynthesizer()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    audio_bytes = await synth.synthesize(
        text=text,
        voice_id=req.voice_id or "21m00Tcm4TlvDq8ikWAM",
    )
    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "podcatcher-api"}
