/**
 * SDD-0569 · La tasa vigente (`fx_rate_on`, migración 0495) y la tasa que
 * congela un documento.
 *
 * Un documento en VES o CNY guarda la tasa que usó, con su fuente y su fecha de
 * valor (`fx_rate`, `fx_rate_source`, `fx_rate_valid_on`): una corrección
 * posterior de `fx_rates` no lo cambia (decisión 1 de Sam: la factura congela
 * «la tasa BCV del día de emisión»). Si quien factura escribe la tasa, es
 * `manual`; si no, se toma la vigente, con su fuente (bcv > manual > operacion).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { necesitaTasa, normalizarMoneda, tasaPersistible, type MonedaConvertible } from "@/lib/shared/fx";

export type FuenteTasa = "bcv" | "manual" | "operacion";
export type IntencionTasa = "preserve" | "manual" | "catalog";

export type TasaVigente = { rate: number; source: FuenteTasa; validOn: string };

/** La tasa congelada de un documento. En USD y USDT no hay tasa. */
export type TasaDelDocumento = {
  fxRate: number | null;
  fxRateSource: FuenteTasa | null;
  fxRateValidOn: string | null;
  /** Decisión explícita en el documento; source=manual del catálogo no la implica. */
  fxRateIsOverride: boolean;
};

const NOMBRE: Record<"VES" | "CNY", string> = { VES: "bolívares", CNY: "yuanes" };

/** «bolívares» o «yuanes», para los mensajes. */
export function nombreDeLaMoneda(currency: string): string {
  const m = normalizarMoneda(currency);
  return m === "VES" || m === "CNY" ? NOMBRE[m] : currency;
}

/**
 * La tasa vigente al día `onDate` (AAAA-MM-DD). null si no hay ninguna (la base
 * lanza FX_RATE_MISSING) o si la base todavía no tiene la 0495 (PGRST202).
 */
export async function tasaVigente(
  supabase: SupabaseClient,
  tenantId: string,
  currency: string,
  onDate: string,
): Promise<TasaVigente | null> {
  const moneda = normalizarMoneda(currency);
  if (moneda !== "VES" && moneda !== "CNY") return null;
  const { data, error } = await supabase.rpc("fx_rate_on", {
    p_tenant_id: tenantId,
    p_currency: moneda,
    p_on: onDate,
  });
  if (error) return null;
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { rate: number | string; source: FuenteTasa; valid_on: string }
    | null
    | undefined;
  const rate = tasaPersistible(fila?.rate ?? null);
  if (!fila || rate === null) return null;
  return { rate, source: fila.source, validOn: fila.valid_on };
}

/**
 * La tasa que congela un documento en `currency`, fechado `onDate`. Con la tasa
 * escrita, `manual` y ese día. Sin ella, la vigente. Si no hay ninguna, el error
 * dice qué hacer (ERR-01).
 *
 * Al editar, la intención del campo decide si conservar la tasa o sustituirla:
 * no se infiere una decisión por igualdad numérica. Una cifra explícita inválida
 * falla cerrada antes de consultar catálogo.
 */
export async function tasaDelDocumento(
  supabase: SupabaseClient,
  tenantId: string,
  currency: string,
  tecleada: number | null | undefined,
  onDate: string,
  guardada: TasaDelDocumento | null = null,
  intencion: IntencionTasa = tecleada == null ? "catalog" : "manual",
): Promise<{ ok: true; tasa: TasaDelDocumento } | { ok: false; error: string }> {
  if (!necesitaTasa(currency)) {
    return { ok: true, tasa: { fxRate: null, fxRateSource: null, fxRateValidOn: null, fxRateIsOverride: false } };
  }
  const moneda = normalizarMoneda(currency) as Exclude<MonedaConvertible, "USD" | "USDT">;
  if (intencion === "preserve" && guardada?.fxRateSource && guardada.fxRateValidOn) {
    const conservada = tasaPersistible(guardada.fxRate);
    if (conservada !== null) return { ok: true, tasa: { ...guardada, fxRate: conservada } };
  }
  if (intencion === "manual" || (intencion === "preserve" && guardada?.fxRateIsOverride)) {
    const escrita = tasaPersistible(intencion === "preserve" ? guardada?.fxRate : tecleada);
    if (escrita === null) {
      return { ok: false, error: "La tasa debe ser mayor que 0 al guardarse con 8 decimales y menor que 1.000.000.000.000." };
    }
    return { ok: true, tasa: { fxRate: escrita, fxRateSource: "manual", fxRateValidOn: onDate, fxRateIsOverride: true } };
  }
  const vigente = await tasaVigente(supabase, tenantId, moneda, onDate);
  if (!vigente) {
    return {
      ok: false,
      error: `Falta la tasa de ${NOMBRE[moneda]} para el ${onDate}: escríbela aquí o cárgala en Admin › Tasas.`,
    };
  }
  return { ok: true, tasa: { fxRate: vigente.rate, fxRateSource: vigente.source, fxRateValidOn: vigente.validOn, fxRateIsOverride: false } };
}

const PREFERENCIA: Record<FuenteTasa, number> = { bcv: 0, manual: 1, operacion: 2 };

/**
 * La última tasa de un par para precargar un formulario (gastos, Admin, el
 * móvil). Lee `fx_rates`; sin la 0495, o sin tasas, devuelve null. Del último
 * día, la misma preferencia que `fx_rate_on`: bcv > manual > operacion. Hay a lo
 * sumo una fila por fuente y día (la unicidad de la 0495), así que tres bastan.
 */
export async function ultimaTasa(
  supabase: SupabaseClient,
  currency: "VES" | "CNY",
): Promise<{ rate: number; validOn: string; source: FuenteTasa } | null> {
  const { data, error } = await supabase
    .from("fx_rates")
    .select("rate, valid_on, source")
    .eq("currency", currency)
    .order("valid_on", { ascending: false })
    .limit(3);
  const filas = (data ?? []) as { rate: number | string; valid_on: string; source: FuenteTasa }[];
  if (error || filas.length === 0) return null;
  const dia = filas[0].valid_on;
  const fila = filas
    .filter((f) => f.valid_on === dia)
    .sort((a, b) => (PREFERENCIA[a.source] ?? 9) - (PREFERENCIA[b.source] ?? 9))[0];
  const rate = tasaPersistible(fila.rate);
  return rate === null ? null : { rate, validOn: fila.valid_on, source: fila.source };
}
