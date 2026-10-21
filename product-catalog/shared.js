'use strict';
/* Product Catalog — shared data logic for popup + manager page.
   Data shape (chrome.storage.local, key "productCatalogData"):
   { version: 1,
     categories: [{ id, name, parentId|null, price|null }],
     products:   [{ id, name, categoryId|null, price|null, qty, target, tags:[], notes }] }
   Effective price is ALWAYS computed, never stored on a product:
   own price -> walk up category ancestors -> none. */

const PC_KEY = 'productCatalogData';
const PC_VERSION = 1;

function pcUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function pcEmptyData() {
  return { version: PC_VERSION, categories: [], products: [] };
}

function pcNormalize(raw) {
  const d = pcEmptyData();
  if (!raw || typeof raw !== 'object') return d;
  if (Array.isArray(raw.categories)) {
    d.categories = raw.categories.filter(c => c && c.id && c.name).map(c => ({
      id: String(c.id),
      name: String(c.name),
      parentId: c.parentId ? String(c.parentId) : null,
      price: (c.price === null || c.price === undefined || c.price === '') ? null : Number(c.price)
    }));
  }
  if (Array.isArray(raw.products)) {
    d.products = raw.products.filter(p => p && p.id && p.name).map(p => ({
      id: String(p.id),
      name: String(p.name),
      categoryId: p.categoryId ? String(p.categoryId) : null,
      price: (p.price === null || p.price === undefined || p.price === '') ? null : Number(p.price),
      qty: Number(p.qty) || 0,
      target: Number(p.target) || 0,
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      notes: p.notes ? String(p.notes) : ''
    }));
  }
  return d;
}

function pcLoad() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get(PC_KEY, out => {
        resolve(pcNormalize(out && out[PC_KEY]));
      });
    } catch (e) {
      resolve(pcEmptyData());
    }
  });
}

function pcSave(data) {
  return new Promise(resolve => {
    const payload = {};
    payload[PC_KEY] = data;
    try {
      chrome.storage.local.set(payload, () => resolve());
    } catch (e) {
      resolve();
    }
  });
}

function pcCategoryById(data, id) {
  return data.categories.find(c => c.id === id) || null;
}

/* Array of category objects from root down to (and including) id. */
function pcCategoryPath(data, id) {
  const path = [];
  let cur = id ? pcCategoryById(data, id) : null;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? pcCategoryById(data, cur.parentId) : null;
  }
  return path;
}

function pcCategoryPathString(data, id) {
  if (!id) return 'Uncategorized';
  const p = pcCategoryPath(data, id);
  return p.length ? p.map(c => c.name).join(' / ') : 'Uncategorized';
}

/* Set containing id plus every descendant category id. */
function pcSubtreeIds(data, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of data.categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

/* { price:number|null, source:'own'|'category'|'none', sourceName:string|null } */
function pcEffectivePrice(data, product) {
  if (product.price !== null && product.price !== undefined && !Number.isNaN(product.price)) {
    return { price: product.price, source: 'own', sourceName: null };
  }
  let cur = product.categoryId ? pcCategoryById(data, product.categoryId) : null;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.price !== null && cur.price !== undefined && !Number.isNaN(cur.price)) {
      return { price: cur.price, source: 'category', sourceName: cur.name };
    }
    cur = cur.parentId ? pcCategoryById(data, cur.parentId) : null;
  }
  return { price: null, source: 'none', sourceName: null };
}

function pcFmtPrice(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2);
}

function pcAllTags(data) {
  const s = new Set();
  for (const p of data.products) for (const t of p.tags) s.add(t);
  return [...s].sort((a, b) => a.localeCompare(b));
}

function pcRestockNeed(p) {
  return Math.max(0, (Number(p.target) || 0) - (Number(p.qty) || 0));
}

function pcStats(data) {
  let units = 0, value = 0, restock = 0;
  for (const p of data.products) {
    units += Number(p.qty) || 0;
    const eff = pcEffectivePrice(data, p);
    if (eff.price !== null) value += eff.price * (Number(p.qty) || 0);
    restock += pcRestockNeed(p);
  }
  return { products: data.products.length, categories: data.categories.length, units, value, restock };
}

function pcCsvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function pcToCSV(data) {
  const rows = [['name', 'category path', 'own price', 'effective price', 'price source', 'qty', 'target', 'tags', 'notes']];
  for (const p of data.products) {
    const eff = pcEffectivePrice(data, p);
    const src = eff.source === 'own' ? 'own' : (eff.source === 'category' ? 'inherited from ' + eff.sourceName : 'none');
    rows.push([
      p.name,
      pcCategoryPathString(data, p.categoryId),
      p.price === null ? '' : p.price,
      eff.price === null ? '' : eff.price,
      src,
      p.qty, p.target,
      p.tags.join('; '),
      p.notes
    ]);
  }
  return rows.map(r => r.map(pcCsvEscape).join(',')).join('\n');
}

/* Ken's Darkling Faire lines, 2026-10-18 target stock. Only loaded on click. */
function pcSeedData() {
  const d = pcEmptyData();
  const mk = (name, parentId, price) => {
    const c = { id: pcUid() + Math.random().toString(36).slice(2, 6), name, parentId: parentId || null, price: price ?? null };
    d.categories.push(c);
    return c.id;
  };
  const stickers = mk('Stickers');
  const prints = mk('Prints');
  const books = mk('Books');
  const keychains = mk('Keychains');
  const other = mk('Other');
  const prod = (name, categoryId, price, qty) => {
    d.products.push({ id: pcUid() + Math.random().toString(36).slice(2, 6), name, categoryId, price, qty, target: 0, tags: [], notes: '' });
  };
  prod('Fig Jam Doodle Stickers', stickers, 2, 0);
  prod('Monster Summon Sticker Pack', stickers, 10, 9);
  prod('Scrappy Bit Prints', prints, 8, 40);
  prod('Bookmarks', other, 5, 10);
  prod('Books', books, 20, 0);
  prod('Head Keychain Blind Bags', keychains, 10, 30);
  prod('Emergency Fetus', other, 20, 0);
  prod('Emergency Pocket Fetus', other, 10, 0);
  return d;
}
