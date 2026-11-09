'use strict';
/* =====================================================================
   BRACKET EN DIRECT (pour les streamers) : l'hôte lance un tournoi, les spectateurs
   rejoignent avec un code ou un QR code (PeerJS / WebRTC, comme le blind test) et
   votent pour chaque duel. L'élément qui a le plus de votes passe au tour suivant ;
   l'hôte voit les votes évoluer en direct. L'hôte fait autorité (une seule voix par spectateur).
   Chargé avant app.js ; utilise ses helpers ($, esc, cover, col, derive, pick…) à l'exécution.
   ===================================================================== */

const LV_KEY = 'versus.live';
let lvSaved = {}; try { lvSaved = JSON.parse(localStorage.getItem(LV_KEY)) || {}; } catch { }
const lv = {
  H: null,                       // côté hôte : le salon de vote
  V: null,                       // côté spectateur
  sec: Number.isFinite(lvSaved.sec) ? lvSaved.sec : 30,   // durée d'un vote (0 = l'hôte valide à la main)
};
const LV_MAX = 500;              // spectateurs connectés en même temps
const lvLink = code => location.origin + location.pathname.replace(/index\.html$/, '') + '?vote=' + code;
const lvRoundTitle = (n, r) => n === 1 ? 'Finale' : n === 2 ? 'Demi-finales' : n === 4 ? 'Quarts de finale' : 'Round ' + (r + 1);
const lvInfo = it => it ? { title: it.title, sub: it.sub || '', img: /^https?:\/\//.test(it.img || '') ? it.img : '' } : null;
const lvPct = (n, tot) => tot ? Math.round(n * 100 / tot) : 0;

/* ============ Hôte ============ */
function lvOpen() {
  if (lv.H) return;
  const H = lv.H = { peer: null, code: '', ready: false, error: '', tries: 0, conns: new Map(), votes: new Map(),
    key: '', phase: 'wait', endsAt: 0, tick: null, result: null, match: null, champ: null, bracket: null, patchT: null, bcastT: null };
  lvOpenPeer(H);
  render();
}
function lvOpenPeer(H) {
  if (typeof Peer === 'undefined') { H.error = 'Impossible de charger PeerJS (vérifie ta connexion internet).'; return; }
  H.code = genCode();
  const peer = H.peer = new Peer('versus-bk-' + H.code);
  peer.on('open', () => { H.ready = true; lvSync(); render(); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && H.tries++ < 5) { try { peer.destroy(); } catch { } lvOpenPeer(H); return; }
    H.ready = false; H.error = 'Erreur réseau (' + e.type + '). Ferme le salon et rouvre-le.'; render();
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { } });
  peer.on('connection', conn => {
    conn.on('data', m => lvOnMsg(conn, m));
    conn.on('close', () => {
      if (conn._pid && H.conns.get(conn._pid) === conn) { H.conns.delete(conn._pid); lvBroadcastSoon(); lvPatchSoon(); }
    });
  });
}
function lvClose_room() {
  const H = lv.H; if (!H) return;
  clearInterval(H.tick); clearTimeout(H.patchT); clearTimeout(H.bcastT);
  for (const c of H.conns.values()) { try { c.close(); } catch { } }
  try { H.peer?.destroy(); } catch { }
  lv.H = null; render();
}
function lvOnMsg(conn, m) {
  const H = lv.H; if (!H || !m || typeof m !== 'object') return;
  if (m.t === 'join') {
    const pid = String(m.pid || '').slice(0, 40); if (!pid) return;
    if (!H.conns.has(pid) && H.conns.size >= LV_MAX) { lvSend(conn, { t: 'full' }); return; }
    const old = H.conns.get(pid); if (old && old !== conn) { try { old.close(); } catch { } }
    H.conns.set(pid, conn); conn._pid = pid;
    lvSend(conn, { t: 'st', s: lvState() });
    if (H.votes.has(pid)) lvSend(conn, { t: 'mine', key: H.key, k: H.votes.get(pid) });
    lvPatchSoon(); lvBroadcastSoon();
  } else if (m.t === 'vote' && conn._pid) {
    if (H.phase !== 'vote' || m.key !== H.key || (m.k !== 'a' && m.k !== 'b')) return;
    H.votes.set(conn._pid, m.k);
    lvPatchSoon();
  }
}
const lvSend = (conn, obj) => { try { if (conn && conn.open) conn.send(obj); } catch { } };
function lvCounts() {
  const H = lv.H, r = { a: 0, b: 0 };
  if (H) for (const k of H.votes.values()) r[k]++;
  return r;
}
function lvState() {
  const H = lv.H, s = { phase: H.phase, key: H.key, code: H.code, viewers: H.conns.size, secs: lv.sec };
  if (H.match) Object.assign(s, H.match);
  if (H.phase === 'vote') s.remaining = H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0;
  if (H.phase === 'result') s.result = H.result;
  if (H.phase === 'end') s.champ = H.champ;
  return s;
}
function lvBroadcast() {
  const H = lv.H; if (!H) return;
  const msg = { t: 'st', s: lvState() };
  for (const c of H.conns.values()) lvSend(c, msg);
}
// les messages à tous les spectateurs sont regroupés (500 spectateurs qui arrivent d'un coup = un seul envoi)
function lvBroadcastSoon() { const H = lv.H; if (H && !H.bcastT) H.bcastT = setTimeout(() => { H.bcastT = null; lvBroadcast(); }, 500); }

