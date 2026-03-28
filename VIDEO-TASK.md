# Demo Video Production Task — HACKATHON DEADLINE 10 AM PST

## Context
Evidence Agent (JudiciAI) hackathon demo video. Deadline is today.
- Backend running at http://localhost:8000
- Frontend static files at /Users/murchewings/Projects/evidence-agent/frontend/
- Port is 8000 (app.js and backend aligned)

## Your Tasks

### Task 1: Start frontend server and verify app works
```bash
# Check if port 3001 is in use
lsof -i :3001 2>/dev/null | grep LISTEN || python3 -m http.server 3001 --directory /Users/murchewings/Projects/evidence-agent/frontend &
sleep 2
curl -s http://localhost:8000/health
```

### Task 2: Generate ElevenLabs voiceover
Load API key from /Users/murchewings/Projects/evidence-agent/backend/.env
Voice ID: k8OsasklrEkKLNYd4ykK
Model: eleven_multilingual_v2
Speed: 1.15x

Voiceover text to generate:
"Your boss just told you keto lowers cholesterol. Your doctor says the opposite. Who's right? Let's find out in under 60 seconds. Type any claim. JudiciAI searches the web, pulls real sources, and classifies each one as FOR, AGAINST, or NEUTRAL. Verdict: MURKY. Confidence 5 out of 10. The evidence is genuinely split. And unlike ChatGPT, we don't pretend to know when the science doesn't. Every source is cited. Every score is explained. Click through and verify yourself. Want both sides? Hit the bull for the strongest case FOR. Hit the bear for the strongest case AGAINST. Steel-man both arguments in seconds. It reads the verdict out loud. Share it with your team. Copy it. Post it. The evidence speaks. JudiciAI. Built with ElevenLabs voice and Firecrawl search. Because the world doesn't need another AI that's always confident. It needs one that's always honest."

Save to: /Users/murchewings/Projects/evidence-agent/demo_voiceover.mp3

### Task 3: Open app in browser and take screenshots
Use `open -a Safari http://localhost:3001` to open the app.
Then use the mac-use-mcp tool via mcporter to take screenshots:
- /opt/homebrew/bin/mcporter call mac-use-mcp screenshot '{}' 
The screenshot base64 or file will need to be saved to demo-frames/

### Task 4: Assemble demo video
Use ffmpeg to create video from:
- Screenshots in /Users/murchewings/Projects/evidence-agent/screenshots/ (already exist: 01-empty-state.png, 02-loading-state.png, 03-verdict-full.png, ui-empty.png)
- Voiceover audio: demo_voiceover.mp3

Get voiceover duration with ffprobe, divide shots evenly, output demo-video.mp4

### On completion:
Run: openclaw system event --text "Demo video ready: evidence-agent/demo-video.mp4" --mode now
