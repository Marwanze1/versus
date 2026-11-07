'use strict';
/* =====================================================================
   Spotify : import par lien (via /api/spotify), connexion du compte
   (PKCE, sans secret) et recherche dans tout le catalogue.
   Chargé AVANT app.js ; utilise ses helpers ($, esc, cover, col, ui…) à l'exécution.
   ===================================================================== */

const SP_KEY = 'versus.spotify', SP_PKCE = 'versus.spotify.pkce';
const spCfg = () => { try { return JSON.parse(localStorage.getItem(SP_KEY)) || {}; } catch { return {}; } };
const spSetCfg = o => localStorage.setItem(SP_KEY, JSON.stringify({ ...spCfg(), ...o }));
const spRedirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
const spConnected = () => !!spCfg().refresh;
const SP_PACKS = [
  ['🔥 Hits du moment', '37i9dQZF1DXcBWIGoYBM5M'], ['🇫🇷 Top 50 France', '37i9dQZEVXbIPWwFssbupI'],
  ['🌍 Top 50 Monde', '37i9dQZEVXbMDoHDwVN2tF'], ['🎤 RapCaviar', '37i9dQZF1DX0XUsuxWHRQd'],
  ['📼 Années 80', '37i9dQZF1DX4UtSsGT1Sbe'], ['💿 Années 90', '37i9dQZF1DXbTxeAdrVG2l'],
  ['🪩 Années 2000', '37i9dQZF1DX4o1oenSJRJd'],
];
const SP_PREV_KEY = 'versus.prev';
const spPrev = {}; // id -> URL de l'extrait audio ('' = pas d'extrait)
try { Object.assign(spPrev, JSON.parse(localStorage.getItem(SP_PREV_KEY)) || {}); } catch { }
const spPrevSave = () => {
  const keep = Object.entries(spPrev).filter(([, u]) => u).slice(-3000);
  try { localStorage.setItem(SP_PREV_KEY, JSON.stringify(Object.fromEntries(keep))); } catch { }
};

/* ---------- Accès aux pages Spotify ----------
   1) le serveur du site (server.py en local, api/spotify.py sur Vercel) ;
   2) sinon (ex. GitHub Pages, sans serveur) : le navigateur lit lui-même les pages publiques
      de Spotify via des relais CORS publics (moins fiables : ils peuvent être en panne). */
const SP_LINK_RE = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|album|playlist|artist)[\/:]([A-Za-z0-9]{22})/;
const SP_NEXT_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
// Chaque relais renvoie [adresse, options fetch]. Essayés dans l'ordre ; les pages « indisponible dans votre pays » sont rejetées.
const SP_PROXIES = [
  u => ['https://r.jina.ai/' + u, { headers: { 'X-Return-Format': 'html' } }],
  u => ['https://api.allorigins.win/raw?url=' + encodeURIComponent(u)],
  u => ['https://allorigins.hexlet.app/raw?url=' + encodeURIComponent(u)],
];
let spServer = null; // null = pas encore testé, true/false = le serveur du site répond (ou non)

/* Lit une page Spotify via les relais publics. `valid(html)` permet d'exiger un contenu précis
   (le miroir de secours renvoie parfois une version de la page sans extrait audio). */
