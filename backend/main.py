"""Evidence Agent — FastAPI backend."""

import os
import json
import anthropic
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from agent import EvidenceAgent
from voice_synthesizer import VoiceSynthesizer

load_dotenv()

app = FastAPI(title="Evidence Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClaimRequest(BaseModel):
    claim: str


class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None


class FollowUpRequest(BaseModel):
    question: str
    claim: str
    verdict: str
    summary: str
    sources: list[dict]


@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    if not req.claim.strip():
        raise HTTPException(status_code=400, detail="Claim cannot be empty")

    agent = EvidenceAgent()
    result = await agent.verify(req.claim.strip())
    return result


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        synth = VoiceSynthesizer()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    audio_bytes = await synth.synthesize(
        text=req.text.strip(),
        voice_id=req.voice_id or "21m00Tcm4TlvDq8ikWAM",
    )
    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.get("/verify/stream")
async def verify_claim_stream(claim: str = Query(..., min_length=1)):
    agent = EvidenceAgent()
    return StreamingResponse(
        agent.verify_stream(claim.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/followup")
async def followup(req: FollowUpRequest):
    """Answer a follow-up question about a previous verification result."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    sources_text = "\n".join(
        f"- [{s.get('stance', 'NEUTRAL')}] {s.get('title', '')}: \"{s.get('quote', '')}\" "
        f"(credibility: {s.get('credibility', 5)}, url: {s.get('url', '')})"
        for s in req.sources
    )

    prompt = f"""You are Evidence Agent, a claim verification assistant. The user already verified a claim and now has a follow-up question.

ORIGINAL CLAIM: {req.claim}
VERDICT: {req.verdict}
SUMMARY: {req.summary}

EVIDENCE SOURCES:
{sources_text}

USER'S FOLLOW-UP QUESTION: {req.question}

Answer concisely (2-4 sentences) based on the evidence above. If the question asks about something not covered by the sources, say so. Stay factual and cite specific sources when relevant."""

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    resp = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"answer": resp.content[0].text.strip()}


@app.get("/health")
async def health():
    return {"status": "ok"}
