/**
 * Reglas del PIN de operario de las apps del teléfono (/m/cn, /m/ve) · SDD-0513.
 *
 * Módulo PURO y apto para el cliente: no importa `node:crypto`. El sorteo con
 * entropía real vive en `operario-pin-generator.ts` (server-only), que inyecta
 * `crypto.randomInt` en `drawOperarioPin`.
 *
 * ESPEJO DE LA BASE. `operarioPinProblem` replica la ÚLTIMA definición de
 * `public.validate_operario_pin_format` (0037, reafirmada sin cambios en 0271,
 * 0280, 0287 y 0288, y reescrita por 0475 sólo para pasar su mensaje a tuteo):
 * 4 dígitos ASCII y fuera de una lista de 24 PIN comunes.
 * La base sigue siendo la autoridad —la RPC `admin_reset_operario_pin` vuelve a
 * validar—; este espejo existe para que el generador nunca proponga un PIN que
 * la base rechazaría, y para que el Studio explique el rechazo con su copy
 * (hasta que se aplique 0475, el mensaje de la base dice «Elegí», con voseo).
 * La prueba `lib/studio/__tests__/operario-pin.migration.test.ts` corre la
 * función SQL real sobre los 10.000 PIN posibles y exige que ambos lados
 * coincidan.
 *
 * PIN REPETIDO (SDD-0515, migr 0475). Lo que este espejo NO puede saber es si
 * otro operario activo del mismo tenant y región ya usa el PIN: eso sólo lo ve
 * la base, comparando contra cada bcrypt. La RPC lo rechaza con
 * `OPERARIO_PIN_IN_USE_CODE`; `saveWithFreshOperarioPin` sortea otro y vuelve a
 * intentar cuando el PIN lo puso el servidor.
 *
 * MOTIVO (SDD-0515). Alta, restablecimiento y «Ver PIN» exigen un motivo que va
 * a la auditoría. `operarioMotivoProblem` es el espejo de
 * `operario_motivo_valido`: avisa antes de llamar a la base, que es la que manda.
 */

export const OPERARIO_PIN_LENGTH = 4;

/** Cantidad de valores posibles de 4 dígitos (0000–9999). */
export const OPERARIO_PIN_SPACE = 10_000;

/** Los 24 PIN que rechaza `validate_operario_pin_format` por comunes. */
export const OPERARIO_PIN_BLACKLIST: ReadonlySet<string> = new Set([
  // Repetidos: 10
  "0000", "1111", "2222", "3333", "4444",
  "5555", "6666", "7777", "8888", "9999",
  // Secuenciales: 4
  "1234", "4321", "0123", "0987",
  // Patrones tipo fecha o teclado: 10
  "1212", "2121", "0101", "1010", "1313",
  "6969", "2580", "1357", "2468", "1379",
]);

export type OperarioPinProblem = "format" | "common";

/** `null` si la base aceptaría el PIN; si no, el motivo del rechazo. */
export function operarioPinProblem(pin: string): OperarioPinProblem | null {
  if (!/^[0-9]{4}$/.test(pin)) return "format";
  if (OPERARIO_PIN_BLACKLIST.has(pin)) return "common";
  return null;
}

export function isValidOperarioPin(pin: string): boolean {
  return operarioPinProblem(pin) === null;
}

/** Copy del Studio para cada motivo (tuteo, sin voseo). */
export const OPERARIO_PIN_PROBLEM_MESSAGE: Record<OperarioPinProblem, string> = {
  format: "El PIN tiene que ser de 4 dígitos.",
  common: "Ese PIN es muy fácil de adivinar. Usa otro o genera uno nuevo.",
};

/**
 * Fuente de enteros uniformes en [min, max). Con `crypto.randomInt` de Node el
 * máximo es EXCLUSIVO; por eso se pide (0, 10000) y no (0, 9999).
 */
export type RandomIntSource = (min: number, max: number) => number;

/**
 * Tope de sorteos antes de rendirse. Con 24 de 10.000 valores rechazados, la
 * probabilidad de agotarlo con una fuente sana es (24/10000)^64: no ocurre.
 * Agotarlo indica una fuente rota, y entonces se falla cerrado en vez de
 * devolver un PIN débil.
 */
export const OPERARIO_PIN_MAX_DRAWS = 64;

/**
 * Sortea un PIN válido por MUESTREO DE RECHAZO: se pide un entero uniforme en
 * 0–9999 y se descarta si la base lo rechazaría. Descartar (y no «corregir» el
 * valor, por ejemplo sumándole 1) conserva la distribución uniforme sobre los
 * 9.976 PIN válidos.
 */
export function drawOperarioPin(randomInt: RandomIntSource): string {
  for (let i = 0; i < OPERARIO_PIN_MAX_DRAWS; i++) {
    const n = randomInt(0, OPERARIO_PIN_SPACE);
    const pin = String(n).padStart(OPERARIO_PIN_LENGTH, "0");
    if (isValidOperarioPin(pin)) return pin;
  }
  throw new Error("No se pudo generar un PIN válido: la fuente de azar falló.");
}

// ─── PIN repetido en el tenant y la región (SDD-0515, migr 0475) ────────────

/**
 * SQLSTATE con que `admin_reset_operario_pin` y `admin_create_operario`
 * rechazan un PIN que ya usa otro operario ACTIVO del mismo tenant y región.
 * El login (0325) exige una sola coincidencia: un PIN repetido dejaría fuera a
 * los dos operarios.
 */
