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
const sourceCards = document.getElementById("sourcePanelCards");
let selectedVoice = "rachel"; // default ElevenLabs voice

// --- Sidebar & Sources Panel ---
// Each panel is independent — opening one does NOT affect the other
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const sp = document.getElementById("sourcesPanel");
  const ov = document.getElementById("overlay");
  sb.classList.toggle("closed");
  if (!sb.classList.contains("closed")) {
    renderSidebarHistory();
  }
  // Show overlay if either panel is open
  const anyOpen = !sb.classList.contains("closed") || !sp.classList.contains("closed");
  ov.classList.toggle("hidden", !anyOpen);
}

function toggleSources() {
  const sp = document.getElementById("sourcesPanel");
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("overlay");
  sp.classList.toggle("closed");
  const anyOpen = !sb.classList.contains("closed") || !sp.classList.contains("closed");
  ov.classList.toggle("hidden", !anyOpen);
}

function closeAllPanels() {
  document.getElementById("sidebar").classList.add("closed");
  document.getElementById("sourcesPanel").classList.add("closed");
  document.getElementById("overlay").classList.add("hidden");
}

// Playback speed
let playbackRate = 1.0;

function renderSidebarHistory() {
  const history = getHistory();
  const container = document.getElementById("sidebarHistory");
  if (!history.length) {
    container.innerHTML = '<p class="text-xs text-gray-600 text-center mt-8">No claims yet</p>';
    return;
  }
  container.innerHTML = history.map((h) => {
    const style = VERDICT_STYLES[h.verdict] || VERDICT_STYLES.MURKY;
    const time = new Date(h.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const date = new Date(h.ts).toLocaleDateString();
    return '<button onclick="claimInput.value=\'' + h.claim.replace(/'/g, "\\'") + '\';verify();toggleSidebar()" class="w-full text-left bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2.5 hover:border-gray-600 transition-colors">' +
      '<p class="text-xs truncate text-gray-300">' + h.claim + '</p>' +
      '<div class="flex items-center justify-between mt-1">' +
        '<span class="text-[10px] text-gray-600">' + date + ' ' + time + '</span>' +
        '<span class="text-[10px] font-bold ' + style.text + '">' + h.verdict + ' ' + h.confidence + '/10</span>' +
      '</div>' +
    '</button>';
  }).join("");
}

// --- Voice selector ---
function setVoice(voiceId, voiceName) {
  selectedVoice = voiceId;
  document.querySelectorAll(".voice-option").forEach(el => el.classList.remove("active"));
  const btn = document.getElementById("voice-" + voiceId);
  if (btn) btn.classList.add("active");
}

// --- Discard claim (don't save to history) ---
function discardClaim() {
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  if (sourceCards) sourceCards.innerHTML = "";
  document.getElementById("followup").classList.add("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
  lastResult = null;
  claimInput.value = "";
  claimInput.focus();
  // Remove last history entry (the one we just discarded)
  const history = getHistory();
  if (history.length > 0) {
    history.pop();
    localStorage.setItem("ea_history", JSON.stringify(history));
  }
}

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

// --- Verify (SSE streaming) ---
async function verify() {
  const claim = claimInput.value.trim();
  if (!claim) return;

  // Reset UI
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  document.getElementById("followup").classList.add("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
  lastResult = null;
  status.classList.remove("hidden");
  statusText.textContent = "Starting verification...";

  try {
    const evtSource = new EventSource(
      `${API_URL}/verify/stream?claim=${encodeURIComponent(claim)}`
    );

    evtSource.addEventListener("step", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = data.message;
    });

    evtSource.addEventListener("queries", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Generated ${data.queries.length} search queries`;
    });

    evtSource.addEventListener("search_done", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Found ${data.count} sources`;
    });

    evtSource.addEventListener("source_classified", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Classified ${data.index}/${data.total}: ${data.title.slice(0, 40)}...`;
    });

    evtSource.addEventListener("result", (e) => {
      const data = JSON.parse(e.data);
      evtSource.close();
      status.classList.add("hidden");
      renderVerdict(data);
      renderSources(data.sources || []);
      saveToHistory(claim, data.verdict, data.confidence);
    });

    evtSource.onerror = () => {
      evtSource.close();
      status.classList.add("hidden");
      // Fallback to non-streaming endpoint
      verifyFallback(claim);
    };
  } catch (err) {
    status.classList.add("hidden");
    alert("Error: " + err.message);
  }
}

// Fallback for browsers/environments where SSE doesn't work
async function verifyFallback(claim) {
  status.classList.remove("hidden");
  statusText.textContent = "Analyzing claim...";

  try {
    const resp = await fetch(`${API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    status.classList.add("hidden");
    renderVerdict(data);
    renderSources(data.sources || []);
    saveToHistory(claim, data.verdict, data.confidence);
  } catch (err) {
    status.classList.add("hidden");
    alert("Error: " + err.message);
  }
}

verifyBtn.addEventListener("click", verify);
claimInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") verify();
});

// --- Voice Output (ElevenLabs TTS) ---
let currentAudio = null;
let isPlaying = false;

function togglePlayPause() {
  if (!currentAudio) return;
  if (isPlaying) {
    currentAudio.pause();
    isPlaying = false;
    updatePlayBtn();
  } else {
    currentAudio.play();
    isPlaying = true;
    updatePlayBtn();
  }
}

function updatePlayBtn() {
  const btn = document.getElementById("speakerBtn");
  if (!btn) return;
  if (isPlaying) {
    btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    btn.classList.add("playing");
  } else {
    btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    btn.classList.remove("playing");
  }
}

function changeSpeed(delta) {
  playbackRate = Math.max(0.5, Math.min(2.0, playbackRate + delta));
  if (currentAudio) currentAudio.playbackRate = playbackRate;
  const el = document.getElementById("speedDisplay");
  if (el) el.textContent = playbackRate.toFixed(1) + "x";
}

async function speakText(text) {
  // Always stop current audio first
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
    isPlaying = false;
    updatePlayBtn();
  }

  try {
    const resp = await fetch(`${API_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: selectedVoice }),
    });

    if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`);

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.playbackRate = playbackRate;
    currentAudio.play();
    isPlaying = true;
    updatePlayBtn();

    // Update speaker button state
    const speakerBtn = document.getElementById("speakerBtn");
    if (speakerBtn) {
      currentAudio.addEventListener("ended", () => {
        isPlaying = false;
        updatePlayBtn();
        URL.revokeObjectURL(url);
        currentAudio = null;
      });
    }
  } catch (err) {
    console.warn("TTS unavailable:", err.message);
  }
}

// --- Last result (for follow-ups) ---
let lastResult = null;

// --- Copy verdict ---
function copyVerdict() {
  const claim = document.getElementById("verdictClaim").textContent;
  const v = verdictLabel.textContent;
  const conf = confidenceNum.textContent;
  const summary = verdictSummary.textContent;
  const text = `Claim: ${claim}\nVerdict: ${v} (${conf})\n${summary}\n\n— Evidence Agent`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("shareBtnText");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy verdict"; }, 2000);
  });
}

