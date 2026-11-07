'use strict';
/* =====================================================================
   BLIND TEST : l'hôte (ou le mode solo) joue les extraits de 30 s,
   les joueurs rejoignent avec un code depuis leur téléphone (PeerJS / WebRTC)
   et écrivent le titre et/ou l'artiste le plus vite possible.
   L'hôte fait autorité : il valide les réponses et calcule les scores.
   ===================================================================== */

const BT_KEY = 'versus.blind';
const BT_DEFAULTS = { rounds: 10, clip: 20, mode: 'both', hints: true, randomStart: false, autoNext: true, hostPlays: true };
let btSaved = {}; try { btSaved = JSON.parse(localStorage.getItem(BT_KEY)) || {}; } catch { }
const bt = {
  role: null,        // null | 'host' | 'player'
  G: null,           // état de la partie (hôte)
  P: null,           // état du joueur
  joinCode: '',      // code pré-rempli (lien d'invitation)
  settings: { ...BT_DEFAULTS, ...btSaved },
  name: localStorage.getItem('versus.name') || '',
};
const btSaveSettings = () => localStorage.setItem(BT_KEY, JSON.stringify(bt.settings));
const btAudio = new Audio();
btAudio.preload = 'auto';
btAudio.volume = Math.min(1, Math.max(0, parseFloat(localStorage.getItem('versus.vol') ?? '0.8')));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const btPid = () => { let p = localStorage.getItem('versus.pid'); if (!p) { p = uid() + uid(); localStorage.setItem('versus.pid', p); } return p; };
const btLink = code => location.origin + location.pathname.replace(/index\.html$/, '') + '?join=' + code;
const btPool = () => col().items.filter(i => i.sp);

/* ============ Comparaison des réponses (tolérante) ============ */
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/['’`´]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function cleanTitle(t) {
  const c = String(t || '').replace(/\s*[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/\s+[-–—]\s+.*$/, '').replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/i, '').replace(/\s+/g, ' ').trim();
  return c || String(t || '').trim();
}
function lev(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const tol = n => n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : n <= 16 ? 3 : 4;
function fuzzyEq(g, t) {
  const a = g.replace(/ /g, ''), b = t.replace(/ /g, '');
  if (!a || !b) return false;
  return a === b || lev(a, b, tol(b.length)) <= tol(b.length);
}
/* La réponse g (normalisée) contient-elle la cible T ? (mot à mot, avec fautes tolérées) */
function matchTarget(g, T) {
  if (!T) return false;
  if (fuzzyEq(g, T)) return true;
  const gw = g.split(' '), n = T.split(' ').length;
  for (let i = 0; i + n <= gw.length; i++) if (fuzzyEq(gw.slice(i, i + n).join(' '), T)) return true;
  return false;
}
function prepTrack(it) {
  const uniq = a => [...new Set(a.filter(Boolean))];
  return {
    sp: it.sp, title: it.title, sub: it.sub, img: it.img, preview: spPrev[it.sp],
    cleanTitle: cleanTitle(it.title),
    tT: uniq([norm(cleanTitle(it.title)), norm(it.title)]),
    aT: uniq(String(it.sub || '').split(',').map(norm)),
  };
}
const mask = (str, lvl) => str.split(/\s+/).map(w => [...w].map((ch, i) =>
  /[\p{L}\p{N}]/u.test(ch) ? (lvl >= 2 && i === 0 ? ch : '_') : ch).join(' ')).join('   ');
const publicTrack = t => ({ title: t.title, sub: t.sub, img: t.img, sp: t.sp });

/* ============ Accueil du blind test ============ */
function blindView() {
  if (bt.role === 'player') return playerView();
  if (bt.G) return hostView();
  const pool = btPool(), c = col(), ok = pool.length >= 4;
  return `
  <h2>🎧 Blind test</h2>
  <p class="hint">Un extrait de chaque son est joué : les joueurs écrivent le titre et/ou l’artiste le plus vite possible. Plus on répond vite, plus on marque.</p>
  <div class="panel bt-home">
    <div class="bt-pool"><b>${pool.length}</b> son${pool.length > 1 ? 's' : ''} Spotify dans « ${esc(c.name)} »
      ${ok ? '' : '<span class="err"> — ajoute-en au moins 4 avec le panneau ci-dessous</span>'}</div>
    <div class="row" style="margin-top:14px">
      <button class="btn" data-action="bt-host" ${ok ? '' : 'disabled'}>🌐 Créer un salon multijoueur</button>
      <button class="btn ghost" data-action="bt-solo" ${ok ? '' : 'disabled'}>🎮 Jouer ici (solo / même écran)</button>
    </div>
    <div class="bt-or">ou rejoindre le salon d’un ami</div>
    <div class="row">
      <input type="text" id="btJoinCode" placeholder="CODE" maxlength="5" style="width:110px;text-transform:uppercase;letter-spacing:3px;text-align:center" value="${esc(bt.joinCode)}">
      <input type="text" id="btJoinName" placeholder="Ton pseudo" maxlength="20" value="${esc(bt.name)}">
      <button class="btn ghost" data-action="bt-join">Rejoindre</button>
    </div>
  </div>
  ${spotifyPanel()}`;
}

/* ============ Hôte : création / partie ============ */
const newPlayer = (pid, name, connected) => ({ pid, name, score: 0, connected, tFound: false, aFound: false, gained: 0, last: 0 });

function btNewGame(online) {
  const G = bt.G = {
    online, code: '', peer: null, conns: new Map(), players: new Map(), phase: 'lobby', round: 0, total: 0,
    queue: [], played: [], cur: null, endsAt: 0, revEnds: 0, tick: null, revT: null, hint: null, hintLvl: 0,
    firstDone: {}, s: bt.settings, key: '', ready: !online, error: '', tries: 0, loadMsg: '',
  };
  if (!online) bt.settings.hostPlays = true;
  if (bt.settings.hostPlays) G.players.set('host', newPlayer('host', bt.name || 'Hôte', true));
  bt.role = 'host';
  if (online) btOpenPeer(G);
  btUpdateHost(true);
}

function btOpenPeer(G) {
  if (typeof Peer === 'undefined') { G.error = 'Multijoueur indisponible : impossible de charger PeerJS (vérifie ta connexion internet).'; return; }
  G.code = genCode();
  const peer = G.peer = new Peer('versus-bt-' + G.code);
  peer.on('open', () => { G.ready = true; btUpdateHost(true); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && G.tries++ < 5) { try { peer.destroy(); } catch { } btOpenPeer(G); return; }
    G.ready = false; G.error = 'Erreur réseau (' + e.type + '). Vérifie ta connexion puis recrée le salon.'; btUpdateHost(true);
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { } });
  peer.on('connection', conn => {
    conn.on('data', m => btOnMsg(conn, m));
    conn.on('close', () => {
      for (const [pid, c] of G.conns) if (c === conn) {
        G.conns.delete(pid); const p = G.players.get(pid); if (p) p.connected = false;
        btUpdateHost(); btCheckAllDone();
      }
    });
  });
}
const btSend = (conn, obj) => { try { if (conn && conn.open) conn.send(obj); } catch { } };

