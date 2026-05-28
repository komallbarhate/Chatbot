/* ============================================================
   NovaMind — Gemini-Powered Chatbot
   Powered by Google Gemini 2.0 Flash via REST API
   ============================================================ */

"use strict";

// ── Gemini Configuration ──────────────────────────────────────────────────────
const GEMINI_API_KEY = "AIzaSyB2BBdyfHzd8xdocuz9ZFWkUg2XEnT6MaA";
const BASE_URL       = "https://generativelanguage.googleapis.com/v1beta";

// Will be populated by discoverModel() at startup
let GEMINI_MODEL    = null;
let GEMINI_ENDPOINT = null;

const SYSTEM_PROMPT = `You are NovaMind, a helpful, friendly, and knowledgeable AI assistant built into a sleek chat interface.
- Be concise but thorough. Use a warm, conversational tone.
- Use markdown: **bold**, *italic*, bullet points, and code blocks when helpful.
- For code, always specify the language in the code fence.
- Keep responses focused and avoid unnecessary filler phrases.
- If asked who you are, say you are NovaMind, powered by Google Gemini.`;

// ── DOM References ────────────────────────────────────────────────────────────
const messagesEl    = document.getElementById("messages");
const inputEl       = document.getElementById("user-input");
const sendBtn       = document.getElementById("send-btn");
const clearBtn      = document.getElementById("clear-btn");
const typingEl      = document.getElementById("typing-indicator");
const themeBtn      = document.getElementById("theme-toggle");
const nlpToggleBtn  = document.getElementById("nlp-view-toggle");
const msgCountEl    = document.getElementById("msg-count");
const sessionTimeEl = document.getElementById("session-time");
const mlStatusBadge = document.getElementById("ml-status-badge");
const mlStatusText  = document.getElementById("ml-status-text");
const mlDot         = document.getElementById("ml-dot");
const botStatusText = document.getElementById("bot-status-text");

// ── App State ─────────────────────────────────────────────────────────────────
let messageCount   = 0;
let sessionStart   = Date.now();
let isDark         = false;
let showInfoPanel  = true;
let isWaiting      = false;

/** Conversation history sent to Gemini (role: user | model) */
let conversationHistory = [];

const getTime = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// Session timer
setInterval(() => {
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  sessionTimeEl.textContent =
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}, 1000);

