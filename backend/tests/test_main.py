"""Tests for the Evidence Agent API endpoints."""

import asyncio
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

os.environ["EVIDENCE_AGENT_API_TOKEN"] = "test-token"
os.environ["CORS_ALLOW_ORIGINS"] = "https://app.example.test"

from main import app  # noqa: E402


AUTH_HEADERS = {"Authorization": "Bearer test-token"}


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, **kwargs)


def request(method: str, path: str, **kwargs) -> httpx.Response:
    return asyncio.run(_request(method, path, **kwargs))


def test_health():
    resp = request("GET", "/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cors_rejects_unlisted_origin():
    resp = request(
        "OPTIONS",
        "/verify",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert resp.status_code == 400
    assert "access-control-allow-origin" not in resp.headers


def test_paid_endpoint_requires_auth():
    resp = request("POST", "/verify", json={"claim": "The sky is blue"})
    assert resp.status_code == 401


def test_verify_empty_claim():
    resp = request("POST", "/verify", headers=AUTH_HEADERS, json={"claim": ""})
    assert resp.status_code == 400


def test_verify_missing_claim():
    resp = request("POST", "/verify", headers=AUTH_HEADERS, json={})
    assert resp.status_code == 422


def test_oversized_body_rejected():
    resp = request("POST", "/verify", headers=AUTH_HEADERS, json={"claim": "x" * 40000})
    assert resp.status_code == 413


def test_tts_empty_text():
    resp = request("POST", "/tts", headers=AUTH_HEADERS, json={"text": ""})
    assert resp.status_code == 400


def test_tts_missing_text():
    resp = request("POST", "/tts", headers=AUTH_HEADERS, json={})
    assert resp.status_code == 422


def test_followup_empty_question():
    resp = request("POST", "/followup", headers=AUTH_HEADERS, json={
        "question": "",
        "result_id": "missing",
    })
    assert resp.status_code == 400


def test_followup_requires_server_result_id():
    resp = request("POST", "/followup", headers=AUTH_HEADERS, json={"question": "Why?"})
    assert resp.status_code == 400


def test_verify_stream_missing_claim():
    resp = request("GET", "/verify/stream", headers=AUTH_HEADERS)
    assert resp.status_code == 422


@patch("main.EvidenceAgent")
def test_verify_success(mock_agent_cls):
    mock_agent = MagicMock()
    mock_agent.verify = AsyncMock(return_value={
        "verdict": "SUPPORTED",
        "confidence": 8,
        "summary": "Test summary",
        "sources": [],
    })
    mock_agent_cls.return_value = mock_agent

    resp = request("POST", "/verify", headers=AUTH_HEADERS, json={"claim": "The sky is blue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["verdict"] == "SUPPORTED"
    assert data["confidence"] == 8
    assert data["claim"] == "The sky is blue"
    assert data["result_id"]
    mock_agent.verify.assert_awaited_once_with("The sky is blue")


@patch("main.VoiceSynthesizer")
def test_tts_success(mock_synth_cls):
    mock_synth = MagicMock()
    mock_synth.synthesize = AsyncMock(return_value=b"fake-mp3-bytes")
    mock_synth_cls.return_value = mock_synth

    resp = request("POST", "/tts", headers=AUTH_HEADERS, json={"text": "Hello world"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert resp.content == b"fake-mp3-bytes"


def test_frontend_source_xss_payload_is_not_rendered_with_inner_html():
    app_js = Path(__file__).resolve().parents[2] / "frontend" / "app.js"
    source = app_js.read_text(encoding="utf-8")
    assert "sourceCards.innerHTML = cardHtml" not in source
    assert "mobileCards.innerHTML = cardHtml" not in source
    assert "safeHttpUrl" in source
    assert "textContent" in source
    assert "appendChild(buildSourceCard" in source
