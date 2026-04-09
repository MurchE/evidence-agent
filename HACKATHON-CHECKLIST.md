# Evidence Agent — Hackathon Implementation Checklist

## Phase 1: ElevenLabs Voice Output (CRITICAL — 2-3 hours)

### Backend
- [ ] Create `backend/voice_synthesizer.py`
  - [ ] Import httpx, os
  - [ ] Class `VoiceSynthesizer` with `__init__` (set API key, voice ID)
  - [ ] Method `synthesize(text: str) -> str`
  - [ ] Call ElevenLabs `/text-to-speech/{voice_id}` endpoint
  - [ ] Return audio URL or base64 data

- [ ] Modify `backend/main.py`
  - [ ] Import VoiceSynthesizer
  - [ ] In `/verify` endpoint, after verdict is ready:
    - [ ] Call `voice_syn.synthesize(result["summary"])`
    - [ ] Add `audio_url` to response JSON
  - [ ] Handle ElevenLabs API errors gracefully

### Frontend
- [ ] Modify `frontend/index.html`
  - [ ] Add `<audio>` element placeholder below verdict card (hidden by default)

- [ ] Modify `frontend/app.js`
  - [ ] Update `renderVerdict(data)` function
  - [ ] Check if `data.audio_url` exists
  - [ ] If yes: render and insert `<audio controls>` with source
  - [ ] Optional: Auto-play audio on verdict ready
  - [ ] Optional: Add download button for audio

### Testing
- [ ] Test with sample claim (e.g., "Coffee reduces heart disease risk")
- [ ] Verify audio plays in browser
- [ ] Check timing (should be <10 sec for TTS generation)
- [ ] Test error case (invalid API key)

---

## Phase 2: Firecrawl Source Credibility (CRITICAL — 2-3 hours)

### Backend
- [ ] Create `backend/source_credibility.py`
  - [ ] Class `SourceCredibility` with domain pattern sets
  - [ ] ACADEMIC_DOMAINS: scholar.google.com, arxiv.org, .edu, nature.com, etc.
  - [ ] NEWS_DOMAINS: reuters.com, apnews.com, bbc.com, nyt.com, etc.
  - [ ] GOVERNMENT_DOMAINS: .gov, whitehouse.gov, congress.gov, etc.
  - [ ] CREDIBILITY_MAP: Academic→5, News→4, Gov→5, Blog→2, Unknown→1
  - [ ] Method `classify_source(url: str) -> dict` with source_type + credibility

- [ ] Modify `backend/classifier.py`
  - [ ] Import SourceCredibility
  - [ ] In `classify_source()`, call `SourceCredibility.classify_source(url)`
  - [ ] Add `source_type` and `credibility` to return dict

### Frontend
- [ ] Modify `frontend/app.js`
  - [ ] Update `renderSources(srcs)` function
  - [ ] For each source, extract `s.source_type` and `s.credibility`
  - [ ] Create star display: "★★★★★" (filled) + "☆☆" (empty)
  - [ ] Add source type badge (e.g., "Academic" in blue)
  - [ ] Insert into card HTML

- [ ] Optional: `frontend/index.html`
  - [ ] Add filter toggle "Show only trusted sources" (Academic + News + Gov)

### Testing
- [ ] Test with mixed sources (Wikipedia, academic paper, news site, blog)
- [ ] Verify stars/badges display correctly
- [ ] Check responsive layout on mobile
- [ ] Test filter toggle (if implemented)

---

## Phase 3: Streaming Results (ENHANCEMENT — 3-4 hours)

### Backend
- [ ] Modify `backend/main.py`
  - [ ] Add `from fastapi.responses import StreamingResponse`
  - [ ] Create new endpoint `@app.post("/verify-stream")`
  - [ ] Implement async generator `event_generator()`
  - [ ] Yield SSE events for: decompose, source_found, classified, verdict

- [ ] Modify `backend/agent.py`
  - [ ] Refactor `verify()` to yield intermediate results
  - [ ] Or: wrap verify() and yield at each stage

### Frontend
- [ ] Modify `frontend/app.js`
  - [ ] Create new function `verifyStream()` (alternative to `verify()`)
  - [ ] Use `new EventSource()` to connect to `/verify-stream`
  - [ ] Listen to event types: decompose, source_found, classified, verdict
  - [ ] Render source cards incrementally (add `addSourceCard()` helper)
  - [ ] Update existing cards as they're classified (add `updateSourceCard()` helper)
  - [ ] Close EventSource and show verdict on final event
  - [ ] Handle errors (eventSource.onerror)

- [ ] Optional: Add toggle in UI to use streaming vs batch mode

### Testing
- [ ] Test with slow Firecrawl (add delays to simulate)
- [ ] Verify cards appear in real-time
- [ ] Check verdict displays after all sources classified
- [ ] Test error handling (close stream early)

