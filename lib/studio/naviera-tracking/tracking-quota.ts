/**
 * Guard de cuota del tracking de SeaRates (SDD-0101 · Slice B.2). PURO/testeable.
 *
 * La cuenta SeaRates tiene un tope DURO de 100 llamadas/mes COMPARTIDO con el cron
 * de fletes (SDD-0092). El tracking no debe ahogarlo. Dos frenos:
 *   1. tope local mensual del tracking (`monthlyCap`, env configurable),
 *   2. reserva sobre el `remaining` que SeaRates reporta (`reserve`): si quedan
 *      pocas llamadas en el plan, el tracking se frena para dejarle al cron.
 *
 * El caller (la action) lee el contador del mes + el último `remaining` visto y
 * llama esto ANTES de gastar una llamada.
 */

export type QuotaDecision = {
  /** ¿Se permite gastar una llamada de tracking ahora? */
  allowed: boolean;
  /** Motivo del bloqueo (machine-readable), o null si allowed. */
  reason: "monthly_cap" | "account_reserve" | null;
  /** Mensaje listo para mostrar al operador, o null si allowed. */
  message: string | null;
};

export type QuotaInput = {
  /** Llamadas de tracking ya gastadas este mes (contador local). */
  callsThisPeriod: number;
  /** Último `api_calls.remaining` que reportó SeaRates (null si nunca se llamó). */
  lastRemaining: number | null;
  /** Tope mensual del tracking (env SEARATES_TRACKING_MONTHLY_CAP). */
  monthlyCap: number;
  /** Reserva del plan para el cron de fletes (env SEARATES_TRACKING_RESERVE). */
  reserve: number;
};

/**
 * Decide si se puede gastar una llamada de tracking. Bloquea si se alcanzó el tope
 * mensual local, o si el remaining del plan está en/por debajo de la reserva.
 */
export function trackingQuotaDecision(input: QuotaInput): QuotaDecision {
  const { callsThisPeriod, lastRemaining, monthlyCap, reserve } = input;

  if (callsThisPeriod >= monthlyCap) {
    return {
      allowed: false,
      reason: "monthly_cap",
      message: `Llegaste al tope mensual de tracking (${monthlyCap}). Se reabre el mes que viene.`,
    };
  }

  if (lastRemaining != null && lastRemaining <= reserve) {
    return {
      allowed: false,
      reason: "account_reserve",
      message: `Quedan pocas llamadas en el plan SeaRates (${lastRemaining}); se reservan para los fletes.`,
    };
  }

  return { allowed: true, reason: null, message: null };
}

/** Período 'YYYY-MM' de una fecha (UTC). Aislado para testear el contador mensual. */
export function trackingPeriod(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Lee el tope mensual y la reserva desde env (con defaults conservadores). */
export function trackingQuotaConfig(): { monthlyCap: number; reserve: number } {
  const cap = Number(process.env.SEARATES_TRACKING_MONTHLY_CAP);
  const reserve = Number(process.env.SEARATES_TRACKING_RESERVE);
  return {
    monthlyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 40,
    reserve: Number.isFinite(reserve) && reserve >= 0 ? Math.floor(reserve) : 10,
  };
}
