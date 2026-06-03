/**
 * Comparación de nombres / razón social (SDD-0046 · Slice A).
 *
 * El motor de verificación de identidad coteja el nombre que el cliente cargó
 * (`clients.name`) contra el nombre/razón social que devolvió el registro oficial
 * (CNE para persona, SENIAT para empresa → `doc_registry_name`). Como ambos lados
 * son texto libre ingresado por humanos (acentos, orden invertido, "C.A.", segundo
 * apellido, apellido de casada, typos), la comparación tiene que ser TOLERANTE.
 *
 * Decisión de diseño clave (review CEO): el resultado es **advisory**, NO un gate.
 * Por eso el umbral es **conservador** — favorece 'ok' y solo declara 'mismatch'
 * cuando hay divergencia clara. Un falso 'mismatch' molesta al asesor y desconfía
 * de un cliente legítimo; un falso 'ok' simplemente no levanta la alerta (y el
 * asesor igual ve ambos nombres lado a lado en la card → puede marcar manual).
 *
 * Estas funciones son PURAS (sin I/O). No hay normalizador de nombres reutilizable
 * en `lib/`: el único parecido es el `normalize()` PRIVADO de
 * `lib/studio/comments/mention-parse.ts`, pero está acotado a tokens de @mención
 * (no quita sufijos societarios ni ordena tokens), así que acá va uno propio.
 */

export type NameVerdict = "ok" | "mismatch";

export type NameComparison = {
  /** Similitud 0..1 (Jaccard de tokens significativos). */
  score: number;
  verdict: NameVerdict;
};

/**
 * Sufijos / ruido societario que NO aportan a la identidad de la razón social.
 * Se remueven antes de comparar para que "ACME C.A." matchee "ACME". Cubrimos las
 * formas más comunes en Venezuela (con y sin puntos, mono/multi palabra).
 *
 * Las multi-palabra se borran ANTES de tokenizar (son frases); las de una palabra
 * se filtran como stop-tokens después.
 */
const SOCIETARIO_PHRASES = [
  "COMPANIA ANONIMA",
  "COMPAÑIA ANONIMA",
  "SOCIEDAD ANONIMA",
  "SOCIEDAD DE RESPONSABILIDAD LIMITADA",
  "RESPONSABILIDAD LIMITADA",
  "SOCIEDAD CIVIL",
  "FIRMA PERSONAL",
];

const SOCIETARIO_TOKENS = new Set([
  "CA", // C.A.
  "SA", // S.A.
  "SRL", // S.R.L.
  "RL",
  "SC", // S.C.
  "FP",
  "CIA",
  "COMPANIA",
  "COMPAÑIA",
  "ANONIMA",
  "SOCIEDAD",
  "INC",
  "LTD",
  "LTDA",
  "CORP",
  "LLC",
]);

/**
 * Quita diacríticos (NFD + strip de combining marks) y la Ñ → N para que
 * "NÚÑEZ" y "NUNEZ" colapsen. Mayúsculas.
 */
function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas combinantes (acentos)
    .replace(/ñ/gi, "n")
    .toUpperCase();
}

/**
 * Normaliza un nombre / razón social para comparar:
 *   1. uppercase + sin acentos (Ñ→N).
 *   2. saca puntos (para que "C.A." → "CA", "S.A." → "SA").
 *   3. borra frases societarias multi-palabra ("COMPAÑIA ANONIMA", …).
 *   4. reemplaza separadores no alfanuméricos por espacio y colapsa espacios.
 *   5. tokeniza, filtra stop-tokens societarios de una palabra (CA/SA/SRL/…).
 *   6. ordena los tokens alfabéticamente (orden de nombre/apellido no importa).
 *
 * Devuelve los tokens significativos unidos por un espacio (string canónico).
 * "Acosta, María C.A."  y  "MARIA  ACOSTA"  → ambos "ACOSTA MARIA".
 */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";

  // 1-2. uppercase, sin acentos, sin puntos (C.A. → CA, J.PEREZ → JPEREZ no:
  //      borramos el punto como separador interno de sigla, no como espacio).
  let work = stripDiacritics(s).replace(/\./g, "");

  // 3. borra frases societarias multi-palabra (ya en uppercase sin acentos).
  for (const phrase of SOCIETARIO_PHRASES) {
    const cleanedPhrase = stripDiacritics(phrase).replace(/\./g, "");
    work = work.replace(new RegExp(`\\b${cleanedPhrase}\\b`, "g"), " ");
  }

  // 4. cualquier cosa no alfanumérica → espacio; colapsar.
  work = work.replace(/[^A-Z0-9]+/g, " ").trim();
  if (work.length === 0) return "";

  // 5. tokens significativos (saca stop-tokens societarios de 1 palabra).
  const tokens = work
    .split(/\s+/)
    .filter((t) => t.length > 0 && !SOCIETARIO_TOKENS.has(t));

  // Si después de filtrar no queda nada (era puro ruido), conservar el original
  // tokenizado para no devolver "" (mejor comparar algo que nada).
  const finalTokens = tokens.length > 0 ? tokens : work.split(/\s+/);

  // 6. orden alfabético: el orden nombre/apellido no debe afectar el match.
  return [...finalTokens].sort().join(" ");
}

