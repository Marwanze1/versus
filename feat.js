'use strict';
/* =====================================================================
   1) Playlists prêtes (barre de gauche) : 1 clic = une collection déjà remplie
   2) Battle de feat : on part d'un artiste, chacun cite à son tour un artiste
      qui a fait un feat avec le précédent. Pas de répétition, une vie perdue
      si on sèche ou si le temps est écoulé. Les feats connus sont validés
      automatiquement ; les autres passent par un « arbitre » (les joueurs).
   ===================================================================== */

/* ---------- Playlists prêtes ---------- */
const PRESETS = [
  { id: 'rapfr-artistes', name: 'Rappeurs FR', items: 'PNL|Booba|Damso|Orelsan|Nekfeu|SCH|Jul|Ninho|Lomepal|Vald|Gims|Soprano|Kaaris|Niska|Gazo|Tiakola|Werenoi|Hamza|Josman|Freeze Corleone|Alpha Wann|Bigflo & Oli|Lacrim|Rohff'.split('|').map(t => [t]) },
  { id: 'rapfr-classiques', name: 'Rap FR classiques', items: [
    ['Ma Benz', 'NTM'], ['Qui sème le vent', 'NTM'], ['That’s my people', 'NTM'], ['Police', 'NTM'], ['Petit frère', 'IAM'], ['Demain c’est loin', 'IAM'],
    ['Je danse le Mia', 'IAM'], ['Gravé dans la roche', 'Sniper'], ['Caroline', 'MC Solaar'], ['Bouge de là', 'MC Solaar'], ['Nouveau Western', 'MC Solaar'],
    ['Tonton du bled', '113'], ['Les Princes de la ville', '113'], ['Banlieusards', 'Kery James'], ['Lettre à la République', 'Kery James'], ['Paris sous les bombes', 'NTM'] ] },
  { id: 'rapus-artistes', name: 'Rappeurs US', items: 'Kendrick Lamar|Drake|Travis Scott|Kanye West|Jay-Z|Eminem|J. Cole|Tyler, the Creator|Future|Lil Wayne|50 Cent|Nas|Snoop Dogg|Tupac|The Notorious B.I.G.|Kid Cudi'.split('|').map(t => [t]) },
  { id: 'rapus-albums', name: 'Albums rap US', items: [
    ['To Pimp a Butterfly', 'Kendrick Lamar'], ['good kid, m.A.A.d city', 'Kendrick Lamar'], ['DAMN.', 'Kendrick Lamar'], ['Astroworld', 'Travis Scott'],
    ['My Beautiful Dark Twisted Fantasy', 'Kanye West'], ['The College Dropout', 'Kanye West'], ['Illmatic', 'Nas'], ['The Marshall Mathers LP', 'Eminem'],
    ['Take Care', 'Drake'], ['Nothing Was the Same', 'Drake'], ['Ready to Die', 'The Notorious B.I.G.'], ['Reasonable Doubt', 'Jay-Z'],
    ['The Blueprint', 'Jay-Z'], ['Flower Boy', 'Tyler, the Creator'], ['2014 Forest Hills Drive', 'J. Cole'], ['Get Rich or Die Tryin’', '50 Cent'] ] },
  { id: 'hits-pop', name: 'Hits pop & R&B', items: [
    ['Hey Ya!', 'OutKast'], ['Crazy in Love', 'Beyoncé'], ['Umbrella', 'Rihanna'], ['Poker Face', 'Lady Gaga'], ['Single Ladies', 'Beyoncé'], ['Rolling in the Deep', 'Adele'],
    ['Shape of You', 'Ed Sheeran'], ['Blinding Lights', 'The Weeknd'], ['Uptown Funk', 'Mark Ronson ft. Bruno Mars'], ['Bad Guy', 'Billie Eilish'], ['Levitating', 'Dua Lipa'],
    ['Someone Like You', 'Adele'], ['Toxic', 'Britney Spears'], ['Lose Yourself', 'Eminem'], ['In Da Club', '50 Cent'], ['Gangnam Style', 'PSY'] ] },
  { id: 'marvel', name: 'Films Marvel', items: 'Iron Man|Avengers|Black Panther|Thor : Ragnarok|Spider-Man : No Way Home|Les Gardiens de la Galaxie|Doctor Strange|Captain America : Le Soldat de l’hiver|Avengers : Infinity War|Avengers : Endgame|Ant-Man|Black Widow|Shang-Chi|Captain Marvel|Les Éternels|Captain America : Civil War'.split('|').map(t => [t, 'Marvel']) },
  { id: 'disney', name: 'Disney & Pixar', items: 'Le Roi Lion|La Reine des neiges|Aladdin|La Belle et la Bête|Toy Story|Vice-versa|Coco|Là-haut|Le Monde de Nemo|Ratatouille|WALL-E|Les Indestructibles|Monstres & Cie|Zootopie|Encanto|Vaiana'.split('|').map(t => [t]) },
  { id: 'animes', name: 'Animés', items: 'Naruto|One Piece|Dragon Ball Z|L’Attaque des Titans|Death Note|Fullmetal Alchemist|Demon Slayer|Jujutsu Kaisen|Hunter x Hunter|Bleach|My Hero Academia|One Punch Man|Tokyo Ghoul|Fairy Tail|Cowboy Bebop|Sword Art Online'.split('|').map(t => [t]) },
  { id: 'foot', name: 'Légendes du foot', items: 'Lionel Messi|Cristiano Ronaldo|Kylian Mbappé|Zinédine Zidane|Ronaldinho|Diego Maradona|Pelé|Neymar|Erling Haaland|Thierry Henry|Johan Cruyff|Andrés Iniesta|Luka Modrić|Karim Benzema|Ronaldo Nazário|Michel Platini'.split('|').map(t => [t]) },
];

