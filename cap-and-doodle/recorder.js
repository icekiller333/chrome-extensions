// Cap & Doodle — GIF recorder window.
// Gets a tab-capture stream (set up by background.js), waits for the
// in-page countdown, samples the selected area for 5s at 10fps,
// encodes with gif-encoder.js, and offers the GIF for download.
"use strict";
const $ = (id) => document.getElementById(id);
const statusEl = $("status"), cdEl = $("countdown"), video = $("preview");
const DURATION = 5000, INTERVAL = 100, MAXW = 480;

let gifBlobUrl = null;

function setStatus(m) { statusEl.textContent = m; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const { pendingGif } = await chrome.storage.local.get("pendingGif");
  if (!pendingGif) { setStatus("No GIF job found. Start again from the toolbar icon."); return; }
  if (pendingGif.error) { setStatus(pendingGif.error); return; }
  const { streamId, rect, viewport, recordStartAt } = pendingGif;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    });
  } catch (e) {
    setStatus("Couldn't open the tab stream (" + e.message + "). Try again on a normal web page tab.");
    return;
  }
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay attribute covers it */ }

  // Wait for the in-page 3-2-1 to finish (background stamps the start time).
  setStatus("Get back to your tab — recording starts with the GO! on the page.");
  while (Date.now() < recordStartAt) {
    const remain = Math.ceil((recordStartAt - Date.now()) / 1000);
    cdEl.textContent = remain > 0 ? String(remain) : "";
    await sleep(90);
  }
  cdEl.textContent = "🔴";

  // Map the CSS-pixel selection onto the stream's actual pixels.
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) { setStatus("The tab stream gave no video. Try again."); stream.getTracks().forEach((t) => t.stop()); return; }
  const kx = vw / viewport.w, ky = vh / viewport.h;
  const sx = rect.x * kx, sy = rect.y * ky, sw = rect.w * kx, sh = rect.h * ky;
  let outW = Math.min(MAXW, Math.round(sw));
  let outH = Math.round((outW * sh) / sw);
  if (outH > MAXW) { outH = MAXW; outW = Math.round((outH * sw) / sh); }

  const c = document.createElement("canvas");
  c.width = outW; c.height = outH;
  const cx = c.getContext("2d", { willReadFrequently: true });

  setStatus("Recording… move stuff in the area!");
  $("progressWrap").hidden = false;
  const frames = [];
  const t0 = Date.now();
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - t0;
      cx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
      frames.push(cx.getImageData(0, 0, outW, outH));
      $("progress").style.width = Math.min(100, (elapsed / DURATION) * 100) + "%";
      if (elapsed >= DURATION) { clearInterval(timer); resolve(); }
    }, INTERVAL);
  });
  stream.getTracks().forEach((t) => t.stop());
  video.hidden = true;
  cdEl.textContent = "";

  setStatus("Encoding GIF from " + frames.length + " frames…");
  const blob = await window.encodeGif(
    frames.map((f) => ({ data: f.data, width: f.width, height: f.height })),
    { delay: INTERVAL, repeat: 0, onProgress: (n, total) => setStatus("Encoding GIF… frame " + n + " / " + total) }
  );
  gifBlobUrl = URL.createObjectURL(blob);
  $("result").src = gifBlobUrl;
  $("result").hidden = false;
  $("actions").hidden = false;
  setStatus("Done — " + outW + "×" + outH + ", " + Math.round(blob.size / 1024) + " KB, loops forever.");
  try {
    const win = await chrome.windows.getCurrent();
    await chrome.windows.update(win.id, { focused: true });
  } catch (e) { /* not critical */ }
}

$("saveBtn").addEventListener("click", () => {
  if (!gifBlobUrl) return;
  const a = document.createElement("a");
  a.href = gifBlobUrl;
  a.download = "capdoodle-" + Date.now() + ".gif";
  a.click();
});
$("againBtn").addEventListener("click", () => window.location.reload());
$("closeBtn").addEventListener("click", () => window.close());

main().catch((e) => setStatus("Recorder error: " + e.message));
