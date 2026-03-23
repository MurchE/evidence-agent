import httpx
import os
from typing import Dict, Any

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

async def verify_claim(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Call the Evidence Agent backend to verify a claim.
    Expected params: {'claim': str}
    """
    claim = params.get("claim")
    if not claim:
        return {"error": "No claim provided"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/verify",
                json={"claim": claim}
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract high-level verdict and summary for voice response
            verdict = data.get("verdict", "Unknown")
            summary = data.get("summary", "No summary available.")
            
            return {
                "verdict": verdict,
                "summary": summary,
                "full_data": data
            }
        except Exception as e:
            return {"error": str(e)}
