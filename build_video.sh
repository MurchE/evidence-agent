#!/bin/bash
# Build demo video from screenshots + voiceover
# Total voiceover: ~38.3s, 6 frames

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMES="${DEMO_FRAMES_DIR:-$PROJECT_ROOT/demo-frames}"
OUT="${DEMO_VIDEO_OUT:-$PROJECT_ROOT/demo-video.mp4}"
AUDIO="${VOICEOVER_OUT:-$PROJECT_ROOT/demo_voiceover.mp3}"
CONCAT_FILE="$(mktemp)"
trap 'rm -f "$CONCAT_FILE"' EXIT

# Create concat file with durations matching voiceover sections:
# 01_landing: "Your boss told you..." intro (0-7s) = 7s
# 02_claim_entered: "Type any claim..." (7-12s) = 5s
# 03_verdict: "Verdict: MURKY..." (12-22s) = 10s
# 04_sources: "Every source is cited..." (22-28s) = 6s
# 05_bull_case: "Hit the bull..." (28-33s) = 5s
# 06_bear_case: "It reads the verdict..." + outro (33-39s) = 6s

add_frame() {
  printf "file '%s/%s'\n" "$FRAMES" "$1" >> "$CONCAT_FILE"
  printf "duration %s\n" "$2" >> "$CONCAT_FILE"
}

add_frame "01_landing.png" 7
add_frame "02_claim_entered.png" 5
add_frame "03_verdict.png" 10
add_frame "04_sources.png" 6
add_frame "05_bull_case.png" 5
add_frame "06_bear_case.png" 6
add_frame "06_bear_case.png" 0.5

ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" -i "$AUDIO" \
  -vf "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -shortest -movflags +faststart \
  "$OUT" 2>&1

echo ""
echo "=== Video built ==="
ls -lh "$OUT"
ffprobe -i "$OUT" -show_entries format=duration -v quiet -of csv="p=0" 2>/dev/null
