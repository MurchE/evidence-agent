# Evidence Agent — Hackathon Review Summary

**Date:** 2026-03-19  
**Reviewed by:** Claude Code  
**Repo:** https://github.com/MurchE/evidence-agent  
**Branch:** development (1 initial commit)

---

## TLDR: Readiness Assessment

**Overall:** 70% hackathon-ready. Core logic is solid. Missing critical ElevenLabs integration + Firecrawl credibility signals.

**Status:** ✅ Functional MVP | ⚠️ Missing integration features | ❌ Not production-ready

---

## What You've Built (Well)

| Component | Status | Notes |
|-----------|--------|-------|
| **Claim decomposition** | ✅ Working | Claude breaks claim into 3 search queries |
| **Web search** | ✅ Working | Firecrawl searches, dedupes, caps at 8 sources |
| **Source classification** | ✅ Working | Stance detection (FOR/AGAINST/NEUTRAL) + quote extraction |
| **Verdict synthesis** | ✅ Working | Aggregate evidence → SUPPORTED/UNSUPPORTED/MURKY + confidence |
| **FastAPI backend** | ✅ Working | Clean, async, proper error handling (mostly) |
| **Frontend UX** | ✅ Working | Dark mode, responsive, voice input (Web Speech API) |
| **Voice input** | ✅ Working | Push-to-talk microphone button |

**Code quality:** Clean, readable, well-structured. Judges will appreciate the architecture.

---

## What's Missing (Critical for Hackathon)

### 1. **ElevenLabs Voice Output** ⚠️ CRITICAL

**Problem:** ElevenLabs API key is defined in `.env.example` but **never used**. No voice output = incomplete integration.

**Impact:** 
- Hackathon is "ElevenLabs x Firecrawl" — judges expect both integrations
- Voice I/O (input + output) is core to "voice-first" positioning
- Without TTS, system is text-first (defeats unique angle)

**Effort to fix:** 2-3 hours
- Add `voice_synthesizer.py` (80 lines) to call ElevenLabs API
- Modify `/verify` endpoint to include `audio_url` in response
- Update frontend to render `<audio>` player below verdict card

**Files to touch:** `main.py`, `app.js`, `index.html` + new file `voice_synthesizer.py`

---

### 2. **Firecrawl Source Credibility Filtering** ⚠️ CRITICAL

**Problem:** All sources treated equally. No credibility signals, no source type tagging.

**Current:** Return {url, title, stance, quote, relevance}  
**Needed:** Add {source_type, credibility_stars}

**Impact:**
- Misses opportunity to showcase Firecrawl's intelligence
- Users can't distinguish academic paper from blog post
- "Just raw search results" vs "smart filtering"

**Effort to fix:** 2-3 hours
- Add `source_credibility.py` (60 lines) with domain pattern matching
- Classify: Academic (5★), News (4★), Government (5★), Blog (2★)
- Update frontend to show stars + type badge

**Files to touch:** `classifier.py`, `app.js` + new file `source_credibility.py`

---

### 3. **Streaming Results UI** ⚠️ ENHANCEMENT

**Problem:** All processing hidden behind generic spinner (15-30 sec wait feels frozen).

**Needed:** Real-time progress (sources accumulating, being analyzed).

**Effort:** 3-4 hours (nice-to-have, not critical)

**Files:** `main.py` (SSE endpoint), `agent.py` (refactor to yield), `app.js` (EventSource listener)

---

## Specific Recommendations

### For Judges

1. **Demonstrate voice I/O together:** Speak a claim → see result → hear verdict read aloud
   - This is your competitive edge over text-only fact-checkers
   
2. **Show credibility filtering:** Point out the 5-star system + source type badges
   - Demonstrates Firecrawl's scraping + intelligence layering

3. **Explain the "relational forensics" angle:** 
   - Most fact-checkers: "Is this true? YES/NO"
   - Evidence Agent: "Here's why sources disagree" (more nuanced, honest)

### Priority Implementation Order