/* ---------- Photos (Wikipédia, gratuit, sans clé) : une requête par élément, gardée en cache ---------- */
const IMG_KEY = 'versus.imgs';
let imgCache = {}; try { imgCache = JSON.parse(localStorage.getItem(IMG_KEY)) || {}; } catch { }
const imgSave = () => { try { localStorage.setItem(IMG_KEY, JSON.stringify(imgCache)); } catch { } };
let imgChain = Promise.resolve(); const imgWait = {};
function imgGet(q) {
  if (q in imgCache) return Promise.resolve(imgCache[q]);
  return imgWait[q] || (imgWait[q] = imgChain = imgChain.then(async () => {
    let u = '';
    try {
      const r = await fetch('https://fr.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=300&gsrsearch=' + encodeURIComponent(q));
      const j = await r.json(); u = Object.values(j.query?.pages || {})[0]?.thumbnail?.source || ''; imgCache[q] = u; imgSave();
    } catch { }   // pas de cache en cas d'erreur réseau : on réessaiera
    delete imgWait[q]; return u;
  }));
}
const PQ = { 'rapfr-artistes': '{t} rappeur', 'rapfr-classiques': '{t} {s} chanson', 'rapus-artistes': '{t} rappeur', 'rapus-albums': '{t} album {s}',
  'hits-pop': '{t} chanson {s}', marvel: '{t} film Marvel', disney: '{t} film d’animation', animes: '{t} manga animé', foot: '{t} footballeur' };
const pq = (p, [t, s = '']) => PQ[p.id].replace('{t}', t).replace('{s}', s).replace(/\s+/g, ' ').trim();
const itemQ = (c, it) => { const p = PRESETS.find(x => x.id === c.preset); return p ? pq(p, [it.title, it.sub]) : ''; };
function picHTML(q, title, extra = '') { const u = imgCache[q]; return u ? cover({ title, img: u }, extra) : `<div class="cover gen ${extra}" data-pic="${esc(q)}" style="--h:${hash(title) % 360}"><span>${esc(initials(title))}</span></div>`; }
function picFill() {
  $$('[data-pic]').forEach(el => imgGet(el.dataset.pic).then(u => {
    if (u && el.isConnected) { el.style.backgroundImage = `url("${u}")`; el.classList.remove('gen'); el.textContent = ''; }
  }));
}
function presetsPrefetch() {   // photo de chaque playlist = photo de son premier élément
  PRESETS.forEach(p => imgGet(pq(p, p.items[0])).then(u => { const l = $('#presetList'); if (u && l) l.innerHTML = presetsHTML(); }));
}
let fillT;
function presetFill(c) {   // met les photos sur les éléments de la collection, au fil de l'eau
  c.items.filter(i => !i.img).forEach(it => imgGet(itemQ(c, it)).then(u => {
    if (!u || it.img) return; it.img = u; clearTimeout(fillT);
    fillT = setTimeout(() => { save(); renderHeader(); if (['items', 'tier'].includes(ui.tab) && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) render(); }, 700);
  }));
}

const presetOf = id => Object.values(store.cols).find(c => c.preset === id);
function presetsHTML() {
  return PRESETS.map(p => {
    const has = presetOf(p.id);
    return `<button class="pre-row ${has && has.id === store.cur ? 'on' : ''}" data-preset="${p.id}" title="${has ? 'Ouvrir dans ta bibliothèque' : 'Ajouter à ma bibliothèque'}">
      ${cover({ title: p.name, img: imgCache[pq(p, p.items[0])] || '' }, 'lib-cov')}
      <span><b>${esc(p.name)}</b><small>${p.items.length} éléments · ${has ? 'dans ta bibliothèque' : '＋ ajouter'}</small></span>
    </button>`;
  }).join('');
}
function presetOpen(id) {
  const p = PRESETS.find(x => x.id === id); if (!p) return;
  let c = presetOf(id);
  if (!c) {
    c = newCollection(p.name, p.items.map(([title, sub = '']) => ({ id: uid(), title, sub, img: '', link: '' })));
    c.preset = id; store.cols[c.id] = c;
    toast(`« ${p.name} » ajoutée à ta bibliothèque`);
  }
  store.cur = c.id; ui.size = null; ui.editId = null; ui.selected = null;
  presetFill(c);
  if (ui.tab === 'items' || ui.tab === 'feat') ui.tab = 'bracket';   // on arrive direct sur le jeu
  save(); render();
}

