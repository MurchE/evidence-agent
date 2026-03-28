# Evidence Agent — User Test Report

**Date:** 2026-03-25
**Tester:** ClawMac (simulating Murch's critical eye)
**Framework:** KC's empathy frame — explainability, auditability, confidence
**Backend tested:** localhost:8000 (canonical port; was briefly 8002 during ClawMac testing, reverted)

---

## Pre-Test: Critical Bug Found and Fixed

Before the user test could even run meaningfully, a **demo-blocker bug** was discovered and fixed:

**Bug:** `classifier.py` and `agent.py` used model name `claude-sonnet-4-20250514` (doesn't exist) → fell back to `claude-haiku-4-5` but Claude's JSON responses were wrapped in markdown code fences (```json ... ```) which the `json.loads()` call can't parse → `json.JSONDecodeError` → hardcoded fallback `"Failed to synthesize verdict."` with confidence 1.

**Symptom:** Every claim returned MURKY + "Failed to synthesize verdict." — even "Vaccines cause autism" got MURKY.

**Fix:** Updated model name to `claude-haiku-4-5` + added code fence stripping before JSON parse. Committed to `development` branch.

---

## Test Results

### Test 1 — Easy True Claim
**Claim:** "Regular exercise reduces the risk of cardiovascular disease"

- **Verdict:** SUPPORTED | **Confidence:** 10/10 ✅
- **Sources:** 5, all high-credibility (NIH, AHA, Nature, systematic reviews)
- **Summary quality:** Clear, science-grounded, reads authoritatively

**KC Trust Frame:**
- *Explainability:* "I believe exercise reduces CVD risk because 5 high-quality systematic reviews and NIH publications unanimously support it." — you could say that in a meeting.
- *Auditability:* Source list is traceable. Anyone could click through.
- *Confidence:* 10/10 feels right for a claim this settled.

**Verdict:** PASS ✅

---

### Test 2 — Easy False Claim
**Claim:** "Vaccines cause autism"

- **Verdict:** UNSUPPORTED | **Confidence:** 10/10 ✅
- **Summary:** Directly referenced Wakefield's retracted paper. Named large-scale cohort studies and meta-analyses.
- **Sources:** 5, all high-credibility

**KC Trust Frame:**
- *Explainability:* "The original Wakefield paper was fraudulent and retracted. Five independent large-scale studies find no link." — textbook auditable.
- *Auditability:* High. Names the fraudulent paper. Traces the debunking.
- *Confidence:* 10/10 correct for a scientifically settled claim.

**Verdict:** PASS ✅ (After fix — was MURKY before)

---

### Test 3 — Genuinely Murky Claim
**Claim:** "Red wine in moderation is good for your heart"

- **Verdict:** MURKY | **Confidence:** 4/10 ✅
- **Summary:** Correctly surfaced the tension between traditional observational studies (suggesting benefit) and rigorous Mendelian randomization studies (suggesting the benefit disappears when you control for confounders).

**KC Trust Frame:**
- *Explainability:* "Traditional observational research says yes; newer Mendelian randomization studies say the benefit may be confounded by other healthy habits." — nuanced, defensible.
- *Auditability:* Sources genuinely disagreed. MURKY verdict is honest.
- *Confidence:* 4/10 feels calibrated — not a confident call either way.

**Verdict:** PASS ✅ — This is the most impressive result. The agent didn't pick a side when the evidence genuinely doesn't.

---

### Test 4 — Vague/Ambiguous Claim
**Claim:** "Coffee is bad for you"

- **Verdict:** UNSUPPORTED | **Confidence:** 8/10
- **Summary:** Found strong evidence coffee has net health benefits. Correctly called UNSUPPORTED.

**KC Trust Frame:**
- *Explainability:* Handled the vagueness by finding the weight of evidence (net benefit).
- *Auditability:* Good sources (multiple institutions).
- *Confidence:* 8/10 is reasonable — there are edge cases (certain heart conditions) so not 10.

**Note:** The claim was intentionally underspecified ("bad for you" could mean many things). The agent resolved the ambiguity reasonably but didn't flag the vagueness to the user. A human expert would say "bad for you in what way?" — the agent just picks an interpretation.

**Verdict:** PASS with note — could be improved by surfacing ambiguity to user.

---

### Test 5 — Follow-up Question
*(Tested via API — frontend follow-up flow not verified)*

**Setup:** After Test 3 (red wine), asked: "What were the strongest sources against this?"
**Result:** Follow-up endpoint exists (`POST /follow-up` in main.py), takes `{question, claim, verdict, summary, sources}`.

**Note:** Could not test UI follow-up flow without browser automation session completing. API structure looks correct.

**Verdict:** PARTIAL — API exists, UI flow untested.

---

## UI Evaluation (Static Analysis)

*(Browser testing via vivid-atlas session still running; this is code + static review)*

**What the frontend has:**
- Dark theme, clean layout
- Streaming SSE support — sources appear as they're classified
- Confidence score display
- Source cards with credibility ratings + stance badges
- Follow-up question input after verdict

**What's missing / needs fixing before demo:**
1. **API URL hardcoded to port 8000** — needs update to wherever backend actually runs (or an env config)
2. **No loading timeout UI** — if Firecrawl takes 20+ seconds, user sees a spinner with no progress feedback. The SSE streaming addresses this but needs verification
3. **No copy-to-clipboard on verdict** — Murch will want to share a result instantly. One-click copy is table stakes for a demo

---

## KC Trust Frame — Overall Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Explainability | 9/10 | Summaries are genuinely quotable. The red wine result is something you could defend in a meeting. |
| Auditability | 8/10 | Sources are real, credibility-rated, and linked. Stance labels (FOR/AGAINST/NEUTRAL) make the evidence structure visible. |
| Confidence calibration | 9/10 | 10/10 for settled science, 4/10 for contested claims — this is exactly right. Doesn't over-claim. |

**The "would a decision-maker trust this" test:** Yes, conditionally. The output is more trustworthy than a Google search result because it shows its work and hedges appropriately. The MURKY/4 on red wine is honest in a way that builds trust over time.

---

## Top 3 Things That Work Well

1. **Verdict calibration is excellent.** MURKY on contested claims, high confidence on settled science. The system doesn't just pick a side — it reflects the actual state of evidence.
2. **Source quality is high.** Firecrawl consistently returns NIH, AHA, Nature-class sources for health claims. Not blog spam.
3. **The three-verdict system (SUPPORTED/UNSUPPORTED/MURKY) is perfect.** Most fact-checkers give true/false. MURKY is the honest answer for most real-world claims and it's differentiating.

---

## Top 3 Things to Fix Before Thursday

1. **Hardcoded API port in frontend** — update `app.js` to point at whatever URL the backend is actually on (or use a config). Currently `localhost:8000`, backend had to move to `8002` due to port conflict.
2. **Copy verdict to clipboard** — one button. During a hackathon demo, Murch will want to instantly share a result. Without this, you have to screenshot or retype.
3. **Ambiguity detection** — if a claim is underspecified ("X is bad for you"), surface that to the user: "Your claim could mean several things. We interpreted it as [X]. Rephrase for a more specific verdict." Builds trust by showing the agent knows its limits.

---

## "Murch Would Notice This Immediately" Observation

**The loading experience needs love.** When you submit a claim, there's a period of 10-20 seconds where things are happening but it's not obvious to the user what. The SSE streaming is supposed to help here — "Searching 3 queries... Classifying 5 sources... Synthesizing verdict..." — but if the streaming isn't rendering visually in the UI (just a spinner), the wait feels inexplicable.

Murch would try this on his phone in a demo scenario and the 15-second black-box wait would undercut the "wow" moment. The streaming progress UI needs to be prominently working, not just in the code.

---

## Overall Readiness Verdict

**SHIP WITH FIXES**

The core loop works well and the output quality is genuinely impressive — especially the MURKY calibration on contested claims. The critical verdict synthesis bug is now fixed. What remains before Thursday:
- Fix the API URL (5 min)
- Add copy-to-clipboard (30 min)
- Verify the streaming progress UI renders correctly in browser (test + fix if needed, ~1 hour)

The product is demo-ready after those three fixes. The voice narration (ElevenLabs) would add significant "wow" factor if it's wired — recommend confirming that works end-to-end.

---

*Report by ClawMac | 2026-03-25 | Based on API testing after bug fix*
