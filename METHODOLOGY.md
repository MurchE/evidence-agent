# JudiciAI — Evidence Evaluation Methodology

## How It Works (Honest Answer)

**Short version:** It's Claude + structured prompting, not PageRank. The intelligence is in the pipeline design, not a scoring algorithm.

## The Pipeline

```
Claim → Decompose → Search → Classify → Synthesize → Verdict
```

### Step 1: Query Decomposition (Claude)
A single claim is broken into **3 diverse search queries** designed to find evidence from multiple angles. This prevents confirmation bias — we don't just search for "claim is true."

Example: "Coffee prevents heart disease" →
1. "coffee cardiovascular health meta-analysis"
2. "coffee heart disease risk studies"
3. "coffee consumption mortality research"

### Step 2: Web Search (Firecrawl)
Each query goes to Firecrawl's search API, which returns **3-8 sources** as markdown-scraped web content. We get ~5-15 unique sources per claim.

### Step 3: Source Classification (Claude)
Each source is independently classified by Claude with a structured prompt:

```json
{
  "stance": "FOR | AGAINST | NEUTRAL",
  "credibility": 1-10,
  "quote": "most relevant direct quote",
  "relevance": 1-10,
  "credibility_reason": "why this score"
}
```

**Credibility scoring is LLM-based, not algorithmic.** Claude assesses:
- Is this a peer-reviewed study, a news article, or a blog post?
- Does it cite primary sources?
- Is the publisher reputable?
- Does the methodology seem sound?

This is NOT PageRank or link analysis. It's Claude's trained understanding of source quality — which is actually quite good for mainstream scientific topics.

### Step 4: Verdict Synthesis (Claude)
All classified sources feed into a final prompt that produces:

```json
{
  "verdict": "SUPPORTED | UNSUPPORTED | MURKY",
  "confidence": 1-10,
  "summary": "The evidence supports/does not support/is inconclusive..."
}
```

**Verdict rules:**
- **SUPPORTED:** Clear majority of credible sources support the claim
- **UNSUPPORTED:** Clear majority contradict OR no credible support found
- **MURKY:** Mixed evidence, insufficient data, or genuinely contested topic

## What Makes This Different From "Just Asking ChatGPT"

1. **It shows its work.** Every source is cited with URL, stance, credibility score, and a direct quote. You can click through and verify.

2. **It says "I don't know."** The MURKY verdict is the key differentiator. Most AI tools give you a confident answer either way. JudiciAI surfaces genuine scientific uncertainty where it exists.

3. **It separates evidence from opinion.** The pipeline classifies sources by stance and credibility independently, then synthesizes. It doesn't just pattern-match to the most common answer.

4. **It's auditable.** You can see exactly which sources drove the verdict, how they were classified, and why.

## Limitations (Be Honest About These)

- **No actual statistical analysis.** Credibility scores are LLM-assessed, not computed from citation counts, impact factors, or link graphs.
- **Search quality depends on Firecrawl.** If the web sources are poor, the verdict is poor.
- **Recency bias.** Web search favors recent content. Historical consensus may be underweighted.
- **English-centric.** Non-English sources are underrepresented.
- **Not peer-reviewed.** This is a tool for initial assessment, not a replacement for systematic review.

## Future: Where Real Algorithms Could Help

- **Citation network analysis** — like PageRank but for academic papers
- **Impact factor weighting** — weight sources by journal prestige
- **Consensus detection** — identify when >90% of sources agree
- **Temporal analysis** — detect if evidence is shifting over time
- **Cross-source corroboration** — boost credibility when multiple independent sources agree