async function spProxyHtml(url, valid = () => true) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 1500)); // les relais limitent le débit : on patiente
    for (const mk of SP_PROXIES) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
      try {
        const [addr, opts] = mk(url);
        const r = await fetch(addr, { ...(opts || {}), signal: ctl.signal }), t = await r.text();
        if (r.ok && SP_NEXT_RE.test(t) && !t.includes('not available in your country') && valid(t)) return t;
      } catch { /* on essaie le relais suivant */ } finally { clearTimeout(to); }
    }
  }
  throw new Error('relais indisponible');
}
const spEntityOf = html => JSON.parse(SP_NEXT_RE.exec(html)[1]).props.pageProps.state.data.entity;
async function spPool(list, n, fn) {
  const it = list[Symbol.iterator]();
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { for (const x of it) await fn(x); }));
}
async function spThumb(tid) { // l'oEmbed de Spotify est accessible directement (CORS ouvert)
  try { return (await (await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + tid))).json()).thumbnail_url || ''; }
  catch { return ''; }
}
function spBestImage(ent) {
  const srcs = ((ent.coverArt || {}).sources || []).concat((ent.visualIdentity || {}).image || []).filter(s => s.url);
  return srcs.length ? srcs.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a)).url : '';
}
async function spClientResolve(link) {
  const m = SP_LINK_RE.exec(link || '');
  if (!m) return { status: 400, obj: { error: 'Lien Spotify non reconnu (playlist, album, artiste ou titre).' } };
  const [, kind, sid] = m;
  try {
    const ent = spEntityOf(await spProxyHtml(`https://open.spotify.com/embed/${kind}/${sid}`)), cover = spBestImage(ent);
    const names = t => (t.subtitle || '').replace(/ /g, ' ').trim();
    let items;
    if (kind === 'track') {
      items = [{ sp: sid, title: ent.name || ent.title, sub: (ent.artists || []).map(a => a.name).join(', ') || names(ent), img: cover, preview: (ent.audioPreview || {}).url || '' }];
    } else {
      items = (ent.trackList || []).map(t => {
        const id = (/spotify:track:([A-Za-z0-9]{22})/.exec(t.uri || '') || [])[1];
        return id && { sp: id, title: t.title, sub: names(t), img: kind === 'album' ? cover : '', preview: (t.audioPreview || {}).url || '' };
      }).filter(Boolean);
      if (kind !== 'album') await spPool(items, 6, async it => { it.img = (await spThumb(it.sp)) || cover; });
    }
    return { status: 200, obj: { kind, name: ent.name || ent.title || '', cover, items } };
  } catch {
    return { status: 502, obj: { error: 'Impossible de lire Spotify pour le moment (le relais public est indisponible). Réessaie dans un instant.' } };
  }
}
async function spClientPreviews(ids) {
  const out = {};
  await spPool(ids, 2, async id => {
    try {
      const html = await spProxyHtml(`https://open.spotify.com/embed/track/${id}`, t => t.includes('mp3-preview'));
      out[id] = (spEntityOf(html).audioPreview || {}).url || '';
    } catch { /* pas d'extrait trouvé : on réessaiera plus tard */ }
  });
  return out;
}
/* params = { url } (titres d'un lien) ou { ids } (extraits audio). Renvoie { status, obj }. */
async function spCall(params) {
  if (spServer !== false) {
    try {
      const r = await fetch('api/spotify?' + new URLSearchParams(params));
      if ((r.headers.get('content-type') || '').includes('json')) { spServer = true; return { status: r.status, obj: await r.json() }; }
    } catch { /* serveur injoignable */ }
    spServer = false;
  }
  return params.ids ? { status: 200, obj: await spClientPreviews(params.ids.split(',')) } : spClientResolve(params.url);
}

/* ---------- Extraits audio (30 s) ---------- */
async function spLoadPreviews(ids) {
  const need = [...new Set(ids)].filter(i => !spPrev[i]);
  const chunks = [];
  for (let i = 0; i < need.length; i += 30) chunks.push(need.slice(i, i + 30));
  await Promise.all(chunks.map(async ch => {
    try { Object.assign(spPrev, (await spCall({ ids: ch.join(',') })).obj); } catch { /* réseau : on réessaiera */ }
  }));
  spPrevSave();
}

