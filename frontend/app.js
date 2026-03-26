const API_URL = "http://localhost:8002";

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
const errorState = document.getElementById("errorState");
const errorText = document.getElementById("errorText");
const retryBtn = document.getElementById("retryBtn");
const exampleCarousel = document.getElementById("exampleCarousel");

const EXAMPLE_CLAIMS = [
  { claim: "Drinking coffee reduces Alzheimer's risk", tone: "supported" },
  { claim: "Exercise is more effective than antidepressants for mild depression", tone: "supported" },
  { claim: "Vitamin C prevents the common cold", tone: "unsupported" },
  { claim: "Blue light glasses significantly improve sleep quality", tone: "murky" },
  { claim: "Red wine in moderation is good for your heart", tone: "murky" },
];

let retryLastAction = null;
let isVerifying = false;
const defaultVerifyBtnLabel = verifyBtn ? verifyBtn.textContent.trim() : "Verify Claim";
let selectedVoice = "George"; // George — British, credible

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

function setVerifyState(active) {
  isVerifying = active;
  verifyBtn.disabled = active;
  verifyBtn.textContent = active ? "Verifying..." : defaultVerifyBtnLabel;
  verifyBtn.classList.toggle("opacity-70", active);
  verifyBtn.classList.toggle("cursor-not-allowed", active);
}

function dismissError() {
  if (errorState) errorState.classList.add("hidden");
  retryLastAction = null;
}

function showError(message, retryAction) {
  if (!errorState || !errorText || !retryBtn) return;
  errorText.textContent = message;
  retryLastAction = typeof retryAction === "function" ? retryAction : null;
  retryBtn.classList.toggle("hidden", !retryLastAction);
  errorState.classList.remove("hidden");
}

if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    if (!retryLastAction) return;
    dismissError();
    retryLastAction();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderExampleClaims() {
  if (!exampleCarousel) return;
  exampleCarousel.innerHTML = EXAMPLE_CLAIMS.map((entry) => {
    const isMurky = entry.tone === "murky";
    const extraClass = isMurky ? "murky-chip" : "";
    return `<button class="example-claim-chip ${extraClass}" data-claim="${escapeHtml(entry.claim)}">${escapeHtml(entry.claim)}</button>`;
  }).join("");

  exampleCarousel.querySelectorAll("button[data-claim]").forEach((button) => {
    button.addEventListener("click", () => pickExampleClaim(button.dataset.claim || ""));
  });
}

function pickExampleClaim(claim) {
  claimInput.value = claim;
  verify();
}

renderExampleClaims();

// Playback speed
let playbackRate = 1.3;

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
  if (!recognition) {
    showError("Voice input isn’t supported in this browser. Try typing your claim instead.");
    return;
  }
  recognition.start();
  micBtn.classList.add("recording");
});

micBtn.addEventListener("mouseup", () => {
  if (recognition) recognition.stop();
});

function resetVerificationUI() {
  verdict.classList.add("hidden");
  sources.classList.add("hidden");
  sourceCards.innerHTML = "";
  document.getElementById("followup").classList.add("hidden");
  document.getElementById("followupAnswers").innerHTML = "";
  lastResult = null;
}

const AUDIO_CACHE = {
  "Red wine in moderation is good for your heart": "cache/audio/redwine.mp3",
};

// --- Verify (SSE streaming) ---
async function verify() {
  const claim = claimInput.value.trim();
  if (!claim || isVerifying) return;

  dismissError();
  setVerifyState(true);
  resetVerificationUI();
  status.classList.remove("hidden");
  statusText.textContent = "Weighing the evidence...";

  if (DEMO_CACHE[claim]) {
    await sleep(1000 + Math.random() * 600);
    statusText.textContent = "Delivering verdict...";
    await sleep(500);
    status.classList.add("hidden");

    const data = DEMO_CACHE[claim];
    renderVerdict(data);
    renderSources(data.sources || []);
    saveToHistory(claim, data.verdict, data.confidence);

    if (AUDIO_CACHE[claim]) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
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

    setVerifyState(false);
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
      statusText.textContent = `Classified ${data.index}/${data.total}: ${data.title.slice(0, 45)}...`;
    });

    evtSource.addEventListener("result", (e) => {
      const data = JSON.parse(e.data);
      evtSource.close();
      status.classList.add("hidden");
      renderVerdict(data);
      renderSources(data.sources || []);
      saveToHistory(claim, data.verdict, data.confidence);
      setVerifyState(false);
    });

    evtSource.onerror = () => {
      evtSource.close();
      status.classList.add("hidden");
      verifyFallback(claim);
    };
  } catch (err) {
    status.classList.add("hidden");
    setVerifyState(false);
    showError(
      "JudiciAI couldn’t reach the verification service. Check your backend and try again.",
      () => verify()
    );
    console.error(err);
  }
}

