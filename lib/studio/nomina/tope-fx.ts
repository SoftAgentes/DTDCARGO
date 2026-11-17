/**
 * SDD-0653 · fase A3 — la tasa que convierte el tope de SSO y RPE a USD.
 *
 * El salario mínimo de `payroll_rules` está en bolívares y el sueldo del
 * empleado en dólares. Para topar el sueldo, el tope (en Bs) se pasa a USD con
 * la tasa BCV del último día del período del corte (decisión D6 de Sam,
 * 2026-11-17).
 *
 * Reglas (revisión independiente de #640):
 *  - La tasa debe tener fecha de valor = último día del período, o la del último
 *    día hábil anterior con una tolerancia corta: 4 días naturales (fines de
 *    semana y feriados). `fx_rate_on` no limita la antigüedad, así que aquí se
 *    exige: una tasa de hace meses no calcula el corte.
 *  - Si el corte se genera ANTES de que termine el período, la tasa del cierre
 *    todavía no existe: el borrador calcula con la última tasa disponible y queda
 *    **provisional** (no se congela). Al regenerar con el período cerrado se
 *    congela la del cierre; confirmar exige esa tasa congelada.
 *  - Una tasa definitiva se congela en el `rules_snapshot` (tasa, fuente, fecha):
 *    regenerar no cambia la cifra aunque la tasa se corrija después.
 *
 * Con topes desactivados (cap 0 o salario mínimo 0) no hace falta tasa.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tasaVigente } from "@/lib/studio/fx-rates";
import { num, topesNecesitanTasa } from "./payroll-run-types";

/** Días naturales máximos entre la fecha de valor de la tasa y el día que se pide. */
export const TOLERANCIA_TASA_DIAS = 4;

/** Lo que el corte usa (y, si es definitiva, congela) sobre la tasa de los topes. */
export type TasaDeTopes = {
  /** Bs por 1 USD; null si no hacen falta (topes desactivados). */
  rate: number | null;
  source: string | null;
  validOn: string | null;
  /** true: la del cierre todavía no existe; el borrador se recalcula después. */
  provisional: boolean;
};

type ReglasDeTope = {
  min_salary?: unknown;
  sso_cap_sm?: unknown;
  rpe_cap_sm?: unknown;
  cap_fx_rate?: unknown;
  cap_fx_source?: unknown;
  cap_fx_valid_on?: unknown;
};

/** ¿El snapshot ya trae la tasa del cierre congelada? */
export function tasaCongelada(reglas: ReglasDeTope): boolean {
  return num(reglas.cap_fx_rate) > 0;
}

/** Hoy (AAAA-MM-DD) en Caracas: el día que cuenta para saber si el período cerró. */
export function hoyEnCaracas(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

/** Días naturales de `a` a `b` (AAAA-MM-DD). NaN si alguna fecha no es válida. */
export function diasNaturalesEntre(a: string, b: string): number {
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * La tasa de los topes para un corte.
 *  - Con la del cierre ya congelada en el snapshot: esa, definitiva.
 *  - Con el período cerrado (`hoy` ≥ `periodEnd`): la del último día del período, con
 *    la tolerancia de 4 días; definitiva.
 *  - Con el período en curso: la vigente hoy, con la misma tolerancia; provisional.
 *  - Sin tasa dentro de la tolerancia: falla y dice qué fecha cargar.
 */
export async function resolverTasaDeTopes(
  supabase: SupabaseClient,
  tenantId: string,
  reglas: ReglasDeTope,
  periodEnd: string,
  hoy: string,
): Promise<{ ok: true; tasa: TasaDeTopes } | { ok: false; error: string }> {
  const topes = topesNecesitanTasa({
    min_salary: num(reglas.min_salary),
    sso_cap_sm: num(reglas.sso_cap_sm),
    rpe_cap_sm: num(reglas.rpe_cap_sm),
  });
  if (!topes) {
    return { ok: true, tasa: { rate: null, source: null, validOn: null, provisional: false } };
  }

  if (tasaCongelada(reglas)) {
    return {
      ok: true,
      tasa: {
        rate: num(reglas.cap_fx_rate),
        source: typeof reglas.cap_fx_source === "string" ? reglas.cap_fx_source : null,
        validOn: typeof reglas.cap_fx_valid_on === "string" ? reglas.cap_fx_valid_on : null,
        provisional: false,
      },
    };
  }

  const cerrado = hoy >= periodEnd;
  const diaPedido = cerrado ? periodEnd : hoy;
  const vigente = await tasaVigente(supabase, tenantId, "VES", diaPedido);
  const antiguedad = vigente ? diasNaturalesEntre(vigente.validOn, diaPedido) : Number.NaN;
  if (!vigente || !(vigente.rate > 0) || !(antiguedad >= 0 && antiguedad <= TOLERANCIA_TASA_DIAS)) {
    return {
      ok: false,
      error:
        `Falta la tasa de bolívares del ${diaPedido}` +
        (cerrado ? " (el último día del período)" : "") +
        `: el tope de SSO y RPE está en Bs y se convierte a USD con ella. ` +
        `Se acepta la de hasta ${TOLERANCIA_TASA_DIAS} días antes (fines de semana y feriados). ` +
        (vigente && vigente.rate > 0
          ? `La última que hay es del ${vigente.validOn}. `
          : "") +
        "Cárgala en Admin › Tasas y genera el corte de nuevo.",
    };
  }
  return {
    ok: true,
    tasa: { rate: vigente.rate, source: vigente.source, validOn: vigente.validOn, provisional: !cerrado },
  };
}

/** Los tres campos que el corte congela en su snapshot: solo con la tasa definitiva. */
export function camposDeTasaParaSnapshot(t: TasaDeTopes): Record<string, unknown> {
  return t.rate === null || t.provisional
    ? {}
    : { cap_fx_rate: t.rate, cap_fx_source: t.source, cap_fx_valid_on: t.validOn };
}

/** «BCV del 2026-11-17», con «PROVISIONAL» delante si todavía no es la del cierre. */
export function etiquetaDeTasa(t: TasaDeTopes): string {
  const fuente = t.source === "bcv" ? "BCV" : t.source === "manual" ? "manual" : "de operación";
  return `${t.provisional ? "PROVISIONAL " : ""}${fuente} del ${t.validOn ?? "sin fecha"}`;
}

/**
 * ¿Falta congelar la tasa del cierre? Verdadero si hay topes activos y el snapshot
 * no la trae: el corte todavía es provisional y no se puede confirmar.
 */
export function faltaTasaDelCierre(reglas: ReglasDeTope): boolean {
  return (
    topesNecesitanTasa({
      min_salary: num(reglas.min_salary),
      sso_cap_sm: num(reglas.sso_cap_sm),
      rpe_cap_sm: num(reglas.rpe_cap_sm),
    }) && !tasaCongelada(reglas)
  );
}
