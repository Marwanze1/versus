'use strict';
/* ============ Utils ============ */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const initials = t => (String(t).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();

/* ============ State ============ */
const KEY = 'versus.v1';
const DEFAULT_TIERS = () => [
  { id: uid(), name: 'S', color: '#ff5a4f' },
  { id: uid(), name: 'A', color: '#ff9a3c' },
  { id: uid(), name: 'B', color: '#ffd23c' },
  { id: uid(), name: 'C', color: '#8fdc5a' },
  { id: uid(), name: 'D', color: '#4fb6ff' },
];
function newCollection(name, items = []) {
  return { id: uid(), name, items, tiers: DEFAULT_TIERS(), place: {}, bracket: null };
}
function seed() {
  const raw = [
    ['Menace', 'PNL'], ['Dégun', 'Lagui'], ['Deux Frères', 'PNL'], ['Temps Mort', 'Booba'],
    ['QALF', 'Damso'], ['Civilisation', 'Orelsan'], ['Cyborg', 'Nekfeu'], ['Rooftop', 'SCH'],
    ['Mauvais Garçon', 'Jul'], ['Destin', 'Ninho'], ['Ipséité', 'Damso'], ['Le Monde Chico', 'PNL'],
    ['Jeunes entrepreneurs', 'Ninho'], ['Rêvalité', 'Jul'], ['Ouest Side', 'Booba'], ['Feu de Bois', 'Nekfeu'],
  ].map(([title, sub]) => ({ id: uid(), title, sub, img: '', link: '' }));
  const c = newCollection('Albums rap FR', raw);
  return { cur: c.id, cols: { [c.id]: c } };
}
let store;
try { store = JSON.parse(localStorage.getItem(KEY)); } catch { }
if (!store || !store.cols || !store.cols[store.cur]) store = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { alert('Stockage plein : supprime quelques images.'); } };
const col = () => store.cols[store.cur];
const itemById = id => col().items.find(i => i.id === id);

const ui = { tab: 'items', selected: null, editId: null, formImg: '', showTree: false, size: null, mix: true, lock: false,
  spUrl: '', sp: { loading: false, error: '', res: null, sel: new Set() } };

/* ============ Rendering helpers ============ */
function cover(it, extra = '') {
  if (it.img) return `<div class="cover ${extra}" style='background-image:url("${esc(it.img.replace(/"/g, '%22'))}")'></div>`;
  return `<div class="cover gen ${extra}" style="--h:${hash(it.title) % 360}"><span>${esc(initials(it.title))}</span></div>`;
}

/* ============ Header / tabs ============ */
function renderHeader() {
  $('#colSelect').innerHTML = Object.values(store.cols).map(c => `<option value="${c.id}" ${c.id === store.cur ? 'selected' : ''}>${esc(c.name)} (${c.items.length})</option>`).join('');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === ui.tab));
}
function render() {
  document.body.classList.toggle('player-mode', bt.role === 'player');
  if (bt.role === 'player') { $('#app').innerHTML = playerView(); return; }
  renderHeader();
  const app = $('#app');
  if (ui.tab === 'items') app.innerHTML = itemsView();
  else if (ui.tab === 'tier') app.innerHTML = tierView();
  else if (ui.tab === 'blind') app.innerHTML = blindView();
  else app.innerHTML = bracketView();
  if (ui.tab === 'items') bindItemsForm();
}

