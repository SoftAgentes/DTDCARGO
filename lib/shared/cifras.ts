/**
 * Cifras tecleadas por una persona: un solo lugar para interpretarlas
 * (SDD-0687 §4.2 y §4.3, fases 1 y 2).
 *
 * Regla de Sam (2026-11-20): «la coma siempre va a ser los decimales» y, ante
 * «1.234» en dinero, «pedir que se aclare». El sistema nunca adivina un monto.
 *
 * Cada campo declara su modo; no hay modo por defecto, para que nadie lo
 * olvide (§4.2):
 *
 * | Modo        | Decimales | Separador único + tres cifras                 |
 * |-------------|-----------|-----------------------------------------------|
 * | dinero      | 2         | se rechaza y se pide aclarar (punto o coma)   |
 * | tasa        | 8         | coma = decimal; punto se rechaza y se aclara  |
 * | porcentaje  | 2, 0-100  | coma o punto = decimal; tres cifras no caben  |
 * | medida      | 4         | punto o coma = decimal (decisión 2 A)         |
 *
 * En dinero, «12.5» y «12.50» se aceptan como decimal (decisión 6 A): un punto
 * con una o dos cifras no puede ser de miles. «1,234.50» (formato de EE. UU.)
 * se rechaza en todos los modos: el formato es 1.234,50.
 *
 * La precisión máxima manda: un valor con más decimales que los del modo se
 * rechaza; no se redondea en silencio.
 *
 * Un campo de dinero que admite tres o más decimales (el precio por ft³ lleva
 * cuatro) lee «3,498» como decimal, porque la coma siempre es decimal. El punto
 * no: «3.498» sigue pidiendo aclarar, como en todo el dinero. El valor de
 * máquina que viaja oculto desde el campo («3.498») se lee con `parseMaquina`,
 * que no es la regla de lo que teclea una persona.
 *
 * Lo que devuelve es el valor de máquina (`1234.5`); mostrarlo con formato es
 * trabajo de los formateadores (fase 3). Este módulo vive en `lib/shared/`
 * porque lo usan la web pública, el Portal, el Studio y el móvil.
 */

export type ModoNumero = "dinero" | "tasa" | "porcentaje" | "medida";

export const MODOS_NUMERO: readonly ModoNumero[] = [
  "dinero",
  "tasa",
  "porcentaje",
  "medida",
] as const;

/** Decimales máximos que acepta cada modo al teclear (§4.2). */
export const DECIMALES_POR_MODO: Readonly<Record<ModoNumero, number>> = {
  dinero: 2,
  tasa: 8,
  porcentaje: 2,
  medida: 4,
};

export interface OpcionesNumero {
  /**
   * Decimales máximos de este campo, si difieren de los del modo (por
   * ejemplo, un peso con 3). No cambia la regla de ambigüedad del modo.
   */
  decimales?: number;
}

export type MotivoRechazo =
  /** No hay nada escrito. */
  | "vacio"
  /** Falta algo: «12,» o «1.234,». */
  | "incompleto"
  /** Caracteres o agrupación que no son una cifra en formato 1.234,50. */
  | "formato"
  /** Un separador único con tres cifras: puede ser miles o decimal. */
  | "ambiguo"
  /** Más decimales de los que admite el campo. */
  | "decimales"
  /** Fuera del rango propio del modo (porcentaje de 0 a 100). */
  | "rango";

export type ResultadoNumero =
  | { ok: true; valor: number; /** Decimal de máquina: `1234.5`. */ canonico: string }
  | {
      ok: false;
      motivo: MotivoRechazo;
      /** Qué escribir; conserva el texto de la persona (NUM-01 «Error de campo»). */
      mensaje: string;
      /** `true` cuando el texto puede leerse de dos maneras y hay que aclararlo. */
      pedirAclarar: boolean;
    };

export type ResultadoLiteral =
  | { ok: true; canonico: string; decimales: number }
  | Extract<ResultadoNumero, { ok: false }>;

export const MENSAJE_FORMATO =
  "El formato es 1.234,50: punto para los miles y coma para los decimales.";

const LITERAL_RE = /^[0-9.,]+$/;
const NUMERO_RE = /^([+-]?)\s*([0-9.,]+)$/;

/**
 * Interpreta lo que una persona tecleó en un campo de un modo dado.
 * Acepta un signo delante; quien no admita negativos lo valida aparte.
 */