// Fallback for browsers/environments where SSE doesn't work
async function verifyFallback(claim) {
  status.classList.remove("hidden");
  statusText.textContent = "Finalizing your verdict...";

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
    showError(
      "We hit a network issue before the verdict could load. Tap retry to run it again.",
      () => {
        claimInput.value = claim;
        verify();
      }
    );
    console.error(err);
  } finally {
    setVerifyState(false);
  }
}

verifyBtn.addEventListener("click", verify);
claimInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    verify();
  }
});

document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
  e.preventDefault();
  if (document.activeElement?.id === "followupInput") {
    askFollowup();
    return;
  }
  verify();
});

// --- Voice Output (ElevenLabs TTS) ---
let currentAudio = null;
let isPlaying = false;
let isTTSLoading = false;

function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  isPlaying = false;
  isTTSLoading = false;
  updatePlayBtn();
}

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
  const SPEEDS = [0.8, 1.0, 1.2, 1.3, 1.5, 1.7, 2.0];
  const current = SPEEDS.indexOf(SPEEDS.reduce((a, b) => Math.abs(b - playbackRate) < Math.abs(a - playbackRate) ? b : a));
  const next = Math.max(0, Math.min(SPEEDS.length - 1, current + (delta > 0 ? 1 : -1)));
  playbackRate = SPEEDS[next];
  if (currentAudio) currentAudio.playbackRate = playbackRate;
  const el = document.getElementById("speedDisplay");
  if (el) el.textContent = playbackRate.toFixed(1) + "x";
}

async function speakText(text) {
  stopAllAudio();
  if (isTTSLoading) return;
  isTTSLoading = true;
  const btn = document.getElementById("speakerBtn");
  if (btn) {
    btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>';
    btn.classList.add("opacity-50");
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
    isTTSLoading = false;
    if (btn) btn.classList.remove("opacity-50");
    updatePlayBtn();
    currentAudio.addEventListener("ended", () => {
      isPlaying = false;
      updatePlayBtn();
      URL.revokeObjectURL(url);
      currentAudio = null;
    });
  } catch (err) {
    isTTSLoading = false;
    if (btn) btn.classList.remove("opacity-50");
    updatePlayBtn();
    console.warn("TTS unavailable:", err.message);
  }
}

// --- Last result (for follow-ups) ---
let lastResult = null;

function buildShareSummary() {
  const claim = document.getElementById("verdictClaim").textContent;
  const v = verdictLabel.textContent;
  const conf = confidenceNum.textContent;
  const summary = verdictSummary.textContent;

  const compact = `JudiciAI verdict\nClaim: "${claim}"\nRuling: ${v} (${conf})\n${summary}\n\nVerified with Firecrawl + Claude + ElevenLabs`;
  const social = `JudiciAI checked: "${claim}"\n→ ${v} (${conf} confidence)\n${summary}`;

  return { claim, v, conf, summary, compact, social };
}

