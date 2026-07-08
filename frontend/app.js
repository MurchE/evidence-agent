const API_URL = window.__ENV__?.API_URL || window.location.origin;

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

// --- Loading step progress ---
const LOADING_STEPS = ["search", "scrape", "analyze", "synthesize"];

function resetLoadingSteps() {
  document.querySelectorAll(".loading-step").forEach((el) => {
    el.classList.remove("active", "done");
  });
  setLoadingStep("search");
}

function setLoadingStep(stepName) {
  const idx = LOADING_STEPS.indexOf(stepName);
  if (idx === -1) return;
  document.querySelectorAll(".loading-step").forEach((el, i) => {
    const step = el.dataset.step;
    const si = LOADING_STEPS.indexOf(step);
    el.classList.remove("active", "done");
    if (si < idx) el.classList.add("done");
    else if (si === idx) el.classList.add("active");
  });
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

function clearElement(el) {
  if (el) el.replaceChildren();
}

function makeEl(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== "") el.textContent = String(text);
  return el;
}

function clampScore(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(10, num));
}

function safeHttpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return "";
  }
  return "";
}

function displayDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "") || "source";
  } catch {
    return "source";
  }
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
  clearElement(container);
  if (!history.length) {
    container.appendChild(makeEl("p", "text-xs text-gray-600 text-center mt-8", "No claims yet"));
    return;
  }

  history.forEach((h) => {
    const style = VERDICT_STYLES[h.verdict] || VERDICT_STYLES.MURKY;
    const time = new Date(h.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const date = new Date(h.ts).toLocaleDateString();
    const button = makeEl("button", "w-full text-left bg-gray-50 border border-border rounded-lg px-3 py-2.5 hover:bg-gray-100 transition-colors");
    button.addEventListener("click", () => {
      claimInput.value = h.claim || "";
      verify();
      toggleSidebar();
    });

    button.appendChild(makeEl("p", "text-xs truncate text-gray-700", h.claim || ""));
    const meta = makeEl("div", "flex items-center justify-between mt-1");
    meta.appendChild(makeEl("span", "text-[10px] text-muted", `${date} ${time}`));
    meta.appendChild(makeEl("span", `text-[10px] font-bold ${style.text}`, `${h.verdict || "MURKY"} ${clampScore(h.confidence, 0)}/10`));
    button.appendChild(meta);
    container.appendChild(button);
  });
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
  resetLoadingSteps();

  if (DEMO_CACHE[claim]) {
    setLoadingStep("search");
    await sleep(400 + Math.random() * 300);
    setLoadingStep("scrape");
    statusText.textContent = "Scraping content...";
    await sleep(400 + Math.random() * 300);
    setLoadingStep("analyze");
    statusText.textContent = "Analyzing evidence...";
    await sleep(400 + Math.random() * 300);
    setLoadingStep("synthesize");
    statusText.textContent = "Synthesizing verdict...";
    await sleep(300);
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
      // Map backend step messages to loading stages
      const msg = data.message.toLowerCase();
      if (msg.includes("decompos") || msg.includes("search quer")) setLoadingStep("search");
      else if (msg.includes("searching") || msg.includes("firecrawl") || msg.includes("scraping")) setLoadingStep("scrape");
      else if (msg.includes("classif") || msg.includes("analyz")) setLoadingStep("analyze");
      else if (msg.includes("synthe") || msg.includes("verdict") || msg.includes("finaliz")) setLoadingStep("synthesize");
    });

    evtSource.addEventListener("queries", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Generated ${data.queries.length} search queries`;
      setLoadingStep("scrape");
    });

    evtSource.addEventListener("search_done", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Found ${data.count} sources`;
      setLoadingStep("analyze");
    });

    evtSource.addEventListener("source_classified", (e) => {
      const data = JSON.parse(e.data);
      statusText.textContent = `Classified ${data.index}/${data.total}: ${data.title.slice(0, 45)}...`;
      setLoadingStep("analyze");
    });

    evtSource.addEventListener("result", (e) => {
      const data = JSON.parse(e.data);
      evtSource.close();
      setLoadingStep("synthesize");
      // Brief delay to show final step before hiding
      setTimeout(() => {
        status.classList.add("hidden");
        renderVerdict(data);
        renderSources(data.sources || []);
        saveToHistory(claim, data.verdict, data.confidence);
        setVerifyState(false);
      }, 400);
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
    { claim: "Coffee prevents heart disease", file: "cache/coffee.json" },
    { claim: "Red wine in moderation is good for your heart", file: "cache/redwine.json" },
    { claim: "Keto can lower your cholesterol", file: "cache/keto.json" },
    { claim: "GLP-1 drugs have no known side effects", file: "cache/glp1.json" },
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
    if (bullResp.ok) BULL_BEAR_CACHE["bull:GLP-1 drugs have no known side effects"] = await (await fetch("cache/glp1-bull.json")).json();
    } catch(e) {}
    try {
    BULL_BEAR_CACHE["bull:Red wine in moderation is good for your heart"] = await bullResp.json();
    const bearResp = await fetch("cache/redwine-bear.json");
    if (bearResp.ok) BULL_BEAR_CACHE["bear:Red wine in moderation is good for your heart"] = await bearResp.json();
  } catch(e) {}
}
loadBullBearCache();

