# Evidence Agent — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-19
**Author:** Murch
**Status:** Draft

---

## 1. Problem

Misinformation spreads faster than corrections. The average person encounters dozens of dubious claims daily — on social media, in conversation, forwarded by family — and has no fast, frictionless way to check them. Existing fact-check sites (Snopes, PolitiFact) are slow editorial operations covering a narrow set of viral claims. Google searches require the user to evaluate sources themselves, which most people lack the time or media-literacy skills to do well.

**Core pain points:**
- **Speed:** Manual fact-checking takes 5–15 minutes of searching, reading, and cross-referencing. Most people won't bother.
- **Source evaluation:** Even when people search, they can't reliably distinguish a peer-reviewed study from a wellness blog. Credibility assessment is a learned skill.
- **Accessibility:** Text-heavy workflows exclude people who think and communicate verbally — podcasters, content creators, and the 30% of adults with low reading proficiency.
- **Transparency:** AI chatbots will answer "is X true?" but don't show their work. Users get a confident-sounding answer with no audit trail.

## 2. Solution

**Evidence Agent** is a voice-first, AI-powered claim verification engine. Speak or type any factual claim. Within seconds, Evidence Agent:

1. **Decomposes** the claim into 3 diverse search queries (for/against/neutral angles)
2. **Searches** the live web via Firecrawl (not a stale training set)
3. **Classifies** each source — stance (FOR / AGAINST / NEUTRAL), credibility (1–10 with reasoning), and extracts the key quote
4. **Synthesizes** a verdict: **SUPPORTED**, **UNSUPPORTED**, or **MURKY** with a 1–10 confidence score and plain-English summary
5. **Narrates** the verdict aloud via ElevenLabs TTS
6. Supports **follow-up questions** grounded in the evidence already gathered

The key differentiator is **transparent, source-cited, real-time verification with voice I/O** — not a black-box answer, but an auditable evidence dossier delivered in seconds.

## 3. Ideal Customer Profile (ICP)

### Primary: Content Creators & Podcasters
- Need to fact-check claims on-the-fly during recording or prep
- Voice-first workflow matches their medium
- Would embed "Evidence Agent says..." segments as a trust signal
- **Willingness to pay:** High ($20–50/mo as a professional tool)

### Secondary: Newsrooms & Journalists
- Need rapid source evaluation during breaking stories
- Credibility scoring and source audit trail is directly useful
- API integration into editorial workflows
- **Willingness to pay:** High ($50–200/mo per seat)

### Tertiary: Educators & Students
- Teaching critical thinking and media literacy
- Interactive tool for classroom demonstrations
- **Willingness to pay:** Low–Medium (freemium / edu pricing)

### Long-tail: General Consumers
- "Is this true?" moments — dinner table debates, forwarded articles, social media claims
- Voice input lowers friction to near zero
- **Willingness to pay:** Low (ad-supported or freemium)

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Vanilla JS + Tailwind  •  Web Speech API (STT)             │
│  SSE streaming  •  localStorage history                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────────┐
│                    BACKEND (FastAPI)                          │
│                                                              │
│  POST /verify          — full pipeline, JSON response        │
│  GET  /verify/stream   — SSE streaming pipeline              │
│  POST /tts             — ElevenLabs TTS proxy                │
│  POST /followup        — contextual follow-up Q&A            │
│  GET  /health          — liveness check                      │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ EvidenceAgent│  │EvidenceClassif.│  │ VoiceSynthesizer │ │
│  │              │  │                │  │                  │ │
│  │ decompose()  │  │ classify()     │  │ synthesize()     │ │
│  │ search_all() │  │ verdict()      │  │ (ElevenLabs TTS) │ │
│  └──────┬───────┘  └───────┬────────┘  └──────────────────┘ │
│         │                  │                                 │
└─────────┼──────────────────┼─────────────────────────────────┘
          │                  │
    ┌─────▼─────┐     ┌─────▼──────┐
    │ Firecrawl │     │  Claude    │
    │  Search   │     │  Sonnet    │
    │  API      │     │  (3 calls) │
    └───────────┘     └────────────┘
