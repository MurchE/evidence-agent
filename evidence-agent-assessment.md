# Evidence Agent — Hackathon Readiness Assessment

**Date:** 2026-03-19  
**Repo:** https://github.com/MurchE/evidence-agent  
**Branch:** development (initial scaffold, 1 commit)

---

## 1. CONCEPT & VISION

**What is Evidence Agent?**

A voice-first, AI-powered claim verification system. User speaks or types a claim → system decomposes it into search queries → Firecrawl searches the web → Claude classifies sources for stance and relevance → synthesis produces a verdict (SUPPORTED / UNSUPPORTED / MURKY) with confidence score and cited evidence.

**Strategic positioning:**
- **Problem:** Information overload + polarized claims. People can't quickly distinguish fact from fiction.
- **UX:** Voice-first (accessibility + natural input) + immediate visual verdict.
- **Moat:** Relational forensics approach: not just "what is true" but "why sources disagree."

**Hackathon angle (ElevenLabs x Firecrawl):**
- **ElevenLabs:** Voice output. System speaks the verdict back (accessibility, podcast potential, news briefing voice).
- **Firecrawl:** Already integrated for web search + content scraping. Could be enhanced with intelligent filtering (legal docs, academic papers, news sources).

---

## 2. TECH STACK (CURRENT)

### Backend
- **Framework:** FastAPI 0.115.6 + uvicorn
- **LLM:** Claude Sonnet 4 (2025-05-14) via Anthropic Python SDK
- **Web Search:** Firecrawl API (search + scrape)
- **Async:** asyncio for concurrent Firecrawl searches + thread pool for sync Claude calls
- **HTTP:** httpx for async Firecrawl requests
- **Config:** python-dotenv for API key management

### Frontend
- **Stack:** Vanilla HTML/JS/CSS (zero build step)
- **Voice input:** Web Speech API (browser-native, no external dependency)
- **Styling:** Tailwind CSS CDN (dark mode design)
- **HTTP:** Fetch API

### Deployment readiness
- **Local dev:** Works on localhost:3000 (frontend) + localhost:8000 (backend)
- **CORS:** Enabled (open "*" — fine for hackathon, needs scoping for production)
- **API:** RESTful POST /verify + GET /health

---

## 3. WHAT'S ALREADY BUILT

### Backend
1. **Claim decomposition** (`agent.py:_decompose_claim`)
   - Takes raw claim → Claude generates 3 diverse search queries
   - JSON parsing with fallback
   - ✅ Working

2. **Web search pipeline** (`agent.py:_search_all`)
   - Concurrent async Firecrawl searches
   - URL deduplication
   - Content scraping (markdown format)
   - Capped at 8 unique sources
   - ✅ Working

3. **Evidence classification** (`classifier.py:classify_source`)
   - Classifies each source's stance: FOR / AGAINST / NEUTRAL
   - Extracts relevant quote
   - Relevance scoring (1-10)
   - ✅ Working

4. **Verdict synthesis** (`classifier.py:synthesize_verdict`)
   - Aggregates classified sources
   - Produces final verdict: SUPPORTED / UNSUPPORTED / MURKY
   - Confidence score (1-10)
   - 2-3 sentence summary
   - ✅ Working

5. **FastAPI entrypoint** (`main.py`)
   - POST /verify endpoint (async)
   - GET /health for liveness
   - CORS middleware
   - Error handling (400 on empty claim)
   - ✅ Working

### Frontend
1. **Voice input** (`app.js`)
   - Web Speech API integration
   - Push-to-talk mic button
   - Transcript → input field auto-fill
   - ✅ Working (Chrome/Edge/Safari)

2. **Claim entry**
   - Text input + Enter key trigger
   - ✅ Working

3. **Verdict display**
   - Color-coded cards (green=SUPPORTED, red=UNSUPPORTED, amber=MURKY)
   - Confidence bar (0-100%)
   - Summary text
   - ✅ Working

4. **Source cards**
   - Title + domain
   - Stance badge (FOR/AGAINST/NEUTRAL)
   - Relevant quote block
   - Clickable "View source" link
   - ✅ Working

5. **Status animation**
   - Spinning loader
   - 4-step status message cycle during processing
   - ✅ Working

---

## 4. WHAT'S MISSING FOR HACKATHON READINESS

### CRITICAL GAPS

#### A. **ElevenLabs Voice Output** ⚠️ MISSING
- **What:** Read the verdict summary + sources using ElevenLabs TTS
- **Why it matters:** ElevenLabs is half the hackathon brief. Voice I/O (not just input) unlocks:
  - Accessibility for blind/low-vision users
  - Podcast/news briefing format
  - Hands-free consumption
