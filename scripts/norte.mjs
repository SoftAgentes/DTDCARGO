#!/usr/bin/env node
/**
 * scripts/norte.mjs — Genera el "Norte visual" de DTD Cargo.
 *
 * Un índice navegable de las pantallas-meta (mockups de Cloud Design) con un overlay
 * "estás aquí": por cada pantalla, marca si su código YA existe en el repo (✅ construido)
 * o si todavía es solo diseño (📋). Es la meta del proyecto + el progreso, en una página.
 *
 * Uso:
 *   node scripts/norte.mjs                 # genera <NORTE_DIR>/_norte.html
 *   npx --yes serve "<NORTE_DIR>" -l 3010  # servir → http://localhost:3010/_norte.html
 *
 * Repetible: cambia NORTE_DIR a docs/design/studio/_norte cuando entre el primer NORTE-SYNC.
 * No genera "estado real": se basa en si existe la carpeta de código (mapa module-sdd-map.md).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Carpeta del "norte vigente". Hoy: v1.7 del repo. Con NORTE-SYNC pasará a docs/design/studio/_norte.
const NORTE_REL = "docs/design/studio/_norte";
const NORTE_DIR = path.join(ROOT, NORTE_REL);
const NORTE_VERSION = "v1.8";

// Pantallas-meta agrupadas por superficie. `code` = ruta a verificar para el badge "estás aquí".
const GROUPS = [
  {
    title: "ERP · Studio (admin)",
    screens: [
      { name: "DTD Studio · ERP (completo)", file: "DTD Studio · ERP.html", code: "app/studio/(app)" },
    ],
  },
  {
    title: "Despacho",
    screens: [
      { name: "Despacho · Vista 1", file: "Despacho · Vista 1.html", code: "app/studio/(app)/despacho" },
      { name: "Despacho · Vista 2", file: "Despacho · Vista 2.html", code: "app/studio/(app)/despacho" },
      { name: "Despacho · Vista 3", file: "Despacho · Vista 3.html", code: "app/studio/(app)/despacho" },
      { name: "Admin · Rutas", file: "Admin · Rutas.html", code: "app/studio/(app)/admin" },
    ],
  },
  {
    title: "Portal del Cliente",
    screens: [
      { name: "Portal del Cliente · V2", file: "Portal del Cliente · V2.html", code: null },
      { name: "Portal del Cliente", file: "Portal del Cliente.html", code: null },
      { name: "Registro de cliente · V2", file: "Registro de cliente · V2.html", code: "app/invitar" },
      { name: "Registro Cliente", file: "Registro Cliente.html", code: "app/invitar" },
    ],
  },
  {
    title: "Móvil · Operarios",
    screens: [
      { name: "Mobile ERP", file: "Mobile ERP.html", code: "app/m/erp" },
      { name: "Operario CN", file: "Operario CN.html", code: "app/m/cn" },
      { name: "Operario VE", file: "Operario VE.html", code: "app/m/ve" },
      { name: "Operario Multi", file: "Operario Multi.html", code: "app/m" },
      { name: "Bodeguero VE", file: "Bodeguero VE.html", code: "app/m/ve/bodeguero" },
      { name: "Camionero", file: "Camionero.html", code: "app/m/ve/camionero" },
    ],
  },
  {
    title: "Perfiles (pendientes de diseño/código)",
    screens: [
      { name: "Perfil · Agente aduanal", file: "nuevo/pantallas/agente-perfil.html", code: null },
      { name: "Perfil · Camión", file: "nuevo/pantallas/camion-perfil.html", code: null },
      { name: "Perfil · Chofer", file: "nuevo/pantallas/chofer-perfil.html", code: null },
      { name: "Estado de cuenta", file: "nuevo/pantallas/estado-cuenta.html", code: null },
    ],
  },
  {
    title: "Marca",
    screens: [
      { name: "Brand Book v3.0", file: "Brand Book DTD v3.0.html", kind: "brand" },
      { name: "Logo Oficial", file: "Logo Oficial.html", kind: "brand" },
      { name: "Iconos de Perfil", file: "Iconos de Perfil.html", kind: "brand" },
      { name: "Aplicaciones de Marca", file: "Aplicaciones de Marca.html", kind: "brand" },
    ],
  },
];

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const screenPresent = (file) => fs.existsSync(path.join(NORTE_DIR, file));

function statusFor(s) {
  if (s.kind === "brand") return { label: "Marca", cls: "brand" };
  if (s.code && exists(s.code)) return { label: "✓ Construido", cls: "built" };
  return { label: "Diseño", cls: "design" };
}

const esc = (str) =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let built = 0;
let total = 0;
const sections = GROUPS.map((g) => {
  const cards = g.screens
    .map((s) => {
      const present = screenPresent(s.file);
      const st = statusFor(s);
      if (st.cls === "built") built++;
      if (st.cls !== "brand") total++;
      const href = encodeURI("./" + s.file);
      const open = present
        ? `<a class="open" href="${href}" target="_blank" rel="noopener">Abrir ↗</a>`
        : `<span class="open missing">falta el archivo</span>`;
      return `      <div class="card ${st.cls}">
        <div class="card-top"><span class="name">${esc(s.name)}</span><span class="badge ${st.cls}">${esc(st.label)}</span></div>
        ${open}
      </div>`;
    })
    .join("\n");
  return `    <section class="group">
      <h2>${esc(g.title)}</h2>
      <div class="cards">
${cards}
      </div>
    </section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Norte · DTD Studio (${NORTE_VERSION})</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --wine: #7F0F1A; --navy: #0F1E3D; --paper: #FBFAF7; --surface: #FFFFFF;
    --ink: #0F1E3D; --ink-soft: #6B6B6B; --ink-mute: #9B9B9B; --border: #E8E6E2;
    --built: #1F8A5B; --design: #B8893A;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 400 15px/1.5 'Archivo', system-ui, sans-serif; }
  header { background: var(--navy); color: var(--paper); padding: 28px 32px; }
  header .eyebrow { font: 600 12px/1 'Archivo'; letter-spacing: .12em; text-transform: uppercase; color: #A8B0C4; }
  header h1 { font: 900 30px/1.1 'Archivo Black'; margin: 8px 0 6px; }
  header p { margin: 0; color: #A8B0C4; font-size: 14px; }
  header .meta { margin-top: 14px; font: 600 13px/1 'JetBrains Mono'; color: var(--paper); }
  header .meta b { color: #6FE0A8; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px 32px 64px; }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; font-size: 13px; color: var(--ink-soft); }
  .legend .badge { margin-right: 6px; }
  .group { margin-bottom: 32px; }
  .group h2 { font: 800 16px/1.2 'Archivo'; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
  .card .name { font-weight: 600; font-size: 14px; }
  .badge { font: 600 11px/1 'Archivo'; padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
  .badge.built { background: rgba(31,138,91,.12); color: var(--built); }
  .badge.design { background: rgba(184,137,58,.14); color: var(--design); }
  .badge.brand { background: rgba(127,15,26,.10); color: var(--wine); }
  .open { display: inline-block; font: 600 13px/1 'Archivo'; color: var(--wine); text-decoration: none; }
  .open:hover { text-decoration: underline; }
  .open.missing { color: var(--ink-mute); font-style: italic; }
  footer { max-width: 1100px; margin: 0 auto; padding: 0 32px 48px; color: var(--ink-mute); font-size: 12px; }
</style>
</head>
<body>
<header>
  <div class="eyebrow">DTD Studio · Norte visual</div>
  <h1>A dónde vamos — y dónde estamos</h1>
  <p>Mapa de las pantallas-meta del proyecto. Cada tarjeta abre el mockup navegable; el badge dice si ya está construido en la app real.</p>
  <div class="meta">${NORTE_VERSION} · <b>${built}</b> construidas de ${total} módulos · generado por scripts/norte.mjs</div>
</header>
<main>
  <div class="legend">
    <span><span class="badge built">✓ Construido</span> el código ya existe en el repo</span>
    <span><span class="badge design">Diseño</span> solo mockup, falta construir</span>
    <span><span class="badge brand">Marca</span> material de identidad</span>
  </div>
${sections}
</main>
<footer>Norte vigente: <code>${esc(NORTE_REL)}</code> · estado calculado por existencia de carpeta de código (ver <code>docs/architecture/module-sdd-map.md</code>).</footer>
</body>
</html>
`;

const OUT = path.join(NORTE_DIR, "_norte.html");
fs.writeFileSync(OUT, html, "utf8");
console.log(`[norte] generado: ${path.relative(ROOT, OUT)}`);
console.log(`[norte] ${built}/${total} módulos construidos`);
console.log(`[norte] servir:  npx --yes serve "${NORTE_REL}" -l 3010`);
console.log(`[norte] abrir:   http://localhost:3010/_norte.html`);
