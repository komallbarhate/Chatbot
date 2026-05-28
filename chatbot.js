/* ============================================================
   NovaMind — Gemini-Powered Chatbot  v2
   Features: History, File Attach, Search, Incognito Mode
   ============================================================ */

"use strict";

// ── Gemini Configuration ──────────────────────────────────────────────────────
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// GEMINI_API_KEY is loaded from config.js (gitignored — never pushed to GitHub)
let GEMINI_MODEL    = null;
let GEMINI_ENDPOINT = null;

const PERSONA_PROMPTS = {
  default: `You are NovaMind, a helpful, friendly, and knowledgeable AI assistant.
- Be concise but thorough. Use a warm, conversational tone.
- Use markdown: **bold**, *italic*, bullet points, and code blocks when helpful.
- For code, always specify the language in the code fence.
- Keep responses focused and avoid unnecessary filler phrases.
- If asked who you are, say you are NovaMind, powered by Google Gemini.
- When a user shares an image, describe what you see and help with any related questions.
- When a user shares a file's content, analyze it and assist accordingly.`,

  expert: `You are NovaMind, acting as an elite software engineering agent and coding expert.
- Provide clean, highly optimized, and production-ready code snippets.
- Use clear explanations of algorithms, design patterns, and complexity.
- Focus strictly on technical correctness, best practices, and security.
- Avoid unnecessary introductory chit-chat, and get straight to the code.
- Format all code snippets using proper code blocks.`,

  creative: `You are NovaMind, acting as a creative writer and storyteller.
- Use vivid language, rich descriptions, and engaging prose.
- Be expressive, poetic, and imaginative in your answers.
- Help the user write stories, scripts, poems, brainstorm ideas, or write copy.
- Feel free to use metaphors and creative comparisons.`,

  sarcastic: `You are NovaMind, a highly intelligent but extremely sarcastic assistant.
- Give helpful answers but dress them in witty banter, playful sass, and light sarcasm.
- Use dry humor, ironies, and funny remarks, but keep it friendly and safe.
- You can act slightly unimpressed or offer funny sighs, but ultimately answer the question correctly.`
};

const IMAGE_GEN_RULES = `
- IMPORTANT (IMAGE GENERATION): If the user asks you to generate, create, draw, paint, or show an image or picture, you must output an image using the following exact Markdown format: ![Generated Image](https://image.pollinations.ai/prompt/{encoded_description})
- Replace {encoded_description} with a descriptive, detailed, space-separated or plus-separated prompt describing the image in detail. DO NOT use brackets or curly braces in the final URL. Only output the image markdown without any extra text or conversational filler if they only asked for an image.
- Example: If the user says "draw a cute kitten", you must output: ![Cute kitten](https://image.pollinations.ai/prompt/cute+kitten+highly+detailed+warm+lighting+soft+focus)`;

let currentPersona = "default";
let currentUtterance = null;
let speakingButton = null;

function toggleSpeak(text, btn) {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (speakingButton) {
      speakingButton.classList.remove("speaking");
      speakingButton.title = "Read aloud";
      speakingButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
    if (speakingButton === btn) {
      speakingButton = null;
      return;
    }
  }

  // Remove markdown tags and code blocks
  let cleanText = text.replace(/```[\s\S]*?```/g, "[code block omitted]");
  cleanText = cleanText.replace(/<[^>]*>/g, "").replace(/\*|_|`/g, "");
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en-"));
  if (voice) utterance.voice = voice;

  utterance.onend = () => {
    btn.classList.remove("speaking");
    btn.title = "Read aloud";
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    if (speakingButton === btn) speakingButton = null;
  };

  utterance.onerror = () => {
    btn.classList.remove("speaking");
    btn.title = "Read aloud";
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    if (speakingButton === btn) speakingButton = null;
  };

  btn.classList.add("speaking");
  btn.title = "Stop reading";
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>`;
  
  speakingButton = btn;
  window.speechSynthesis.speak(utterance);
}
// ── DOM References ────────────────────────────────────────────────────────────
const messagesEl          = document.getElementById("messages");
const inputEl             = document.getElementById("user-input");
const sendBtn             = document.getElementById("send-btn");
const clearBtn            = document.getElementById("clear-btn");
const typingEl            = document.getElementById("typing-indicator");
const themeBtn            = document.getElementById("theme-toggle");
const nlpToggleBtn        = document.getElementById("nlp-view-toggle");
const msgCountEl          = document.getElementById("msg-count");
const sessionTimeEl       = document.getElementById("session-time");
const mlStatusText        = document.getElementById("ml-status-text");
const mlDot               = document.getElementById("ml-dot");
const botStatusText       = document.getElementById("bot-status-text");
const searchInputEl       = document.getElementById("search-input");
const searchClearBtn      = document.getElementById("search-clear-btn");
const sessionListEl       = document.getElementById("session-list");
const incognitoBanner     = document.getElementById("incognito-banner");
const incognitoHeaderBtn  = document.getElementById("incognito-header-btn");
const incognitoSidebarBtn = document.getElementById("incognito-sidebar-btn");
const attachBtn           = document.getElementById("attach-btn");
const micBtn              = document.getElementById("mic-btn");
const fileInputEl         = document.getElementById("file-input");
const filePreviewArea     = document.getElementById("file-preview-area");
const fileChipNameEl      = document.getElementById("file-chip-name");
const fileRemoveBtn       = document.getElementById("file-remove-btn");
const inputAreaInner      = document.querySelector(".input-area-inner");

// ── App State ─────────────────────────────────────────────────────────────────
let messageCount        = 0;
let sessionStart        = Date.now();
let isDark              = false;
let showInfoPanel       = true;
let isWaiting           = false;
let isIncognito         = false;
let attachedFile        = null;   // { name, type, mimeType, data, previewSrc }
let currentSessionId    = null;
let conversationHistory = [];
let userLocationStr     = "";
let activeSessionTokens = 0;

// ── Session Storage ───────────────────────────────────────────────────────────
const SESSIONS_KEY = "novamind_sessions";
const MAX_SESSIONS = 60;

function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]"); }
  catch { return []; }
}

