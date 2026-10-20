/**
 * SDD-0566 · Lecturas del cierre contable con superclave (lado servidor).
 *
 * El estado sale de la RPC `estado_cierre_contable` (0493), que nunca devuelve
 * el hash. Las excepciones y el historial son tablas de solo lectura para el
 * tenant; se leen paginadas, porque un reporte cortado mentiría.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type {
  AvisoCierre,
  EventoDelCierre,
  ExcepcionAlCierre,
  ModoCierre,
  OperacionCierre,
  TipoEventoCierre,
} from "./cierre-excepciones";

export type EstadoCierre = {
  closingDate: string | null;
  modo: ModoCierre;
  superclaveDefinida: boolean;
  /** ISO, si la superclave está bloqueada por intentos fallidos. */
  bloqueadaHasta: string | null;
};

const SIN_CIERRE: EstadoCierre = {
  closingDate: null,
  modo: "superclave",
  superclaveDefinida: false,
  bloqueadaHasta: null,
};

/** El estado del cierre del tenant del usuario. Un error se propaga: no se inventa «abierto». */
export async function getEstadoCierre(supabase: SupabaseClient): Promise<EstadoCierre> {
  const { data, error } = await supabase.rpc("estado_cierre_contable");
  if (error) throw error;
  const d = (data ?? null) as Record<string, unknown> | null;
  if (!d) return SIN_CIERRE;
  return {
    closingDate: (d.closing_date as string | null) ?? null,
    modo: d.closing_mode === "advertencia" ? "advertencia" : "superclave",
    superclaveDefinida: d.superclave_definida === true,
    bloqueadaHasta: (d.bloqueada_hasta as string | null) ?? null,
  };
}

/** El aviso para el diálogo, si hay cierre. */
export function avisoDe(estado: EstadoCierre): AvisoCierre | null {
  if (!estado.closingDate) return null;
  return { closingDate: estado.closingDate, modo: estado.modo, superclaveDefinida: estado.superclaveDefinida };
}

type NombreDe = (userId: string | null) => string;

export async function listExcepcionesAlCierre(
  supabase: SupabaseClient,
  nombreDe: NombreDe,
): Promise<ExcepcionAlCierre[]> {
  const { rows, complete } = await fetchAllPaged<Record<string, unknown>>((d, h) =>
    supabase
      .from("accounting_closing_exceptions")
      .select(
        "id, entry_id, entry_code, entry_date, closing_date, operation, authorized_by, reason, amount_before, amount_after, user_id, created_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Las excepciones al cierre superan el tope de lectura.");
  return rows.map((r) => ({
    id: String(r.id),
    entryId: String(r.entry_id),
    entryCode: String(r.entry_code),
    entryDate: String(r.entry_date),
    closingDate: String(r.closing_date),
    operation: r.operation as OperacionCierre,
    authorizedBy: r.authorized_by === "advertencia" ? "advertencia" : "superclave",
    reason: String(r.reason ?? ""),
    amountBefore: Number(r.amount_before) || 0,
    amountAfter: Number(r.amount_after) || 0,
    userName: nombreDe((r.user_id as string | null) ?? null),
    createdAt: String(r.created_at),
  }));
}

export async function listHistorialDelCierre(
  supabase: SupabaseClient,
  nombreDe: NombreDe,
): Promise<EventoDelCierre[]> {
  const { rows, complete } = await fetchAllPaged<Record<string, unknown>>((d, h) =>
    supabase
      .from("accounting_closing_events")
      .select("id, kind, old_value, new_value, reason, user_id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("El historial del cierre supera el tope de lectura.");
  return rows.map((r) => ({
    id: String(r.id),
    kind: r.kind as TipoEventoCierre,
    oldValue: (r.old_value as string | null) ?? null,
    newValue: (r.new_value as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    userName: nombreDe((r.user_id as string | null) ?? null),
    createdAt: String(r.created_at),
  }));
}

/** El nombre de cada usuario, o una etiqueta honesta si no se conoce. */
export function nombresDeUsuarios(
  miembros: readonly { userId: string; name: string | null }[],
): NombreDe {
  const porId = new Map(miembros.map((m) => [m.userId, m.name]));
  return (userId) => {
    if (!userId) return "Sistema";
    const n = porId.get(userId);
    if (n) return n;
    return porId.has(userId) ? "Usuario sin nombre" : "Usuario que ya no está activo";
  };
}
