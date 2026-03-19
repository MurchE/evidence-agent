# Evidence Agent

Voice-first claim verification tool. Speak or type a claim, and Evidence Agent searches the web, classifies sources, and delivers a verdict.

## Architecture

```
Claim → Decompose (3 queries) → Firecrawl search → Claude classification → Verdict
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

## API

### POST /verify

```json
// Request
{"claim": "Coffee reduces the risk of heart disease"}

// Response
{
  "verdict": "MURKY",
  "confidence": 6,
  "summary": "Evidence is mixed — some large studies show...",
  "sources": [
    {
      "url": "https://example.com/study",
      "title": "Coffee and Cardiovascular Health",
      "quote": "Moderate consumption was associated with...",
      "stance": "FOR"
    }
  ]
}
```

## Keys Needed

| Key | Source |
|-----|--------|
| `FIRECRAWL_API_KEY` | [firecrawl.dev](https://firecrawl.dev) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) (future: voice output) |
