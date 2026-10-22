# chrome-extensions
a collection of chrome extensions

## Cap & Doodle — `cap-and-doodle/`
Screenshot any tab without a third-party service: capture the visible tab or drag-select an area, then crop, draw, stamp movable/resizable emojis and meme text, and copy or save as PNG / WEBP / JPG. Also has a "ghetto GIF" mode: select an area, get a 3-2-1 countdown on the page, move stuff around for 5 seconds, and it encodes a looping GIF locally. Details: [cap-and-doodle/README.md](cap-and-doodle/README.md)

## Product Catalog — `product-catalog/`
Inventory tracker with a nested category tree (e.g. Stickers → Little Dudes → individual characters). Prices can be set per product or per category — products without their own price inherit the nearest category price, so changing a category price reprices everything under it. Tags, stock quantities with restock targets, search/filter, CSV/JSON export. Details: [product-catalog/README.md](product-catalog/README.md)

## Text Cleaner — `text-cleaner/`
Paste dirty text, get clean text: strips hidden/zero-width characters (with a report of exactly what was found, by codepoint), unicode spaces, and smart punctuation, and trims/collapses extra spaces. Built for text copied out of AI chats, Word, PDFs, and web pages. Popup does one-click Clean & Copy; the full page has every option, an auto-clean mode, and Download .txt. Details: [text-cleaner/README.md](text-cleaner/README.md)

## Install any of these
Download or clone this repo, then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the extension's folder.
