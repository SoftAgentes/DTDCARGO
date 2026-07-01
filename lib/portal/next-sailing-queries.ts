/**
 * Próximo zarpe abierto para el portal (SDD-0133).
 *
 * `sailings` (SDD-0047, migr 0096) es el calendario de zarpes del Studio. El
 * portal la LEE con admin client scopeado por tenant (best-effort, mismo patrón
 * que Naviera Tier 1 — el cliente del portal no tiene RLS sobre `sailings`). SIN
 * migración.
 *
 * Decisión founder (2026-07-01): "la ruta del cliente" = el **próximo zarpe
 * abierto** global del tenant (cut-off más cercano). Sirve para LCL consolidado
 * (95% del negocio comparte la ruta principal China→VE). Se muestra siempre que
 * haya un zarpe abierto; si no hay → null (la card se oculta, degradación honesta).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpaceLevel } from "@/lib/studio/naviera/types";

/** Forma magra del zarpe para el portal (sin datos internos: carrier_id, notes). */
export type PortalSailing = {
  id: string;
  vessel: string;
  pol: string;
  pod: string;
  /** ISO date (YYYY-MM-DD) o null. */
  etd: string | null;
  eta: string | null;
  cutoff: string | null;
  transitDays: number | null;
  space: SpaceLevel;
};

type SailingRow = {
  id: string;
  vessel: string;
  pol: string;
  pod: string;
  etd: string | null;
  eta: string | null;
  cutoff: string | null;
  transit_days: number | null;
  space: string;
};

function mapRow(row: SailingRow): PortalSailing {
  return {
    id: row.id,
    vessel: row.vessel,
    pol: row.pol,
    pod: row.pod,
    etd: row.etd,
    eta: row.eta,
    cutoff: row.cutoff,
    transitDays: row.transit_days,
    space: (row.space as SpaceLevel) ?? "alta",
  };
}

/**
 * El próximo zarpe ABIERTO del tenant con cut-off aún vigente (>= hoy), por
 * cut-off ascendente. Recibe el admin client (el portal no tiene RLS sobre
 * `sailings`) y `todayIso` (YYYY-MM-DD) inyectado por el caller. null si no hay.
 */
export async function getNextOpenSailing(
  admin: SupabaseClient,
  tenantId: string,
  todayIso: string,
): Promise<PortalSailing | null> {
  const { data, error } = await admin
    .from("sailings")
    .select("id, vessel, pol, pod, etd, eta, cutoff, transit_days, space")
    .eq("tenant_id", tenantId)
    .eq("status", "abierto")
    .gte("cutoff", todayIso)
    .is("deleted_at", null)
    .order("cutoff", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle<SailingRow>();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Días completos entre hoy y el cut-off (>= 0). Función pura, testeable. Devuelve
 * null si la fecha no es parseable. Compara por fecha de calendario (no horas).
 */
export function daysUntil(
  targetIso: string | null,
  todayIso: string,
): number | null {
  if (!targetIso) return null;
  const target = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(today)) return null;
  const diff = Math.round((target - today) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

/** Label de espacio de cara al cliente (no la jerga interna alta/media/baja). */
export function portalSpaceLabel(space: SpaceLevel): string {
  switch (space) {
    case "alta":
      return "Buen espacio disponible";
    case "media":
      return "Espacio limitado";
    case "baja":
      return "Poco espacio";
    case "cerrada":
      return "Cupo cerrado";
  }
}