function setSessions(arr) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr.slice(0, MAX_SESSIONS))); }
  catch (e) { console.warn("Storage error:", e); }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function sanitizeHistory(history) {
  /* Strip base64 blobs before persisting to localStorage */
  return history.map(turn => ({
    ...turn,
    parts: turn.parts.map(p => p.inlineData ? { text: "[attached image]" } : p)
  }));
}

// ── Session Operations ────────────────────────────────────────────────────────
function createSession() {
  const s = { id: genId(), title: "New chat", timestamp: Date.now(), lastActive: Date.now(), history: [], displayMessages: [] };
  const all = [s, ...getSessions()];
  setSessions(all);
  return s;
}

function findSession(id) {
  return getSessions().find(s => s.id === id) || null;
}

function updateSession(id, patch) {
  const all = getSessions().map(s => s.id === id ? { ...s, ...patch } : s);
  setSessions(all);
}

function removeSession(id) {
  setSessions(getSessions().filter(s => s.id !== id));
}

function autoTitle(text) {
  if (!currentSessionId || isIncognito) return;
  const s = findSession(currentSessionId);
  if (s && s.title === "New chat") {
    updateSession(currentSessionId, { title: text.length > 46 ? text.slice(0, 46) + "…" : text });
    renderSessions();
  }
}

function persistMsg(msg) {
  if (isIncognito || !currentSessionId) return;
  const s = findSession(currentSessionId);
  if (!s) return;
  const msgs = [...(s.displayMessages || []), msg];
  updateSession(currentSessionId, {
    displayMessages: msgs,
    lastActive: Date.now(),
    history: sanitizeHistory(conversationHistory)
  });
}

function ensureSession() {
  if (!currentSessionId && !isIncognito) {
    const s = createSession();
    currentSessionId = s.id;
    renderSessions();
  }
}

