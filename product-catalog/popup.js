'use strict';

let data = pcEmptyData();

function isLow(p) {
  return (p.target > 0 && p.qty < p.target) || p.qty === 0;
}

function renderList() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const list = document.getElementById('list');
  const title = document.getElementById('listTitle');
  let items;
  if (q) {
    title.textContent = 'Results';
    items = data.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q)) ||
      pcCategoryPathString(data, p.categoryId).toLowerCase().includes(q)
    ).slice(0, 8);
  } else {
    title.textContent = 'Low stock';
    items = data.products.filter(isLow)
      .sort((a, b) => pcRestockNeed(b) - pcRestockNeed(a)).slice(0, 5);
  }
  list.innerHTML = '';
  for (const p of items) {
    const eff = pcEffectivePrice(data, p);
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    const need = pcRestockNeed(p);
    meta.innerHTML = '';
    meta.textContent = pcFmtPrice(eff.price) + ' · ' + p.qty + ' in stock';
    if (need > 0) {
      const n = document.createElement('span');
      n.className = 'need';
      n.textContent = ' · need ' + need;
      meta.appendChild(n);
    }
    li.append(name, meta);
    list.appendChild(li);
  }
  document.getElementById('empty').hidden = items.length > 0 || data.products.length > 0 && !q;
  if (q && items.length === 0) {
    document.getElementById('empty').hidden = false;
    document.getElementById('empty').textContent = 'No products match that search.';
  } else if (!q && data.products.length > 0) {
    document.getElementById('empty').hidden = items.length > 0;
    document.getElementById('empty').textContent = 'Nothing low on stock. 🎉';
  } else if (!q) {
    document.getElementById('empty').textContent = 'Nothing here yet. Open the catalog to add products.';
  }
}

async function init() {
  data = await pcLoad();
  const s = pcStats(data);
  document.getElementById('tProducts').textContent = s.products;
  document.getElementById('tUnits').textContent = s.units;
  document.getElementById('tValue').textContent = pcFmtPrice(s.value);
  renderList();
}

document.getElementById('search').addEventListener('input', renderList);
document.getElementById('openCatalog').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('catalog.html') });
});
init();