/* ---------- Données de feats connus (validation automatique) ---------- */
const FB_RAW = `
Booba: Kaaris, Damso, Ali
Jul: SCH, Naps, Soso Maness, Alonzo, Elams, Houari
Orelsan: Gringe, Stromae
Stromae: Lorde
Nekfeu: Alpha Wann, Framal, Sneazzy, Doums
Lomepal: Roméo Elvis, Eddy de Pretto
Angèle: Roméo Elvis
Gims: Sia, Niska, Vitaa
Soprano: Alonzo, Blacko, Marina Kaye
Drake: Rihanna, Future, Kendrick Lamar, Travis Scott, Lil Wayne, Kanye West, 21 Savage, Nicki Minaj, Jay-Z, The Weeknd
Kendrick Lamar: SZA, Rihanna, Eminem, Dr. Dre, Taylor Swift, Beyoncé, Jay Rock, ScHoolboy Q, The Weeknd
Travis Scott: Kanye West, Future, Young Thug, Kid Cudi, Quavo
Kanye West: Jay-Z, Kid Cudi, Rihanna, Pusha T, Paul McCartney, Nas
Jay-Z: Beyoncé, Rihanna, Linkin Park, Alicia Keys, Nas
Eminem: Rihanna, Dr. Dre, 50 Cent, Dido, Ed Sheeran, Beyoncé, Lil Wayne
50 Cent: Dr. Dre, Snoop Dogg, Justin Timberlake, Olivia
Snoop Dogg: Dr. Dre, Pharrell Williams, Katy Perry, Wiz Khalifa, Tupac
Tupac: Dr. Dre
Rihanna: Calvin Harris, Nicki Minaj, Shakira
Calvin Harris: Ellie Goulding, Dua Lipa
Ed Sheeran: Justin Bieber, Beyoncé
Justin Bieber: Ludacris, Daddy Yankee
Daddy Yankee: Luis Fonsi
Dua Lipa: Elton John, Miley Cyrus
The Weeknd: Daft Punk, Ariana Grande
Daft Punk: Pharrell Williams
Pharrell Williams: Miley Cyrus
Beyoncé: Shakira
Shakira: Maluma, Wyclef Jean
Nicki Minaj: Ariana Grande
Lil Wayne: Bruno Mars
Bruno Mars: Mark Ronson, B.o.B, Cardi B, Travie McCoy
`;
const fbKey = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const FB_NAME = {}, FB_EDGES = new Map();
{
  const link = (a, b) => { (FB_EDGES.get(a) || FB_EDGES.set(a, new Set()).get(a)).add(b); };
  FB_RAW.trim().split('\n').forEach(line => {
    const [a, rest] = line.split(':'), A = a.trim(), ka = fbKey(A);
    FB_NAME[ka] = A;
    rest.split(',').forEach(b => { const B = b.trim(), kb = fbKey(B); FB_NAME[kb] = FB_NAME[kb] || B; link(ka, kb); link(kb, ka); });
  });
}
const FB_STARTERS = () => [...FB_EDGES].filter(([, s]) => s.size >= 3).map(([k]) => FB_NAME[k]);

/* ---------- Vérification des feats : base MusicBrainz (gratuite, sans clé) ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mbChain = Promise.resolve();
const mbQuery = q => (mbChain = mbChain.then(async () => {   // 1 requête/seconde max, 3 essais (le serveur répond parfois « occupé »)
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://musicbrainz.org/ws/2/recording?fmt=json&limit=25&query=' + encodeURIComponent(q));
      if (r.ok) { const j = await r.json(); await sleep(1100); return j; }
    } catch { }
    await sleep(1400);
  }
  return null;
}));
const keyHas = (keys, k) => keys.some(x => x === k || (k.length >= 4 && x.length >= 4 && Math.abs(x.length - k.length) <= 6 && (x.includes(k) || k.includes(x))));
async function fbCheck(a, b) {   // → « Titre — Artistes » si un morceau les réunit, sinon ''
  const j = await mbQuery(`artist:"${a.replace(/"/g, '')}" AND artist:"${b.replace(/"/g, '')}"`);
  const ka = fbKey(a), kb = fbKey(b);
  for (const r of j?.recordings || []) {
    const cr = r['artist-credit'] || [];
    const names = cr.map(c => [fbKey(c.name), fbKey(c.artist?.name)]);
    const ia = names.findIndex(n => keyHas(n, ka)), ib = names.findIndex(n => keyHas(n, kb));
    if (ia >= 0 && ib >= 0 && ia !== ib) return `${r.title} — ${cr.map(c => c.name + (c.joinphrase || '')).join('')}`;
  }
  return '';
}

/* ---------- État de la partie (même moteur pour « même écran » et « salon multijoueur ») ---------- */
const fb = { phase: 'setup', names: 'Joueur 1, Joueur 2', host: localStorage.getItem('versus.name') || '', lives: 3, time: 20,
  players: [], turn: 0, cur: '', first: '', chain: [], used: new Set(), end: 0, judge: '', checking: '', msg: '', winner: '', seq: 0,
  code: '', peer: null, conns: new Map(), ready: false, error: '', tries: 0 };
