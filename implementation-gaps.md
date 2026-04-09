# Evidence Agent — Implementation Gaps (Code-Level)

## Gap 1: ElevenLabs Integration (Critical)

**Current state:** API key referenced but unused.

```python
# backend/.env.example
ELEVENLABS_API_KEY=your-key-here  # ← Defined but never read

# backend/main.py
# ✗ No endpoint to generate voice
# ✗ No audio URL in /verify response
```

**What's needed:**

```python
# backend/voice_synthesizer.py (new file)
import os
import httpx

class VoiceSynthesizer:
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        self.base_url = "https://api.elevenlabs.io/v1"
        self.voice_id = "21m00Tcm4TlvDq8ikWAM"  # Grace voice (example)

    async def synthesize(self, text: str) -> str:
        """Convert text to speech, return audio URL."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/text-to-speech/{self.voice_id}",
                headers={"xi-api-key": self.api_key},
                json={"text": text, "model_id": "eleven_monolingual_v1"}
            )
            response.raise_for_status()
            audio_data = response.content
            # Store or return URL for frontend to play
            return audio_url  # ← Implementation detail

# backend/main.py
@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    result = await agent.verify(req.claim)
    
    # ✓ NEW: Generate voice output
    voice_syn = VoiceSynthesizer()
    audio_url = await voice_syn.synthesize(result["summary"])
    result["audio_url"] = audio_url  # ← Add to response
    
    return result
```

**Frontend change:**

```javascript
// frontend/app.js
function renderVerdict(data) {
  // ... existing verdict rendering ...
  
  // ✓ NEW: Add audio player
  if (data.audio_url) {
    const audioHtml = `
      <div class="mt-4">
        <audio controls class="w-full">
          <source src="${data.audio_url}" type="audio/mpeg">
          Your browser does not support audio playback.
        </audio>
      </div>
    `;
    verdict.insertAdjacentHTML('beforeend', audioHtml);
  }
}
```

**Why it matters:** Judges will test this. ElevenLabs is one of two hackathon partners.

---

## Gap 2: Firecrawl Source Credibility (Critical)

**Current state:** All sources treated equally. No filtering or credibility signals.

```python
# backend/classifier.py:classify_source()
# ✗ Only returns: {stance, quote, relevance}
# ✗ Does NOT return: source_type, credibility_score

parsed = json.loads(text)
return {
    "url": source.get("url", ""),
    "title": source.get("title", ""),
    "quote": parsed.get("quote", ""),
    "stance": parsed.get("stance", "NEUTRAL"),
    "relevance": parsed.get("relevance", 1),
    # MISSING: "source_type": "Academic|News|Government|Blog",
    # MISSING: "credibility": 1-5 (stars)
}
```

**What's needed:**

```python
# backend/source_credibility.py (new file)
import re

class SourceCredibility:
    # Domain patterns for source classification
    ACADEMIC_DOMAINS = {
        "scholar.google.com", "arxiv.org", "researchgate.net",
        "nature.com", "science.org", "sciencedirect.com",
        "ncbi.nlm.nih.gov", ".edu"
    }
    
    NEWS_DOMAINS = {
        "reuters.com", "apnews.com", "bbc.com", "cnn.com",
        "nytimes.com", "theguardian.com", "wsj.com", "ft.com"
    }
    
    GOVERNMENT_DOMAINS = {".gov", "whitehouse.gov", "congress.gov"}
    
    # Credibility scores (1-5 stars)
    CREDIBILITY_MAP = {
        "Academic": 5,
        "News": 4,
        "Government": 5,
        "Blog": 2,
        "Commercial": 2,
        "Unknown": 1,
    }
    
    @staticmethod
    def classify_source(url: str) -> dict:
        """Classify source by domain pattern."""
        domain = url.lower()
        
        for academic in SourceCredibility.ACADEMIC_DOMAINS:
            if academic in domain:
                return {
                    "source_type": "Academic",
                    "credibility": SourceCredibility.CREDIBILITY_MAP["Academic"]
                }
        
        for news in SourceCredibility.NEWS_DOMAINS:
            if news in domain:
                return {
                    "source_type": "News",
                    "credibility": SourceCredibility.CREDIBILITY_MAP["News"]
                }
        
        for govt in SourceCredibility.GOVERNMENT_DOMAINS:
            if govt in domain:
                return {
                    "source_type": "Government",
                    "credibility": SourceCredibility.CREDIBILITY_MAP["Government"]
                }
        
        # Default to Blog/Unknown
        return {
            "source_type": "Blog",
            "credibility": SourceCredibility.CREDIBILITY_MAP["Blog"]
        }

# backend/classifier.py (modified)
from source_credibility import SourceCredibility

def classify_source(self, claim: str, source: dict) -> dict:
    # ... existing classification logic ...
    
    cred_info = SourceCredibility.classify_source(source.get("url", ""))
    
    return {
        "url": source.get("url", ""),
        "title": source.get("title", ""),
        "quote": parsed.get("quote", ""),
        "stance": parsed.get("stance", "NEUTRAL"),
        "relevance": parsed.get("relevance", 1),
        # ✓ NEW:
        "source_type": cred_info["source_type"],
        "credibility": cred_info["credibility"],
    }
```