export function parseNumero(
  texto: string,
  modo: ModoNumero,
  opciones: OpcionesNumero = {},
): ResultadoNumero {
  const decimales = decimalesDelCampo(modo, opciones);
  if (typeof texto !== "string") {
    return rechazo("formato", "Escribe un número.");
  }
  const limpio = texto.trim();
  if (limpio === "") return rechazo("vacio", "Escribe un número.");

  const partes = NUMERO_RE.exec(limpio);
  if (!partes) return rechazo("formato", mensajeFormato(modo));
  const [, signo, literal] = partes;

  const r = interpretarLiteral(literal, modo, { decimales });
  if (!r.ok) return r;

  const canonico = signo === "-" && !esCero(r.canonico) ? `-${r.canonico}` : r.canonico;
  const valor = Number(canonico);
  if (!Number.isFinite(valor)) return rechazo("formato", "Número fuera de rango.");

  const fueraDeRango = rangoDelModo(modo, valor);
  if (fueraDeRango) return rechazo("rango", fueraDeRango);

  return { ok: true, valor, canonico };
}

export const parseDinero = (texto: string, opciones?: OpcionesNumero) =>
  parseNumero(texto, "dinero", opciones);
export const parseTasa = (texto: string, opciones?: OpcionesNumero) =>
  parseNumero(texto, "tasa", opciones);
export const parsePorcentaje = (texto: string, opciones?: OpcionesNumero) =>
  parseNumero(texto, "porcentaje", opciones);
export const parseMedida = (texto: string, opciones?: OpcionesNumero) =>
  parseNumero(texto, "medida", opciones);

/**
 * Interpreta un literal sin signo (solo cifras, puntos y comas). Es la pieza
 * que reutiliza el analizador de expresiones del Studio: cada operando se
 * interpreta por separado (NUM-01 «por literal»).
 */
export function interpretarLiteral(
  literal: string,
  modo: ModoNumero,
  opciones: OpcionesNumero = {},
): ResultadoLiteral {
  const decimales = decimalesDelCampo(modo, opciones);
  if (!/[0-9]/.test(literal)) return rechazo("incompleto", "Completa el número.");
  if (!LITERAL_RE.test(literal)) return rechazo("formato", mensajeFormato(modo));

  const comas = contar(literal, ",");
  const puntos = contar(literal, ".");

  if (comas > 0 && puntos > 0) {
    // Con los dos separadores, la coma es el decimal y va al final, una vez.
    if (modo === "porcentaje") return rechazo("formato", mensajeFormato(modo));
    if (literal.lastIndexOf(",") < literal.lastIndexOf(".") || comas !== 1) {
      return rechazo("formato", MENSAJE_FORMATO);
    }
    const [entero, fraccion] = literal.split(",");
    if (!fraccion) return rechazo("incompleto", "Completa los decimales.");
    if (!milesBienFormados(entero, ".")) return rechazo("formato", MENSAJE_FORMATO);
    return cerrar(entero.replaceAll(".", ""), fraccion, modo, decimales);
  }

  if (comas > 1) {
    // «1,234,567» es el formato de EE. UU.: aquí la coma es el decimal.
    return rechazo("formato", mensajeFormato(modo));
  }

  if (puntos > 1) {
    if (modo === "porcentaje") return rechazo("formato", mensajeFormato(modo));
    if (!milesBienFormados(literal, ".")) return rechazo("formato", mensajeFormato(modo));
    return cerrar(literal.replaceAll(".", ""), "", modo, decimales);
  }

  const separador = comas === 1 ? "," : puntos === 1 ? "." : null;
  if (!separador) return cerrar(literal, "", modo, decimales);

  const [entero, fraccion] = literal.split(separador);
  if (!fraccion) return rechazo("incompleto", "Completa los decimales.");

  if (esAmbiguo(entero, fraccion, separador, modo, decimales)) {
    return rechazo("ambiguo", mensajeAmbiguo(entero, fraccion, separador, modo), true);
  }
  return cerrar(entero, fraccion, modo, decimales);
}

/**
 * Lee un decimal de MÁQUINA (`3.498`, `1250`, `-0.5`): el valor que un campo
 * manda oculto al servidor. No es lo que teclea una persona: el punto aquí es
 * siempre el decimal, nunca miles, y no se admite coma ni agrupación. Respeta
 * los decimales y el rango del campo. Úsese solo para valores que salen de
 * `NumericInput`, nunca para texto escrito a mano.
 */
export function parseMaquina(
  texto: string,
  modo: ModoNumero,
  opciones: OpcionesNumero = {},
): ResultadoNumero {
  const decimales = decimalesDelCampo(modo, opciones);
  const limpio = typeof texto === "string" ? texto.trim() : "";
  if (limpio === "") return rechazo("vacio", "Escribe un número.");
  if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(limpio)) {
    return rechazo("formato", "No es un monto válido.");
  }
  if (decimalesDe(limpio) > decimales) {
    return rechazo("decimales", mensajeDecimales(modo, decimales));
  }
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return rechazo("formato", "Número fuera de rango.");
  const fueraDeRango = rangoDelModo(modo, valor);
  if (fueraDeRango) return rechazo("rango", fueraDeRango);
  return { ok: true, valor: valor === 0 ? 0 : valor, canonico: limpio };
}