// ══════════════════════════════════════════════════════════════════════════════
//  MODEL DISCOVERY — calls ListModels to find what this key can actually use
// ══════════════════════════════════════════════════════════════════════════════
async function discoverModel() {
  try {
    if (mlStatusText) mlStatusText.textContent = "Connecting…";
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot", "ml-dot--loading"); }

    const res  = await fetch(`${BASE_URL}/models?key=${GEMINI_API_KEY}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

    // Prefer flash models, then pro, then anything that supports generateContent
    const PREFER = ["flash", "pro"];
    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));

    // Sort: prefer flash > pro > others
    models.sort((a, b) => {
      const ai = PREFER.findIndex(p => a.includes(p));
      const bi = PREFER.findIndex(p => b.includes(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    if (!models.length) throw new Error("No generateContent-capable models found for this API key.");

    GEMINI_MODEL    = models[0];
    GEMINI_ENDPOINT = `${BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    console.log("✅ Available models:", models);
    console.log("✅ Using:", GEMINI_MODEL);

    updateModelLabel(GEMINI_MODEL);
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot", "ml-dot--ready"); }

    return true;
  } catch (err) {
    console.error("Model discovery failed:", err.message);
    if (mlStatusText) mlStatusText.textContent = `Key error: ${err.message.slice(0, 40)}`;
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot", "ml-dot--error"); }
    if (botStatusText) botStatusText.textContent = "API key error — check console";
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GEMINI API CALL
// ══════════════════════════════════════════════════════════════════════════════
async function callGemini(userText) {
  if (!GEMINI_MODEL) throw new Error("No model available. Please refresh the page.");

  // Push user turn into history
  conversationHistory.push({ role: "user", parts: [{ text: userText }] });

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: conversationHistory,
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const t0  = performance.now();
  const res = await fetch(GEMINI_ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data       = await res.json();
  const latencyMs  = Math.round(performance.now() - t0);
  const replyText  = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokensMeta = data?.usageMetadata || {};

  // Push model reply into history
  conversationHistory.push({ role: "model", parts: [{ text: replyText }] });

  return { replyText, latencyMs, tokensMeta, model: GEMINI_MODEL };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MARKDOWN → HTML  (lightweight renderer)
// ══════════════════════════════════════════════════════════════════════════════
function markdownToHTML(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` lang \n code ```)
  html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : "";
    return `<div class="code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headings (## heading)
  html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm,  "<h3>$1</h3>");
  html = html.replace(/^# (.+)$/gm,   "<h2>$1</h2>");

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Line breaks (two newlines = paragraph break)
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

// ── Update header labels when a fallback model is selected ───────────────────
function updateModelLabel(model) {
  if (botStatusText) botStatusText.textContent = ``;
  if (mlStatusText)  mlStatusText.textContent  = `Ready`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  GEMINI INFO PANEL (shown below bot messages)
// ══════════════════════════════════════════════════════════════════════════════
function buildGeminiPanel(latencyMs, tokensMeta, model) {
  const panel = document.createElement("div");
  panel.className = "ml-panel" + (showInfoPanel ? "" : " ml-panel--hidden");

  const promptTok = tokensMeta.promptTokenCount      ?? "—";
  const respTok   = tokensMeta.candidatesTokenCount  ?? "—";
  const totalTok  = tokensMeta.totalTokenCount        ?? "—";

  const modelLabel = model || GEMINI_MODEL;
  panel.innerHTML = `
    <div class="ml-pipeline-row">
      <span class="ml-arch-chip">Input</span>
      <span class="ml-arch-arrow">→</span>
      <span class="ml-arch-chip">Gemini API</span>
      <span class="ml-arch-arrow">→</span>
      <span class="ml-arch-chip">Transformer</span>
      <span class="ml-arch-arrow">→</span>
      <span class="ml-arch-chip">Response</span>
    </div>

    <div class="ml-stats-row">
      <div class="ml-stat">
        <span class="ml-stat-val">${promptTok}</span>
        <span class="ml-stat-lbl">Input tokens</span>
      </div>
      <div class="ml-stat">
        <span class="ml-stat-val">${respTok}</span>
        <span class="ml-stat-lbl">Output tokens</span>
      </div>
      <div class="ml-stat">
        <span class="ml-stat-val">${totalTok}</span>
        <span class="ml-stat-lbl">Total tokens</span>
      </div>
      <div class="ml-stat">
        <span class="ml-stat-val">${latencyMs}<small style="font-size:0.55rem;font-weight:500">ms</small></span>
        <span class="ml-stat-lbl">Latency</span>
      </div>
    </div>
  `;

  return panel;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ERROR PANEL
// ══════════════════════════════════════════════════════════════════════════════
function buildErrorPanel(errorMsg) {
  const panel = document.createElement("div");
  panel.className = "ml-panel";
  panel.style.borderColor = "rgba(239,68,68,0.35)";
  panel.style.background  = "#fff5f5";
  panel.innerHTML = `
    <div class="ml-panel-header">
      <span class="ml-panel-title" style="color:#dc2626">⚠️ API Error</span>
    </div>
    <p class="ml-note" style="color:#dc2626">${errorMsg}</p>
  `;
  return panel;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MESSAGE RENDERER
// ══════════════════════════════════════════════════════════════════════════════
function renderMessage(text, sender, { latencyMs, tokensMeta, model, error } = {}) {
  const isBot = sender === "bot";

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isBot ? "bot-message" : "user-message"}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${isBot ? "bot-avatar" : "user-avatar"}`;
  avatar.textContent = isBot ? "N" : "U";

  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = "bubble-wrapper";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isBot ? "bot-bubble" : "user-bubble"}`;

  if (isBot) {
    bubble.innerHTML = markdownToHTML(text);
  } else {
    bubble.textContent = text;
  }

  bubbleWrapper.appendChild(bubble);

  // Append info panel for bot messages
  if (isBot) {
    if (error) {
      bubbleWrapper.appendChild(buildErrorPanel(error));
    } else if (latencyMs !== undefined) {
      bubbleWrapper.appendChild(buildGeminiPanel(latencyMs, tokensMeta || {}, model));
    }
  }

  const ts = document.createElement("span");
  ts.className = "timestamp";
  ts.textContent = getTime();
  bubbleWrapper.appendChild(ts);

  if (isBot) { wrapper.appendChild(avatar); wrapper.appendChild(bubbleWrapper); }
  else        { wrapper.appendChild(bubbleWrapper); wrapper.appendChild(avatar); }

  messagesEl.appendChild(wrapper);
  scrollToBottom();
  messageCount++;
  msgCountEl.textContent = messageCount;

  return wrapper;
}

function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}
function showTyping() { typingEl.classList.add("visible"); scrollToBottom(); }
function hideTyping() { typingEl.classList.remove("visible"); }

// ══════════════════════════════════════════════════════════════════════════════
//  SEND MESSAGE — main pipeline
// ══════════════════════════════════════════════════════════════════════════════
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isWaiting) return;

  // Hide intro hero/suggestions
  const hero = document.getElementById("copilot-hero");
  const sug  = document.getElementById("suggestion-cards");
  if (hero) hero.style.display = "none";
  if (sug)  sug.style.display  = "none";

  renderMessage(text, "user");
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  isWaiting = true;

  showTyping();

  try {
    const { replyText, latencyMs, tokensMeta } = await callGemini(text);
    hideTyping();
    renderMessage(replyText, "bot", { latencyMs, tokensMeta });
  } catch (err) {
    hideTyping();
    const errMsg = err.message || "Unknown error";
    // Don't add to history if request failed
    conversationHistory.pop(); // remove the last user message
    renderMessage(
      `Sorry, I couldn't reach the Gemini API. Please check your connection and try again.`,
      "bot",
      { error: errMsg }
    );
  } finally {
    isWaiting = false;
    sendBtn.disabled = !inputEl.value.trim();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ══════════════════════════════════════════════════════════════════════════════
sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  sendBtn.disabled = !inputEl.value.trim() || isWaiting;
});

// Sidebar chips
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const msg = chip.dataset.msg;
    if (msg && !isWaiting) {
      inputEl.value = msg;
      sendBtn.disabled = false;
      sendMessage();
    }
  });
});