- **Current state:** ElevenLabs API key is defined in `.env.example` but **not used anywhere**
- **Implementation needs:**
  1. Backend: Add TTS route (POST /synthesize-voice) → feeds verdict summary + source quotes
  2. Frontend: Add audio player below verdict card
  3. Optional: Auto-play on verdict completion
  4. Optional: Voice clips per source (quote audio)

#### B. **Firecrawl Advanced Filtering** ⚠️ PARTIALLY MISSING
- **What:** Intelligent filtering by source type (academic, news, government, etc.)
- **Why it matters:** Shows Firecrawl's smart scraping — not just "find any 8 sources"
- **Current state:** Vanilla search → markdown → raw dedup. No quality/source-type filtering.
- **Implementation needs:**
  1. Post-scrape filtering by domain patterns (scholar.google.com, .gov, Reuters, AP, BBC, Nature, JAMA)
  2. Source type tagging (Academic / News / Government / Blog / Commercial)
  3. UI: Filter toggle to show only trusted sources
  4. Optional: Source credibility score (1-10 based on domain reputation)

#### C. **Streaming Verdict Generation** ⚠️ MISSING
- **What:** Real-time streaming of classification results as sources are evaluated
- **Why it matters:** User sees progress (sources accumulating) instead of frozen spinner
- **Current state:** All classification happens in parallel, then verdict is synthesized once. Frontend shows generic status spinner.
- **Implementation needs:**
  1. Backend: Switch to Server-Sent Events (SSE) or WebSocket
  2. Stream: source classification updates as they complete
  3. Frontend: Real-time card insertion into sources pane
  4. Verdict synthesis waits for top 5 sources or timeout

#### D. **Error Recovery & Edge Cases** ⚠️ PARTIALLY MISSING
- No graceful handling if Firecrawl API fails mid-request
- No retry logic for transient failures
- Frontend only shows generic "Error:" alert
- No timeout protection (requests can hang)
- Limited logging for debugging

#### E. **Production-Ready Config** ⚠️ MISSING
- CORS is open ("*") — needs scoping to origin domain
- No request timeout on /verify endpoint
- No rate limiting (API abuse risk)
- No auth/validation beyond empty claim check
- No logging/monitoring hooks

### IMPORTANT FEATURES (NOT CRITICAL FOR HACKATHON)

1. **Claim context/follow-ups** — e.g., "verify for 2025" vs "2020"
2. **Source credibility database** — custom scoring of known sources
3. **Multi-language support** — currently hardcoded to en-US
4. **Persistent verdict history** — database to store past verifications
5. **Fact-check citation database** — cross-reference against Snopes, PolitiFact, FactCheck.org
6. **Debate mode** — show FOR vs AGAINST sources side-by-side with strength metrics
7. **Export** — save verdict as PDF / JSON
8. **Mobile app** — currently web-only (responsive, but no native app)

---

## 5. HOW ELEVENLABS + FIRECRAWL FIT IN

### ElevenLabs Integration Points

**Primary:**
1. **Verdict narration** (MVP)
   - After verdict is synthesized, send summary to ElevenLabs TTS
   - Play audio in browser with player controls
   - ~20-30 sec narration per verdict
   - Voice selection: use Murch's preference (e.g., "Grace" or custom voice clone)

2. **Source quote reading** (nice-to-have)
   - Read each source's quote aloud
   - Parallelizable — generate all audio in parallel
   - Optional auto-play with pagination

3. **Interactive verdict** (polish)
   - Voice assistant mode: "Ask me about any claim"
   - Microphone button → record claim → process → speak verdict

### Firecrawl Enhancement Points

**Primary:**
1. **Source type detection**
   - Use Firecrawl's scrape output to identify domain type
   - Tag as Academic / News / Government / Blog
   - Display in source cards

2. **Content quality filtering**
   - Filter out content farms, ads, thin pages
   - Prioritize deep content (article length > 500 words)
   - Score by relevance of extracted quote to claim

**Secondary (hackathon bonus):**
1. **Multi-format search**
   - PDF search for academic papers
   - News archives (structured date filtering)
   - Government documents (.gov scraping)

---

## 6. HACKATHON ROADMAP (PRIORITIZED)

### Phase 1: ElevenLabs Integration (CORE)
**Effort:** 2-3 hours  
**Files to touch:** `main.py`, `app.js`, `agent.py`

- [ ] Add `/synthesize-voice` endpoint: takes text → calls ElevenLabs API → returns audio URL
- [ ] Store audio URL in verdict response: `{..., "audio_url": "..."`
- [ ] Frontend: Add audio player below verdict card
- [ ] Auto-play on verdict ready (toggle in UI)
- [ ] Test with 3-5 sample claims