/* Appelée à chaque affichage du bracket : détecte le changement de duel et prévient les spectateurs. */
function lvSync() {
  const H = lv.H; if (!H) return;
  const c = col(), b = c.bracket, d = b ? derive(b) : null;
  let key, phase;
  if (!b) { key = 'none'; phase = 'wait'; }
  else if (d.done) { key = [c.id, 'done', b.seed.length, b.seed[0], b.picks.length].join(':'); phase = 'end'; }
  else { key = [c.id, b.seed.length, b.seed[0], b.picks.length].join(':'); phase = 'vote'; }
  H.bracket = b;
  if (key === H.key) return;
  clearInterval(H.tick); H.tick = null;
  H.key = key; H.phase = phase; H.votes.clear(); H.result = null; H.match = null; H.champ = null; H.endsAt = 0;
  if (phase === 'vote') {
    const n = d.rounds[d.r].length, m = d.rounds[d.r][d.m];
    H.match = { round: lvRoundTitle(n, d.r), m: d.m + 1, n, a: lvInfo(itemById(m.a)), b: lvInfo(itemById(m.b)) };
    if (lv.sec) { H.endsAt = Date.now() + lv.sec * 1000; H.tick = setInterval(lvTick, 250); }
  } else if (phase === 'end') H.champ = lvInfo(itemById(d.champion));
  lvBroadcast();
}
function lvTick() {
  const H = lv.H; if (!H || H.phase !== 'vote' || !H.endsAt) return;
  if (Date.now() >= H.endsAt) {
    if (lvCounts().a + lvCounts().b === 0) { H.endsAt = Date.now() + lv.sec * 1000; lvBroadcast(); } // personne n'a voté : on laisse du temps
    else lvValidate();
  }
  lvPatch();
}
/* Termine le vote : le plus voté gagne (égalité = tirage au sort), puis on passe au duel suivant après un court affichage du résultat. */
function lvValidate() {
  const H = lv.H; if (!H || H.phase !== 'vote') return;
  const cnt = lvCounts();
  if (cnt.a + cnt.b === 0) return toast('Aucun vote pour l’instant.');
  const w = cnt.a > cnt.b ? 'a' : cnt.b > cnt.a ? 'b' : (Math.random() < .5 ? 'a' : 'b');
  clearInterval(H.tick); H.tick = null; H.endsAt = 0;
  H.phase = 'result'; H.result = { w, a: cnt.a, b: cnt.b, tie: cnt.a === cnt.b };
  lvBroadcast(); lvPatch();
  const key = H.key, bracket = H.bracket;
  setTimeout(() => {
    if (lv.H !== H || H.key !== key || H.phase !== 'result' || col().bracket !== bracket) return;
    pick(w, $(`[data-pick="${w}"]`));
  }, 2200);
}
function lvPatchSoon() { const H = lv.H; if (H && !H.patchT) H.patchT = setTimeout(() => { H.patchT = null; lvPatch(); }, 150); }
/* Met à jour l'écran de l'hôte sans le redessiner (les lecteurs Spotify ne doivent pas se recharger). */
function lvPatch() {
  const H = lv.H; if (!H) return;
  const cnt = lvCounts(), tot = cnt.a + cnt.b;
  const set = (sel, fn) => $$(sel).forEach(fn);
  set('#lvViewers', e => e.textContent = H.conns.size);
  set('#lvVotes', e => e.textContent = tot);
  set('#lvTimer', e => e.textContent = H.phase === 'result' ? 'Résultat…' : H.endsAt ? Math.ceil(Math.max(0, H.endsAt - Date.now()) / 1000) + ' s' : 'Vote manuel');
  for (const k of ['a', 'b']) {
    const p = lvPct(cnt[k], tot);
    set(`[data-lvbar="${k}"] i`, e => e.style.width = p + '%');
    set(`[data-lvbar="${k}"] span`, e => e.textContent = `${cnt[k]} vote${cnt[k] > 1 ? 's' : ''} · ${p} %`);
    set(`#lvSplit [data-k="${k}"]`, e => { e.style.flexGrow = Math.max(p, 4); e.querySelector('b').textContent = p + ' %'; });
  }
  if (H.phase === 'result' && H.result) {
    $$('.duel-card').forEach(el => { const k = el.dataset.pick; el.classList.toggle('win', k === H.result.w); el.classList.toggle('lose', k !== H.result.w); });
  }
}