function btOnMsg(conn, m) {
  const G = bt.G; if (!G || !m || typeof m !== 'object') return;
  if (m.t === 'join') {
    const pid = String(m.pid || '').slice(0, 40); if (!pid || pid === 'host') return;
    let name = String(m.name || '').trim().slice(0, 20) || 'Joueur';
    let p = G.players.get(pid);
    if (!p) {
      const taken = new Set([...G.players.values()].map(x => x.name.toLowerCase()));
      let base = name, n = 2; while (taken.has(name.toLowerCase())) name = base + ' ' + n++;
      p = newPlayer(pid, name, true); G.players.set(pid, p);
    }
    const old = G.conns.get(pid); if (old && old !== conn) { try { old.close(); } catch { } }
    G.conns.set(pid, conn); conn._pid = pid; p.connected = true;
    btUpdateHost(); btSend(conn, { t: 'state', s: btPublicState() });
  } else if (m.t === 'answer' && conn._pid) {
    const fb = btGuess(conn._pid, m.text);
    if (fb) btSend(conn, fb);
  }
}

function btRemaining() {
  const G = bt.G;
  if (G.phase === 'countdown' || G.phase === 'playing') return Math.max(0, G.endsAt - Date.now());
  if (G.phase === 'reveal' && G.revEnds) return Math.max(0, G.revEnds - Date.now());
  return 0;
}
function btPublicState() {
  const G = bt.G;
  const s = {
    phase: G.phase, round: G.round, total: G.total, clip: G.s.clip, mode: G.s.mode, code: G.code,
    remaining: btRemaining(), hint: G.hint, loadMsg: G.loadMsg, hasHints: G.s.hints,
    players: [...G.players.values()].map(p => ({ pid: p.pid, name: p.name, score: p.score, connected: p.connected, t: p.tFound, a: p.aFound, g: p.gained })),
  };
  if (G.phase === 'reveal' && G.cur) s.reveal = publicTrack(G.cur);
  if (G.phase === 'end') s.tracks = G.played.map(publicTrack);
  return s;
}
function btBroadcast() {
  const G = bt.G; if (!G || !G.online) return;
  const msg = { t: 'state', s: btPublicState() };
  for (const c of G.conns.values()) btSend(c, msg);
}
/* Met à jour l'écran de l'hôte (rendu complet si la phase change, sinon retouches ciblées) et prévient les joueurs. */
function btUpdateHost(full) {
  const G = bt.G; if (!G) return;
  const key = G.phase + ':' + G.round;
  if (full || key !== G.key) { G.key = key; if (ui.tab === 'blind' && bt.role === 'host') render(); }
  else btPatchHost();
  btBroadcast();
}