// ── Session List Render ───────────────────────────────────────────────────────
function renderSessions(filter = "") {
  if (!sessionListEl) return;
  const all = getSessions();
  const q = filter.toLowerCase().trim();
  const list = q
    ? all.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.displayMessages || []).some(m => (m.text || "").toLowerCase().includes(q))
      )
    : all;

  if (list.length === 0) {
    sessionListEl.innerHTML = `<p class="no-sessions">${q ? "No matching chats" : "No history yet"}</p>`;
    return;
  }

  sessionListEl.innerHTML = list.map(s => `
    <div class="session-item${s.id === currentSessionId ? " active" : ""}" id="sess-${s.id}"
         onclick="loadSession('${s.id}')">
      <div class="session-info">
        <span class="session-title">${esc(s.title)}</span>
        <span class="session-time">${relTime(s.lastActive)}</span>
      </div>
      <button class="session-delete" onclick="event.stopPropagation();deleteSession('${s.id}')" title="Delete chat">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join("");
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ── Load Session ──────────────────────────────────────────────────────────────
function loadSession(id) {
  if (id === currentSessionId) return;

  if (isIncognito) { isIncognito = false; updateIncognitoUI(); }

  const s = findSession(id);
  if (!s) return;

  currentSessionId    = id;
  localStorage.setItem("novamind_last_session_id", id);
  conversationHistory = [...(s.history || [])];
  messageCount        = 0;
  sessionStart        = Date.now();

  // Reset & sum session tokens
  activeSessionTokens = 0;
  (s.displayMessages || []).forEach(m => {
    if (m.sender === "bot" && m.tokensMeta && m.tokensMeta.totalTokenCount) {
      activeSessionTokens += m.tokensMeta.totalTokenCount;
    }
  });
  updateQuotaUI();

  // Clear messages
  messagesEl.querySelectorAll(".message").forEach(m => m.remove());

  // Hide hero
  const hero = document.getElementById("copilot-hero");
  const sug  = document.getElementById("suggestion-cards");
  if (hero) hero.style.display = "none";
  if (sug)  sug.style.display  = "none";

  // Replay stored messages
  (s.displayMessages || []).forEach(m => replayMsg(m));

  renderSessions(searchInputEl ? searchInputEl.value : "");
  scrollToBottom();
}

function replayMsg(msg) {
  const isBot = msg.sender === "bot";
  const wrapper = document.createElement("div");
  wrapper.className = `message ${isBot ? "bot-message" : "user-message"}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${isBot ? "bot-avatar" : "user-avatar"}`;
  avatar.textContent = isBot ? "N" : "U";

  const bw = document.createElement("div");
  bw.className = "bubble-wrapper";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isBot ? "bot-bubble" : "user-bubble"}`;

  if (msg.hasFile) {
    const fc = document.createElement("div");
    fc.className = "msg-file-chip";
    fc.innerHTML = `📎 <span>${esc(msg.fileName || "file")}</span>`;
    bubble.appendChild(fc);
    if (msg.filePreviewSrc) {
      const img = document.createElement("img");
      img.src = msg.filePreviewSrc; img.className = "msg-image-preview";
      img.alt = msg.fileName || "image"; bubble.appendChild(img);
    }
  }

  if (isBot) {
    const d = document.createElement("div");
    d.innerHTML = markdownToHTML(msg.text || "");
    bubble.appendChild(d);
  } else {
    if (msg.text) {
      const span = document.createElement("span");
      span.textContent = msg.text;
      bubble.appendChild(span);
    }
  }

  bw.appendChild(bubble);
  if (isBot && msg.latencyMs !== undefined && !msg.error) {
    bw.appendChild(buildGeminiPanel(msg.latencyMs, msg.tokensMeta || {}, GEMINI_MODEL || ""));
  }

  const footer = document.createElement("div");
  footer.className = "message-footer";

  const ts = document.createElement("span");
  ts.className = "timestamp"; ts.textContent = msg.timestamp || "";
  footer.appendChild(ts);

  if (isBot && msg.text) {
    const speakBtn = document.createElement("button");
    speakBtn.className = "speak-btn";
    speakBtn.title = "Read aloud";
    speakBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    speakBtn.addEventListener("click", () => toggleSpeak(msg.text, speakBtn));
    footer.appendChild(speakBtn);
  }

  bw.appendChild(footer);

  if (isBot) { wrapper.appendChild(avatar); wrapper.appendChild(bw); }
  else        { wrapper.appendChild(bw); wrapper.appendChild(avatar); }

  messagesEl.appendChild(wrapper);
  messageCount++;
  msgCountEl.textContent = messageCount;
}

// ── Delete Session ────────────────────────────────────────────────────────────
function deleteSession(id) {
  removeSession(id);
  const lastSessId = localStorage.getItem("novamind_last_session_id");
  if (id === lastSessId) {
    localStorage.removeItem("novamind_last_session_id");
  }
  if (id === currentSessionId) startFreshChat();
  else renderSessions(searchInputEl ? searchInputEl.value : "");
}

// ── Start Fresh Chat ──────────────────────────────────────────────────────────
function startFreshChat() {
  messagesEl.querySelectorAll(".message").forEach(m => m.remove());
  conversationHistory = [];
  messageCount = 0;
  msgCountEl.textContent = 0;
  sessionStart = Date.now();
  currentSessionId = null;
  localStorage.removeItem("novamind_last_session_id");
  clearAttachedFile();
  activeSessionTokens = 0;
  updateQuotaUI();

  const hero = document.getElementById("copilot-hero");
  const sug  = document.getElementById("suggestion-cards");
  if (hero) hero.style.display = "";
  if (sug)  sug.style.display  = "";

  renderSessions(searchInputEl ? searchInputEl.value : "");
}

// ── Incognito Mode ────────────────────────────────────────────────────────────
function toggleIncognito() {
  isIncognito = !isIncognito;
  if (isIncognito) {
    // Clear everything for a private session
    messagesEl.querySelectorAll(".message").forEach(m => m.remove());
    conversationHistory = [];
    messageCount = 0;
    msgCountEl.textContent = 0;
    sessionStart = Date.now();
    currentSessionId = null;
    localStorage.removeItem("novamind_last_session_id");
    clearAttachedFile();
    activeSessionTokens = 0;
    updateQuotaUI();
    const hero = document.getElementById("copilot-hero");
    const sug  = document.getElementById("suggestion-cards");
    if (hero) hero.style.display = "";
    if (sug)  sug.style.display  = "";
  }
  updateIncognitoUI();
  renderSessions(searchInputEl ? searchInputEl.value : "");
}

function updateIncognitoUI() {
  const on = isIncognito;
  if (incognitoBanner)     incognitoBanner.classList.toggle("visible", on);
  if (incognitoHeaderBtn)  incognitoHeaderBtn.classList.toggle("active", on);
  if (incognitoSidebarBtn) incognitoSidebarBtn.classList.toggle("active", on);
  if (inputEl) inputEl.placeholder = on ? "Incognito — messages won't be saved…" : "Ask NovaMind anything…";
}