**Success criterion:** User clicks "Verify" → sees verdict + hears verdict read aloud

---

### Phase 2: Firecrawl Source Filtering (CORE)
**Effort:** 2-3 hours  
**Files to touch:** `firecrawl_client.py`, `classifier.py`, `app.js`

- [ ] Add source type detection logic (domain pattern matching)
  - Academic: scholar.google.com, arxiv.org, researchgate.net, *.edu, nature.com, sciencedirect.com, ncbi.nlm.nih.gov
  - News: reuters.com, apnews.com, bbc.com, cnn.com, nyt.com, theguardian.com, wsj.com, ft.com
  - Government: .gov, whitehouse.gov, congress.gov, state.*.us
  - Blog/Other: remaining
- [ ] Add `source_type` field to source card response
- [ ] Frontend: Display source type badge next to domain
- [ ] Optional: Add UI toggle "Show only trusted sources" (filter to Academic + News + Government)

**Success criterion:** Source cards show credibility tier; users can filter by source type

---

### Phase 3: Streaming Results (ENHANCEMENT)
**Effort:** 3-4 hours  
**Files to touch:** `main.py`, `agent.py`, `app.js`

- [ ] Implement SSE endpoint: `/verify-stream`
- [ ] Stream source classification updates as they complete
- [ ] Frontend: Real-time card rendering
- [ ] Verdict synthesized once top 5 sources ready (or timeout at 20s)

**Success criterion:** Frontend shows sources accumulating in real-time; users see progress

---

### Phase 4: Error Resilience (POLISH)
**Effort:** 2-3 hours  
**Files to touch:** `agent.py`, `main.py`, `app.js`

- [ ] Add retry logic for transient API failures (3x with exponential backoff)
- [ ] Set request timeouts (30s for search, 10s for classification, 5s for TTS)
- [ ] Graceful fallback if Firecrawl returns <2 sources (show empty state, not error)
- [ ] Detailed error messages in UI (not generic "Error: ...")
- [ ] Structured logging (JSON logs with request ID for debugging)

**Success criterion:** App handles partial Firecrawl failures without crashing; user sees clear feedback

---

## 7. SPECIFIC RECOMMENDATIONS

### For ElevenLabs Integration
1. **API choice:** Use `text_to_speech` endpoint (simple, no streaming needed)
2. **Voice:** Try "Grace" (professional, clear) or create a custom voice clone of Murch's voice (premium feature, skippable for hackathon)
3. **Caching:** Cache audio URLs by verdict text hash (avoid re-generating same audio)
4. **Fallback:** If ElevenLabs API fails, show text verdict only (graceful degradation)

**Example flow:**
```
POST /verify (claim)
→ Backend processes, gets verdict + sources
→ Backend calls ElevenLabs: POST /text_to_speech
→ ElevenLabs returns audio URL
→ Backend embeds audio_url in response JSON
→ Frontend renders <audio> player
→ User can play/pause/download
```

### For Firecrawl Enhancements
1. **Source reputation score:** Build a simple mapping of domain → credibility (1-5 stars)
   - 5 stars: Nature, Science, government agencies, Reuters, AP
   - 4 stars: mainstream news (BBC, Guardian, WSJ, NYT)
   - 3 stars: academic (arxiv, ResearchGate, .edu)
   - 2 stars: blogs, Medium, Wikipedia
   - 1 star: content farms, no-auth pages
   
2. **Quote quality:** Prioritize sources where quote is >50 chars (meaningful extract)
3. **Content depth:** Filter out pages <300 words (too thin to be reliable)

### For Polish
1. **Loading states:** Show "Fetching sources..." → "Analyzing source 3/8" → "Synthesizing verdict..."
2. **Mobile responsiveness:** Test on mobile; source cards currently stack nicely but input area could be tighter
3. **Accessibility:** Add ARIA labels to buttons, alt text for icons, keyboard nav
4. **Examples:** Add 3-5 sample claims in a collapsed "Try these" section (pre-populated prompts)

---

## 8. DEPENDENCIES & DEPLOYMENT CHECKLIST

### Required API Keys (for hackathon)
- ✅ ANTHROPIC_API_KEY (already integrated)
- ✅ FIRECRAWL_API_KEY (already integrated)
- ⚠️ ELEVENLABS_API_KEY (needs integration)

### Python Dependencies to Add
- No new backend dependencies needed for ElevenLabs (vanilla HTTP request via httpx)
- Optional: `tenacity` for retry logic (1 line to add if implementing Phase 4)

### Frontend Dependencies
- None (vanilla JS, no npm)

