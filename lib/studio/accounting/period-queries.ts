/**
 * Cierre de período contable (SDD-0080) — "cerrar los libros" estilo QBO.
 *
 * Lee la config singleton del tenant (`accounting_settings.closing_date`) y
 * expone el helper puro `isPeriodClosed()`. La defensa dura vive en el trigger
 * de DB (journal_entries_validate_closing); estas funciones dan el chequeo a
 * nivel app para mensajes claros antes de tocar la DB.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountingSettings = {
  /** null si todavía no hay row (período abierto). */
  tenant_id: string | null;
  /** YYYY-MM-DD, o null = período abierto (sin restricción). */
  closing_date: string | null;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string | null;
};

/**
 * ¿La fecha `entryDate` cae en período cerrado? PURA — testeable sin DB.
 * Cerrado = hay closing_date y entryDate <= closing_date. Compara por día
 * (las fechas ISO `YYYY-MM-DD` se ordenan lexicográfica == cronológicamente).
 */
export function isPeriodClosed(
  closingDate: string | null,
  entryDate: string,
): boolean {
  if (!closingDate || !entryDate) return false;
  const c = closingDate.slice(0, 10);
  const e = entryDate.slice(0, 10);
  return e <= c;
}

/**
 * Lee la config contable del tenant (singleton). Sin row → período abierto
 * (closing_date null). Un error real de lectura se PROPAGA (no se asume abierto
 * por un fallo transitorio — eso permitiría escribir en un período cerrado en
 * silencio). Espejo de getFiscalSettings().
 */
export async function getAccountingSettings(
  supabase: SupabaseClient,
): Promise<AccountingSettings> {
  const { data, error } = await supabase
    .from("accounting_settings")
    .select("tenant_id, closing_date, locked_by, locked_at, updated_at")
    .maybeSingle<{
      tenant_id: string;
      closing_date: string | null;
      locked_by: string | null;
      locked_at: string | null;
      updated_at: string | null;
    }>();

  // Tolerar "no row" (PGRST116) y "tabla aún inexistente" (PGRST205 / 42P01): si
  // la migración 0133 todavía no se aplicó en prod, degradamos a período ABIERTO
  // en vez de tumbar /studio/contabilidad. Cualquier otro error se propaga (no
  // fabricar "abierto" por un fallo transitorio de lectura).
  const code = (error as { code?: string } | null)?.code;
  if (error && code !== "PGRST116" && code !== "PGRST205" && code !== "42P01") {
    throw error;
  }

  if (!data) {
    return {
      tenant_id: null,
      closing_date: null,
      locked_by: null,
      locked_at: null,
      updated_at: null,
    };
  }

  return {
    tenant_id: data.tenant_id,
    closing_date: data.closing_date,
    locked_by: data.locked_by,
    locked_at: data.locked_at,
    updated_at: data.updated_at,
  };
}