// ── File Attachment ───────────────────────────────────────────────────────────
const SUPPORTED_IMAGE_TYPES = ["image/jpeg","image/png","image/gif","image/webp"];

function handleFile(file) {
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { alert("File too large. Max size is 4MB."); return; }

  const isImg = file.type.startsWith("image/");
  if (isImg && !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    alert("Unsupported image format. Use JPEG, PNG, GIF, or WebP."); return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const result = e.target.result;
    if (isImg) {
      attachedFile = {
        name: file.name, type: "image",
        mimeType: file.type,
        data: result.split(",")[1],   // base64
        previewSrc: result            // data URL for display
      };
    } else {
      attachedFile = {
        name: file.name, type: "text",
        mimeType: "text/plain",
        data: result,                 // raw text
        previewSrc: null
      };
    }
    showFilePreview();
  };
  isImg ? reader.readAsDataURL(file) : reader.readAsText(file);
}

function showFilePreview() {
  if (!attachedFile || !filePreviewArea) return;
  filePreviewArea.style.display = "flex";
  if (fileChipNameEl) fileChipNameEl.textContent = attachedFile.name;
  sendBtn.disabled = isWaiting;
}

function clearAttachedFile() {
  attachedFile = null;
  if (filePreviewArea) filePreviewArea.style.display = "none";
  if (fileInputEl)     fileInputEl.value = "";
  sendBtn.disabled = !inputEl.value.trim() || isWaiting;
}

// ── Timer ─────────────────────────────────────────────────────────────────────
const getTime = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