### Deployment
- Backend: `uvicorn main:app --host 0.0.0.0 --port 8000`
- Frontend: Static files (can serve via FastAPI with StaticFiles middleware, or separate server)
- Recommended: Use FastAPI to serve both (single container)

---

## 9. KNOWN ISSUES & CAVEATS

1. **Web Speech API limitations**
   - Only works in Chrome, Edge, Safari (not Firefox native, but polyfills exist)
   - Requires microphone permission
   - Transcription quality varies by browser
   - Mitigation: Show fallback text input option (already present)

2. **Firecrawl rate limiting**
   - If running multiple concurrent searches, may hit Firecrawl rate limits
   - Current code limits to 8 sources max (safe)
   - Monitor API usage in hackathon environment

3. **Claude's hallucinations**
   - Model can misclassify sources if content is ambiguous
   - Mitigation: Always show original source link so user can verify manually

4. **Search query decomposition edge cases**
   - Very abstract claims (e.g., "meaning of life") → Claude may generate vague queries
   - Simple claims (e.g., "water boils at 100C") → works great
   - Mitigation: Prompt engineering; consider adding user-guided query refinement

5. **No persistent state**
   - Verdicts are not stored (no database)
   - No audit trail for hackathon judging
   - OK for demo, but consider adding SQLite for persistence

---

## 10. FINAL ASSESSMENT

### Readiness Level: **70% for Hackathon MVP**

**What's strong:**
- ✅ Core logic is solid (claim decomposition → search → classification → verdict)
- ✅ Clean, understandable code (good for judges to read)
- ✅ Firecrawl integration is working
- ✅ Modern frontend UX (dark mode, responsive, voice input)
- ✅ FastAPI backend is professional

**What's blocking 100%:**
- ❌ ElevenLabs integration (incomplete—API key defined but not used)
- ❌ Streaming results (all processing hidden behind spinner)
- ❌ Source credibility signals (all sources treated equally)

**Recommended scope for hackathon:**
1. **Must have** (within 4 hours): ElevenLabs voice output (verdict narration)
2. **Should have** (next 2-3 hours): Firecrawl source type tagging + credibility display
3. **Nice to have** (if time): Streaming results, retry logic
4. **Skip for now:** Persistent storage, multi-language, export, mobile app

**Why this matters for judges:**
- Hackathon is **ElevenLabs x Firecrawl**. Two integrations, one for each partner. Evidence Agent currently has Firecrawl working but ElevenLabs is a stub.
- Judges will expect voice output (TTS + audio player).
- Judges will expect intelligent filtering/credibility signals from Firecrawl's advanced scraping.
- Judges will like the "relational forensics" angle (why sources disagree, not just binary fact/fake).

---

## 11. FILES TO MODIFY FOR EACH PHASE

### Phase 1 (ElevenLabs)
- `backend/main.py` — add `/synthesize-voice` endpoint + add audio_url to /verify response
- `backend/requirements.txt` — no changes (httpx already present)
- `frontend/app.js` — add audio player render logic
- `frontend/index.html` — add `<audio>` element placeholder
- `.env.example` — add `ELEVENLABS_API_KEY` (already there, needs usage)

### Phase 2 (Firecrawl filtering)
- `backend/classifier.py` — add source type detection + credibility scoring
- `backend/firecrawl_client.py` — no changes (content already scraped)
- `frontend/app.js` — update source card render to include source type badge
- `frontend/index.html` — add optional filter toggle UI

### Phase 3 (Streaming)
- `backend/main.py` — add `/verify-stream` SSE endpoint
- `backend/agent.py` — refactor classify pipeline to yield results incrementally
- `frontend/app.js` — add EventSource listener + real-time card insertion

### Phase 4 (Error handling)
- `backend/agent.py` — add retry decorator + timeout wrappers
- `backend/main.py` — improved error responses
- `frontend/app.js` — better error message formatting
- `requirements.txt` — optional: add `tenacity` for retry logic

---

## CONCLUSION

Evidence Agent is **a well-structured, thoughtful foundation** for a claim verification system. The core logic works. The UX is clean and modern. But for a **hackathon submission**, it needs:

1. **Voice output (ElevenLabs)** — currently missing entirely, even though API key is referenced
2. **Source credibility signals (Firecrawl)** — leverage Firecrawl's scraping to show source type/reputation
3. **Real-time feedback (UX)** — streaming or at least clearer status updates

**Estimated effort to "hackathon-ready" (both ElevenLabs + Firecrawl):** 5-7 hours of focused development.

**Competitive edge:** The "why sources disagree" framing + voice narration is compelling. Most fact-checkers are text-only; Evidence Agent is multimodal (voice in + voice out) + relational (not binary yes/no).
