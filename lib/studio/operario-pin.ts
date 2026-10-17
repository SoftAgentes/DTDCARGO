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
 * 4 dígitos ASCII y fuera de una lista de 24 PIN comunes. DRIFT: el cuerpo que
 * vive hoy en producción no es el del repo —no trae «0987» y repite «7777», 23
 * distintos (lectura del Director, 2026-10-14)—; 0475 lo acepta en su preflight
 * e instala esta lista de 24. Hasta aplicarla, el espejo es más estricto que la
 * base en un solo PIN («0987»), que nunca se propone: sin daño.
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
 * MOTIVO (SDD-0515). Alta, restablecimiento y «Ver PIN» exigen un motivo de una
 * lista fija, con texto sólo para «Otro», que va a la auditoría.
 * `operarioMotivoProblem` es el espejo de `operario_motivo_valido`: avisa antes
 * de llamar a la base, que es la que manda.
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

/** SQLSTATE del motivo inválido (código fuera de la lista, texto de «Otro» corto o largo, o con el PIN). */
export const OPERARIO_MOTIVO_CODE = "P0020";
/** SQLSTATE de activar con el toggle a un operario de baja: hay que darle PIN nuevo. */
export const OPERARIO_REACTIVAR_CODE = "P0019";
/** SQLSTATE de «Ver PIN» sin la contraseña confirmada hace 5 minutos o menos. */
export const OPERARIO_PASSWORD_CODE = "P0022";

/**
 * La lista fija de motivos (decisión de Sam: «Lista + «Otro» con texto»). Es el
 * espejo de `operario_motivo_valido` en 0475: la prueba PGlite las enfrenta.
 * El mismo campo sirve para el alta, el restablecimiento y «Ver PIN».
 */
export const OPERARIO_MOTIVOS = [
  { value: "olvido", label: "Se le olvidó" },
  { value: "empleado_nuevo", label: "Empleado nuevo" },
  { value: "revision_seguridad", label: "Revisión de seguridad" },
  { value: "otro", label: "Otro" },
] as const;

export type OperarioMotivoCodigo = (typeof OPERARIO_MOTIVOS)[number]["value"];

/** Límites del texto de «Otro»: los mismos que `operario_motivo_valido` en la base. */
export const OPERARIO_MOTIVO_TEXTO_MIN = 4;
export const OPERARIO_MOTIVO_TEXTO_MAX = 200;

export type OperarioMotivoProblem = "codigo" | "length" | "contains_pin";

/** Copy del Studio para cada motivo inválido: el mismo texto que da la base. */
export const OPERARIO_MOTIVO_MESSAGE: Record<OperarioMotivoProblem, string> = {
  codigo: "Elige un motivo de la lista.",
  length: "Escribe el motivo: entre 4 y 200 caracteres.",
  contains_pin: "No escribas el PIN en el motivo: queda en la auditoría.",
};

/** Lo que la base hace con el texto: btrim() sin segundo argumento sólo quita espacios. */
const btrim = (value: string) => value.replace(/^ +| +$/g, "");

/**
 * `null` si la base aceptaría el motivo; si no, el problema. El código se mide
 * sin mayúsculas ni espacios alrededor; el texto sólo cuenta para «Otro», se
 * mide recortado, en caracteres (char_length, no unidades UTF-16: un emoji es
 * uno) y no puede llevar el PIN que se está guardando o mostrando.
 */
export function operarioMotivoProblem(
  codigo: string | null | undefined,
  texto?: string | null,
  pin?: string | null,
): OperarioMotivoProblem | null {
  const normalized = btrim(codigo ?? "").toLowerCase();
  if (!OPERARIO_MOTIVOS.some((m) => m.value === normalized)) return "codigo";
  if (normalized !== "otro") return null;
  const trimmed = btrim(texto ?? "");
  const length = [...trimmed].length;
  if (length < OPERARIO_MOTIVO_TEXTO_MIN || length > OPERARIO_MOTIVO_TEXTO_MAX) return "length";
  if (pin && trimmed.includes(pin)) return "contains_pin";
  return null;
}

/**
 * «Ver PIN» pide otra vez la contraseña del Studio (decisión de Sam). Lo exige
 * la base: sin un `amr` `password` de hace 5 minutos o menos en el JWT responde
 * `OPERARIO_PASSWORD_CODE` con este mensaje.
 */
export const OPERARIO_PASSWORD_MESSAGE = "Confirma tu contraseña para ver el PIN.";

/** Copy de cada forma de no poder confirmar la contraseña (tuteo). */
export const OPERARIO_PASSWORD_FAILURE_MESSAGE = {
  empty: "Escribe tu contraseña del Studio.",
  invalid: "Esa contraseña no es la tuya. Revísala e inténtalo otra vez.",
  unavailable: "No se pudo confirmar tu contraseña. Inténtalo de nuevo en unos minutos.",
  mismatch: "No se pudo confirmar tu contraseña con tu sesión. Sal del Studio y vuelve a entrar.",
  noEmail: "Tu cuenta no tiene correo para confirmar la contraseña. Habla con un admin.",
} as const;

export function isOperarioPasswordRequired(error: { code?: string } | null | undefined): boolean {
  return error?.code === OPERARIO_PASSWORD_CODE;
}

// ─── Por qué app entra cada operario (hallazgo del 2026-10-14) ──────────────

export type OperarioRegion = "cn" | "ve";

/** El sitio donde viven las apps del teléfono. `||` y no `??`: una variable vacía también cae al default. */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com").replace(/\/+$/, "");
}

/**
 * La app del teléfono por la que entra el operario, según su región: un PIN de
 * China sólo entra por /m/cn/login y uno de Venezuela sólo por /m/ve/login
 * (verify_operario_pin compara dentro de tenant + región). El 2026-10-14 un
 * operario de China probó su PIN en /m/ve/login: la fila y el PIN lo dicen.
 */
export function operarioLoginUrl(region: OperarioRegion): string {
  return `${siteUrl()}/m/${region}/login`;
}

/** La misma ruta sin el protocolo, para leerla en una fila. */
export function operarioLoginLabel(region: OperarioRegion): string {
  return operarioLoginUrl(region).replace(/^https?:\/\//, "");
}

// ─── Rótulo del rol del operario ─────────────────────────────────────────────

export type OperarioRol = "operario" | "supervisor" | "bodeguero" | "camionero";

const ROL_LABEL: Record<OperarioRol, string> = {
  operario: "Operario",
  supervisor: "Supervisor",
  bodeguero: "Bodeguero",
  camionero: "Camionero",
};

/** Rótulo del rol; uno que no conozca la lista se muestra tal cual, no como «Operario». */
export function operarioRolLabel(role: string): string {
  return ROL_LABEL[role as OperarioRol] ?? role;
}

/** ¿Es uno de los cuatro roles de `operario_pins_role_check`? (SDD-0529) */
export function isOperarioRol(value: unknown): value is OperarioRol {
  return typeof value === "string" && Object.hasOwn(ROL_LABEL, value);
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
  | { ok?: undefined; error: string; fieldError?: "motivo" | "password" };

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