setInterval(() => {
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  if (sessionTimeEl) sessionTimeEl.textContent =
    `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}, 1000);

// ── Model Discovery ───────────────────────────────────────────────────────────
async function discoverModel() {
  try {
    if (mlStatusText) mlStatusText.textContent = "Connecting…";
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot","ml-dot--loading"); }

    const res  = await fetch(`${BASE_URL}/models?key=${GEMINI_API_KEY}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

    const PREFER = ["flash","pro"];
    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/",""));

    models.sort((a,b) => {
      const ai = PREFER.findIndex(p => a.includes(p));
      const bi = PREFER.findIndex(p => b.includes(p));
      return (ai===-1?99:ai)-(bi===-1?99:bi);
    });

    if (!models.length) throw new Error("No generateContent models found.");

    GEMINI_MODEL    = models[0];
    GEMINI_ENDPOINT = `${BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    updateModelLabel();
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot","ml-dot--ready"); }
    return true;
  } catch (err) {
    console.error("Model discovery failed:", err.message);
    if (mlStatusText) mlStatusText.textContent = "Error";
    if (mlDot) { mlDot.className = ""; mlDot.classList.add("ml-dot","ml-dot--error"); }
    if (botStatusText) botStatusText.textContent = "API key error";
    return false;
  }
}

// ── Gemini API ────────────────────────────────────────────────────────────────
async function callGemini(text, imagePart = null) {
  if (!GEMINI_MODEL) throw new Error("No model. Please refresh.");

  const parts = [];
  if (imagePart) parts.push(imagePart);
  if (text)      parts.push({ text });
  if (!parts.length) parts.push({ text: "" });

  conversationHistory.push({ role: "user", parts });

  const selectedPersonaPrompt = PERSONA_PROMPTS[currentPersona] || PERSONA_PROMPTS.default;
  const fullSystemInstruction = selectedPersonaPrompt + IMAGE_GEN_RULES + userLocationStr;

  const body = {
    system_instruction: { parts: [{ text: fullSystemInstruction }] },
    contents: conversationHistory,
    generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
    safetySettings: [
      { category:"HARM_CATEGORY_HARASSMENT",       threshold:"BLOCK_MEDIUM_AND_ABOVE" },
      { category:"HARM_CATEGORY_HATE_SPEECH",      threshold:"BLOCK_MEDIUM_AND_ABOVE" },
      { category:"HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold:"BLOCK_MEDIUM_AND_ABOVE" },
      { category:"HARM_CATEGORY_DANGEROUS_CONTENT",threshold:"BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const t0  = performance.now();
  const res = await fetch(GEMINI_ENDPOINT, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data      = await res.json();
  const latencyMs = Math.round(performance.now() - t0);
  const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokensMeta= data?.usageMetadata || {};

  conversationHistory.push({ role: "model", parts: [{ text: replyText }] });

  return { replyText, latencyMs, tokensMeta };
}

// ── Markdown ──────────────────────────────────────────────────────────────────
function markdownToHTML(text) {
  let html = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Handle markdown images: ![alt](url)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="bot-generated-img" loading="lazy" />');
  
  // Handle markdown links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="bot-link">$1</a>');

  html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang ? lang.trim() : "code";
    return `<div class="code-block">
      <div class="code-header">
        <span class="code-lang">${language}</span>
        <button class="copy-code-btn" type="button" aria-label="Copy code">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span class="copy-text">Copy</span>
        </button>
      </div>
      <pre><code>${code.trim()}</code></pre>
    </div>`;
  });
  
  html = html.replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,     "<em>$1</em>");
  html = html.replace(/^### (.+)$/gm,   "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm,    "<h3>$1</h3>");
  html = html.replace(/^# (.+)$/gm,     "<h2>$1</h2>");
  html = html.replace(/^[\*\-] (.+)$/gm,"<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  html = html.replace(/\n\n/g,"</p><p>");
  html = html.replace(/\n/g,"<br/>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g,"");
  return html;
}

// ── Model Label ───────────────────────────────────────────────────────────────
function updateModelLabel() {
  if (botStatusText) botStatusText.textContent = "";
  if (mlStatusText)  mlStatusText.textContent  = "Ready";
}

// ── Gemini Info Panel ─────────────────────────────────────────────────────────
function buildGeminiPanel(latencyMs, tokensMeta, model) {
  const panel = document.createElement("div");
  panel.className = "ml-panel" + (showInfoPanel ? "" : " ml-panel--hidden");

  const pt = tokensMeta.promptTokenCount     ?? "—";
  const rt = tokensMeta.candidatesTokenCount ?? "—";
  const tt = tokensMeta.totalTokenCount      ?? "—";

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
      <div class="ml-stat"><span class="ml-stat-val">${pt}</span><span class="ml-stat-lbl">Input tok</span></div>
      <div class="ml-stat"><span class="ml-stat-val">${rt}</span><span class="ml-stat-lbl">Output tok</span></div>
      <div class="ml-stat"><span class="ml-stat-val">${tt}</span><span class="ml-stat-lbl">Total tok</span></div>
      <div class="ml-stat"><span class="ml-stat-val">${latencyMs}<small style="font-size:.55rem;font-weight:500">ms</small></span><span class="ml-stat-lbl">Latency</span></div>
    </div>`;
  return panel;
}

function buildErrorPanel(msg) {
  const p = document.createElement("div");
  p.className = "ml-panel";
  p.style.borderColor = "rgba(239,68,68,0.28)";
  p.innerHTML = `<p class="ml-note" style="color:#f87171">⚠️ ${msg}</p>`;
  return p;
}

// ── Message Renderer ──────────────────────────────────────────────────────────
function renderMessage(text, sender, { latencyMs, tokensMeta, error, fileInfo } = {}) {
  const isBot = sender === "bot";

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isBot ? "bot-message" : "user-message"}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${isBot ? "bot-avatar" : "user-avatar"}`;
  avatar.textContent = isBot ? "N" : "U";

  const bw = document.createElement("div");
  bw.className = "bubble-wrapper";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isBot ? "bot-bubble" : "user-bubble"}`;

  // File chip in user message
  if (fileInfo && !isBot) {
    const fc = document.createElement("div");
    fc.className = "msg-file-chip";
    fc.innerHTML = `📎 <span>${esc(fileInfo.name)}</span>`;
    bubble.appendChild(fc);
    if (fileInfo.type === "image" && fileInfo.previewSrc) {
      const img = document.createElement("img");
      img.src = fileInfo.previewSrc; img.className = "msg-image-preview";
      img.alt = fileInfo.name; bubble.appendChild(img);
    }
  }

  if (isBot) {
    const d = document.createElement("div");
    d.innerHTML = markdownToHTML(text); bubble.appendChild(d);
  } else {
    if (text) { const s = document.createElement("span"); s.textContent = text; bubble.appendChild(s); }
  }

  bw.appendChild(bubble);

  if (isBot) {
    if (error)                   bw.appendChild(buildErrorPanel(error));
    else if (latencyMs !== undefined) bw.appendChild(buildGeminiPanel(latencyMs, tokensMeta || {}, GEMINI_MODEL));
  }

  const footer = document.createElement("div");
  footer.className = "message-footer";

  const ts = document.createElement("span");
  ts.className = "timestamp"; ts.textContent = getTime();
  footer.appendChild(ts);

  if (isBot && !error && text) {
    const speakBtn = document.createElement("button");
    speakBtn.className = "speak-btn";
    speakBtn.title = "Read aloud";
    speakBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    speakBtn.addEventListener("click", () => toggleSpeak(text, speakBtn));
    footer.appendChild(speakBtn);
  }

  bw.appendChild(footer);

  if (isBot) { wrapper.appendChild(avatar); wrapper.appendChild(bw); }
  else        { wrapper.appendChild(bw); wrapper.appendChild(avatar); }

  messagesEl.appendChild(wrapper);
  scrollToBottom();
  messageCount++;
  msgCountEl.textContent = messageCount;
  return wrapper;
}

function scrollToBottom() { messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior:"smooth" }); }
function showTyping()     { typingEl.classList.add("visible"); scrollToBottom(); }
function hideTyping()     { typingEl.classList.remove("visible"); }

