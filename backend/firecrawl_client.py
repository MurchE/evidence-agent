"""Firecrawl API wrapper for web search and scraping."""

import os
import httpx

FIRECRAWL_BASE = "https://api.firecrawl.dev/v1"


class FirecrawlClient:
    def __init__(self):
        self.api_key = os.getenv("FIRECRAWL_API_KEY")
        if not self.api_key:
            raise RuntimeError("FIRECRAWL_API_KEY not set")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def search(self, query: str, limit: int = 5) -> list[dict]:
        """Search the web via Firecrawl and return results with scraped content."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{FIRECRAWL_BASE}/search",
                headers=self.headers,
                json={
                    "query": query,
                    "limit": limit,
                    "scrapeOptions": {"formats": ["markdown"]},
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("data", []):
            results.append({
                "url": item.get("url", ""),
                "title": item.get("title", ""),
                "content": item.get("markdown", item.get("content", "")),
            })
        return results
