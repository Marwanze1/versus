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

const presetOf = id => Object.values(store.cols).find(c => c.preset === id);
function presetsHTML() {
  return PRESETS.map(p => {
    const has = presetOf(p.id);
    return `<button class="pre-row ${has && has.id === store.cur ? 'on' : ''}" data-preset="${p.id}" title="${has ? 'Ouvrir dans ta bibliothèque' : 'Ajouter à ma bibliothèque'}">
      ${cover({ title: p.name }, 'lib-cov')}
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

/* ---------- État de la partie ---------- */
const fb = { phase: 'setup', names: 'Joueur 1, Joueur 2', start: '', lives: 3, time: 20,
  players: [], turn: 0, cur: '', chain: [], used: new Set(), end: 0, judge: null, msg: '', winner: null };

const fbAlive = () => fb.players.filter(p => p.lives > 0);
const fbArm = () => { fb.end = fb.time ? Date.now() + fb.time * 1000 : 0; };

function fbNext() {
  const al = fbAlive();
  if (al.length < 2) { fb.phase = 'over'; fb.winner = al[0] || null; fb.end = 0; return; }
  do { fb.turn = (fb.turn + 1) % fb.players.length; } while (fb.players[fb.turn].lives <= 0);
  fbArm();
}
function fbLose(why) {
  const p = fb.players[fb.turn]; p.lives--;
  fb.msg = `💔 ${p.name} perd une vie (${why})${p.lives <= 0 ? ' — éliminé !' : ''}`;
  fbNext();
}
function fbAccept(name, byJudge) {
  fb.chain.push({ a: name, by: fb.players[fb.turn].name });
  fb.used.add(fbKey(name)); fb.cur = name;
  fb.msg = byJudge ? '✅ Validé par l’arbitre' : '✅ Feat reconnu !';
  fb.judge = null; fbNext();
}
function fbStart() {
  const names = [...new Set(fb.names.split(/[,\n]/).map(s => s.trim()).filter(Boolean))].slice(0, 8);
  if (names.length < 2) return toast('Il faut au moins 2 joueurs (sépare les noms par une virgule).');
  const start = fb.start.trim() || FB_STARTERS()[Math.floor(Math.random() * FB_STARTERS().length)];
  const first = FB_NAME[fbKey(start)] || start;
  Object.assign(fb, { phase: 'play', players: names.map(name => ({ name, lives: fb.lives })), turn: 0, cur: first, first,
    chain: [], used: new Set([fbKey(start)]), judge: null, msg: '', winner: null });
  fbArm(); render();
}
function fbSubmit() {
  const inp = $('#fbGuess'); if (!inp) return;
  const raw = inp.value.trim(), k = fbKey(raw); if (!k) return;
  if (fb.used.has(k)) { fb.msg = `⚠ « ${raw} » a déjà été cité, essaie un autre artiste.`; inp.value = ''; return render(); }
  if (FB_EDGES.get(fbKey(fb.cur))?.has(k)) return (fbAccept(FB_NAME[k] || raw, false), render());
  fb.judge = FB_NAME[k] || raw; fb.msg = ''; render();   // feat inconnu du site → l'arbitre (les autres joueurs) tranche
}

function featAction(action, a) {
  const id = a.dataset.id;
  switch (action) {
    case 'fb-rand': { const l = FB_STARTERS(); fb.start = l[Math.floor(Math.random() * l.length)]; render(); return true; }
    case 'fb-lives': fb.lives = +id; render(); return true;
    case 'fb-time': fb.time = +id; render(); return true;
    case 'fb-start': fbStart(); return true;
    case 'fb-submit': fbSubmit(); return true;
    case 'fb-pass': fbLose('passe'); render(); return true;
    case 'fb-ok': fbAccept(fb.judge, true); render(); return true;
    case 'fb-no': fb.msg = `❌ « ${fb.judge} » refusé : pas de feat reconnu.`; fb.judge = null; fbLose('feat refusé'); render(); return true;
    case 'fb-again': fb.phase = 'setup'; render(); return true;
    case 'fb-stop': fb.phase = 'setup'; fb.end = 0; render(); return true;
  }
  return false;
}

/* ---------- Vues ---------- */
const fbPills = (action, cur, vals, fmt) => vals.map(v => `<button class="${v === cur ? 'on' : ''}" data-action="${action}" data-id="${v}">${fmt(v)}</button>`).join('');
const fbHearts = n => '♥'.repeat(Math.max(0, n)) || '✕';
const fbDatalist = () => `<datalist id="fbList">${[...new Set(Object.values(FB_NAME))].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

function featView() {
  if (fb.phase === 'setup') return `
  <h2>Battle de feat</h2>
  <p class="hint">On part d’un artiste. Chacun son tour cite un artiste qui a fait un <b>feat</b> avec le précédent, et la chaîne continue. Pas de répétition : si tu sèches, tu perds une vie.</p>
  <div class="panel fb-setup">
    <label class="fb-lab" for="fbNames">Joueurs <small>(sépare par une virgule, 2 à 8)</small></label>
    <input type="text" id="fbNames" value="${esc(fb.names)}" autocomplete="off" placeholder="Marwan, Sam, Léa">
    <label class="fb-lab" for="fbStart">Artiste de départ <small>(laisse vide pour un tirage au sort)</small></label>
    <div class="row"><input type="text" id="fbStart" list="fbList" value="${esc(fb.start)}" autocomplete="off" placeholder="Ex : Drake" style="flex:1;min-width:180px">
      <button class="btn ghost sm" data-action="fb-rand">🎲 Au hasard</button></div>
    <div class="fb-opts">
      <div><span class="fb-lab">Vies</span><div class="size-pick sm">${fbPills('fb-lives', fb.lives, [1, 2, 3, 5], v => v)}</div></div>
      <div><span class="fb-lab">Temps par tour</span><div class="size-pick sm">${fbPills('fb-time', fb.time, [10, 20, 30, 0], v => v ? v + ' s' : '∞')}</div></div>
    </div>
    <button class="btn" data-action="fb-start">🎤 Lancer la battle</button>
    <p class="hint note">Les feats connus sont validés tout seuls. Pour les autres, les joueurs font l’arbitre : un bouton « Vérifier » ouvre une recherche Google, puis vous décidez ✅ ou ❌.</p>
  </div>${fbDatalist()}`;

  if (fb.phase === 'over') {
    const w = fb.winner;
    return `
    <div class="champion"><div class="crown">👑</div><h1>${w ? esc(w.name) + ' gagne !' : 'Égalité'}</h1>
      <p class="hint">Chaîne de ${fb.chain.length} feat${fb.chain.length > 1 ? 's' : ''}</p>
      <div class="fb-chain">${fbChainHTML()}</div>
      <div class="duel-tools" style="margin-top:22px"><button class="btn" data-action="fb-again">🔁 Rejouer</button></div></div>`;
  }

  const p = fb.players[fb.turn];
  return `
  <div class="fb-players">${fb.players.map((q, i) => `<div class="fb-p ${i === fb.turn ? 'on' : ''} ${q.lives <= 0 ? 'out' : ''}"><b>${esc(q.name)}</b><span>${fbHearts(q.lives)}</span></div>`).join('')}</div>
  <div class="fb-card"><small>Artiste en cours</small><h1>${esc(fb.cur)}</h1>
    <p><b>${esc(p.name)}</b>, cite un artiste qui a fait un feat avec <b>${esc(fb.cur)}</b></p></div>
  ${fb.time ? `<div class="progress fb-time"><i id="fbBar" style="width:100%"></i></div><div class="fb-sec"><span id="fbSec">${fb.time}</span> s</div>` : ''}
  ${fb.judge ? `
  <div class="panel fb-judge"><h3>Arbitrage</h3>
    <p><b>${esc(p.name)}</b> propose <b>${esc(fb.judge)}</b>. A-t-il / elle fait un feat avec <b>${esc(fb.cur)}</b> ?</p>
    <div class="row"><a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(fb.cur + ' feat ' + fb.judge)}">🔎 Vérifier</a>
      <button class="btn sm" data-action="fb-ok">✅ Oui, c’est bon</button>
      <button class="btn ghost sm danger" data-action="fb-no">❌ Non</button></div></div>` : `
  <form class="bt-form fb-form" onsubmit="event.preventDefault();featAction('fb-submit',{dataset:{}})">
    <input type="text" id="fbGuess" list="fbList" placeholder="Nom de l’artiste…" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
    <button class="btn" type="submit">Valider</button></form>
  <div class="duel-tools"><button class="btn ghost sm" data-action="fb-pass">Je sèche (−1 vie)</button>
    <button class="btn ghost sm danger" data-action="fb-stop">Abandonner</button></div>`}
  ${fb.msg ? `<p class="fb-msg">${esc(fb.msg)}</p>` : ''}
  <div class="fb-chain">${fbChainHTML()}</div>${fbDatalist()}`;
}
const fbChainHTML = () => `<span class="fb-link start">${esc(fb.first)}</span>` +
  fb.chain.map(c => `<span class="fb-arrow">→</span><span class="fb-link" title="cité par ${esc(c.by)}">${esc(c.a)}</span>`).join('');

function featBind() {
  if (fb.phase === 'play' && !fb.judge) $('#fbGuess')?.focus();
}

document.addEventListener('input', e => {
  if (e.target.id === 'fbNames') fb.names = e.target.value;
  else if (e.target.id === 'fbStart') fb.start = e.target.value;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.id === 'fbNames' || e.target.id === 'fbStart')) fbStart();
});

/* minuteur : met à jour la barre sans re-rendre (le champ garde le focus) ; en pause hors de l'onglet */
{
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = now - last; last = now;
    if (fb.phase !== 'play' || !fb.end || fb.judge) { if (fb.end) fb.end += dt; return; }
    if (ui.tab !== 'feat' || bt.role === 'player' || lv.V) { fb.end += dt; return; }
    const left = fb.end - now, bar = $('#fbBar');
    if (left <= 0) { fbLose('temps écoulé'); return render(); }
    if (bar) { bar.style.width = (left / (fb.time * 1000) * 100) + '%'; bar.classList.toggle('low', left < 5000); $('#fbSec').textContent = Math.ceil(left / 1000); }
  }, 200);
}
