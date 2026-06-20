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
const NORTE_VERSION = "v4.4"; // handoff Cloud Design (carga 2026-06-19 v4.4: recursos gráficos chinos recoloreados a la paleta [recursos-graficos/: meandro/olas/nube/marco/esquina + festivos linterna 灯笼/nudo 中国结 con BRAND-EXCEPTION del dorado + dragón duotono wine/navy], plantillas sociales Stories/feed integradas al Generador de Redes [+ Plantillas base sin texto], Packing List + Factura renovado [bilingüe 中/EN, caja mixta 同箱, N.º de caja automático, etiquetas Shipping Mark por cartón, adjuntos plegables, autoguardado/historial, vista móvil]; sin cambios de tokens/reglas · carga 2026-06-17 v4.3: Academia DTD vista alumno [portal/academia*.jsx; backend ya en SDD-0093 + migr 0144], Portal "Próxima salida de contenedor" + panel de Tweaks, Registro reestructurado [acceso por correo+contraseña, cédula V/E/P, teléfono con selector de código de país], Hub de Enlaces link-in-bio [/enlaces], Vistas Móviles visor por persona; sin cambios de tokens/reglas · carga 2026-06-14 v4.2: versión UNIFICADA marca+producto = v4.2; Brand Book v3.7 → v4.2 ÚNICO; estructura Brand Hub [solo marca] vs DTD Apps · Launcher [solo producto]; nuevos: Inventario de Consolidación [WMS], Reclamos y Siniestros, Academia [LMS], Scorecard de Proveedores, Dashboard Ejecutivo, Kit de Bienvenida, Reels y Logo Sonoro, Packlist, Cotización DDP, Diplomas, Ciclo del Cliente; MARKBOX fuera del lenguaje visual [Shipping Mark único])

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
    // v2.4: Cloud Design consolidó despacho a una sola vista (removió Vista 1/2 y "Admin · Rutas").
    screens: [
      { name: "Despacho · Vista 3", file: "Despacho · Vista 3.html", code: "app/studio/(app)/despacho", sdd: "0029" },
    ],
  },
  {
    title: "Portal del Cliente",
    // v1.9.1: Cloud Design unificó el portal en origen → un solo archivo con NOMBRE BASE
    // ("Portal del Cliente.html" / "Registro Cliente.html") con el contenido bueno (ex-V2).
    // Ya no hay duplicado "· V2" ni carpeta _legacy (limpiado en la carga v1.9.1, 2026-05-31).
    screens: [
      { name: "Portal del Cliente", file: "Portal del Cliente.html", code: null, sdd: null },
      // Carga 2026-06-10: Cloud Design archivó la pantalla standalone (el overlay vive dentro del ERP).
      { name: "Modo Cliente (impersonación admin)", file: "_archivo/Modo Cliente.html", code: null, sdd: null },
      { name: "Registro de cliente", file: "Registro Cliente.html", code: "app/invitar", sdd: "0024" },
    ],
  },
  {
    title: "Móvil · Operarios",
    screens: [
      { name: "Mobile ERP", file: "Mobile ERP.html", code: "app/m/erp", sdd: null },
      { name: "Operario CN", file: "Operario CN.html", code: "app/m/cn", sdd: "0016" },
      { name: "Operario VE", file: "Operario VE.html", code: "app/m/ve", sdd: "0017" },
      { name: "Operario · App (multi-rol)", file: "Operario · App.html", code: "app/m", sdd: "0030" },
      { name: "Login y Sesión · Operario", file: "Login y Sesión · Operario.html", code: "app/m", sdd: "0030" },
      { name: "Bodeguero VE", file: "Bodeguero VE.html", code: "app/m/ve/bodeguero", sdd: "0030" },
      { name: "Camionero", file: "Camionero.html", code: "app/m/ve/camionero", sdd: "0030" },
    ],
  },
  {
    title: "Perfiles individuales",
    screens: [
      { name: "Perfil · Usuario interno", file: "pantallas/usuario-perfil.html", code: null, sdd: null },
      { name: "Perfil · Agente aduanal", file: "pantallas/agente-perfil.html", code: null, sdd: null },
      { name: "Perfil · Camión", file: "pantallas/camion-perfil.html", code: null, sdd: null },
      { name: "Perfil · Chofer", file: "pantallas/chofer-perfil.html", code: null, sdd: null },
      { name: "Estado de cuenta", file: "pantallas/estado-cuenta.html", code: null, sdd: null },
    ],
  },
  {
    title: "Cross-módulo & productividad (v1.9)",
    screens: [
      { name: "Tu día (bandeja personal)", file: "pantallas/tu-dia.html", code: null, sdd: null },
      { name: "AI Copilot (chat sobre datos)", file: "pantallas/copilot.html", code: null, sdd: null },
      { name: "Hilo de comentario expandido", file: "pantallas/hilo-comentario.html", code: null, sdd: null },
    ],
  },
  {
    // Módulos del ERP que llegaron en v1.9.1: no son pantallas .html standalone (viven dentro
    // de "DTD Studio · ERP.html"), por eso `inErp: true` → la card abre el ERP. Sin código en el
    // repo todavía (mockup), así que cuentan como 📋 Diseño. Mapear `code`/`sdd` cuando se construyan.
    title: "ERP · Módulos nuevos (v1.9.1 · finanzas / fiscal / CRM)",
    screens: [
      { name: "Cobranzas (CxC vencidas)", file: null, code: null, sdd: null, inErp: true },
      { name: "Tesorería (pagos a proveedores CN)", file: null, code: null, sdd: null, inErp: true },
      { name: "Fiscal · SENIAT (IVA / retenciones)", file: null, code: null, sdd: null, inErp: true },
      { name: "Naviera & Consolidación", file: null, code: null, sdd: null, inErp: true },
      { name: "Conversaciones (bandeja unificada)", file: null, code: null, sdd: null, inErp: true },
      { name: "Fidelización & Referidos", file: null, code: null, sdd: null, inErp: true },
      { name: "Documentos · Hub central", file: null, code: null, sdd: null, inErp: true },
      { name: "Dirección · Tablero ejecutivo", file: null, code: null, sdd: null, inErp: true },
      { name: "Flujo de trabajo (workflow view)", file: null, code: null, sdd: null, inErp: true },
      { name: "Legal · T&C / Acuerdos (admin-legal · v2.4c)", file: null, code: null, sdd: null, inErp: true },
    ],
  },
  {
    // v2.3: pantallas nuevas de Cloud Design (mapa de proceso navegable, propuestas de features,
    // portal del cliente mobile). `ref:true` → se listan y se abren como referencia de diseño, pero
    // NO diluyen el % construido (mismo criterio "no contar mockups" del grupo de módulos nuevos).
    // Mapear `code`/`sdd` cuando se construyan (varias apuntan a entidades faltantes: órdenes,
    // proveedores, caja — ver docs/architecture/schema-reconciliation.md).
    // v2.4b consolidó: removió su índice propio (Nort v2.4.html) y archivó "Propuesta · Botón Crear" → _archivo/.
    title: "Nuevo en v2.3-v2.4c · proceso · propuestas · legal",
    screens: [
      { name: "Mapa de Proceso", file: "Mapa de Proceso.html", ref: true },
      { name: "Guía del Mapa de Proceso", file: "Guía del Mapa de Proceso.html", ref: true },
      { name: "Portal Cliente · Mobile", file: "Portal Cliente Mobile.html", ref: true },
      { name: "Propuesta · Servicios y Tarifas", file: "Propuesta · Servicios y Tarifas.html", ref: true },
      { name: "Aceptación T&C · Cotización", file: "_archivo/Aceptación T&C · Cotización.html", ref: true },
      { name: "App Icon · DTD Cargo", file: "App Icon · DTD Cargo.html", ref: true },
    ],
  },
  {
    // v2.5: piezas nuevas de Cloud Design — operativas (app del empleado/nómina, calculadora CBM,
    // etiqueta ZPL de bodega, comprobante WhatsApp, reporte) + colateral de marketing/redes.
    // ref:true → se listan y abren como referencia de diseño, NO diluyen el % construido.
    title: "Nuevo en v2.5 · operativo · nómina · colateral",
    screens: [
      { name: "App del Empleado (nómina)", file: "App del Empleado.html", ref: true },
      { name: "Calculadora CBM", file: "Calculadora CBM · DTD-Cargo.html", ref: true },
      { name: "Etiqueta Bodega · ZPL", file: "Etiqueta Bodega ZPL · DTD-Cargo.html", ref: true },
      { name: "Comprobante WhatsApp", file: "Comprobante WhatsApp · DTD-Cargo.html", ref: true },
      { name: "Reporte operativo", file: "_archivo/Reporte DTD-Cargo.html", ref: true },
      { name: "Portada Animada FB", file: "Portada Animada FB · DTD-Cargo.html", ref: true },
      { name: "Portadas Redes", file: "Portadas Redes · DTD-Cargo.html", ref: true },
      { name: "Póster Reseñas", file: "Póster Reseñas · DTD-Cargo.html", ref: true },
      { name: "Sticker Pack", file: "Sticker Pack · DTD-Cargo.html", ref: true },
    ],
  },
  {
    // v2.5: control de calidad en China antes de embarcar (inspección de fábrica / producto /
    // producto·baterías) + sus plantillas + el reporte consolidado. Mockups sin código/SDD aún
    // → ref:true (se listan y abren como referencia de diseño, NO diluyen el % construido).
    title: "Inspección de calidad · China (v2.5)",
    screens: [
      { name: "Inspección de Fábrica", file: "Inspección de Fábrica · DTD.html", ref: true },
      { name: "Inspección de Producto", file: "Inspección de Producto · DTD.html", ref: true },
      { name: "Inspección de Producto · Baterías", file: "Inspección de Producto · Baterías · DTD.html", ref: true },
      { name: "Reportes de Inspección", file: "Reportes de Inspección · DTD.html", ref: true },
      { name: "Plantilla · Inspección de Fábrica", file: "Plantilla · Inspección de Fábrica.html", ref: true },
      { name: "Plantilla · Inspección de Producto", file: "Plantilla · Inspección de Producto.html", ref: true },
    ],
  },
  {
    title: "Marca",
    screens: [
      // Carga 2026-06-19: Brand Book v4.4 es el ÚNICO vigente (v4.3 eliminado por regla de gobernanza).
      { name: "Brand Hub (índice de marca)", file: "Brand Hub · DTD-Cargo.html", kind: "brand" },
      { name: "Brand Book v4.4", file: "Brand Book DTD v4.4.html", kind: "brand" },
      { name: "Tarjeta de Presentación", file: "Tarjeta de Presentación.html", kind: "brand" },
      { name: "Logo Oficial", file: "Logo Oficial.html", kind: "brand" },
      { name: "Iconos de Perfil", file: "Iconos de Perfil.html", kind: "brand" },
      { name: "Aplicaciones de Marca", file: "Aplicaciones de Marca.html", kind: "brand" },
      { name: "Sticker Pack (17)", file: "Sticker Pack · DTD-Cargo.html", kind: "brand" },
      { name: "Banco de Fotos", file: "Banco de Fotos · DTD-Cargo.html", kind: "brand" },
      { name: "Colateral Impreso", file: "Colateral Impreso · DTD-Cargo.html", kind: "brand" },
    ],
  },
  {
    // Carga 2026-06-10: colateral de marketing nuevo de Cloud Design. ref:true → referencia
    // de diseño, NO diluye el % construido (mismo criterio que las cargas v2.3-v2.5).
    title: "Nuevo en carga 2026-06-10 · marketing · colateral",
    screens: [
      { name: "Generador Redes", file: "Generador Redes · DTD-Cargo.html", ref: true },
      { name: "Generador Catálogo WhatsApp", file: "Generador Catálogo WhatsApp · DTD-Cargo.html", ref: true },
      { name: "Uniformes", file: "Uniformes · DTD-Cargo.html", ref: true },
      { name: "WeChat · Perfil", file: "WeChat · Perfil DTD-Cargo.html", ref: true },
    ],
  },
  {
    // Carga 2026-06-14 (v4.2): nuevos módulos de producto (WMS, reclamos, academia, scorecard,
    // tablero ejecutivo) + hubs de navegación (DTD Apps · Launcher solo-producto; el Brand Hub
    // solo-marca vive en el grupo "Marca") + colateral de marca (kit de bienvenida, reels, packlist,
    // cotización DDP, diplomas, ciclo del cliente). Mockups sin código/SDD aún → ref:true
    // (referencia de diseño, NO diluye el % construido; mapear code/sdd cuando se construyan).
    title: "Nuevo en v4.2 (2026-06-14) · producto · hubs · colateral",
    screens: [
      { name: "DTD Apps · Launcher (índice de producto)", file: "DTD Apps · Launcher.html", ref: true },
      { name: "Inventario de Consolidación (WMS)", file: "Inventario de Consolidación · DTD-Cargo.html", ref: true },
      { name: "Reclamos y Siniestros", file: "Reclamos y Siniestros · DTD-Cargo.html", ref: true },
      { name: "Academia DTD (LMS)", file: "academia/Academia DTD · Módulo.html", ref: true },
      { name: "Scorecard de Proveedores", file: "proveedores/Scorecard de Proveedores · DTD-Cargo.html", ref: true },
      { name: "Dashboard Ejecutivo (Dirección)", file: "direccion/Dashboard Ejecutivo · DTD-Cargo.html", ref: true },
      { name: "Kit de Bienvenida", file: "Kit de Bienvenida · DTD-Cargo.html", ref: true },
      { name: "Reels y Logo Sonoro", file: "Reels y Logo Sonoro · DTD-Cargo.html", ref: true },
      { name: "Packing List + Factura", file: "packlist/Packing List + Factura · DTD-Cargo.html", ref: true },
      { name: "Cotización DDP", file: "cotizacion/Cotización DDP · DTD-Cargo.html", ref: true },
      { name: "Diploma (Academia)", file: "diplomas/Diploma · DTD-Cargo.html", ref: true },
      { name: "Ciclo del Cliente (hero web)", file: "ciclo/Ciclo del Cliente · DTD-Cargo.html", ref: true },
    ],
  },
  {
    // Carga 2026-06-17 (v4.3): vista del alumno de Academia DTD (7 pantallas mobile-first en
    // portal/academia*.jsx; el backend ya vive en SDD-0093 + migr 0144 → falta el portal UI
    // app/portal/(app)/academia/), hub de enlaces link-in-bio para Instagram (/enlaces), visor
    // de Vistas Móviles por persona, y el Cotizador de Fletes. Mockups de diseño → ref:true
    // (no diluyen el % construido). El delta de Portal (tarjeta "Próxima salida" + panel de
    // Tweaks) y Registro (correo+contraseña, cédula V/E/P, teléfono con selector de país) editó
    // pantallas ya listadas (Portal del Cliente / Registro Cliente) — detalle en NORTE-CHANGELOG.
    title: "Nuevo en v4.3 (2026-06-17) · Academia alumno · enlaces · vistas móviles",
    screens: [
      { name: "Academia DTD · Alumno (portal)", file: "Portal Academia · Alumno.html", ref: true },
      { name: "Vistas Móviles (visor por persona)", file: "Vistas Móviles · DTD-Cargo.html", ref: true },
      { name: "Enlaces (link-in-bio Instagram)", file: "Enlaces · DTD-Cargo.html", ref: true },
      { name: "Cotizador de Fletes", file: "Cotizador de Fletes · DTD-Cargo.html", ref: true },
    ],
  },
  {
    // Carga 2026-06-19 (v4.4): recursos gráficos chinos recoloreados a la paleta (Brand Book §07:
    // greca/olas/nube/marco/esquina + festivos linterna/nudo con BRAND-EXCEPTION del dorado +
    // dragón duotono) — son assets SVG/PNG del book, no pantallas. Lo navegable nuevo: plantillas
    // sociales Stories/feed (integradas al Generador de Redes) y la vista móvil del Packing List
    // renovado (bilingüe 中/EN, caja mixta, N.º de caja automático). Mockups → ref:true.
    title: "Nuevo en v4.4 (2026-06-19) · recursos gráficos chinos · plantillas sociales · packing list",
    screens: [
      { name: "Plantillas Stories (social 9:16 / 1:1)", file: "Plantillas Stories · DTD-Cargo.html", ref: true },
      { name: "Plantillas base (sin texto)", file: "Plantillas base (sin texto) · DTD-Cargo.html", ref: true },
      { name: "Packing List · Vista Móvil", file: "packlist/Vista Móvil · Packing List.html", ref: true },
    ],
  },
];

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const screenPresent = (file) => Boolean(file) && fs.existsSync(path.join(NORTE_DIR, file));

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
  let gB = 0, gW = 0, gT = 0, gErp = 0;
  const cards = g.screens
    .map((s) => {
      const present = screenPresent(s.file);
      const st = statusFor(s);
      if (s.inErp || s.ref) {
        gErp++; // módulo/pantalla de referencia o backlog: se lista pero NO cuenta en el progreso (%)
      } else {
        if (st.cls === "built") { built++; gB++; }
        else if (st.cls === "wip") { wip++; gW++; }
        else if (st.cls === "design") { design++; }
        if (st.cls !== "brand") { total++; gT++; }
      }

      let open;
      if (s.inErp) {
        // módulo que vive DENTRO del ERP (no tiene .html standalone): abre el ERP completo
        open = `<a class="open" href="${encodeURI("./DTD Studio · ERP.html")}" target="_blank" rel="noopener">Ver en ERP ↗</a>`;
      } else if (present) {
        open = `<a class="open" href="${encodeURI("./" + s.file)}" target="_blank" rel="noopener">Abrir ↗</a>`;
      } else {
        open = `<span class="open missing">⚠ falta el archivo</span>`;
      }

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
  } else if (gErp) {
    // grupo de módulos del ERP: referencia/backlog, no entra en el porcentaje
    groupMeta = `<span class="group-meta"><span class="group-count">${gErp} módulos · fuera del %</span></span>`;
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

// `now` se usa acá (fechas relativas) y abajo (timestamp de generación).
const now = new Date();
const relDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return esc(iso || "");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - d) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 28) return `hace ${Math.floor(days / 7)} sem`;
  return iso.slice(5); // MM-DD para lo más viejo
};

