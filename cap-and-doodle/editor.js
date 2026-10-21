// Cap & Doodle — editor.
// Layers: base image (bottom) -> drawing canvas -> movable emoji/text objects.
// Objects are stored in relative coordinates (fractions of stage w/h) so
// exports rasterize them at the image's full native resolution.
"use strict";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), baseImg = $("baseImg"), canvas = $("drawCanvas");
const ctx = canvas.getContext("2d");
const objectsEl = $("objects"), statusEl = $("status");

let natW = 0, natH = 0, loaded = false;
let tool = "move";
let objects = [];        // {id,type:'emoji'|'text',content,x,y,size}
let selectedId = null;
let undoStack = [], redoStack = [];
let cropRel = null;
let objSeq = 1;

function setStatus(m) { statusEl.textContent = m; }
function stageW() { return stage.clientWidth; }
function stageH() { return stage.clientHeight; }
function selected() { return objects.find((o) => o.id === selectedId) || null; }

/* ---------------- loading a base image ---------------- */

function loadBase(dataUrl) {
  const img = new Image();
  img.onload = () => {
    natW = img.naturalWidth; natH = img.naturalHeight;
    baseImg.src = dataUrl;
    canvas.width = natW; canvas.height = natH;
    ctx.clearRect(0, 0, natW, natH);
    objects = []; selectedId = null; undoStack = []; redoStack = [];
    loaded = true;
    stage.hidden = false;
    $("emptyState").hidden = true;
    $("sizeInfo").textContent = natW + " × " + natH + " px";
    layoutStage();
    setStatus("Ready. Draw, stamp emojis, crop, then copy or save.");
  };
  img.onerror = () => setStatus("That image failed to load.");
  img.src = dataUrl;
}

function layoutStage() {
  if (!loaded) return;
  const avail = $("stageWrap").clientWidth - 32;
  const w = Math.max(120, Math.min(natW, avail));
  stage.style.width = w + "px";
  stage.style.height = Math.round((w * natH) / natW) + "px";
  renderObjects();
}
window.addEventListener("resize", layoutStage);

async function init() {
  try {
    const { pendingCapture } = await chrome.storage.local.get("pendingCapture");
    if (pendingCapture && pendingCapture.dataUrl) {
      await chrome.storage.local.remove("pendingCapture");
      if (pendingCapture.crop && pendingCapture.crop.rect) {
        cropCaptureToArea(pendingCapture);
      } else {
        loadBase(pendingCapture.dataUrl);
      }
      return;
    }
  } catch (e) { /* storage unavailable outside extension context */ }
  setStatus("No capture loaded — open, paste, or drop an image to start doodling.");
}
function cropCaptureToArea(pc) {
  const img = new Image();
  img.onload = () => {
    const { rect, viewport } = pc.crop;
    const kx = img.naturalWidth / viewport.w, ky = img.naturalHeight / viewport.h;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(rect.w * kx));
    c.height = Math.max(1, Math.round(rect.h * ky));
    c.getContext("2d").drawImage(img, rect.x * kx, rect.y * ky, c.width, c.height, 0, 0, c.width, c.height);
    loadBase(c.toDataURL("image/png"));
  };
  img.src = pc.dataUrl;
}
init();

/* ---------------- file / paste / drop ---------------- */
$("openFileBtn").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) readFile(f);
});
function readFile(f) {
  const r = new FileReader();
  r.onload = () => loadBase(r.result);
  r.readAsDataURL(f);
}
document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData || {}).items || []].find((i) => i.type.startsWith("image/"));
  if (item) readFile(item.getAsFile());
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (f) readFile(f);
});

/* ---------------- tools ---------------- */
document.querySelectorAll("button.tool").forEach((b) => {
  b.addEventListener("click", () => setTool(b.dataset.tool));
});
function setTool(t) {
  tool = t;
  document.querySelectorAll("button.tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
  stage.classList.toggle("noObjEvents", t !== "move");
  canvas.style.cursor = t === "move" ? "default" : t === "crop" ? "crosshair" : "crosshair";
  if (t !== "crop") { $("cropPanel").hidden = true; $("cropRect").hidden = true; cropRel = null; }
  if (t === "draw") setStatus("Drawing — drag on the image.");
  if (t === "erase") setStatus("Eraser — drag over drawing to remove it.");
  if (t === "crop") setStatus("Crop — drag a rectangle, then Apply crop.");
  if (t === "move") setStatus("Move mode — drag emojis/text, use the corner handle or Size slider to scale.");
}

/* ---------------- drawing + crop (pointer on canvas) ---------------- */
let drawing = false, cropping = false, cropStart = null, lastPt = null;

function canvasPt(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (natW / r.width), y: (e.clientY - r.top) * (natH / r.height), rx: e.clientX - r.left, ry: e.clientY - r.top, rw: r.width, rh: r.height };
}
function pushUndo() {
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
}
function restoreCanvas(dataUrl, done) {
  const img = new Image();
  img.onload = () => { ctx.clearRect(0, 0, natW, natH); ctx.drawImage(img, 0, 0); if (done) done(); };
  img.src = dataUrl;
}
$("undoBtn").addEventListener("click", () => {
  if (!undoStack.length) return;
  redoStack.push(canvas.toDataURL());
  restoreCanvas(undoStack.pop());
});
$("redoBtn").addEventListener("click", () => {
  if (!redoStack.length) return;
  undoStack.push(canvas.toDataURL());
  restoreCanvas(redoStack.pop());
});
$("clearDrawBtn").addEventListener("click", () => {
  if (!loaded) return;
  pushUndo();
  ctx.clearRect(0, 0, natW, natH);
});