/* ============ Items tab ============ */
function itemsView() {
  const c = col();
  const e = ui.editId ? itemById(ui.editId) : null;
  const preview = { title: e ? e.title : '?', img: ui.formImg };
  return `
  ${e ? '' : spotifyPanel()}
  <div class="panel">
    <h2>${e ? 'Modifier l’élément' : 'Ajouter un élément à la main'}</h2>
    <p class="hint">Un élément = une carte (album, film, perso, plat…). Image optionnelle : sans image, une pochette colorée est générée.</p>
    <div class="form-grid">
      <div class="upload">
        <div id="imgPrev">${cover(preview)}</div>
        <small>Clique pour choisir</small>
        <input type="file" id="fImg" accept="image/*" hidden>
      </div>
      <div class="form-fields">
        <input type="text" id="fTitle" placeholder="Titre (ex : Menace)" value="${esc(e?.title)}">
        <input type="text" id="fSub" placeholder="Sous-titre (ex : PNL)" value="${esc(e?.sub)}">
        <input type="url" id="fImgUrl" class="full" placeholder="…ou URL d’image (https://…)" value="${esc(e && e.img && !e.img.startsWith('data:') ? e.img : '')}">
        <input type="url" id="fLink" class="full" placeholder="Lien optionnel (Spotify, YouTube…) → bouton ▶ dans les duels" value="${esc(e?.link)}">
        <div class="full row">
          <button class="btn" data-action="item-save">${e ? 'Enregistrer' : '＋ Ajouter'}</button>
          ${e ? '<button class="btn ghost" data-action="item-cancel">Annuler</button>' : ''}
        </div>
      </div>
    </div>
    ${e ? '' : `
    <details class="bulk"><summary>Ajout rapide (un élément par ligne)</summary>
      <textarea id="bulk" placeholder="Menace - PNL&#10;Dégun - Lagui&#10;QALF - Damso"></textarea>
      <button class="btn ghost sm" data-action="bulk-add">Ajouter les lignes</button>
    </details>`}
  </div>
  <h2>${esc(c.name)} · ${c.items.length} élément${c.items.length > 1 ? 's' : ''}</h2>
  <p class="hint">Clique sur ✕ pour supprimer un titre, ✎ pour le modifier.</p>
  ${c.items.length ? `<div class="items-grid">${c.items.map(it => `
    <div class="item-card">
      ${cover(it)}
      <div class="acts">
        <button class="icon-btn" data-action="item-edit" data-id="${it.id}" title="Modifier">✎</button>
        <button class="icon-btn" data-action="item-del" data-id="${it.id}" title="Supprimer">✕</button>
      </div>
      <div class="t">${esc(it.title)}</div><div class="s">${esc(it.sub) || '&nbsp;'}</div>
    </div>`).join('')}</div>` : '<div class="empty">Aucun élément pour l’instant. Ajoute-en ci-dessus 👆</div>'}`;
}
function fileToSquare(file, size = 360) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement('canvas');
        c.width = c.height = Math.min(size, s);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', .85));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function bindItemsForm() {
  const up = $('.upload'); if (!up) return;
  const file = $('#fImg');
  up.querySelector('.cover').onclick = () => file.click();
  file.onchange = async () => {
    if (!file.files[0]) return;
    try { ui.formImg = await fileToSquare(file.files[0]); } catch { return alert('Image illisible.'); }
    refreshPreview();
  };
  $('#fImgUrl').oninput = e => { ui.formImg = e.target.value.trim(); refreshPreview(); };
  $('#fTitle').oninput = refreshPreview;
  $('#fTitle').onkeydown = $('#fSub').onkeydown = e => { if (e.key === 'Enter') saveItem(); };
}
function refreshPreview() {
  $('#imgPrev').innerHTML = cover({ title: $('#fTitle').value || '?', img: ui.formImg });
  $('#imgPrev .cover').onclick = () => $('#fImg').click();
}
function saveItem() {
  const title = $('#fTitle').value.trim();
  if (!title) return $('#fTitle').focus();
  const data = { title, sub: $('#fSub').value.trim(), img: ui.formImg, link: $('#fLink').value.trim() };
  if (ui.editId) Object.assign(itemById(ui.editId), data);
  else col().items.push({ id: uid(), ...data });
  ui.editId = null; ui.formImg = '';
  save(); render();
  if (!ui.editId) $('#fTitle')?.focus();
}

