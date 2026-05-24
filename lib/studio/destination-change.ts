/**
 * Helpers para Cambio de destino (SDD-0009).
 *
 * - findRateForDestination: busca rate activa que matchee (service, destination).
 *   Se usa para sugerir el fee del cambio según el catálogo de Tarifas.
 * - formatChangeNote / parseChangeNote: formato estructurado del note del
 *   shipment_event que registra el cambio. Parseable con regex para queries
 *   futuras (Facturación SDD-0020+).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rate } from "./rate-types";
import type { ShipmentService } from "./shipment-types";

/**
 * Busca una rate activa (no soft-deleted, valid_until >= today) que matchee
 * el destino. La búsqueda es ILIKE para tolerar variaciones de typeo.
 *
 * Retorna la primera match ordenada por valid_until DESC (la más vigente).
 * RLS filtra por tenant automáticamente.
 */
export async function findRateForDestination(
  supabase: SupabaseClient,
  service: ShipmentService,
  destination: string,
): Promise<Rate | null> {
  const trimmed = destination.trim();
  if (!trimmed) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("rates")
    .select(
      "id, tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes, created_at, updated_at, deleted_at",
    )
    .eq("service", service)
    .ilike("destination", `%${trimmed}%`)
    .or(`valid_until.gte.${today},valid_until.is.null`)
    .order("valid_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Rate | null) ?? null;
}

/**
 * Formato del note para shipment_events que registran cambio de destino.
 * Diseñado para ser parseable con regex en el futuro.
 *
 * Casos:
 * - Con fee: "[Cambio de destino · fee $80.00] Valencia → Maracaibo · Cliente movió oficina"
 * - Sin fee: "[Cambio de destino · sin costo] Valencia → Maracaibo · Typo en la dirección"
 * - Sin reason (defense): "[Cambio de destino · fee $80.00] Valencia → Maracaibo"
 */
export function formatChangeNote(input: {
  from: string;
  to: string;
  fee: number;
  reason?: string | null;
}): string {
  const feeStr = input.fee > 0 ? `fee $${input.fee.toFixed(2)}` : "sin costo";
  const prefix = `[Cambio de destino · ${feeStr}]`;
  const body = `${input.from} → ${input.to}`;
  const reason = input.reason?.trim();
  return reason ? `${prefix} ${body} · ${reason}` : `${prefix} ${body}`;
}

/**
 * Parsea un note del formato de formatChangeNote. Retorna null si no matchea.
 * Útil para queries de Facturación (SDD-0020+) que necesitan extraer fees.
 */
export function parseChangeNote(note: string): {
  fee: number;
  from: string;
  to: string;
  reason: string | null;
} | null {
  const re = /^\[Cambio de destino · (?:fee \$([\d.]+)|sin costo)\] (.+?) → ([^·]+?)(?: · (.+))?$/;
  const m = note.match(re);
  if (!m) return null;
  return {
    fee: m[1] ? Number(m[1]) : 0,
    from: m[2].trim(),
    to: m[3].trim(),
    reason: m[4]?.trim() ?? null,
  };
}
