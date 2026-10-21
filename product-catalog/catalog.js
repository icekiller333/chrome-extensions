'use strict';

let data = pcEmptyData();
let selected = 'all';           // 'all' | 'uncategorized' | categoryId
const expanded = new Set();     // category ids currently expanded
let editingCategoryId = null;
let editingProductId = null;

const $ = id => document.getElementById(id);

async function persist() { await pcSave(data); }
function refresh() { renderStats(); renderTree(); renderTagFilter(); renderProducts(); }

function renderStats() {
  const s = pcStats(data);
  $('sProducts').textContent = s.products;
  $('sUnits').textContent = s.units;
  $('sValue').textContent = pcFmtPrice(s.value);
  $('sRestock').textContent = s.restock;
}

/* ---------- Category tree ---------- */

function directProductCount(catId) {
  return data.products.filter(p => p.categoryId === catId).length;
}
function subtreeProductCount(catId) {
  const ids = pcSubtreeIds(data, catId);
  return data.products.filter(p => p.categoryId && ids.has(p.categoryId)).length;
}
function childrenOf(parentId) {
  return data.categories
    .filter(c => c.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function treeRow(cat, depth) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-node' + (depth === 0 ? ' root' : '');
  const row = document.createElement('div');
  row.className = 'tree-row' + (selected === cat.id ? ' selected' : '');
  row.dataset.catId = cat.id;

  const kids = childrenOf(cat.id);
  const toggle = document.createElement('span');
  toggle.className = 'toggle';
  toggle.textContent = kids.length ? (expanded.has(cat.id) ? '▾' : '▸') : '';
  toggle.addEventListener('click', ev => {
    ev.stopPropagation();
    if (expanded.has(cat.id)) expanded.delete(cat.id); else expanded.add(cat.id);
    renderTree();
  });

  const name = document.createElement('span');
  name.className = 'cname';
  name.textContent = cat.name;

  row.append(toggle, name);
  if (cat.price !== null) {
    const pr = document.createElement('span');
    pr.className = 'cprice';
    pr.textContent = pcFmtPrice(cat.price);
    pr.title = 'Category price — applies to products without their own price';
    row.appendChild(pr);
  }
  const count = document.createElement('span');
  count.className = 'ccount';
  count.textContent = subtreeProductCount(cat.id);
  count.title = 'Products in this category and its subcategories';
  row.appendChild(count);

  const addSub = document.createElement('button');
  addSub.className = 'mini'; addSub.textContent = '+sub'; addSub.title = 'Add subcategory';
  addSub.addEventListener('click', ev => { ev.stopPropagation(); openCategoryForm(null, cat.id); });
  const edit = document.createElement('button');
  edit.className = 'mini'; edit.textContent = '✎'; edit.title = 'Edit category';
  edit.addEventListener('click', ev => { ev.stopPropagation(); openCategoryForm(cat.id, null); });
  const del = document.createElement('button');
  del.className = 'mini'; del.textContent = '✕'; del.title = 'Delete category (products/subcategories move to parent)';
  del.addEventListener('click', ev => { ev.stopPropagation(); deleteCategory(cat.id); });
  row.append(addSub, edit, del);

  row.addEventListener('click', () => { selected = cat.id; refresh(); });
  wrap.appendChild(row);

  if (kids.length && expanded.has(cat.id)) {
    for (const k of kids) wrap.appendChild(treeRow(k, depth + 1));
  }
  return wrap;
}

function specialRow(key, label, count) {
  const row = document.createElement('div');
  row.className = 'tree-row' + (selected === key ? ' selected' : '');
  const t = document.createElement('span'); t.className = 'toggle';
  const n = document.createElement('span'); n.className = 'cname'; n.textContent = label;
  const c = document.createElement('span'); c.className = 'ccount'; c.textContent = count;
  row.append(t, n, c);
  row.addEventListener('click', () => { selected = key; refresh(); });
  return row;
}

function renderTree() {
  const nav = $('tree');
  nav.innerHTML = '';
  nav.appendChild(specialRow('all', '📦 All products', data.products.length));
  nav.appendChild(specialRow('uncategorized', 'Uncategorized',
    data.products.filter(p => !p.categoryId).length));
  for (const c of childrenOf(null)) nav.appendChild(treeRow(c, 0));
}

/* ---------- Category CRUD ---------- */

function categoryOptions(selectEl, excludeId) {
  selectEl.innerHTML = '';
  const none = document.createElement('option');
  none.value = ''; none.textContent = '(top level)';
  selectEl.appendChild(none);
  const excluded = excludeId ? pcSubtreeIds(data, excludeId) : new Set();
  const walk = (parentId, prefix) => {
    for (const c of childrenOf(parentId)) {
      if (excluded.has(c.id)) continue;
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = prefix + c.name;
      selectEl.appendChild(o);
      walk(c.id, prefix + c.name + ' / ');
    }
  };
  walk(null, '');
}

function openCategoryForm(id, parentId) {
  editingCategoryId = id;
  const cat = id ? pcCategoryById(data, id) : null;
  $('categoryFormTitle').textContent = cat ? 'Edit category' : 'Add category';
  $('cfName').value = cat ? cat.name : '';
  $('cfPrice').value = cat && cat.price !== null ? cat.price : '';
  categoryOptions($('cfParent'), id);
  $('cfParent').value = cat ? (cat.parentId || '') : (parentId || '');
  $('categoryModal').hidden = false;
  $('cfName').focus();
}

async function deleteCategory(id) {
  const cat = pcCategoryById(data, id);
  if (!cat) return;
  const into = cat.parentId ? pcCategoryPathString(data, cat.parentId) : 'Uncategorized';
  if (!confirm('Delete category "' + cat.name + '"?\n\nIts products and subcategories move to ' +
      (cat.parentId ? '"' + into + '"' : 'Uncategorized') + '. Nothing is deleted.')) return;
  for (const c of data.categories) if (c.parentId === id) c.parentId = cat.parentId;
  for (const p of data.products) if (p.categoryId === id) p.categoryId = cat.parentId;
  data.categories = data.categories.filter(c => c.id !== id);
  expanded.delete(id);
  if (selected === id) selected = cat.parentId || 'all';
  await persist();
  refresh();
}

$('categoryForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const name = $('cfName').value.trim();
  if (!name) return;
  const priceRaw = $('cfPrice').value;
  const price = priceRaw === '' ? null : Number(priceRaw);
  const parentId = $('cfParent').value || null;
  if (editingCategoryId) {
    const cat = pcCategoryById(data, editingCategoryId);
    cat.name = name; cat.price = price; cat.parentId = parentId;
  } else {
    const c = { id: pcUid(), name, parentId, price };
    data.categories.push(c);
    if (parentId) expanded.add(parentId);
  }
  $('categoryModal').hidden = true;
  await persist();
  refresh();
});
$('addCategoryBtn').addEventListener('click', () => openCategoryForm(null, null));