function renderCaseCard(type, text) {
  const answers = document.getElementById("followupAnswers");
  const isBull = type === "bull";
  const title = isBull ? "Bull Case" : "Bear Case";
  const textColor = isBull ? "text-emerald-700" : "text-red-700";
  const card = makeEl("div", `case-card ${isBull ? "case-bull" : "case-bear"}`);
  card.appendChild(makeEl("p", `text-xs ${textColor} font-semibold mb-1`, title));
  card.appendChild(makeEl("p", "text-sm text-gray-700", text || ""));
  answers.appendChild(card);
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

// --- Helpers for inline citations & credibility ---
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function scrollToSource(num) {
  const el = document.getElementById(`source-${num}`);
  if (!el) return;
  // Open sources panel on desktop if closed
  const panel = document.getElementById("sourcesPanel");
  if (panel && panel.classList.contains("closed") && window.innerWidth >= 768) {
    toggleSources();
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  // Brief highlight
  el.classList.add("source-highlight");
  setTimeout(() => el.classList.remove("source-highlight"), 2000);
}

const CREDIBILITY_TIERS = {
  gov: "🟢", edu: "🟢", "nih.gov": "🟢", "ncbi.nlm.nih.gov": "🟢",
  "pubmed.ncbi.nlm.nih.gov": "🟢", "pmc.ncbi.nlm.nih.gov": "🟢",
  "who.int": "🟢", "cdc.gov": "🟢", "fda.gov": "🟢",
  "nature.com": "🟢", "sciencedirect.com": "🟢", "thelancet.com": "🟢",
  "bmj.com": "🟢", "jci.org": "🟢", "nejm.org": "🟢",
  "mayoclinic.org": "🟢", "clevelandclinic.org": "🟢",
};
const MAINSTREAM_DOMAINS = [
  "nytimes.com", "washingtonpost.com", "bbc.com", "bbc.co.uk", "reuters.com",
  "apnews.com", "theguardian.com", "wsj.com", "forbes.com", "bloomberg.com",
  "cnn.com", "npr.org", "economist.com", "time.com", "wired.com",
  "arstechnica.com", "theatlantic.com", "healthline.com", "webmd.com",
  "wikipedia.org",
];

function getCredibilityTier(url) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    // Check exact domain match first
    if (CREDIBILITY_TIERS[hostname]) return CREDIBILITY_TIERS[hostname];
    // Check TLD for .gov, .edu
    const tld = hostname.split(".").pop();
    if (tld === "gov" || tld === "edu") return "🟢";
    // Check second-level for .gov.xx patterns
    const parts = hostname.split(".");
    if (parts.length >= 2 && parts[parts.length - 2] === "gov") return "🟢";
    // Mainstream media / established
    if (MAINSTREAM_DOMAINS.some(d => hostname.endsWith(d))) return "🟡";
    return "🔴";
  } catch {
    return "🔴";
  }
}

const TIER_LABELS = {
  "🟢": "Peer-reviewed / Gov",
  "🟡": "Established publication",
  "🔴": "Blog / Unknown",
};

