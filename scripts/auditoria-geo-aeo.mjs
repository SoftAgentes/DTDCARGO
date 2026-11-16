#!/usr/bin/env node
/**
 * SDD-0642 · Fase A de la SDD-0641 — auditoría GEO/AEO por página (SOLO LECTURA).
 *
 *     node scripts/auditoria-geo-aeo.mjs                         # sitemap de https://dtdcargo.com
 *     node scripts/auditoria-geo-aeo.mjs --base https://staging.example.com
 *     node scripts/auditoria-geo-aeo.mjs --sitemap ./sitemap.xml --base https://dtdcargo.com
 *     node scripts/auditoria-geo-aeo.mjs --json              # además escribe auditoria-geo-aeo-AAAA-MM-DD.json
 *     node scripts/auditoria-geo-aeo.mjs --json salida.json --no-estricto   (por defecto sale 1 si hay FALLAS)
 *
 * Por página marca PASA / FALLA / MANUAL solo sobre lo que una máquina puede medir en el HTML
 * que entrega el servidor. No renderiza JavaScript, no mide velocidad, no usa cuentas ni llaves.
 * Cuenta comprobaciones reales: NUNCA inventa un puntaje de «100 puntos».
 *
 * Estados:
 *   PASA    la comprobación se cumplió.
 *   FALLA   se midió y no se cumple.
 *   MANUAL  necesita criterio humano (calidad de la respuesta, fuentes): el script no opina.
 *   N/A     no aplica a esa ruta o está en la lista explícita de excepciones (EXCEPCIONES).
 *
 * Sin dependencias nuevas: solo Node (fetch global). El análisis es por expresiones regulares
 * sobre el HTML crudo; es suficiente para las etiquetas que mide y se prueba con HTML de ejemplo
 * (`scripts/__tests__/auditoria-geo-aeo.test.mjs`, sin red).
 */

import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ */
/* Configuración (editable; son propuestas, no verdades de Google)      */
/* ------------------------------------------------------------------ */

export const BASE_POR_DEFECTO = "https://dtdcargo.com";
export const MAX_TITULO = 60;
/** Umbral propuesto: la lectura de 28 páginas (SDD-0641 §2) dio un mínimo de 112 palabras. */
export const MIN_PALABRAS = 100;

/**
 * Excepciones explícitas por ruta: comprobaciones que NO se exigen y por qué. Aparecen como
 * N/A en el informe, nunca desaparecen en silencio.
 */
export const EXCEPCIONES = {
  "/enlaces": {
    motivo: "página de enlaces (tipo link-in-bio): poco texto a propósito",
    omite: ["respuesta-rapida", "palabras", "jsonld-tipos", "entrantes"],
  },
  "/privacidad": {
    motivo: "texto legal: no es una página de respuesta",
    omite: ["respuesta-rapida", "jsonld-tipos"],
  },
  "/cookies": {
    motivo: "texto legal: no es una página de respuesta",
    omite: ["respuesta-rapida", "jsonld-tipos"],
  },
};

/**
 * Rutas donde se espera el bloque `#respuesta-rapida` (respuesta en las dos primeras frases).
 * Un `*` final significa «y todo lo que cuelga de ahí». El resto: N/A.
 */
export const REQUIERE_RESPUESTA_RAPIDA = [
  "/",
  "/tarifas",
  "/fcl",
  "/puerta-a-puerta",
  "/shipping-mark",
  "/faq",
  "/glosario",
  "/importar-de-china",
  "/importar-de-china/*",
  "/servicios/*",
  "/noticias/*",
];

/** Tipos JSON-LD esperados por ruta (basta con que esté al menos uno de la lista de cada regla). */
export const TIPOS_ESPERADOS = [
  { ruta: "/", cualquiera: ["Organization"] },
  { ruta: "/nosotros", cualquiera: ["AboutPage"] },
  { ruta: "/faq", cualquiera: ["FAQPage"] },
  { ruta: "/puerta-a-puerta", cualquiera: ["FAQPage"] },
  { ruta: "/shipping-mark", cualquiera: ["FAQPage"] },
  { ruta: "/importar-de-china/*", cualquiera: ["FAQPage"] },
  { ruta: "/noticias/*", cualquiera: ["BlogPosting", "NewsArticle", "Article"] },
];

