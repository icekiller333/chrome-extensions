// Cap & Doodle — popup actions.
const errEl = document.getElementById("err");

function showErr(e) {
  errEl.textContent =
    "That didn't work on this page (" + (e && e.message ? e.message : e) +
    "). Chrome blocks capture on chrome:// pages and the Web Store — try a normal web page.";
  errEl.hidden = false;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

document.getElementById("btnFull").addEventListener("click", async () => {
  try {
    const tab = await activeTab();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await chrome.storage.local.set({
      pendingCapture: { dataUrl, crop: null, capturedAt: Date.now() },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    window.close();
  } catch (e) {
    showErr(e);
  }
});

async function injectSelector(mode) {
  const tab = await activeTab();
  await chrome.storage.local.set({ selectorMode: mode });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["selector.js"] });
  window.close();
}

document.getElementById("btnArea").addEventListener("click", async () => {
  try { await injectSelector("still"); } catch (e) { showErr(e); }
});

document.getElementById("btnGif").addEventListener("click", async () => {
  try { await injectSelector("gif"); } catch (e) { showErr(e); }
});

document.getElementById("btnOpenEditor").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
  window.close();
});