**Phase 1 (MUST) — ElevenLabs Integration**
- Backend: Add `voice_synthesizer.py` + modify `/verify`
- Frontend: Add audio player
- Estimated: 2-3 hours
- Success: User hears verdict after clicking "Verify"

**Phase 2 (MUST) — Firecrawl Credibility**
- Backend: Add `source_credibility.py` + modify `classifier.py`
- Frontend: Show stars + source type badges
- Estimated: 2-3 hours
- Success: Source cards display "Academic ★★★★★" or "Blog ★★"

**Phase 3 (NICE) — Streaming Results**
- Backend: Add SSE endpoint
- Frontend: Real-time card insertion
- Estimated: 3-4 hours
- Success: User sees "Source 1/8... Analyzing..." during processing

**Phase 4 (POLISH) — Error Resilience**
- Add retry logic, timeouts, better error messages
- Estimated: 2-3 hours
- Skip if time is tight

---

## Tech Stack Assessment

| Layer | Tech | Status |
|-------|------|--------|
| **Backend** | FastAPI + uvicorn | ✅ Solid |
| **LLM** | Claude Sonnet 4 | ✅ Excellent choice |
| **Web search** | Firecrawl API | ✅ Working, can enhance |
| **Voice input** | Web Speech API | ✅ Working |
| **Voice output** | ElevenLabs | ⚠️ Not integrated |
| **Async** | asyncio | ✅ Good |
| **Frontend** | Vanilla HTML/JS | ✅ No build step (clean) |
| **Styling** | Tailwind CDN | ✅ Modern, responsive |

---

## Code Quality Snapshot

**Strengths:**
- Clean separation of concerns (agent.py, classifier.py, firecrawl_client.py)
- Async/concurrent where it matters (Firecrawl searches, classification)
- Good error handling (mostly)
- Well-commented prompts
- Modern API design

**Gaps:**
- No structured logging
- No retry logic
- No timeout guards on long operations
- CORS open to "*" (ok for demo, not production)
- No persistence (no database)

---

## Final Verdict

**What you have:** A thoughtful, well-built claim verification system with an interesting "relational forensics" angle. Clean code, modern UX, solid core logic.

**What you're missing:** The ElevenLabs integration that makes this a true **voice-first** system, and the Firecrawl credibility filtering that shows you're leveraging advanced scraping.

**Estimated effort to "hackathon gold":** 4-6 hours (phases 1+2)

**Competitive advantage:** Multimodal (voice in/out) + relational (why sources disagree) + accessible. Most fact-checkers are text-only, binary (true/false). This is more nuanced.

---

## Supporting Documents

See `/Projects/` for detailed analysis:

1. **`evidence-agent-assessment.md`** — Full 11-section review (concept, tech stack, what's built, gaps, roadmap, recommendations, code-level details)
2. **`implementation-gaps.md`** — Code snippets for all 4 phases with before/after examples
3. **`codebase-summary.txt`** — Architecture diagram, file tree, data flow, dependencies

---

## Next Steps (If Implementing)

1. **Git clone locally:** `git clone git@github.com:MurchE/evidence-agent.git`
2. **Backend setup:** `cd backend && uv venv && uv sync && cp .env.example .env`
   - Fill in: `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `ELEVENLABS_API_KEY`
3. **Frontend:** `cd ../frontend && python -m http.server 3000`
4. **Test:** http://localhost:3000 (backend on 8000)
5. **Implement phases 1+2** using code examples from `implementation-gaps.md`
6. **Test with sample claims** (coffee + heart disease, vaccines, climate claims, etc.)

---

## Questions for Murch

- **Timeline:** When is hackathon deadline?
- **Scope:** Push for full implementation (phases 1-4) or focus on 1+2 (voice + credibility)?
- **Voice:** Any preference on ElevenLabs voice? (Grace, Rachel, Matilda, custom clone?)
- **Deploy:** Will you submit as repo link or deployed demo?
- **Focus areas:** Any specific types of claims to showcase? (Health, politics, science?)

