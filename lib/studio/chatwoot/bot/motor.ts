/**
 * `dtd-bot` · motor y costo por llamada (SDD-NNNN §3, fila 7.6 de SDD-0582). Puro salvo el
 * motor que se inyecta.
 *
 * El proveedor real NO se elige aquí: la decisión F dice Gemini con GLM de respaldo y la
 * fila 3.4 dice «Solo GLM» (§1.1). El motor es una interfaz; en las pruebas va un doble y
 * ninguna llamada a un modelo pagado sale de esta PR. 7.5 (con OK de Sam) conecta el real.
 *
 * `llamarMotor`:
 *  - corta por tiempo (`timeoutMs`) y aborta la señal;
 *  - valida la forma de la respuesta (texto no vacío, tokens enteros);
 *  - anota SIEMPRE una llamada con proveedor, modelo, tokens, costo y resultado, también
 *    cuando falla o vence, para que el presupuesto la cuente (sin prompt ni respuesta);
 *  - nunca lanza: devuelve `ok: false` con el motivo y el turno pasa a humano.
 */

export interface PrecioModelo {
  /** USD por millón de tokens de entrada. */
  entradaPorMillon: number;
  /** USD por millón de tokens de salida. */
  salidaPorMillon: number;
}

export interface EntradaMotor {
  /** Instrucciones fijas del bot y la base canónica que corresponda. */
  sistema: string;
  /** La conversación ya recortada, del más viejo al más nuevo. */
  mensajes: readonly { rol: "cliente" | "dtd"; texto: string }[];
  maxTokensSalida: number;
}

export interface SalidaMotor {
  texto: string;
  tokensEntrada: number;
  tokensSalida: number;
}

export interface Motor {
  proveedor: string;
  modelo: string;
  precio: PrecioModelo;
  generar(entrada: EntradaMotor, senal: AbortSignal): Promise<SalidaMotor>;
}

export type ResultadoLlamada = "ok" | "timeout" | "error" | "respuesta_invalida";

/** Lo que se anota de cada llamada. Sin texto: ni el prompt ni la respuesta. */
export interface LlamadaAnotada {
  proveedor: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
  resultado: ResultadoLlamada;
  duracionMs: number;
  /** El costo se estimó (por timeout o error) en lugar de medirse con los tokens del proveedor. */
  costoEstimado: boolean;
}

export type RespuestaLlamada =
  | { ok: true; texto: string; llamada: LlamadaAnotada }
  | { ok: false; motivo: Exclude<ResultadoLlamada, "ok">; llamada: LlamadaAnotada };

const tokensValidos = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** Costo en USD de una llamada, redondeado hacia arriba a la millonésima. Precio inválido → lanza. */
export function costoLlamada(precio: PrecioModelo, tokensEntrada: number, tokensSalida: number): number {
  if (!(precio.entradaPorMillon >= 0 && precio.salidaPorMillon >= 0)) throw new Error("precio inválido");
  if (!tokensValidos(tokensEntrada) || !tokensValidos(tokensSalida)) throw new Error("tokens inválidos");
  const bruto = (tokensEntrada * precio.entradaPorMillon + tokensSalida * precio.salidaPorMillon) / 1_000_000;
  return Math.ceil(bruto * 1_000_000 - 1e-9) / 1_000_000;
}

/** Tokens de entrada estimados por lo alto: 1 token cada 2 caracteres (el español rinde más). */
export function estimarTokensEntrada(entrada: EntradaMotor): number {
  const caracteres = entrada.sistema.length + entrada.mensajes.reduce((s, m) => s + m.texto.length + 8, 0);
  return Math.ceil(caracteres / 2);
}

/** Lo más que puede costar la llamada: para el presupuesto ANTES de llamar. */
export function costoMaximo(precio: PrecioModelo, entrada: EntradaMotor): number {
  return costoLlamada(precio, estimarTokensEntrada(entrada), entrada.maxTokensSalida);
}

export async function llamarMotor(
  motor: Motor,
  entrada: EntradaMotor,
  opciones: { timeoutMs: number; ahora?: () => number },
): Promise<RespuestaLlamada> {
  const reloj = opciones.ahora ?? Date.now;
  const inicio = reloj();
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<"timeout">((resolve) => {
    temporizador = setTimeout(() => {
      control.abort();
      resolve("timeout");
    }, opciones.timeoutMs);
  });

  const anotar = (resultado: ResultadoLlamada, tokensEntrada: number, tokensSalida: number, estimado: boolean): LlamadaAnotada => ({
    proveedor: motor.proveedor,
    modelo: motor.modelo,
    tokensEntrada,
    tokensSalida,
    costoUsd: costoLlamada(motor.precio, tokensEntrada, tokensSalida),
    resultado,
    duracionMs: Math.max(0, reloj() - inicio),
    costoEstimado: estimado,
  });
  // Lo que no se pudo medir se cobra como el peor caso: el presupuesto nunca queda corto.
  const peorCaso = (resultado: Exclude<ResultadoLlamada, "ok">) =>
    anotar(resultado, estimarTokensEntrada(entrada), entrada.maxTokensSalida, true);

  try {
    const r = await Promise.race([motor.generar(entrada, control.signal), vencido]);
    if (r === "timeout") return { ok: false, motivo: "timeout", llamada: peorCaso("timeout") };
    const texto = typeof r?.texto === "string" ? r.texto.trim() : "";
    if (!texto || !tokensValidos(r.tokensEntrada) || !tokensValidos(r.tokensSalida)) {
      return { ok: false, motivo: "respuesta_invalida", llamada: peorCaso("respuesta_invalida") };
    }
    return { ok: true, texto, llamada: anotar("ok", r.tokensEntrada, r.tokensSalida, false) };
  } catch {
    if (control.signal.aborted) return { ok: false, motivo: "timeout", llamada: peorCaso("timeout") };
    return { ok: false, motivo: "error", llamada: peorCaso("error") };
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}