const recent = [...specByNum.entries()]
  .map(([sdd, m]) => ({ sdd, ...m }))
  .filter((r) => r.updated)
  .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
  .slice(0, 10);

const recentRows = recent
  .map(
    (r) => `        <div class="row" title="${esc(`SDD-${r.sdd} · ${r.title || "(sin título)"} · ${r.status || "sin estado"} · ${r.updated}`)}">
          <i class="dot ${toneOf(r.status)}"></i>
          <span class="rsdd">SDD-${esc(r.sdd)}</span>
          <span class="rtitle">${esc(trunc(r.title || "(sin título)", 40))}</span>
          <span class="rdate">${esc(relDate(r.updated))}</span>
        </div>`
  )
  .join("\n");

const recentBlock = recent.length
  ? `  <aside class="recent">
    <div class="recent-head">
      <span class="lbl">Movimiento reciente</span>
      <span class="recent-count">${recent.length}</span>
    </div>
    <div class="feed">
${recentRows}
    </div>
  </aside>`
  : "";

// timestamp de generación (hora local del sistema) — `now` ya está definido arriba.
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
const wipDim = wip === 0 ? ' style="opacity:.55"' : ""; // atenúa el ítem "en obra" de la leyenda si no hay nada en obra

// --- Vista "Datos": reconciliación de entidades (parseada de schema-reconciliation.md) ----
// Fuente única de verdad = docs/architecture/schema-reconciliation.md (artefacto verificado).
// No recomputamos acá; solo parseamos sus tablas. Si el archivo no existe → empty state.
function loadReconciliation() {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, "docs/architecture/schema-reconciliation.md"), "utf8");
  } catch {
    return { found: false };
  }
  const EMO = { "✅": "built", "🟡": "partial", "❌": "missing" };
  const entities = [], blocks = [];
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const h = raw.match(/^##\s+(.*)/);
    if (h) { section = h[1].toLowerCase(); continue; }
    if (!raw.trimStart().startsWith("|")) continue;
    const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0])) continue; // fila vacía o separador
    if (section.includes("por entidad") && EMO[cells[1]]) {
      entities.push({ cls: EMO[cells[1]], emoji: cells[1], name: cells[0], tables: cells[2], note: cells[3] });
    } else if (section.includes("bloques") && /^\*\*/.test(cells[0])) {
      blocks.push({ block: cells[0].replace(/\*\*/g, ""), name: cells[1], spec: cells[2], estado: cells[3].replace(/\*\*/g, "") });
    }
  }
  const n = (x) => entities.filter((e) => e.cls === x).length;
  return { found: true, entities, blocks, counts: { built: n("built"), partial: n("partial"), missing: n("missing"), total: entities.length } };
}