/** Decimales que tiene un decimal de máquina («12.500» → 3). */
export function decimalesDe(canonico: string): number {
  const punto = canonico.indexOf(".");
  return punto === -1 ? 0 : canonico.length - punto - 1;
}

/** Decimales máximos del campo: los del modo o los que el campo declare. */
export function decimalesDelCampo(modo: ModoNumero, opciones: OpcionesNumero = {}): number {
  if (!MODOS_NUMERO.includes(modo)) {
    // Error de programación: el modo es obligatorio y no tiene valor por defecto.
    throw new Error(`Modo de cifra desconocido: ${String(modo)}`);
  }
  const propio = opciones.decimales;
  if (propio === undefined) return DECIMALES_POR_MODO[modo];
  if (!Number.isInteger(propio) || propio < 0) {
    throw new Error(`Decimales no válidos: ${String(propio)}`);
  }
  return propio;
}

/** Mensaje del rango propio del modo, o `null` si el valor cabe. */
export function rangoDelModo(modo: ModoNumero, valor: number): string | null {
  if (modo === "porcentaje" && (valor < 0 || valor > 100)) {
    return "El porcentaje va de 0 a 100.";
  }
  return null;
}

/** Mensaje cuando el valor (o el resultado de una operación) trae más decimales. */
export function mensajeDecimales(modo: ModoNumero, decimales: number): string {
  if (decimales === 0) return "Este campo no lleva decimales.";
  const cifras = decimales === 1 ? "1 decimal" : `${decimales} decimales`;
  if (modo === "dinero") return `Los montos llevan máximo ${cifras}, después de la coma.`;
  if (modo === "tasa") return `La tasa lleva máximo ${cifras}, después de la coma.`;
  return `Máximo ${cifras}, después de la coma.`;
}

function esAmbiguo(
  entero: string,
  fraccion: string,
  separador: "," | ".",
  modo: ModoNumero,
  decimales: number,
): boolean {
  if (fraccion.length !== 3) return false;
  // Solo es ambiguo si la parte entera podría ser el primer grupo de miles.
  if (!/^[0-9]{1,3}$/.test(entero) || /^0+$/.test(entero)) return false;
  // Con tres o más decimales en el campo (ft³: cuatro) la coma es decimal sin
  // duda: «3,498». El punto sigue sin adivinarse: «3.498» se pide aclarar.
  if (modo === "dinero") return decimales < 3 || separador === ".";
  if (modo === "tasa") return separador === ".";
  return false;
}

function mensajeAmbiguo(
  entero: string,
  fraccion: string,
  separador: "," | ".",
  modo: ModoNumero,
): string {
  const tecleado = `${entero}${separador}${fraccion}`;
  const miles = `${entero}${fraccion}`;
  if (modo === "tasa") {
    return `«${tecleado}» se puede leer de dos maneras. En la tasa el decimal va con coma: escribe ${entero},${fraccion} si es decimal o ${miles} si son miles.`;
  }
  return `«${tecleado}» se puede leer de dos maneras. Si son miles, escribe ${miles} o ${entero}.${fraccion},00. Los centavos van con coma y llevan máximo 2 cifras.`;
}

function mensajeFormato(modo: ModoNumero): string {
  if (modo === "porcentaje") {
    return "Escribe el porcentaje con coma para los decimales: 12,5.";
  }
  return MENSAJE_FORMATO;
}

function cerrar(
  entero: string,
  fraccion: string,
  modo: ModoNumero,
  decimales: number,
): ResultadoLiteral {
  if (fraccion.length > decimales) {
    return rechazo("decimales", mensajeDecimales(modo, decimales));
  }
  const parteEntera = entero.replace(/^0+(?=[0-9])/, "") || "0";
  const canonico = fraccion ? `${parteEntera}.${fraccion}` : parteEntera;
  return { ok: true, canonico, decimales: fraccion.length };
}

function milesBienFormados(valor: string, separador: string): boolean {
  const grupos = valor.split(separador);
  return (
    /^[0-9]{1,3}$/.test(grupos[0]) &&
    grupos.slice(1).every((grupo) => /^[0-9]{3}$/.test(grupo))
  );
}

function rechazo(
  motivo: MotivoRechazo,
  mensaje: string,
  pedirAclarar = false,
): Extract<ResultadoNumero, { ok: false }> {
  return { ok: false, motivo, mensaje, pedirAclarar };
}

function esCero(canonico: string): boolean {
  return /^0(\.0+)?$/.test(canonico);
}

function contar(valor: string, aguja: string): number {
  return valor.split(aguja).length - 1;
}
