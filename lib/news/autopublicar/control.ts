/**
 * SDD-0611 §4.3.1 · Control determinista de líneas rojas (F5).
 *
 * El Revisor es un modelo, y IA-01 no deja que su opinión sea la única barrera.
 * Este control no usa ningún modelo: listas versionadas y expresiones con sus
 * pruebas. Un falso positivo solo manda la noticia a revisión manual; por eso
 * se prefiere detectar de más.
 *
 * La lista de nombres del operador de consolidación y de los inspectores
 * externos NO vive en Git: llega de la configuración del servidor. Sin ella, F5
 * falla (`linea_roja:lista_no_cargada`).
 */

import { normalizarParaMarcas } from "./marcas";

/** Cambia al cambiar cualquier lista o expresión de este archivo. */
export const CONTROL_VERSION = "0611-control-v1";

/** Reglas que mide el control. Cada una da `linea_roja:<regla>`. */
export const REGLAS_CONTROL = [
  "precio",
  "plazo",
  "descuento",
  "operador",
  "lenguaje_calle",
  "compra_menos",
  "datos_personales",
  "enlace_ajeno",
] as const;
export type ReglaControl = (typeof REGLAS_CONTROL)[number];

/**
 * Líneas rojas que el Revisor tiene que responder una por una (F5): las cinco de
 * `LINEAS_ROJAS` y las reglas de voz que suma `06-noticias.md`.
 */
export const LINEAS_ROJAS_REVISOR = [
  "publico_objetivo",
  "lenguaje_calle",
  "compra_menos",
  "sensibilizar",
  "operador",
  "precio",
  "plazo",
  "descuento",
  "datos_personales",
] as const;

/** Minúsculas, sin acentos, NFKC y sin invisibles. */
export function normalizarTexto(texto: string): string {
  return normalizarParaMarcas(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Solo letras y dígitos: «Ope-ra dor» y «operador» quedan iguales. */
function compactar(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]/g, "");
}

const MONEDA = String.raw`(?:us\$|\$|usd|dolares?|bs\.?(?=\s|\d|$)|bolivares?|¥|cny|rmb|yuan(?:es)?|€|euros?)`;
const NUMERO = String.raw`\d[\d.,]*`;
const UNIDAD_PRECIO = String.raw`(?:kilo|kg|metro cubico|m3|m³|cbm|pie cubico|caja|bulto)`;

const PRECIO: RegExp[] = [
  new RegExp(String.raw`${MONEDA}\s*${NUMERO}`, "i"),
  new RegExp(String.raw`${NUMERO}\s*${MONEDA}`, "i"),
  new RegExp(String.raw`${NUMERO}\s*(?:\S+\s+){0,2}(?:por|el|/)\s*${UNIDAD_PRECIO}\b`, "i"),
];

const PLAZO_FIJO = /\bgarantiz\w*/;
const PLAZO_EN_DIAS = /\ben\s+\d+\s+(?:dias|semanas)\b/g;
const PLAZO_VERBO = /\b(?:lleg|entreg|recib)\w*/;

const DESCUENTO =
  /\b(?:descuentos?|reembols\w*|devolvemos|gratis|gratuit\w*|promocion\w*|ofertas?)\b/;

const LENGUAJE_CALLE =
  /\b(?:flujo de caja|rotacion|ccc|capital de trabajo|ciclo de conversion)\b/;

const COMPRA_MENOS =
  /\b(?:compra(?:r)? menos|compre menos|comprar menos|reduce tus compras|reduzca sus compras|reducir tus compras|baja(?:r)? el volumen|reduce el volumen)\b/;

const DATOS_PERSONALES: RegExp[] = [
  // Correo.
  /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/,
  // Teléfono de Venezuela (0412, +58 414, 58-424…).
  /(?:\+?58[\s.-]?)?\(?0?4(?:12|14|16|22|24|26)\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/,
  // Teléfono internacional con prefijo.
  /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}/,
  // Cédula: V-12.345.678, E 1234567, C.I. 12345678.
  /\b[ve][\s.-]?\d{1,2}\.?\d{3}\.?\d{3}\b/,
  /\bc\.?\s?i\.?\s*:?\s*\d{6,9}\b/,
  /\bcedula\s*(?:de identidad)?\s*(?:n[°o.]?\s*)?:?\s*\d/,
  // RIF: J-12345678-9.
  /\b[jgvep][\s-]?\d{8}[\s-]?\d\b/,
  // Dirección de calle: la palabra y un número cerca.
  /\b(?:calle|avenida|av\.|carrera|urbanizacion|urb\.|edificio|edif\.|residencias|apartamento|apto\.?)\s+[^\n]{0,30}?\d/,
];

