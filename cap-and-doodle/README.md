# Cap & Doodle

Screenshot a tab without any third-party service, then doodle on it and turn it into a meme — plus a 5-second "ghetto GIF" recorder.

## Features

**Editor (stills)**
- **Capture visible tab** — one click grabs what you see.
- **Capture an area** — drag a rectangle on the page; only that region opens in the editor.
- **Draw / erase** with color + brush size, undo/redo, clear.
- **Crop** — drag a rectangle in the editor and apply (flattens everything into the cropped image).
- **Emojis** — 54 stamps; drag to move, drag the corner handle or use the Size slider to scale.
- **Meme text** — Impact-style white text with black outline; drag and scale the same way.
- **Export** — Copy as PNG to the clipboard, or Save as **PNG / WEBP / JPG**.
- Also works standalone: open the editor and paste (Ctrl/Cmd+V), drop, or open any image file.

**Ghetto GIF**
- Pick **Ghetto GIF** in the popup, drag an area on the page.
- The page counts **3-2-1-GO**, then you get **5 seconds** to click, drag, and move stuff inside the area (a REC pill with a progress bar stays on the page).
- The recorder window (opened unfocused so your tab keeps rendering) captures the area at 10 fps, max 480px wide, encodes a looping GIF right in the extension — no uploads, no external encoder — and pops to the front when it's ready to save.

## Permissions

`activeTab`, `scripting` (to inject the area selector), `storage` (to hand the capture to the editor/recorder), `tabCapture` (GIF mode only). No host permissions, no network calls, nothing leaves your machine.

## Install

Download/clone this repo, then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `cap-and-doodle` folder.

## Notes / limits

- Chrome blocks capture on `chrome://` pages and the Chrome Web Store.
- GIFs use a fixed 256-color palette by design ("ghetto") — small files, crunchy colors.
- The base image is flattened when you apply a crop in the editor.