/* ============ Tier list ============ */
function tierView() {
  const c = col();
  const inTier = id => c.tiers.some(t => t.id === id);
  const itemsIn = tid => c.items.filter(i => c.place[i.id] === tid);
  const pool = c.items.filter(i => !c.place[i.id] || !inTier(c.place[i.id]));
  const chip = i => `<div class="chip ${ui.selected === i.id ? 'selected' : ''}" draggable="true" data-chip="${i.id}" title="${esc(i.title)}${i.sub ? ' — ' + esc(i.sub) : ''}">${cover(i)}<div class="cap">${esc(i.title)}</div></div>`;
  if (!c.items.length) return '<div class="empty">Ajoute d’abord des éléments dans l’onglet 🎴 Éléments.</div>';
  return `
  <h2>Tier list</h2>
  <p class="hint">Glisse les cartes dans un tier — ou touche une carte puis touche un tier (mobile). Clique sur le nom d’un tier pour le renommer.</p>
  <div class="tier-wrap">
    ${c.tiers.map(t => `
      <div class="tier-row">
        <div class="tier-label" style="background:${t.color}">
          <div class="name" contenteditable="true" spellcheck="false" data-tname="${t.id}">${esc(t.name)}</div>
          <div class="tools">
            <input type="color" value="${t.color}" data-tcolor="${t.id}" title="Couleur">
            <button class="mini" data-action="tier-del" data-id="${t.id}" title="Supprimer ce tier">✕</button>
          </div>
        </div>
        <div class="dropzone" data-zone="${t.id}">${itemsIn(t.id).map(chip).join('')}</div>
      </div>`).join('')}
  </div>
  <div class="tier-actions">
    <button class="btn ghost sm" data-action="tier-add">＋ Ajouter un tier</button>
    <button class="btn ghost sm" data-action="tier-reset">Tout remettre en bas</button>
    <button class="btn sm" data-action="tier-export">📷 Exporter en image</button>
  </div>
  <div class="pool">
    <h3>Non classés (${pool.length})</h3>
    <div class="dropzone" data-zone="">${pool.map(chip).join('')}</div>
  </div>`;
}
function placeItem(id, tier) {
  if (tier) col().place[id] = tier; else delete col().place[id];
  ui.selected = null; save(); render();
}
async function exportTier() {
  const c = col(), S = 100, LW = 150, W = 1100, per = Math.floor((W - LW - 12) / S);
  const imgs = {};
  await Promise.all(c.items.filter(i => i.img).map(i => new Promise(r => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { imgs[i.id] = im; r(); }; im.onerror = r; im.src = i.img;
  })));
  const rows = c.tiers.map(t => ({ t, items: c.items.filter(i => c.place[i.id] === t.id) }));
  const heights = rows.map(r => Math.max(1, Math.ceil(r.items.length / per)) * S);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = heights.reduce((a, b) => a + b, 0) + 56;
  const g = cv.getContext('2d');
  g.fillStyle = '#121212'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#1ed760'; g.font = '900 26px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(c.name.toUpperCase(), 14, 28);
  let y = 56;
  rows.forEach((r, ri) => {
    g.fillStyle = r.t.color; g.fillRect(0, y, LW, heights[ri]);
    g.fillStyle = '#111'; g.font = '900 34px sans-serif'; g.textAlign = 'center';
    g.fillText(r.t.name, LW / 2, y + heights[ri] / 2, LW - 16);
    g.fillStyle = '#181818'; g.fillRect(LW, y, W - LW, heights[ri]);
    r.items.forEach((it, k) => {
      const x = LW + 6 + (k % per) * S, yy = y + Math.floor(k / per) * S + 2, s = S - 4;
      if (imgs[it.id]) g.drawImage(imgs[it.id], x, yy, s, s);
      else {
        const h = hash(it.title) % 360, gr = g.createLinearGradient(x, yy, x + s, yy + s);
        gr.addColorStop(0, `hsl(${h},70%,45%)`); gr.addColorStop(1, `hsl(${h + 50},70%,16%)`);
        g.fillStyle = gr; g.fillRect(x, yy, s, s);
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '900 26px sans-serif'; g.textAlign = 'center';
        g.fillText(initials(it.title), x + s / 2, yy + s / 2);
      }
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x, yy + s - 18, s, 18);
      g.fillStyle = '#fff'; g.font = '700 11px sans-serif'; g.textAlign = 'center';
      g.fillText(it.title, x + s / 2, yy + s - 9, s - 6);
    });
    y += heights[ri];
    g.fillStyle = '#121212'; g.fillRect(0, y - 2, W, 2);
  });
  try {
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png'); a.download = `${c.name.replace(/\W+/g, '_')}_tierlist.png`; a.click();
  } catch { alert('Export impossible : une des images (URL externe) bloque l’export. Importe-la depuis ton ordinateur à la place.'); }
}