const fbc = { on: false, joinCode: (new URLSearchParams(location.search).get('feat') || '').toUpperCase().slice(0, 5), name: localStorage.getItem('versus.name') || '',
  peer: null, conn: null, state: null, rx: 0, err: '', busy: false };
if (fbc.joinCode) fbc.on = true;   // lien d'invitation (?feat=CODE) → écran joueur

const fbOk = p => p.lives > 0 && p.connected !== false;
const fbArm = () => { fb.end = fb.time ? Date.now() + fb.time * 1000 : 0; };
const fbCur = () => fb.players[fb.turn];
function fbCheckEnd() {
  const al = fb.players.filter(fbOk);
  if (al.length >= 2) return false;
  fb.phase = 'over'; fb.winner = al[0]?.name || ''; fb.end = 0; fb.judge = fb.checking = ''; fb.seq++; return true;
}
function fbNext() {
  fb.seq++; fb.judge = fb.checking = '';
  if (fbCheckEnd()) return;
  do { fb.turn = (fb.turn + 1) % fb.players.length; } while (!fbOk(fb.players[fb.turn]));
  if (fb.phase === 'play') fbArm();
}
function fbLose(why) {
  const p = fbCur(); p.lives--;
  fb.msg = `💔 ${p.name} perd une vie (${why})${p.lives <= 0 ? ' — éliminé !' : ''}`;
  fbNext();
}
function fbAccept(name, how) {
  fb.chain.push({ a: name, by: fbCur().name });
  fb.used.add(fbKey(name)); fb.cur = name;
  fb.msg = how ? `✅ Feat validé : ${how}` : '✅ Feat reconnu !';
  fbNext();
}

/* L'état « public » (envoyé aux joueurs du salon, et utilisé pour dessiner l'écran) */
function fbPublic() {
  return { phase: fb.phase, code: fb.code, ready: fb.ready, error: fb.error, turn: fbCur()?.pid, cur: fb.cur, first: fb.first, chain: fb.chain, msg: fb.msg,
    judge: fb.judge, checking: fb.checking, time: fb.time, lives: fb.lives, winner: fb.winner,
    left: fb.end && !fb.judge && !fb.checking ? Math.max(0, fb.end - Date.now()) : -1,
    players: fb.players.map(p => ({ pid: p.pid, name: p.name, lives: p.lives, on: p.connected !== false })) };
}
function fbBroadcast() {
  if (!fb.code) return;
  const msg = { t: 'state', s: fbPublic() };
  for (const c of fb.conns.values()) try { if (c.open) c.send(msg); } catch { }
}
function fbSync() { fbBroadcast(); if (ui.tab === 'feat' && !fbc.on) render(); }

function fbSetup(players) {
  Object.assign(fb, { phase: 'seed', players, turn: 0, cur: '', first: '', chain: [], used: new Set(), judge: '', checking: '', msg: '', winner: '', end: 0 });
  fb.players.forEach(p => p.lives = fb.lives); fb.seq++;
}
function fbStartLocal() {
  const names = [...new Set(fb.names.split(/[,\n]/).map(s => s.trim()).filter(Boolean))].slice(0, 8);
  if (names.length < 2) return toast('Il faut au moins 2 joueurs (sépare les noms par une virgule).');
  fbSetup(names.map((name, i) => ({ pid: 'p' + i, name, lives: 3, connected: true }))); render();
}
function fbStartRoom() {
  fb.players = fb.players.filter(p => p.connected !== false || p.pid === 'host');
  if (fb.players.filter(fbOk).length < 2) return toast('Il faut au moins 2 joueurs connectés : partage le code.');
  fbSetup(fb.players); fbSync();
}

/* Toutes les actions des joueurs passent par ici (sur l'écran de l'hôte / en local) */
function fbDo(pid, a, m = {}) {
  const p = fbCur(); if (!p || (fb.phase !== 'play' && fb.phase !== 'seed')) return;
  if (a === 'judge') {
    if (!fb.judge || pid === p.pid) return;   // l'arbitre n'est jamais le joueur concerné
    if (m.ok) fbAccept(fb.judge, 'accepté par l’arbitre');
    else { fb.msg = `❌ « ${fb.judge} » refusé : pas de feat reconnu.`; fbLose('feat refusé'); }
    return fbSync();
  }
  if (pid !== p.pid || fb.judge || fb.checking) return;
  const text = String(m.text || '').trim().slice(0, 60);
  if (a === 'seed' && fb.phase === 'seed' && text) {
    fb.first = fb.cur = text; fb.used = new Set([fbKey(text)]); fb.chain = []; fb.phase = 'play'; fb.msg = '';
    fbNext(); fbSync();
  } else if (a === 'pass' && fb.phase === 'play') { fbLose('passe'); fbSync(); }
  else if (a === 'guess' && fb.phase === 'play' && text) fbGuess(text);
}
async function fbGuess(raw) {
  const k = fbKey(raw); if (!k) return;
  if (fb.used.has(k)) { fb.msg = `⚠ « ${raw} » a déjà été cité, essaie un autre artiste.`; return fbSync(); }
  if (FB_EDGES.get(fbKey(fb.cur))?.has(k)) { fbAccept(FB_NAME[k] || raw, ''); return fbSync(); }
  const seq = fb.seq; fb.checking = raw; fb.msg = ''; fbSync();
  let proof = ''; try { proof = await fbCheck(fb.cur, raw); } catch { }
  if (fb.seq !== seq || fb.checking !== raw) return;   // la partie a changé pendant la vérification
  if (proof) fbAccept(raw, proof);
  else { fb.checking = ''; fb.judge = raw; fb.msg = 'Aucun feat trouvé automatiquement : à vous de trancher.'; }
  fbSync();
}
/* action « locale » : sur l'écran de l'hôte ou en même écran ; sinon envoyée à l'hôte du salon */
function fbAct(a, m = {}) {
  if (fbc.on) { try { fbc.conn?.send({ t: 'act', a, ...m }); } catch { } return; }
  fbDo(a === 'judge' && !fb.code ? 'judge' : fb.code ? 'host' : fbCur()?.pid, a, m);
}

