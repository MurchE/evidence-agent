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
let selectedVoice = "murch"; // default to Murch's cloned voice

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
    return '<button onclick="claimInput.value=\'' + h.claim.replace(/'/g, "\\'") + '\';verify();toggleSidebar()" class="w-full text-left bg-gray-50 border border-border rounded-lg px-3 py-2.5 hover:bg-gray-100 transition-colors">' +
      '<p class="text-xs truncate text-gray-700">' + h.claim + '</p>' +
      '<div class="flex items-center justify-between mt-1">' +
        '<span class="text-[10px] text-muted">' + date + ' ' + time + '</span>' +
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
  statusText.textContent = "Weighing the evidence...";

  // Check demo cache first (instant results for pre-cached claims)
  const AUDIO_CACHE = {
    "Coffee prevents heart disease": "cache/audio/coffee.mp3",
    "Red wine in moderation is good for your heart": "cache/audio/redwine.mp3",
    "Keto can lower your cholesterol": "cache/audio/keto.mp3",
  };

  if (DEMO_CACHE[claim]) {
    // Brief delay to look natural (1-2s)
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    statusText.textContent = "Delivering verdict...";
    await new Promise(r => setTimeout(r, 500));
    status.classList.add("hidden");
    const data = DEMO_CACHE[claim];
    renderVerdict(data);
    renderSources(data.sources || []);
    saveToHistory(claim, data.verdict, data.confidence);

    // Play pre-generated audio instead of hitting TTS API
    if (AUDIO_CACHE[claim]) {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      currentAudio = new Audio(AUDIO_CACHE[claim]);
      currentAudio.playbackRate = playbackRate;
      currentAudio.play();
      isPlaying = true;
      updatePlayBtn();
      currentAudio.addEventListener("ended", () => {
        isPlaying = false;
        updatePlayBtn();
        currentAudio = null;
      });
    }
    return;
  }

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

// --- Pre-cached demo results (instant for demo) ---
const DEMO_CACHE = {};
async function loadDemoCache() {
  const demos = [
    { claim: "Coffee prevents heart disease", file: "cache/coffee.json" },
    { claim: "Red wine in moderation is good for your heart", file: "cache/redwine.json" },
    { claim: "Keto can lower your cholesterol", file: "cache/keto.json" },
  ];
  for (const d of demos) {
    try {
      const resp = await fetch(d.file);
      if (resp.ok) DEMO_CACHE[d.claim] = await resp.json();
    } catch (e) { /* cache miss is fine */ }
  }
}
loadDemoCache();

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
  claimInput.value = "";
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  document.getElementById("followup").classList.add("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
  const suggestions = document.getElementById("followupSuggestions");
  if (suggestions) suggestions.remove();
  lastResult = null;
  // Show examples again
  const examples = document.getElementById("exampleClaims");
  if (examples) examples.classList.remove("hidden");
  claimInput.focus();
}

// --- Bull & Bear (steelman / steelman-against) ---
// Pre-cached bull/bear for demo claims
const BULL_BEAR_CACHE = {};
async function loadBullBearCache() {
  try {
    const bullResp = await fetch("cache/redwine-bull.json");
    if (bullResp.ok) BULL_BEAR_CACHE["bull:Red wine in moderation is good for your heart"] = await bullResp.json();
    const bearResp = await fetch("cache/redwine-bear.json");
    if (bearResp.ok) BULL_BEAR_CACHE["bear:Red wine in moderation is good for your heart"] = await bearResp.json();
  } catch(e) {}
}
loadBullBearCache();

function askBullCase() {
  const claim = claimInput.value.trim();
  const cached = BULL_BEAR_CACHE["bull:" + claim];
  if (cached) {
    const answers = document.getElementById("followupAnswers");
    answers.innerHTML += '<div class="text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"><p class="text-xs text-emerald-600 font-semibold mb-1">🐂 Bull Case</p><p class="text-gray-700">' + cached.answer + '</p></div>';
    speakText(cached.answer);
    return;
  }
  const input = document.getElementById("followupInput");
  input.value = "What is the strongest evidence supporting this claim? Steel-man the case FOR it.";
  askFollowup();
}

function askBearCase() {
  const claim = claimInput.value.trim();
  const cached = BULL_BEAR_CACHE["bear:" + claim];
  if (cached) {
    const answers = document.getElementById("followupAnswers");
    answers.innerHTML += '<div class="text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p class="text-xs text-red-600 font-semibold mb-1">🐻 Bear Case</p><p class="text-gray-700">' + cached.answer + '</p></div>';
    speakText(cached.answer);
    return;
  }
  const input = document.getElementById("followupInput");
  input.value = "What is the strongest evidence against this claim? Steel-man the case AGAINST it.";
  askFollowup();
}

// --- Follow-up suggestions ---
function generateFollowUps(claim, verdict, summary) {
  const suggestions = [];
  suggestions.push("What is the strongest evidence for this claim?");
  suggestions.push("What is the strongest evidence against this claim?");
  if (verdict === "MURKY") {
    suggestions.push("Why is the evidence conflicting?");
    suggestions.push("What would settle this debate?");
  } else if (verdict === "SUPPORTED") {
    suggestions.push("Are there any notable exceptions?");
    suggestions.push("How strong is the scientific consensus?");
  } else {
    suggestions.push("Where did this myth originate?");
    suggestions.push("What do people commonly confuse about this?");
  }
  return suggestions;
}

function renderFollowUpSuggestions(suggestions) {
  const existing = document.getElementById("followupSuggestions");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "followupSuggestions";
  container.className = "flex flex-wrap gap-2 mt-3";

  suggestions.forEach(q => {
    const btn = document.createElement("button");
    btn.className = "text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors";
    btn.textContent = q;
    btn.onclick = () => {
      document.getElementById("followupInput").value = q;
      askFollowup();
    };
    container.appendChild(btn);
  });

  const followupSection = document.getElementById("followup");
  const followupInput = followupSection.querySelector(".flex");
  followupSection.insertBefore(container, followupInput);
}

// --- Render ---
const VERDICT_STYLES = {
  SUPPORTED:   { bg: "bg-emerald-50", border: "border-emerald-500", barBg: "bg-emerald-500", text: "text-emerald-700" },
  UNSUPPORTED: { bg: "bg-red-50",     border: "border-red-500",     barBg: "bg-red-500",     text: "text-red-700" },
  MURKY:       { bg: "bg-amber-50",   border: "border-amber-500",   barBg: "bg-amber-500",   text: "text-amber-700" },
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

  // Hide examples after first verdict
  const examples = document.getElementById("exampleClaims");
  if (examples) examples.classList.add("hidden");

  // Store full result for follow-ups
  lastResult = data;
  document.getElementById("followup").classList.remove("hidden");
  document.getElementById("followupAnswers").innerHTML = "";

  // Generate suggested follow-up questions based on the claim and verdict
  const claim = claimInput.value.trim();
  const suggestions = generateFollowUps(claim, v, data.summary || "");
  renderFollowUpSuggestions(suggestions);
}

const STANCE_BADGE = {
  FOR:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  AGAINST: "bg-red-100 text-red-700 border-red-200",
  NEUTRAL: "bg-gray-100 text-gray-600 border-gray-200",
};

function renderSources(srcs) {
  if (!srcs.length) return;
  const sourceCount = document.getElementById("sourceCount");
  if (sourceCount) sourceCount.textContent = srcs.length + " sources found — click to view details →";

  const cardHtml = srcs.map((s) => {
    const domain = new URL(s.url).hostname.replace("www.", "");
    const badge = STANCE_BADGE[s.stance] || STANCE_BADGE.NEUTRAL;
    const cred = s.credibility || 5;
    const credColor = cred >= 7 ? "text-emerald-600" : cred >= 4 ? "text-amber-600" : "text-red-600";
    const credBarColor = cred >= 7 ? "bg-emerald-500" : cred >= 4 ? "bg-amber-500" : "bg-red-500";
    return `
      <div class="source-card bg-panel border border-border rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="min-w-0 flex-1">
            <span class="text-xs text-muted">${domain}</span>
            <h3 class="font-semibold text-sm leading-tight text-gray-800">${s.title || domain}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded border ${badge} shrink-0 ml-2">${s.stance}</span>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-muted">Credibility</span>
          <div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${credBarColor}" style="width: ${cred * 10}%"></div>
          </div>
          <span class="text-xs font-semibold ${credColor}">${cred}/10</span>
        </div>
        ${s.quote ? '<blockquote class="border-l-2 border-gray-300 pl-3 text-sm text-gray-500 italic mt-2">"' + s.quote + '"</blockquote>' : ""}
        <a href="${s.url}" target="_blank" class="text-xs text-blue-600 hover:underline mt-2 inline-block">View source &rarr;</a>
      </div>`;
  }).join("");

  // Populate both desktop panel and mobile inline cards
  sourceCards.innerHTML = cardHtml;
  const mobileCards = document.getElementById("mobileSourceCards");
  if (mobileCards) mobileCards.innerHTML = cardHtml;

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
