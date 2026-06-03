/**
 * Helpers de documento de identidad venezolano (SDD-0046 · Slice A).
 *
 * El número de documento del cliente se guarda en `clients.rif`:
 *   - persona  → cédula (prefijo V-/E- + dígitos; el RIF de persona natural ES su
 *                cédula, por eso también empieza con V).
 *   - empresa  → RIF (prefijo J-/G- + dígitos + dígito verificador).
 *
 * Para clasificar el TIPO de documento la única señal robusta es el prefijo:
 *   J / G  → empresa (RIF de persona jurídica / gobierno)
 *   V / E / sin-prefijo-pero-numérico → persona (cédula venezolana / extranjera)
 *
 * Estos helpers son PUROS (sin I/O): testeables sin DB. Sirven de base para:
 *   - el backfill de `clients.doc_kind` (migración 0092),
 *   - el ruteo del motor de verificación (CNE para persona / SENIAT para empresa),
 *   - extraer el número limpio que pide el CNE (sin puntos/guiones).
 *
 * NO hacen llamadas externas (eso es Slice B/C).
 */

export type DocumentKind = "persona" | "empresa";
export type DocumentClass = DocumentKind | "unknown";

export type CedulaParts = {
  /** Nacionalidad de la cédula: V (venezolano) o E (extranjero). */
  nationality: "V" | "E";
  /** Número de cédula limpio (sin puntos, sin guiones, sin prefijo). */
  number: string;
};

/**
 * Saca espacios, puntos y guiones de un documento crudo y lo pone en mayúsculas.
 * `"v-12.345.678"` → `"V12345678"`. No valida; solo limpia para inspeccionar.
 */
function cleanDoc(raw: string): string {
  return raw.replace(/[\s.\-_]/g, "").toUpperCase();
}

/**
 * Clasifica un documento (lo que vive en `clients.rif`) en persona | empresa | unknown.
 *
 * Reglas (por prefijo, que es la única señal confiable):
 *   - J / G  → 'empresa' (RIF de persona jurídica o ente gubernamental).
 *   - V / E  → 'persona' (cédula venezolana o de extranjero residente).
 *   - sin prefijo de letra pero con dígitos → 'persona' (cédula pelada).
 *   - null / vacío / sin dígitos → 'unknown'.
 *
 * Nota: el RIF de persona natural empieza con V (= su cédula), por eso V/E caen
 * en 'persona' y solo J/G marcan empresa. Casos raros (P/C/etc.) → 'unknown'.
 */
export function classifyDocument(rif: string | null | undefined): DocumentClass {
  if (!rif) return "unknown";
  const cleaned = cleanDoc(rif);
  if (cleaned.length === 0) return "unknown";

  const head = cleaned[0];
  if (head === "J" || head === "G") return "empresa";
  if (head === "V" || head === "E") return "persona";

  // Sin prefijo de letra: si arranca con dígito y tiene dígitos, asumimos cédula.
  if (/^\d/.test(cleaned)) return "persona";

  // Cualquier otra letra de prefijo (P pasaporte, C, etc.) no es clasificable acá.
  return "unknown";
}

/**
 * Parsea un documento como CÉDULA (persona) y devuelve la nacionalidad + el número
 * limpio que pide el CNE. Devuelve null si no parsea como cédula.
 *
 * Acepta variantes con puntos / guiones / espacios y con o sin prefijo de letra:
 *   "V-12.345.678" → { nationality: 'V', number: '12345678' }
 *   "e 9.999.999"  → { nationality: 'E', number: '9999999' }
 *   "12345678"     → { nationality: 'V', number: '12345678' }  (default V)
 *
 * Devuelve null si:
 *   - es un RIF de empresa (J-/G-),
 *   - no tiene dígitos,
 *   - el número de dígitos queda fuera del rango plausible de una cédula (1..9).
 */
export function parseCedula(rif: string | null | undefined): CedulaParts | null {
  if (!rif) return null;
  const cleaned = cleanDoc(rif);
  if (cleaned.length === 0) return null;

  // RIF de empresa no es una cédula.
  if (cleaned[0] === "J" || cleaned[0] === "G") return null;

  // Nacionalidad: V/E explícita; default V cuando viene sin prefijo de letra.
  let nationality: "V" | "E" = "V";
  let rest = cleaned;
  if (cleaned[0] === "V" || cleaned[0] === "E") {
    nationality = cleaned[0] as "V" | "E";
    rest = cleaned.slice(1);
  } else if (/^[A-Z]/.test(cleaned)) {
    // Empieza con otra letra (P, C, …): no es cédula V/E.
    return null;
  }

  const number = rest.replace(/\D/g, "");
  if (number.length === 0) return null;
  // Una cédula venezolana tiene entre 1 y 8 dígitos (hoy ~9 a futuro). Cota laxa.
  if (number.length > 9) return null;

  return { nationality, number };
}