function shareOneClick() {
  const claim = document.getElementById("verdictClaim").textContent;
  const v = verdictLabel.textContent;
  const conf = confidenceNum.textContent;
  const text = `"${claim}": ${v} (${conf}) — verified by Evidence Agent`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("shareOneClickText");
    if (btn) { btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = "Share Verdict"; }, 2000); }
  });
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

  const conf = clampScore(data.confidence, 0);
  confidenceBar.style.width = `${conf * 10}%`;
  confidenceBar.className = `confidence-fill ${style.barBg}`;
  confidenceNum.textContent = `${conf}/10`;

  // Render summary with inline citation superscripts
  const summaryText = data.summary || "";
  const srcs = data.sources || [];
  clearElement(verdictSummary);
  if (srcs.length > 0) {
    verdictSummary.appendChild(document.createTextNode(`${summaryText} `));
    srcs.forEach((_, i) => {
      const num = i + 1;
      const citation = makeEl("a", "inline-citation", `[${num}]`);
      citation.href = `#source-${num}`;
      citation.title = `Source ${num}`;
      citation.addEventListener("click", (event) => {
        event.preventDefault();
        scrollToSource(num);
      });
      verdictSummary.appendChild(citation);
    });
  } else {
    verdictSummary.textContent = summaryText;
  }
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
  if (sourceCount) sourceCount.textContent = srcs.length + " sources found - click to view details";

  function buildSourceCard(s, i) {
    const num = i + 1;
    const safeUrl = safeHttpUrl(s.url || "");
    const domain = displayDomain(safeUrl);
    const stance = ["FOR", "AGAINST", "NEUTRAL"].includes(s.stance) ? s.stance : "NEUTRAL";
    const badge = STANCE_BADGE[stance] || STANCE_BADGE.NEUTRAL;
    const cred = clampScore(s.credibility, 5);
    const credColor = cred >= 7 ? "text-emerald-600" : cred >= 4 ? "text-amber-600" : "text-red-600";
    const credBarColor = cred >= 7 ? "bg-emerald-500" : cred >= 4 ? "bg-amber-500" : "bg-red-500";
    const tier = getCredibilityTier(safeUrl);
    const tierLabel = TIER_LABELS[tier] || "";

    const card = makeEl("div", "source-card bg-panel border border-border rounded-xl p-4 transition-all duration-300");
    card.id = `source-${num}`;

    const header = makeEl("div", "flex items-center justify-between mb-2");
    const titleWrap = makeEl("div", "min-w-0 flex-1");
    const meta = makeEl("span", "text-xs text-muted", `${tier} ${domain} `);
    meta.appendChild(makeEl("span", "text-[10px] text-gray-400", tierLabel));
    titleWrap.appendChild(meta);

    const heading = makeEl("h3", "font-semibold text-sm leading-tight text-gray-800");
    heading.appendChild(makeEl("span", "text-blue-500 font-bold mr-1", `[${num}]`));
    heading.appendChild(document.createTextNode(s.title || domain));
    titleWrap.appendChild(heading);
    header.appendChild(titleWrap);
    header.appendChild(makeEl("span", `text-xs font-bold px-2 py-1 rounded border ${badge} shrink-0 ml-2`, stance));
    card.appendChild(header);

    const credibility = makeEl("div", "flex items-center gap-2 mb-2");
    credibility.appendChild(makeEl("span", "text-xs text-muted", "Credibility"));
    const bar = makeEl("div", "w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden");
    const fill = makeEl("div", `h-full rounded-full ${credBarColor}`);
    fill.style.width = `${cred * 10}%`;
    bar.appendChild(fill);
    credibility.appendChild(bar);
    credibility.appendChild(makeEl("span", `text-xs font-semibold ${credColor}`, `${cred}/10`));
    card.appendChild(credibility);

    if (s.quote) {
      card.appendChild(makeEl("blockquote", "border-l-2 border-gray-300 pl-3 text-sm text-gray-500 italic mt-2", `"${s.quote}"`));
    }

    if (safeUrl) {
      const link = makeEl("a", "text-xs text-blue-600 hover:underline mt-2 inline-block", "View source ->");
      link.href = safeUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.appendChild(link);
    }

    return card;
  }

  // Populate both desktop panel and mobile inline cards
  clearElement(sourceCards);
  srcs.forEach((s, i) => sourceCards.appendChild(buildSourceCard(s, i)));
  const mobileCards = document.getElementById("mobileSourceCards");
  if (mobileCards) {
    clearElement(mobileCards);
    srcs.forEach((s, i) => mobileCards.appendChild(buildSourceCard(s, i)));
  }

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
  clearElement(historyList);
  history.forEach((h) => {
    const style = VERDICT_STYLES[h.verdict] || VERDICT_STYLES.MURKY;
    const time = new Date(h.ts).toLocaleString();

    const button = makeEl("button", "w-full text-left bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors flex items-center justify-between gap-3");
    button.addEventListener("click", () => {
      claimInput.value = h.claim || "";
      verify();
    });

    const details = makeEl("div", "flex-1 min-w-0");
    details.appendChild(makeEl("p", "text-sm truncate", h.claim || ""));
    details.appendChild(makeEl("span", "text-xs text-gray-500", time));
    button.appendChild(details);

    const result = makeEl("div", "flex items-center gap-2 shrink-0");
    result.appendChild(makeEl("span", `text-xs font-bold ${style.text}`, h.verdict || "MURKY"));
    result.appendChild(makeEl("span", "text-xs text-gray-500", `${clampScore(h.confidence, 0)}/10`));
    button.appendChild(result);

    historyList.appendChild(button);
  });
}

