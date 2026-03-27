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
    voice: str | None = None  # name-based selection

# ElevenLabs voice name → ID mapping
VOICE_MAP = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",      # Rachel — clear, authoritative
    "george": "JBFqnCBsd6RMkjVDRZzb",       # George — British, crisp
    "josh": "TxGEqnHWrfWFTfGW9XjX",         # Josh — young, enthusiastic
    "murch": "k8OsasklrEkKLNYd4ykK",           # Murch — cloned voice
}


class FollowUpRequest(BaseModel):
    question: str
    claim: str
    verdict: str
    summary: str
    sources: list[dict]


DEFAULT_MOCK_RESULT = {
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

MOCK_RESULTS_BY_CLAIM = {
    "drinking coffee reduces alzheimer's risk": {
        "verdict": "SUPPORTED",
        "confidence": 8,
        "summary": "The evidence supports that regular moderate coffee intake is associated with lower Alzheimer's and dementia risk. Multiple cohort studies and review-level syntheses report protective associations, and plausible biological pathways exist. Most evidence is observational, so this is a strong association rather than a definitive causal prevention claim.",
        "sources": [
            {
                "url": "https://pubmed.ncbi.nlm.nih.gov/20182054/",
                "title": "Midlife coffee and tea drinking and late-life dementia",
                "quote": "Coffee drinkers at midlife had lower risk of dementia and Alzheimer disease at follow-up.",
                "stance": "FOR",
                "relevance": 10,
                "credibility": 9,
                "credibility_reason": "Peer-reviewed longitudinal cohort with clinically relevant endpoint.",
            },
            {
                "url": "https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/1105943",
                "title": "Caffeine intake and cognitive decline",
                "quote": "Higher long-term caffeine intake was associated with slower cognitive decline.",
                "stance": "FOR",
                "relevance": 9,
                "credibility": 9,
                "credibility_reason": "Major medical journal publication with robust cohort analysis.",
            },
            {
                "url": "https://www.alzheimers.org.uk/blog/can-coffee-help-prevent-dementia",
                "title": "Can coffee help prevent dementia?",
                "quote": "Current evidence suggests a potential association, but we still cannot conclude coffee directly prevents dementia.",
                "stance": "NEUTRAL",
                "relevance": 8,
                "credibility": 8,
                "credibility_reason": "Evidence-focused nonprofit summary with balanced caveats.",
            },
        ],
    },
    "exercise is more effective than antidepressants for mild depression": {
        "verdict": "SUPPORTED",
        "confidence": 7,
        "summary": "The evidence supports that structured exercise can match or outperform antidepressants for many patients with mild depression. Meta-analyses report meaningful symptom improvements, especially when exercise is supervised and sustained. Outcomes still vary by adherence and individual response, so medication remains important in some cases.",
        "sources": [
            {
                "url": "https://www.bmj.com/content/384/bmj-2023-075847",
                "title": "Effect of exercise for depression: umbrella review",
                "quote": "Exercise showed moderate effects on depression symptoms across a wide range of populations and modalities.",
                "stance": "FOR",
                "relevance": 10,
                "credibility": 9,
                "credibility_reason": "High-quality umbrella review in a major peer-reviewed journal.",
            },
            {
                "url": "https://www.nice.org.uk/guidance/ng222",
                "title": "NICE guideline: Depression in adults",
                "quote": "Guidelines recommend considering exercise and behavioural activation as core options for less severe depression.",
                "stance": "FOR",
                "relevance": 8,
                "credibility": 9,
                "credibility_reason": "National evidence-based clinical guideline from a trusted standards body.",
            },
            {
                "url": "https://www.psychiatry.org/patients-families/depression/what-is-depression",
                "title": "APA overview of depression treatment",
                "quote": "Lifestyle interventions can help, but antidepressants remain effective and necessary for many individuals depending on severity and response.",
                "stance": "NEUTRAL",
                "relevance": 8,
                "credibility": 8,
                "credibility_reason": "Authoritative psychiatric guidance with balanced interpretation.",
            },
        ],
    },
}


def _normalize_claim(claim: str) -> str:
    return " ".join(claim.lower().split())


def _get_mock_result(claim: str) -> dict:
    return MOCK_RESULTS_BY_CLAIM.get(_normalize_claim(claim), DEFAULT_MOCK_RESULT)


@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    if not req.claim.strip():
        raise HTTPException(status_code=400, detail="Claim cannot be empty")

    if MOCK_MODE:
        return _get_mock_result(req.claim)

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

    # Resolve voice: explicit ID > name lookup > default
    voice_id = req.voice_id
    if not voice_id and req.voice:
        voice_id = VOICE_MAP.get(req.voice.lower(), "21m00Tcm4TlvDq8ikWAM")
    voice_id = voice_id or "21m00Tcm4TlvDq8ikWAM"

    audio_bytes = await synth.synthesize(
        text=req.text.strip(),
        voice_id=voice_id,
    )
    return Response(content=audio_bytes, media_type="audio/mpeg")


async def _mock_stream(claim: str):
    """Simulate the SSE stream with mock data and realistic delays."""
    import asyncio

    mock_result = _get_mock_result(claim)

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    yield _sse("step", {"step": "decompose", "message": "Decomposing claim into search queries..."})
    await asyncio.sleep(0.8)
    queries = [f"{claim} scientific evidence", f"{claim} meta-analysis", f"{claim} risks benefits"]
    yield _sse("queries", {"queries": queries})
    await asyncio.sleep(0.5)

    yield _sse("step", {"step": "search", "message": "Searching 3 queries via Firecrawl..."})
    await asyncio.sleep(1.2)
    yield _sse("search_done", {"count": len(mock_result["sources"])})

    yield _sse("step", {"step": "classify", "message": f"Classifying {len(mock_result['sources'])} sources..."})
    for i, src in enumerate(mock_result["sources"]):
        await asyncio.sleep(0.6)
        yield _sse("source_classified", {
            "index": i + 1,
            "total": len(mock_result["sources"]),
            "title": src["title"],
            "stance": src["stance"],
        })

    yield _sse("step", {"step": "synthesize", "message": "Synthesizing final verdict..."})
    await asyncio.sleep(1.0)
    yield _sse("result", mock_result)


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
        normalized_claim = _normalize_claim(req.claim)
        q = req.question.lower()
        if "coffee" in normalized_claim and "against" in q:
            return {"answer": "The strongest challenge is that most positive findings are observational rather than randomized prevention trials, so causality is not fully proven. Residual confounding from lifestyle factors and socioeconomic differences can still influence the association. In other words, coffee may be a marker of a healthier profile in some cohorts rather than the sole causal factor."}
        if "coffee" in normalized_claim:
            return {"answer": "The strongest supportive thread is consistency across multiple long-term cohort datasets: moderate coffee users repeatedly show lower dementia and Alzheimer incidence. The signal is biologically plausible through caffeine, antioxidant polyphenols, and vascular effects, though experts still frame this as a strong association rather than definitive proof of prevention."}
        if "exercise" in normalized_claim and "against" in q:
            return {"answer": "A fair counterpoint is that exercise response depends heavily on adherence, intensity, and supervision, and some patients improve faster with medication. Effect sizes vary across studies, and severe or complex depression often requires pharmacologic and psychotherapeutic support. So exercise is powerful, but not a universal replacement."}
        if "exercise" in normalized_claim:
            return {"answer": "The best argument in favor is that supervised exercise programs often produce antidepressant-scale symptom improvements in mild depression while also improving sleep, anxiety, and physical health. This gives exercise a broader risk-benefit profile for many mild cases. Most experts still position it as first-line or adjunctive care depending on individual context."}
        return {"answer": "In mock mode, JudiciAI can answer focused follow-ups about evidence quality, strongest supporting arguments, and strongest counterarguments. Ask for the bull or bear case to see a stronger demo response."}

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
        model=os.getenv("FOLLOWUP_MODEL", "claude-haiku-4-5"),
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"answer": resp.content[0].text.strip()}


@app.get("/health")
async def health():
    return {"status": "ok"}
