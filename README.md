# NovaMind — AI Chatbot

<div align="center">
  <img src="https://img.shields.io/badge/Live-aawaraa.netlify.app-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Live Deployment"/>
  <img src="https://img.shields.io/badge/Powered%20by-Gemini%20AI-black?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI"/>
  <img src="https://img.shields.io/badge/Design-Black%20%26%20White-111111?style=for-the-badge" alt="Design"/>
  <img src="https://img.shields.io/badge/Built%20with-HTML%20%7C%20CSS%20%7C%20JS-white?style=for-the-badge" alt="Stack"/>
</div>

<br/>

> A sleek, premium AI chatbot powered by the **Google Gemini API** — featuring a beautiful black & white design system, dynamic API key load-balancing, a complete authentication overlay, Progressive Web App (PWA) offline support, text-to-speech, code copying, and rich media generation.

🌐 **Live Website**: [https://aawaraa.netlify.app/](https://aawaraa.netlify.app/)

---

## ✨ Features

* 🔐 **Authentication Overlay Lockout**: The interface is fully locked until users sign up, log in, or choose to enter via the **Guest Profile**.
* 🗂️ **Isolated Session Histories**: Logged-in accounts have conversations securely stored and loaded under `novamind_sessions_${email}`, while guest users run isolated sessions under `novamind_sessions_guest`.
* 🔑 **Zero-Config Key Entry for Users**: Users start chatting immediately without needing to configure or supply their own API keys.
* 🔀 **API Key Load Balancing & Rotation**: Rotates requests randomly across multiple developer-configured Gemini keys in `config.js` to multiply rate limits (3 keys scale the limit to **45 RPM** and **4,500 RPD**).
* 🛡️ **Demo Token Quota**: Imposes a strict, browser-persisted 4,500 token limit on demo chats to prevent key abuse, displayed dynamically in the sidebar.
* 📧 **Gmail OTP Reset Simulation**: Support for forgotten passwords. Triggers a random 6-digit OTP code, popped up on-screen in a simulated Gmail notification window.
* 🗣️ **Text-to-Speech (TTS)**: Built-in speaker buttons on bot messages, powered by the Web Speech API. Removes markdown markup for smooth, clean read-aloud playback.
* 📋 **Code Copying**: Renders code fences with headers containing the language name and a click-to-copy utility.
* 📢 **Conversation Sharing**: Modal triggers to export chat transcript logs directly to WhatsApp, Instagram, Email, or via the Native Mobile Share API.
* 🎨 **Image Generation**: Detects image generation intent (e.g., *"draw/create a picture"*) and outputs beautifully formatted images rendered via Pollinations.ai.
* 📍 **Smart On-Demand Location**: Queries browser geolocation permission only when the chat context specifically demands it (e.g. weather, nearby places).
* 📱 **Progressive Web App (PWA)**: Installable application shell with cache-first service worker rules for fast offline loading.

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/komallbarhate/novamind-chatbot.git
cd novamind-chatbot
```

### 2. Configure API Keys
Copy `config.example.js` to create `config.js`:
```bash
cp config.example.js config.js
```
Open `config.js` and add one or more Gemini API keys:
```javascript
const GEMINI_API_KEYS = [
  "YOUR_GEMINI_API_KEY_1",
  "YOUR_GEMINI_API_KEY_2"
];
const GEMINI_API_KEY = GEMINI_API_KEYS[0];
```
*(Get keys at → [Google AI Studio](https://aistudio.google.com/app/apikey))*

### 3. Run Locally
Simply open `index.html` in any browser or launch a local preview server:
```bash
# Using python simple server
python -m http.server 8000
```

---

## 🗂️ Project Structure

```
novamind-chatbot/
├── index.html        # Locking login overlays, notifications & chat shell
├── style.css         # Dark monochrome design system
├── chatbot.js        # Auth controllers, dynamic history loading, and rotation
├── config.js         # Secret key container (gitignored)
├── config.example.js # Template configuration file
├── manifest.json     # PWA setup metadata
├── sw.js             # Service worker caches
└── icon.svg          # High-resolution vector logo
```

---

## 📡 API Limits (With 3 Rotating Keys)

| Metric | Single Key | 3 Rotating Keys |
|---|---|---|
| Requests Per Minute | 15 RPM | **45 RPM** |
| Requests Per Day | 1,500 RPD | **4,500 RPD** |
| Max Token Limit | 1,500 tokens / client | **4,500 tokens / client** |

---

<div align="center">Made with ♥ by Komal</div>
