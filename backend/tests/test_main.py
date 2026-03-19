"""Tests for the Evidence Agent API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_verify_empty_claim():
    resp = client.post("/verify", json={"claim": ""})
    assert resp.status_code == 400


def test_verify_missing_claim():
    resp = client.post("/verify", json={})
    assert resp.status_code == 422


def test_tts_empty_text():
    resp = client.post("/tts", json={"text": ""})
    assert resp.status_code == 400


def test_tts_missing_text():
    resp = client.post("/tts", json={})
    assert resp.status_code == 422


def test_followup_empty_question():
    resp = client.post("/followup", json={
        "question": "",
        "claim": "test",
        "verdict": "MURKY",
        "summary": "test",
        "sources": [],
    })
    assert resp.status_code == 400


def test_verify_stream_missing_claim():
    resp = client.get("/verify/stream")
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

    resp = client.post("/verify", json={"claim": "The sky is blue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["verdict"] == "SUPPORTED"
    assert data["confidence"] == 8


@patch("main.VoiceSynthesizer")
def test_tts_success(mock_synth_cls):
    mock_synth = MagicMock()
    mock_synth.synthesize = AsyncMock(return_value=b"fake-mp3-bytes")
    mock_synth_cls.return_value = mock_synth

    resp = client.post("/tts", json={"text": "Hello world"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert resp.content == b"fake-mp3-bytes"
