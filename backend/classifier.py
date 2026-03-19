"""Evidence classification using Claude."""

import os
import json
import anthropic


CLASSIFY_PROMPT = """You are an evidence classifier. Given a CLAIM and a SOURCE, determine:
1. stance: Does this source SUPPORT, CONTRADICT, or remain NEUTRAL toward the claim?
2. quote: Extract the single most relevant verbatim quote (max 2 sentences).
3. relevance: Rate 1-10 how relevant this source is to the claim.
4. credibility: Rate 1-10 how credible/trustworthy this source is, considering:
   - Domain authority (e.g., .gov, .edu, major news outlets = high; random blogs = low)
   - Whether the content cites data, studies, or named experts
   - Writing quality and journalistic standards
5. credibility_reason: One-sentence explanation of the credibility rating.

Respond with JSON only:
{{"stance": "FOR|AGAINST|NEUTRAL", "quote": "...", "relevance": 1-10, "credibility": 1-10, "credibility_reason": "..."}}

CLAIM: {claim}

SOURCE TITLE: {title}
SOURCE URL: {url}
SOURCE CONTENT (truncated):
{content}"""

VERDICT_PROMPT = """You are a research verdict synthesizer. Given a claim and classified evidence sources, produce a final verdict.

CLAIM: {claim}

EVIDENCE:
{evidence}

Respond with JSON only:
{{
  "verdict": "SUPPORTED|UNSUPPORTED|MURKY",
  "confidence": 1-10,
  "summary": "2-3 sentence synthesis of the evidence"
}}

Rules:
- SUPPORTED: clear majority of relevant sources support the claim
- UNSUPPORTED: clear majority contradict OR no credible support found
- MURKY: mixed evidence, insufficient data, or highly contested topic
- confidence reflects strength and consistency of evidence (10=ironclad, 1=guessing)"""


class EvidenceClassifier:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"

    def classify_source(self, claim: str, source: dict) -> dict:
        """Classify a single source's stance toward the claim."""
        content = (source.get("content") or "")[:4000]
        prompt = CLASSIFY_PROMPT.format(
            claim=claim,
            title=source.get("title", ""),
            url=source.get("url", ""),
            content=content,
        )

        resp = self.client.messages.create(
            model=self.model,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = {"stance": "NEUTRAL", "quote": "", "relevance": 1}

        return {
            "url": source.get("url", ""),
            "title": source.get("title", ""),
            "quote": parsed.get("quote", ""),
            "stance": parsed.get("stance", "NEUTRAL"),
            "relevance": parsed.get("relevance", 1),
            "credibility": parsed.get("credibility", 5),
            "credibility_reason": parsed.get("credibility_reason", ""),
        }

    def synthesize_verdict(self, claim: str, classified_sources: list[dict]) -> dict:
        """Synthesize a final verdict from classified sources."""
        evidence_text = "\n".join(
            f"- [{s['stance']}] {s['title']}: \"{s['quote']}\" (relevance: {s['relevance']}, credibility: {s.get('credibility', 5)})"
            for s in classified_sources
        )

        prompt = VERDICT_PROMPT.format(claim=claim, evidence=evidence_text)

        resp = self.client.messages.create(
            model=self.model,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = {"verdict": "MURKY", "confidence": 1, "summary": "Failed to synthesize verdict."}

        return parsed