/* ============ Bracket ============ */
function derive(b) {
  const rounds = []; let cur = [];
  for (let i = 0; i < b.seed.length; i += 2) cur.push({ a: b.seed[i], b: b.seed[i + 1], w: null });
  rounds.push(cur);
  let r = 0, m = 0, done = false, champion = null;
  for (const p of b.picks) {
    const match = rounds[r][m];
    match.w = p === 'a' ? match.a : match.b;
    m++;
    if (m >= rounds[r].length) {
      if (rounds[r].length === 1) { done = true; champion = match.w; break; }
      const next = [];
      for (let i = 0; i < rounds[r].length; i += 2) next.push({ a: rounds[r][i].w, b: rounds[r][i + 1].w, w: null });
      rounds.push(next); r++; m = 0;
    }
  }
  return { rounds, r, m, done, champion };
}
function bracketView() {
  const c = col(), b = c.bracket;
  if (!b) return setupView();
  const d = derive(b);
  const total = b.seed.length - 1;
  if (d.done) return championView(c, d);
  const m = d.rounds[d.r][d.m], A = itemById(m.a), B = itemById(m.b);
  const n = d.rounds[d.r].length;
  const title = n === 1 ? 'Finale' : n === 2 ? 'Demi-finales' : `Round ${d.r + 1}`;
  const side = (it, k) => `
    <div class="duel-card" data-pick="${k}">
      ${cover(it)}
      <div class="t">${esc(it.title)}</div><div class="s">${esc(it.sub) || '&nbsp;'}</div>
      ${it.sp ? `<iframe class="sp-embed" src="https://open.spotify.com/embed/track/${esc(it.sp)}?theme=0" width="100%" height="80" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>` : ''}
      ${it.link && !it.sp ? `<a class="play" href="${esc(it.link)}" target="_blank" rel="noopener">▶ Écouter / voir</a>` : ''}
      <div class="hintpick">Choisir ${k === 'a' ? '←' : '→'}</div>
    </div>`;
  return `
  <div class="round-head"><h1>${title}</h1><p>Match ${d.m + 1} / ${n}</p></div>
  <div class="progress"><i style="width:${(b.picks.length / total) * 100}%"></i></div>
  <div class="arena">${side(A, 'a')}<div class="vs">VS</div>${side(B, 'b')}</div>
  <div class="duel-tools">
    <button class="btn ghost sm" data-action="b-undo" ${b.picks.length ? '' : 'disabled'}>↩ Annuler le dernier choix</button>
    <button class="btn ghost sm" data-action="b-tree">${ui.showTree ? 'Masquer' : 'Voir'} l’arbre</button>
    <button class="btn ghost sm danger" data-action="b-reset">Abandonner</button>
  </div>
  <p class="hint" style="text-align:center;margin-top:10px">Astuce : touches ← / → pour choisir, Z pour annuler.</p>
  ${ui.showTree ? treeHTML(b, d) : ''}`;
}
function setupView() {
  const c = col(), n = c.items.length;
  const sizes = [4, 8, 16, 32, 64, 128].filter(s => s <= n);
  if (!sizes.length) return `<div class="empty">Il faut au moins 4 éléments pour lancer un bracket (tu en as ${n}).</div>`;
  if (!sizes.includes(ui.size)) ui.size = sizes[sizes.length - 1];
  return `
  <div class="setup">
    <h2>Lancer un tournoi</h2>
    <p class="hint">Choisis le nombre de participants. S’il y a plus d’éléments que de places, ils sont tirés au sort.</p>
    <div class="size-pick">${sizes.map(s => `<button class="${s === ui.size ? 'on' : ''}" data-size="${s}">${s}<small>${Math.log2(s)} rounds</small></button>`).join('')}</div>
    <label class="check"><input type="checkbox" id="mix" ${ui.mix ? 'checked' : ''}> Mélanger le tirage</label><br>
    <button class="btn" data-action="b-start">⚔️ Lancer le bracket (${ui.size})</button>
  </div>`;
}
function championView(c, d) {
  const w = itemById(d.champion);
  return `
  <div class="champion">
    <div class="crown">👑</div><h1>Vainqueur du tournoi</h1>
    ${cover(w)}
    <div class="t">${esc(w.title)}</div><div class="s">${esc(w.sub)}</div>
    <div class="duel-tools" style="margin-top:22px">
      <button class="btn" data-action="b-start-same">🔁 Rejouer</button>
      <button class="btn ghost" data-action="b-to-tier">🏆 Envoyer dans la tier list</button>
      <button class="btn ghost" data-action="b-undo">↩ Annuler le dernier choix</button>
      <button class="btn ghost" data-action="b-reset">Nouveau tournoi</button>
    </div>
  </div>
  <div class="tree-title">Arbre du tournoi</div>${treeHTML(c.bracket, d)}`;
}
function treeHTML(b, d) {
  const rounds = Math.log2(b.seed.length);
  const label = (k) => { const n = b.seed.length / 2 ** (k + 1); return n === 1 ? 'Finale' : n === 2 ? 'Demi-finales' : n === 4 ? 'Quarts' : `Round ${k + 1}`; };
  const cell = (id, m, other) => {
    if (!id) return '<div class="tbd">à déterminer</div>';
    const cls = m.w ? (m.w === id ? 'w' : 'l') : '';
    return `<div class="${cls}">${esc(itemById(id)?.title)}</div>`;
  };
  let html = '<div class="tree">';
  for (let k = 0; k < rounds; k++) {
    const n = b.seed.length / 2 ** (k + 1);
    const ms = d.rounds[k] || Array.from({ length: n }, () => ({ a: null, b: null, w: null }));
    html += `<div class="tree-col"><h4>${label(k)}</h4>${ms.map((m, i) =>
      `<div class="tmatch ${!d.done && k === d.r && i === d.m ? 'cur' : ''}">${cell(m.a, m)}${cell(m.b, m)}</div>`).join('')}</div>`;
  }
  return html + '</div>';
}
function startBracket(size) {
  const ids = (ui.mix ? shuffle(col().items) : col().items).slice(0, size).map(i => i.id);
  col().bracket = { seed: ids, picks: [] };
  save(); render();
}
function pick(k, el) {
  if (ui.lock) return; ui.lock = true;
  if (el) { el.classList.add('win'); el.parentElement.querySelectorAll('.duel-card').forEach(x => { if (x !== el) x.classList.add('lose'); }); }
  setTimeout(() => { col().bracket.picks.push(k); ui.lock = false; save(); render(); }, 380);
}
function bracketToTier() {
  const c = col(), b = c.bracket, d = derive(b);
  const rank = {};
  d.rounds.forEach((ms, r) => ms.forEach(m => {
    const loser = m.w === m.a ? m.b : m.a;
    rank[loser] = d.rounds.length - 1 - r + 1; // finale loser=1, semis=2, ...
  }));
  rank[d.champion] = 0;
  const T = c.tiers.length;
  b.seed.forEach(id => { c.place[id] = c.tiers[Math.min(rank[id], T - 1)].id; });
  ui.tab = 'tier'; save(); render();
}