---

## Phase 4: Error Resilience (POLISH — 2-3 hours)

### Backend
- [ ] Modify `backend/requirements.txt`
  - [ ] Add `tenacity` for retry logic

- [ ] Modify `backend/agent.py`
  - [ ] Import tenacity: `@retry(stop=stop_after_attempt(3), wait=wait_exponential(...))`
  - [ ] Decorate `_search_all()` with retry decorator
  - [ ] Add timeout to asyncio.wait_for() calls
  - [ ] Add error logging with request IDs

- [ ] Modify `backend/main.py`
  - [ ] Add structured logging setup (logging.getLogger)
  - [ ] Improve error responses with specific messages
  - [ ] Handle different error types: TimeoutError, APIError, etc.

### Frontend
- [ ] Modify `frontend/app.js`
  - [ ] Improve error handling in catch block
  - [ ] Show user-friendly error messages (not generic "Error:")
  - [ ] Log errors to console for debugging
  - [ ] Add retry button on error state

### Testing
- [ ] Simulate Firecrawl timeout (curl with slow response)
- [ ] Test with missing API key (should show clear error)
- [ ] Verify retry logic works (check logs)
- [ ] Test partial failure (some search queries fail, others succeed)

---

## Final Integration Checklist

- [ ] Clone repo: `git clone git@github.com:MurchE/evidence-agent.git`
- [ ] Set up backend:
  - [ ] `cd backend && uv venv && uv sync`
  - [ ] `cp .env.example .env`
  - [ ] Fill in: ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, ELEVENLABS_API_KEY
- [ ] Set up frontend:
  - [ ] `cd ../frontend && python -m http.server 3000`
- [ ] Start backend:
  - [ ] `cd backend && uvicorn main:app --reload --port 8000`
- [ ] Open browser: http://localhost:3000
- [ ] Test with claims:
  - [ ] Speak a claim (voice input) → verify → hear verdict (voice output)
  - [ ] See source credibility stars + type badges
  - [ ] Optional: Watch streaming results in real-time

---

## Pre-Submission Checklist

### Code Quality
- [ ] No hardcoded API keys in code (all in .env)
- [ ] No console.log() clutter in production code
- [ ] Proper error handling (no unhandled exceptions)
- [ ] Code is readable and commented

### UX/UI
- [ ] Dark mode works well (test in light + dark theme)
- [ ] Responsive on mobile (test on phone)
- [ ] Accessibility: buttons have labels, keyboard navigation works
- [ ] Loading states are clear (spinner, status text, progress)
- [ ] Error messages are helpful

### Features
- [ ] Voice input works (tested in Chrome/Edge)
- [ ] Voice output plays (tested audio playback)
- [ ] Source credibility visible (stars + type)
- [ ] Verdict colors correct (green/red/amber)
- [ ] Links clickable and open in new tab

### Documentation
- [ ] README.md is up-to-date
- [ ] .env.example has all keys
- [ ] Installation steps are clear

### Performance
- [ ] /verify returns in <30 sec (most claims <15 sec)
- [ ] Audio generation <10 sec
- [ ] No memory leaks (test with 10+ verifications)
- [ ] Frontend is responsive (no lag on button clicks)

---

## Demo Script (for judges)

1. **Voice input demo:**
   - Click mic button
   - Say: "Does coffee reduce heart disease risk?"
   - Wait for results

2. **Voice output demo:**
   - After verdict appears, play audio
   - Point out the clear narration of the summary

3. **Credibility filtering demo:**
   - Show sources with different star ratings
   - Point out "Academic ★★★★★" vs "Blog ★★"
   - Explain how this helps users gauge reliability

4. **Verdict explanation:**
   - Show the verdict card (color, confidence bar, summary)
   - Point to sources that support vs contradict
   - Explain the "relational forensics" angle

5. **Try another claim** (pick a contentious one):
   - E.g., "Is climate change caused by humans?"
   - Show mixed sources (MURKY verdict)
   - Explain how this is more honest than binary yes/no

---

## Timeline Estimates

| Phase | Effort | Can Parallelize? |
|-------|--------|------------------|
| Phase 1 (ElevenLabs) | 2-3 hours | Backend + Frontend in parallel |
| Phase 2 (Credibility) | 2-3 hours | Backend + Frontend in parallel |
| Phase 3 (Streaming) | 3-4 hours | Sequential (depends on agent.py refactor) |
| Phase 4 (Polish) | 2-3 hours | Sequential |
| **Total (all phases)** | **9-13 hours** | |
| **Minimum (1+2)** | **4-6 hours** | ✅ Parallel |

**Recommendation:** Implement phases 1+2 in parallel (4-6 hours). This gives you complete ElevenLabs + Firecrawl integration, which is the hackathon requirement. Phase 3+4 are bonus if time allows.

