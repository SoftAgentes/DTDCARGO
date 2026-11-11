// Genera los SVG del ícono del aviso «DTD Cargo · Noticias» (webhook de #noticias, SDD-0611).
// Uso:  node docs/specs/0611-noticias-publicacion-automatica/assets/discord/generar.mjs
// Después: render.sh exporta los PNG con Chrome headless.
//
// Mismo sistema que el ícono de ALFRED (PR #390): colores de BRAND.md, Archivo Black y
// JetBrains Mono desde lib/font-files e isólogo oficial de public/brand, sin deformar.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../..");
const b64 = (p) => readFileSync(join(root, p)).toString("base64");

// ── Tokens (BRAND.md) ─────────────────────────────────────────────
const C = {
  wine: "#7F0F1A",
  wineDeep: "#5E0A12",
  paper: "#FBFAF7",
  ink: "#0F1E3D",
};

const fonts = `
@font-face{font-family:'Archivo Black';src:url(data:font/woff2;base64,${b64("lib/font-files/archivo-black-latin-400.woff2")}) format('woff2');}
@font-face{font-family:'Archivo';font-weight:100 900;src:url(data:font/woff2;base64,${b64("lib/font-files/archivo-latin-wght.woff2")}) format('woff2');}
`;

const LOGO_W = 741;
const LOGO_H = 764;
const logo = {
  primary: `data:image/png;base64,${b64("public/brand/dtdcargo-isologo-primary.png")}`,
  monoLight: `data:image/png;base64,${b64("public/brand/dtdcargo-isologo-mono-light.png")}`,
};
const isologo = (variant, cx, cy, h) => {
  const w = (h * LOGO_W) / LOGO_H;
  return `<image href="${logo[variant]}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
};

const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><style>${fonts}</style>${defs}</defs>
${body}
</svg>
`;

const S = 1024;
const c = S / 2;
// Disco papel con aro tenue: el mismo marco que el ícono de ALFRED.
const marco = `<rect width="${S}" height="${S}" fill="${C.paper}"/>
<circle cx="${c}" cy="${c}" r="470" fill="none" stroke="${C.ink}" stroke-width="4" opacity="0.18"/>`;

// ── Ícono A · «N» (recomendado) ────────────────────────────────────────────────
// Una N geométrica entera en tinta, subrayada con una barra vino de titular.
// La diagonal NO va en vino: una N con la diagonal en otro color recuerda a una marca ajena.
const top = 200;
const bot = 730;
const pierna = 128;
const xl = 270; // borde izquierdo de la pierna izquierda
const xr = 754; // borde derecho de la pierna derecha
const nPath = `M${xl} ${bot} L${xl} ${top} L${xl + pierna} ${top} L${xr - pierna} ${bot - 250} L${xr - pierna} ${top} L${xr} ${top} L${xr} ${bot} L${xr - pierna} ${bot} L${xl + pierna} ${top + 250} L${xl + pierna} ${bot} Z`;
const iconoN = svg(
  S,
  S,
  `${marco}
<path d="${nPath}" fill="${C.ink}" stroke-linejoin="miter"/>
<rect x="${xl}" y="${bot + 42}" width="${xr - xl}" height="44" rx="22" fill="${C.wine}"/>
${isologo("primary", c, 892, 70)}`,
);

// ── Ícono B · «Periódico» ─────────────────────────────────────────
// Hoja de diario en tinta, con la esquina doblada, titular vino y líneas de texto.
const px = 268;
const py = 228;
const pw = 488;
const ph = 556;
const dobl = 92; // esquina doblada arriba a la derecha
const hoja = `M${px + 28} ${py} L${px + pw - dobl} ${py} L${px + pw} ${py + dobl} L${px + pw} ${py + ph - 28} Q${px + pw} ${py + ph} ${px + pw - 28} ${py + ph} L${px + 28} ${py + ph} Q${px} ${py + ph} ${px} ${py + ph - 28} L${px} ${py + 28} Q${px} ${py} ${px + 28} ${py} Z`;
const lineas = [];
for (let i = 0; i < 5; i++) {
  const y = py + 270 + i * 54;
  lineas.push(`<rect x="${px + 52}" y="${y}" width="170" height="24" rx="12" fill="${C.paper}" opacity="0.85"/>`);
}
const iconoPeriodico = svg(
  S,
  S,
  `${marco}
<path d="${hoja}" fill="${C.ink}"/>
<path d="M${px + pw - dobl} ${py} L${px + pw - dobl} ${py + dobl - 18} Q${px + pw - dobl} ${py + dobl} ${px + pw - dobl + 18} ${py + dobl} L${px + pw} ${py + dobl} Z" fill="${C.paper}" opacity="0.35"/>
<rect x="${px + 52}" y="${py + 112}" width="${pw - 104}" height="96" rx="14" fill="${C.wine}" stroke="${C.paper}" stroke-width="10" paint-order="stroke"/>
${lineas.join("\n")}
<rect x="${px + 262}" y="${py + 270}" width="${pw - 314}" height="240" rx="16" fill="${C.paper}" opacity="0.28"/>
${isologo("primary", c, 878, 74)}`,
);

// ── Ícono C · «Sello» ─────────────────────────────────────────────
// Sello vino con leyenda circular y la N al centro, como el sello de ALFRED.
const leyenda = "NOTICIAS · DTD CARGO · ACTUALIDAD · ";
const iconoSello = svg(
  S,
  S,
  `<rect width="${S}" height="${S}" fill="${C.wine}"/>
<circle cx="${c}" cy="${c}" r="452" fill="none" stroke="${C.paper}" stroke-width="10"/>
<circle cx="${c}" cy="${c}" r="318" fill="none" stroke="${C.paper}" stroke-width="5"/>
<text font-family="Archivo" font-weight="800" font-size="56" fill="${C.paper}">
  <textPath href="#arco" startOffset="0" textLength="${(2 * Math.PI * 385 - 4).toFixed(0)}" lengthAdjust="spacing">${leyenda}</textPath>
</text>
<text x="${c}" y="${c + 120}" text-anchor="middle" font-family="Archivo Black" font-size="390" fill="${C.paper}">N</text>
${isologo("monoLight", c, 700, 64)}`,
  `<path id="arco" d="M ${c} ${c - 385} a 385 385 0 1 1 -0.01 0" fill="none"/>`,
);

const out = {
  "noticias-icono.svg": iconoN, // recomendado: «N»
  "noticias-icono-periodico.svg": iconoPeriodico,
  "noticias-icono-sello.svg": iconoSello,
};
for (const [f, s] of Object.entries(out)) {
  writeFileSync(join(here, f), s);
  console.log(f, Math.round(s.length / 1024), "KB");
}