canvas.addEventListener("pointerdown", (e) => {
  if (!loaded) return;
  const p = canvasPt(e);
  if (tool === "draw" || tool === "erase") {
    pushUndo();
    drawing = true; lastPt = p;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    drawDot(p);
  } else if (tool === "crop") {
    cropping = true; cropStart = p;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    const cr = $("cropRect");
    cr.hidden = false;
    cr.style.left = p.rx + "px"; cr.style.top = p.ry + "px";
    cr.style.width = "0px"; cr.style.height = "0px";
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!loaded) return;
  const p = canvasPt(e);
  if (drawing) {
    ctx.save();
    if (tool === "erase") ctx.globalCompositeOperation = "destination-out";
    else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = $("color").value; }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, Number($("brush").value) * (natW / p.rw));
    ctx.beginPath(); ctx.moveTo(lastPt.x, lastPt.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.restore();
    lastPt = p;
  } else if (cropping && cropStart) {
    const cr = $("cropRect");
    cr.style.left = Math.min(p.rx, cropStart.rx) + "px";
    cr.style.top = Math.min(p.ry, cropStart.ry) + "px";
    cr.style.width = Math.abs(p.rx - cropStart.rx) + "px";
    cr.style.height = Math.abs(p.ry - cropStart.ry) + "px";
    cropRel = {
      x: Math.min(p.x, cropStart.x) / natW, y: Math.min(p.y, cropStart.y) / natH,
      w: Math.abs(p.x - cropStart.x) / natW, h: Math.abs(p.y - cropStart.y) / natH,
    };
  }
});
function endPointer() {
  if (drawing) drawing = false;
  if (cropping) { cropping = false; if (cropRel && cropRel.w > 0.01 && cropRel.h > 0.01) $("cropPanel").hidden = false; }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
function drawDot(p) {
  ctx.save();
  if (tool === "erase") ctx.globalCompositeOperation = "destination-out";
  else ctx.fillStyle = $("color").value;
  const r = Math.max(0.6, (Number($("brush").value) * (natW / p.rw)) / 2);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
$("cropCancel").addEventListener("click", () => { $("cropPanel").hidden = true; $("cropRect").hidden = true; cropRel = null; });
$("cropApply").addEventListener("click", () => {
  if (!cropRel) return;
  const flat = flattenCanvas();
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(cropRel.w * natW));
  c.height = Math.max(1, Math.round(cropRel.h * natH));
  c.getContext("2d").drawImage(flat, cropRel.x * natW, cropRel.y * natH, c.width, c.height, 0, 0, c.width, c.height);
  $("cropPanel").hidden = true; $("cropRect").hidden = true; cropRel = null;
  loadBase(c.toDataURL("image/png"));
  setTool("move");
  setStatus("Cropped. Everything was flattened into the new image.");
});

/* ---------------- emoji / text objects ---------------- */
const EMOJIS = "😀 😂 🤣 😍 🤔 🤯 🥳 😎 🤡 💩 👻 🎃 🔥 💯 ⭐ ❤️ 💥 🎉 👍 👎 👏 🙏 👀 🧠 🐷 🐸 🐙 🦖 🚀 🍕 🍔 🌮 🍩 ☕ 💸 🏆 ⚠️ ❓ ❗ ⬆️ ⬇️ ⬅️ ➡️ 🔴 🟡 🟢 ✨ 🎯 🛑 👑 💎 🗡️ 🛡️".split(" ");
const emojiPanel = $("emojiPanel");
for (const em of EMOJIS) {
  const b = document.createElement("button");
  b.textContent = em;
  b.addEventListener("click", () => addObject("emoji", em));
  emojiPanel.appendChild(b);
}
$("emojiBtn").addEventListener("click", () => { emojiPanel.hidden = !emojiPanel.hidden; });
$("addTextBtn").addEventListener("click", () => {
  const v = $("memeText").value.trim() || "YOUR TEXT";
  addObject("text", v);
  $("memeText").value = "";
});
$("memeText").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addTextBtn").click(); });

function addObject(type, content) {
  if (!loaded) { setStatus("Load a capture or an image first."); return; }
  const o = {
    id: objSeq++, type, content,
    x: 0.38 + (objects.length % 5) * 0.03,
    y: 0.36 + (objects.length % 5) * 0.03,
    size: type === "emoji" ? 0.15 : 0.085,
  };
  objects.push(o);
  select(o.id);
  setTool("move");
  renderObjects();
  setStatus(type === "emoji" ? "Emoji added — drag to move, corner handle or Size slider to scale." : "Text added — drag to move, scale with the handle/slider.");
}

function renderObjects() {
  objectsEl.innerHTML = "";
  for (const o of objects) {
    const d = document.createElement("div");
    d.className = "obj" + (o.type === "text" ? " text" : "") + (o.id === selectedId ? " selected" : "");
    d.textContent = o.content;
    d.style.left = o.x * stageW() + "px";
    d.style.top = o.y * stageH() + "px";
    d.style.fontSize = o.size * stageW() + "px";
    const h = document.createElement("span");
    h.className = "handle";
    d.appendChild(h);
    attachObjHandlers(d, o, h);
    objectsEl.appendChild(d);
  }
  const sel = selected();
  $("selPanel").hidden = !sel;
  if (sel) $("selSize").value = Math.round(sel.size * 100);
}
function select(id) { selectedId = id; }
$("selSize").addEventListener("input", () => {
  const sel = selected(); if (!sel) return;
  sel.size = Number($("selSize").value) / 100;
  renderObjects();
});
$("selDelete").addEventListener("click", () => {
  objects = objects.filter((o) => o.id !== selectedId);
  selectedId = null;
  renderObjects();
});
stage.addEventListener("pointerdown", (e) => {
  if (tool === "move" && e.target === objectsEl) { selectedId = null; renderObjects(); }
});

function attachObjHandlers(d, o, handle) {
  d.addEventListener("pointerdown", (e) => {
    if (tool !== "move") return;
    e.stopPropagation();
    // Mark selection in place — a full re-render here would detach the
    // element mid-drag and kill pointer capture.
    selectedId = o.id;
    objectsEl.querySelectorAll(".obj").forEach((el) => el.classList.remove("selected"));
    d.classList.add("selected");
    $("selPanel").hidden = false;
    $("selSize").value = Math.round(o.size * 100);
    const isHandle = e.target === handle;
    const startX = e.clientX, startY = e.clientY;
    const start = { x: o.x, y: o.y, size: o.size };
    const w = stageW(), hgt = stageH();
    try { d.setPointerCapture(e.pointerId); } catch (err) {}
    function mv(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (isHandle) {
        o.size = Math.min(0.8, Math.max(0.02, start.size + dx / w));
        $("selSize").value = Math.round(o.size * 100);
      } else {
        o.x = Math.min(0.98, Math.max(-0.05, start.x + dx / w));
        o.y = Math.min(0.98, Math.max(-0.05, start.y + dy / hgt));
      }
      d.style.left = o.x * w + "px";
      d.style.top = o.y * hgt + "px";
      d.style.fontSize = o.size * w + "px";
    }
    function up() {
      d.removeEventListener("pointermove", mv);
      d.removeEventListener("pointerup", up);
    }
    d.addEventListener("pointermove", mv);
    d.addEventListener("pointerup", up);
  });
}

/* ---------------- flatten + export ---------------- */
function flattenCanvas() {
  const c = document.createElement("canvas");
  c.width = natW; c.height = natH;
  const x = c.getContext("2d");
  x.drawImage(baseImg, 0, 0, natW, natH);
  x.drawImage(canvas, 0, 0);
  for (const o of objects) {
    const sizePx = o.size * natW;
    const px = o.x * natW, py = o.y * natH;
    x.textBaseline = "top";
    if (o.type === "emoji") {
      x.font = sizePx + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      x.fillText(o.content, px, py);
    } else {
      x.font = "900 " + sizePx + 'px Impact,"Arial Black",sans-serif';
      x.lineJoin = "round";
      x.strokeStyle = "#111";
      x.lineWidth = Math.max(2, sizePx / 5);
      const t = o.content.toUpperCase();
      x.strokeText(t, px, py);
      x.fillStyle = "#fff";
      x.fillText(t, px, py);
    }
  }
  return c;
}
function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
function exportCanvas(format) {
  const flat = flattenCanvas();
  if (format === "image/jpeg") {
    const c = document.createElement("canvas");
    c.width = natW; c.height = natH;
    const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, natW, natH);
    x.drawImage(flat, 0, 0);
    return c;
  }
  return flat;
}
function saveAs(format, ext) {
  if (!loaded) { setStatus("Nothing to save yet."); return; }
  exportCanvas(format).toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "capdoodle-" + stamp() + "." + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus("Saved " + ext.toUpperCase() + " (" + Math.round(blob.size / 1024) + " KB).");
  }, format, 0.92);
}
$("savePng").addEventListener("click", () => saveAs("image/png", "png"));
$("saveWebp").addEventListener("click", () => saveAs("image/webp", "webp"));
$("saveJpg").addEventListener("click", () => saveAs("image/jpeg", "jpg"));
$("copyBtn").addEventListener("click", () => {
  if (!loaded) { setStatus("Nothing to copy yet."); return; }
  exportCanvas("image/png").toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Copied as PNG — paste it anywhere.");
    } catch (e) {
      setStatus("Copy failed (" + e.message + "). Use Save PNG instead.");
    }
  }, "image/png");
});

setTool("move");