/** Dominios propios: un enlace a ellos no necesita fuente. */
const DOMINIOS_PROPIOS = ["dtdcargo.com"];

function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function esPropio(host: string): boolean {
  return DOMINIOS_PROPIOS.some((d) => host === d || host.endsWith(`.${d}`));
}

export interface FuenteBorrador {
  url?: string | null;
  titulo?: string | null;
}

export interface EntradaControl {
  /** Titular, extracto, descripción y cuerpo: todo lo que se publica. */
  textos: string[];
  fuentes: FuenteBorrador[];
  /** Nombres prohibidos de la configuración del servidor; `null` = no cargada. */
  nombresProhibidos: ReadonlyArray<string> | null;
}

/** Códigos `linea_roja:<regla>` de lo que el control encontró. Vacío = pasa. */
export function controlLineasRojas(entrada: EntradaControl): string[] {
  const crudo = entrada.textos.join("\n\n");
  const t = normalizarTexto(crudo);
  const codigos = new Set<string>();

  if (PRECIO.some((re) => re.test(t))) codigos.add("linea_roja:precio");

  if (PLAZO_FIJO.test(t)) codigos.add("linea_roja:plazo");
  for (const m of t.matchAll(PLAZO_EN_DIAS)) {
    const i = m.index ?? 0;
    const ventana = t.slice(Math.max(0, i - 60), i + m[0].length + 60);
    if (PLAZO_VERBO.test(ventana)) codigos.add("linea_roja:plazo");
  }

  if (DESCUENTO.test(t)) codigos.add("linea_roja:descuento");

  const nombres = entrada.nombresProhibidos;
  if (nombres === null || nombres.filter((n) => compactar(n).length >= 3).length === 0) {
    codigos.add("linea_roja:lista_no_cargada");
  } else {
    const todo = compactar(crudo);
    if (nombres.some((n) => compactar(n).length >= 3 && todo.includes(compactar(n)))) {
      codigos.add("linea_roja:operador");
    }
  }

  if (LENGUAJE_CALLE.test(t)) codigos.add("linea_roja:lenguaje_calle");
  if (COMPRA_MENOS.test(t)) codigos.add("linea_roja:compra_menos");
  if (tieneDatosPersonales(crudo)) codigos.add("linea_roja:datos_personales");

  const hostsFuente = new Set(
    entrada.fuentes.map((f) => (f.url ? hostDe(f.url) : null)).filter((h): h is string => !!h),
  );
  for (const m of normalizarParaMarcas(crudo).matchAll(/https?:\/\/[^\s)\]>"']+/gi)) {
    const host = hostDe(m[0]);
    if (host === null || (!esPropio(host) && !hostsFuente.has(host))) {
      codigos.add("linea_roja:enlace_ajeno");
    }
  }

  return [...codigos];
}

/** ¿El texto trae un teléfono, correo, cédula, RIF o dirección? (§4.3.1, §4.11) */
export function tieneDatosPersonales(texto: string): boolean {
  const t = normalizarTexto(texto);
  return DATOS_PERSONALES.some((re) => re.test(t));
}

/**
 * F5, la mitad del Revisor: cada línea roja respondida «cumple». Una sin
 * responder o con otra respuesta da `linea_roja:revisor_<clave>`.
 */
export function lineasRojasDelRevisor(lineas: unknown): string[] {
  const obj = lineas && typeof lineas === "object" ? (lineas as Record<string, unknown>) : {};
  return LINEAS_ROJAS_REVISOR.filter((k) => obj[k] !== "cumple").map(
    (k) => `linea_roja:revisor_${k}`,
  );
}