/** Tokens normalizados (set) de un nombre. */
function tokenSet(s: string | null | undefined): Set<string> {
  const norm = normalizeName(s);
  if (norm.length === 0) return new Set();
  return new Set(norm.split(" "));
}

/**
 * Jaccard sobre tokens: |A ∩ B| / |A ∪ B|. 1 = idénticos, 0 = sin tokens comunes.
 * Se usa Jaccard (no containment) para que "MARIA" vs "MARIA JOSE PEREZ GOMEZ"
 * NO dé 1.0 trivial, pero tampoco castigue tanto a un subconjunto razonable.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * UMBRAL CONSERVADOR.
 *
 * El verdict es 'mismatch' SOLO cuando el score cae por debajo de este piso. Está
 * deliberadamente BAJO (0.34) para que nombres compuestos venezolanos, apellido de
 * casada, segundo apellido o un typo aislado NO disparen un falso 'mismatch':
 *
 *   - "MARIA PEREZ" vs "MARIA J PEREZ GOMEZ"
 *       tokens A={MARIA,PEREZ} B={GOMEZ,J,MARIA,PEREZ}; inter=2 union=4 → 0.50 → ok.
 *   - "JOSE GARCIA" vs "JOSE LUIS GARCIA RODRIGUEZ DE PEREZ" (casada + 2º apellido)
 *       inter=2, union=6 → 0.33 → quedaría debajo; por eso además aplicamos una
 *       regla de rescate: si TODOS los tokens del lado más corto están contenidos
 *       en el lado largo (es un subconjunto exacto), es 'ok' aunque el Jaccard baje.
 *
 * Resultado: 'mismatch' solo cuando hay tokens que NO coinciden en ambos lados
 * (divergencia real: "MARIA PEREZ" vs "PEDRO GOMEZ" → inter=0 → 0.0 → mismatch).
 */
export const NAME_MATCH_THRESHOLD = 0.34;

/**
 * Compara dos nombres / razones sociales y devuelve { score, verdict }.
 *
 * - score: Jaccard 0..1 de los tokens normalizados.
 * - verdict: 'ok' si score ≥ NAME_MATCH_THRESHOLD **o** si un lado es subconjunto
 *   exacto del otro (rescate para nombres extendidos / casada); 'mismatch' en otro
 *   caso (divergencia clara de tokens).
 *
 * Ambos vacíos o solo uno vacío: no hay base para afirmar divergencia → 'ok' con
 * score 0 (no es trabajo de esta función inventar un mismatch sin datos; el motor
 * decide 'unavailable' aguas arriba cuando falta el nombre del registro).
 */
export function compareNames(
  a: string | null | undefined,
  b: string | null | undefined,
): NameComparison {
  const setA = tokenSet(a);
  const setB = tokenSet(b);

  // Sin tokens de algún lado → no afirmamos divergencia.
  if (setA.size === 0 || setB.size === 0) {
    return { score: 0, verdict: "ok" };
  }

  const score = jaccard(setA, setB);

  // Rescate: si el lado más chico está 100% contenido en el grande, es la misma
  // persona con nombre extendido (2º apellido, apellido de casada, inicial).
  const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  let subset = true;
  for (const t of small) {
    if (!big.has(t)) {
      subset = false;
      break;
    }
  }

  const verdict: NameVerdict =
    subset || score >= NAME_MATCH_THRESHOLD ? "ok" : "mismatch";

  return { score, verdict };
}
