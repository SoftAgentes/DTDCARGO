/**
 * SDD-0700 · La lista de datos personales de la Oficina_Virtual: una sola lista para DETECTAR (la salida del agente,
 * los textos que escribe el cable, el motivo de un rechazo) y para TAPAR (la entrada del agente, `tapar-datos.ts`).
 *
 * Nace como copia de la regla de noticias (`lib/news/autopublicar/control.ts`, SDD-0611 §4.3.1) más el teléfono
 * internacional agrupado del cable, y se separa de ella a propósito (revisión de la #755): los arreglos de aquí no
 * cambian el detector de noticias. Lo que suma o cambia frente a la copia:
 *   - cédula con puntos detrás de «cédula», «C.I.», «CI:» o «cédula es» (12.345.678), entera;
 *   - RIF de 7 dígitos (J-1234567-8) y con puntos (J-12.345.678-9);
 *   - teléfonos fijos de Venezuela (0212, 0241…, con o sin paréntesis);
 *   - borde al inicio de los números: lo que va pegado a letras o a otros dígitos (las guías de mensajería como
 *     YT2412345678901 o SF1412345678901) no es un teléfono, y un móvil sin el 0 ni el 58 tiene que venir separado
 *     («414-555-1234», no «4141234567»);
 *   - direcciones con «sector», «barrio», «quinta», «manzana», «parcela», «av» sin punto, «casa 12» / «casa N.º 14» y
 *     «torre B».
 *
 * Todo se busca sobre `normalizarTexto` (NFKC, sin invisibles, sin tildes, en minúsculas).
 */
import { normalizarTexto } from "@/lib/news/autopublicar/control";

export type TipoDatoPersonal = "correo" | "telefono" | "cedula" | "rif" | "direccion";

/** Los marcadores con los que se tapa cada tipo. Estables: el mismo para el mismo tipo, sin numerar. */
export const MARCADORES: Readonly<Record<TipoDatoPersonal, string>> = {
  correo: "[correo]",
  telefono: "[teléfono]",
  cedula: "[cédula]",
  rif: "[RIF]",
  direccion: "[dirección]",
};

/**
 * Las palabras de calle. La expresión general pide un número a menos de 30 caracteres; «casa» y «torre» van aparte
 * porque son palabras comunes y solo cuentan con el número (o la letra de la torre) justo después. `tapar-datos.ts`
 * usa la lista completa para estirar una dirección hacia atrás dentro de su frase.
 */
const CALLE = "calle|avenida|av\\.?|carrera|urbanizacion|urb\\.?|edificio|edif\\.?|residencias|apartamento|apto\\.?|sector|barrio|quinta|qta\\.?|manzana|parcela";
export const PALABRAS_DE_CALLE = new RegExp(`\\b(?:${CALLE}|casa|torre)(?![a-z])`, "g");

/** Ni una letra ni un dígito justo antes: un número pegado a otro texto es una guía o un código, no un dato. */
const BORDE = "(?<![a-z0-9])";
/** Una cédula de 6 a 9 dígitos, con o sin puntos de miles. */
const NUMERO_CEDULA = "(?:\\d{1,3}(?:\\.\\d{3}){1,2}|\\d{6,9})(?![0-9])";

export const PATRONES_DATOS_PERSONALES: ReadonlyArray<{ tipo: TipoDatoPersonal; re: RegExp }> = [
  // Correo.
  { tipo: "correo", re: /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/ },
  // Móvil de Venezuela con 0 o con 58: 0414-555-1234, (0412) 555.12.34, +58 414 555 1234, 58-424-5551234.
  {
    tipo: "telefono",
    re: new RegExp(`${BORDE}(?:\\+?58[\\s.-]?\\(?0?|\\(?0)4(?:12|14|16|22|24|26)\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{2}(?!\\d)`),
  },
  // Móvil sin el 0: solo separado (414-555-1234). «4141234567» suelto puede ser una guía.
  { tipo: "telefono", re: new RegExp(`(?<![a-z0-9+])4(?:12|14|16|22|24|26)[\\s.-]\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{2}(?!\\d)`) },
  // Fijo de Venezuela: (0212) 555 01 01, 0212-555-0101, 0241-555-0101, +58 212…
  {
    tipo: "telefono",
    re: new RegExp(`${BORDE}(?:\\+?58[\\s.-]?\\(?0?|\\(?0)2\\d{2}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{2}(?!\\d)`),
  },
  // Internacional con prefijo (la regla de noticias) y agrupado como los móviles de China (+86 138 1234 5678).
  { tipo: "telefono", re: /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}/ },
  { tipo: "telefono", re: /\+\d{1,3}(?:[\s.-]?\d){8,13}(?!\d)/ },
  // Cédula con letra: V-12.345.678, E 1234567.
  { tipo: "cedula", re: new RegExp(`${BORDE}[ve][\\s.-]?\\d{1,2}\\.?\\d{3}\\.?\\d{3}(?![0-9])`) },
  // Cédula con «C.I.» o «CI»: C.I. 12.345.678, CI: 12345678.
  { tipo: "cedula", re: new RegExp(`\\bc\\.?\\s?i\\.?\\s*:?\\s*(?:n[°o.]*\\s*)?${NUMERO_CEDULA}`) },
  // Cédula detrás de la palabra, entera: «cédula 12.345.678», «cédula de identidad N° …», «mi cédula es V-…».
  {
    tipo: "cedula",
    re: /\bcedula\s*(?:de identidad)?\s*(?:(?:es|n[°o.]?|numero|nro\.?)\s*)*:?\s*(?:[ve][\s.-]?)?\d(?:[.-]?\d)*/,
  },
  // RIF: J-30123456-7, J-1234567-8, J-12.345.678-9. Va después de la cédula: si cubren lo mismo, gana la cédula.
  { tipo: "rif", re: new RegExp(`${BORDE}[jgvep][\\s-]?(?:\\d{7,8}|\\d{1,2}\\.\\d{3}\\.\\d{3})[\\s-]?\\d(?![0-9])`) },
  // Dirección: la palabra de calle y un número cerca.
  { tipo: "direccion", re: new RegExp(`\\b(?:${CALLE})\\s+[^\\n]{0,30}?\\d`) },
  // «casa 12», «Casa N.º 14».
  { tipo: "direccion", re: /\bcasa\s+(?:n[°o.]*\s*)?\d/ },
  // «torre B», «torre 2».
  { tipo: "direccion", re: /\btorre\s+(?:[a-z]|\d+)\b/ },
];

/** ¿El texto trae un correo, teléfono, cédula, RIF o dirección? */
export function hayDatosPersonales(texto: string): boolean {
  const t = normalizarTexto(texto);
  return PATRONES_DATOS_PERSONALES.some(({ re }) => re.test(t));
}

/** ¿El texto trae alguno de los marcadores? Un borrador no debería: sería un dato tapado que el agente repitió. */
export function tieneMarcador(texto: string): boolean {
  return Object.values(MARCADORES).some((m) => texto.includes(m));
}
