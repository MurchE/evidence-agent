# Evidence Agent F10 Fix Results

Branch: `codex/evidence-agent-f10-fixes`

## Per-Finding Results

### BLOCKER: CORS wildcard and unauthenticated paid endpoints

Fix: Added `backend/security.py` with CORS allowlist parsing and paid-route token auth. Replaced wildcard CORS in `backend/main.py` and `backend/podcatcher_api.py`. Paid endpoints now require `Authorization: Bearer $EVIDENCE_AGENT_API_TOKEN`, `X-API-Key`, or a stream query token. If the token is unset, paid endpoints fail closed with 401.

Test: `test_cors_rejects_unlisted_origin`, `test_paid_endpoint_requires_auth`.

Commit: `3d5dc89 Lock down paid API endpoints`

### BLOCKER: DOM XSS via `innerHTML`

Fix: Replaced source card, verdict citation, localStorage history, case-card, and follow-up answer rendering with DOM construction and `textContent`. Added `safeHttpUrl()` so only `http:` and `https:` source URLs become links, and external links now use `rel="noopener noreferrer"`.

Test: `test_frontend_source_xss_payload_is_not_rendered_with_inner_html`.

Commit: `819b774 Render evidence without HTML injection`

### MAJOR: Prompt injection from scraped web content

Fix: Hardened classifier and verdict prompts to treat source content as hostile data. Added enum/range validation, text clipping, JSON fence stripping, and quote-in-source verification before relevance sorting or verdict synthesis.

Test: Covered by Python syntax checks and existing mocked verification path; no live LLM calls were made.

Commit: `30f8db4 Constrain hostile source classification`

### MAJOR: Follow-up trusts client-supplied evidence

Fix: `/verify` and `/verify/stream` now store server-owned verification results and return a `result_id`. `/followup` accepts only `question` plus `result_id`, then loads claim, verdict, summary, and sources from the server-side store. The frontend no longer posts verdict, summary, or sources.

Test: `test_followup_requires_server_result_id`, `test_followup_empty_question`, and `test_verify_success` confirms a result ID is issued.

Commit: `532dab7 Use server-owned follow-up evidence`

### MAJOR: Unbounded request bodies

Fix: Added app-level `Content-Length` rejection with `MAX_REQUEST_BODY_BYTES` defaulting to 32768 bytes. Added Pydantic max lengths for claim, stream claim, TTS text, voice fields, follow-up question/result ID, podcatcher topic, and narration text.

Test: `test_oversized_body_rejected`.

Commit: `ce3de99 Bound inbound request sizes`

### MAJOR: Upstream failures hidden or uncaught

Fix: Added `UpstreamServiceError`. Search now distinguishes total provider failure from no results, classification skips partial failures but fails when all classifications fail, and synthesis failures raise explicit upstream errors. HTTP routes return 502 for upstream/provider failures. SSE verification emits `upstream_error`, and the frontend displays that error.

Test: Existing endpoint tests run with mocked providers; no external calls were made.

Commit: `2cacee8 Surface upstream provider failures`

### MAJOR: Backend tests hang

Fix: Replaced sync `TestClient` tests with `httpx.AsyncClient(transport=httpx.ASGITransport(app=app))` wrapped by `asyncio.run`. This avoids the hanging sync Starlette/httpx test portal path.

Test: Full backend suite completed under a hard timeout.

Commit: `38bb92e Use nonblocking ASGI tests`

### MINOR: Hardcoded developer paths

Fix: Parameterized demo helper paths. `generate_voiceover.py` and `capture_screenshots.py` derive paths from the script location and accept env overrides. `build_video.sh` derives `PROJECT_ROOT` and accepts `DEMO_FRAMES_DIR`, `DEMO_VIDEO_OUT`, and `VOICEOVER_OUT`. `VIDEO-TASK.md` now references repo-relative paths. A repo scan found no remaining `/Users/...` or `murchewings` paths outside untouched review files.

Test: `rg -n "murchewings|/Users/" -S . -g '!frontend/tailwind.js' -g '!REVIEW*.md'` returned no matches.

Commit: `bed7e2f Parameterize demo helper paths`

## Test Run Output

Requested command with hard timeout:

```text
$ cd backend && timeout 120s python -m pytest tests/ -q
timeout: failed to run command ‘python’: No such file or directory
```

Equivalent available interpreter:

```text
$ cd backend && timeout 120s python3 -m pytest tests/ -q
..............                                                           [100%]
14 passed in 0.48s
```

Additional checks:

```text
$ node --check frontend/app.js
# passed with no output

$ python3 -m py_compile backend/main.py backend/agent.py backend/classifier.py backend/security.py backend/podcatcher_api.py generate_voiceover.py capture_screenshots.py
# passed with no output
```

No tests used real network, LLM, Firecrawl, or ElevenLabs calls; provider paths are mocked in endpoint tests.
