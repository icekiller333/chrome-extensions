// Cap & Doodle — in-page area selector (injected via chrome.scripting).
// Mode is read from chrome.storage.local ("selectorMode": "still" | "gif").
// Still: drag an area -> background captures + opens the editor.
// GIF:   drag an area -> 3-2-1 countdown overlay in the page -> a REC pill
//        stays up for the 5s the recorder window is capturing.
(function () {
  if (window.__capDoodleRunning) return;
  window.__capDoodleRunning = true;

  const Z = 2147483647;
  function el(tag, css, text) {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }
  const baseFont = "font-family:system-ui,sans-serif;color:#111;";

  chrome.storage.local.get({ selectorMode: "still" }, ({ selectorMode }) => {
    const mode = selectorMode === "gif" ? "gif" : "still";
    start(mode);
  });

  function cleanup(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
    window.__capDoodleRunning = false;
  }

  function start(mode) {
    const overlay = el("div",
      `position:fixed;inset:0;z-index:${Z};cursor:crosshair;background:rgba(10,10,30,.35);`);
    const banner = el("div",
      `position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#ffe45e;` +
      `border:3px solid #111;box-shadow:4px 4px 0 #111;padding:8px 14px;font-size:15px;font-weight:800;${baseFont}`,
      mode === "gif"
        ? "🎞️ Drag the area to GIF — then get ready to move stuff in it"
        : "✂️ Drag to select an area — Esc to cancel");
    overlay.appendChild(banner);
    document.documentElement.appendChild(overlay);

    let startX = 0, startY = 0, rectDiv = null, dragging = false;

    function onKey(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey, true);
        cleanup(overlay);
      }
    }
    document.addEventListener("keydown", onKey, true);

    overlay.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      rectDiv = el("div",
        `position:absolute;border:3px solid #ff5da2;background:rgba(255,93,162,.10);` +
        `box-shadow:0 0 0 2px #fff;pointer-events:none;`);
      overlay.appendChild(rectDiv);
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!dragging || !rectDiv) return;
      const x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      rectDiv.style.left = x + "px"; rectDiv.style.top = y + "px";
      rectDiv.style.width = w + "px"; rectDiv.style.height = h + "px";
    });

    overlay.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("keydown", onKey, true);
      const rect = {
        x: Math.min(e.clientX, startX),
        y: Math.min(e.clientY, startY),
        w: Math.abs(e.clientX - startX),
        h: Math.abs(e.clientY - startY),
      };
      const viewport = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 };
      cleanup(overlay);
      if (rect.w < 12 || rect.h < 12) return; // accidental click

      if (mode === "still") {
        chrome.runtime.sendMessage({ type: "AREA_SELECTED", rect, viewport });
      } else {
        chrome.runtime.sendMessage({ type: "GIF_AREA_SELECTED", rect, viewport });
        runCountdown();
      }
    });
  }

  function runCountdown() {
    const layer = el("div",
      `position:fixed;inset:0;z-index:${Z};pointer-events:none;${baseFont}`);
    document.documentElement.appendChild(layer);
    const big = el("div",
      `position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);font-size:120px;` +
      `font-weight:900;color:#ffe45e;-webkit-text-stroke:3px #111;text-shadow:6px 6px 0 #111;`);
    layer.appendChild(big);

    const beats = ["3", "2", "1", "GO!"];
    let i = 0;
    big.textContent = beats[0];
    const tick = setInterval(() => {
      i++;
      if (i < beats.length) {
        big.textContent = beats[i];
      } else {
        clearInterval(tick);
        big.remove();
        showRecPill(layer);
      }
    }, 900);
  }

  function showRecPill(layer) {
    const pill = el("div",
      `position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#fff;` +
      `border:3px solid #111;box-shadow:4px 4px 0 #111;padding:7px 14px;font-size:15px;font-weight:800;${baseFont}`,
      "🔴 REC — move stuff in your area!");
    const barWrap = el("div",
      `position:absolute;bottom:0;left:0;height:8px;width:100%;background:rgba(0,0,0,.25);`);
    const bar = el("div", "height:100%;width:0%;background:#ff5da2;");
    barWrap.appendChild(bar);
    layer.appendChild(pill);
    layer.appendChild(barWrap);
    const t0 = Date.now();
    const anim = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - t0) / 5000) * 100);
      bar.style.width = pct + "%";
      if (pct >= 100) {
        clearInterval(anim);
        pill.textContent = "✅ GIF captured — check the Cap & Doodle recorder window";
        pill.style.background = "#5eead4";
        setTimeout(() => cleanup(layer), 1600);
      }
    }, 100);
  }
})();
