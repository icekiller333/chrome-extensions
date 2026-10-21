// Cap & Doodle — background service worker.
// Receives area selections from selector.js (injected into the page),
// captures stills, and sets up tab-capture GIF recording.

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function openEditorWithCapture(tab, crop) {
  // Give selector.js a beat to remove its overlay before we grab pixels.
  await delay(180);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  await chrome.storage.local.set({
    pendingCapture: { dataUrl, crop: crop || null, capturedAt: Date.now() },
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
}

async function startGifRecorder(tab, rect, viewport) {
  // Selector counts 3-2-1 in the page at ~900ms per beat.
  const recordStartAt = Date.now() + 2850;
  let streamId = null;
  let error = null;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  } catch (e) {
    error = "Tab capture was refused for this page: " + (e && e.message ? e.message : e);
  }
  await chrome.storage.local.set({
    pendingGif: { streamId, rect, viewport, tabId: tab.id, recordStartAt, error },
  });
  await chrome.windows.create({
    url: chrome.runtime.getURL("recorder.html"),
    type: "popup",
    width: 400,
    height: 460,
    focused: false, // keep the target tab focused so it keeps rendering
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !sender.tab) return;
  if (msg.type === "AREA_SELECTED") {
    openEditorWithCapture(sender.tab, { rect: msg.rect, viewport: msg.viewport }).catch((e) =>
      console.error("Cap & Doodle capture failed:", e)
    );
  } else if (msg.type === "GIF_AREA_SELECTED") {
    startGifRecorder(sender.tab, msg.rect, msg.viewport).catch((e) =>
      console.error("Cap & Doodle GIF setup failed:", e)
    );
  }
});