/* ---------- Connexion (PKCE) ---------- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const spErr = msg => { ui.sp = { loading: false, error: msg, res: null, sel: new Set() }; render(); };

async function spLogin() {
  const clientId = ($('#spClientId')?.value || spCfg().clientId || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(clientId)) return spErr('Le Client ID fait 32 caractères (lettres et chiffres). Copie-le depuis ton application sur developer.spotify.com.');
  if (!crypto.subtle) return spErr('Connexion impossible : ouvre le site via http://127.0.0.1:8123 ou une adresse https.');
  spSetCfg({ clientId });
  const rnd = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const verifier = rnd(48), state = rnd(12);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem(SP_PKCE, JSON.stringify({ verifier, state }));
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: spRedirect(),
    code_challenge_method: 'S256', code_challenge: challenge, state,
  });
}

async function spTokenRequest(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: spCfg().clientId, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || 'Erreur Spotify');
  spSetCfg({ access: j.access_token, exp: Date.now() + j.expires_in * 1000, refresh: j.refresh_token || spCfg().refresh });
}

/* À appeler au démarrage : termine la connexion quand Spotify nous renvoie sur le site. */
async function spotifyInit() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return;
  const pk = JSON.parse(localStorage.getItem(SP_PKCE) || 'null');
  localStorage.removeItem(SP_PKCE);
  history.replaceState(null, '', location.pathname);
  ui.tab = 'items'; ui.spMode = 'search';
  if (p.get('error')) { ui.sp.error = 'Connexion à Spotify annulée.'; return; }
  if (!pk || p.get('state') !== pk.state) { ui.sp.error = 'Connexion invalide, réessaie.'; return; }
  try {
    await spTokenRequest({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: spRedirect(), code_verifier: pk.verifier });
  } catch (e) { ui.sp.error = 'Connexion refusée : ' + e.message + ' (vérifie que l’adresse de redirection est bien enregistrée dans ton app Spotify).'; }
}

async function spToken() {
  const c = spCfg();
  if (!c.refresh) return null;
  if (c.access && Date.now() < c.exp - 30000) return c.access;
  try { await spTokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh }); return spCfg().access; }
  catch { spSetCfg({ access: '', refresh: '', exp: 0 }); return null; }
}