// ── Send Message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const text    = inputEl.value.trim();
  const hasFile = !!attachedFile;
  if (!text && !hasFile) return;
  if (isWaiting) return;

  // Ensure a session exists
  ensureSession();

  // Hide hero
  const hero = document.getElementById("copilot-hero");
  const sug  = document.getElementById("suggestion-cards");
  if (hero) hero.style.display = "none";
  if (sug)  sug.style.display  = "none";

  // Auto-title from first message
  autoTitle(text || (attachedFile?.name ?? "File conversation"));

  // Determine what to send to the API
  let imagePart    = null;
  let effectiveText= text;
  const fi         = attachedFile ? { ...attachedFile } : null;

  if (attachedFile) {
    if (attachedFile.type === "image") {
      imagePart = { inlineData: { data: attachedFile.data, mimeType: attachedFile.mimeType } };
    } else {
      // Inject text file content into the message
      const snippet = attachedFile.data.slice(0, 8000);
      effectiveText = `[File: ${attachedFile.name}]\n\`\`\`\n${snippet}\n\`\`\`\n\n${text}`;
    }
  }

  // Render user message
  renderMessage(text, "user", { fileInfo: fi });

  // Persist user message
  persistMsg({
    text, sender: "user", timestamp: getTime(),
    hasFile, fileName: fi?.name,
    filePreviewSrc: fi?.type === "image" ? fi.previewSrc : null
  });

  // Clear input
  inputEl.value = "";
  inputEl.style.height = "auto";
  clearAttachedFile();
  sendBtn.disabled = true;
  isWaiting = true;
  showTyping();

  try {
    recordRequest();
    const { replyText, latencyMs, tokensMeta } = await callGemini(effectiveText, imagePart);
    hideTyping();
    renderMessage(replyText, "bot", { latencyMs, tokensMeta });
    persistMsg({ text: replyText, sender: "bot", timestamp: getTime(), latencyMs, tokensMeta });
    
    if (tokensMeta && tokensMeta.totalTokenCount) {
      activeSessionTokens += tokensMeta.totalTokenCount;
      updateQuotaUI();
    }
  } catch (err) {
    hideTyping();
    conversationHistory.pop();
    renderMessage(
      "Sorry, I couldn't reach the Gemini API. Please check your connection and try again.",
      "bot", { error: err.message || "Unknown error" }
    );
  } finally {
    isWaiting = false;
    sendBtn.disabled = !inputEl.value.trim() && !attachedFile;
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  sendBtn.disabled = (!inputEl.value.trim() && !attachedFile) || isWaiting;
});

// Sidebar chips
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const msg = chip.dataset.msg;
    if (msg && !isWaiting) { inputEl.value = msg; sendBtn.disabled = false; sendMessage(); }
  });
});

// Suggestion cards
document.querySelectorAll(".suggestion-card").forEach(card => {
  card.addEventListener("click", () => {
    const msg = card.dataset.msg;
    if (msg && !isWaiting) { inputEl.value = msg; sendBtn.disabled = false; sendMessage(); }
  });
});

// New Chat
clearBtn.addEventListener("click", () => {
  if (isIncognito) {
    // Stay in incognito, just clear messages
    messagesEl.querySelectorAll(".message").forEach(m => m.remove());
    conversationHistory = [];
    messageCount = 0; msgCountEl.textContent = 0;
    sessionStart = Date.now(); currentSessionId = null;
    clearAttachedFile();
    const hero = document.getElementById("copilot-hero");
    const sug  = document.getElementById("suggestion-cards");
    if (hero) hero.style.display = "";
    if (sug)  sug.style.display  = "";
  } else {
    startFreshChat();
  }
});

// Theme
themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("dark", isDark);
});

// Info panel toggle
nlpToggleBtn.addEventListener("click", () => {
  showInfoPanel = !showInfoPanel;
  nlpToggleBtn.classList.toggle("active", showInfoPanel);
  document.querySelectorAll(".ml-panel").forEach(p =>
    p.classList.toggle("ml-panel--hidden", !showInfoPanel)
  );
});

// Incognito
[incognitoHeaderBtn, incognitoSidebarBtn].forEach(btn => {
  if (btn) btn.addEventListener("click", toggleIncognito);
});

// Search
if (searchInputEl) {
  searchInputEl.addEventListener("input", () => {
    const q = searchInputEl.value;
    renderSessions(q);
    if (searchClearBtn) searchClearBtn.classList.toggle("visible", q.length > 0);
  });
}
if (searchClearBtn) {
  searchClearBtn.addEventListener("click", () => {
    if (searchInputEl) searchInputEl.value = "";
    searchClearBtn.classList.remove("visible");
    renderSessions();
  });
}

// File attach
if (attachBtn)  attachBtn.addEventListener("click", () => fileInputEl && fileInputEl.click());
if (fileInputEl) fileInputEl.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
if (fileRemoveBtn) fileRemoveBtn.addEventListener("click", clearAttachedFile);

