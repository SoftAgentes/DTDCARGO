/* global React */
/* ── DTD ERP · Icon set ─────────────────────────────────────── */
/* Outline icons, 1.6 stroke, 24×24 grid. Match brand style.    */

const _ipath = (d) => React.createElement('path', { d, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' });
const _icirc = (cx, cy, r, fill='none') => React.createElement('circle', { cx, cy, r, fill, stroke: 'currentColor', strokeWidth: 1.6 });
const _irect = (x, y, w, h, rx=0) => React.createElement('rect', { x, y, width: w, height: h, rx, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 });

function _wrap(size, children) {
  return React.createElement('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none' }, children);
}

const Icon = {
  // ── Navigation ──────────────────────
  dashboard: (s=18) => _wrap(s, [_irect(3,3,7,9,1.4), _irect(14,3,7,5,1.4), _irect(14,12,7,9,1.4), _irect(3,16,7,5,1.4)].map((e,i)=>React.cloneElement(e,{key:i}))),
  box: (s=18) => _wrap(s, [_ipath('M3 8 12 3l9 5v8l-9 5-9-5V8z'), _ipath('M3 8l9 5 9-5M12 13v10')].map((e,i)=>React.cloneElement(e,{key:i}))),
  calc: (s=18) => _wrap(s, [_irect(4,3,16,18,2), _ipath('M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4')].map((e,i)=>React.cloneElement(e,{key:i}))),
  users: (s=18) => _wrap(s, [_icirc(9,8,4), _ipath('M2 21c0-4 3-7 7-7s7 3 7 7'), _ipath('M17 11a3 3 0 100-6'), _ipath('M22 21c0-3-2-5-5-5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  radar: (s=18) => _wrap(s, [_icirc(12,12,9), _icirc(12,12,5), _icirc(12,12,1.5,'currentColor'), _ipath('M12 3v3M12 18v3M3 12h3M18 12h3')].map((e,i)=>React.cloneElement(e,{key:i}))),
  invoice: (s=18) => _wrap(s, [_ipath('M5 3h11l3 3v15H5z'), _ipath('M16 3v3h3'), _ipath('M8 11h8M8 15h8M8 19h5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  doc: (s=18) => _wrap(s, [_ipath('M6 3h9l4 4v14H6z'), _ipath('M15 3v4h4'), _ipath('M9 13h6M9 17h6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  warehouse: (s=18) => _wrap(s, [_ipath('M3 9l9-5 9 5v12H3z'), _ipath('M7 21V13h10v8'), _ipath('M7 17h10')].map((e,i)=>React.cloneElement(e,{key:i}))),
  truck: (s=18) => _wrap(s, [_irect(1,7,12,9,1.4), _ipath('M13 10h5l3 4v2h-8z'), _icirc(6,18,2), _icirc(17,18,2)].map((e,i)=>React.cloneElement(e,{key:i}))),
  tag: (s=18) => _wrap(s, [_ipath('M3 12V3h9l9 9-9 9z'), _icirc(8,8,1.5,'currentColor')].map((e,i)=>React.cloneElement(e,{key:i}))),
  shield: (s=18) => _wrap(s, [_ipath('M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z'), _ipath('M9 12l2 2 4-4')].map((e,i)=>React.cloneElement(e,{key:i}))),
  chart: (s=18) => _wrap(s, [_ipath('M3 3v18h18'), _ipath('M7 15l3-3 3 3 5-5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  spark: (s=18) => _wrap(s, [_ipath('M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  mail: (s=18) => _wrap(s, [_irect(3,5,18,14,2), _ipath('M3 7l9 6 9-6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  chat: (s=18) => _wrap(s, [_ipath('M4 5h16v11H9l-4 4z'), _ipath('M8 9.5h8M8 12.5h5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  flow: (s=18) => _wrap(s, [_icirc(5,6,2.3), _icirc(5,18,2.3), _icirc(19,12,2.3), _ipath('M7.2 7l9.6 4M7.2 17l9.6 -4')].map((e,i)=>React.cloneElement(e,{key:i}))),

  // ── Actions ────────────────────────
  plus: (s=14) => _wrap(s, [_ipath('M12 5v14M5 12h14')].map((e,i)=>React.cloneElement(e,{key:i}))),
  search: (s=16) => _wrap(s, [_icirc(11,11,7), _ipath('M21 21l-5-5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  filter: (s=14) => _wrap(s, [_ipath('M3 5h18l-7 9v7l-4-2v-5L3 5z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  more: (s=14) => _wrap(s, [_icirc(5,12,1.4,'currentColor'), _icirc(12,12,1.4,'currentColor'), _icirc(19,12,1.4,'currentColor')].map((e,i)=>React.cloneElement(e,{key:i}))),
  close: (s=14) => _wrap(s, [_ipath('M6 6l12 12M18 6 6 18')].map((e,i)=>React.cloneElement(e,{key:i}))),
  check: (s=14) => _wrap(s, [_ipath('M5 12l5 5 9-11')].map((e,i)=>React.cloneElement(e,{key:i}))),
  arrowR: (s=14) => _wrap(s, [_ipath('M5 12h14M13 6l6 6-6 6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  arrowL: (s=14) => _wrap(s, [_ipath('M19 12H5M11 6l-6 6 6 6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  chevR: (s=14) => _wrap(s, [_ipath('M9 6l6 6-6 6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  chevD: (s=14) => _wrap(s, [_ipath('M6 9l6 6 6-6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  chevU: (s=14) => _wrap(s, [_ipath('M6 15l6-6 6 6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  download: (s=14) => _wrap(s, [_ipath('M12 3v12M7 10l5 5 5-5M5 21h14')].map((e,i)=>React.cloneElement(e,{key:i}))),
  upload: (s=14) => _wrap(s, [_ipath('M12 15V3M7 8l5-5 5 5M5 21h14')].map((e,i)=>React.cloneElement(e,{key:i}))),
  edit: (s=14) => _wrap(s, [_ipath('M16 3l5 5-11 11H5v-5z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  trash: (s=14) => _wrap(s, [_ipath('M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  eye: (s=14) => _wrap(s, [_ipath('M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z'), _icirc(12,12,3)].map((e,i)=>React.cloneElement(e,{key:i}))),
  link: (s=14) => _wrap(s, [_ipath('M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5'), _ipath('M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  copy: (s=14) => _wrap(s, [_irect(8,8,12,12,2), _ipath('M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3')].map((e,i)=>React.cloneElement(e,{key:i}))),

  // ── Status / utility ───────────────
  bell: (s=18) => _wrap(s, [_ipath('M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8'), _ipath('M10 21a2 2 0 004 0')].map((e,i)=>React.cloneElement(e,{key:i}))),
  sun: (s=16) => _wrap(s, [_icirc(12,12,4), _ipath('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')].map((e,i)=>React.cloneElement(e,{key:i}))),
  moon: (s=16) => _wrap(s, [_ipath('M21 13A9 9 0 1111 3a7 7 0 0010 10z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  menu: (s=18) => _wrap(s, [_ipath('M3 6h18M3 12h18M3 18h18')].map((e,i)=>React.cloneElement(e,{key:i}))),
  panelL: (s=18) => _wrap(s, [_irect(3,3,18,18,2), _ipath('M9 3v18')].map((e,i)=>React.cloneElement(e,{key:i}))),
  cog: (s=16) => _wrap(s, [_icirc(12,12,3), _ipath('M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  warn: (s=14) => _wrap(s, [_ipath('M12 3l10 18H2z'), _ipath('M12 10v5M12 18h.01')].map((e,i)=>React.cloneElement(e,{key:i}))),
  info: (s=14) => _wrap(s, [_icirc(12,12,9), _ipath('M12 8h.01M11 12h1v4h1')].map((e,i)=>React.cloneElement(e,{key:i}))),
  clock: (s=14) => _wrap(s, [_icirc(12,12,9), _ipath('M12 7v5l3 2')].map((e,i)=>React.cloneElement(e,{key:i}))),
  pin: (s=14) => _wrap(s, [_ipath('M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z'), _icirc(12,9,2.5)].map((e,i)=>React.cloneElement(e,{key:i}))),
  globe: (s=14) => _wrap(s, [_icirc(12,12,9), _ipath('M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18')].map((e,i)=>React.cloneElement(e,{key:i}))),
  ship: (s=18) => _wrap(s, [_ipath('M3 15l1.5-5h15L21 15M12 5v5'), _ipath('M3 19s2-1 4-1 3 1 5 1 3-1 5-1 4 1 4 1'), _ipath('M9 8h6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  cn: (s=14) => _wrap(s, [_irect(2,4,20,16,2), _ipath('M7 11l1 1 1-2 1 2 1-1M14 11l1 1 1-2 1 2 1-1')].map((e,i)=>React.cloneElement(e,{key:i}))),
  flag: (s=14) => _wrap(s, [_ipath('M4 21V4h12l-2 4 2 4H4')].map((e,i)=>React.cloneElement(e,{key:i}))),
  refresh: (s=14) => _wrap(s, [_ipath('M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5')].map((e,i)=>React.cloneElement(e,{key:i}))),
  external: (s=12) => _wrap(s, [_ipath('M7 17L17 7M9 7h8v8')].map((e,i)=>React.cloneElement(e,{key:i}))),
  star: (s=14) => _wrap(s, [_ipath('M12 3l2.9 6 6.1.9-4.5 4.3 1.1 6.3L12 17l-5.6 3.5L7.5 14.2 3 9.9 9.1 9z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  flame: (s=14) => _wrap(s, [_ipath('M12 3s4 3 4 8a4 4 0 11-8 0c0-2 1-3 1-3s-1 4 2 4-1-6 1-9z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  lock: (s=18) => _wrap(s, [_irect(4,11,16,10,2), _ipath('M8 11V7a4 4 0 018 0v4'), _icirc(12,16,1.4,'currentColor')].map((e,i)=>React.cloneElement(e,{key:i}))),

  // ── Añadidos · de-duplicación del sidebar (2026-05) ──────────
  map: (s=18) => _wrap(s, [_ipath('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z'), _ipath('M9 4v14M15 6v14')].map((e,i)=>React.cloneElement(e,{key:i}))),
  gauge: (s=18) => _wrap(s, [_ipath('M4 19a8 8 0 1 1 16 0'), _ipath('M12 19l4.5-4.5'), _icirc(12,19,1.3,'currentColor')].map((e,i)=>React.cloneElement(e,{key:i}))),
  calendar: (s=18) => _wrap(s, [_irect(3,5,18,16,2), _ipath('M3 10h18M8 3v4M16 3v4')].map((e,i)=>React.cloneElement(e,{key:i}))),
  qr: (s=18) => _wrap(s, [_irect(3,3,7,7,1.2), _irect(14,3,7,7,1.2), _irect(3,14,7,7,1.2), _ipath('M14 14h3v3M14 19v2h2M19 19v2h2M21 14v2')].map((e,i)=>React.cloneElement(e,{key:i}))),
  route: (s=18) => _wrap(s, [_icirc(5,19,2), _icirc(19,7,2), _ipath('M7 19h5a4 4 0 0 0 4-4V9')].map((e,i)=>React.cloneElement(e,{key:i}))),
  sliders: (s=18) => _wrap(s, [_ipath('M4 8h9M19 8h1M4 16h1M11 16h9'), _icirc(16,8,2.2), _icirc(8,16,2.2)].map((e,i)=>React.cloneElement(e,{key:i}))),
  barchart: (s=18) => _wrap(s, [_ipath('M3 21h18'), _ipath('M7 21v-7M12 21V7M17 21v-10')].map((e,i)=>React.cloneElement(e,{key:i}))),
  cash: (s=18) => _wrap(s, [_irect(2,6,20,12,2), _icirc(12,12,2.4), _ipath('M6 9v6M18 9v6')].map((e,i)=>React.cloneElement(e,{key:i}))),
  ledger: (s=18) => _wrap(s, [_ipath('M6 4h13v13H6a2 2 0 0 0 0 4h13v-4'), _ipath('M9 8h7M9 11.5h7')].map((e,i)=>React.cloneElement(e,{key:i}))),
  wallet: (s=18) => _wrap(s, [_irect(3,6,18,13,2.5), _ipath('M16 12h5v4h-5a2 2 0 0 1 0-4z')].map((e,i)=>React.cloneElement(e,{key:i}))),
  reconcile: (s=18) => _wrap(s, [_ipath('M4 8h12M13 5l3 3-3 3'), _ipath('M20 16H8M11 13l-3 3 3 3')].map((e,i)=>React.cloneElement(e,{key:i}))),
  margin: (s=18) => _wrap(s, [_ipath('M6 18 18 6'), _icirc(7.5,7.5,2.2), _icirc(16.5,16.5,2.2)].map((e,i)=>React.cloneElement(e,{key:i}))),
  eye: (s=18) => _wrap(s, [_ipath('M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z'), _icirc(12,12,3)].map((e,i)=>React.cloneElement(e,{key:i}))),
  idcard: (s=18) => _wrap(s, [_irect(3,5,18,14,2), _icirc(8.5,11,2.2), _ipath('M5.5 16c0-1.8 1.6-2.8 3-2.8s3 1 3 2.8M14 9.5h4M14 12.5h4M14 15.5h2')].map((e,i)=>React.cloneElement(e,{key:i}))),
  hardhat: (s=18) => _wrap(s, [_ipath('M3 17a9 9 0 0 1 18 0'), _ipath('M2 17h20'), _ipath('M10 8.6V6a2 2 0 0 1 4 0v2.6'), _ipath('M9 9.6a9 9 0 0 1 6 0')].map((e,i)=>React.cloneElement(e,{key:i}))),
};

window.Icon = Icon;
