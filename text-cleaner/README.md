# Text Cleaner

Paste dirty text, get clean text. Built for text copied out of AI chats, Word, PDFs, and web pages — the stuff that carries invisible junk into Rise/Storyline/CMS fields and breaks searches, scripts, and formatting downstream.

## What it removes / fixes (each one toggleable)

- **Hidden characters** — zero-width spaces/joiners, byte-order marks, soft hyphens, bidi controls, word joiners, and stray control characters. The full page shows a report of exactly what was found, by codepoint (e.g. `U+200B ZERO WIDTH SPACE × 4`).
- **Unicode spaces** — non-breaking spaces and the whole U+2000–U+3000 space family become regular spaces.
- **Smart punctuation → ASCII** — curly quotes, em/en dashes, and ellipses become `' " - ...`
- **Extra spaces** — leading/trailing spaces trimmed off every line, 2+ spaces collapsed to 1, tabs converted to spaces. (Extra space before/after sentences and lines was the original ask.)
- **Blank lines** — 3+ newlines collapse to one paragraph break; overall leading/trailing whitespace removed.
- Optional, off by default: **strip HTML tags** (with entity decoding) and **remove emoji**.

## Two ways to use it

- **Popup** — paste, hit **Clean & Copy**, paste wherever. It uses the options you saved on the full page.
- **Full cleaner page** — side-by-side dirty/clean panes, all option checkboxes (saved automatically), an auto-clean-as-you-type mode, a "what was in there" report, and Download .txt.

## Permissions

Only `storage` (to remember your options). No network, no tracking, text never leaves the page.

## Install

Download/clone this repo, then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `text-cleaner` folder.
