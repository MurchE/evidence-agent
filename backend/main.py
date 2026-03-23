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

MOCK_MODE = os.getenv("MOCK_MODE", "").lower() in ("1", "true", "yes")

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


MOCK_RESULT = {
    "verdict": "SUPPORTED",
    "confidence": 7,
    "summary": "Multiple peer-reviewed studies indicate moderate coffee consumption (3-4 cups/day) is associated with reduced cardiovascular risk. However, effects vary by individual genetics and preparation method.",
    "sources": [
        {
            "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123456",
            "title": "Coffee Consumption and Cardiovascular Health: A Meta-Analysis",
            "quote": "Moderate coffee intake was associated with a 15% lower risk of cardiovascular disease in a pooled analysis of 36 prospective studies.",
            "stance": "FOR",
            "relevance": 9,
            "credibility": 9,
            "credibility_reason": "Peer-reviewed meta-analysis published in a top-tier medical journal",
        },
        {
            "url": "https://www.heart.org/en/news/2024/coffee-heart-health",
            "title": "AHA: Coffee and Your Heart — What the Research Shows",
            "quote": "The American Heart Association notes that moderate coffee consumption does not appear to increase heart disease risk for most adults.",
            "stance": "FOR",
            "relevance": 8,
            "credibility": 8,
            "credibility_reason": "Official statement from a major medical authority",
        },
        {
            "url": "https://www.bmj.com/content/360/bmj.k194",
            "title": "Coffee consumption and health: umbrella review",
            "quote": "Coffee consumption was more often associated with benefit than harm across multiple health outcomes.",
            "stance": "FOR",
            "relevance": 8,
            "credibility": 9,
            "credibility_reason": "BMJ umbrella review — high evidence quality",
        },
        {
            "url": "https://www.mayoclinic.org/coffee-heart-disease",
            "title": "Mayo Clinic: Is coffee good for your heart?",
            "quote": "Unfiltered coffee may raise cholesterol levels, and excessive caffeine can increase blood pressure in sensitive individuals.",
            "stance": "AGAINST",
            "relevance": 7,
            "credibility": 8,
            "credibility_reason": "Reputable medical institution providing balanced perspective",
        },
    ],
}


@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    if not req.claim.strip():
        raise HTTPException(status_code=400, detail="Claim cannot be empty")

    if MOCK_MODE:
        return MOCK_RESULT

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


async def _mock_stream(claim: str):
    """Simulate the SSE stream with mock data and realistic delays."""
    import asyncio

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    yield _sse("step", {"step": "decompose", "message": "Decomposing claim into search queries..."})
    await asyncio.sleep(0.8)
    queries = [f"{claim} scientific evidence", f"{claim} meta-analysis", f"{claim} risks benefits"]
    yield _sse("queries", {"queries": queries})
    await asyncio.sleep(0.5)

    yield _sse("step", {"step": "search", "message": "Searching 3 queries via Firecrawl..."})
    await asyncio.sleep(1.2)
    yield _sse("search_done", {"count": len(MOCK_RESULT["sources"])})

    yield _sse("step", {"step": "classify", "message": f"Classifying {len(MOCK_RESULT['sources'])} sources..."})
    for i, src in enumerate(MOCK_RESULT["sources"]):
        await asyncio.sleep(0.6)
        yield _sse("source_classified", {
            "index": i + 1,
            "total": len(MOCK_RESULT["sources"]),
            "title": src["title"],
            "stance": src["stance"],
        })

    yield _sse("step", {"step": "synthesize", "message": "Synthesizing final verdict..."})
    await asyncio.sleep(1.0)
    yield _sse("result", MOCK_RESULT)


@app.get("/verify/stream")
async def verify_claim_stream(claim: str = Query(..., min_length=1)):
    if MOCK_MODE:
        return StreamingResponse(
            _mock_stream(claim.strip()),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

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

    if MOCK_MODE:
        return {"answer": "Based on the evidence reviewed, the studies primarily examined filtered coffee. Unfiltered methods like French press may have different cardiovascular effects due to cafestol and kahweol compounds that can raise LDL cholesterol."}

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