// Show history on load
renderHistory();

// --- Follow-up Q&A ---
async function askFollowup(caseMode = null) {
  const input = document.getElementById("followupInput");
  const question = input.value.trim();
  if (!question || !lastResult) return;
  if (!lastResult.result_id) {
    showError("Follow-up requires a server-verified result. Run a live verification first.");
    return;
  }
  dismissError();

  const answers = document.getElementById("followupAnswers");
  const loadingId = `followupLoading-${Date.now()}`;
  const promptLabel = caseMode === "bull" ? "Bull Case Prompt" : caseMode === "bear" ? "Bear Case Prompt" : "You asked";
  const promptClass = caseMode === "bull"
    ? "case-card case-bull"
    : caseMode === "bear"
      ? "case-card case-bear"
      : "text-sm bg-panel border border-border rounded-lg px-4 py-3";

  // Show question immediately
  const promptCard = makeEl("div", promptClass);
  promptCard.appendChild(makeEl("p", "text-xs text-blue-600 font-semibold mb-1", `${promptLabel}:`));
  promptCard.appendChild(makeEl("p", "text-sm text-gray-700", question));
  const loading = makeEl("p", "text-gray-500 mt-2 italic", "Reviewing evidence...");
  loading.id = loadingId;
  promptCard.appendChild(loading);
  answers.appendChild(promptCard);
  input.value = "";

  try {
    const resp = await fetch(`${API_URL}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        result_id: lastResult.result_id,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const loading = document.getElementById(loadingId);
    if (loading) loading.replaceWith(makeEl("p", "mt-2 text-sm text-gray-700", data.answer || ""));

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

// --- M-key mic activation (hold M to talk) ---
let mKeyHeld = false;
document.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") {
    if (mKeyHeld) return;
    if (document.activeElement.tagName === "INPUT") return; // don't interfere with typing
    mKeyHeld = true;
    e.preventDefault();
    
    // If we have a verdict, activate follow-up mic
    if (lastResult) {
      stopAllAudio();
      const followupInput = document.getElementById("followupInput");
      if (followupInput) followupInput.placeholder = "🎙 Listening...";
      if (recognition) {
        recognition.onresult = (ev) => {
          const transcript = ev.results[0][0].transcript;
          document.getElementById("followupInput").value = transcript;
          document.getElementById("followupInput").placeholder = '⚖️ George is weighing the evidence...';
          askFollowup();
        };
        recognition.start();
      }
    } else {
      // No verdict yet — activate claim input mic
      if (recognition) {
        const micBtn = document.getElementById("micBtn");
        if (micBtn) micBtn.classList.add("recording");
        recognition.onresult = (ev) => {
          const transcript = ev.results[0][0].transcript;
          claimInput.value = transcript;
          verify();
        };
        recognition.start();
      }
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "m" || e.key === "M") {
    mKeyHeld = false;
    if (recognition) recognition.stop();
    const micBtn = document.getElementById("micBtn");
    if (micBtn) micBtn.classList.remove("recording");
    const followupInput = document.getElementById("followupInput");
    if (followupInput) followupInput.placeholder = "Cross-examine the evidence...";
  }
});
