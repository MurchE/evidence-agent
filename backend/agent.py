"""Core evidence agent — orchestrates search, classification, and verdict."""

import os
import json
import asyncio
from typing import AsyncGenerator
import anthropic

from firecrawl_client import FirecrawlClient
from classifier import EvidenceClassifier


DECOMPOSE_PROMPT = """You are a research query strategist. Given a claim to verify, generate exactly 3 diverse search queries that would help find evidence FOR and AGAINST the claim. Make queries specific and varied in angle.

CLAIM: {claim}

Respond with JSON only:
{{"queries": ["query1", "query2", "query3"]}}"""


class EvidenceAgent:
    def __init__(self):
        self.firecrawl = FirecrawlClient()
        self.classifier = EvidenceClassifier()
        self.llm = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    def _decompose_claim(self, claim: str) -> list[str]:
        """Break a claim into 3 search queries."""
        resp = self.llm.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": DECOMPOSE_PROMPT.format(claim=claim)}],
        )
        text = resp.content[0].text.strip()

        try:
            parsed = json.loads(text)
            return parsed.get("queries", [claim])[:3]
        except json.JSONDecodeError:
            return [claim]

    async def _search_all(self, queries: list[str]) -> list[dict]:
        """Run all search queries concurrently, deduplicate by URL."""
        tasks = [self.firecrawl.search(q, limit=3) for q in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        seen_urls = set()
        unique = []
        for batch in results:
            if isinstance(batch, Exception):
                continue
            for item in batch:
                url = item.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique.append(item)

        return unique[:8]  # cap at 8 sources

    async def verify(self, claim: str) -> dict:
        """Full verification pipeline: decompose → search → classify → verdict."""

        # Step 1: Decompose claim into search queries
        queries = self._decompose_claim(claim)

        # Step 2: Search web via Firecrawl
        sources = await self._search_all(queries)

        if not sources:
            return {
                "verdict": "MURKY",
                "confidence": 0,
                "summary": "No sources found. Unable to verify this claim.",
                "sources": [],
            }

        # Step 3: Classify each source (run in thread pool since anthropic SDK is sync)
        loop = asyncio.get_event_loop()
        classify_tasks = [
            loop.run_in_executor(None, self.classifier.classify_source, claim, s)
            for s in sources
        ]
        classified = await asyncio.gather(*classify_tasks)

        # Sort by relevance
        classified.sort(key=lambda x: x.get("relevance", 0), reverse=True)
        top_sources = classified[:5]

        # Step 4: Synthesize verdict
        verdict_data = await loop.run_in_executor(
            None, self.classifier.synthesize_verdict, claim, top_sources
        )

        return {
            "verdict": verdict_data.get("verdict", "MURKY"),
            "confidence": verdict_data.get("confidence", 1),
            "summary": verdict_data.get("summary", ""),
            "sources": top_sources,
        }

    async def verify_stream(self, claim: str) -> AsyncGenerator[str, None]:
        """Streaming verification — yields SSE events for each pipeline step."""

        def _sse(event: str, data: dict) -> str:
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        # Step 1: Decompose
        yield _sse("step", {"step": "decompose", "message": "Decomposing claim into search queries..."})
        queries = self._decompose_claim(claim)
        yield _sse("queries", {"queries": queries})

        # Step 2: Search
        yield _sse("step", {"step": "search", "message": f"Searching {len(queries)} queries via Firecrawl..."})
        sources = await self._search_all(queries)
        yield _sse("search_done", {"count": len(sources)})

        if not sources:
            yield _sse("result", {
                "verdict": "MURKY", "confidence": 0,
                "summary": "No sources found. Unable to verify this claim.",
                "sources": [],
            })
            return

        # Step 3: Classify
        yield _sse("step", {"step": "classify", "message": f"Classifying {len(sources)} sources..."})
        loop = asyncio.get_event_loop()
        classify_tasks = [
            loop.run_in_executor(None, self.classifier.classify_source, claim, s)
            for s in sources
        ]

        classified = []
        for i, task in enumerate(asyncio.as_completed(classify_tasks)):
            result = await task
            classified.append(result)
            yield _sse("source_classified", {
                "index": i + 1,
                "total": len(sources),
                "title": result.get("title", ""),
                "stance": result.get("stance", "NEUTRAL"),
            })

        classified.sort(key=lambda x: x.get("relevance", 0), reverse=True)
        top_sources = classified[:5]

        # Step 4: Synthesize
        yield _sse("step", {"step": "synthesize", "message": "Synthesizing final verdict..."})
        verdict_data = await loop.run_in_executor(
            None, self.classifier.synthesize_verdict, claim, top_sources
        )

        yield _sse("result", {
            "verdict": verdict_data.get("verdict", "MURKY"),
            "confidence": verdict_data.get("confidence", 1),
            "summary": verdict_data.get("summary", ""),
            "sources": top_sources,
        })
