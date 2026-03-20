"""Local voice loop for Evidence Agent using ElevenLabs Conversational AI.

Flow: user speaks → ElevenLabs Agent (STT) → tool call `verify_claim` → Evidence Agent backend → agent speaks verdict (TTS).

This assumes you created/configured an ElevenLabs Agent in the ElevenLabs dashboard.
"""

from __future__ import annotations

import os
import signal
from typing import Any, Dict

import httpx
from dotenv import load_dotenv


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def verify_claim_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """Tool callable by the ElevenLabs Agent.

    Expected params:
      - claim: str

    Returns the JSON payload from POST /verify.
    """

    claim = (params.get("claim") or "").strip()
    if not claim:
        return {"error": "claim is required"}

    url = os.getenv("EVIDENCE_AGENT_VERIFY_URL", "http://127.0.0.1:8000/verify")

    # Keep this sync for simplicity; ElevenLabs tool bridge supports sync tools.
    try:
        resp = httpx.post(url, json={"claim": claim}, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": f"verify_call_failed: {e}"}


def main() -> None:
    load_dotenv()

    api_key = _require_env("ELEVENLABS_API_KEY")
    agent_id = _require_env("ELEVENLABS_AGENT_ID")

    # Imported lazily so this file can be inspected without deps installed.
    from elevenlabs.client import ElevenLabs
    from elevenlabs.conversational_ai.conversation import Conversation, ClientTools
    from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

    client = ElevenLabs(api_key=api_key)

    tools = ClientTools()
    tools.register("verify_claim", verify_claim_tool, is_async=False)

    conversation = Conversation(
        client,
        agent_id,
        audio_interface=DefaultAudioInterface(),
        client_tools=tools,
        requires_auth=True,
        callback_user_transcript=lambda t: print(f"YOU: {t}"),
        callback_agent_response=lambda r: print(f"AGENT: {r}"),
    )

    def _sigint(_signum: int, _frame: Any) -> None:
        print("\nStopping…")
        try:
            conversation.wait_for_session_end()
        finally:
            raise SystemExit(0)

    signal.signal(signal.SIGINT, _sigint)

    print("Starting ElevenLabs conversation. Speak now (Ctrl+C to exit).")
    conversation.wait_for_session_end()


if __name__ == "__main__":
    main()