/** Tipos que obligan a llevar `dateModified`. */
const TIPOS_CON_FECHA = ["BlogPosting", "NewsArticle", "Article"];

/** Orden y nombre corto de las columnas del informe. */
export const COMPROBACIONES = [
  ["http", "http"],
  ["titulo", "título"],
  ["description", "desc"],
  ["canonical", "canon"],
  ["h1", "h1"],
  ["jsonld", "ld"],
  ["jsonld-tipos", "tipos"],
  ["fecha-modificacion", "fecha"],
  ["respuesta-rapida", "resp"],
  ["palabras", "pal"],
  ["noindex", "idx"],
  ["entrantes", "entr"],
  ["titulo-repetido", "t-dup"],
  ["h1-repetido", "h1-dup"],
  ["respuesta-calidad", "m:resp"],
  ["fuentes", "m:fuen"],
];

/* ------------------------------------------------------------------ */
/* Utilidades de texto y HTML                                           */
/* ------------------------------------------------------------------ */

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificarEntidades(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

const limpiarEspacios = (s) => s.replace(/\s+/g, " ").trim();
/** Longitud en caracteres visibles (puntos de código, no unidades UTF-16). */
const largo = (s) => [...s.normalize("NFC")].length; // NFC: una vocal con tilde en NFD cuenta 1

function atributos(etiqueta) {
  const out = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(etiqueta))) out[m[1].toLowerCase()] = decodificarEntidades(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

function etiquetas(html, nombre) {
  return [...html.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, "gi"))].map((m) => atributos(m[0]));
}

/** HTML sin bloques que no son texto ni enlaces visibles (script, style, plantillas, comentarios). */
function sinBloques(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ");
}

export function extraerTitulo(html) {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? limpiarEspacios(decodificarEntidades(m[1].replace(/<[^>]+>/g, ""))) : null;
}

export function extraerMeta(html, nombre) {
  for (const a of etiquetas(html, "meta")) {
    if ((a.name ?? a.property ?? "").toLowerCase() === nombre) return a.content ?? "";
  }
  return null;
}

export function extraerCanonical(html) {
  for (const a of etiquetas(html, "link")) {
    if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical")) return a.href ?? null;
  }
  return null;
}

export function extraerH1(html) {
  const limpio = sinBloques(html);
  return [...limpio.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    limpiarEspacios(decodificarEntidades(m[1].replace(/<[^>]+>/g, " "))),
  );
}

export function contarPalabras(html) {
  const texto = decodificarEntidades(sinBloques(html).replace(/<[^>]+>/g, " "));
  return (texto.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

/** Devuelve { bloques, errores, tipos, nodos } de todos los `<script type="application/ld+json">`. */
export function extraerJsonLd(html) {
  const bloques = [];
  let errores = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/application\/ld\+json/i.test(atributos(`<script ${m[1]}>`).type ?? "")) continue;
    try {
      bloques.push(JSON.parse(m[2]));
    } catch {
      errores++;
    }
  }
  const nodos = [];
  const visitar = (n) => {
    if (Array.isArray(n)) return n.forEach(visitar);
    if (n && typeof n === "object") {
      if (n["@type"]) nodos.push(n);
      for (const v of Object.values(n)) visitar(v);
    }
  };
  bloques.forEach(visitar);
  const tipos = new Set();
  for (const n of nodos) for (const t of [].concat(n["@type"])) tipos.add(String(t));
  return { bloques: bloques.length, errores, tipos: [...tipos], nodos };
}