/* ---------- Déroulement ---------- */
async function btStart() {
  const G = bt.G; if (!G || G.phase !== 'lobby') return;
  const connected = [...G.players.values()].filter(p => p.connected).length;
  if (!connected) return toast('Il faut au moins un joueur (coche « Je joue aussi » ou invite des amis).');
  G.phase = 'loading'; G.loadMsg = 'Préparation des extraits audio…'; btUpdateHost(true);
  // on pioche d'abord dans les titres dont l'extrait est déjà connu (instantané), au hasard parmi eux
  const want = G.s.rounds, pool = shuffle(btPool()).sort((a, b) => !!spPrev[b.sp] - !!spPrev[a.sp]);
  const valid = []; let i = 0;
  while (valid.length < want && i < pool.length) {
    const batch = pool.slice(i, i + Math.max(10, want - valid.length + 6)); i += batch.length;
    await spLoadPreviews(batch.map(b => b.sp));
    batch.forEach(b => { if (spPrev[b.sp]) valid.push(prepTrack(b)); });
  }
  if (valid.length < 1) {
    G.phase = 'lobby'; btUpdateHost(true);
    return toast('Impossible de récupérer les extraits audio (relais Spotify indisponible ?). Réessaie dans un instant.');
  }
  G.queue = valid; G.total = Math.min(want, valid.length); G.round = 0; G.played = [];
  G.players.forEach(p => { p.score = 0; p.tFound = p.aFound = false; p.gained = 0; });
  btNextRound();
}
function btNextRound() {
  const G = bt.G; clearTimeout(G.revT); clearInterval(G.tick);
  G.round++;
  if (G.round > G.total || !G.queue.length) return btEndGame();
  G.cur = G.queue.shift(); G.firstDone = {}; G.hint = null; G.hintLvl = 0;
  G.players.forEach(p => { p.tFound = p.aFound = false; p.gained = 0; });
  G.phase = 'countdown'; G.endsAt = Date.now() + 3000;
  btAudio.pause(); btAudio.src = G.cur.preview; btAudio.load();
  btAudio.onerror = () => {
    if (!bt.G || bt.G.phase === 'reveal' || bt.G.phase === 'end') return;
    toast('Extrait indisponible, on passe au suivant.'); G.round--; btNextRound();
  };
  btUpdateHost(true);
  G.revT = setTimeout(btStartPlaying, 3000);
  G.tick = setInterval(() => { const el = $('#btCount'); if (el) el.textContent = Math.max(1, Math.ceil((G.endsAt - Date.now()) / 1000)); }, 200);
}
function btStartPlaying() {
  const G = bt.G; if (!G || G.phase !== 'countdown') return;
  clearInterval(G.tick);
  G.phase = 'playing'; G.endsAt = Date.now() + G.s.clip * 1000;
  const go = () => {
    if (G.s.randomStart) btAudio.currentTime = Math.random() * Math.max(0, (btAudio.duration || 30) - G.s.clip);
    btAudio.play().catch(() => { G.needSound = true; btPatchHost(); });
  };
  if (btAudio.readyState >= 1) go(); else btAudio.addEventListener('loadedmetadata', go, { once: true });
  G.needSound = false;
  btUpdateHost(true);
  G.tick = setInterval(btTick, 250);
}
function btTick() {
  const G = bt.G; if (!G || G.phase !== 'playing') return;
  const rem = G.endsAt - Date.now(), frac = 1 - rem / (G.s.clip * 1000);
  if (G.s.hints) {
    const lvl = frac >= 0.65 ? 2 : frac >= 0.35 ? 1 : 0;
    if (lvl !== G.hintLvl) {
      G.hintLvl = lvl; G.hint = {};
      if (G.s.mode !== 'artist') G.hint.t = mask(G.cur.cleanTitle, lvl);
      if (G.s.mode !== 'title') G.hint.a = mask(String(G.cur.sub).split(',')[0].trim(), lvl);
      btUpdateHost();
    }
  }
  if (rem <= 0) btEndRound(); else btPatchTimer(rem);
}
function btCheckAllDone() {
  const G = bt.G; if (!G || G.phase !== 'playing') return;
  const act = [...G.players.values()].filter(p => p.connected);
  if (!act.length) return;
  const done = p => (G.s.mode === 'artist' || p.tFound) && (G.s.mode === 'title' || p.aFound);
  if (act.every(done)) { clearInterval(G.tick); setTimeout(() => { if (G.phase === 'playing') btEndRound(); }, 900); }
}
function btEndRound() {
  const G = bt.G; if (!G || G.phase !== 'playing') return;
  clearInterval(G.tick);
  G.phase = 'reveal'; G.played.push(G.cur);
  G.revEnds = G.s.autoNext ? Date.now() + 8000 : 0;
  btUpdateHost(true);
  if (G.s.autoNext) G.revT = setTimeout(btNextRound, 8000);
}
function btEndGame() {
  const G = bt.G; clearTimeout(G.revT); clearInterval(G.tick);
  G.phase = 'end'; G.round = G.total; G.revEnds = 0;
  btAudio.pause(); btUpdateHost(true);
}
function btReset() {
  const G = bt.G; clearTimeout(G.revT); clearInterval(G.tick); btAudio.pause();
  G.phase = 'lobby'; G.round = 0; G.cur = null; G.hint = null;
  G.players.forEach(p => { p.score = 0; p.tFound = p.aFound = false; p.gained = 0; });
  btUpdateHost(true);
}
function btClose() {
  const G = bt.G; if (!G) return;
  clearTimeout(G.revT); clearInterval(G.tick); btAudio.pause();
  G.conns.forEach(c => { try { c.close(); } catch { } });
  try { G.peer?.destroy(); } catch { }
  bt.G = null; bt.role = null; render();
}

