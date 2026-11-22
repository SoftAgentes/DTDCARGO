/**
 * SDD-0638 §5.1 · El clasificador de errores de los proveedores de IA. Módulo PURO: sin red, sin base, sin React.
 *
 * Recibe el proveedor, la función, el status HTTP o el tipo de fallo, el código estructurado del cuerpo y un extracto
 * corto del texto, y devuelve `{ clase, proveedor, operacion, status, codigo }`. NUNCA devuelve el cuerpo ni el
 * texto: el cuerpo de un error puede traer el id o el correo de la cuenta.
 *
 * Precedencia fija: primero el código estructurado, luego el status y por último el texto.
 *
 * El catálogo de señales de cada proveedor vive aquí, en un solo lugar. Los códigos y textos exactos salen de la
 * documentación de cada proveedor y quedan **NV** hasta verlos en un error real (0638 §5.1).
 */

export const CLASES = [
  "falta_de_pago",
  "cuenta_suspendida",
  "llave_invalida",
  "limite_de_uso",
  "proveedor_caido",
  "otro",
] as const;
export type Clase = (typeof CLASES)[number];

/** Tipo de fallo sin respuesta HTTP. */
export type Fallo = "tiempo_agotado" | "conexion";

export interface EntradaDelError {
  proveedor: string;
  /** La función que llamó (por ejemplo `a1_noticias`). */
  operacion: string;
  status?: number | null;
  fallo?: Fallo | null;
  /** El código estructurado del cuerpo (`error.type` o `error.code`). */
  codigo?: string | null;
  /** Un extracto corto del texto, solo para buscar señales. Nunca sale del clasificador. */
  texto?: string | null;
}

export interface ErrorClasificado {
  clase: Clase;
  proveedor: string;
  operacion: string;
  status: number | null;
  /** El código, normalizado a un identificador corto; null si no era un código. */
  codigo: string | null;
}

interface Senales {
  /** Códigos estructurados de saldo o de pago. */
  codigosDePago: readonly string[];
  /** Códigos de cuenta suspendida o desactivada. */
  codigosDeSuspension: readonly string[];
  /** Textos de saldo (en minúsculas). */
  textosDePago: readonly string[];
  /** Textos de suspensión o de facturación (en minúsculas). */
  textosDeSuspension: readonly string[];
}

/** NV: confirmados con la documentación pública de cada proveedor, no con un error real. */
const SENALES: Readonly<Record<string, Senales>> = {
  anthropic: {
    codigosDePago: ["billing_error"],
    codigosDeSuspension: [],
    textosDePago: ["credit balance is too low", "insufficient credit"],
    textosDeSuspension: ["account has been disabled", "organization has been disabled", "account is suspended"],
  },
  openai: {
    codigosDePago: ["insufficient_quota", "billing_hard_limit_reached"],
    codigosDeSuspension: ["account_deactivated", "billing_not_active"],
    textosDePago: ["exceeded your current quota", "insufficient_quota"],
    textosDeSuspension: ["account has been deactivated", "account is not active"],
  },
  zai: {
    codigosDePago: ["1113", "insufficient_balance"],
    codigosDeSuspension: [],
    textosDePago: ["余额不足", "insufficient balance"],
    textosDeSuspension: ["账户已被禁用", "account has been disabled"],
  },
  deepseek: {
    codigosDePago: ["insufficient_balance"],
    codigosDeSuspension: [],
    textosDePago: ["insufficient balance", "余额不足"],
    textosDeSuspension: ["account has been disabled"],
  },
};

const SIN_SENALES: Senales = { codigosDePago: [], codigosDeSuspension: [], textosDePago: [], textosDeSuspension: [] };

/** Un código estructurado se queda solo si parece un identificador (nunca texto libre ni algo con forma de llave). */
function normalizarCodigo(codigo: string | null | undefined): string | null {
  if (typeof codigo !== "string") return null;
  const c = codigo.trim().toLowerCase();
  if (!/^[a-z0-9_.:-]{1,64}$/.test(c)) return null;
  // Una cadena larga de hex o base64 podría ser una llave o un id de cuenta: no sale.
  if (c.length > 24 && /^[a-z0-9_-]+$/.test(c) && /\d/.test(c) && !c.includes("_error")) return null;
  return c;
}