```

### 4.2 Pipeline Detail

| Stage | Input | Output | Provider | Latency |
|-------|-------|--------|----------|---------|
| **Decompose** | Raw claim string | 3 search queries | Claude Sonnet | ~1s |
| **Search** | 3 queries (parallel) | Up to 9 results (deduped to 8) | Firecrawl API | ~3s |
| **Classify** | Claim + each source | Stance, quote, relevance, credibility | Claude Sonnet (parallel) | ~2s |
| **Verdict** | Claim + top 5 classified sources | SUPPORTED/UNSUPPORTED/MURKY + confidence + summary | Claude Sonnet | ~1s |
| **Narrate** | Verdict text | MP3 audio stream | ElevenLabs TTS | ~1s |
| **Total** | | | | **~8s end-to-end** |

### 4.3 Voice Module (Optional)

A standalone local voice loop using **ElevenLabs Conversational AI Agents**:
- Mic input → ElevenLabs Agent (cloud STT) → `verify_claim` tool call → backend `/verify` → Agent speaks verdict (cloud TTS)
- Uses `DefaultAudioInterface` (PyAudio) for local mic/speaker
- Fully hands-free operation

### 4.4 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, Tailwind CSS, Web Speech API |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| LLM | Anthropic Claude Sonnet 4 |
| Web Search | Firecrawl API (search + scrape) |
| TTS | ElevenLabs (Multilingual v2) |
| Voice Agent | ElevenLabs Conversational AI SDK |
| HTTP Client | httpx (async) |

### 4.5 Key Design Decisions

- **Real-time web search over RAG:** Claims are time-sensitive. A static knowledge base goes stale. Firecrawl gives live results with full page content.
- **Multi-query decomposition:** A single search query biases toward one framing. Three diverse queries surface both supporting and contradicting evidence.
- **Credibility scoring:** Not all sources are equal. Domain authority, citation of data, and journalistic standards are scored per-source with reasoning exposed to the user.
- **SSE streaming:** Users see each pipeline step in real-time rather than waiting 8s for a black-box response. Builds trust and reduces perceived latency.
- **Voice-first, not voice-only:** Text input works. Voice is the differentiator but not a gate.

## 5. Build Roadmap

### Phase 1: MVP (Current State) ✅
- [x] Claim decomposition into 3 search queries
- [x] Firecrawl web search with parallel execution
- [x] Claude-powered source classification (stance, credibility, quotes)
- [x] Verdict synthesis (SUPPORTED / UNSUPPORTED / MURKY)
- [x] SSE streaming with step-by-step UI updates
- [x] ElevenLabs TTS verdict narration
- [x] Web Speech API voice input
- [x] Follow-up Q&A grounded in evidence
- [x] Claim history (localStorage)
- [x] Copy/share verdict
- [x] ElevenLabs Conversational AI voice module
- [x] 9 unit tests for API endpoints

### Phase 2: Production Hardening (Next)
- [ ] Auth & rate limiting (API keys or OAuth)
- [ ] Persistent storage (PostgreSQL / SQLite for claim history, user accounts)
- [ ] Caching layer — identical claims within TTL return cached verdicts
- [ ] Error handling & retry logic for external APIs
- [ ] Deployment (Docker, cloud hosting, HTTPS)
- [ ] Mobile-responsive polish
- [ ] CI/CD pipeline with test automation

### Phase 3: Growth Features
- [ ] Browser extension — highlight text, right-click → "Verify with Evidence Agent"
- [ ] API for third-party integrations (Slack bot, Discord bot, CMS plugins)
- [ ] Batch verification — paste an article, extract and verify all claims
- [ ] Source memory — build a credibility graph of domains over time
- [ ] Multi-language support (leveraging ElevenLabs Multilingual v2)
- [ ] Claim tracking — subscribe to a claim, get notified when new evidence emerges

### Phase 4: Platform
- [ ] Public claim database — searchable archive of verified claims
- [ ] Community corrections — users can flag incorrect verdicts with counter-evidence
- [ ] Publisher integration — embed verification badges on articles
- [ ] Real-time monitoring — track trending claims across social platforms
- [ ] Custom LLM fine-tuning on fact-check corpora for improved accuracy

## 6. Monetization

### Model: Tiered SaaS + API

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 10 verifications/month, text only, no TTS |
| **Pro** | $19/mo | 200 verifications/month, voice I/O, follow-ups, history sync |
| **Team** | $49/seat/mo | Unlimited verifications, API access, shared workspace, priority |
| **Enterprise** | Custom | Dedicated instance, SLA, SSO, custom integrations, bulk API |

### Unit Economics (Estimated per verification)
| Cost Component | Estimate |
|----------------|----------|
| Claude Sonnet (decompose + classify 8 + verdict ≈ 10 calls) | ~$0.03 |
| Firecrawl (3 searches) | ~$0.01 |
| ElevenLabs TTS (verdict narration) | ~$0.005 |
| **Total COGS per verification** | **~$0.045** |

At $19/mo for 200 verifications, COGS is ~$9/user/month → **~53% gross margin**, improving with caching.

### Additional Revenue Streams
- **API metered pricing** for integrators ($0.10–0.25 per verification)
- **White-label licensing** for newsrooms and platforms
- **Publisher verification badges** (annual subscription)

## 7. Competitive Landscape

| Competitor | Approach | Strengths | Weaknesses |
|-----------|----------|-----------|------------|
| **Snopes / PolitiFact** | Human editorial fact-checking | Deep analysis, trusted brand | Slow (days), narrow coverage, no API |
| **Google Fact Check Tools** | Aggregates existing fact-checks | Free, broad | Only surfaces *existing* checks, no original analysis |
| **ChatGPT / Claude / Perplexity** | General-purpose AI chat | Fast, conversational | No structured evidence framework, no credibility scoring, no audit trail, training data cutoff |
| **Factiverse** | AI fact-checking API | B2B focus, multi-source | No voice, no consumer product, enterprise-only |
| **ClaimBuster** | Academic claim detection | Good at *identifying* claims | Doesn't verify them, research project not product |
| **Ground News** | Media bias comparison | Excellent bias visualization | News-only, no arbitrary claim verification |

### Evidence Agent's Moat
1. **Voice-first UX** — no competitor offers speak-to-verify
2. **Transparent evidence trail** — sources, stances, credibility scores, and quotes are shown, not hidden
3. **Real-time web search** — not limited to pre-checked claims or stale training data
4. **Structured output** — machine-readable verdicts enable integrations (browser extensions, bots, CMS plugins)
5. **Speed** — ~8 seconds from claim to cited verdict, vs. days for editorial fact-checkers

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **LLM hallucination in classification** | Incorrect stance/credibility assessment | Ground all judgments in source text; expose quotes for user verification; add human feedback loop |
| **Firecrawl rate limits / downtime** | Pipeline breaks | Add fallback search providers (SerpAPI, Brave Search); implement caching |
| **Adversarial claims** | Users try to get the system to validate harmful misinformation | Disclaimer that verdicts are AI-assisted, not authoritative; flag low-confidence results prominently |
| **API cost scaling** | COGS grows linearly with usage | Aggressive caching for repeated claims; batch classification calls; negotiate volume pricing |
| **Legal liability** | Users rely on verdicts for consequential decisions | Clear ToS disclaimers; position as "research assistant" not "authority"; expose all sources |
| **ElevenLabs dependency** | Single vendor for TTS | Abstract voice synthesis interface; evaluate alternatives (OpenAI TTS, Google Cloud TTS) |

## 9. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Monthly Active Users | 5,000 |
| Verifications per day | 1,000 |
| Median verification latency | < 10s |
| Verdict accuracy (manual audit) | > 85% |
| Pro conversion rate | 5% of free users |
| API integration partners | 3+ |
| NPS | > 50 |

## 10. Open Questions

1. **Should verdicts be cacheable?** Same claim verified twice should probably return cached results within a TTL (24h?), but news-sensitive claims may need fresh results.
2. **How to handle opinion vs. fact?** "Pineapple belongs on pizza" isn't verifiable. Need a pre-filter to classify claim type and refuse non-factual claims gracefully.
3. **Multi-source search strategy:** Is Firecrawl sufficient as the sole search provider, or should we hedge with multiple search APIs?
4. **Verdict calibration:** How do we validate that confidence scores are well-calibrated? Need a benchmark dataset of claims with known truth values.
5. **Voice agent distribution:** Should the ElevenLabs Conversational AI agent be the primary UX (phone-call style), or remain a power-user addon alongside the web UI?