**Frontend change:**

```javascript
// frontend/app.js
function renderSources(srcs) {
  sourceCards.innerHTML = srcs.map((s) => {
    const domain = new URL(s.url).hostname.replace("www.", "");
    const badge = STANCE_BADGE[s.stance] || STANCE_BADGE.NEUTRAL;
    
    // ✓ NEW: Credibility stars and source type
    const credibilityStars = "★".repeat(s.credibility) + 
                            "☆".repeat(5 - s.credibility);
    
    const sourceBadge = `
      <span class="text-xs px-2 py-1 rounded bg-blue-900 text-blue-200">
        ${s.source_type}
      </span>
    `;
    
    return `
      <div class="source-card bg-[#1A1A1A] border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="text-xs text-gray-500">${domain}</span>
            <h3 class="font-semibold text-sm leading-tight">${s.title || domain}</h3>
            <div class="text-xs text-yellow-400 mt-1">${credibilityStars}</div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs font-bold px-2 py-1 rounded ${badge}">${s.stance}</span>
            ${sourceBadge}
          </div>
        </div>
        ${s.quote ? `<blockquote class="border-l-2 border-gray-600 pl-3 text-sm text-gray-400 italic mt-2">"${s.quote}"</blockquote>` : ""}
        <a href="${s.url}" target="_blank" class="text-xs text-blue-400 hover:underline mt-2 inline-block">View source</a>
      </div>`;
  }).join("");

  sources.classList.remove("hidden");
}
```

**Why it matters:** Shows you're leveraging Firecrawl's scraping smarts for quality filtering (not just raw search results).

---

## Gap 3: Streaming Results (Enhancement)

**Current state:** All processing hidden behind spinner. User sees no progress.

```python
# backend/agent.py
async def verify(self, claim: str) -> dict:
    queries = self._decompose_claim(claim)
    sources = await self._search_all(queries)  # ← Waits for all 8
    classified = await asyncio.gather(*classify_tasks)  # ← Waits for all
    # User sees nothing until final response
```

**What's needed (Server-Sent Events):**

