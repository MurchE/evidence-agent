# Evidence Agent — Voice Module (ElevenLabs Agents)

Goal: local voice loop that uses **ElevenLabs Conversational AI (Agents)** for STT/TTS and calls the Evidence Agent backend (`POST /verify`).

This module is intentionally small: it wraps **ElevenAgents STT → /verify → ElevenAgents TTS**.

## Prereqs
- Backend running: `uvicorn backend.main:app --reload --port 8000`
- Create an ElevenLabs **Agent** in the ElevenLabs dashboard.
  - In the agent prompt/instructions, tell it to call the tool `verify_claim` whenever the user makes a factual claim.

## Env vars
Create `voice/.env` (or export env vars):
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `EVIDENCE_AGENT_VERIFY_URL` (default: `http://127.0.0.1:8000/verify`)

## Install
```bash
cd voice
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
python run_voice_agent.py
```

## Notes
- This uses the ElevenLabs Python SDK `Conversation` + `DefaultAudioInterface` (mic + speaker).
- If `pyaudio` is painful on a machine, you can swap the audio interface later; this is a first-pass MVP.
