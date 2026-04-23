# JudiciAI — V4 Narrator Script
## Two-voice approach: Original app audio stays, narrator layer added over it

**Voice:** Charlie (Aussie) or Adam (deep, authoritative) — NOT George, who's the app voice
**Tone:** Documentary narrator, slightly wry. Not hype. Observational.
**Style:** Gaps between narrator lines let George and the app audio breathe through.
**Target duration:** 75-85 seconds total

---

## Script

*(0-3s — app loading, app UI visible)*
**NARRATOR:** "Most AIs are confident. Relentlessly confident. Even when they shouldn't be."

*(pause — app shown, let George's intro VO play through if present)*

*(~8-12s — claim being typed or submitted)*
**NARRATOR:** "JudiciAI does something different. It weighs the evidence — and tells you when the case isn't closed."

*(pause — let the pipeline run, Firecrawl search animation visible)*

*(~18-22s — sources loading)*
**NARRATOR:** "Firecrawl pulls the actual articles. Not summaries. Not snippets. The full text."

*(pause)*

*(~28-32s — verdict appears on screen, George reading it)*
**NARRATOR:** "Verdict: delivered in George's voice — and then shown on screen with every source that got it there."

*(pause — let the verdict breathe)*

*(~38-42s — sources section, credibility scores visible)*
**NARRATOR:** "Every source scored. Every claim traced. Click through and verify it yourself."

*(pause)*

*(~47-50s — bull/bear or share buttons)*
**NARRATOR:** "Want both sides? JudiciAI steel-mans the argument for you — and against you."

*(pause — let George's bull case play if audible)*

*(~55-60s — outro, app still on screen)*
**NARRATOR:** "Built with ElevenLabs voice and Firecrawl search."

*(final beat)*
**NARRATOR:** "Because the world doesn't need another AI that's always confident. It needs one that's always honest."

---

## Production Notes

- Narrator lines should have ~0.5s silence before and after each line
- Total narrator spoken time: ~45 seconds
- Gaps allow the original George/app audio to play through
- The two voices create a "documentary + product demo" hybrid feel
- Narrator should sound curious, not salesy

## ElevenLabs Voice Options for Narrator
- **Charlie** (voice ID: IKne3meq5aSn9XLyUdCD) — Aussie, casual authority
- **Adam** (voice ID: pNInz6obpgDQGcFmaJgB) — deep, deliberate
- **Daniel** (voice ID: onwK4e9ZLuTAKqWW03F9) — British, documentary feel ← recommended

**Settings for narrator:**
- stability: 0.6 (more controlled than app voice)
- similarity_boost: 0.75
- style: 0.2 (understated, not performative)
- Speed: 0.95x (slightly deliberate)
