/**
 * `dtd-bot` · frenos (SDD-0618 §3.3, fila 7.6 de SDD-0582). Puro.
 *
 * Los frenos que la v3 tomó del kit de Basdonax, pero con el estado en la base y no en la
 * memoria del proceso (el kit los pierde al reiniciar): estas funciones solo calculan, y
 * quien las llama guarda el resultado en el turno.
 *
 *  - **Ráfagas:** el turno espera `inactividadMs` (8 s) después del último mensaje del
 *    cliente, sin pasar de `maximoMs` (24 s) desde el primero.
 *  - **Tope por conversación:** como mucho `topeConversacion24h` respuestas del bot en 24 h;
 *    la siguiente pasa a humano.
 *  - **Recortes:** entrada a 2.000 caracteres y salida a 4.096.
 *  - **Presupuesto:** corte duro al llegar al tope del mes (§1.1: US$25 mientras Sam no
 *    decida entre los US$25 de E0-D3 y los US$50 de la 3.4).
 */

export interface ConfigFrenos {
  inactividadMs: number;
  maximoMs: number;
  topeConversacion24h: number;
  maxEntrada: number;
  maxSalida: number;
  topeMensualUsd: number;
}

export const FRENOS_POR_DEFECTO: Readonly<ConfigFrenos> = Object.freeze({
  inactividadMs: 8_000,
  maximoMs: 24_000,
  topeConversacion24h: 6,
  maxEntrada: 2_000,
  maxSalida: 4_096,
  topeMensualUsd: 25,
});

/** Límites de lo que se puede configurar: fuera de ellos vale el valor por defecto. */
const LIMITES: { [K in keyof ConfigFrenos]: [number, number] } = {
  inactividadMs: [1_000, 60_000],
  maximoMs: [1_000, 120_000],
  topeConversacion24h: [1, 50],
  maxEntrada: [200, 8_000],
  maxSalida: [200, 4_096],
  topeMensualUsd: [0, 50],
};

/**
 * Frenos desde una configuración parcial (la de la bandeja o del entorno). Un valor
 * que no es número finito o se sale de sus límites vuelve al de por defecto; el máximo
 * nunca queda por debajo de la inactividad. El tope mensual no pasa de US$50: el más
 * alto que Sam mencionó (3.4).
 */
export function frenosDesde(parcial: Partial<Record<keyof ConfigFrenos, unknown>> = {}): ConfigFrenos {
  const r = { ...FRENOS_POR_DEFECTO };
  for (const k of Object.keys(LIMITES) as (keyof ConfigFrenos)[]) {
    const v = parcial[k];
    const [min, max] = LIMITES[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) r[k] = v;
  }
  if (r.maximoMs < r.inactividadMs) r.maximoMs = r.inactividadMs;
  return r;
}

export interface TiemposTurno {
  /** ISO del primer mensaje del cliente que abrió el turno. */
  primerMensajeAt: string;
  /** ISO desde el que el turno se puede atender. */
  listoDesde: string;
  /** ISO del plazo duro: después de esto no se espera más. */
  limiteAt: string;
}

const ms = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();

/** Tiempos de un turno nuevo, abierto por un mensaje que llegó en `llegada`. */
export function abrirTiempos(llegada: string, f: ConfigFrenos = FRENOS_POR_DEFECTO): TiemposTurno {
  const t = ms(llegada);
  if (!Number.isFinite(t)) throw new Error("llegada inválida");
  return { primerMensajeAt: iso(t), listoDesde: iso(t + f.inactividadMs), limiteAt: iso(t + f.maximoMs) };
}

/**
 * Otro mensaje del cliente en el mismo turno: corre `listoDesde`, sin pasar del límite.
 * Un mensaje que llega fuera de orden (antes que el último visto) no adelanta nada.
 */
export function extenderTiempos(t: TiemposTurno, llegada: string, f: ConfigFrenos = FRENOS_POR_DEFECTO): TiemposTurno {
  const nueva = ms(llegada);
  if (!Number.isFinite(nueva)) return t;
  const propuesta = Math.min(nueva + f.inactividadMs, ms(t.limiteAt));
  if (propuesta <= ms(t.listoDesde)) return t;
  return { ...t, listoDesde: iso(propuesta) };
}

/** El turno ya se puede atender: pasó la inactividad o el plazo duro. */
export function turnoListo(t: TiemposTurno, ahora: string): boolean {
  const a = ms(ahora);
  return a >= ms(t.listoDesde) || a >= ms(t.limiteAt);
}

/** El tope por conversación: con `respuestas24h` ya dadas, ¿se puede dar otra? */
export function dentroDelTopeConversacion(respuestas24h: number, f: ConfigFrenos = FRENOS_POR_DEFECTO): boolean {
  return Number.isInteger(respuestas24h) && respuestas24h >= 0 && respuestas24h < f.topeConversacion24h;
}

/**
 * El presupuesto del mes: ¿alcanza para una llamada más que cuesta, como mucho,
 * `costoMaximoLlamada`? Un gasto que no se pudo sumar (null o no finito) no alcanza.
 */
export function dentroDelPresupuesto(
  gastoMesUsd: number | null,
  costoMaximoLlamada: number,
  f: ConfigFrenos = FRENOS_POR_DEFECTO,
): boolean {
  if (gastoMesUsd === null || !Number.isFinite(gastoMesUsd) || gastoMesUsd < 0) return false;
  if (!Number.isFinite(costoMaximoLlamada) || costoMaximoLlamada < 0) return false;
  // En millonésimas de dólar: la suma en coma flotante no decide un corte duro.
  return Math.round((gastoMesUsd + costoMaximoLlamada) * 1_000_000) <= Math.round(f.topeMensualUsd * 1_000_000);
}

/**
 * Recorta un texto a `max` caracteres (puntos de código, para no partir un emoji), sin
 * dejar un sustituto suelto. Devuelve también si recortó.
 */
export function recortar(texto: string, max: number): { texto: string; recortado: boolean } {
  const puntos = Array.from(texto);
  if (puntos.length <= max) return { texto, recortado: false };
  return { texto: puntos.slice(0, max).join(""), recortado: true };
}