const recon = loadReconciliation();
const dataHeaderKpi = recon.found
  ? `${recon.counts.built}/${recon.counts.total} entidades con tabla real`
  : "reconciliación ausente";

const DATA_GROUPS = [
  { cls: "built", label: "✅ Construido", hint: "tabla real fiel" },
  { cls: "partial", label: "🟡 Parcial", hint: "existe pero fragmentado/incompleto" },
  { cls: "missing", label: "❌ Falta", hint: "sin tabla" },
];

let dataView;
if (!recon.found) {
  dataView = `  <div class="empty-data">No se encontró <code>docs/architecture/schema-reconciliation.md</code>. Generá la reconciliación (corré <code>/radar</code> o el reconciliador de esquema) y regenerá el Norte con <code>node scripts/norte.mjs</code>.</div>`;
} else {
  const dc = recon.counts;
  const dB = pctOf(dc.built, dc.total), dP = pctOf(dc.partial, dc.total);
  const dM = dc.total ? Math.max(0, 100 - dB - dP) : 0;

  const dataSections = DATA_GROUPS.map((g) => {
    const items = recon.entities.filter((e) => e.cls === g.cls);
    if (!items.length) return "";
    const cards = items
      .map((e) => `      <div class="card ${e.cls}">
        <div class="card-top"><span class="name">${esc(e.name)}</span><span class="badge ${e.cls}">${esc(e.emoji)}</span></div>
        <div class="card-meta">${e.tables && e.tables !== "—" ? esc(e.tables) : '<span class="nospec">sin tabla</span>'}</div>
        <div class="card-note">${esc(trunc(e.note, 170))}</div>
      </div>`)
      .join("\n");
    return `    <section class="group">
      <h2><span class="group-title">${esc(g.label)} <span style="color:var(--ink-mute);font-weight:500">· ${esc(g.hint)}</span></span><span class="group-meta"><span class="group-count">${items.length}</span></span></h2>
      <div class="cards">
${cards}
      </div>
    </section>`;
  }).join("\n");

  const blocksTable = recon.blocks.length
    ? `    <section class="group">
      <h2><span class="group-title">Roadmap de Bloques financieros</span></h2>
      <table class="blocks">
        <thead><tr><th>Bloque</th><th>Nombre</th><th>Spec</th><th>Estado</th></tr></thead>
        <tbody>
${recon.blocks.map((b) => `          <tr><td class="bk">${esc(b.block)}</td><td>${esc(b.name)}</td><td class="sp">${esc(b.spec)}</td><td>${esc(b.estado)}</td></tr>`).join("\n")}
        </tbody>
      </table>
    </section>`
    : "";

  dataView = `  <div class="progress-wrap data-head">
    <div class="progress-head">
      <div class="progress-pct">${dB}%<span>de entidades con tabla real</span></div>
      <div class="progress-count">${dc.built}/${dc.total} entidades</div>
    </div>
    <div class="bar">
      <i class="built" style="width:${dB}%"></i>
      <i class="wip" style="width:${dP}%"></i>
      <i class="missing" style="width:${dM}%"></i>
    </div>
    <div class="bar-legend">
      <span><i style="background:var(--built)"></i>${dc.built} con tabla</span>
      <span><i style="background:var(--wip)"></i>${dc.partial} parcial</span>
      <span><i style="background:var(--danger)"></i>${dc.missing} falta</span>
    </div>
    <div class="meta-src">fuente: docs/architecture/schema-reconciliation.md · blueprint del Norte ↔ tablas Supabase reales</div>
  </div>
${dataSections}
${blocksTable}`;
}

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
    color-scheme: light;
    --wine: #7F0F1A; --navy: #0F1E3D; --paper: #FBFAF7; --page: #FBFAF7; --surface: #FFFFFF;
    --ink: #0F1E3D; --ink-soft: #6B6B6B; --ink-mute: #9B9B9B; --border: #E8E6E2;
    --built: #1F8A5B; --wip: #B8893A; --design: #6B6B6B; --hover: #F2F0EC;
    --danger: #A8323E;
    --on-navy: #B9C0D2; --on-navy-mute: #8E99B4;
  }
  /* Tema oscuro: el header sigue navy (ya era oscuro); flipea cuerpo + cards + texto.
     --paper queda claro a propósito (es el TEXTO del header sobre navy); el fondo de
     página usa --page. Paleta alineada al dark theme del Norte (_norte/CLAUDE.md). */
  :root[data-theme="dark"] {
    color-scheme: dark;
    --page: #0B1428; --surface: #16264A;
    --ink: #F2F0EC; --ink-soft: #A8B0C4; --ink-mute: #7E89A4; --border: #2A3A5C;
    --built: #3FB984; --wip: #D4A85A; --design: #9BA6BE; --hover: #1F3055; --wine: #D89AA4; --danger: #D9606C;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink);
    font: 400 15px/1.5 'Archivo', system-ui, sans-serif; }

  header { position: relative; background: var(--navy); color: var(--paper); padding: 28px 32px;
    display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start; }
  .theme-toggle { position: absolute; top: 20px; right: 24px; appearance: none; cursor: pointer;
    background: rgba(255,255,255,.08); color: var(--on-navy); border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px; padding: 6px 14px; font: 600 12px/1 'Archivo'; transition: background .12s ease; }
  .theme-toggle:hover { background: rgba(255,255,255,.16); color: var(--paper); }
  header .head-main { flex: 1 1 460px; min-width: 0; }
  header .eyebrow { font: 600 12px/1 'Archivo'; letter-spacing: .12em; text-transform: uppercase; color: var(--on-navy); }
  header h1 { font: 900 30px/1.1 'Archivo Black'; margin: 8px 0 6px; }
  header p { margin: 0; color: var(--on-navy); font-size: 14px; max-width: 600px; }

  /* Barra de progreso global */
  .progress-wrap { margin-top: 24px; max-width: 580px; }
  .progress-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .progress-pct { font: 900 38px/1 'Archivo Black'; color: var(--paper); }
  .progress-pct span { font: 600 14px/1 'JetBrains Mono'; color: var(--on-navy); margin-left: 8px; }
  .progress-count { font: 600 12px/1 'JetBrains Mono'; color: var(--on-navy); white-space: nowrap; }
  .bar { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.09); }
  .bar > i { display: block; height: 100%; }
  .bar > i.built { background: var(--built); }
  .bar > i.wip { background: var(--wip); }
  .bar > i.design { background: var(--design); }
  .bar-legend { display: flex; gap: 16px; margin-top: 12px; font: 600 12px/1 'JetBrains Mono'; color: var(--on-navy); }
  .bar-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .meta-src { margin-top: 16px; font: 500 11px/1 'JetBrains Mono'; color: var(--on-navy-mute); }

  /* Movimiento reciente */
  header .recent { flex: 0 1 360px; min-width: 260px;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px; padding: 14px 8px 10px 16px; }
  header .recent .recent-head { display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding-right: 8px; margin-bottom: 8px; }
  header .recent .lbl { font: 600 11px/1 'Archivo'; letter-spacing: .12em; text-transform: uppercase; color: var(--on-navy-mute); }
  header .recent .recent-count { font: 700 10px/1 'JetBrains Mono'; color: var(--on-navy-mute);
    background: rgba(255,255,255,.07); border-radius: 999px; padding: 3px 7px; }
  header .recent .feed { max-height: 168px; overflow-y: auto; padding-right: 6px; }
  header .recent .feed::-webkit-scrollbar { width: 6px; }
  header .recent .feed::-webkit-scrollbar-track { background: transparent; }
  header .recent .feed::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 999px; }
  header .recent .feed::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.28); }
  header .recent .row { display: grid; grid-template-columns: 12px 64px 1fr auto; gap: 8px; align-items: center;
    padding: 6px 6px; border-radius: 7px; transition: background .12s ease; cursor: default; }
  header .recent .row:hover { background: rgba(255,255,255,.06); }
  header .recent .row + .row { margin-top: 1px; }
  header .recent .dot { width: 7px; height: 7px; border-radius: 999px; display: inline-block; }
  header .recent .dot.built { background: var(--built); }
  header .recent .dot.wip { background: var(--wip); }
  header .recent .dot.design { background: var(--on-navy-mute); }
  header .recent .rsdd { font: 600 11px/1.4 'JetBrains Mono'; color: var(--paper); }
  header .recent .rtitle { font: 500 12px/1.4 'Archivo'; color: var(--on-navy);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header .recent .rdate { font: 500 10.5px/1.4 'JetBrains Mono'; color: var(--on-navy-mute); text-align: right; white-space: nowrap; }

  main { max-width: 1100px; margin: 0 auto; padding: 28px 32px 64px; }
  .legend { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 24px; font-size: 13px; color: var(--ink-soft); }
  .legend .badge { margin-right: 6px; }
  .legend-hint { font: 600 11px/1 'Archivo'; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-mute); }
  .legend-item { appearance: none; background: none; border: 0; margin: 0; padding: 4px 8px; border-radius: 6px;
    font: inherit; color: inherit; text-align: left; cursor: pointer; transition: opacity .12s ease, background .12s ease; }
  .legend-item:hover { background: var(--hover); }
  .legend-item.off { opacity: .38; }
  .legend-item.off .badge { filter: grayscale(.55); }

  .group { margin-bottom: 32px; }
  .group h2 { font: 800 16px/1.2 'Archivo'; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .group-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .group-meta { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
  .bar.mini { width: 120px; height: 6px; }
  .group-count { font: 600 12px/1 'JetBrains Mono'; color: var(--ink-mute); }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px;
    transition: border-color .12s ease, box-shadow .12s ease; }
  .card:hover { border-color: var(--ink-mute); box-shadow: 0 1px 3px rgba(15,30,61,.06); }
  .card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
  .card .name { font-weight: 600; font-size: 14px; }
  .card-meta { font: 500 11px/1.4 'JetBrains Mono'; color: var(--ink-mute); margin-bottom: 10px; overflow-wrap: anywhere; word-break: normal; }
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

  /* Tabs (switch de vistas) — viven en el header navy */
  .tabs { display: flex; gap: 8px; margin: 18px 0 4px; }
  .tab { appearance: none; cursor: pointer; background: rgba(255,255,255,.06); color: var(--on-navy);
    border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 8px 18px;
    font: 700 13px/1 'Archivo'; transition: background .12s ease, color .12s ease; }
  .tab:hover { background: rgba(255,255,255,.14); color: var(--paper); }
  .tab.active { background: var(--paper); color: var(--navy); border-color: var(--paper); }

  /* Vistas conmutables */
  .view { display: none; }
  .view.active { display: block; }

  /* Vista Datos: cabecera de progreso sobre fondo claro (no navy) */
  #view-datos .data-head { max-width: 580px; margin: 0 0 28px; }
  #view-datos .progress-pct { color: var(--ink); }
  #view-datos .progress-pct span { color: var(--ink-mute); margin-left: 8px; font: 600 13px/1 'JetBrains Mono'; }
  #view-datos .progress-count { color: var(--ink-mute); }
  #view-datos .bar { background: var(--border); }
  #view-datos .bar-legend { color: var(--ink-soft); }
  #view-datos .meta-src { color: var(--ink-mute); }
  .card-note { font: 500 12px/1.45 'Archivo'; color: var(--ink-soft); }

  /* Estado "falta" (❌) — reusa la mecánica de badge/bar */
  .bar > i.missing { background: var(--danger); }
  .badge.missing { background: rgba(168,50,62,.12); color: var(--danger); }
  .card.missing:hover { border-color: var(--danger); }

  /* Tabla de Bloques financieros */
  table.blocks { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  table.blocks th { text-align: left; font: 700 11px/1 'Archivo'; text-transform: uppercase; letter-spacing: .08em;
    color: var(--ink-mute); padding: 8px 10px; border-bottom: 1px solid var(--border); }
  table.blocks td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; color: var(--ink-soft); }
  table.blocks td.bk { font: 700 12px/1.3 'JetBrains Mono'; color: var(--wine); white-space: nowrap; }
  table.blocks td.sp { font: 600 12px/1.3 'JetBrains Mono'; color: var(--ink-soft); white-space: nowrap; }

  .empty-data { padding: 22px 24px; border: 1px dashed var(--border); border-radius: 10px; color: var(--ink-soft); }
  .empty-data code { color: var(--wine); }
</style>
<script>
  // Tema inicial antes de pintar (evita flash): localStorage → preferencia del sistema.
  (function () {
    try {
      var t = localStorage.getItem('norte-theme');
      if (t !== 'dark' && t !== 'light') {
        t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  })();
</script>
</head>
<body>
<header>
  <button type="button" class="theme-toggle" aria-label="Cambiar tema claro/oscuro">Modo oscuro</button>
  <div class="head-main">
    <div class="eyebrow">DTD Studio · Norte visual</div>
    <h1>A dónde vamos — y dónde estamos</h1>
    <p>Mapa de las pantallas-meta del proyecto. Cada tarjeta abre el mockup navegable; el badge dice en qué punto está cada módulo en la app real.</p>
    <div class="tabs" role="tablist">
      <button type="button" class="tab active" data-view="pantallas">🖥 Pantallas</button>
      <button type="button" class="tab" data-view="datos">🗄 Datos</button>
    </div>
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
        <span${wipDim}><i style="background:var(--wip)"></i>${wip} en obra</span>
        <span><i style="background:var(--design)"></i>${design} en diseño</span>
      </div>
      <div class="meta-src">${NORTE_VERSION} · generado por scripts/norte.mjs · ${stamp}</div>
      <div class="meta-src">Datos · ${dataHeaderKpi} → pestaña <b style="color:var(--paper)">🗄 Datos</b></div>
    </div>
  </div>
${recentBlock}
</header>
<main>
  <section id="view-pantallas" class="view active">
  <div class="legend">
    <span class="legend-hint">Filtrar</span>
    <button type="button" class="legend-item" data-filter="built" title="Clic para mostrar/ocultar"><span class="badge built">✅ Construido</span> SDD cerrado o aprobado con código</button>
    <button type="button" class="legend-item" data-filter="wip" title="Clic para mostrar/ocultar"><span class="badge wip">🚧 En construcción</span> SDD en progreso o aprobado sin código aún</button>
    <button type="button" class="legend-item" data-filter="design" title="Clic para mostrar/ocultar"><span class="badge design">📋 Diseño</span> solo mockup, falta construir</button>
    <button type="button" class="legend-item" data-filter="brand" title="Clic para mostrar/ocultar"><span class="badge brand">Marca</span> material de identidad</button>
  </div>
${sections}
  </section>
  <section id="view-datos" class="view">
${dataView}
  </section>
</main>
<footer>Norte vigente: <code>${esc(NORTE_REL)}</code> · estado derivado del <code>status</code> del SDD del módulo cruzado con la carpeta de código (mapa en <code>docs/architecture/module-sdd-map.md</code>).</footer>
<script>
  // Filtro por estado: clic en un ítem de la leyenda muestra/oculta sus cards.
  // Vanilla, sin deps. Las secciones que quedan sin cards visibles se ocultan.
  (function () {
    document.querySelectorAll('.legend-item').forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.toggle('off');
        var hidden = b.classList.contains('off');
        document.querySelectorAll('.card.' + b.dataset.filter).forEach(function (c) {
          c.style.display = hidden ? 'none' : '';
        });
        document.querySelectorAll('.group').forEach(function (g) {
          var anyVisible = Array.prototype.some.call(g.querySelectorAll('.card'), function (c) {
            return c.style.display !== 'none';
          });
          g.style.display = anyVisible ? '' : 'none';
        });
      });
    });
  })();

  // Toggle de tema: flipea data-theme en <html> y lo recuerda en localStorage.
  (function () {
    var tt = document.querySelector('.theme-toggle');
    if (!tt) return;
    function sync() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      tt.textContent = dark ? 'Modo claro' : 'Modo oscuro';
    }
    sync();
    tt.addEventListener('click', function () {
      var next =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('norte-theme', next); } catch (e) {}
      sync();
    });
  })();

  // Switch de vistas (Pantallas / Datos): alterna sección y recuerda la elegida.
  (function () {
    var tabs = document.querySelectorAll('.tab');
    var views = {
      pantallas: document.getElementById('view-pantallas'),
      datos: document.getElementById('view-datos'),
    };
    function show(v) {
      if (!views[v]) v = 'pantallas';
      Object.keys(views).forEach(function (k) {
        if (views[k]) views[k].classList.toggle('active', k === v);
      });
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.view === v); });
      try { localStorage.setItem('norte-view', v); } catch (e) {}
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { show(t.dataset.view); });
    });
    var saved = null;
    try { saved = localStorage.getItem('norte-view'); } catch (e) {}
    show(saved === 'datos' ? 'datos' : 'pantallas');
  })();
