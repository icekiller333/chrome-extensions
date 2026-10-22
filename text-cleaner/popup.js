// Text Cleaner — popup: quick clean with your saved options from the full page.
"use strict";
const input = document.getElementById("input");
const statsEl = document.getElementById("stats");

async function savedOpts() {
  try {
    const { tcOptions } = await chrome.storage.local.get("tcOptions");
    return tcOptions || {};
  } catch (e) { return {}; }
}
function summary(r) {
  const parts = [];
  if (r.stats.hiddenRemoved) parts.push(r.stats.hiddenRemoved + " hidden char" + (r.stats.hiddenRemoved > 1 ? "s" : "") + " removed");
  if (r.stats.smartReplaced) parts.push(r.stats.smartReplaced + " smart-punct fixed");
  parts.push(r.stats.before + " → " + r.stats.after + " chars");
  return parts.join(" · ");
}
async function doClean(copy) {
  const opts = await savedOpts();
  const r = window.cleanText(input.value, opts);
  input.value = r.text;
  statsEl.textContent = summary(r);
  if (copy) {
    try {
      await navigator.clipboard.writeText(r.text);
      statsEl.textContent += " — copied ✅";
    } catch (e) {
      statsEl.textContent += " — copy blocked, text is cleaned above, Ctrl+C it";
    }
  }
  input.focus(); input.select();
}
document.getElementById("cleanCopy").addEventListener("click", () => doClean(true));
document.getElementById("cleanOnly").addEventListener("click", () => doClean(false));
document.getElementById("openFull").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("cleaner.html") });
  window.close();
});