/* ---------- Products ---------- */

function renderTagFilter() {
  const sel = $('tagFilter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All tags</option>';
  for (const t of pcAllTags(data)) {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    sel.appendChild(o);
  }
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
}

function visibleProducts() {
  const q = $('search').value.trim().toLowerCase();
  const tag = $('tagFilter').value;
  let ids = null;
  if (selected !== 'all' && selected !== 'uncategorized') ids = pcSubtreeIds(data, selected);
  return data.products.filter(p => {
    if (selected === 'uncategorized' && p.categoryId) return false;
    if (ids && (!p.categoryId || !ids.has(p.categoryId))) return false;
    if (tag && !p.tags.includes(tag)) return false;
    if (q) {
      const hay = (p.name + ' ' + p.notes + ' ' + p.tags.join(' ') + ' ' +
        pcCategoryPathString(data, p.categoryId)).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function renderProducts() {
  const tbody = $('productRows');
  tbody.innerHTML = '';
  const items = visibleProducts();
  $('showingCount').textContent = 'Showing ' + items.length + ' of ' + data.products.length;
  $('noProducts').hidden = items.length > 0;
  for (const p of items) {
    const eff = pcEffectivePrice(data, p);
    const need = pcRestockNeed(p);
    const tr = document.createElement('tr');
    if (need > 0) tr.className = 'low';

    const tdName = document.createElement('td');
    const nm = document.createElement('div'); nm.className = 'pname'; nm.textContent = p.name;
    tdName.appendChild(nm);
    if (p.notes) {
      const nt = document.createElement('div'); nt.className = 'pnotes'; nt.textContent = p.notes;
      tdName.appendChild(nt);
    }
    const tdCat = document.createElement('td');
    tdCat.textContent = pcCategoryPathString(data, p.categoryId);

    const tdPrice = document.createElement('td');
    tdPrice.textContent = pcFmtPrice(eff.price);
    const src = document.createElement('span');
    src.className = 'price-src';
    src.textContent = eff.source === 'own' ? 'own price'
      : eff.source === 'category' ? 'inherited from ' + eff.sourceName : 'no price set';
    tdPrice.appendChild(src);

    const tdQty = document.createElement('td');
    const qc = document.createElement('div'); qc.className = 'qty-ctrl';
    const minus = document.createElement('button'); minus.textContent = '−'; minus.title = 'One less';
    minus.addEventListener('click', () => changeQty(p.id, -1));
    const plus = document.createElement('button'); plus.textContent = '+'; plus.title = 'One more';
    plus.addEventListener('click', () => changeQty(p.id, 1));
    const qv = document.createElement('span'); qv.className = 'qv'; qv.textContent = p.qty;
    qc.append(minus, qv, plus);
    tdQty.appendChild(qc);

    const tdTarget = document.createElement('td');
    tdTarget.textContent = p.target > 0 ? p.target : '—';
    const tdNeed = document.createElement('td');
    if (need > 0) {
      const n = document.createElement('span'); n.className = 'need'; n.textContent = need;
      tdNeed.appendChild(n);
    } else tdNeed.textContent = '—';

    const tdTags = document.createElement('td');
    for (const t of p.tags) {
      const s = document.createElement('span'); s.className = 'tag'; s.textContent = t;
      tdTags.appendChild(s);
    }

    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    const edit = document.createElement('button'); edit.textContent = 'Edit';
    edit.addEventListener('click', () => openProductForm(p.id));
    const del = document.createElement('button'); del.textContent = 'Delete';
    del.addEventListener('click', () => deleteProduct(p.id));
    tdAct.append(edit, ' ', del);

    tr.append(tdName, tdCat, tdPrice, tdQty, tdTarget, tdNeed, tdTags, tdAct);
    tbody.appendChild(tr);
  }
}

async function changeQty(id, delta) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  p.qty = Math.max(0, (Number(p.qty) || 0) + delta);
  await persist();
  renderStats();
  renderProducts();
}

async function deleteProduct(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Delete product "' + p.name + '"?')) return;
  data.products = data.products.filter(x => x.id !== id);
  await persist();
  refresh();
}

/* ---------- Product form ---------- */

function productCategoryOptions(selectEl) {
  selectEl.innerHTML = '';
  const none = document.createElement('option');
  none.value = ''; none.textContent = 'Uncategorized';
  selectEl.appendChild(none);
  const walk = (parentId, prefix) => {
    for (const c of childrenOf(parentId)) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = prefix + c.name;
      selectEl.appendChild(o);
      walk(c.id, prefix + c.name + ' / ');
    }
  };
  walk(null, '');
}

function updatePriceHint() {
  const hint = $('pfPriceHint');
  const catId = $('pfCategory').value || null;
  const probe = { price: null, categoryId: catId };
  const eff = pcEffectivePrice(data, probe);
  $('pfPrice').placeholder = eff.price !== null ? pcFmtPrice(eff.price) : 'no price anywhere';
  hint.textContent = eff.price !== null
    ? 'Leave blank to inherit ' + pcFmtPrice(eff.price) + ' from ' + eff.sourceName + '.'
    : 'No category price to inherit — leave blank for no price.';
}

function openProductForm(id) {
  editingProductId = id;
  const p = id ? data.products.find(x => x.id === id) : null;
  $('productFormTitle').textContent = p ? 'Edit product' : 'Add product';
  productCategoryOptions($('pfCategory'));
  $('pfName').value = p ? p.name : '';
  $('pfCategory').value = p ? (p.categoryId || '')
    : (selected !== 'all' && selected !== 'uncategorized' ? selected : '');
  $('pfPrice').value = p && p.price !== null ? p.price : '';
  $('pfQty').value = p ? p.qty : 0;
  $('pfTarget').value = p ? p.target : 0;
  $('pfTags').value = p ? p.tags.join(', ') : '';
  $('pfNotes').value = p ? p.notes : '';
  updatePriceHint();
  $('productModal').hidden = false;
  $('pfName').focus();
}

$('pfCategory').addEventListener('change', updatePriceHint);
$('addProductBtn').addEventListener('click', () => openProductForm(null));

$('productForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const name = $('pfName').value.trim();
  if (!name) return;
  const priceRaw = $('pfPrice').value;
  const values = {
    name,
    categoryId: $('pfCategory').value || null,
    price: priceRaw === '' ? null : Number(priceRaw),
    qty: Math.max(0, parseInt($('pfQty').value, 10) || 0),
    target: Math.max(0, parseInt($('pfTarget').value, 10) || 0),
    tags: $('pfTags').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: $('pfNotes').value.trim()
  };
  if (editingProductId) {
    Object.assign(data.products.find(x => x.id === editingProductId), values);
  } else {
    data.products.push(Object.assign({ id: pcUid() }, values));
  }
  $('productModal').hidden = true;
  await persist();
  refresh();
});

/* ---------- Modal close buttons / backdrop ---------- */
for (const btn of document.querySelectorAll('[data-close]')) {
  btn.addEventListener('click', () => { $(btn.dataset.close).hidden = true; });
}
for (const bd of document.querySelectorAll('.modal-backdrop')) {
  bd.addEventListener('click', ev => { if (ev.target === bd) bd.hidden = true; });
}

/* ---------- Filters ---------- */
$('search').addEventListener('input', renderProducts);
$('tagFilter').addEventListener('change', renderProducts);

/* ---------- Export / import / seed ---------- */

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('exportJsonBtn').addEventListener('click', () =>
  download('product-catalog.json', JSON.stringify(data, null, 2), 'application/json'));
$('exportCsvBtn').addEventListener('click', () =>
  download('product-catalog.csv', pcToCSV(data), 'text/csv'));
$('importJsonBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const parsed = pcNormalize(JSON.parse(await file.text()));
    if (!parsed.categories.length && !parsed.products.length &&
        !confirm('That file has no categories or products. Replace your catalog with it anyway?')) return;
    if ((data.categories.length || data.products.length) &&
        !confirm('Import replaces your entire current catalog. Continue?')) return;
    data = parsed;
    expanded.clear();
    for (const c of data.categories) expanded.add(c.id);
    selected = 'all';
    await persist();
    refresh();
  } catch (e) {
    alert('Import failed: that file is not valid catalog JSON.');
  }
});

$('seedBtn').addEventListener('click', async () => {
  if ((data.categories.length || data.products.length) &&
      !confirm('You already have catalog data. "Load my current lines" replaces it all. Continue?')) return;
  data = pcSeedData();
  expanded.clear();
  for (const c of data.categories) expanded.add(c.id);
  selected = 'all';
  await persist();
  refresh();
});

/* ---------- Init ---------- */
(async () => {
  data = await pcLoad();
  for (const c of data.categories) expanded.add(c.id);
  refresh();
})();