/* ---------- Recherche dans tout Spotify ---------- */
const pickImg = imgs => (imgs && (imgs[1] || imgs[0]) || {}).url || '';
async function spSearch(more = false) {
  const q = ($('#spQ')?.value ?? ui.spQ ?? '').trim();
  if (!q) return;
  ui.spQ = q; ui.spType = $('#spType')?.value || ui.spType || 'track';
  const prev = more && ui.sp.res ? ui.sp.res : null, offset = prev ? prev.offset + 10 : 0;
  ui.sp = { loading: true, error: '', res: prev, sel: prev ? ui.sp.sel : new Set() }; render();
  try {
    const token = await spToken();
    if (!token) throw new Error('Session Spotify expirée : reconnecte-toi.');
    const type = ui.spType;
    const r = await fetch('https://api.spotify.com/v1/search?' + new URLSearchParams({ q, type, limit: 10, offset }), { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 403) throw new Error('Spotify refuse l’accès : ton compte doit être Premium et ajouté dans « User Management » de ton application (ou l’app doit être en mode Développement).');
    if (r.status === 429) throw new Error('Trop de recherches d’un coup, réessaie dans quelques secondes.');
    if (!r.ok) throw new Error('Erreur Spotify (' + r.status + ').');
    const j = (await r.json())[type + 's'];
    const raw = (j.items || []).filter(Boolean);
    const items = raw.map(x => type === 'track'
      ? { sp: x.id, title: x.name, sub: x.artists.map(a => a.name).join(', '), img: pickImg(x.album?.images) }
      : { url: x.external_urls?.spotify, sp: x.id, title: x.name, sub: type === 'album' ? x.artists.map(a => a.name).join(', ') : type === 'playlist' ? (x.owner?.display_name || '') : 'Artiste', img: pickImg(x.images) });
    const all = (prev ? prev.items : []).concat(items.filter(i => !(prev && prev.items.some(p => p.sp === i.sp))));
    ui.sp = { loading: false, error: all.length ? '' : 'Aucun résultat.', sel: ui.sp.sel,
      res: all.length ? { name: `Résultats pour « ${q} »`, mode: type === 'track' ? 'tracks' : 'containers', type, items: all, offset, hasMore: !!j.next, search: true } : null };
  } catch (e) {
    ui.sp = { loading: false, error: e.message === 'Failed to fetch' ? 'Pas de connexion à Spotify.' : e.message, res: prev, sel: ui.sp.sel };
  }
  render();
}

/* ---------- Import par lien ---------- */
async function spFetch(url) {
  url = (url || $('#spUrl')?.value || ui.spUrl || '').trim();
  if (!url) return;
  ui.spUrl = url; ui.spMode = 'link'; ui.sp = { loading: true, error: '', res: null, sel: new Set() }; render();
  try {
    const { status, obj: j } = await spCall({ url });
    if (status !== 200) throw new Error(j.error || 'Erreur');
    if (!j.items.length) throw new Error('Aucun titre trouvé dans ce lien.');
    j.items.forEach(i => { if (i.preview) spPrev[i.sp] = i.preview; });
    spPrevSave();
    const have = new Set(col().items.map(i => i.sp).filter(Boolean));
    ui.sp = { loading: false, error: '', res: { ...j, mode: 'tracks' }, sel: new Set(j.items.filter(i => !have.has(i.sp)).map(i => i.sp)) };
  } catch (e) {
    ui.sp = { loading: false, error: e.message, res: null, sel: new Set() };
  }
  render();
}

function spAdd() {
  const c = col(), s = ui.sp;
  s.res.items.filter(i => s.sel.has(i.sp)).forEach(i =>
    c.items.push({ id: uid(), title: i.title, sub: i.sub, img: i.img || '', link: `https://open.spotify.com/track/${i.sp}`, sp: i.sp }));
  c.bracket = null; ui.sp = { loading: false, error: '', res: null, sel: new Set() }; ui.spUrl = '';
  save(); render();
  toast('Titres ajoutés à « ' + c.name + ' »');
  spLoadPreviews(c.items.filter(i => i.sp && !spPrev[i.sp]).map(i => i.sp)); // extraits du blind test, en arrière-plan
}

/* ---------- Panneau ---------- */
function spotifyPanel() {
  const s = ui.sp, mode = ui.spMode || 'link', cfg = spCfg(), have = new Set(col().items.map(i => i.sp).filter(Boolean));
  const redirect = spRedirect(), onLocalhost = location.hostname === 'localhost';
  let head;
  if (mode === 'link') {
    head = `
    <p class="hint">Colle le lien d’une <b>playlist</b>, d’un <b>album</b>, d’un <b>artiste</b> (ses titres populaires) ou d’un <b>titre</b> : Spotify → ⋯ → Partager → Copier le lien. Aucune connexion nécessaire.</p>
    <div class="row">
      <input type="text" id="spUrl" style="flex:1;min-width:220px" placeholder="https://open.spotify.com/playlist/…" value="${esc(ui.spUrl)}">
      <button class="btn" data-action="sp-fetch" ${s.loading ? 'disabled' : ''}>Récupérer</button>
    </div>
    <div class="chips-row"><span class="hint" style="margin:0">Packs rapides :</span>${SP_PACKS.map(([n, id]) => `<button class="chip-btn" data-action="sp-pack" data-id="${id}">${n}</button>`).join('')}</div>`;
  } else if (spConnected()) {
    head = `
    <div class="row">
      <input type="text" id="spQ" style="flex:1;min-width:200px" placeholder="Titre, artiste, album… (ex : Damso Ipséité)" value="${esc(ui.spQ || '')}">
      <select id="spType">${[['track', 'Titres'], ['album', 'Albums'], ['playlist', 'Playlists'], ['artist', 'Artistes']].map(([v, n]) => `<option value="${v}" ${ (ui.spType || 'track') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn" data-action="sp-search" ${s.loading ? 'disabled' : ''}>Rechercher</button>
    </div>
    <p class="hint" style="margin-top:8px">✅ Compte Spotify connecté — tout le catalogue est accessible. <button class="linkbtn" data-action="sp-logout">Se déconnecter</button></p>`;
  } else {
    head = `
    <p class="hint">Pour chercher <b>n’importe quel titre</b> dans tout Spotify, connecte ton compte (une seule fois, ~2 minutes) :</p>
    <ol class="steps">
      <li>Va sur <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> → <b>Create app</b> (nom au choix).</li>
      <li><b>Redirect URI</b> : <code id="spRedir">${esc(redirect)}</code> <button class="linkbtn" data-action="sp-copy-redirect">copier</button> (puis « Add »)</li>
      <li>Coche <b>Web API</b>, accepte les conditions, <b>Save</b>, puis copie le <b>Client ID</b> (page Settings).</li>
    </ol>
    ${onLocalhost ? `<p class="hint err">⚠ Spotify refuse l’adresse « localhost ». Ouvre le site via <a href="http://127.0.0.1:${location.port}/">http://127.0.0.1:${location.port}/</a> avant de te connecter (tes collections y sont stockées à part).</p>` : ''}
    <div class="row">
      <input type="text" id="spClientId" style="flex:1;min-width:240px" placeholder="Client ID (32 caractères)" value="${esc(cfg.clientId || '')}">
      <button class="btn" data-action="sp-login">Se connecter à Spotify</button>
    </div>`;
  }

  let body = '';
  if (s.loading && !s.res) body = '<p class="hint">Chargement depuis Spotify… (les pochettes d’une grosse playlist peuvent prendre quelques secondes)</p>';
  if (s.error) body += `<p class="hint err">${esc(s.error)}</p>`;
  if (s.res) {
    const r = s.res, n = s.sel.size;
    if (r.mode === 'containers') {
      body += `<div class="sp-list" style="margin-top:12px">${r.items.map(it => `
        <div class="sp-row">${cover(it, 'sp-cov')}
          <span style="flex:1"><b>${esc(it.title)}</b><br><small>${esc(it.sub)}</small></span>
          <button class="btn sm" data-action="sp-open" data-url="${esc(it.url)}">Importer</button>
        </div>`).join('')}</div>`;
    } else {
      body += `
      <div class="row" style="justify-content:space-between;margin:12px 0 8px">
        <strong>${esc(r.name || 'Résultat')} · ${r.items.length} titre${r.items.length > 1 ? 's' : ''}</strong>
        <div class="row"><button class="btn ghost sm" data-action="sp-all">Tout cocher / décocher</button>
        <button class="btn sm" data-action="sp-add" ${n ? '' : 'disabled'}>＋ Ajouter ${n} titre${n > 1 ? 's' : ''}</button></div>
      </div>
      <div class="sp-list">${r.items.map(it => `
        <label class="sp-row ${have.has(it.sp) ? 'dup' : ''}">
          <input type="checkbox" data-action="sp-toggle" data-id="${it.sp}" ${s.sel.has(it.sp) ? 'checked' : ''}>
          ${cover(it, 'sp-cov')}
          <span><b>${esc(it.title)}</b><br><small>${esc(it.sub)}${have.has(it.sp) ? ' · déjà ajouté' : ''}</small></span>
        </label>`).join('')}</div>`;
    }
    if (r.search && r.hasMore) body += `<div style="text-align:center;margin-top:10px"><button class="btn ghost sm" data-action="sp-more" ${s.loading ? 'disabled' : ''}>${s.loading ? 'Chargement…' : '↓ Voir 10 résultats de plus'}</button></div>`;
  }
  return `
  <div class="panel spotify">
    <h2>🟢 Ajouter des sons depuis Spotify</h2>
    <div class="mini-tabs">
      <button class="${mode === 'link' ? 'on' : ''}" data-action="sp-mode" data-id="link">🔗 Coller un lien</button>
      <button class="${mode === 'search' ? 'on' : ''}" data-action="sp-mode" data-id="search">🔎 Rechercher dans tout Spotify</button>
    </div>
    ${head}${body}
  </div>`;
}

/* ---------- Actions ---------- */
function spotifyAction(action, a) {
  switch (action) {
    case 'sp-mode': ui.spMode = a.dataset.id; ui.sp = { loading: false, error: '', res: null, sel: new Set() }; render(); return true;
    case 'sp-pack': spFetch('https://open.spotify.com/playlist/' + a.dataset.id); return true;
    case 'sp-open': spFetch(a.dataset.url); return true;
    case 'sp-search': spSearch(false); return true;
    case 'sp-more': spSearch(true); return true;
    case 'sp-login': spLogin(); return true;
    case 'sp-logout': spSetCfg({ access: '', refresh: '', exp: 0 }); ui.sp = { loading: false, error: '', res: null, sel: new Set() }; render(); return true;
    case 'sp-copy-redirect': navigator.clipboard?.writeText(spRedirect()); toast('Adresse copiée'); return true;
  }
  return false;
}
document.addEventListener('input', e => { if (e.target.id === 'spQ') ui.spQ = e.target.value; });
document.addEventListener('change', e => { if (e.target.id === 'spType') ui.spType = e.target.value; });
document.addEventListener('keydown', e => { if (e.target.id === 'spQ' && e.key === 'Enter') spSearch(false); });