/* ---------- Salon multijoueur : hôte ---------- */
function fbRoom() {
  if (typeof Peer === 'undefined') return toast('Multijoueur indisponible : PeerJS n’a pas pu se charger (vérifie ta connexion).');
  const name = fb.host.trim() || 'Hôte'; localStorage.setItem('versus.name', name);
  Object.assign(fb, { phase: 'lobby', players: [{ pid: 'host', name, lives: fb.lives, connected: true }], conns: new Map(), msg: '', error: '', tries: 0, ready: false, winner: '' });
  fbOpenPeer(); render();
}
function fbOpenPeer() {
  fb.code = genCode();
  const peer = fb.peer = new Peer('versus-fb-' + fb.code);
  peer.on('open', () => { fb.ready = true; fbSync(); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && fb.tries++ < 5) { try { peer.destroy(); } catch { } return fbOpenPeer(); }
    fb.error = 'Erreur réseau (' + e.type + '). Recrée le salon.'; fbSync();
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { } });
  peer.on('connection', conn => { conn.on('data', m => fbOnMsg(conn, m)); conn.on('close', () => fbOnClose(conn)); });
}
function fbOnMsg(conn, m) {
  if (!fb.code || !m || typeof m !== 'object') return;
  if (m.t === 'join') {
    const pid = String(m.pid || '').slice(0, 40); if (!pid || pid === 'host') return;
    let p = fb.players.find(x => x.pid === pid);
    if (!p) {
      if (fb.phase !== 'lobby') return void conn.send({ t: 'full', msg: 'La partie a déjà commencé.' });
      if (fb.players.length >= 8) return void conn.send({ t: 'full', msg: 'Le salon est plein (8 joueurs).' });
      let name = String(m.name || '').trim().slice(0, 20) || 'Joueur', base = name, n = 2;
      const taken = new Set(fb.players.map(x => x.name.toLowerCase())); while (taken.has(name.toLowerCase())) name = base + ' ' + n++;
      p = { pid, name, lives: fb.lives, connected: true }; fb.players.push(p);
    }
    const old = fb.conns.get(pid); if (old && old !== conn) try { old.close(); } catch { }
    fb.conns.set(pid, conn); conn._pid = pid; p.connected = true; fbSync();
  } else if (m.t === 'act' && conn._pid) fbDo(conn._pid, m.a, m);
}
function fbOnClose(conn) {
  const pid = conn._pid; if (!pid || fb.conns.get(pid) !== conn) return;
  fb.conns.delete(pid); const p = fb.players.find(x => x.pid === pid); if (p) p.connected = false;
  if (fb.phase === 'play' || fb.phase === 'seed') {
    if (fbCur()?.pid === pid) { fb.phase === 'play' ? fbLose('déconnecté') : fbNext(); } else fbCheckEnd();
  }
  fbSync();
}
function fbClose() {
  if (fb.code) { for (const c of fb.conns.values()) try { c.send({ t: 'state', s: { phase: 'closed' } }); } catch { } try { fb.peer.destroy(); } catch { } }
  Object.assign(fb, { code: '', peer: null, conns: new Map(), ready: false, phase: 'setup', end: 0, seq: fb.seq + 1 });
}