/* ---------- Panneau de l'hôte (dans l'onglet Bracket) ---------- */
function lvQR(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ scalable: true, margin: 2 }); } catch { return ''; }
}
function lvPanel() {
  const H = lv.H;
  if (!H) return `
  <div class="lv-panel off">
    <div><strong>Bracket en direct</strong>
    <p class="hint" style="margin:2px 0 0">Tes spectateurs rejoignent avec un code ou un QR code et votent sur leur téléphone : le plus voté passe au tour suivant.</p></div>
    <button class="btn" data-action="lv-open">📡 Ouvrir les votes en direct</button>
  </div>`;
  if (!H.ready) return `<div class="lv-panel off"><div><strong>Bracket en direct</strong><p class="hint ${H.error ? 'err' : ''}" style="margin:2px 0 0">${esc(H.error || 'Création du salon de vote…')}</p></div><button class="btn ghost" data-action="lv-stop">Fermer</button></div>`;
  const link = lvLink(H.code), local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const cnt = lvCounts(), tot = cnt.a + cnt.b, A = H.match?.a, B = H.match?.b;
  return `
  <div class="lv-panel">
    <div class="lv-join">
      <div class="lv-qr">${lvQR(link)}</div>
      <div class="lv-codebox">
        <small>Les spectateurs scannent le QR code, ou ouvrent le lien, ou entrent le code (onglet Bracket → « Rejoindre un vote »)</small>
        <div class="lv-url">${esc(link.replace(/^https?:\/\//, ''))}</div>
        <div class="lv-code">${esc(H.code)}</div>
        <div class="row"><button class="btn sm" data-action="lv-copy">📋 Copier le lien</button><button class="btn ghost sm danger" data-action="lv-stop">Fermer le salon</button></div>
      </div>
    </div>
    ${local ? '<p class="hint err" style="margin:8px 0 0">⚠ Tu es en local : tes spectateurs ne pourront pas ouvrir ce lien. Ouvre le site en ligne (marwanze1.github.io/versus).</p>' : ''}
    <div class="lv-stats">
      <span>${icHtml('users')} <b id="lvViewers">${H.conns.size}</b> spectateur${H.conns.size > 1 ? 's' : ''}</span>
      <span>${icHtml('chart')} <b id="lvVotes">${tot}</b> vote${tot > 1 ? 's' : ''} sur ce duel</span>
      <span class="lv-timer" id="lvTimer">${H.endsAt ? Math.ceil(Math.max(0, H.endsAt - Date.now()) / 1000) + ' s' : 'Vote manuel'}</span>
    </div>
    <div class="lv-split" id="lvSplit">
      <div data-k="a" style="flex-grow:${Math.max(lvPct(cnt.a, tot), 4)}"><span>${esc(A?.title || '')}</span><b>${lvPct(cnt.a, tot)} %</b></div>
      <div data-k="b" style="flex-grow:${Math.max(lvPct(cnt.b, tot), 4)}"><b>${lvPct(cnt.b, tot)} %</b><span>${esc(B?.title || '')}</span></div>
    </div>
    <div class="lv-ctrl">
      <label>Durée du vote
        <select id="lvSec">${[[0, 'Manuel'], [15, '15 s'], [30, '30 s'], [60, '1 min'], [120, '2 min']].map(([v, n]) => `<option value="${v}" ${v === lv.sec ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn" data-action="lv-validate" ${H.phase === 'vote' ? '' : 'disabled'}>Valider le vote maintenant</button>
    </div>
    <p class="hint" style="margin:8px 0 0">Égalité : tirage au sort. Tu peux aussi choisir toi-même en cliquant sur une carte.</p>
  </div>`;
}
/* Barre de votes affichée sous chaque carte du duel (hôte). */
function lvBar(k) {
  const H = lv.H; if (!H || !H.ready) return '';
  const cnt = lvCounts(), tot = cnt.a + cnt.b, p = lvPct(cnt[k], tot);
  return `<div class="vbar" data-lvbar="${k}"><i style="width:${p}%"></i><span>${cnt[k]} vote${cnt[k] > 1 ? 's' : ''} · ${p} %</span></div>`;
}

/* ============ Spectateur ============ */
function lvJoin(code) {
  code = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) return toast('Le code fait 5 caractères.');
  const V = lv.V = { code, pid: btPid(), peer: null, conn: null, st: null, stAt: 0, status: 'connecting', error: '', mine: {}, left: false, tries: 0, tick: null };
  if (typeof Peer === 'undefined') { V.status = 'error'; V.error = 'Impossible de charger le module multijoueur (vérifie ta connexion internet).'; return render(); }
  V.peer = new Peer();
  V.peer.on('open', () => lvConnect());
  V.peer.on('error', e => {
    if (e.type === 'peer-unavailable') { V.status = 'error'; V.error = 'Salon introuvable : vérifie le code, ou le streamer a fermé les votes.'; }
    else if (V.status !== 'open') { V.status = 'error'; V.error = 'Connexion impossible (' + e.type + ').'; }
    render();
  });
  V.peer.on('disconnected', () => { try { V.peer.reconnect(); } catch { } });
  V.tick = setInterval(lvViewerTick, 250);
  render();
}
function lvConnect() {
  const V = lv.V; if (!V || V.left) return;
  const conn = V.conn = V.peer.connect('versus-bk-' + V.code, { reliable: true });
  const timeout = setTimeout(() => { if (V.status === 'connecting') { V.status = 'error'; V.error = 'Pas de réponse du salon. Vérifie le code et réessaie.'; render(); } }, 12000);
  conn.on('open', () => { clearTimeout(timeout); V.status = 'open'; V.tries = 0; conn.send({ t: 'join', pid: V.pid }); });
  conn.on('data', m => {
    if (m.t === 'st') {
      const old = V.st; V.st = m.s; V.stAt = Date.now();
      if (old && old.key === m.s.key && old.phase === m.s.phase && old.viewers !== m.s.viewers && !m.s.remaining) { const e = $('#lvVwr'); if (e) e.textContent = m.s.viewers; return; }
      render();
    } else if (m.t === 'mine') { V.mine[m.key] = m.k; render(); }
    else if (m.t === 'full') { V.status = 'error'; V.error = 'Le salon est complet.'; render(); }
  });
  conn.on('close', () => {
    clearTimeout(timeout);
    if (V.left) return;
    V.status = 'closed'; render();
    if (V.tries++ < 15) setTimeout(() => { if (!V.left && V.status === 'closed') { V.status = 'connecting'; lvConnect(); } }, 2000);
  });
}
function lvVote(k) {
  const V = lv.V, s = V && V.st; if (!s || s.phase !== 'vote' || (k !== 'a' && k !== 'b')) return;
  V.mine[s.key] = k;
  try { navigator.vibrate?.(30); } catch { }
  try { V.conn?.send({ t: 'vote', pid: V.pid, key: s.key, k }); } catch { }
  render();
}
function lvLeave() {
  const V = lv.V; if (V) { V.left = true; clearInterval(V.tick); try { V.conn?.close(); V.peer?.destroy(); } catch { } }
  lv.V = null;
  if (location.search) history.replaceState(null, '', location.pathname);
  render();
}
/* Compte à rebours côté spectateur (la barre se vide d'elle-même entre deux messages de l'hôte). */
function lvViewerTick() {
  const V = lv.V, s = V && V.st; if (!s || s.phase !== 'vote' || !s.remaining) return;
  const left = Math.max(0, s.remaining - (Date.now() - V.stAt)), bar = $('#lvBarT'), t = $('#lvSecT');
  if (bar) bar.style.width = (left / (s.secs * 1000) * 100) + '%';
  if (t) t.textContent = Math.ceil(left / 1000) + ' s';
}
function lvViewerView() {
  const V = lv.V, quit = '<button class="btn ghost sm" data-action="lv-leave">Quitter</button>';
  if (!V) return '';
  const s = V.st;
  if (!s) return `<div class="bt-join"><div class="bt-center"><div class="vinyl spinning"></div>
    <h2>${V.status === 'error' ? esc(V.error) : 'Connexion au salon ' + esc(V.code) + '…'}</h2>${quit}</div></div>`;
  const top = `<div class="bt-ptop"><span class="logo" style="margin:0;font-size:18px">VERSUS</span><span class="bt-chip">${esc(V.code)}</span><span>${icHtml('users')} <b id="lvVwr">${s.viewers}</b></span></div>
    ${V.status === 'closed' ? '<div class="bt-warn">Connexion perdue… reconnexion en cours</div>' : ''}`;
  const opt = (k, it, extra = '', label = '') => `
    <button class="lv-opt ${extra}" data-action="lv-vote" data-k="${k}" ${s.phase === 'vote' ? '' : 'disabled'}>
      ${cover({ title: it.title, img: it.img })}
      <span class="tx"><b>${esc(it.title)}</b><small>${esc(it.sub) || '&nbsp;'}</small></span><em>${label}</em>
    </button>`;
  let body = '';
  if (s.phase === 'wait') body = `<div class="bt-center"><h2>Le tournoi va commencer</h2><p class="hint">Reste sur cette page : le premier duel apparaîtra ici.</p><div class="vinyl spinning"></div></div>`;
  else if (s.phase === 'vote') {
    const mine = V.mine[s.key];
    body = `
    <div class="bt-round"><span class="rn">${esc(s.round).toUpperCase()}</span><span class="rm">Duel ${s.m} / ${s.n}</span></div>
    ${s.remaining ? `<div class="lv-vtimer"><div class="progress"><i id="lvBarT" style="width:${s.remaining / (s.secs * 1000) * 100}%"></i></div><span id="lvSecT">${Math.ceil(s.remaining / 1000)} s</span></div>` : ''}
    <p class="hint" style="text-align:center;margin:6px 0 12px">${mine ? 'Vote enregistré. Tu peux encore changer d’avis !' : 'Touche ton favori pour voter'}</p>
    <div class="lv-duel">${opt('a', s.a, mine === 'a' ? 'on' : mine ? 'dim' : '', mine === 'a' ? '✅ Ton vote' : 'Voter')}<div class="lv-vs">VS</div>${opt('b', s.b, mine === 'b' ? 'on' : mine ? 'dim' : '', mine === 'b' ? '✅ Ton vote' : 'Voter')}</div>`;
  } else if (s.phase === 'result') {
    const r = s.result, tot = r.a + r.b, mine = V.mine[s.key], W = r.w;
    body = `
    <div class="bt-round"><span class="rn">${esc(s.round).toUpperCase()}</span><span class="rm">Résultat</span></div>
    <p class="hint" style="text-align:center;margin:6px 0 12px">${r.tie ? 'Égalité : tirage au sort !' : (mine ? (mine === W ? 'Ton choix passe au tour suivant !' : 'Pas cette fois…') : '&nbsp;')}</p>
    <div class="lv-duel">${opt('a', s.a, W === 'a' ? 'win' : 'lose', `${lvPct(r.a, tot)} %${W === 'a' ? ' 🏆' : ''}`)}<div class="lv-vs">VS</div>${opt('b', s.b, W === 'b' ? 'win' : 'lose', `${lvPct(r.b, tot)} %${W === 'b' ? ' 🏆' : ''}`)}</div>`;
  } else body = `
    <div class="champion" style="padding:10px"><div class="crown">👑</div><h1>Vainqueur du tournoi</h1>
      ${cover({ title: s.champ.title, img: s.champ.img })}
      <div class="t">${esc(s.champ.title)}</div><div class="s">${esc(s.champ.sub)}</div>
      <p class="hint" style="margin-top:14px">Merci d’avoir voté !</p></div>`;
  return `<div class="bt-join lv-view">${top}${body}<div style="text-align:center;margin-top:18px">${quit}</div></div>`;
}

/* ============ Actions ============ */
function liveAction(action, a) {
  switch (action) {
    case 'lv-open': lvOpen(); return true;
    case 'lv-start': startBracket(ui.size); lvOpen(); return true;
    case 'lv-stop': lvClose_room(); return true;
    case 'lv-validate': lvValidate(); return true;
    case 'lv-vote': lvVote(a.dataset.k); return true;
    case 'lv-leave': lvLeave(); return true;
    case 'lv-join': lvJoin($('#lvJoinCode')?.value || ''); return true;
    case 'lv-copy': {
      const link = lvLink(lv.H.code);
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Lien copié !'), () => ask({ title: 'Copie ce lien', input: true, value: link, ok: 'OK' }));
      return true;
    }
  }
  return false;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'lvSec') return;
  lv.sec = +e.target.value; localStorage.setItem(LV_KEY, JSON.stringify({ sec: lv.sec }));
  const H = lv.H;
  if (H && H.phase === 'vote') {           // le nouveau délai s'applique tout de suite au duel en cours
    clearInterval(H.tick); H.tick = null;
    H.endsAt = lv.sec ? Date.now() + lv.sec * 1000 : 0;
    if (lv.sec) H.tick = setInterval(lvTick, 250);
    lvBroadcast(); lvPatch();
  }
});
window.addEventListener('beforeunload', () => { try { lv.H?.peer?.destroy(); } catch { } });