</script>
</body>
</html>
`;

const OUT = path.join(NORTE_DIR, "_norte.html");
fs.writeFileSync(OUT, html, "utf8");
console.log(`[norte] generado: ${path.relative(ROOT, OUT)}`);

// Snapshot horneado para la web (SDD-0050 Slice B): el Norte vive solo en local
// (este script lee el filesystem del repo), pero podemos servir el HTML estático
// en la web. Lo escribimos a public/norte.html para que `/studio/debug` → Norte
// lo embeba en un <iframe src="/norte.html">. La copia es por `writeFileSync` del
// mismo HTML (NO `cp`) para ser portable: el founder corre en Windows y Vercel es
// Linux. El `postbuild` de package.json invoca solo `node scripts/norte.mjs`, así
// que la copia ocurre en cada build sin shell-ismos. `public/` ya existe (marca/, m/).
const PUBLIC_OUT = path.join(ROOT, "public", "norte.html");
fs.writeFileSync(PUBLIC_OUT, html, "utf8");
console.log(`[norte] snapshot web: ${path.relative(ROOT, PUBLIC_OUT)}`);
console.log(`[norte] pantallas: ${pctBuilt}% construido · ${built} listas · ${wip} en obra · ${design} en diseño (${total} módulos)`);
console.log(`[norte] datos: ${recon.found ? `${recon.counts.built}/${recon.counts.total} entidades con tabla real (${recon.counts.built}✅ ${recon.counts.partial}🟡 ${recon.counts.missing}❌)` : "schema-reconciliation.md no encontrado (vista Datos vacía)"}`);
console.log(`[norte] movimiento reciente: ${recent.length} specs con fecha`);
console.log(`[norte] servir:  npx --yes serve "${NORTE_REL}" -l 3010`);
console.log(`[norte] abrir:   http://localhost:3010/_norte.html`);
