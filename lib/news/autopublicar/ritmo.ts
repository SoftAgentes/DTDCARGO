/**
 * SDD-0611 §4.2.1 · Ritmo (F7): tope por día y por semana.
 *
 * Hora de Caracas (UTC−4 fija: Venezuela no cambia la hora desde 2016), semana
 * de lunes a domingo. Cuentan solo las publicadas por la vía automática.
 *
 * Los topes son configuración del tenant que cambia un admin. Hay un límite duro
 * que ninguna configuración levanta: nunca más de una automática por día. La
 * base lo repite con un CHECK y vuelve a contar con bloqueo (migración 0518).
 */

/** Límite duro: una automática por día como máximo. */
export const TOPE_DIA_DURO = 1;
/** Máximo de la semana que acepta la configuración. */
export const TOPE_SEMANA_MAX = 7;

const OFFSET_CARACAS_MS = -4 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha de Caracas (`AAAA-MM-DD`) de un instante. */
export function fechaCaracas(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_CARACAS_MS).toISOString().slice(0, 10);
}

/** Lunes (`AAAA-MM-DD`, hora de Caracas) de la semana del instante. */
export function lunesCaracas(instante: Date): string {
  const local = new Date(instante.getTime() + OFFSET_CARACAS_MS);
  const diasDesdeLunes = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - diasDesdeLunes * DIA_MS).toISOString().slice(0, 10);
}

export type ErrorTopes = "tope_dia_invalido" | "tope_semana_invalido";

/** Valida una configuración de topes. Una de 2 por día se rechaza. */
export function validarTopes(topeDia: number, topeSemana: number): ErrorTopes | null {
  if (!Number.isInteger(topeDia) || topeDia < 0 || topeDia > TOPE_DIA_DURO) {
    return "tope_dia_invalido";
  }
  if (!Number.isInteger(topeSemana) || topeSemana < 0 || topeSemana > TOPE_SEMANA_MAX) {
    return "tope_semana_invalido";
  }
  return null;
}

export interface EntradaRitmo {
  ahora: Date;
  /** Instantes de las automáticas ya publicadas (las manuales no van aquí). */
  automaticas: ReadonlyArray<Date>;
  topeDia: number;
  topeSemana: number;
}

/** `tope_dia`, `tope_semana` o vacío si con esta no se pasa ningún tope. */
export function evaluarRitmo(e: EntradaRitmo): string[] {
  if (validarTopes(e.topeDia, e.topeSemana) !== null) return ["tope_dia"];
  const hoy = fechaCaracas(e.ahora);
  const semana = lunesCaracas(e.ahora);
  const delDia = e.automaticas.filter((d) => fechaCaracas(d) === hoy).length;
  const deLaSemana = e.automaticas.filter((d) => lunesCaracas(d) === semana).length;
  if (delDia + 1 > Math.min(e.topeDia, TOPE_DIA_DURO)) return ["tope_dia"];
  if (deLaSemana + 1 > e.topeSemana) return ["tope_semana"];
  return [];
}

/** Cuántas automáticas lleva la semana (para «1 de 2 esta semana»). */
export function automaticasDeLaSemana(ahora: Date, automaticas: ReadonlyArray<Date>): number {
  const semana = lunesCaracas(ahora);
  return automaticas.filter((d) => lunesCaracas(d) === semana).length;
}