/** Ruta normalizada de un enlace interno (sin hash, sin query, sin barra final) o null. */
export function rutaInterna(href, paginaUrl, origen) {
  if (!href || /^(mailto:|tel:|javascript:|data:|#)/i.test(href.trim())) return null;
  let u;
  try {
    u = new URL(href.trim(), paginaUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.origin !== origen) return null;
  return normalizarRuta(u.pathname);
}

export function normalizarRuta(p) {
  const r = p.replace(/\/{2,}/g, "/");
  return r.length > 1 ? r.replace(/\/+$/, "") : "/";
}

export function extraerEnlacesInternos(html, paginaUrl) {
  const origen = new URL(paginaUrl).origin;
  const out = new Set();
  for (const a of etiquetas(sinBloques(html), "a")) {
    const r = rutaInterna(a.href, paginaUrl, origen);
    if (r) out.add(r);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sitemap                                                              */
/* ------------------------------------------------------------------ */

/** URL de cada `<loc>` de un sitemap; con `base`, reemplaza el origen (útil para staging). */
export function parsearSitemap(xml, base = null) {
  const urls = [];
  let propio = null;
  for (const m of xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)) {
    const loc = /<loc>([\s\S]*?)<\/loc>/i.exec(m[0]);
    if (!loc) continue;
    const lm = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(m[0]);
    let url = decodificarEntidades(loc[1].trim());
    if (base) {
      const u = new URL(url);
      propio ??= u.origin;
      // Solo se reescribe el origen propio del sitemap; una <loc> de otro dominio queda tal cual y falla.
      if (u.origin === propio) url = new URL(u.pathname + u.search, base).href;
    }
    urls.push({ url, lastmod: lm ? lm[1].trim() : null });
  }
  return urls;
}

/* ------------------------------------------------------------------ */
/* Reglas por página                                                    */
/* ------------------------------------------------------------------ */

const coincideRuta = (patron, ruta) =>
  patron.endsWith("/*") ? ruta.startsWith(patron.slice(0, -1)) && ruta.length > patron.length - 1 : patron === ruta;

const r = (estado, detalle = "") => ({ estado, detalle });
const PASA = (d) => r("PASA", d);
const FALLA = (d) => r("FALLA", d);
const MANUAL = (d) => r("MANUAL", d);
const NA = (d) => r("N/A", d);

/**
 * Analiza una página. Entrada: { url, status, headers?: {x-robots-tag}, html }.
 * Devuelve { url, ruta, status, titulo, h1, enlaces, checks }. No depende de la red.
 */
export function analizarPagina(pagina, config = {}) {
  const excepciones = config.excepciones ?? EXCEPCIONES;
  const url = new URL(pagina.url);
  const ruta = normalizarRuta(url.pathname);
  const html = pagina.html ?? "";
  const exc = excepciones[ruta];
  const checks = {};

  // 1. HTTP
  checks.http = pagina.status === 200 ? PASA("200") : FALLA(pagina.error ? `sin respuesta: ${pagina.error}` : `respuesta ${pagina.status ?? "sin respuesta"}`);

  // 2. Título ≤ 60
  const titulo = extraerTitulo(html);
  if (!titulo) checks.titulo = FALLA("sin <title>");
  else {
    const n = largo(titulo);
    checks.titulo = n <= (config.maxTitulo ?? MAX_TITULO) ? PASA(`${n} caracteres`) : FALLA(`${n} caracteres (máx. ${config.maxTitulo ?? MAX_TITULO})`);
  }

  // 3. meta description
  const desc = extraerMeta(html, "description");
  checks.description = desc && desc.trim() ? PASA(`${largo(desc.trim())} caracteres`) : FALLA(desc === null ? "sin meta description" : "meta description vacía");

  // 4. canonical presente y que apunte a la misma ruta
  const canon = extraerCanonical(html);
  if (!canon) checks.canonical = FALLA("sin canonical");
  else {
    let rc = null;
    try {
      rc = normalizarRuta(new URL(canon, pagina.url).pathname);
    } catch {
      /* queda null */
    }
    checks.canonical = rc === ruta ? PASA(canon) : FALLA(`apunta a ${canon}, no a ${ruta}`);
  }

  // 5. un solo H1
  const h1 = extraerH1(html);
  checks.h1 = h1.length === 1 ? PASA(h1[0]) : FALLA(h1.length === 0 ? "sin H1" : `${h1.length} H1`);

  // 6-7. JSON-LD presente, válido y con los tipos esperados
  const ld = extraerJsonLd(html);
  if (ld.errores) checks.jsonld = FALLA(`${ld.errores} bloque(s) con JSON inválido`);
  else if (!ld.bloques) checks.jsonld = FALLA("sin JSON-LD");
  else checks.jsonld = PASA(ld.tipos.join(", ") || "sin @type");

  const regla = (config.tiposEsperados ?? TIPOS_ESPERADOS).find((t) => coincideRuta(t.ruta, ruta));
  if (regla) {
    const falta = !regla.cualquiera.some((t) => ld.tipos.includes(t));
    checks["jsonld-tipos"] = falta ? FALLA(`falta ${regla.cualquiera.join(" o ")}; hay: ${ld.tipos.join(", ") || "nada"}`) : PASA(regla.cualquiera.filter((t) => ld.tipos.includes(t)).join(", "));
  } else checks["jsonld-tipos"] = NA("sin tipo esperado definido para esta ruta");

  // 8. dateModified donde aplica (tipos de artículo)
  const articulos = ld.nodos.filter((n) => [].concat(n["@type"]).some((t) => TIPOS_CON_FECHA.includes(t)));
  if (!articulos.length) checks["fecha-modificacion"] = NA("sin tipo de artículo");
  else {
    const sin = articulos.filter((n) => !n.dateModified || Number.isNaN(Date.parse(n.dateModified)));
    checks["fecha-modificacion"] = sin.length ? FALLA("dateModified ausente o no es una fecha") : PASA(String(articulos[0].dateModified));
  }

  // 9. #respuesta-rapida
  const requiere = (config.requiereRespuestaRapida ?? REQUIERE_RESPUESTA_RAPIDA).some((p) => coincideRuta(p, ruta));
  if (!requiere) checks["respuesta-rapida"] = NA("ruta sin bloque de respuesta esperado");
  else checks["respuesta-rapida"] = /\bid\s*=\s*["']respuesta-rapida["']/i.test(sinBloques(html)) ? PASA("#respuesta-rapida") : FALLA("sin #respuesta-rapida");

  // 10. palabras en el HTML crudo
  const palabras = contarPalabras(html);
  const min = config.minPalabras ?? MIN_PALABRAS;
  checks.palabras = palabras >= min ? PASA(`${palabras} palabras`) : FALLA(`${palabras} palabras (mín. ${min})`);

  // 11. noindex: una URL del sitemap debe poder indexarse
  const metaRobots = extraerMeta(html, "robots") ?? "";
  const xRobots = pagina.headers?.["x-robots-tag"] ?? "";
  const noindex = /noindex|none/i.test(metaRobots) || /noindex|none/i.test(xRobots);
  checks.noindex = noindex ? FALLA(`noindex (${[metaRobots && `meta: ${metaRobots}`, xRobots && `cabecera: ${xRobots}`].filter(Boolean).join("; ")}) en una URL del sitemap`) : PASA("indexable");

  // Las comprobaciones de sitio y las manuales se completan en analizarSitio().
  checks.entrantes = NA("pendiente de análisis de sitio");
  checks["titulo-repetido"] = NA("pendiente de análisis de sitio");
  checks["h1-repetido"] = NA("pendiente de análisis de sitio");

  // Criterio humano: el script nunca opina sobre esto.
  checks["respuesta-calidad"] = requiere ? MANUAL("¿las dos primeras frases responden la pregunta del título?") : NA("ruta sin bloque de respuesta esperado");
  checks.fuentes = MANUAL("¿hay fuentes, autor o prueba verificable donde hace falta?");

  // Excepciones explícitas
  if (exc) {
    for (const id of exc.omite) if (checks[id]) checks[id] = NA(`excepción: ${exc.motivo}`);
  }

  return { url: pagina.url, ruta, status: pagina.status ?? null, titulo, h1, palabras, enlaces: [...extraerEnlacesInternos(html, pagina.url)], error: pagina.error ?? null, checks };
}

/**
 * Comprobaciones que dependen de varias páginas: enlaces entrantes / huérfanas y repetidos de
 * título y H1 (posible canibalización). Modifica y devuelve las mismas páginas.
 */
export function analizarSitio(paginas, config = {}) {
  const excepciones = config.excepciones ?? EXCEPCIONES;
  const rutas = new Set(paginas.map((p) => p.ruta));
  const entrantes = new Map(paginas.map((p) => [p.ruta, new Set()]));
  for (const p of paginas) {
    for (const destino of p.enlaces) {
      if (destino !== p.ruta && rutas.has(destino)) entrantes.get(destino).add(p.ruta);
    }
  }
  const porTitulo = new Map();
  const porH1 = new Map();
  const norm = (s) => s.toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
  for (const p of paginas) {
    if (p.titulo) porTitulo.set(norm(p.titulo), [...(porTitulo.get(norm(p.titulo)) ?? []), p.ruta]);
    if (p.h1.length === 1 && p.h1[0]) porH1.set(norm(p.h1[0]), [...(porH1.get(norm(p.h1[0])) ?? []), p.ruta]);
  }
  for (const p of paginas) {
    const exc = excepciones[p.ruta];
    const omite = (id) => exc?.omite.includes(id);
    const n = entrantes.get(p.ruta).size;
    p.entrantes = n;
    if (omite("entrantes")) p.checks.entrantes = NA(`excepción: ${exc.motivo}`);
    else if (p.ruta === "/") p.checks.entrantes = NA("la portada no se audita como huérfana");
    else p.checks.entrantes = n > 0 ? PASA(`${n} página(s) enlazan aquí`) : FALLA("huérfana: ninguna otra página del sitemap la enlaza");

    const dupT = p.titulo ? porTitulo.get(norm(p.titulo)).filter((x) => x !== p.ruta) : [];
    p.checks["titulo-repetido"] = !p.titulo ? NA("sin título") : dupT.length ? FALLA(`mismo título que ${dupT.join(", ")}`) : PASA("título único");
    const dupH = p.h1.length === 1 && p.h1[0] ? porH1.get(norm(p.h1[0])).filter((x) => x !== p.ruta) : [];
    p.checks["h1-repetido"] = p.h1.length !== 1 ? NA("sin un único H1") : dupH.length ? FALLA(`mismo H1 que ${dupH.join(", ")}`) : PASA("H1 único");
  }
  return paginas;
}

/** Cuenta comprobaciones reales (nunca un puntaje). */
export function resumir(paginas) {
  const total = { PASA: 0, FALLA: 0, MANUAL: 0, "N/A": 0 };
  const porComprobacion = {};
  for (const p of paginas) {
    for (const [id, c] of Object.entries(p.checks)) {
      total[c.estado]++;
      (porComprobacion[id] ??= { PASA: 0, FALLA: 0, MANUAL: 0, "N/A": 0 })[c.estado]++;
    }
  }
  const estadoPagina = (p) => {
    const e = Object.values(p.checks).map((c) => c.estado);
    return e.includes("FALLA") ? "FALLA" : e.includes("MANUAL") ? "MANUAL" : "PASA";
  };
  const paginasPorEstado = { PASA: 0, FALLA: 0, MANUAL: 0 };
  for (const p of paginas) paginasPorEstado[estadoPagina(p)]++;
  return { paginas: paginas.length, comprobaciones: total, paginasPorEstado, porComprobacion };
}

/* ------------------------------------------------------------------ */
/* Salida                                                               */
/* ------------------------------------------------------------------ */

const SIMBOLO = { PASA: "OK", FALLA: "XX", MANUAL: "??", "N/A": "--" };

export function formatearTabla(paginas) {
  const cols = COMPROBACIONES.map(([id, corto]) => ({ id, corto }));
  const ancho = Math.max(5, ...paginas.map((p) => p.ruta.length));
  const lineas = [];
  lineas.push(["ruta".padEnd(ancho), ...cols.map((c) => c.corto.padEnd(Math.max(c.corto.length, 2)))].join("  "));
  for (const p of paginas) {
    lineas.push(
      [p.ruta.padEnd(ancho), ...cols.map((c) => SIMBOLO[p.checks[c.id]?.estado ?? "N/A"].padEnd(Math.max(c.corto.length, 2)))].join("  "),
    );
  }
  lineas.push("");
  lineas.push("OK = pasa · XX = falla · ?? = manual (criterio humano) · -- = no aplica o excepción");
  return lineas.join("\n");
}

export function formatearFallas(paginas) {
  const lineas = [];
  for (const p of paginas) {
    for (const [id, c] of Object.entries(p.checks)) {
      if (c.estado === "FALLA") lineas.push(`  FALLA  ${p.ruta}  [${id}]  ${c.detalle}`);
    }
  }
  return lineas.join("\n");
}

export function construirInforme({ base, sitemap, paginas, fecha = new Date(), truncado = null }) {
  return {
    ...(truncado ? { truncado } : {}),
    fecha: fecha.toISOString(),
    base,
    sitemap,
    nota: "Solo comprobaciones medibles por máquina sobre el HTML crudo. MANUAL = necesita criterio humano. No hay puntaje.",
    resumen: resumir(paginas),
    paginas: paginas.map((p) => ({
      url: p.url,
      ruta: p.ruta,
      status: p.status,
      titulo: p.titulo,
      palabras: p.palabras,
      entrantes: p.entrantes ?? null,
      error: p.error ?? null,
      checks: p.checks,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Red y línea de comandos                                              */
/* ------------------------------------------------------------------ */

/** User-agent genérico: sin datos de Sam ni del repositorio. */
export const USER_AGENT = "auditoria-geo-aeo/1";
/** Pausa por defecto entre pedidos al sitio en vivo (ms). */
export const PAUSA_POR_DEFECTO_MS = 1000;

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

/** Tope de espera por pedido (ms). */
export const TIMEOUT_MS = 20_000;
/** Tope de URL auditadas por corrida. */
export const MAX_POR_DEFECTO = 200;
const MAX_REDIRECCIONES = 5;

/**
 * Un pedido que solo sigue redirecciones DENTRO del mismo origen (`origen`). Si una redirección
 * sale a otro origen, lanza error y no la sigue. Siempre con tope de tiempo.
 */
export async function pedir(url, { origen, fetchFn = fetch, timeoutMs = TIMEOUT_MS, accept = "*/*" } = {}) {
  let actual = url;
  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const res = await fetchFn(actual, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": USER_AGENT, accept },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const destino = new URL(loc, actual);
      if (origen && destino.origin !== origen) throw new Error(`redirige a otro origen (${destino.origin}); no se sigue`);
      actual = destino.href;
      continue;
    }
    return res;
  }
  throw new Error(`más de ${MAX_REDIRECCIONES} redirecciones`);
}

const motivo = (e) => (e?.name === "TimeoutError" || e?.name === "AbortError" ? `tiempo agotado (${TIMEOUT_MS / 1000} s)` : String(e?.cause?.code ?? e?.message ?? e));

async function leerTexto(origen, deps) {
  if (/^https?:\/\//i.test(origen)) {
    const res = await pedir(origen, { origen: new URL(origen).origin, fetchFn: deps.fetchFn, timeoutMs: deps.timeoutMs });
    if (!res.ok) throw new Error(`${origen}: HTTP ${res.status}`);
    return res.text();
  }
  return readFile(origen, "utf8");
}

async function bajarPagina(url, origen, deps) {
  if (new URL(url).origin !== origen) {
    return { url, status: null, headers: {}, html: "", error: `la URL del sitemap es de otro origen (${new URL(url).origin}); solo se audita ${origen}` };
  }
  try {
    const res = await pedir(url, { origen, fetchFn: deps.fetchFn, timeoutMs: deps.timeoutMs, accept: "text/html" });
    return { url, status: res.status, headers: { "x-robots-tag": res.headers.get("x-robots-tag") ?? "" }, html: await res.text() };
  } catch (e) {
    return { url, status: null, headers: {}, html: "", error: motivo(e) };
  }
}

/**
 * Archivos candidatos dentro de una carpeta local de HTML para una ruta del sitio:
 * `/` → index.html; `/fcl` → fcl.html o fcl/index.html.
 */
export function candidatosLocales(ruta) {
  const r = normalizarRuta(ruta);
  if (r === "/") return ["index.html"];
  const sin = decodeURIComponent(r.slice(1));
  return [`${sin}.html`, `${sin}/index.html`];
}

async function leerPaginaLocal(dir, url) {
  const raiz = resolve(dir);
  try {
    for (const c of candidatosLocales(new URL(url).pathname)) {
      const archivo = resolve(raiz, c);
      const rel = relative(raiz, archivo);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) return { url, status: null, headers: {}, html: "", error: "ruta fuera de la carpeta --html-dir" };
      try {
        return { url, status: 200, headers: {}, html: await readFile(archivo, "utf8") };
      } catch {
        /* probar el siguiente candidato */
      }
    }
  } catch (e) {
    return { url, status: null, headers: {}, html: "", error: `ruta no válida: ${e?.message ?? e}` };
  }
  return { url, status: null, headers: {}, html: "", error: "archivo local no encontrado" };
}

/** Un pedido a la vez, con pausa entre pedidos (nunca en paralelo contra el sitio en vivo). */
async function enSerie(items, pausaMs, fn) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && pausaMs > 0) await dormir(pausaMs);
    out.push(await fn(items[i]));
  }
  return out;
}

export function leerArgumentos(argv) {
  const a = { base: BASE_POR_DEFECTO, baseExplicita: false, sitemap: null, htmlDir: null, pausa: PAUSA_POR_DEFECTO_MS, max: MAX_POR_DEFECTO, json: null, estricto: true, ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--base") (a.base = argv[++i]), (a.baseExplicita = true);
    else if (v === "--sitemap") a.sitemap = argv[++i];
    else if (v === "--html-dir") a.htmlDir = argv[++i];
    else if (v === "--pausa") {
      a.pausa = Number(argv[++i]);
      if (!Number.isFinite(a.pausa) || a.pausa < 0) throw new Error("--pausa necesita un número de milisegundos ≥ 0");
    } else if (v === "--max") {
      a.max = Number(argv[++i]);
      if (!Number.isInteger(a.max) || a.max < 1) throw new Error("--max necesita un entero ≥ 1");
    } else if (v === "--json") a.json = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else if (v === "--estricto") a.estricto = true;
    else if (v === "--no-estricto") a.estricto = false;
    else if (v === "--help" || v === "-h") a.ayuda = true;
    else throw new Error(`Argumento desconocido: ${v}`);
  }
  return a;
}

/** Nombre de archivo del informe JSON: solo un nombre simple `.json` (se escribe en la carpeta actual). */
export function nombreJsonSeguro(nombre) {
  if (!/^[\w.-]+\.json$/.test(nombre) || nombre.includes("..")) {
    throw new Error("--json acepta solo un nombre simple terminado en .json (sin carpetas), que se escribe en la carpeta actual.");
  }
  return nombre;
}

const AYUDA = `Uso: node scripts/auditoria-geo-aeo.mjs [--base URL] [--sitemap URL|archivo] [--html-dir carpeta] [--pausa ms] [--max N] [--json [nombre.json]] [--no-estricto]
  --base URL        origen a auditar (por defecto ${BASE_POR_DEFECTO}); con --sitemap, reescribe el origen propio de cada <loc>
  --sitemap X       sitemap alterno: URL o archivo local (por defecto <base>/sitemap.xml). Sin --base y con URL, el origen sale del sitemap
  --html-dir D      lee el HTML de cada página de una carpeta local (/ = index.html; /fcl = fcl.html o fcl/index.html)
                    y NO toca el sitio; exige --sitemap con un archivo local
  --pausa ms        pausa entre pedidos al sitio en vivo (por defecto ${PAUSA_POR_DEFECTO_MS}); siempre un pedido a la vez
  --max N           tope de URL por corrida (por defecto ${MAX_POR_DEFECTO}); si el sitemap trae más, corta y avisa
  --json [nombre]   escribe el informe JSON en la carpeta actual (por defecto auditoria-geo-aeo-AAAA-MM-DD.json)
  --no-estricto     sale con código 0 aunque haya FALLAS (por defecto sale 1 si hay alguna; 2 si el script no pudo correr)
Solo se audita el dominio propio: una URL o redirección a otro origen cuenta como FALLA y no se sigue.`;

export async function main(argv = process.argv.slice(2), deps = {}) {
  const { fetchFn = fetch, log = console.log, timeoutMs = TIMEOUT_MS } = deps;
  const args = leerArgumentos(argv);
  if (args.ayuda) return log(AYUDA), 0;
  const sitemapEsUrl = !!args.sitemap && /^https?:\/\//i.test(args.sitemap);
  if (args.htmlDir && (!args.sitemap || sitemapEsUrl)) {
    throw new Error("--html-dir exige --sitemap con un archivo local (así no se toca el sitio).");
  }
  const archivoJson = args.json ? nombreJsonSeguro(args.json === true ? `auditoria-geo-aeo-${new Date().toISOString().slice(0, 10)}.json` : args.json) : null;
  // Origen auditado: --base; si no, el del sitemap (si es URL) o el de su primera <loc> (si es archivo); sin sitemap, la base por defecto.
  const origenBase = new URL(args.baseExplicita ? args.base : sitemapEsUrl ? args.sitemap : args.base).origin;
  const sitemapSrc = args.sitemap ?? new URL("/sitemap.xml", origenBase).href;
  const xml = await leerTexto(sitemapSrc, { fetchFn, timeoutMs });
  const primera = parsearSitemap(xml)[0];
  const origen = args.baseExplicita || !args.sitemap || sitemapEsUrl || !primera ? origenBase : new URL(primera.url).origin;
  const todas = parsearSitemap(xml, origen);
  if (!todas.length) throw new Error(`El sitemap ${sitemapSrc} no trae ninguna <loc>.`);
  const entradas = todas.slice(0, args.max);
  const truncado = todas.length > entradas.length ? { total: todas.length, auditadas: entradas.length } : null;
  log(`Auditando ${entradas.length} URL de ${sitemapSrc}${args.htmlDir ? ` (HTML local: ${args.htmlDir})` : `, un pedido a la vez con pausa de ${args.pausa} ms`} …`);
  if (truncado) log(`AVISO: el sitemap trae ${truncado.total} URL; se auditan solo las primeras ${truncado.auditadas} (--max ${args.max}). Sube --max para ver el resto.`);
  const bajadas = args.htmlDir
    ? await Promise.all(entradas.map((e) => leerPaginaLocal(args.htmlDir, e.url)))
    : await enSerie(entradas, args.pausa, (e) => bajarPagina(e.url, origen, { fetchFn, timeoutMs }));
  const paginas = analizarSitio(bajadas.map((p) => analizarPagina(p)));
  log("\n" + formatearTabla(paginas));
  const fallas = formatearFallas(paginas);
  if (fallas) log("\nFallas:\n" + fallas);
  const res = resumir(paginas);
  log(`\n${res.paginas} páginas · comprobaciones: ${res.comprobaciones.PASA} pasan, ${res.comprobaciones.FALLA} fallan, ${res.comprobaciones.MANUAL} manuales, ${res["comprobaciones"]["N/A"]} no aplican`);
  log("(Conteo de comprobaciones reales; no es un puntaje.)");
  if (archivoJson) {
    await writeFile(archivoJson, JSON.stringify(construirInforme({ base: origen, sitemap: sitemapSrc, paginas, truncado }), null, 2) + "\n");
    log(`Informe JSON: ${archivoJson}`);
  }
  return args.estricto && res.comprobaciones.FALLA > 0 ? 1 : 0;
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`Error: ${e.message}`);
      process.exit(2);
    },
  );
}
