// Text Cleaner — pure cleaning logic (shared by popup + full page, and
// exported for Node unit tests). No dependencies.
// NOTE: character classes are built from codepoint numbers on purpose,
// so this file contains no literal invisible characters.
(function (global) {
  "use strict";

  const DEFAULT_OPTS = {
    removeHidden: true,     // zero-width, bidi controls, BOM, soft hyphen, control chars
    unicodeSpaces: true,    // NBSP & other unicode spaces -> regular space
    smartPunct: true,       // curly quotes/dashes/ellipsis -> ASCII
    tabsToSpaces: true,     // tab -> single space
    trimLines: true,        // strip leading/trailing spaces on every line
    collapseSpaces: true,   // 2+ spaces -> 1
    collapseBlank: true,    // 3+ newlines -> 2 (keeps paragraph breaks)
    stripHtml: false,       // remove <tags> and decode common entities
    removeEmoji: false,     // remove emoji / pictographs
  };

  function classRe(ranges, flags) {
    let cls = "";
    for (const [a, b] of ranges) {
      cls += String.fromCharCode(a);
      if (b > a) cls += "-" + String.fromCharCode(b);
    }
    return new RegExp("[" + cls + "]", flags || "g");
  }
  // Invisible format chars + C0/C1-ish controls (tab/newline excluded).
  const HIDDEN_RE = classRe([
    [0x00ad, 0x00ad], [0x180e, 0x180e], [0x200b, 0x200f], [0x202a, 0x202e],
    [0x2060, 0x2064], [0x206a, 0x206f], [0xfeff, 0xfeff], [0xfff9, 0xfffb],
    [0x0000, 0x0008], [0x000b, 0x000c], [0x000e, 0x001f], [0x007f, 0x007f],
  ]);
  const UNICODE_SPACE_RE = classRe([
    [0x00a0, 0x00a0], [0x1680, 0x1680], [0x2000, 0x200a],
    [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000],
  ]);

  const NAMES = {
    0x200b: "ZERO WIDTH SPACE", 0x200c: "ZERO WIDTH NON-JOINER", 0x200d: "ZERO WIDTH JOINER",
    0xfeff: "BYTE ORDER MARK / ZWNBSP", 0x00ad: "SOFT HYPHEN", 0x2060: "WORD JOINER",
    0x200e: "LEFT-TO-RIGHT MARK", 0x200f: "RIGHT-TO-LEFT MARK",
    0x202a: "LRE (bidi control)", 0x202b: "RLE (bidi control)", 0x202c: "PDF (bidi control)",
    0x202d: "LRO (bidi control)", 0x202e: "RLO (bidi control)", 0x180e: "MONGOLIAN VOWEL SEPARATOR",
    0x0000: "NULL", 0x000b: "VERTICAL TAB", 0x000c: "FORM FEED", 0x007f: "DELETE",
  };
  function codeName(cp) {
    return "U+" + cp.toString(16).toUpperCase().padStart(4, "0") + (NAMES[cp] ? " " + NAMES[cp] : "");
  }

  const SMART = [
    [/[‘’‚‛]/g, "'"],
    [/[“”„‟]/g, '"'],
    [/[–—―]/g, "-"],
    [/…/g, "..."],
    [/[«»]/g, '"'],
    [/′/g, "'"],
    [/″/g, '"'],
  ];
  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;
  const ENTITIES = [
    [/&nbsp;/gi, " "], [/&amp;/gi, "&"], [/&lt;/gi, "<"], [/&gt;/gi, ">"],
    [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"],
  ];

  function cleanText(input, opts) {
    const o = Object.assign({}, DEFAULT_OPTS, opts || {});
    let text = String(input == null ? "" : input);
    const stats = {
      before: text.length, after: 0, hiddenRemoved: 0, hiddenFound: {},
      smartReplaced: 0, spacesFixed: 0, linesTrimmed: 0,
    };

    // 1. Optional HTML strip (decodes entities first so &nbsp; becomes a space)
    if (o.stripHtml) {
      for (const [re, rep] of ENTITIES) text = text.replace(re, rep);
      text = text.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "");
    }

    // 2. Unicode normalization + line endings
    text = text.normalize("NFC");
    text = text.replace(/\r\n?/g, "\n");

    // 3. Unicode spaces -> regular space
    if (o.unicodeSpaces) {
      text = text.replace(UNICODE_SPACE_RE, () => { stats.spacesFixed++; return " "; });
    }

    // 4. Hidden / invisible / control characters (count + catalog them)
    if (o.removeHidden) {
      text = text.replace(HIDDEN_RE, (ch) => {
        stats.hiddenRemoved++;
        const name = codeName(ch.codePointAt(0));
        stats.hiddenFound[name] = (stats.hiddenFound[name] || 0) + 1;
        return "";
      });
    }

    // 5. Smart punctuation -> ASCII
    if (o.smartPunct) {
      for (const [re, rep] of SMART) {
        text = text.replace(re, () => { stats.smartReplaced++; return rep; });
      }
    }

    // 6. Tabs -> space
    if (o.tabsToSpaces) text = text.replace(/\t/g, " ");

    // 7. Emoji removal (before space cleanup, which mops up doubles)
    if (o.removeEmoji) text = text.replace(EMOJI_RE, "");

    // 8. Per-line cleanup: collapse internal spaces, trim line edges
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      let ln = lines[i];
      if (o.collapseSpaces) {
        const c = ln.replace(/ {2,}/g, " ");
        if (c !== ln) stats.spacesFixed++;
        ln = c;
      }
      if (o.trimLines) {
        const t = ln.replace(/^ +| +$/g, "");
        if (t !== ln) stats.linesTrimmed++;
        ln = t;
      }
      lines[i] = ln;
    }
    text = lines.join("\n");

    // 9. Blank-line collapse + overall trim
    if (o.collapseBlank) text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/^\s+|\s+$/g, "");

    stats.after = text.length;
    return { text, stats };
  }

  global.cleanText = cleanText;
  global.CLEAN_DEFAULTS = DEFAULT_OPTS;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { cleanText, DEFAULT_OPTS };
  }
})(typeof window !== "undefined" ? window : globalThis);