/* ---------- Salon multijoueur : joueur ---------- */
function fbJoin() {
  const code = fbc.joinCode.trim().toUpperCase(), name = fbc.name.trim();
  if (code.length < 5) return toast('Entre le code à 5 caractères du salon.');
  if (!name) return toast('Choisis un pseudo.');
  if (typeof Peer === 'undefined') { fbc.err = 'Multijoueur indisponible : PeerJS n’a pas pu se charger.'; return render(); }
  localStorage.setItem('versus.name', name);
  try { fbc.peer?.destroy(); } catch { }
  Object.assign(fbc, { on: true, state: null, err: '', busy: true, joinCode: code });
  const peer = fbc.peer = new Peer(), fail = msg => { fbc.busy = false; fbc.err = msg; render(); };
  const to = setTimeout(() => { if (!fbc.state) fail('Salon introuvable. Vérifie le code.'); }, 10000);
  peer.on('open', () => {
    const conn = fbc.conn = peer.connect('versus-fb-' + code, { reliable: true });
    conn.on('open', () => conn.send({ t: 'join', pid: btPid(), name }));
    conn.on('data', m => {
      if (m?.t === 'state') { clearTimeout(to); fbc.busy = false; fbc.state = m.s; fbc.rx = Date.now(); render(); }
      else if (m?.t === 'full') { clearTimeout(to); fail(m.msg); }
    });
    conn.on('close', () => { if (fbc.on && fbc.state?.phase !== 'closed') fail('Connexion perdue avec le salon.'); });
  });
  peer.on('error', e => fail(e.type === 'peer-unavailable' ? 'Salon introuvable. Vérifie le code.' : 'Erreur réseau (' + e.type + ').'));
  render();
}
function fbLeave() {
  try { fbc.peer?.destroy(); } catch { }
  Object.assign(fbc, { on: false, state: null, peer: null, conn: null, err: '', busy: false, joinCode: '' });
  history.replaceState(null, '', location.pathname); render();
}

/* ---------- Actions (boutons) ---------- */
function featAction(action, a) {
  const id = a.dataset.id;
  switch (action) {
    case 'fb-lives': fb.lives = +id; render(); return true;
    case 'fb-time': fb.time = +id; render(); return true;
    case 'fb-start': fbStartLocal(); return true;
    case 'fb-room': fbRoom(); return true;
    case 'fb-go': fbStartRoom(); return true;
    case 'fb-join': fbJoin(); return true;
    case 'fb-leave': fbLeave(); return true;
    case 'fb-copy': navigator.clipboard?.writeText(fbLink()).then(() => toast('Lien copié !'), () => toast(fbLink())); return true;
    case 'fb-rand': { const l = FB_STARTERS(), i = $('#fbGuess'); if (i) { i.value = l[Math.floor(Math.random() * l.length)]; i.focus(); } return true; }
    case 'fb-submit': {
      const i = $('#fbGuess'), v = i?.value.trim(); if (!v) return true;
      const ph = fbc.on ? fbc.state?.phase : fb.phase; i.value = ''; fbAct(ph === 'seed' ? 'seed' : 'guess', { text: v }); return true;
    }
    case 'fb-pass': fbAct('pass'); return true;
    case 'fb-ok': fbAct('judge', { ok: true }); return true;
    case 'fb-no': fbAct('judge', { ok: false }); return true;
    case 'fb-again':
      if (fb.code) { fb.players = fb.players.filter(p => p.connected !== false || p.pid === 'host'); fb.players.forEach(p => p.lives = fb.lives); fb.phase = 'lobby'; fb.msg = ''; fb.seq++; fbSync(); }
      else { fb.phase = 'setup'; render(); }
      return true;
    case 'fb-stop': fbClose(); render(); return true;
  }
  return false;
}
const fbLink = () => location.origin + location.pathname.replace(/index\.html$/, '') + '?feat=' + fb.code;

