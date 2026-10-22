// Text Cleaner — full page: options (persisted), report, export.
"use strict";
const $ = (id) => document.getElementById(id);
const KEYS = Object.keys(window.CLEAN_DEFAULTS);
let debounce = null;

function readOpts() {
  const o = {};
  for (const k of KEYS) o[k] = $("opt-" + k).checked;
  return o;
}
async function saveOpts() {
  try { await chrome.storage.local.set({ tcOptions: readOpts(), tcAuto: $("autoClean").checked }); } catch (e) {}
}
async function loadOpts() {
  let saved = {}, auto = false;
  try {
    const got = await chrome.storage.local.get(["tcOptions", "tcAuto"]);
    saved = got.tcOptions || {}; auto = !!got.tcAuto;
  } catch (e) {}
  for (const k of KEYS) $("opt-" + k).checked = saved[k] != null ? saved[k] : window.CLEAN_DEFAULTS[k];
  $("autoClean").checked = auto;
}

function runClean() {
  const r = window.cleanText($("input").value, readOpts());
  $("output").value = r.text;
  $("inCount").textContent = "— " + r.stats.before + " chars";
  $("outCount").textContent = "— " + r.stats.after + " chars";
  const bits = [];
  if (r.stats.hiddenRemoved) bits.push(r.stats.hiddenRemoved + " hidden characters removed");
  if (r.stats.smartReplaced) bits.push(r.stats.smartReplaced + " smart-punctuation characters replaced");
  if (r.stats.spacesFixed) bits.push(r.stats.spacesFixed + " space fixes");
  if (r.stats.linesTrimmed) bits.push(r.stats.linesTrimmed + " lines trimmed");
  const found = Object.entries(r.stats.hiddenFound);
  if (bits.length || found.length) {
    $("report").hidden = false;
    $("reportSummary").textContent = bits.length ? bits.join(" · ") : "No changes needed — text was already clean.";
    $("hiddenList").innerHTML = "";
    for (const [name, count] of found) {
      const li = document.createElement("li");
      li.textContent = name + " × " + count;
      $("hiddenList").appendChild(li);
    }
  } else {
    $("report").hidden = false;
    $("reportSummary").textContent = "No changes needed — text was already clean.";
    $("hiddenList").innerHTML = "";
  }
  return r;
}

for (const k of KEYS) {
  $("opt-" + k).addEventListener("change", () => { saveOpts(); if ($("autoClean").checked) runClean(); });
}
$("autoClean").addEventListener("change", saveOpts);
$("cleanBtn").addEventListener("click", runClean);
$("input").addEventListener("input", () => {
  $("inCount").textContent = "— " + $("input").value.length + " chars";
  if ($("autoClean").checked) {
    clearTimeout(debounce);
    debounce = setTimeout(runClean, 250);
  }
});
$("copyBtn").addEventListener("click", async () => {
  if (!$("output").value) runClean();
  try {
    await navigator.clipboard.writeText($("output").value);
    $("copyBtn").textContent = "✅ Copied";
    setTimeout(() => { $("copyBtn").textContent = "📋 Copy clean text"; }, 1400);
  } catch (e) {
    $("output").focus(); $("output").select();
  }
});
$("swapBtn").addEventListener("click", () => { $("input").value = $("output").value; runClean(); });
$("clearBtn").addEventListener("click", () => {
  $("input").value = ""; $("output").value = "";
  $("inCount").textContent = ""; $("outCount").textContent = ""; $("report").hidden = true;
});
$("downloadBtn").addEventListener("click", () => {
  if (!$("output").value) runClean();
  const blob = new Blob([$("output").value], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clean-text.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
});

loadOpts();