// Drag & drop
if (inputAreaInner) {
  inputAreaInner.addEventListener("dragover", e => { e.preventDefault(); inputAreaInner.classList.add("drag-over"); });
  inputAreaInner.addEventListener("dragleave",  () => inputAreaInner.classList.remove("drag-over"));
  inputAreaInner.addEventListener("drop", e => {
    e.preventDefault();
    inputAreaInner.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

// ── Geolocation ───────────────────────────────────────────────────────────────
function requestLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocationStr = `\n\nUser's current location: Latitude ${pos.coords.latitude}, Longitude ${pos.coords.longitude}.`;
      },
      err => console.warn("Location access denied or failed", err)
    );
  }
}

// ── Speech Recognition ────────────────────────────────────────────────────────
let isListening = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  
  recognition.onstart = () => {
    isListening = true;
    if (micBtn) micBtn.classList.add("listening");
    inputEl.placeholder = "Listening...";
  };
  
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    inputEl.value = transcript;
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    sendBtn.disabled = !inputEl.value.trim() && !attachedFile;
  };
  
  recognition.onend = () => {
    isListening = false;
    if (micBtn) micBtn.classList.remove("listening");
    inputEl.placeholder = "Ask NovaMind anything…";
  };
  
  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    isListening = false;
    if (micBtn) micBtn.classList.remove("listening");
    inputEl.placeholder = "Ask NovaMind anything…";
  };
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      inputEl.value = "";
      recognition.start();
    }
  });
}

// ── Persona Select Handling ──────────────────────────────────────────────────
const personaSelect = document.getElementById("persona-select");
if (personaSelect) {
  currentPersona = personaSelect.value;
  personaSelect.addEventListener("change", () => {
    currentPersona = personaSelect.value;
  });
}

// ── Share Chat Operations ────────────────────────────────────────────────────
const shareModal = document.getElementById("share-modal");
const shareModalClose = document.getElementById("share-modal-close");
const shareChatBtn = document.getElementById("share-chat-btn");
const shareLinkVal = document.getElementById("share-link-val");
const shareLinkCopyBtn = document.getElementById("share-link-copy-btn");

function getChatTranscript() {
  let transcript = "NovaMind Chat Transcript\n=======================\n\n";
  const messages = document.querySelectorAll(".message");
  if (messages.length === 0) return "No messages to share.";
  
  messages.forEach(msg => {
    const isBot = msg.classList.contains("bot-message");
    const name = isBot ? "NovaMind" : "User";
    
    let text = "";
    if (isBot) {
      const bubble = msg.querySelector(".bot-bubble");
      if (bubble) {
        const clone = bubble.cloneNode(true);
        const panel = clone.querySelector(".ml-panel");
        if (panel) panel.remove();
        text = clone.innerText;
      }
    } else {
      const bubble = msg.querySelector(".user-bubble");
      if (bubble) text = bubble.innerText;
    }
    
    const ts = msg.querySelector(".timestamp")?.textContent || "";
    if (text) {
      transcript += `[${ts}] ${name}: ${text.trim()}\n\n`;
    }
  });
  return transcript;
}

if (shareChatBtn) {
  shareChatBtn.addEventListener("click", () => {
    if (!shareModal) return;
    if (shareLinkVal) {
      shareLinkVal.value = window.location.href;
    }
    shareModal.classList.add("visible");
    const nativeOpt = document.getElementById("native-share-option");
    if (nativeOpt) {
      nativeOpt.style.display = navigator.share ? "flex" : "none";
    }
  });
}

if (shareModalClose) {
  shareModalClose.addEventListener("click", () => {
    shareModal.classList.remove("visible");
  });
}

if (shareModal) {
  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) {
      shareModal.classList.remove("visible");
    }
  });
}

if (shareLinkCopyBtn && shareLinkVal) {
  shareLinkCopyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(shareLinkVal.value).then(() => {
      const originalText = shareLinkCopyBtn.textContent;
      shareLinkCopyBtn.textContent = "Copied!";
      setTimeout(() => {
        shareLinkCopyBtn.textContent = originalText;
      }, 2000);
    });
  });
}