/* ---------- Réponses ---------- */
function btAward(G, p, part) {
  const base = part === 't' ? 100 : (G.s.mode === 'both' ? 50 : 100);
  const frac = Math.max(0, (G.endsAt - Date.now()) / (G.s.clip * 1000));
  let pts = base + Math.round(base * 0.5 * frac);
  if (!G.firstDone[part]) { G.firstDone[part] = true; pts += 25; }
  p.score += pts; p.gained += pts; return pts;
}
function btGuess(pid, text) {
  const G = bt.G, p = G && G.players.get(pid);
  if (!p || G.phase !== 'playing') return null;
  const now = Date.now(); if (now - p.last < 350) return null; p.last = now;
  const g = norm(String(text).slice(0, 120)); if (!g) return null;
  const tr = G.cur, fb = { t: 'fb', title: null, artist: null, pts: 0 };
  if (G.s.mode !== 'artist' && !p.tFound && tr.tT.some(T => matchTarget(g, T))) { p.tFound = true; fb.title = true; fb.pts += btAward(G, p, 't'); }
  if (G.s.mode !== 'title' && !p.aFound && tr.aT.some(T => matchTarget(g, T))) { p.aFound = true; fb.artist = true; fb.pts += btAward(G, p, 'a'); }
  fb.miss = !(fb.title || fb.artist);
  if (!fb.miss) { btUpdateHost(); btCheckAllDone(); }
  return fb;
}
function btHostSubmit() {
  const inp = $('#btAnswer'); if (!inp || !inp.value.trim()) return;
  const fb = btGuess('host', inp.value); inp.value = '';
  if (fb) btShowFb(fb); inp.focus();
}

/* ============ Vues communes ============ */
const fbText = fb => fb.miss ? '❌ Raté, essaie encore !'
  : '✅ ' + [fb.title && 'Titre', fb.artist && 'Artiste'].filter(Boolean).join(' + ') + ' trouvé ! +' + fb.pts;
function btShowFb(fb) {
  const el = $('#btFb'); if (!el) return;
  el.textContent = fbText(fb); el.className = 'bt-fb ' + (fb.miss ? 'miss' : 'ok');
  if (!fb.miss) navigator.vibrate?.(60);
}
const rankOf = (players, pid) => [...players].sort((a, b) => b.score - a.score).findIndex(p => p.pid === pid) + 1;
function scoreboardHTML(players, meId, showGain) {
  const list = [...players].sort((a, b) => b.score - a.score);
  return `<ol class="bt-score">${list.map((p, i) => `
    <li class="${p.pid === meId ? 'me' : ''} ${p.connected ? '' : 'off'}">
      <span class="rk">${i + 1}</span><span class="nm">${esc(p.name)}${p.connected ? '' : ' <small>(déco)</small>'}</span>
      ${showGain && p.g ? `<span class="gain">+${p.g}</span>` : ''}<span class="pt">${p.score}</span></li>`).join('')}</ol>`;
}
function foundHTML(players, mode) {
  return players.map(p => `<span class="fchip ${(p.t || p.a) ? 'ok' : ''} ${p.connected ? '' : 'off'}">${esc(p.name)}
    ${mode !== 'artist' ? `<i class="${p.t ? 'on' : ''}">🎵</i>` : ''}${mode !== 'title' ? `<i class="${p.a ? 'on' : ''}">🎤</i>` : ''}</span>`).join('');
}
const hintHTML = (s) => s.hint ? `${s.hint.t ? `<div><small>TITRE</small>${esc(s.hint.t)}</div>` : ''}${s.hint.a ? `<div><small>ARTISTE</small>${esc(s.hint.a)}</div>` : ''}`
  : (s.hasHints ? '<div class="dim">Un indice apparaîtra…</div>' : '');