export const OPERARIO_PIN_IN_USE_CODE = "P0018";

/** Copy del Studio para ese rechazo: el mismo texto que da la base, en tuteo. */
export const OPERARIO_PIN_IN_USE_MESSAGE =
  "Ese PIN ya lo usa otro operario activo de la misma región. Usa otro o genera uno nuevo.";

export function isOperarioPinInUse(error: { code?: string } | null | undefined): boolean {
  return error?.code === OPERARIO_PIN_IN_USE_CODE;
}

// ─── Motivo, «Ver PIN» y reactivación (SDD-0515, migr 0475) ─────────────────

/** SQLSTATE del motivo inválido (vacío, corto, largo o con el PIN adentro). */
export const OPERARIO_MOTIVO_CODE = "P0020";
/** SQLSTATE de activar con el toggle a un operario de baja: hay que darle PIN nuevo. */
export const OPERARIO_REACTIVAR_CODE = "P0019";

/** Límites del motivo: los mismos que `operario_motivo_valido` en la base. */
export const OPERARIO_MOTIVO_MIN = 4;
export const OPERARIO_MOTIVO_MAX = 300;

export type OperarioMotivoProblem = "length" | "contains_pin";

/** Copy del Studio para cada motivo inválido: el mismo texto que da la base. */
export const OPERARIO_MOTIVO_MESSAGE: Record<OperarioMotivoProblem, string> = {
  length: "Escribe el motivo: entre 4 y 300 caracteres.",
  contains_pin: "No escribas el PIN en el motivo: queda en la auditoría.",
};

/**
 * `null` si la base aceptaría el motivo; si no, el problema. El motivo va a la
 * auditoría: se mide recortado y no puede llevar el PIN que se está guardando.
 */
export function operarioMotivoProblem(motivo: string, pin?: string | null): OperarioMotivoProblem | null {
  // Igual que la base: btrim() sin segundo argumento sólo quita espacios, y
  // char_length() cuenta caracteres, no unidades UTF-16 (un emoji es uno).
  const trimmed = motivo.replace(/^ +| +$/g, "");
  const length = [...trimmed].length;
  if (length < OPERARIO_MOTIVO_MIN || length > OPERARIO_MOTIVO_MAX) return "length";
  if (pin && trimmed.includes(pin)) return "contains_pin";
  return null;
}

export function isOperarioMotivoRejected(error: { code?: string } | null | undefined): boolean {
  return error?.code === OPERARIO_MOTIVO_CODE;
}

/**
 * Respuesta de `viewOperarioPinAction`. `pin: null` = PIN anterior a 0475, que
 * no tiene copia cifrada. `fieldError` marca el campo a corregir en el diálogo.
 */
export type ViewPinResult =
  | { ok: true; pin: string | null }
  | { ok?: undefined; error: string; fieldError?: "motivo" };

/** «Ver PIN» de un operario cuyo PIN se guardó antes de 0475 (no hay copia cifrada). */
export const OPERARIO_PIN_LEGACY_MESSAGE =
  "Este PIN es anterior al cambio: restablécelo una vez para poder verlo.";

/**
 * Intentos de guardar un PIN sorteado mientras la base diga que está repetido.
 * Con k operarios activos en el tenant y la región, cada intento choca con
 * probabilidad k/9.976: con k = 50, cinco choques seguidos son ~(0,005)^5.
 * Agotarlos no se esconde: vuelve el rechazo de la base.
 */
export const OPERARIO_PIN_MAX_ATTEMPTS = 5;

/**
 * El PIN guardado, o el último rechazo de la base sin PIN: nunca se devuelve
 * uno rechazado. `attempts` cuenta los PIN distintos que se le propusieron.
 */
export type OperarioPinSave<E> =
  | { pin: string; error: null; attempts: number }
  | { pin: null; error: E; attempts: number };

/**
 * Sortea un PIN, lo guarda y, si la base contesta que otro operario activo del
 * mismo tenant y región ya lo usa, sortea OTRO distinto y vuelve a intentar,
 * hasta `maxAttempts`. Cualquier otro error corta en el acto: reintentar no lo
 * arregla y un rechazo de permiso no debe convertirse en N llamadas. Un PIN que
 * la base rechazó no se vuelve a proponer ni sale en el resultado.
 */
export async function saveWithFreshOperarioPin<E extends { code?: string }>(
  draw: () => string,
  save: (pin: string) => PromiseLike<{ error: E | null }>,
  maxAttempts: number = OPERARIO_PIN_MAX_ATTEMPTS,
): Promise<OperarioPinSave<E>> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts tiene que ser un entero positivo.");
  }
  const tried = new Set<string>();
  let error: E | null = null;
  let pin = "";
  while (tried.size < maxAttempts) {
    pin = draw();
    for (let i = 0; tried.has(pin) && i < OPERARIO_PIN_MAX_DRAWS; i++) pin = draw();
    if (tried.has(pin)) {
      throw new Error("No se pudo generar un PIN distinto: la fuente de azar falló.");
    }
    tried.add(pin);
    ({ error } = await save(pin));
    if (!isOperarioPinInUse(error)) break;
  }
  return error
    ? { pin: null, error, attempts: tried.size }
    : { pin, error: null, attempts: tried.size };
}