document.querySelectorAll(".share-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const platform = btn.dataset.platform;
    const url = window.location.href;
    const transcript = getChatTranscript();
    const shortText = `Check out my NovaMind AI chat transcript:\n\n${transcript.slice(0, 300)}...\n\nExplore NovaMind at: ${url}`;

    switch (platform) {
      case "whatsapp":
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shortText)}`, "_blank");
        break;
      case "instagram":
        navigator.clipboard.writeText(transcript).then(() => {
          alert("Chat transcript copied to clipboard! Opening Instagram so you can paste & share in DMs/Stories.");
          window.open("https://www.instagram.com/", "_blank");
        });
        break;
      case "email":
        window.open(`mailto:?subject=${encodeURIComponent("NovaMind Chat Transcript")}&body=${encodeURIComponent(transcript)}`, "_blank");
        break;
      case "link":
        navigator.clipboard.writeText(url).then(() => {
          const label = btn.querySelector(".share-label");
          const originalText = label.textContent;
          label.textContent = "Copied!";
          setTimeout(() => { label.textContent = originalText; }, 2000);
        });
        break;
      case "copytext":
        navigator.clipboard.writeText(transcript).then(() => {
          const label = btn.querySelector(".share-label");
          const originalText = label.textContent;
          label.textContent = "Copied!";
          setTimeout(() => { label.textContent = originalText; }, 2000);
        });
        break;
      case "native":
        if (navigator.share) {
          navigator.share({
            title: "NovaMind Chat Transcript",
            text: transcript.slice(0, 1000),
            url: url
          }).catch(console.error);
        }
        break;
    }
  });
});

// ── Copy Code Delegation ──────────────────────────────────────────────────────
document.addEventListener("click", e => {
  const btn = e.target.closest(".copy-code-btn");
  if (btn) {
    const codeBlock = btn.closest(".code-block");
    if (codeBlock) {
      const codeEl = codeBlock.querySelector("pre code");
      if (codeEl) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = codeEl.innerHTML;
        const textToCopy = textarea.value;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          const textSpan = btn.querySelector(".copy-text");
          const originalText = textSpan.textContent;
          textSpan.textContent = "Copied!";
          btn.classList.add("copied");
          
          setTimeout(() => {
            textSpan.textContent = originalText;
            btn.classList.remove("copied");
          }, 2000);
        }).catch(err => {
          console.error("Clipboard copy failed:", err);
        });
      }
    }
  }
});

// ── Quota & Token Tracker Logic ──────────────────────────────────────────────
let dailyRequestCount = 0;
let requestTimestamps = [];

function initQuotaTracker() {
  const todayStr = new Date().toDateString();
  const storedDate = localStorage.getItem("novamind_quota_date");
  
  if (storedDate !== todayStr) {
    localStorage.setItem("novamind_quota_date", todayStr);
    localStorage.setItem("novamind_quota_rpd", "0");
    dailyRequestCount = 0;
  } else {
    dailyRequestCount = parseInt(localStorage.getItem("novamind_quota_rpd") || "0", 10);
  }

  // Load RPM timestamps from sessionStorage so page refresh doesn't reset them
  try {
    const storedTimestamps = sessionStorage.getItem("novamind_quota_rpm_timestamps");
    if (storedTimestamps) {
      requestTimestamps = JSON.parse(storedTimestamps).map(Number);
    }
  } catch (e) {
    requestTimestamps = [];
  }

  updateQuotaUI();
}

function recordRequest() {
  const now = Date.now();
  dailyRequestCount++;
  localStorage.setItem("novamind_quota_rpd", dailyRequestCount.toString());
  
  requestTimestamps.push(now);
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 60000);

  // Save RPM timestamps to sessionStorage
  try {
    sessionStorage.setItem("novamind_quota_rpm_timestamps", JSON.stringify(requestTimestamps));
  } catch (e) {}
  
  updateQuotaUI();
}

function updateQuotaUI() {
  const rpmEl = document.getElementById("quota-rpm");
  const rpdEl = document.getElementById("quota-rpd");
  const tokEl = document.getElementById("quota-tokens");
  
  const now = Date.now();
  const originalLen = requestTimestamps.length;
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 60000);

  // If timestamps expired, update sessionStorage
  if (requestTimestamps.length !== originalLen) {
    try {
      sessionStorage.setItem("novamind_quota_rpm_timestamps", JSON.stringify(requestTimestamps));
    } catch (e) {}
  }
  
  if (rpmEl) {
    rpmEl.textContent = `${requestTimestamps.length}/15`;
  }
  
  if (rpdEl) {
    rpdEl.textContent = `${dailyRequestCount}/1.5k`;
  }
  
  if (tokEl) {
    tokEl.textContent = formatTokenCount(activeSessionTokens);
  }
}

function formatTokenCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

// Periodically update the RPM UI so it decays back to 0
setInterval(updateQuotaUI, 15000);

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  inputEl.focus();
  inputEl.disabled = true;
  sendBtn.disabled = true;
  inputEl.placeholder = "Connecting to Gemini…";

  // Initialize Quota tracker state
  initQuotaTracker();

  // Render saved sessions
  renderSessions();
  updateIncognitoUI();
  if (incognitoBanner) incognitoBanner.classList.remove("visible");
  if (filePreviewArea) filePreviewArea.style.display = "none";

  // Load last active session if exists
  const lastSessId = localStorage.getItem("novamind_last_session_id");
  if (lastSessId) {
    loadSession(lastSessId);
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered successfully!', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  const ok = await discoverModel();

  inputEl.disabled    = false;
  inputEl.placeholder = "Ask NovaMind anything…";
  sendBtn.disabled    = true;

  if (ok) console.log(`🚀 NovaMind ready — model: ${GEMINI_MODEL}`);

  // Request location seamlessly
  requestLocation();
});
