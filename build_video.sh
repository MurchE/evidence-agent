#!/bin/bash
# Build demo video from screenshots + voiceover
# Total voiceover: ~38.3s, 6 frames

FRAMES=/Users/murchewings/Projects/evidence-agent/demo-frames
OUT=/Users/murchewings/Projects/evidence-agent/demo-video.mp4
AUDIO=/Users/murchewings/Projects/evidence-agent/demo_voiceover.mp3

# Create concat file with durations matching voiceover sections:
# 01_landing: "Your boss told you..." intro (0-7s) = 7s
# 02_claim_entered: "Type any claim..." (7-12s) = 5s
# 03_verdict: "Verdict: MURKY..." (12-22s) = 10s
# 04_sources: "Every source is cited..." (22-28s) = 6s
# 05_bull_case: "Hit the bull..." (28-33s) = 5s
# 06_bear_case: "It reads the verdict..." + outro (33-39s) = 6s

cat > /tmp/frames.txt << 'EOF'
file '/Users/murchewings/Projects/evidence-agent/demo-frames/01_landing.png'
duration 7
file '/Users/murchewings/Projects/evidence-agent/demo-frames/02_claim_entered.png'
duration 5
file '/Users/murchewings/Projects/evidence-agent/demo-frames/03_verdict.png'
duration 10
file '/Users/murchewings/Projects/evidence-agent/demo-frames/04_sources.png'
duration 6
file '/Users/murchewings/Projects/evidence-agent/demo-frames/05_bull_case.png'
duration 5
file '/Users/murchewings/Projects/evidence-agent/demo-frames/06_bear_case.png'
duration 6
file '/Users/murchewings/Projects/evidence-agent/demo-frames/06_bear_case.png'
duration 0.5
EOF

ffmpeg -y -f concat -safe 0 -i /tmp/frames.txt -i "$AUDIO" \
  -vf "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -shortest -movflags +faststart \
  "$OUT" 2>&1

echo ""
echo "=== Video built ==="
ls -lh "$OUT"
ffprobe -i "$OUT" -show_entries format=duration -v quiet -of csv="p=0" 2>/dev/null
