'use strict';
/* =====================================================================
   Icônes : remplace les emojis du site par de vraies icônes SVG (mêmes sur
   tous les appareils, couleur du thème). Les emojis écrits dans le code
   restent lisibles ; ce script les convertit à l'affichage.
   Chargé en premier ; ne dépend d'aucun autre fichier.
   ===================================================================== */
const IC_PATHS = {
  note: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z',
  headphones: 'M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  link: 'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
  check: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z',
  miss: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6 10.6 12 7 8.4 8.4 7 12 10.6 15.6 7 17 8.4 13.4 12 17 15.6z',
  warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  trophy: 'M19 5h-2V3H7v2H5a2 2 0 0 0-2 2v1a4 4 0 0 0 3.8 4A5 5 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5 5 0 0 0 4.2-3.9A4 4 0 0 0 21 8V7a2 2 0 0 0-2-2zM5 8V7h2v3.8A2 2 0 0 1 5 8zm14 0a2 2 0 0 1-2 2.8V7h2v1z',
  crown: 'M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm14 3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1h14v1z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  camera: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8 8 0 0 1 18.9 8zM12 4c.83 1.2 1.48 2.53 1.91 4h-3.82c.43-1.47 1.08-2.8 1.91-4zM4.26 14a8 8 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.08 16zM8.03 8H5.08a8 8 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 20c-.83-1.2-1.48-2.53-1.91-4h3.82c-.43 1.47-1.08 2.8-1.91 4zm2.34-6H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8 8 0 0 1 0 4h-3.38z',
  gamepad: 'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
  bulb: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19a7 7 0 0 0-4 12.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26A7 7 0 0 0 12 2z',
  shuffle: 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  flag: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z',
  cards: 'M4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6zm16-4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 14H8V4h12v12z',
  bracket: 'M3 4h6v4H3V4zm0 12h6v4H3v-4zm12-6h6v4h-6v-4zM9 6h3v12H9v-2h1V8H9V6zm3 5h3v2h-3v-2z',
  live: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.05 7.05a7 7 0 0 0 0 9.9l1.41-1.41a5 5 0 0 1 0-7.08L7.05 7.05zm9.9 0-1.41 1.41a5 5 0 0 1 0 7.08l1.41 1.41a7 7 0 0 0 0-9.9zM4.22 4.22a11 11 0 0 0 0 15.56l1.41-1.41a9 9 0 0 1 0-12.74L4.22 4.22zm15.56 0-1.41 1.41a9 9 0 0 1 0 12.74l1.41 1.41a11 11 0 0 0 0-15.56z',
  qr: 'M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z',
  home: 'M12 3 2 12h3v9h6v-6h2v6h6v-9h3L12 3z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.2 4.2 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  chart: 'M5 9h3v10H5V9zm5.5-5h3v15h-3V4zM16 13h3v6h-3v-6z',
};
// emoji → icône (la forme avec ou sans sélecteur de variation ︎ est reconnue)
const IC_EMOJI = {
  '🎵': 'note', '🎶': 'note', '🎤': 'mic', '🎧': 'headphones', '🔎': 'search', '🔍': 'search', '🔗': 'link',
  '✅': 'check', '❌': 'miss', '⚠': 'warn', '✕': 'close', '✎': 'edit', '🏆': 'trophy', '👑': 'crown',
  '🔁': 'repeat', '📷': 'camera', '🌐': 'globe', '🎮': 'gamepad', '📋': 'copy', '💡': 'bulb', '🎲': 'shuffle',
  '⏩': 'next', '🙋': 'person', '🔈': 'volume', '🔊': 'volume', '🏁': 'flag', '🎴': 'cards', '⚔': 'bracket',
  '📡': 'live', '🔴': 'live', '🟢': '', '🎉': '', '👆': '', '🥇': 'medal1', '🥈': 'medal2', '🥉': 'medal3',
};
const IC_SRC = '(' + Object.keys(IC_EMOJI).join('|') + ')\\uFE0F?';
const IC_RE = new RegExp(IC_SRC, 'gu'), IC_TEST = new RegExp(IC_SRC, 'u');

function icSvg(name) {
  if (name === '') return '';
  if (/^medal\d$/.test(name)) return `<span class="medal m${name[5]}">${name[5]}</span>`;
  return `<svg class="ic ic-${name}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC_PATHS[name]}"/></svg>`;
}
const icHtml = (name, cls = '') => icSvg(name).replace('class="ic ', `class="ic ${cls} `);

const IC_SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE|INPUT|SELECT)$/;
function icConvertText(node) {
  const p = node.parentNode;
  if (!p || IC_SKIP.test(p.nodeName) || p.isContentEditable || !IC_TEST.test(node.data)) return;
  const esc = node.data.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const t = document.createElement('template');
  t.innerHTML = esc.replace(IC_RE, (m, e) => icSvg(IC_EMOJI[e]));
  node.replaceWith(t.content);
}
function icConvert(root) {
  if (root.nodeType === 3) return icConvertText(root);
  if (root.nodeType !== 1 || IC_SKIP.test(root.nodeName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(icConvertText);
}
new MutationObserver(ms => {
  for (const m of ms) {
    if (m.type === 'characterData') icConvertText(m.target);
    else m.addedNodes.forEach(icConvert);
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true });
icConvert(document.body);
