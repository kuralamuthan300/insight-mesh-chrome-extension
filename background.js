// ============================================================
// InsightMesh — Background Service Worker
// ============================================================
// Handles: context menu creation, side panel toggling, and
// passing selected text from web pages into storage.
// ============================================================

// --- Context Menu Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "insightmesh-add",
    title: "📌 Add to InsightMesh",
    contexts: ["selection"],
  });
});

// --- Context Menu Click Handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "insightmesh-add" && info.selectionText) {
    const snippet = {
      text: info.selectionText.trim(),
      sourceUrl: tab?.url || "Unknown",
      sourceTitle: tab?.title || "Unknown",
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    };

    // Store the pending snippet so the side panel can pick it up
    await chrome.storage.local.set({ pendingSnippet: snippet });

    // Open the side panel so the user can assign the snippet to a topic
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      // Side panel might already be open, which is fine
      console.log("Side panel may already be open:", e.message);
    }

    // Notify any open side panel about the new snippet
    chrome.runtime.sendMessage({ type: "NEW_SNIPPET", snippet }).catch(() => {
      // Side panel might not be ready yet — the panel will check pendingSnippet on load
    });
  }
});

// --- Action Click: Toggle Side Panel ---
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.log("Could not open side panel:", e.message);
  }
});