const modeLabel = m => m === 'both' ? 'titre + artiste' : m === 'title' ? 'le titre' : 'l’artiste';
function revealHTML(r) {
  return `<div class="bt-reveal">${cover(r)}<div class="t">${esc(r.title)}</div><div class="s">${esc(r.sub)}</div>
    <a class="play" href="https://open.spotify.com/track/${esc(r.sp)}" target="_blank" rel="noopener">▶ Ouvrir dans Spotify</a></div>`;
}
function podiumHTML(players, meId) {
  const list = [...players].sort((a, b) => b.score - a.score), top = list.slice(0, 3);
  const order = [top[1], top[0], top[2]], cls = ['p2', 'p1', 'p3'], medal = ['🥈', '🥇', '🥉'];
  return `<div class="podium">${order.map((p, i) => p ? `<div class="pod ${cls[i]} ${p.pid === meId ? 'me' : ''}"><div class="medal">${medal[i]}</div><div class="pn">${esc(p.name)}</div><div class="pp">${p.score} pts</div></div>` : '<div class="pod empty"></div>').join('')}</div>${scoreboardHTML(players, meId)}`;
}
const recapHTML = tracks => `<div class="tree-title">Les sons de la partie</div><div class="recap">${tracks.map(t => `
  <a class="rc" href="https://open.spotify.com/track/${esc(t.sp)}" target="_blank" rel="noopener">${cover(t)}<b>${esc(t.title)}</b><small>${esc(t.sub)}</small></a>`).join('')}</div>`;

