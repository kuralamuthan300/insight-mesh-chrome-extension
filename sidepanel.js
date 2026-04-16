// ============================================================
// InsightMesh — Side Panel Logic
// ============================================================
// State management (Folders → Topics → Snippets),
// Gemini API integration, and UI rendering.
// ============================================================

(() => {
  "use strict";

  // ── Storage Keys ──
  const STORAGE_KEY = "insightmesh_data";
  const API_KEY_STORAGE = "insightmesh_api_key";

  // ── State ──
  let state = {
    folders: [],       // [{ id, name, topics: [{ id, name, snippets: [{ id, text, sourceUrl, sourceTitle, timestamp }] }] }]
    currentFolderId: null,
    currentTopicId: null,
  };
  let apiKey = "";

  // ── DOM Refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Settings
    settingsBtn: $("#settings-btn"),
    settingsModal: $("#settings-modal"),
    apiKeyInput: $("#api-key-input"),
    saveApiKey: $("#save-api-key"),
    closeSettings: $("#close-settings"),

    // Pending Snippet
    pendingBanner: $("#pending-snippet-banner"),
    pendingPreview: $("#pending-snippet-preview"),
    pendingFolderSelect: $("#pending-folder-select"),
    pendingTopicSelect: $("#pending-topic-select"),
    savePendingSnippet: $("#save-pending-snippet"),
    dismissPendingSnippet: $("#dismiss-pending-snippet"),

    // Breadcrumb
    breadcrumb: $("#breadcrumb"),

    // Folders
    foldersView: $("#folders-view"),
    foldersList: $("#folders-list"),
    foldersEmpty: $("#folders-empty"),
    addFolderBtn: $("#add-folder-btn"),
    addFolderForm: $("#add-folder-form"),
    newFolderName: $("#new-folder-name"),
    confirmAddFolder: $("#confirm-add-folder"),
    cancelAddFolder: $("#cancel-add-folder"),

    // Topics
    topicsView: $("#topics-view"),
    topicsViewTitle: $("#topics-view-title"),
    topicsList: $("#topics-list"),
    topicsEmpty: $("#topics-empty"),
    addTopicBtn: $("#add-topic-btn"),
    addTopicForm: $("#add-topic-form"),
    newTopicName: $("#new-topic-name"),
    confirmAddTopic: $("#confirm-add-topic"),
    cancelAddTopic: $("#cancel-add-topic"),

    // Snippets
    snippetsView: $("#snippets-view"),
    snippetsViewTitle: $("#snippets-view-title"),
    snippetsList: $("#snippets-list"),
    snippetsEmpty: $("#snippets-empty"),
    manualSnippetInput: $("#manual-snippet-input"),
    addManualSnippet: $("#add-manual-snippet"),
    synthesizeBtn: $("#synthesize-btn"),

    // Synthesis
    synthesisResult: $("#synthesis-result"),
    synthesisContent: $("#synthesis-content"),
    closeSynthesis: $("#close-synthesis"),
    synthesisLoading: $("#synthesis-loading"),
  };

  // ============================================================
  // PERSISTENCE
  // ============================================================
  async function loadState() {
    const result = await chrome.storage.local.get([STORAGE_KEY, API_KEY_STORAGE]);
    if (result[STORAGE_KEY]) {
      state.folders = result[STORAGE_KEY].folders || [];
    }
    apiKey = result[API_KEY_STORAGE] || "";
  }

  async function saveState() {
    await chrome.storage.local.set({
      [STORAGE_KEY]: { folders: state.folders },
    });
  }

  async function saveApiKeyToStorage(key) {
    apiKey = key;
    await chrome.storage.local.set({ [API_KEY_STORAGE]: key });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function genId() {
    return crypto.randomUUID();
  }

  function getFolder(folderId) {
    return state.folders.find((f) => f.id === folderId);
  }

  function getTopic(folderId, topicId) {
    const folder = getFolder(folderId);
    return folder?.topics.find((t) => t.id === topicId);
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function showToast(message, type = "success") {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Simple Markdown → HTML (for synthesis output)
  function renderMarkdown(md) {
    let html = escapeHtml(md);
    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Inline code
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");
    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, "");
    // Clean up paragraphs wrapping block elements
    html = html.replace(/<p>(<h[1-3]>)/g, "$1");
    html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
    html = html.replace(/<p>(<ul>)/g, "$1");
    html = html.replace(/(<\/ul>)<\/p>/g, "$1");
    html = html.replace(/<p>(<blockquote>)/g, "$1");
    html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
    return html;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function navigateTo(view, folderId = null, topicId = null) {
    state.currentFolderId = folderId;
    state.currentTopicId = topicId;

    dom.foldersView.classList.add("hidden");
    dom.topicsView.classList.add("hidden");
    dom.snippetsView.classList.add("hidden");

    // Reset forms
    dom.addFolderForm.classList.add("hidden");
    dom.addTopicForm.classList.add("hidden");

    if (view === "folders") {
      dom.foldersView.classList.remove("hidden");
      renderFolders();
      renderBreadcrumb();
    } else if (view === "topics") {
      dom.topicsView.classList.remove("hidden");
      renderTopics();
      renderBreadcrumb();
    } else if (view === "snippets") {
      dom.snippetsView.classList.remove("hidden");
      renderSnippets();
      renderBreadcrumb();
    }
  }

  function renderBreadcrumb() {
    let html = `<button class="breadcrumb-item ${!state.currentFolderId ? "active" : ""}" data-view="folders">All Folders</button>`;

    if (state.currentFolderId) {
      const folder = getFolder(state.currentFolderId);
      if (folder) {
        html += `<span class="breadcrumb-sep">›</span>`;
        html += `<button class="breadcrumb-item ${!state.currentTopicId ? "active" : ""}" data-view="topics" data-folder-id="${folder.id}">${escapeHtml(folder.name)}</button>`;
      }
    }

    if (state.currentTopicId && state.currentFolderId) {
      const topic = getTopic(state.currentFolderId, state.currentTopicId);
      if (topic) {
        html += `<span class="breadcrumb-sep">›</span>`;
        html += `<button class="breadcrumb-item active" data-view="snippets" data-folder-id="${state.currentFolderId}" data-topic-id="${topic.id}">${escapeHtml(topic.name)}</button>`;
      }
    }

    dom.breadcrumb.innerHTML = html;

    // Attach click listeners
    dom.breadcrumb.querySelectorAll(".breadcrumb-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        const fId = btn.dataset.folderId || null;
        const tId = btn.dataset.topicId || null;
        navigateTo(view, fId, tId);
      });
    });
  }

  // ============================================================
  // RENDER — FOLDERS
  // ============================================================
  function renderFolders() {
    if (state.folders.length === 0) {
      dom.foldersList.innerHTML = "";
      dom.foldersEmpty.classList.remove("hidden");
      return;
    }

    dom.foldersEmpty.classList.add("hidden");
    dom.foldersList.innerHTML = state.folders
      .map((folder) => {
        const topicCount = folder.topics.length;
        const snippetCount = folder.topics.reduce((sum, t) => sum + t.snippets.length, 0);
        return `
          <div class="card-item" data-folder-id="${folder.id}">
            <div class="card-item-left">
              <div class="card-icon folder-icon">📁</div>
              <div>
                <div class="card-name">${escapeHtml(folder.name)}</div>
                <div class="card-meta">${topicCount} topic${topicCount !== 1 ? "s" : ""} · ${snippetCount} clip${snippetCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div class="card-item-right">
              <button class="btn-danger-ghost delete-folder-btn" data-folder-id="${folder.id}" title="Delete folder">✕</button>
              <span class="card-chevron">›</span>
            </div>
          </div>
        `;
      })
      .join("");

    // Click to open folder
    dom.foldersList.querySelectorAll(".card-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".delete-folder-btn")) return;
        navigateTo("topics", el.dataset.folderId);
      });
    });

    // Delete folder
    dom.foldersList.querySelectorAll(".delete-folder-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.folderId;
        const folder = getFolder(folderId);
        if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
          state.folders = state.folders.filter((f) => f.id !== folderId);
          await saveState();
          renderFolders();
          showToast("Folder deleted");
        }
      });
    });
  }

  // ============================================================
  // RENDER — TOPICS
  // ============================================================
  function renderTopics() {
    const folder = getFolder(state.currentFolderId);
    if (!folder) return navigateTo("folders");

    dom.topicsViewTitle.textContent = folder.name;

    if (folder.topics.length === 0) {
      dom.topicsList.innerHTML = "";
      dom.topicsEmpty.classList.remove("hidden");
      return;
    }

    dom.topicsEmpty.classList.add("hidden");
    dom.topicsList.innerHTML = folder.topics
      .map((topic) => {
        const count = topic.snippets.length;
        const lastActive = topic.snippets.length
          ? timeAgo(Math.max(...topic.snippets.map((s) => s.timestamp)))
          : "No clips";
        return `
          <div class="card-item" data-topic-id="${topic.id}">
            <div class="card-item-left">
              <div class="card-icon topic-icon">◈</div>
              <div>
                <div class="card-name">${escapeHtml(topic.name)}</div>
                <div class="card-meta">${count} clip${count !== 1 ? "s" : ""} · ${lastActive}</div>
              </div>
            </div>
            <div class="card-item-right">
              <button class="btn-danger-ghost delete-topic-btn" data-topic-id="${topic.id}" title="Delete topic">✕</button>
              <span class="card-chevron">›</span>
            </div>
          </div>
        `;
      })
      .join("");

    // Click to open topic
    dom.topicsList.querySelectorAll(".card-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".delete-topic-btn")) return;
        navigateTo("snippets", state.currentFolderId, el.dataset.topicId);
      });
    });

    // Delete topic
    dom.topicsList.querySelectorAll(".delete-topic-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const topicId = btn.dataset.topicId;
        const topic = getTopic(state.currentFolderId, topicId);
        if (confirm(`Delete topic "${topic.name}" and all its snippets?`)) {
          folder.topics = folder.topics.filter((t) => t.id !== topicId);
          await saveState();
          renderTopics();
          showToast("Topic deleted");
        }
      });
    });
  }

  // ============================================================
  // RENDER — SNIPPETS
  // ============================================================
  function renderSnippets() {
    const topic = getTopic(state.currentFolderId, state.currentTopicId);
    if (!topic) return navigateTo("topics", state.currentFolderId);

    dom.snippetsViewTitle.textContent = topic.name;

    // Toggle synthesize button based on snippet count
    dom.synthesizeBtn.disabled = topic.snippets.length === 0;

    if (topic.snippets.length === 0) {
      dom.snippetsList.innerHTML = "";
      dom.snippetsEmpty.classList.remove("hidden");
      return;
    }

    dom.snippetsEmpty.classList.add("hidden");

    // Sort newest first
    const sorted = [...topic.snippets].sort((a, b) => b.timestamp - a.timestamp);

    dom.snippetsList.innerHTML = sorted
      .map((snippet) => {
        const sourceDisplay = snippet.sourceTitle !== "Unknown"
          ? snippet.sourceTitle
          : snippet.sourceUrl !== "Unknown"
            ? new URL(snippet.sourceUrl).hostname
            : "Manual entry";
        const sourceLink = snippet.sourceUrl !== "Unknown" && snippet.sourceUrl !== "Manual"
          ? `<a href="${escapeHtml(snippet.sourceUrl)}" target="_blank" title="${escapeHtml(snippet.sourceUrl)}">${escapeHtml(sourceDisplay)}</a>`
          : escapeHtml(sourceDisplay);

        return `
          <div class="snippet-card" data-snippet-id="${snippet.id}">
            <div class="snippet-text">${escapeHtml(snippet.text)}</div>
            <div class="snippet-footer">
              <span class="snippet-source">${sourceLink}</span>
              <span class="snippet-time">${timeAgo(snippet.timestamp)}</span>
              <button class="btn-danger-ghost snippet-delete delete-snippet-btn" data-snippet-id="${snippet.id}" title="Delete">✕</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Delete snippet
    dom.snippetsList.querySelectorAll(".delete-snippet-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const snippetId = btn.dataset.snippetId;
        topic.snippets = topic.snippets.filter((s) => s.id !== snippetId);
        await saveState();
        renderSnippets();
        showToast("Snippet removed");
      });
    });
  }

  // ============================================================
  // PENDING SNIPPET (from context menu)
  // ============================================================
  let currentPendingSnippet = null;

  async function checkPendingSnippet() {
    const result = await chrome.storage.local.get("pendingSnippet");
    if (result.pendingSnippet) {
      showPendingSnippet(result.pendingSnippet);
      await chrome.storage.local.remove("pendingSnippet");
    }
  }

  function showPendingSnippet(snippet) {
    currentPendingSnippet = snippet;
    dom.pendingPreview.textContent =
      snippet.text.length > 150 ? snippet.text.substring(0, 150) + "…" : snippet.text;
    populatePendingSelects();
    dom.pendingBanner.classList.remove("hidden");
  }

  function populatePendingSelects() {
    // Populate folder select
    dom.pendingFolderSelect.innerHTML = `<option value="">Select Folder…</option>` +
      state.folders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");

    dom.pendingTopicSelect.innerHTML = `<option value="">Select Topic…</option>`;

    dom.pendingFolderSelect.onchange = () => {
      const folderId = dom.pendingFolderSelect.value;
      const folder = getFolder(folderId);
      if (folder) {
        dom.pendingTopicSelect.innerHTML = `<option value="">Select Topic…</option>` +
          folder.topics.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
      } else {
        dom.pendingTopicSelect.innerHTML = `<option value="">Select Topic…</option>`;
      }
    };
  }

  // ============================================================
  // GEMINI API
  // ============================================================
  async function synthesizeTopic(topicName, snippets) {
    // Priority: 1) config.js key (from .env), 2) Settings UI key (chrome.storage)
    const key = (typeof GEMINI_API_KEY !== "undefined" && GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_API_KEY_HERE")
      ? GEMINI_API_KEY
      : apiKey;

    console.log("[InsightMesh] Using API key source:", 
      (typeof GEMINI_API_KEY !== "undefined" && GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_API_KEY_HERE") 
        ? "config.js (.env)" 
        : "Settings UI (chrome.storage)");
    console.log("[InsightMesh] Key prefix:", key ? key.substring(0, 8) + "…" : "EMPTY");

    if (!key || key === "YOUR_API_KEY_HERE") {
      showToast("Please set your Gemini API key in Settings", "error");
      dom.settingsModal.classList.remove("hidden");
      return null;
    }

    // Warn if key doesn't look like a Gemini API key
    if (!key.startsWith("AIza")) {
      console.warn("[InsightMesh] Warning: API key doesn't start with 'AIza'. Make sure you're using a Gemini API key from https://aistudio.google.com/app/apikey");
    }

    const snippetTexts = snippets.map((s, i) => `[Snippet ${i + 1} — from ${s.sourceTitle || s.sourceUrl}]\n${s.text}`).join("\n\n---\n\n");

    const prompt = `I have collected the following unorganized notes while researching the topic: "${topicName}".

Here are my collected snippets:

${snippetTexts}

Please do the following:
1. **Organize** these notes into a logical, narrative flow — grouping related concepts together.
2. **Summarize** what I have learned so far in a clear, concise overview.
3. **Identify knowledge gaps** — what important aspects of "${topicName}" are missing from my notes?
4. **Suggest the next 3-5 specific research steps** or search queries I should pursue to deepen my understanding.

Format your response in Markdown with clear headings.`;

    const model = (typeof GEMINI_MODEL !== "undefined" && GEMINI_MODEL) ? GEMINI_MODEL : "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    console.log("[InsightMesh] Calling:", url.replace(key, "***"));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `API error: ${response.status}`;
      console.error("[InsightMesh] API Error:", response.status, errorData);
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API key. Get a valid key at aistudio.google.com/app/apikey (it should start with 'AIza')");
      }
      throw new Error(msg);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  function bindEvents() {
    // --- Settings ---
    dom.settingsBtn.addEventListener("click", () => {
      dom.apiKeyInput.value = apiKey;
      dom.settingsModal.classList.remove("hidden");
    });
    dom.closeSettings.addEventListener("click", () => {
      dom.settingsModal.classList.add("hidden");
    });
    dom.settingsModal.querySelector(".modal-backdrop").addEventListener("click", () => {
      dom.settingsModal.classList.add("hidden");
    });
    dom.saveApiKey.addEventListener("click", async () => {
      const key = dom.apiKeyInput.value.trim();
      if (key) {
        await saveApiKeyToStorage(key);
        dom.settingsModal.classList.add("hidden");
        showToast("API key saved");
      }
    });

    // --- Add Folder ---
    dom.addFolderBtn.addEventListener("click", () => {
      dom.addFolderForm.classList.remove("hidden");
      dom.newFolderName.focus();
    });
    dom.cancelAddFolder.addEventListener("click", () => {
      dom.addFolderForm.classList.add("hidden");
      dom.newFolderName.value = "";
    });
    dom.confirmAddFolder.addEventListener("click", async () => {
      const name = dom.newFolderName.value.trim();
      if (!name) return;
      state.folders.push({ id: genId(), name, topics: [] });
      await saveState();
      dom.newFolderName.value = "";
      dom.addFolderForm.classList.add("hidden");
      renderFolders();
      showToast(`Folder "${name}" created`);
    });
    dom.newFolderName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") dom.confirmAddFolder.click();
      if (e.key === "Escape") dom.cancelAddFolder.click();
    });

    // --- Add Topic ---
    dom.addTopicBtn.addEventListener("click", () => {
      dom.addTopicForm.classList.remove("hidden");
      dom.newTopicName.focus();
    });
    dom.cancelAddTopic.addEventListener("click", () => {
      dom.addTopicForm.classList.add("hidden");
      dom.newTopicName.value = "";
    });
    dom.confirmAddTopic.addEventListener("click", async () => {
      const name = dom.newTopicName.value.trim();
      if (!name) return;
      const folder = getFolder(state.currentFolderId);
      if (!folder) return;
      folder.topics.push({ id: genId(), name, snippets: [] });
      await saveState();
      dom.newTopicName.value = "";
      dom.addTopicForm.classList.add("hidden");
      renderTopics();
      showToast(`Topic "${name}" created`);
    });
    dom.newTopicName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") dom.confirmAddTopic.click();
      if (e.key === "Escape") dom.cancelAddTopic.click();
    });

    // --- Manual Snippet ---
    dom.addManualSnippet.addEventListener("click", async () => {
      const text = dom.manualSnippetInput.value.trim();
      if (!text) return;
      const topic = getTopic(state.currentFolderId, state.currentTopicId);
      if (!topic) return;
      topic.snippets.push({
        id: genId(),
        text,
        sourceUrl: "Manual",
        sourceTitle: "Manual entry",
        timestamp: Date.now(),
      });
      await saveState();
      dom.manualSnippetInput.value = "";
      renderSnippets();
      showToast("Snippet added");
    });

    // --- Pending Snippet ---
    dom.savePendingSnippet.addEventListener("click", async () => {
      if (!currentPendingSnippet) return;
      const folderId = dom.pendingFolderSelect.value;
      const topicId = dom.pendingTopicSelect.value;
      if (!folderId || !topicId) {
        showToast("Please select a folder and topic", "error");
        return;
      }
      const topic = getTopic(folderId, topicId);
      if (!topic) return;
      topic.snippets.push(currentPendingSnippet);
      await saveState();
      currentPendingSnippet = null;
      dom.pendingBanner.classList.add("hidden");
      showToast("Clip saved!");

      // If we're viewing that topic, refresh
      if (state.currentFolderId === folderId && state.currentTopicId === topicId) {
        renderSnippets();
      }
    });
    dom.dismissPendingSnippet.addEventListener("click", () => {
      currentPendingSnippet = null;
      dom.pendingBanner.classList.add("hidden");
    });

    // --- Synthesize ---
    dom.synthesizeBtn.addEventListener("click", async () => {
      const topic = getTopic(state.currentFolderId, state.currentTopicId);
      if (!topic || topic.snippets.length === 0) {
        showToast("Add some snippets first", "error");
        return;
      }

      dom.synthesisResult.classList.add("hidden");
      dom.synthesisLoading.classList.remove("hidden");
      dom.synthesizeBtn.disabled = true;

      try {
        const result = await synthesizeTopic(topic.name, topic.snippets);
        if (result) {
          dom.synthesisContent.innerHTML = renderMarkdown(result);
          dom.synthesisResult.classList.remove("hidden");
        }
      } catch (err) {
        showToast(`Synthesis failed: ${err.message}`, "error");
        console.error("Synthesis error:", err);
      } finally {
        dom.synthesisLoading.classList.add("hidden");
        dom.synthesizeBtn.disabled = false;
      }
    });

    dom.closeSynthesis.addEventListener("click", () => {
      dom.synthesisResult.classList.add("hidden");
    });

    // --- Message from background ---
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "NEW_SNIPPET") {
        showPendingSnippet(msg.snippet);
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    await loadState();
    bindEvents();
    navigateTo("folders");
    await checkPendingSnippet();
  }

  init();
})();
