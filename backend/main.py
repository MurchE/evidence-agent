"""Evidence Agent — FastAPI backend."""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from agent import EvidenceAgent

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


@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    if not req.claim.strip():
        raise HTTPException(status_code=400, detail="Claim cannot be empty")

    agent = EvidenceAgent()
    result = await agent.verify(req.claim.strip())
    return result


@app.get("/health")
async def health():
    return {"status": "ok"}