// --- Share functions ---
function getVerdictText() {
  const claim = document.getElementById("verdictClaim").textContent;
  const v = verdictLabel.textContent;
  const conf = confidenceNum.textContent;
  const summary = verdictSummary.textContent;
  return { claim, v, conf, summary };
}

function shareToX() {
  const { claim, v, conf } = getVerdictText();
  const text = `Claim: "${claim}" → ${v} (${conf} confidence)\n\nVerified by Evidence Agent`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

function shareToLinkedIn() {
  const { claim, v, conf, summary } = getVerdictText();
  const text = `I just verified a claim using Evidence Agent:\n\n"${claim}"\n\nVerdict: ${v} (${conf})\n${summary}`;
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`, '_blank');
}

function shareToEmail() {
  const { claim, v, conf, summary } = getVerdictText();
  const subject = `Evidence Check: ${claim}`;
  const body = `I verified this claim using Evidence Agent:\n\nClaim: "${claim}"\nVerdict: ${v} (Confidence: ${conf})\n\n${summary}\n\n— Verified by Evidence Agent`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

function newClaim() {
  // Reset everything for a new claim
  claimInput.value = "";
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  document.getElementById("followup").classList.add("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
  lastResult = null;
  claimInput.focus();
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

  // Show the original claim in the verdict banner
  document.getElementById("verdictClaim").textContent = claimInput.value.trim();

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

  // Store full result for follow-ups
  lastResult = data;
  document.getElementById("followup").classList.remove("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
}

const STANCE_BADGE = {
  FOR:     "bg-emerald-800 text-emerald-200",
  AGAINST: "bg-red-800 text-red-200",
  NEUTRAL: "bg-gray-700 text-gray-300",
};

function renderSources(srcs) {
  if (!srcs.length) return;
  const sourceCount = document.getElementById("sourceCount");
  if (sourceCount) sourceCount.textContent = srcs.length + " sources found — click to view details →";

  sourceCards.innerHTML = srcs.map((s) => {
    const domain = new URL(s.url).hostname.replace("www.", "");
    const badge = STANCE_BADGE[s.stance] || STANCE_BADGE.NEUTRAL;
    const cred = s.credibility || 5;
    const credColor = cred >= 7 ? "text-emerald-400" : cred >= 4 ? "text-amber-400" : "text-red-400";
    const credBarColor = cred >= 7 ? "bg-emerald-400" : cred >= 4 ? "bg-amber-400" : "bg-red-400";
    return `
      <div class="source-card bg-[#1A1A1A] border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="text-xs text-gray-500">${domain}</span>
            <h3 class="font-semibold text-sm leading-tight">${s.title || domain}</h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold px-2 py-1 rounded ${badge}">${s.stance}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-gray-500">Credibility</span>
          <div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${credBarColor}" style="width: ${cred * 10}%"></div>
          </div>
          <span class="text-xs font-semibold ${credColor}">${cred}/10</span>
          ${s.credibility_reason ? `<span class="text-xs text-gray-500 ml-1">— ${s.credibility_reason}</span>` : ""}
        </div>
        ${s.quote ? `<blockquote class="border-l-2 border-gray-600 pl-3 text-sm text-gray-400 italic mt-2">"${s.quote}"</blockquote>` : ""}
        <a href="${s.url}" target="_blank" class="text-xs text-blue-400 hover:underline mt-2 inline-block">View source</a>
      </div>`;
  }).join("");

  sources.classList.remove("hidden");
}

// --- Claim History (localStorage) ---
const historySection = document.getElementById("history");
const historyList = document.getElementById("historyList");

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("ea_history") || "[]");
  } catch { return []; }
}

function saveToHistory(claim, verdict, confidence) {
  const history = getHistory();
  history.unshift({ claim, verdict, confidence, ts: Date.now() });
  // Keep last 10
  localStorage.setItem("ea_history", JSON.stringify(history.slice(0, 10)));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) { historySection.classList.add("hidden"); return; }

  historySection.classList.remove("hidden");
  historyList.innerHTML = history.map((h) => {
    const style = VERDICT_STYLES[h.verdict] || VERDICT_STYLES.MURKY;
    const time = new Date(h.ts).toLocaleString();
    return `
      <button onclick="claimInput.value='${h.claim.replace(/'/g, "\\'")}';verify()"
        class="w-full text-left bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate">${h.claim}</p>
          <span class="text-xs text-gray-500">${time}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs font-bold ${style.text}">${h.verdict}</span>
          <span class="text-xs text-gray-500">${h.confidence}/10</span>
        </div>
      </button>`;
  }).join("");
}

// Show history on load
renderHistory();

// --- Follow-up Q&A ---
async function askFollowup() {
  const input = document.getElementById("followupInput");
  const question = input.value.trim();
  if (!question || !lastResult) return;

  const answers = document.getElementById("followupAnswers");
  // Show question immediately
  answers.innerHTML += `
    <div class="text-sm text-gray-300 bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3">
      <p class="text-xs text-blue-400 font-semibold mb-1">You asked:</p>
      <p>${question}</p>
      <p class="text-gray-500 mt-2 italic" id="followupLoading">Thinking...</p>
    </div>`;
  input.value = "";

  try {
    const resp = await fetch(`${API_URL}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        claim: claimInput.value.trim(),
        verdict: lastResult.verdict,
        summary: lastResult.summary,
        sources: lastResult.sources || [],
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const loading = document.getElementById("followupLoading");
    if (loading) loading.outerHTML = `<p class="mt-2">${data.answer}</p>`;

    // Narrate the answer
    speakText(data.answer);
  } catch (err) {
    const loading = document.getElementById("followupLoading");
    if (loading) loading.textContent = "Failed to get answer: " + err.message;
  }
}

// Enter key for follow-up
document.getElementById("followupInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") askFollowup();
});