// --- Copy verdict ---
function copyVerdict() {
  const { compact } = buildShareSummary();
  navigator.clipboard.writeText(compact).then(() => {
    const btn = document.getElementById("shareBtnText");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
}

async function shareVerdict() {
  const { compact } = buildShareSummary();
  const btn = document.getElementById("shareVerdictBtnText");
  try {
    if (navigator.share) {
      await navigator.share({
        title: "JudiciAI Verdict",
        text: compact,
      });
      if (btn) btn.textContent = "Shared";
    } else {
      await navigator.clipboard.writeText(compact);
      if (btn) btn.textContent = "Copied for share";
    }
  } catch (err) {
    if (err?.name !== "AbortError") {
      showError("Couldn’t open sharing options. You can still use Copy verdict.");
    }
  }

  if (btn) {
    setTimeout(() => {
      btn.textContent = "Share Verdict";
    }, 1800);
  }
}

// --- Pre-cached demo results (instant for demo) ---
const DEMO_CACHE = {};
async function loadDemoCache() {
  const demos = [
    { claim: "Drinking coffee reduces Alzheimer's risk", file: "cache/coffee-alzheimers.json" },
    { claim: "Exercise is more effective than antidepressants for mild depression", file: "cache/exercise-depression.json" },
    { claim: "Vitamin C prevents the common cold", file: "cache/vitamin-c-cold.json" },
    { claim: "Blue light glasses significantly improve sleep quality", file: "cache/blue-light-sleep.json" },
    { claim: "Red wine in moderation is good for your heart", file: "cache/redwine.json" },
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
  return buildShareSummary();
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
  dismissError();
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
const BULL_BEAR_PRESET = {
  "bull:Drinking coffee reduces Alzheimer's risk": {
    answer: "The strongest pro case is that several large prospective cohorts and umbrella reviews report lower incidence of cognitive decline among moderate coffee drinkers, with effect sizes in the ~20-30% range for Alzheimer’s and all-cause dementia. Mechanistically, caffeine and polyphenols are plausible via anti-inflammatory and cerebrovascular pathways, and the signal appears fairly consistent across populations after adjusting for age and smoking."
  },
  "bear:Drinking coffee reduces Alzheimer's risk": {
    answer: "The strongest anti case is that this is mostly observational evidence, not randomized long-term prevention trials. Reverse causality and lifestyle confounding remain difficult to fully remove, and dose-response thresholds vary across studies. The data suggests association, but not definitive proof that coffee itself causes lower Alzheimer’s risk."
  },
  "bull:Exercise is more effective than antidepressants for mild depression": {
    answer: "The strongest FOR argument is that many meta-analyses show exercise has moderate-to-large symptom improvements for mild depression, while also improving sleep, anxiety, cardiometabolic health, and relapse prevention. For mild cases, adherence-supported exercise programs can match or exceed medication effect sizes without medication side effects."
  },
  "bear:Exercise is more effective than antidepressants for mild depression": {
    answer: "The strongest AGAINST argument is that treatment response is highly individual and depends on intensity, supervision, and adherence. Antidepressants can outperform exercise for some patients, especially when symptoms escalate or comorbid anxiety dominates. Best evidence often supports exercise as first-line adjunctive care, not a universal replacement."
  },
};

async function loadBullBearCache() {
  Object.assign(BULL_BEAR_CACHE, BULL_BEAR_PRESET);
  try {
    const bullResp = await fetch("cache/redwine-bull.json");
    if (bullResp.ok) BULL_BEAR_CACHE["bull:Red wine in moderation is good for your heart"] = await bullResp.json();
    const bearResp = await fetch("cache/redwine-bear.json");
    if (bearResp.ok) BULL_BEAR_CACHE["bear:Red wine in moderation is good for your heart"] = await bearResp.json();
  } catch(e) {}
}
loadBullBearCache();

function renderCaseCard(type, text) {
  const answers = document.getElementById("followupAnswers");
  const isBull = type === "bull";
  const title = isBull ? "Bull Case" : "Bear Case";
  const icon = isBull ? "🐂" : "🐻";
  const textColor = isBull ? "text-emerald-700" : "text-red-700";
  answers.innerHTML += `<div class="case-card ${isBull ? "case-bull" : "case-bear"}"><p class="text-xs ${textColor} font-semibold mb-1">${icon} ${title}</p><p class="text-sm text-gray-700">${escapeHtml(text)}</p></div>`;
}

function askBullCase() {
  const claim = claimInput.value.trim();
  const cached = BULL_BEAR_CACHE["bull:" + claim];
  if (cached) {
    renderCaseCard("bull", cached.answer);
    speakText(cached.answer);
    return;
  }
  const input = document.getElementById("followupInput");
  input.value = "What is the strongest evidence supporting this claim? Steel-man the case FOR it.";
  askFollowup("bull");
}

function askBearCase() {
  const claim = claimInput.value.trim();
  const cached = BULL_BEAR_CACHE["bear:" + claim];
  if (cached) {
    renderCaseCard("bear", cached.answer);
    speakText(cached.answer);
    return;
  }
  const input = document.getElementById("followupInput");
  input.value = "What is the strongest evidence against this claim? Steel-man the case AGAINST it.";
  askFollowup("bear");
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
  SUPPORTED: {
    bg: "bg-emerald-50",
    border: "border-emerald-500",
    barBg: "bg-emerald-500",
    text: "text-emerald-700",
    verdictClass: "",
  },
  UNSUPPORTED: {
    bg: "bg-red-50",
    border: "border-red-500",
    barBg: "bg-red-500",
    text: "text-red-700",
    verdictClass: "",
  },
  MURKY: {
    bg: "bg-amber-50",
    border: "border-amber-400 border-dashed",
    barBg: "bg-amber-500",
    text: "text-amber-800",
    verdictClass: "verdict-murky",
  },
};

function renderVerdict(data) {
  const v = data.verdict || "MURKY";
  const style = VERDICT_STYLES[v] || VERDICT_STYLES.MURKY;
  dismissError();

  // Show the original claim in the verdict banner
  document.getElementById("verdictClaim").textContent = claimInput.value.trim();

  verdict.className = `mb-8 rounded-2xl p-6 text-center border ${style.bg} ${style.border} ${style.verdictClass || ""}`;
  verdictLabel.textContent = v;
  verdictLabel.className = `text-3xl font-extrabold mb-2 ${style.text}`;

  const conf = data.confidence || 0;
  confidenceBar.style.width = `${conf * 10}%`;
  confidenceBar.className = `confidence-fill ${style.barBg}`;
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
    const safeUrl = s.url || "";
    let domain = "source";
    try {
      domain = new URL(safeUrl).hostname.replace("www.", "") || "source";
    } catch {
      domain = "source";
    }
    const badge = STANCE_BADGE[s.stance] || STANCE_BADGE.NEUTRAL;
    const cred = s.credibility || 5;
    const credColor = cred >= 7 ? "text-emerald-600" : cred >= 4 ? "text-amber-600" : "text-red-600";
    const credBarColor = cred >= 7 ? "bg-emerald-500" : cred >= 4 ? "bg-amber-500" : "bg-red-500";
    const sourceLink = safeUrl ? `<a href="${safeUrl}" target="_blank" class="text-xs text-blue-600 hover:underline mt-2 inline-block">View source &rarr;</a>` : "";
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
        ${sourceLink}
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
async function askFollowup(caseMode = null) {
  const input = document.getElementById("followupInput");
  const question = input.value.trim();
  if (!question || !lastResult) return;
  dismissError();

  const answers = document.getElementById("followupAnswers");
  const loadingId = `followupLoading-${Date.now()}`;
  const promptLabel = caseMode === "bull" ? "🐂 Bull Case Prompt" : caseMode === "bear" ? "🐻 Bear Case Prompt" : "You asked";
  const promptClass = caseMode === "bull"
    ? "case-card case-bull"
    : caseMode === "bear"
      ? "case-card case-bear"
      : "text-sm bg-panel border border-border rounded-lg px-4 py-3";

  // Show question immediately
  answers.innerHTML += `
    <div class="${promptClass}">
      <p class="text-xs text-blue-600 font-semibold mb-1">${promptLabel}:</p>
      <p class="text-sm text-gray-700">${escapeHtml(question)}</p>
      <p class="text-gray-500 mt-2 italic" id="${loadingId}">Reviewing evidence...</p>
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

    const loading = document.getElementById(loadingId);
    if (loading) loading.outerHTML = `<p class="mt-2 text-sm text-gray-700">${escapeHtml(data.answer)}</p>`;

    // Narrate the answer
    speakText(data.answer);
  } catch (err) {
    const loading = document.getElementById(loadingId);
    if (loading) loading.textContent = "Couldn’t load the follow-up answer right now.";
    showError("Follow-up request failed. Tap retry to ask again.", () => {
      input.value = question;
      askFollowup(caseMode);
    });
  }
}

// Enter key for follow-up
document.getElementById("followupInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") askFollowup();
});
