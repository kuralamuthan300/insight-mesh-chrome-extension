# ◈ InsightMesh

**An intelligent research companion for Chrome.**

InsightMesh lets you clip snippets from any website, organize them into **Folders → Topics**, and use **Gemini AI** to synthesize your scattered notes into a structured learning roadmap.

---

## ✨ Features

| Feature | Description |
|---|---|
| **📌 Contextual Clipping** | Right-click any selected text and choose "Add to InsightMesh" to clip it |
| **📁 Folder → Topic → Snippet** | Organize research into nested folders and topics |
| **✦ AI Synthesis** | One click to have Gemini organize your notes, summarize what you've learned, identify gaps, and suggest next steps |
| **🌙 Dark Glassmorphic UI** | Clean, minimal side panel with a premium feel |
| **⚡ Manual Entry** | Paste or type snippets directly into any topic |

---

## 🚀 Installation

1. **Get a Gemini API Key** (free):
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create and copy your API key

2. **Set your API Key** in `.env`:
   ```
   GEMINI_API_KEY=paste_your_actual_key_here
   ```

3. **Build `config.js`** from your `.env`:
   ```bash
   node build.js
   ```

4. **Load the Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right corner)
   - Click **"Load unpacked"**
   - Select **this project folder** (`smart-notes-with-gemini`)

> You can also set/change your API key later from the **⚙ Settings** icon inside the extension.

---

## 📖 How to Use

### 1. Create a Folder
Open the side panel → Click **"+ New Folder"** → Name it (e.g., "AI Research")

### 2. Create a Topic
Navigate into your folder → Click **"+ New Topic"** → Name it (e.g., "Transformer Architecture")

### 3. Clip Text from the Web
- **Right-click method**: Select text on any webpage → Right-click → Choose **"📌 Add to InsightMesh"**
- **Manual method**: Open a topic → Paste text into the textarea → Click **"Add Snippet"**

### 4. Synthesize with AI
Once you have a few snippets in a topic, click **"✦ Synthesize"**. Gemini will:
- 📋 **Organize** your notes into a logical flow
- 📝 **Summarize** what you've learned
- 🔍 **Identify gaps** in your knowledge
- 🧭 **Suggest next steps** and search queries

---

## 🗂 Project Structure

```
smart-notes-with-gemini/
├── manifest.json        # Chrome Extension Manifest V3
├── background.js        # Service worker (context menu, side panel control)
├── build.js             # Reads .env → generates config.js
├── config.js            # Auto-generated (git-ignored)
├── .env                 # Your API key (git-ignored)
├── sidepanel.html       # Side panel UI structure
├── sidepanel.css        # Dark glassmorphic styles
├── sidepanel.js         # State management, rendering, Gemini integration
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── readme.md
```

---

## ⚙️ Configuration

### Option A — `.env` file (recommended)
Edit `.env` and run the build script:
```bash
# .env
GEMINI_API_KEY=your_actual_key_here

# Then:
node build.js
```

### Option B — Settings UI
Click the **⚙** gear icon inside the extension's side panel and paste your key directly.

---

## 📄 License

MIT
