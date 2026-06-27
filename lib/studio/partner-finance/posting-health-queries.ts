/**
 * Detector de salud contable del Financiero China (SDD-0110, fix auditor V6/V5).
 * Funciones PURAS que reciben un SupabaseClient; RLS filtra por tenant_id.
 *
 * El posting es best-effort: si falla (ej. falta el plan de cuentas, o un cargo
 * no-USD sin fx_rate válido) el alta queda con `journal_entry_id` NULL y sólo
 * hay un `console.error`. Sin un detector, esos "colgados" son invisibles.
 *
 * Dos clases de hueco:
 *  - NO ASENTADOS (V6): cargo / conversión / cruce vivo con journal_entry_id
 *    NULL que SÍ debería tener asiento (excluye cargos `cancelado` y
 *    conversiones con comisión 0 — esos no asientan por diseño).
 *  - ASIENTO STALE (V5): cargo YA asentado al que luego se le aplicó una nota
 *    de crédito → el asiento quedó al monto bruto y el net_amount cambió. La
 *    re-causación real es trabajo futuro; acá lo hacemos VISIBLE para que no se
 *    descuadre en silencio.
 *
 * Conteos baratos (head:true + count:exact) para el badge; la lista de ids es
 * opcional (para un detalle futuro).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PartnerFinanceHealth = {
  /** Cargos vivos no `cancelado` sin asiento. */
  unpostedCharges: number;
  /** Conversiones vivas con comisión > 0 sin asiento. */
  unpostedConversions: number;
  /** Cruces vivos sin asiento. */
  unpostedClaimOffsets: number;
  /** Cargos asentados con nota(s) de crédito viva(s) → asiento stale. */
  staleCharges: number;
  /** Total de huecos visibles (suma de los 4). */
  total: number;
};

async function countHead(
  query: { count: number | null; error: { message: string } | null },
): Promise<number> {
  if (query.error) throw new Error(query.error.message);
  return query.count ?? 0;
}

/**
 * Resumen de huecos contables del dominio Socio China para el badge de
 * `/studio/financiero-china`. RLS por tenant (las policies de 0114 ya filtran).
 */
export async function getPartnerFinanceHealth(
  supabase: SupabaseClient,
): Promise<PartnerFinanceHealth> {
  // 1. Cargos no asentados (vivos, no cancelado, sin asiento).
  const unpostedCharges = await countHead(
    await supabase
      .from("supplier_charges")
      .select("id", { count: "exact", head: true })
      .is("journal_entry_id", null)
      .is("deleted_at", null)
      .neq("status", "cancelado"),
  );

  // 2. Conversiones no asentadas (vivas, comisión > 0, sin asiento).
  //    Comisión 0 (sin spread) no asienta por diseño → no es un hueco.
  const unpostedConversions = await countHead(
    await supabase
      .from("currency_conversions")
      .select("id", { count: "exact", head: true })
      .is("journal_entry_id", null)
      .is("deleted_at", null)
      .gt("commission_amount", 0),
  );

  // 3. Cruces no asentados (vivos, sin asiento).
  const unpostedClaimOffsets = await countHead(
    await supabase
      .from("supplier_claim_offsets")
      .select("id", { count: "exact", head: true })
      .is("journal_entry_id", null)
      .is("deleted_at", null),
  );

  // 4. Asientos stale (V5): cargo asentado (journal_entry_id no null) que tiene
  //    al menos una nota de crédito viva → el asiento quedó al bruto. Traemos
  //    los charge_id asentados y los charge_id con NC viva, e intersectamos en
  //    memoria (no hay join barato en PostgREST sin embebido).
  const { data: postedRows, error: postedErr } = await supabase
    .from("supplier_charges")
    .select("id")
    .not("journal_entry_id", "is", null)
    .is("deleted_at", null)
    .limit(20000);
  if (postedErr) throw new Error(postedErr.message);
  const postedIds = new Set(
    ((postedRows as { id: string }[] | null) ?? []).map((r) => r.id),
  );

  let staleCharges = 0;
  if (postedIds.size > 0) {
    const { data: noteRows, error: noteErr } = await supabase
      .from("supplier_credit_notes")
      .select("charge_id")
      .is("deleted_at", null)
      .limit(20000);
    if (noteErr) throw new Error(noteErr.message);
    const chargesWithNote = new Set(
      ((noteRows as { charge_id: string }[] | null) ?? []).map(
        (r) => r.charge_id,
      ),
    );
    for (const id of chargesWithNote) {
      if (postedIds.has(id)) staleCharges += 1;
    }
  }

  const total =
    unpostedCharges + unpostedConversions + unpostedClaimOffsets + staleCharges;

  return {
    unpostedCharges,
    unpostedConversions,
    unpostedClaimOffsets,
    staleCharges,
    total,
  };
}