```python
# backend/main.py
from fastapi.responses import StreamingResponse
import json

@app.post("/verify-stream")
async def verify_stream(req: ClaimRequest):
    async def event_generator():
        # Step 1: Decompose
        queries = agent._decompose_claim(req.claim)
        yield f"data: {json.dumps({'type': 'decompose', 'queries': queries})}\n\n"
        
        # Step 2: Search
        sources = await agent._search_all(queries)
        for i, source in enumerate(sources):
            yield f"data: {json.dumps({'type': 'source_found', 'index': i, 'source': source})}\n\n"
        
        # Step 3: Classify (stream as they complete)
        loop = asyncio.get_event_loop()
        tasks = [
            (loop.run_in_executor(None, agent.classifier.classify_source, req.claim, s), i)
            for i, s in enumerate(sources)
        ]
        
        for task, i in asyncio.as_completed([t[0] for t in tasks]):
            classified = await task
            yield f"data: {json.dumps({'type': 'classified', 'index': i, 'result': classified})}\n\n"
        
        # Step 4: Synthesize verdict
        top_sources = sorted(classified, key=lambda x: x['relevance'], reverse=True)[:5]
        verdict = agent.classifier.synthesize_verdict(req.claim, top_sources)
        yield f"data: {json.dumps({'type': 'verdict', 'verdict': verdict})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Frontend change:**

```javascript
// frontend/app.js
async function verifyStream() {
  const claim = claimInput.value.trim();
  if (!claim) return;
  
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  status.classList.remove("hidden");
  
  const eventSource = new EventSource(`${API_URL}/verify-stream`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "decompose") {
      statusText.textContent = `Decomposed into ${data.queries.length} queries...`;
    }
    
    if (data.type === "source_found") {
      statusText.textContent = `Found source ${data.index + 1}...`;
      // Render incrementally
      addSourceCard(data.source);
    }
    
    if (data.type === "classified") {
      statusText.textContent = `Classified source ${data.index + 1}...`;
      updateSourceCard(data.index, data.result);
    }
    
    if (data.type === "verdict") {
      eventSource.close();
      status.classList.add("hidden");
      renderVerdict(data.verdict);
    }
  };
  
  eventSource.onerror = () => {
    eventSource.close();
    alert("Stream error");
  };
}
```

**Why it matters:** Users see the system working in real-time, not frozen for 15+ seconds.

---

## Gap 4: Error Resilience (Polish)

**Current state:** No retry logic, no timeouts, generic error messages.

```python
# backend/firecrawl_client.py
async def search(self, query: str, limit: int = 5) -> list[dict]:
    async with httpx.AsyncClient(timeout=30) as client:  # ← Single timeout
        resp = await client.post(...)  # ← No retry
        resp.raise_for_status()  # ← Generic HTTP error
```

**What's needed:**

```python
# backend/agent.py
from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
async def _search_all(self, queries: list[str]) -> list[dict]:
    """Run all search queries with retry logic."""
    try:
        tasks = [
            asyncio.wait_for(
                self.firecrawl.search(q, limit=3),
                timeout=30.0
            )
            for q in queries
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle partial failures gracefully
        seen_urls = set()
        unique = []
        for batch in results:
            if isinstance(batch, Exception):
                logger.warning(f"Search failed: {batch}")
                continue
            for item in batch:
                url = item.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique.append(item)
        
        return unique[:8]
    
    except asyncio.TimeoutError:
        logger.error("Search timeout after 30s")
        raise
```

**Better error messages:**

```python
# backend/main.py
@app.post("/verify")
async def verify_claim(req: ClaimRequest):
    if not req.claim.strip():
        raise HTTPException(status_code=400, detail="Claim cannot be empty")
    
    try:
        agent = EvidenceAgent()
        result = await agent.verify(req.claim.strip())
        return result
    
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Search timed out. Try a more specific claim."
        )
    
    except Exception as e:
        logger.error(f"Verification failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Verification failed. Please try again."
        )
```

**Why it matters:** Prevents cascading failures. App doesn't crash on transient API issues.

---

## Summary of Changes by Priority

| Priority | Feature | Backend Files | Frontend Files | Effort |
|----------|---------|---------------|----------------|--------|
| Critical | ElevenLabs TTS | main.py, voice_synthesizer.py (new) | app.js, index.html | 2-3h |
| Critical | Firecrawl credibility | classifier.py, source_credibility.py (new) | app.js | 2-3h |
| Enhancement | Streaming results | main.py, agent.py | app.js | 3-4h |
| Polish | Error resilience | agent.py, main.py | app.js | 2-3h |

**Total estimated:** 9-13 hours (but core MVP: 4-6 hours with phases 1+2)
