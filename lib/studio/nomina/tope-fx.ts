/**
 * SDD-0653 · fase A3 — la tasa que convierte el tope de SSO y RPE a USD.
 *
 * El salario mínimo de `payroll_rules` está en bolívares y el sueldo del
 * empleado en dólares. Para topar el sueldo, el tope (en Bs) se pasa a USD con
 * la tasa BCV vigente el último día del período del corte (decisión D6 de Sam,
 * 2026-11-17). Esa tasa se congela en el `rules_snapshot` del corte, junto con su
 * fuente y su fecha de valor, para que regenerar el borrador no cambie la cifra.
 *
 * Sin tasa y con topes activos, el corte NO se calcula: se avisa qué cargar
 * (ERR-01). Con topes desactivados (cap 0 o salario mínimo 0) no hace falta tasa.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tasaVigente } from "@/lib/studio/fx-rates";
import { num, topesNecesitanTasa } from "./payroll-run-types";

/** Lo que el corte guarda en el snapshot sobre la tasa de los topes. */
export type TasaDeTopes = {
  /** Bs por 1 USD; null si no hacen falta (topes desactivados). */
  rate: number | null;
  source: string | null;
  validOn: string | null;
};

type ReglasDeTope = {
  min_salary?: unknown;
  sso_cap_sm?: unknown;
  rpe_cap_sm?: unknown;
  cap_fx_rate?: unknown;
  cap_fx_source?: unknown;
  cap_fx_valid_on?: unknown;
};

/**
 * La tasa de los topes para un corte. Si el snapshot ya la trae (corte nuevo),
 * se usa tal cual: es la congelada. Si no (corte anterior a la A3), se busca la
 * vigente al `periodEnd`.
 */
export async function resolverTasaDeTopes(
  supabase: SupabaseClient,
  tenantId: string,
  reglas: ReglasDeTope,
  periodEnd: string,
): Promise<{ ok: true; tasa: TasaDeTopes } | { ok: false; error: string }> {
  const topes = topesNecesitanTasa({
    min_salary: num(reglas.min_salary),
    sso_cap_sm: num(reglas.sso_cap_sm),
    rpe_cap_sm: num(reglas.rpe_cap_sm),
  });
  if (!topes) return { ok: true, tasa: { rate: null, source: null, validOn: null } };

  const congelada = num(reglas.cap_fx_rate);
  if (congelada > 0) {
    return {
      ok: true,
      tasa: {
        rate: congelada,
        source: typeof reglas.cap_fx_source === "string" ? reglas.cap_fx_source : null,
        validOn: typeof reglas.cap_fx_valid_on === "string" ? reglas.cap_fx_valid_on : null,
      },
    };
  }

  const vigente = await tasaVigente(supabase, tenantId, "VES", periodEnd);
  if (!vigente || !(vigente.rate > 0)) {
    return {
      ok: false,
      error:
        `Falta la tasa de bolívares para el ${periodEnd}: el tope de SSO y RPE está en Bs y se convierte a USD con ella. ` +
        "Cárgala en Admin › Tasas y genera el corte de nuevo.",
    };
  }
  return { ok: true, tasa: { rate: vigente.rate, source: vigente.source, validOn: vigente.validOn } };
}

/** Los tres campos que el corte congela en su snapshot (vacío si no hay tasa). */
export function camposDeTasaParaSnapshot(t: TasaDeTopes): Record<string, unknown> {
  return t.rate === null
    ? {}
    : { cap_fx_rate: t.rate, cap_fx_source: t.source, cap_fx_valid_on: t.validOn };
}
