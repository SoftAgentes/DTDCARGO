#!/usr/bin/env node
/**
 * scripts/norte.mjs — Genera el "Norte visual" de DTD Cargo.
 *
 * Un índice navegable de las pantallas-meta (mockups de Cloud Design) con un overlay
 * "estás aquí": por cada pantalla marca su estado en 3 niveles —
 *   ✅ Construido · 🚧 En construcción · 📋 Diseño — derivado del SDD del módulo
 * (front-matter `status` de la spec en docs/specs/) cruzado con si su carpeta de
 * código existe. Es la meta del proyecto + el progreso real, en una página.
 *
 * Uso:
 *   node scripts/norte.mjs                 # genera <NORTE_DIR>/_norte.html
 *   npx --yes serve "<NORTE_DIR>" -l 3010  # servir → http://localhost:3010/_norte.html
 *
 * Repetible: cambia NORTE_DIR a docs/design/studio/_norte cuando entre el primer NORTE-SYNC.
 * El campo `sdd` de cada pantalla sale del mapa docs/architecture/module-sdd-map.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Carpeta del "norte vigente". Hoy: v1.7 del repo. Con NORTE-SYNC pasará a docs/design/studio/_norte.
const NORTE_REL = "docs/design/studio/_norte";
const NORTE_DIR = path.join(ROOT, NORTE_REL);
const NORTE_VERSION = "v1.8";

// Pantallas-meta agrupadas por superficie.
//   `code` = ruta de código a verificar para el overlay "estás aquí" (null = aún sin código).
//   `sdd`  = nº de spec que gobierna la pantalla (de docs/architecture/module-sdd-map.md).
//            Para módulos con varios SDD se elige el que mejor representa "¿está construido?".
//            null = pantalla sin spec asociada (mockup puro o código sin spec formal).
const GROUPS = [
  {
    title: "ERP · Studio (admin)",
    screens: [
      { name: "DTD Studio · ERP (completo)", file: "DTD Studio · ERP.html", code: "app/studio/(app)", sdd: "0004" },
    ],
  },
  {
    title: "Despacho",
    screens: [
      { name: "Despacho · Vista 1", file: "Despacho · Vista 1.html", code: "app/studio/(app)/despacho", sdd: "0029" },
      { name: "Despacho · Vista 2", file: "Despacho · Vista 2.html", code: "app/studio/(app)/despacho", sdd: "0029" },
      { name: "Despacho · Vista 3", file: "Despacho · Vista 3.html", code: "app/studio/(app)/despacho", sdd: "0029" },
      { name: "Admin · Rutas", file: "Admin · Rutas.html", code: "app/studio/(app)/admin", sdd: "0019" },
    ],
  },
  {
    title: "Portal del Cliente",
    screens: [
      { name: "Portal del Cliente · V2", file: "Portal del Cliente · V2.html", code: null, sdd: null },
      { name: "Portal del Cliente", file: "Portal del Cliente.html", code: null, sdd: null },
      { name: "Registro de cliente · V2", file: "Registro de cliente · V2.html", code: "app/invitar", sdd: "0024" },
      { name: "Registro Cliente", file: "Registro Cliente.html", code: "app/invitar", sdd: "0024" },
    ],
  },
  {
    title: "Móvil · Operarios",
    screens: [
      { name: "Mobile ERP", file: "Mobile ERP.html", code: "app/m/erp", sdd: null },
      { name: "Operario CN", file: "Operario CN.html", code: "app/m/cn", sdd: "0016" },
      { name: "Operario VE", file: "Operario VE.html", code: "app/m/ve", sdd: "0017" },
      { name: "Operario Multi", file: "Operario Multi.html", code: "app/m", sdd: "0030" },
      { name: "Bodeguero VE", file: "Bodeguero VE.html", code: "app/m/ve/bodeguero", sdd: "0030" },
      { name: "Camionero", file: "Camionero.html", code: "app/m/ve/camionero", sdd: "0030" },
    ],
  },
  {
    title: "Perfiles (pendientes de diseño/código)",
    screens: [
      { name: "Perfil · Agente aduanal", file: "nuevo/pantallas/agente-perfil.html", code: null, sdd: null },
      { name: "Perfil · Camión", file: "nuevo/pantallas/camion-perfil.html", code: null, sdd: null },
      { name: "Perfil · Chofer", file: "nuevo/pantallas/chofer-perfil.html", code: null, sdd: null },
      { name: "Estado de cuenta", file: "nuevo/pantallas/estado-cuenta.html", code: null, sdd: null },
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

// --- Estado del SDD por nº de spec --------------------------------------------------
// Parsea el front-matter `status` de docs/specs/NNNN-*/spec.md (tolerante a CRLF,
// mismo criterio que scripts/build-docs-index.mjs · parseFrontMatter). Cache: 1 lectura/spec.
const SPECS_DIR = path.join(ROOT, "docs/specs");
const specStatusCache = new Map();

function specStatus(sdd) {
  if (!sdd) return null;
  if (specStatusCache.has(sdd)) return specStatusCache.get(sdd);
  let status = null;
  try {
    const dir = fs.readdirSync(SPECS_DIR, { withFileTypes: true })
      .find((d) => d.isDirectory() && d.name.startsWith(`${sdd}-`));
    if (dir) {
      const text = fs.readFileSync(path.join(SPECS_DIR, dir.name, "spec.md"), "utf8");
      if (text.startsWith("---")) {
        const end = text.indexOf("\n---", 3);
        if (end !== -1) {
          for (const line of text.slice(3, end).split(/\r?\n/)) {
            const m = line.match(/^status:\s*(.*)$/i);
            if (m) { status = m[1].trim().replace(/^["']|["']$/g, "") || null; break; }
          }
        }
      }
    }
  } catch {
    status = null; // spec ilegible → tratado como "sin spec"
  }
  specStatusCache.set(sdd, status);
  return status;
}

// --- Regla de derivación de estado (3 niveles) --------------------------------------
// El estado lo manda el SDD del módulo, NO solo "existe la carpeta". Prioridad mayor→menor:
//   1. brand                     → Marca (material de identidad, fuera del conteo).
//   2. spec status `done`        → ✅ Construido (el SDD se cerró).
//   3. spec status `in-progress` → 🚧 En construcción (trabajo activo; tenga código o no).
//   4. spec status `approved`    → 🚧 En construcción (luz verde dada; mientras el SDD no
//                                  esté `done` el módulo no se da por terminado, aun con código).
//   5. sin spec / draft / proposed:
//        · con carpeta de código → ✅ Construido (código sin SDD formal pero ya funcional).
//        · sin código            → 📋 Diseño (solo mockup, falta construir).
// Borde "código presente pero spec ≠ done": se resuelve a favor del SDD →
//   código + spec in-progress/approved = 🚧 (la spec abierta gana); código SIN spec = ✅.
// El único caso donde el código promueve a ✅ es cuando no hay spec que lo gobierne.
function statusFor(s) {
  if (s.kind === "brand") return { label: "Marca", cls: "brand" };
  const hasCode = Boolean(s.code && exists(s.code));
  const st = specStatus(s.sdd);
  if (st === "done") return { label: "✅ Construido", cls: "built" };
  if (st === "in-progress" || st === "approved") {
    return { label: "🚧 En construcción", cls: "wip" };
  }
  // sin spec asociada (o draft/proposed): el código manda
  return hasCode
    ? { label: "✅ Construido", cls: "built" }
    : { label: "📋 Diseño", cls: "design" };
}

const esc = (str) =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let built = 0;
let wip = 0;
let design = 0;
let total = 0;
const sections = GROUPS.map((g) => {
  const cards = g.screens
    .map((s) => {
      const present = screenPresent(s.file);
      const st = statusFor(s);
      if (st.cls === "built") built++;
      else if (st.cls === "wip") wip++;
      else if (st.cls === "design") design++;
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
    --built: #1F8A5B; --wip: #B8893A; --design: #6B6B6B;
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
  .badge.wip { background: rgba(184,137,58,.14); color: var(--wip); }
  .badge.design { background: rgba(107,107,107,.12); color: var(--design); }
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
  <p>Mapa de las pantallas-meta del proyecto. Cada tarjeta abre el mockup navegable; el badge dice en qué punto está cada módulo en la app real.</p>
  <div class="meta">${NORTE_VERSION} · <b>${built}</b> construidas · <b>${wip}</b> en construcción · <b>${design}</b> en diseño · ${total} módulos · generado por scripts/norte.mjs</div>
</header>
<main>
  <div class="legend">
    <span><span class="badge built">✅ Construido</span> SDD cerrado (done) o código sin spec</span>
    <span><span class="badge wip">🚧 En construcción</span> SDD aprobado o en progreso</span>
    <span><span class="badge design">📋 Diseño</span> solo mockup, falta construir</span>
    <span><span class="badge brand">Marca</span> material de identidad</span>
  </div>
${sections}
</main>
<footer>Norte vigente: <code>${esc(NORTE_REL)}</code> · estado derivado del <code>status</code> del SDD del módulo cruzado con la carpeta de código (mapa en <code>docs/architecture/module-sdd-map.md</code>).</footer>
</body>
</html>
`;

const OUT = path.join(NORTE_DIR, "_norte.html");
fs.writeFileSync(OUT, html, "utf8");
console.log(`[norte] generado: ${path.relative(ROOT, OUT)}`);
console.log(`[norte] ${built} construidas · ${wip} en construcción · ${design} en diseño (${total} módulos)`);
console.log(`[norte] servir:  npx --yes serve "${NORTE_REL}" -l 3010`);
console.log(`[norte] abrir:   http://localhost:3010/_norte.html`);
