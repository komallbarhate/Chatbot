# NovaMind — AI Chatbot

<div align="center">
  <img src="https://img.shields.io/badge/Powered%20by-Gemini%20AI-black?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI"/>
  <img src="https://img.shields.io/badge/Design-Black%20%26%20White-111111?style=for-the-badge" alt="Design"/>
  <img src="https://img.shields.io/badge/Built%20with-HTML%20%7C%20CSS%20%7C%20JS-white?style=for-the-badge" alt="Stack"/>
</div>

<br/>

> A sleek, minimal AI chatbot powered by the **Google Gemini API** — featuring a premium black & white UI, real-time streaming, multi-turn conversation memory, and markdown rendering.

---

## ✨ Features

- 🤖 **Gemini AI** — Uses Google's latest Gemini model via REST API
- 💬 **Multi-turn memory** — Full conversation history sent with every request
- 📝 **Markdown rendering** — Bold, italic, code blocks, lists, headings
- 🎨 **Black & White UI** — Premium Antigravity-inspired dark design
- ⚡ **Token & latency stats** — Live input/output token counts and response time
- 🔀 **Auto model discovery** — Automatically picks the best available Gemini model for your API key
- 🌓 **Theme toggle** — Switch between dark variants
- 💡 **Suggestion cards** — Quick-start prompts on the home screen
- 📱 **Responsive** — Works on desktop and mobile

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/novamind-chatbot.git
cd novamind-chatbot
```

### 2. Add your Gemini API key

Open `chatbot.js` and replace the API key on line 9:

```js
const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
```

Get a free key at → [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 3. Open in browser

Just open `index.html` directly in your browser — **no build step, no server needed**.

```
open index.html
```

---

## 🗂️ Project Structure

```
novamind-chatbot/
├── index.html      # App structure & layout
├── style.css       # Black & white Antigravity UI
├── chatbot.js      # Gemini API logic, markdown, message rendering
└── README.md
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | Vanilla CSS (custom design system) |
| Logic | Vanilla JavaScript (ES6+) |
| AI | Google Gemini API (REST) |
| Fonts | Inter — Google Fonts |

---

## 📡 API Limits (Free Tier)

| Limit | Value |
|---|---|
| Requests per minute | 15 RPM |
| Requests per day | 1,500 / day |
| Context window | ~1M tokens |

---

## 🖼️ UI Highlights

- Deep black background (`#0a0a0a`) with layered dark surfaces
- Pure white send button, bot avatar, and user message bubbles
- Monochrome `N` logo mark with subtle white glow
- Sharp borders using `rgba(255,255,255,0.08)`
- Smooth fade-slide animations on every message
- Monospace code blocks with language labels

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">Made with ♥ by Komal</div>
