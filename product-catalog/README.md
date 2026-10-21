# Product Catalog

Nested product catalog + inventory tracker for Chrome (Manifest V3, no build step, no dependencies).

- **Categories nest** (e.g. Stickers → Little Dudes → individual characters), each with an optional category price.
- **Inherited pricing:** a product with no own price uses the nearest ancestor category's price. Changing a category price instantly changes every inheriting product's effective price — effective prices are computed, never copied.
- **Products:** name, category, optional own price, quantity with +/− controls, target quantity with restock shortfall, free-form tags, notes.
- **Manager page** (opened from the popup): category tree, search + tag filter, header stats (products / units / stock value / restock needed), Export JSON / CSV, Import JSON.
- **"Load my current lines"** button in the manager seeds Ken's Darkling Faire lines (2026-10-18) — only when clicked, and it confirms before overwriting existing data.
- Data lives in `chrome.storage.local` under one versioned key.

## Install

1. Clone/download this repo.
2. `chrome://extensions` → enable Developer mode → **Load unpacked** → select this `product-catalog` folder.
3. Click the toolbar icon for the popup; **Open Catalog** launches the full manager in a tab.
