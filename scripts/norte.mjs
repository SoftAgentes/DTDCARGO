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
 * El dashboard muestra: barra de progreso segmentada (global + una mini por superficie),
 * "movimiento reciente" (últimas specs tocadas, leído del campo `updated` del front-matter),
 * y por cada pantalla su SDD + ruta de código. Se regenera; no se edita el HTML a mano.
 *
 * Uso:
 *   node scripts/norte.mjs                 # genera <NORTE_DIR>/_norte.html
 *   npx --yes serve "<NORTE_DIR>" -l 3010  # servir → http://localhost:3010/_norte.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Carpeta del "norte vigente" (única, se sobrescribe en cada NORTE-SYNC).
const NORTE_REL = "docs/design/studio/_norte";
const NORTE_DIR = path.join(ROOT, NORTE_REL);
const NORTE_VERSION = "v1.9"; // handoff Cloud Design (front llegó a v1.9.2)

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
      { name: "Admin · Rutas", file: "Admin · Rutas.html", code: "app/studio/(app)/tms", sdd: "0019" },
    ],
  },
  {
    title: "Portal del Cliente",
    // Una sola pantalla por concepto. En v1.9 el ZIP traía duplicado (V1 + "· V2"); el founder
    // lo unificó en Cloud Design (2026-05-31): desde v1.91 viene UN solo archivo con NOMBRE BASE
    // ("Portal del Cliente.html" / "Registro Cliente.html") y el contenido bueno (ex-V2).
    // ⮕ AL CARGAR v1.91: cambiar estos `file:` de "· V2.html" al nombre base, y verificar el shell.
    //   Hoy (v1.9) apuntan al "· V2.html" porque es el único archivo con el contenido correcto.
    screens: [
      { name: "Portal del Cliente", file: "Portal del Cliente · V2.html", code: null, sdd: null },
      { name: "Modo Cliente (impersonación admin)", file: "Modo Cliente.html", code: null, sdd: null },
      { name: "Registro de cliente", file: "Registro de cliente · V2.html", code: "app/invitar", sdd: "0024" },
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
    title: "Perfiles individuales",
    screens: [
      { name: "Perfil · Usuario interno", file: "nuevo/pantallas/usuario-perfil.html", code: null, sdd: null },
      { name: "Perfil · Agente aduanal", file: "nuevo/pantallas/agente-perfil.html", code: null, sdd: null },
      { name: "Perfil · Camión", file: "nuevo/pantallas/camion-perfil.html", code: null, sdd: null },
      { name: "Perfil · Chofer", file: "nuevo/pantallas/chofer-perfil.html", code: null, sdd: null },
      { name: "Estado de cuenta", file: "nuevo/pantallas/estado-cuenta.html", code: null, sdd: null },
    ],
  },
  {
    title: "Cross-módulo & productividad (v1.9)",
    screens: [
      { name: "Tu día (bandeja personal)", file: "nuevo/pantallas/tu-dia.html", code: null, sdd: null },
      { name: "AI Copilot (chat sobre datos)", file: "nuevo/pantallas/copilot.html", code: null, sdd: null },
      { name: "Hilo de comentario expandido", file: "nuevo/pantallas/hilo-comentario.html", code: null, sdd: null },
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

// --- Specs: cargar TODAS una vez (status + updated + title) -------------------------
// Parsea el front-matter de docs/specs/NNNN-*/spec.md (tolerante a CRLF, mismo criterio
// que scripts/build-docs-index.mjs). Una sola pasada cacheada por nº de spec; alimenta
// tanto el overlay de estado como el bloque "Movimiento reciente".
const SPECS_DIR = path.join(ROOT, "docs/specs");
const specByNum = new Map(); // "0029" -> { status, updated, title, dirName }
let specsLoaded = false;

const cleanFM = (s) => (s || "").trim().replace(/^["']|["']$/g, "") || null;

function loadSpecs() {
  if (specsLoaded) return;
  specsLoaded = true;
  let entries = [];
  try {
    entries = fs.readdirSync(SPECS_DIR, { withFileTypes: true });
  } catch {
    return; // sin carpeta de specs → todo se trata como "sin spec"
  }
  for (const d of entries) {
    if (!d.isDirectory()) continue;
    const m = d.name.match(/^(\d{4})-/);
    if (!m) continue;
    let status = null, updated = null, title = null;
    try {
      const text = fs.readFileSync(path.join(SPECS_DIR, d.name, "spec.md"), "utf8");
      if (text.startsWith("---")) {
        const end = text.indexOf("\n---", 3);
        if (end !== -1) {
          for (const line of text.slice(3, end).split(/\r?\n/)) {
            let mm;
            if ((mm = line.match(/^status:\s*(.*)$/i))) status = cleanFM(mm[1]);
            else if ((mm = line.match(/^updated:\s*(.*)$/i))) updated = cleanFM(mm[1]);
            else if ((mm = line.match(/^title:\s*(.*)$/i))) title = cleanFM(mm[1]);
          }
        }
      }
    } catch {
      /* spec ilegible → queda con campos null */
    }
    specByNum.set(m[1], { status, updated, title, dirName: d.name });
  }
}

function specMeta(sdd) {
  loadSpecs();
  return sdd ? specByNum.get(sdd) || null : null;
}

// --- Regla de derivación de estado (3 niveles) --------------------------------------
// El estado lo manda el SDD del módulo cruzado con la presencia de código. Prioridad:
//   1. brand                     → Marca (material de identidad, fuera del conteo).
//   2. spec status `done`        → ✅ Construido (SDD cerrado).
//   3. spec status `in-progress` → 🚧 En construcción (trabajo activo declarado).
//   4. spec status `approved`    → el CÓDIGO manda: con carpeta = ✅ Construido (cerrado en
//                                  prod aunque el SDD no se marcó `done`); sin carpeta = 🚧.
//   5. sin spec / draft / proposed → con código ✅ Construido · sin código 📋 Diseño.
// (Antes `approved` siempre daba 🚧; eso pintaba como "en obra" módulos ya operativos cuyo
//  SDD quedó en `approved` por deuda administrativa. Ahora el código presente promueve a ✅.)
function statusFor(s) {
  if (s.kind === "brand") return { label: "Marca", cls: "brand" };
  const hasCode = Boolean(s.code && exists(s.code));
  const st = specMeta(s.sdd)?.status || null;
  if (st === "done") return { label: "✅ Construido", cls: "built" };
  if (st === "in-progress") return { label: "🚧 En construcción", cls: "wip" };
  if (st === "approved") {
    return hasCode
      ? { label: "✅ Construido", cls: "built" }
      : { label: "🚧 En construcción", cls: "wip" };
  }
  return hasCode
    ? { label: "✅ Construido", cls: "built" }
    : { label: "📋 Diseño", cls: "design" };
}

const esc = (str) =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
const pctOf = (n, t) => (t ? Math.round((n / t) * 100) : 0);
// tono de un status de spec para el dot de "Movimiento reciente"
const toneOf = (st) =>
  st === "done" || st === "approved" ? "built" : st === "in-progress" ? "wip" : "design";

// --- Conteo global + por grupo, y armado de secciones -------------------------------
let built = 0, wip = 0, design = 0, total = 0;

const sections = GROUPS.map((g) => {
  let gB = 0, gW = 0, gD = 0, gT = 0;
  const cards = g.screens
    .map((s) => {
      const present = screenPresent(s.file);
      const st = statusFor(s);
      if (st.cls === "built") { built++; gB++; }
      else if (st.cls === "wip") { wip++; gW++; }
      else if (st.cls === "design") { design++; gD++; }
      if (st.cls !== "brand") { total++; gT++; }

      const href = encodeURI("./" + s.file);
      const open = present
        ? `<a class="open" href="${href}" target="_blank" rel="noopener">Abrir ↗</a>`
        : `<span class="open missing">⚠ falta el archivo</span>`;

      // línea meta: SDD + ruta de código (dato accionable, recognition over recall)
      let metaHtml = "";
      if (st.cls !== "brand") {
        const bits = [];
        bits.push(s.sdd ? `<span class="sdd">SDD-${esc(s.sdd)}</span>` : `<span class="nospec">sin spec</span>`);
        if (s.code) bits.push(`<code>${esc(s.code)}</code>`);
        metaHtml = `<div class="card-meta">${bits.join(" · ")}</div>`;
      }

      return `      <div class="card ${st.cls}">
        <div class="card-top"><span class="name">${esc(s.name)}</span><span class="badge ${st.cls}">${esc(st.label)}</span></div>
        ${metaHtml}
        ${open}
      </div>`;
    })
    .join("\n");

  // mini-barra de progreso del grupo (solo superficies contables, no "Marca")
  let groupMeta = "";
  if (gT) {
    const b = pctOf(gB, gT), w = pctOf(gW, gT), d = Math.max(0, 100 - b - w);
    groupMeta = `<span class="group-meta">
        <span class="bar mini"><i class="built" style="width:${b}%"></i><i class="wip" style="width:${w}%"></i><i class="design" style="width:${d}%"></i></span>
        <span class="group-count">${gB}/${gT}</span>
      </span>`;
  }

  return `    <section class="group">
      <h2><span class="group-title">${esc(g.title)}</span>${groupMeta}</h2>
      <div class="cards">
${cards}
      </div>
    </section>`;
}).join("\n");

// porcentajes globales (el último absorbe el redondeo para sumar 100 exacto)
const pctBuilt = pctOf(built, total);
const pctWip = pctOf(wip, total);
const pctDesign = total ? Math.max(0, 100 - pctBuilt - pctWip) : 0;

// --- Movimiento reciente: últimas specs tocadas (por `updated`) ----------------------
loadSpecs();
const recent = [...specByNum.entries()]
  .map(([sdd, m]) => ({ sdd, ...m }))
  .filter((r) => r.updated)
  .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
  .slice(0, 5);

const recentRows = recent
  .map(
    (r) => `      <div class="row">
        <span class="date">${esc(r.updated)}</span>
        <span class="rsdd">SDD-${esc(r.sdd)}</span>
        <span class="rtitle">${esc(trunc(r.title || "(sin título)", 34))}</span>
        <i class="dot ${toneOf(r.status)}" title="${esc(r.status || "sin estado")}"></i>
      </div>`
  )
  .join("\n");

const recentBlock = recent.length
  ? `  <aside class="recent">
    <span class="lbl">Movimiento reciente</span>
${recentRows}
  </aside>`
  : "";

// timestamp de generación (hora local del sistema)
const now = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

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
    --on-navy: #A8B0C4; --on-navy-mute: #7E8AA6;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 400 15px/1.5 'Archivo', system-ui, sans-serif; }

  header { background: var(--navy); color: var(--paper); padding: 28px 32px;
    display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start; }
  header .head-main { flex: 1 1 460px; min-width: 0; }
  header .eyebrow { font: 600 12px/1 'Archivo'; letter-spacing: .12em; text-transform: uppercase; color: var(--on-navy); }
  header h1 { font: 900 30px/1.1 'Archivo Black'; margin: 8px 0 6px; }
  header p { margin: 0; color: var(--on-navy); font-size: 14px; max-width: 600px; }

  /* Barra de progreso global */
  .progress-wrap { margin-top: 22px; max-width: 580px; }
  .progress-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
  .progress-pct { font: 900 38px/1 'Archivo Black'; color: var(--paper); }
  .progress-pct span { font: 600 14px/1 'JetBrains Mono'; color: var(--on-navy); margin-left: 9px; }
  .progress-count { font: 600 12px/1 'JetBrains Mono'; color: var(--on-navy); white-space: nowrap; }
  .bar { display: flex; height: 11px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.09); }
  .bar > i { display: block; height: 100%; }
  .bar > i.built { background: var(--built); }
  .bar > i.wip { background: var(--wip); }
  .bar > i.design { background: var(--design); }
  .bar-legend { display: flex; gap: 18px; margin-top: 11px; font: 600 12px/1 'JetBrains Mono'; color: var(--on-navy); }
  .bar-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .meta-src { margin-top: 16px; font: 500 11px/1 'JetBrains Mono'; color: var(--on-navy-mute); }

  /* Movimiento reciente */
  header .recent { flex: 0 1 320px; min-width: 240px; }
  header .recent .lbl { display: block; font: 600 11px/1 'Archivo'; letter-spacing: .12em; text-transform: uppercase; color: var(--on-navy-mute); margin-bottom: 12px; }
  header .recent .row { display: grid; grid-template-columns: 78px 1fr 14px; gap: 10px; align-items: center;
    font: 500 12px/1.5 'JetBrains Mono'; color: var(--on-navy); padding: 3px 0; }
  header .recent .date { color: var(--on-navy-mute); }
  header .recent .rsdd { color: var(--paper); font-weight: 600; }
  header .recent .rtitle { color: var(--on-navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Archivo'; }
  header .recent .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
  header .recent .dot.built { background: var(--built); }
  header .recent .dot.wip { background: var(--wip); }
  header .recent .dot.design { background: var(--on-navy-mute); }

  main { max-width: 1100px; margin: 0 auto; padding: 28px 32px 64px; }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; font-size: 13px; color: var(--ink-soft); }
  .legend .badge { margin-right: 6px; }

  .group { margin-bottom: 32px; }
  .group h2 { font: 800 16px/1.2 'Archivo'; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .group-title { flex: 1 1 auto; }
  .group-meta { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
  .bar.mini { width: 120px; height: 6px; }
  .group-count { font: 600 12px/1 'JetBrains Mono'; color: var(--ink-mute); }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px;
    transition: border-color .12s ease, box-shadow .12s ease; }
  .card:hover { border-color: var(--ink-mute); box-shadow: 0 1px 3px rgba(15,30,61,.06); }
  .card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
  .card .name { font-weight: 600; font-size: 14px; }
  .card-meta { font: 500 11px/1.4 'JetBrains Mono'; color: var(--ink-mute); margin-bottom: 10px; word-break: break-all; }
  .card-meta .sdd { color: var(--wine); }
  .card-meta code { color: var(--ink-soft); }
  .card-meta .nospec { font-style: italic; }

  .badge { font: 600 11px/1 'Archivo'; padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
  .badge.built { background: rgba(31,138,91,.12); color: var(--built); }
  .badge.wip { background: rgba(184,137,58,.14); color: var(--wip); }
  .badge.design { background: rgba(107,107,107,.12); color: var(--design); }
  .badge.brand { background: rgba(127,15,26,.10); color: var(--wine); }
  .open { display: inline-block; font: 600 13px/1 'Archivo'; color: var(--wine); text-decoration: none; }
  .open:hover { text-decoration: underline; }
  .open.missing { color: var(--wine); font-style: italic; }
  /* card con archivo faltante = anomalía de integridad: que salte */
  .card.built:has(.open.missing), .card.wip:has(.open.missing), .card.design:has(.open.missing) { border-color: var(--wine); }

  footer { max-width: 1100px; margin: 0 auto; padding: 0 32px 48px; color: var(--ink-mute); font-size: 12px; }
</style>
</head>
<body>
<header>
  <div class="head-main">
    <div class="eyebrow">DTD Studio · Norte visual</div>
    <h1>A dónde vamos — y dónde estamos</h1>
    <p>Mapa de las pantallas-meta del proyecto. Cada tarjeta abre el mockup navegable; el badge dice en qué punto está cada módulo en la app real.</p>
    <div class="progress-wrap">
      <div class="progress-head">
        <div class="progress-pct">${pctBuilt}%<span>construido</span></div>
        <div class="progress-count">${built}/${total} módulos</div>
      </div>
      <div class="bar">
        <i class="built" style="width:${pctBuilt}%"></i>
        <i class="wip" style="width:${pctWip}%"></i>
        <i class="design" style="width:${pctDesign}%"></i>
      </div>
      <div class="bar-legend">
        <span><i style="background:var(--built)"></i>${built} listas</span>
        <span><i style="background:var(--wip)"></i>${wip} en obra</span>
        <span><i style="background:var(--design)"></i>${design} en diseño</span>
      </div>
      <div class="meta-src">${NORTE_VERSION} · generado por scripts/norte.mjs · ${stamp}</div>
    </div>
  </div>
${recentBlock}
</header>
<main>
  <div class="legend">
    <span><span class="badge built">✅ Construido</span> SDD cerrado o aprobado con código</span>
    <span><span class="badge wip">🚧 En construcción</span> SDD en progreso o aprobado sin código aún</span>
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
console.log(`[norte] ${pctBuilt}% construido · ${built} listas · ${wip} en obra · ${design} en diseño (${total} módulos)`);
console.log(`[norte] movimiento reciente: ${recent.length} specs con fecha`);
console.log(`[norte] servir:  npx --yes serve "${NORTE_REL}" -l 3010`);
console.log(`[norte] abrir:   http://localhost:3010/_norte.html`);