// Suggestion cards (hero section)
document.querySelectorAll(".suggestion-card").forEach(card => {
  card.addEventListener("click", () => {
    const msg = card.dataset.msg;
    if (msg && !isWaiting) {
      inputEl.value = msg;
      sendBtn.disabled = false;
      sendMessage();
    }
  });
});

// Clear / New Chat
clearBtn.addEventListener("click", () => {
  messagesEl.querySelectorAll(".message").forEach(m => m.remove());
  conversationHistory = [];
  messageCount = 0;
  msgCountEl.textContent = 0;
  sessionStart = Date.now();
  // Restore Copilot hero
  const hero = document.getElementById("copilot-hero");
  const sug  = document.getElementById("suggestion-cards");
  if (hero) hero.style.display = "";
  if (sug)  sug.style.display  = "";
});

// Theme toggle
themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("dark", isDark);
});

// Info panel toggle (🧠 button)
nlpToggleBtn.addEventListener("click", () => {
  showInfoPanel = !showInfoPanel;
  nlpToggleBtn.classList.toggle("active", showInfoPanel);
  nlpToggleBtn.title = showInfoPanel ? "Hide Info Panels" : "Show Info Panels";
  document.querySelectorAll(".ml-panel").forEach(p => {
    p.classList.toggle("ml-panel--hidden", !showInfoPanel);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════════
window.addEventListener("load", async () => {
  inputEl.focus();

  // Lock input while discovering which model to use
  inputEl.disabled  = true;
  sendBtn.disabled  = true;
  inputEl.placeholder = "Connecting to Gemini…";

  if (botStatusText) botStatusText.textContent = "Connecting to Gemini API…";

  const ok = await discoverModel();

  inputEl.disabled    = false;
  inputEl.placeholder = "Ask NovaMind anything…";
  sendBtn.disabled    = !inputEl.value.trim();

  if (ok) {
    console.log(`🚀 NovaMind ready — model: ${GEMINI_MODEL}`);
  }
});