/* ---------- Vues ---------- */
const fbPills = (action, cur, vals, fmt) => vals.map(v => `<button class="${v === cur ? 'on' : ''}" data-action="${action}" data-id="${v}">${fmt(v)}</button>`).join('');
const fbHearts = n => '♥'.repeat(Math.max(0, n)) || '✕';
const fbDatalist = () => `<datalist id="fbList">${[...new Set(Object.values(FB_NAME))].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
const artistQ = n => n + ' chanteur rappeur artiste';

function featView() {
  if (fb.phase === 'setup') return `
  <h2>Battle de feat</h2>
  <p class="hint">Le joueur 1 écrit un artiste de départ. Chacun son tour cite ensuite un artiste qui a fait un <b>feat</b> avec le précédent, et la chaîne continue. Pas de répétition : si tu sèches ou si le temps est écoulé, tu perds une vie.</p>
  <div class="panel fb-setup">
    <div class="fb-opts">
      <div><span class="fb-lab">Vies</span><div class="size-pick sm">${fbPills('fb-lives', fb.lives, [1, 2, 3, 5], v => v)}</div></div>
      <div><span class="fb-lab">Temps par tour</span><div class="size-pick sm">${fbPills('fb-time', fb.time, [10, 20, 30, 0], v => v ? v + ' s' : '∞')}</div></div>
    </div>
    <h3 class="fb-h">🎮 Sur le même écran</h3>
    <label class="fb-lab" for="fbNames">Joueurs <small>(sépare par une virgule, 2 à 8)</small></label>
    <input type="text" id="fbNames" value="${esc(fb.names)}" autocomplete="off" placeholder="Marwan, Sam, Léa">
    <button class="btn" data-action="fb-start">🎤 Lancer la battle</button>
    <h3 class="fb-h">🌐 Multijoueur (chacun sur son téléphone)</h3>
    <div class="row"><input type="text" id="fbHost" value="${esc(fb.host)}" maxlength="20" placeholder="Ton pseudo" style="flex:1;min-width:160px">
      <button class="btn" data-action="fb-room">🌐 Créer un salon</button></div>
    <div class="bt-or">ou rejoindre le salon d’un ami</div>
    <div class="row"><input type="text" id="fbCode" value="${esc(fbc.joinCode)}" maxlength="5" placeholder="CODE" style="width:110px;text-transform:uppercase;letter-spacing:3px;text-align:center">
      <input type="text" id="fbJoinName" value="${esc(fbc.name)}" maxlength="20" placeholder="Ton pseudo" style="flex:1;min-width:160px">
      <button class="btn ghost" data-action="fb-join">Rejoindre</button></div>
    <p class="hint note">Les feats sont vérifiés automatiquement (base MusicBrainz). Si rien n’est trouvé, les autres joueurs font l’arbitre : « Vérifier » ouvre Google, puis ✅ ou ❌.</p>
  </div>`;
  return fbRoomHTML(fbPublic(), fb.code ? 'host' : '*', true);
}

function fbRoomHTML(s, me, admin) {
  const any = me === '*', mine = any || s.turn === me, cur = s.players.find(p => p.pid === s.turn), ph = s.phase;
  const head = `<div class="fb-players">${s.players.map(q => `<div class="fb-p ${q.pid === s.turn && (ph === 'play' || ph === 'seed') ? 'on' : ''} ${q.lives <= 0 ? 'out' : ''}"><b>${esc(q.name)}${q.pid === me ? ' (toi)' : ''}${q.on === false ? ' · hors ligne' : ''}</b>${ph === 'lobby' ? '' : `<span>${fbHearts(q.lives)}</span>`}</div>`).join('')}</div>`;
  const chain = `<div class="fb-chain">${s.first ? `<span class="fb-link start">${esc(s.first)}</span>` : ''}${s.chain.map(c => `<span class="fb-arrow">→</span><span class="fb-link" title="cité par ${esc(c.by)}">${esc(c.a)}</span>`).join('')}</div>`;
  const form = ph2 => `<form class="bt-form fb-form" onsubmit="event.preventDefault();featAction('fb-submit',{dataset:{}})">
    <input type="text" id="fbGuess" list="fbList" placeholder="${ph2}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
    <button class="btn" type="submit">Valider</button></form>`;
  const stop = admin ? `<button class="btn ghost sm danger" data-action="fb-stop">${s.code ? 'Fermer le salon' : 'Abandonner'}</button>` : '';

  if (ph === 'lobby') return `${head}
    <div class="panel fb-lobby"><h3>Salon ${s.ready ? '' : '(connexion…)'}</h3>
      ${s.error ? `<p class="hint err">${esc(s.error)}</p>` : ''}
      ${admin ? `<div class="bt-code-card"><small>Code du salon</small><div class="bt-code">${esc(s.code)}</div>
        <p class="hint">Les amis ouvrent le site, onglet « Battle de feat », et entrent ce code — ou ouvrent ce lien :</p>
        <div class="row"><code style="word-break:break-all">${esc(fbLink())}</code><button class="btn sm" data-action="fb-copy">📋 Copier</button></div></div>
        <div class="row" style="margin-top:14px"><button class="btn" data-action="fb-go" ${s.players.filter(p => p.on).length < 2 ? 'disabled' : ''}>🎤 Lancer (${s.players.filter(p => p.on).length} joueur${s.players.filter(p => p.on).length > 1 ? 's' : ''})</button>${stop}</div>`
      : '<p class="hint">En attente du lancement par l’hôte…</p>'}</div>`;

  if (ph === 'over') return `<div class="champion"><div class="crown">👑</div><h1>${s.winner ? esc(s.winner) + ' gagne !' : 'Égalité'}</h1>
    <p class="hint">Chaîne de ${s.chain.length} feat${s.chain.length > 1 ? 's' : ''}</p>${chain}
    <div class="duel-tools" style="margin-top:22px">${admin ? '<button class="btn" data-action="fb-again">🔁 Rejouer</button>' + (s.code ? stop : '') : '<p class="hint">L’hôte peut relancer une partie.</p>'}</div></div>`;

  if (ph === 'seed') return `${head}
    <div class="fb-card"><small>Artiste de départ</small>
      ${mine ? `<h2 style="margin:8px 0 4px"><b>${esc(cur?.name)}</b>, écris l’artiste de départ</h2><p class="hint">N’importe quel artiste : la chaîne partira de lui.</p>`
             : `<h2 style="margin:8px 0">${esc(cur?.name)} choisit l’artiste de départ…</h2>`}</div>
    ${mine ? form('Ex : Drake, Aya Nakamura, Jul…') + '<div class="duel-tools"><button class="btn ghost sm" data-action="fb-rand">🎲 Au hasard</button>' + stop + '</div>' : (admin ? `<div class="duel-tools">${stop}</div>` : '')}${fbDatalist()}`;

  // phase « play »
  const canJudge = !!s.judge && (any || s.turn !== me);
  return `${head}
  <div class="fb-card">${picHTML(artistQ(s.cur), s.cur, 'fb-pic')}<small>Artiste en cours</small><h1>${esc(s.cur)}</h1>
    <p><b>${esc(cur?.name)}</b>${mine && !any ? ' (toi)' : ''}, cite un artiste qui a fait un feat avec <b>${esc(s.cur)}</b></p></div>
  ${s.time ? `<div class="progress fb-time"><i id="fbBar" style="width:100%"></i></div><div class="fb-sec"><span id="fbSec">${s.time}</span> s</div>` : ''}
  ${s.checking ? `<div class="panel fb-judge"><p>🔎 Vérification de <b>${esc(s.checking)}</b> avec <b>${esc(s.cur)}</b>…</p></div>`
  : s.judge ? `<div class="panel fb-judge"><h3>Arbitrage</h3>
      <p><b>${esc(cur?.name)}</b> propose <b>${esc(s.judge)}</b>. A-t-il / elle fait un feat avec <b>${esc(s.cur)}</b> ?</p>
      <div class="row"><a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(s.cur + ' feat ' + s.judge)}">🔎 Vérifier</a>
      ${canJudge ? '<button class="btn sm" data-action="fb-ok">✅ Oui, c’est bon</button><button class="btn ghost sm danger" data-action="fb-no">❌ Non</button>' : '<span class="hint" style="margin:0">Les autres joueurs décident…</span>'}</div></div>`
  : mine ? form('Nom de l’artiste…') + `<div class="duel-tools"><button class="btn ghost sm" data-action="fb-pass">Je sèche (−1 vie)</button>${stop}</div>`
  : `<p class="hint" style="text-align:center">C’est au tour de <b>${esc(cur?.name)}</b>…</p>${admin ? `<div class="duel-tools">${stop}</div>` : ''}`}
  ${s.msg ? `<p class="fb-msg">${esc(s.msg)}</p>` : ''}${chain}${fbDatalist()}`;
}

function featClientView() {
  const s = fbc.state, leave = '<button class="btn ghost sm" data-action="fb-leave">Quitter le salon</button>';
  if (!s) return `<h2>Rejoindre une battle de feat</h2>
    ${fbc.err ? `<p class="hint err">${esc(fbc.err)}</p>` : ''}
    <div class="panel"><div class="row"><input type="text" id="fbCode" value="${esc(fbc.joinCode)}" maxlength="5" placeholder="CODE" style="width:110px;text-transform:uppercase;letter-spacing:3px;text-align:center">
      <input type="text" id="fbJoinName" value="${esc(fbc.name)}" maxlength="20" placeholder="Ton pseudo" style="flex:1;min-width:160px">
      <button class="btn" data-action="fb-join" ${fbc.busy ? 'disabled' : ''}>${fbc.busy ? 'Connexion…' : 'Rejoindre'}</button></div>
    <div class="row" style="margin-top:12px">${leave}</div></div>`;
  if (s.phase === 'closed') return `<div class="empty">Le salon a été fermé par l’hôte.</div><div class="row" style="justify-content:center">${leave}</div>`;
  return fbRoomHTML(s, btPid(), false) + `<div class="duel-tools" style="margin-top:18px">${leave}</div>${fbc.err ? `<p class="hint err">${esc(fbc.err)}</p>` : ''}`;
}

function featBind() {
  $('#fbGuess')?.focus();
  picFill();
}

document.addEventListener('input', e => {
  const v = e.target.value;
  if (e.target.id === 'fbNames') fb.names = v;
  else if (e.target.id === 'fbHost') fb.host = v;
  else if (e.target.id === 'fbCode') fbc.joinCode = v.toUpperCase();
  else if (e.target.id === 'fbJoinName') fbc.name = v;
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'fbNames') fbStartLocal();
  else if (e.target.id === 'fbHost') fbRoom();
  else if (e.target.id === 'fbCode' || e.target.id === 'fbJoinName') fbJoin();
});

/* minuteur : met à jour la barre sans re-rendre (le champ garde le focus). L'hôte / le mode local décident des fins de tour. */
{
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = now - last; last = now;
    let left = -1;
    if (fbc.on) { const s = fbc.state; if (s?.phase === 'play' && s.left >= 0) left = s.left - (now - fbc.rx); }
    else if (fb.phase === 'play' && fb.end) {
      if (fb.judge || fb.checking || (!fb.code && ui.tab !== 'feat')) fb.end += dt;   // en pause pendant l'arbitrage (et hors de l'onglet en local)
      else { left = fb.end - now; if (left <= 0) { fbLose('temps écoulé'); fbSync(); return; } }
    }
    const bar = $('#fbBar'); if (!bar) return;
    const tot = (fbc.on ? fbc.state?.time : fb.time) * 1000;
    if (left >= 0 && tot) { bar.style.width = Math.min(100, left / tot * 100) + '%'; bar.classList.toggle('low', left < 5000); $('#fbSec').textContent = Math.ceil(left / 1000); }
  }, 200);
}
setTimeout(presetsPrefetch, 0);
