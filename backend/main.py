"""Evidence Agent — FastAPI backend."""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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


@app.get("/health")
async def health():
    return {"status": "ok"}