/* ============ Écran de l'hôte ============ */
const btPlayers = () => [...bt.G.players.values()];
function playersChips() {
  const pl = btPlayers();
  if (!pl.length) return '<p class="hint">Personne pour l’instant…</p>';
  return `<ul class="bt-plist">${pl.map(p => `<li class="${p.connected ? '' : 'off'}"><span class="av" style="--h:${hash(p.name) % 360}">${esc(initials(p.name))}</span>${esc(p.name)}${p.pid === 'host' ? ' 👑' : ''}</li>`).join('')}</ul>`;
}
function hostView() {
  const G = bt.G, s = G.s, pl = btPlayers(), st = btPublicState();
  const head = G.online && G.code ? `<span class="bt-chip">Salon <b>${G.code}</b></span>` : '';
  const topbar = `<div class="bt-top"><span>🎧 Blind test ${head}</span><button class="btn ghost sm danger" data-action="bt-close">✕ Quitter</button></div>`;
  if (G.phase === 'lobby') {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const sel = (key, opts) => `<select data-bt-set="${key}">${opts.map(([v, n]) => `<option value="${v}" ${String(s[key]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const chk = (key, label) => `<label class="check" style="margin:0"><input type="checkbox" data-bt-set="${key}" ${s[key] ? 'checked' : ''} ${key === 'hostPlays' && !G.online ? 'disabled' : ''}> ${label}</label>`;
    return `${topbar}
    ${G.error ? `<p class="hint err">${esc(G.error)}</p>` : ''}
    ${G.online ? `<div class="bt-code-card">
      <small>Code du salon</small>
      <div class="bt-code">${G.ready ? G.code : '…'}</div>
      ${G.ready ? `<button class="btn sm" data-action="bt-copy">📋 Copier le lien d’invitation</button>
      <p class="hint" style="margin:10px 0 0">Les joueurs ouvrent le lien sur leur téléphone, ou vont sur le site → Blind test → « Rejoindre » + code.</p>
      ${local ? '<p class="hint err" style="margin:8px 0 0">⚠ Tu es en local : tes amis ne pourront pas ouvrir ce lien. Mets le site en ligne (Vercel) pour jouer à plusieurs, ou teste avec un 2ᵉ onglet.</p>' : ''}` : '<p class="hint">Connexion au serveur de jeu…</p>'}
    </div>` : ''}
    <div class="panel">
      <h2>Réglages de la partie</h2>
      <div class="bt-grid">
        <label>Manches ${sel('rounds', [5, 10, 15, 20, 30].map(n => [n, n]))}</label>
        <label>Durée de l’extrait ${sel('clip', [10, 15, 20, 30].map(n => [n, n + ' s']))}</label>
        <label>Il faut trouver ${sel('mode', [['both', 'Titre + artiste'], ['title', 'Le titre'], ['artist', 'L’artiste']])}</label>
        <label>Ton pseudo <input type="text" id="btHostName" maxlength="20" value="${esc(bt.name)}" placeholder="Hôte"></label>
      </div>
      <div class="row" style="margin-top:12px;gap:18px">
        ${chk('hints', '💡 Indices (lettres)')}${chk('randomStart', '🎲 Début aléatoire')}${chk('autoNext', '⏩ Manche suivante auto')}${G.online ? chk('hostPlays', '🙋 Je joue aussi') : ''}
      </div>
    </div>
    <div class="panel"><h2>Joueurs</h2><div id="btPlayers">${playersChips()}</div></div>
    <div style="text-align:center"><button class="btn" data-action="bt-start" ${G.ready ? '' : 'disabled'} style="font-size:18px;padding:14px 34px">▶ Lancer la partie</button></div>`;
  }
  if (G.phase === 'loading') return `${topbar}<div class="bt-center"><div class="vinyl spinning"></div><h2>${esc(G.loadMsg)}</h2></div>`;
  const header = `<div class="round-head"><h1>Manche ${G.round} / ${G.total}</h1><p>Trouve ${modeLabel(s.mode)}</p></div>`;
  if (G.phase === 'countdown') return `${topbar}${header}<div class="bt-center"><div class="bt-big" id="btCount">3</div><p class="hint">Prépare-toi…</p></div>`;
  if (G.phase === 'playing') {
    const fb = G.players.has('host');
    return `${topbar}${header}
    <div class="progress"><i id="btBar" style="width:0%"></i></div>
    <div class="bt-stage"><div class="vinyl spinning"></div><div class="bt-timer" id="btTimer">${G.s.clip}</div><div class="bt-hint" id="btHint">${hintHTML(st)}</div></div>
    <div id="btSound">${G.needSound ? '<button class="btn" data-action="bt-sound">🔊 Clique ici pour activer le son</button>' : ''}</div>
    ${fb ? `<form class="bt-form" onsubmit="event.preventDefault();btHostSubmit()"><input type="text" id="btAnswer" placeholder="Ta réponse (${modeLabel(s.mode)})…" autocomplete="off" autocapitalize="off"><button class="btn" type="submit">Valider</button></form><div id="btFb" class="bt-fb"></div>` : ''}
    <div class="bt-found" id="btFound">${foundHTML(st.players, s.mode)}</div>
    <div class="duel-tools"><button class="btn ghost sm" data-action="bt-next">⏭ Passer</button>
      <label class="vol">🔊 <input type="range" min="0" max="1" step="0.05" value="${btAudio.volume}" data-bt-vol></label></div>`;
  }
  if (G.phase === 'reveal') return `${topbar}${header}${revealHTML(st.reveal)}
    <div class="bt-gains">${scoreboardHTML(st.players, 'host', true)}</div>
    <div class="duel-tools"><button class="btn" data-action="bt-next">${G.round >= G.total ? '🏁 Résultats' : 'Suivant →'}</button>
      <label class="vol">🔊 <input type="range" min="0" max="1" step="0.05" value="${btAudio.volume}" data-bt-vol></label></div>`;
  return `${topbar}<div class="champion"><div class="crown">🏆</div><h1>Fin de la partie</h1>${podiumHTML(st.players, 'host')}</div>
    <div class="duel-tools"><button class="btn" data-action="bt-again">🔁 Rejouer</button><button class="btn ghost" data-action="bt-close">Quitter</button></div>${recapHTML(st.tracks)}`;
}
function btPatchHost() {
  const G = bt.G; if (!G || ui.tab !== 'blind') return;
  const st = btPublicState();
  if (G.phase === 'lobby' && $('#btPlayers')) $('#btPlayers').innerHTML = playersChips();
  if ($('#btFound')) $('#btFound').innerHTML = foundHTML(st.players, G.s.mode);
  if ($('#btHint')) $('#btHint').innerHTML = hintHTML(st);
  if ($('#btSound')) $('#btSound').innerHTML = G.needSound ? '<button class="btn" data-action="bt-sound">🔊 Clique ici pour activer le son</button>' : '';
}
function btPatchTimer(rem) {
  const G = bt.G, bar = $('#btBar'), t = $('#btTimer');
  if (bar) bar.style.width = (100 - rem / (G.s.clip * 10)) + '%';
  if (t) t.textContent = Math.ceil(rem / 1000);
}

/* ============ Joueur (téléphone) ============ */
function btJoin(code, name) {
  code = String(code).trim().toUpperCase(); name = String(name).trim().slice(0, 20);
  if (!/^[A-Z0-9]{5}$/.test(code)) return toast('Le code fait 5 caractères.');
  if (!name) return toast('Choisis un pseudo.');
  bt.name = name; localStorage.setItem('versus.name', name); bt.joinCode = code;
  bt.role = 'player';
  const P = bt.P = { code, name, pid: btPid(), peer: null, conn: null, state: null, status: 'connecting', error: '', fb: null, key: '', endsAt: 0, tries: 0, left: false };
  if (typeof Peer === 'undefined') { P.status = 'error'; P.error = 'Impossible de charger le module multijoueur (vérifie ta connexion internet).'; return render(); }
  P.peer = new Peer();
  P.peer.on('open', () => btPlayerConnect());
  P.peer.on('error', e => {
    if (e.type === 'peer-unavailable') { P.status = 'error'; P.error = 'Salon introuvable : vérifie le code, ou la partie est fermée.'; }
    else if (P.status !== 'open') { P.status = 'error'; P.error = 'Connexion impossible (' + e.type + ').'; }
    render();
  });
  P.peer.on('disconnected', () => { try { P.peer.reconnect(); } catch { } });
  render();
}
function btPlayerConnect() {
  const P = bt.P; if (!P || P.left) return;
  const conn = P.conn = P.peer.connect('versus-bt-' + P.code, { reliable: true });
  const timeout = setTimeout(() => { if (P.status === 'connecting') { P.status = 'error'; P.error = 'Pas de réponse du salon. Vérifie le code et réessaie.'; render(); } }, 12000);
  conn.on('open', () => { clearTimeout(timeout); P.status = 'open'; P.tries = 0; conn.send({ t: 'join', pid: P.pid, name: P.name }); });
  conn.on('data', m => {
    if (m.t === 'state') {
      P.state = m.s; P.endsAt = Date.now() + (m.s.remaining || 0);
      const key = m.s.phase + ':' + m.s.round;
      if (key !== P.key) { P.key = key; P.fb = null; render(); } else btPatchPlayer();
    } else if (m.t === 'fb') { P.fb = m; btShowFb(m); }
  });
  conn.on('close', () => {
    clearTimeout(timeout);
    if (P.left) return;
    P.status = 'closed'; render();
    if (P.tries++ < 15) setTimeout(() => { if (!P.left && P.status === 'closed') { P.status = 'connecting'; btPlayerConnect(); } }, 2000);
  });
}
function btLeave() {
  const P = bt.P; if (P) { P.left = true; try { P.conn?.close(); P.peer?.destroy(); } catch { } }
  bt.P = null; bt.role = null; bt.joinCode = '';
  if (location.search) history.replaceState(null, '', location.pathname);
  ui.tab = 'blind'; render();
}
function playerView() {
  const P = bt.P, quit = '<button class="btn ghost sm" data-action="bt-leave">Quitter</button>';
  if (!P) return `<div class="bt-join"><div class="logo" style="text-align:center">VERSUS<span>Blind test</span></div>
    <div class="panel"><h2>Rejoindre une partie</h2>
      <input type="text" id="btJoinCode" placeholder="CODE" maxlength="5" style="width:100%;text-transform:uppercase;letter-spacing:6px;text-align:center;font-size:26px" value="${esc(bt.joinCode)}">
      <input type="text" id="btJoinName" placeholder="Ton pseudo" maxlength="20" style="width:100%;margin-top:10px" value="${esc(bt.name)}">
      <button class="btn" data-action="bt-join" style="width:100%;margin-top:14px">Rejoindre</button>
      <div style="text-align:center;margin-top:12px">${quit}</div></div></div>`;
  if (!P.state) {
    return `<div class="bt-join"><div class="bt-center"><div class="vinyl spinning"></div>
      <h2>${P.status === 'error' ? esc(P.error) : 'Connexion au salon ' + esc(P.code) + '…'}</h2>${quit}</div></div>`;
  }
  const s = P.state, me = s.players.find(p => p.pid === P.pid) || { score: 0, t: false, a: false, g: 0 };
  const top = `<div class="bt-ptop"><span>${esc(P.name)}</span><span class="bt-chip">${esc(P.code)}</span><span><b>${me.score}</b> pts</span></div>
    ${P.status === 'closed' ? '<div class="bt-warn">Connexion perdue… reconnexion en cours</div>' : ''}`;
  const head = `<div class="round-head" style="padding:12px"><h1 style="font-size:24px">Manche ${s.round} / ${s.total}</h1><p style="margin-top:6px;font-size:15px">Trouve ${modeLabel(s.mode)}</p></div>`;
  let body = '';
  if (s.phase === 'lobby') body = `<div class="bt-center"><h2>✅ Tu es dans le salon !</h2><p class="hint">En attendant que l’hôte lance la partie…<br>Réglages : ${modeLabel(s.mode)} · extraits de ${s.clip} s</p>
    <ul class="bt-plist">${s.players.map(p => `<li class="${p.connected ? '' : 'off'}"><span class="av" style="--h:${hash(p.name) % 360}">${esc(initials(p.name))}</span>${esc(p.name)}${p.pid === P.pid ? ' (toi)' : ''}</li>`).join('')}</ul></div>`;
  else if (s.phase === 'loading') body = `<div class="bt-center"><div class="vinyl spinning"></div><h2>Préparation…</h2></div>`;
  else if (s.phase === 'countdown') body = `${head}<div class="bt-center"><div class="bt-big" id="pCount">3</div><p class="hint">Prépare-toi, écoute bien l’écran de l’hôte !</p></div>`;
  else if (s.phase === 'playing') {
    const done = (s.mode === 'artist' || me.t) && (s.mode === 'title' || me.a);
    body = `${head}<div class="progress"><i id="pBar" style="width:0%"></i></div>
      <div class="bt-timer" id="pTimer">${s.clip}</div>
      <div class="bt-hint" id="pHint">${hintHTML(s)}</div>
      <div class="bt-status" id="pStatus">${statusHTML(s, me)}</div>
      <form class="bt-form" onsubmit="event.preventDefault();btPlayerSubmit()">
        <input type="text" id="btAnswer" placeholder="${done ? 'Tout trouvé ! 🎉' : 'Ta réponse…'}" autocomplete="off" autocapitalize="off" ${done ? 'disabled' : ''}>
        <button class="btn" type="submit" ${done ? 'disabled' : ''}>OK</button></form>
      <div id="btFb" class="bt-fb"></div>
      <div class="bt-found" id="pFound">${foundHTML(s.players, s.mode)}</div>`;
  } else if (s.phase === 'reveal') body = `${head}${revealHTML(s.reveal)}
    <div class="bt-mine">${me.g ? `Tu gagnes <b>+${me.g}</b> points 🎉` : 'Pas de point cette fois…'}</div>${scoreboardHTML(s.players, P.pid, true)}`;
  else body = `<div class="champion" style="padding:10px"><div class="crown">🏆</div><h1>Fin de la partie</h1>
    <p class="hint">Tu finis <b>${rankOf(s.players, P.pid)}ᵉ</b> sur ${s.players.length} avec ${me.score} points</p>${podiumHTML(s.players, P.pid)}</div>${recapHTML(s.tracks || [])}`;
  return `<div class="bt-join">${top}${body}<div style="text-align:center;margin-top:16px">${quit}</div></div>`;
}
const statusHTML = (s, me) => [s.mode !== 'artist' && `<span class="${me.t ? 'ok' : ''}">🎵 Titre ${me.t ? '✓' : ''}</span>`, s.mode !== 'title' && `<span class="${me.a ? 'ok' : ''}">🎤 Artiste ${me.a ? '✓' : ''}</span>`].filter(Boolean).join('');
function btPatchPlayer() {
  const P = bt.P, s = P && P.state; if (!s) return;
  const me = s.players.find(p => p.pid === P.pid) || { t: false, a: false };
  if ($('#pFound')) $('#pFound').innerHTML = foundHTML(s.players, s.mode);
  if ($('#pHint')) $('#pHint').innerHTML = hintHTML(s);
  if ($('#pStatus')) $('#pStatus').innerHTML = statusHTML(s, me);
  const done = s.phase === 'playing' && (s.mode === 'artist' || me.t) && (s.mode === 'title' || me.a);
  const inp = $('#btAnswer'); if (inp && done) { inp.disabled = true; inp.placeholder = 'Tout trouvé ! 🎉'; $('.bt-form button').disabled = true; }
}
function btPlayerSubmit() {
  const P = bt.P, inp = $('#btAnswer'); if (!P || !inp || !inp.value.trim() || P.status !== 'open') return;
  btSend(P.conn, { t: 'answer', text: inp.value.trim().slice(0, 120) }); inp.value = ''; inp.focus();
}
/* Chronomètre local des joueurs (le temps restant est envoyé par l'hôte à chaque changement). */
setInterval(() => {
  const P = bt.P; if (bt.role !== 'player' || !P || !P.state) return;
  const rem = Math.max(0, P.endsAt - Date.now()), s = P.state;
  if (s.phase === 'playing') {
    const bar = $('#pBar'), t = $('#pTimer');
    if (bar) bar.style.width = (100 - rem / (s.clip * 10)) + '%';
    if (t) t.textContent = Math.ceil(rem / 1000);
  } else if (s.phase === 'countdown' && $('#pCount')) $('#pCount').textContent = Math.max(1, Math.ceil(rem / 1000));
}, 200);

/* ============ Actions & événements ============ */
function blindAction(action, a) {
  switch (action) {
    case 'bt-host': btNewGame(true); return true;
    case 'bt-solo': btNewGame(false); return true;
    case 'bt-join': btJoin($('#btJoinCode')?.value, $('#btJoinName')?.value); return true;
    case 'bt-leave': btLeave(); return true;
    case 'bt-start': btStart(); return true;
    case 'bt-next': {
      const G = bt.G; if (!G) return true;
      if (G.phase === 'playing') btEndRound(); else if (G.phase === 'reveal') btNextRound(); return true;
    }
    case 'bt-again': btReset(); return true;
    case 'bt-close': btClose(); return true;
    case 'bt-sound': btAudio.play().then(() => { bt.G.needSound = false; btPatchHost(); }).catch(() => { }); return true;
    case 'bt-copy': {
      const link = btLink(bt.G.code);
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Lien copié !'), () => ask({ title: 'Copie ce lien', input: true, value: link, ok: 'OK' }));
      return true;
    }
  }
  return false;
}
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.btSet; if (!k || !bt.G) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : (isNaN(e.target.value) ? e.target.value : +e.target.value);
  bt.settings[k] = v; btSaveSettings();
  if (k === 'hostPlays') {
    if (v) bt.G.players.set('host', newPlayer('host', bt.name || 'Hôte', true)); else bt.G.players.delete('host');
    btPatchHost();
  }
  btBroadcast();
});
document.addEventListener('input', e => {
  if (e.target.id === 'btHostName' && bt.G) {
    bt.name = e.target.value.trim().slice(0, 20); localStorage.setItem('versus.name', bt.name);
    const h = bt.G.players.get('host'); if (h) { h.name = bt.name || 'Hôte'; btPatchHost(); btBroadcast(); }
  }
  if (e.target.dataset && e.target.dataset.btVol !== undefined) {
    btAudio.volume = +e.target.value; localStorage.setItem('versus.vol', e.target.value);
  }
  if (e.target.id === 'btJoinCode') bt.joinCode = e.target.value.toUpperCase();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.id === 'btJoinCode' || e.target.id === 'btJoinName')) blindAction('bt-join');
});
window.addEventListener('beforeunload', () => { try { bt.G?.peer?.destroy(); bt.P?.peer?.destroy(); } catch { } });