/* ============ Toast (avec annulation) ============ */
let toastTimer;
function toast(msg, onUndo) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${onUndo ? '<button>↩ Annuler</button>' : ''}`;
  t.classList.add('show');
  if (onUndo) t.querySelector('button').onclick = () => { onUndo(); t.classList.remove('show'); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}

/* ============ Fenêtres de dialogue (remplacent prompt/confirm, bloqués dans certains navigateurs) ============ */
function ask({ title, text = '', input = false, value = '', placeholder = '', ok = 'OK', danger = false }) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `<form class="modal">
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      ${input ? `<input type="text" id="mInput" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:16px">
        <button type="button" class="btn ghost sm" data-r="cancel">Annuler</button>
        <button type="submit" class="btn sm ${danger ? 'dangerbtn' : ''}">${esc(ok)}</button>
      </div></form>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('#mInput');
    const done = v => { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', e => { if (e.target === ov) done(null); });
    ov.querySelector('[data-r=cancel]').onclick = () => done(null);
    ov.querySelector('form').onsubmit = e => { e.preventDefault(); done(input ? (inp.value.trim() || null) : true); };
    (inp || ov.querySelector('[type=submit]')).focus(); inp?.select();
  });
}

/* ============ Events ============ */
document.addEventListener('click', async e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { ui.tab = tab.dataset.tab; ui.selected = null; return render(); }

  const sz = e.target.closest('[data-size]');
  if (sz) { ui.size = +sz.dataset.size; return render(); }

  const pk = e.target.closest('[data-pick]');
  if (pk && !e.target.closest('a')) return pick(pk.dataset.pick, pk);

  const chip = e.target.closest('[data-chip]');
  if (chip) { ui.selected = ui.selected === chip.dataset.chip ? null : chip.dataset.chip; return render(); }

  const zone = e.target.closest('[data-zone]');
  if (zone && ui.selected && !e.target.closest('[data-tname],input')) return placeItem(ui.selected, zone.dataset.zone);

  const a = e.target.closest('[data-action]');
  if (!a) return;
  const id = a.dataset.id, c = col();
  switch (a.dataset.action) {
    case 'col-new': {
      const n = await ask({ title: 'Nouvelle collection', input: true, placeholder: 'Ex : Albums rap, Films Marvel…', ok: 'Créer' }); if (!n) return;
      const nc = newCollection(n.trim()); store.cols[nc.id] = nc; store.cur = nc.id; ui.tab = 'items'; ui.size = null; save(); render(); break;
    }
    case 'col-rename': { const n = await ask({ title: 'Renommer la collection', input: true, value: c.name, ok: 'Renommer' }); if (n) { c.name = n; save(); render(); } break; }
    case 'col-delete': {
      if (Object.keys(store.cols).length < 2) return toast('Il faut garder au moins une collection.');
      if (!await ask({ title: `Supprimer « ${c.name} » ?`, text: `Ses ${c.items.length} éléments seront supprimés définitivement.`, ok: 'Supprimer', danger: true })) return;
      delete store.cols[c.id]; store.cur = Object.keys(store.cols)[0]; save(); render(); break;
    }
    case 'sp-fetch': spFetch(); break;
    case 'sp-add': spAdd(); break;
    case 'sp-toggle': { const s = ui.sp.sel; s.has(id) ? s.delete(id) : s.add(id); const n = s.size, b = $('[data-action="sp-add"]'); b.disabled = !n; b.textContent = `＋ Ajouter ${n} titre${n > 1 ? 's' : ''}`; return; }
    case 'sp-all': { const s = ui.sp; s.sel = s.sel.size ? new Set() : new Set(s.res.items.map(i => i.sp)); render(); break; }
    case 'item-save': saveItem(); break;
    case 'item-cancel': ui.editId = null; ui.formImg = ''; render(); break;
    case 'item-edit': ui.editId = id; ui.formImg = itemById(id).img || ''; render(); scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'item-del': {
      const idx = c.items.findIndex(i => i.id === id); if (idx < 0) return;
      const snap = { item: c.items[idx], idx, place: c.place[id], bracket: c.bracket, col: c.id };
      c.items.splice(idx, 1); delete c.place[id]; c.bracket = null; save(); render();
      toast(`« ${snap.item.title} » supprimé`, () => {
        const cc = store.cols[snap.col]; if (!cc) return;
        cc.items.splice(snap.idx, 0, snap.item);
        if (snap.place) cc.place[snap.item.id] = snap.place;
        cc.bracket = snap.bracket; save(); render();
      });
      break;
    }
    case 'bulk-add': {
      const lines = $('#bulk').value.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach(l => { const [t, ...s] = l.split(/\s+[-–—]\s+/); c.items.push({ id: uid(), title: t.trim(), sub: s.join(' - ').trim(), img: '', link: '' }); });
      if (lines.length) { c.bracket = null; save(); render(); } break;
    }
    case 'tier-add': c.tiers.push({ id: uid(), name: 'Nouveau', color: '#b07cff' }); save(); render(); break;
    case 'tier-del':
      if (c.tiers.length < 2) return;
      c.tiers = c.tiers.filter(t => t.id !== id); save(); render(); break;
    case 'tier-reset': if (await ask({ title: 'Tout remettre en bas ?', text: 'Toutes les cartes retournent dans « Non classés ».', ok: 'Remettre' })) { c.place = {}; save(); render(); } break;
    case 'tier-export': exportTier(); break;
    case 'b-start': startBracket(ui.size); break;
    case 'b-start-same': startBracket(c.bracket.seed.length); break;
    case 'b-undo': c.bracket.picks.pop(); save(); render(); break;
    case 'b-tree': ui.showTree = !ui.showTree; render(); break;
    case 'b-reset': if (!c.bracket || await ask({ title: 'Abandonner ce tournoi ?', text: 'Les choix déjà faits seront perdus.', ok: 'Abandonner', danger: true })) { c.bracket = null; save(); render(); } break;
    case 'b-to-tier': bracketToTier(); break;
    default: if (!spotifyAction(a.dataset.action, a)) blindAction(a.dataset.action, a);
  }
});

$('#colSelect').addEventListener('change', e => { store.cur = e.target.value; ui.size = null; ui.editId = null; ui.selected = null; save(); render(); });
document.addEventListener('change', e => { if (e.target.id === 'mix') ui.mix = e.target.checked; });

// tier names / colors
document.addEventListener('input', e => {
  if (e.target.id === 'spUrl') { ui.spUrl = e.target.value; return; }
  const c = col();
  if (e.target.dataset.tcolor) {
    const t = c.tiers.find(t => t.id === e.target.dataset.tcolor);
    t.color = e.target.value; e.target.closest('.tier-label').style.background = t.color; save();
  }
});
document.addEventListener('focusout', e => {
  if (e.target.dataset?.tname) {
    const t = col().tiers.find(t => t.id === e.target.dataset.tname);
    t.name = e.target.textContent.trim() || '?'; save();
  }
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'spUrl' && e.key === 'Enter') return spFetch();
  if (e.target.dataset?.tname && e.key === 'Enter') { e.preventDefault(); e.target.blur(); return; }
  if (ui.tab !== 'bracket' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  const b = col().bracket; if (!b || derive(b).done) return;
  if (e.key === 'ArrowLeft') pick('a', $('[data-pick="a"]'));
  else if (e.key === 'ArrowRight') pick('b', $('[data-pick="b"]'));
  else if (e.key.toLowerCase() === 'z' && b.picks.length) { b.picks.pop(); save(); render(); }
});

// drag & drop (tier list)
let dragId = null;
document.addEventListener('dragstart', e => {
  const ch = e.target.closest?.('[data-chip]'); if (!ch) return;
  dragId = ch.dataset.chip; ch.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
});
document.addEventListener('dragend', () => { dragId = null; $$('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
document.addEventListener('dragover', e => { const z = e.target.closest?.('[data-zone]'); if (z && dragId) { e.preventDefault(); $$('.over').forEach(x => x !== z && x.classList.remove('over')); z.classList.add('over'); } });
document.addEventListener('drop', e => { const z = e.target.closest?.('[data-zone]'); if (z && dragId) { e.preventDefault(); placeItem(dragId, z.dataset.zone); dragId = null; } });

/* Démarrage : lien d'invitation (?join=CODE) → écran joueur ; retour de la connexion Spotify (?code=…) */
{
  const j = new URLSearchParams(location.search).get('join');
  if (j) { bt.role = 'player'; bt.joinCode = j.toUpperCase().slice(0, 5); }
}
spotifyInit().finally(render);
