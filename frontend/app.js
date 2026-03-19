const API_URL = "http://localhost:8000";

const claimInput = document.getElementById("claimInput");
const micBtn = document.getElementById("micBtn");
const verifyBtn = document.getElementById("verifyBtn");
const status = document.getElementById("status");
const statusText = document.getElementById("statusText");
const verdict = document.getElementById("verdict");
const verdictLabel = document.getElementById("verdictLabel");
const confidenceBar = document.getElementById("confidenceBar");
const confidenceNum = document.getElementById("confidenceNum");
const verdictSummary = document.getElementById("verdictSummary");
const sources = document.getElementById("sources");
const sourceCards = document.getElementById("sourceCards");

// --- Voice Input (Web Speech API) ---
let recognition = null;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    claimInput.value = transcript;
    micBtn.classList.remove("recording");
  };

  recognition.onend = () => micBtn.classList.remove("recording");
  recognition.onerror = () => micBtn.classList.remove("recording");
}

micBtn.addEventListener("mousedown", () => {
  if (!recognition) return alert("Speech recognition not supported in this browser.");
  recognition.start();
  micBtn.classList.add("recording");
});

micBtn.addEventListener("mouseup", () => {
  if (recognition) recognition.stop();
});

// --- Verify ---
const STATUS_STEPS = [
  "Decomposing claim...",
  "Fetching sources...",
  "Evaluating evidence...",
  "Synthesizing verdict...",
];

async function verify() {
  const claim = claimInput.value.trim();
  if (!claim) return;

  // Reset UI
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  status.classList.remove("hidden");

  // Animate status steps
  let step = 0;
  statusText.textContent = STATUS_STEPS[0];
  const stepInterval = setInterval(() => {
    step++;
    if (step < STATUS_STEPS.length) {
      statusText.textContent = STATUS_STEPS[step];
    }
  }, 3000);

  try {
    const resp = await fetch(`${API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    clearInterval(stepInterval);
    status.classList.add("hidden");
    renderVerdict(data);
    renderSources(data.sources || []);
  } catch (err) {
    clearInterval(stepInterval);
    status.classList.add("hidden");
    statusText.textContent = "";
    alert("Error: " + err.message);
  }
}

verifyBtn.addEventListener("click", verify);
claimInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") verify();
});

// --- Voice Output (ElevenLabs TTS) ---
let currentAudio = null;

async function speakText(text) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const resp = await fetch(`${API_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`);

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.play();

    // Update speaker button state
    const speakerBtn = document.getElementById("speakerBtn");
    if (speakerBtn) {
      speakerBtn.classList.add("playing");
      currentAudio.addEventListener("ended", () => {
        speakerBtn.classList.remove("playing");
        URL.revokeObjectURL(url);
        currentAudio = null;
      });
    }
  } catch (err) {
    console.warn("TTS unavailable:", err.message);
  }
}

// --- Render ---
const VERDICT_STYLES = {
  SUPPORTED:   { bg: "bg-emerald-900/60", border: "border-emerald-500", barBg: "bg-emerald-400", text: "text-emerald-300" },
  UNSUPPORTED: { bg: "bg-red-900/60",     border: "border-red-500",     barBg: "bg-red-400",     text: "text-red-300" },
  MURKY:       { bg: "bg-amber-900/60",    border: "border-amber-500",   barBg: "bg-amber-400",   text: "text-amber-300" },
};

function renderVerdict(data) {
  const v = data.verdict || "MURKY";
  const style = VERDICT_STYLES[v] || VERDICT_STYLES.MURKY;

  verdict.className = `mb-8 rounded-2xl p-6 text-center border ${style.bg} ${style.border}`;
  verdictLabel.textContent = v;
  verdictLabel.className = `text-3xl font-extrabold mb-2 ${style.text}`;

  const conf = data.confidence || 0;
  confidenceBar.style.width = `${conf * 10}%`;
  confidenceBar.className = `h-full rounded-full transition-all duration-700 ${style.barBg}`;
  confidenceNum.textContent = `${conf}/10`;

  verdictSummary.textContent = data.summary || "";
  verdict.classList.remove("hidden");

  // Store narration text for replay button
  const narration = `Verdict: ${v}. Confidence: ${conf} out of 10. ${data.summary || ""}`;
  verdictSummary.dataset.narration = narration;

  // Auto-narrate the verdict
  speakText(narration);
}

const STANCE_BADGE = {
  FOR:     "bg-emerald-800 text-emerald-200",
  AGAINST: "bg-red-800 text-red-200",
  NEUTRAL: "bg-gray-700 text-gray-300",
};

function renderSources(srcs) {
  if (!srcs.length) return;

  sourceCards.innerHTML = srcs.map((s) => {
    const domain = new URL(s.url).hostname.replace("www.", "");
    const badge = STANCE_BADGE[s.stance] || STANCE_BADGE.NEUTRAL;
    return `
      <div class="source-card bg-[#1A1A1A] border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="text-xs text-gray-500">${domain}</span>
            <h3 class="font-semibold text-sm leading-tight">${s.title || domain}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded ${badge}">${s.stance}</span>
        </div>
        ${s.quote ? `<blockquote class="border-l-2 border-gray-600 pl-3 text-sm text-gray-400 italic mt-2">"${s.quote}"</blockquote>` : ""}
        <a href="${s.url}" target="_blank" class="text-xs text-blue-400 hover:underline mt-2 inline-block">View source</a>
      </div>`;
  }).join("");

  sources.classList.remove("hidden");
}
