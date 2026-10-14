/**
 * Reglas del PIN de operario de las apps del teléfono (/m/cn, /m/ve) · SDD-0513.
 *
 * Módulo PURO y apto para el cliente: no importa `node:crypto`. El sorteo con
 * entropía real vive en `operario-pin-generator.ts` (server-only), que inyecta
 * `crypto.randomInt` en `drawOperarioPin`.
 *
 * ESPEJO DE LA BASE. `operarioPinProblem` replica la ÚLTIMA definición de
 * `public.validate_operario_pin_format` (0037, reafirmada sin cambios en 0271,
 * 0280, 0287 y 0288): 4 dígitos ASCII y fuera de una lista de 24 PIN comunes.
 * La base sigue siendo la autoridad —la RPC `admin_reset_operario_pin` vuelve a
 * validar—; este espejo existe para que el generador nunca proponga un PIN que
 * la base rechazaría, y para que el Studio explique el rechazo con tuteo (el
 * mensaje de la base dice «Elegí», con voseo). La prueba
 * `lib/studio/__tests__/operario-pin.migration.test.ts` corre la función SQL
 * real sobre los 10.000 PIN posibles y exige que ambos lados coincidan.
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