function contieneAlguno(texto: string, frases: readonly string[]): boolean {
  return frases.some((f) => texto.includes(f));
}

export function clasificarError(e: EntradaDelError): ErrorClasificado {
  const senales = SENALES[e.proveedor] ?? SIN_SENALES;
  const status = typeof e.status === "number" && Number.isInteger(e.status) ? e.status : null;
  const codigo = normalizarCodigo(e.codigo);
  // El texto se recorta y se pasa a minúsculas solo para buscar señales; nunca se devuelve.
  const texto = typeof e.texto === "string" ? e.texto.slice(0, 500).toLowerCase() : "";

  const salida = (clase: Clase): ErrorClasificado => ({ clase, proveedor: e.proveedor, operacion: e.operacion, status, codigo });

  // 1. El código estructurado.
  if (codigo && senales.codigosDePago.includes(codigo)) return salida("falta_de_pago");
  if (codigo && senales.codigosDeSuspension.includes(codigo)) return salida("cuenta_suspendida");

  // 2. El status (con las señales de texto que la tabla de §5.1 exige para cada caso).
  if (status === 402) return salida("falta_de_pago");
  if (status !== null && (status === 400 || status === 429) && contieneAlguno(texto, senales.textosDePago)) {
    return salida("falta_de_pago");
  }
  if (status === 401 || status === 403) {
    if (contieneAlguno(texto, senales.textosDeSuspension)) return salida("cuenta_suspendida");
    if (contieneAlguno(texto, senales.textosDePago)) return salida("falta_de_pago");
    return salida(status === 401 ? "llave_invalida" : "otro");
  }
  if (status === 429) return salida("limite_de_uso");
  if (status !== null && status >= 500 && status <= 599) return salida("proveedor_caido");

  // 3. Sin status: el tipo de fallo.
  if (status === null && (e.fallo === "tiempo_agotado" || e.fallo === "conexion")) return salida("proveedor_caido");

  // 4. El texto, cuando no hubo otra pista.
  if (status === null && contieneAlguno(texto, senales.textosDePago)) return salida("falta_de_pago");

  return salida("otro");
}

/**
 * Las clases con las que la cadena salta al siguiente puesto (SDD-0704 §4.1). `limite_de_uso` y `otro` no saltan:
 * el primero se reintenta donde la función ya reintenta y el segundo recibiría la misma entrada mala.
 */
export const CLASES_QUE_SALTAN: ReadonlySet<Clase> = new Set<Clase>([
  "proveedor_caido",
  "falta_de_pago",
  "cuenta_suspendida",
  "llave_invalida",
]);

export function salta(clase: Clase): boolean {
  return CLASES_QUE_SALTAN.has(clase);
}

/**
 * Lo que trae un error del SDK de Anthropic (`APIError`, `APIConnectionError`, `APIConnectionTimeoutError`), leído
 * por forma, sin importar el SDK: `status`, `error.error.type` y el nombre de la clase. El mensaje solo se usa para
 * buscar señales.
 */
export function entradaDesdeErrorAnthropic(err: unknown, operacion: string): EntradaDelError {
  const o = (err && typeof err === "object" ? err : {}) as Record<string, unknown>;
  const status = typeof o.status === "number" ? o.status : null;
  const cuerpo = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : null;
  const interno = cuerpo?.error && typeof cuerpo.error === "object" ? (cuerpo.error as Record<string, unknown>) : null;
  const tipo = typeof interno?.type === "string" ? interno.type : typeof cuerpo?.type === "string" ? cuerpo.type : null;
  const nombre = err instanceof Error ? err.name : typeof o.name === "string" ? o.name : "";
  const fallo: Fallo | null = status !== null ? null
    : /timeout/i.test(nombre) ? "tiempo_agotado"
    : /connection/i.test(nombre) ? "conexion"
    : null;
  const texto = err instanceof Error ? err.message : typeof o.message === "string" ? o.message : null;
  return { proveedor: "anthropic", operacion, status, fallo, codigo: tipo, texto };
}
