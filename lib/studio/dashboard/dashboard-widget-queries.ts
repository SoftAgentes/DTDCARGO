/**
 * Datos de los widgets del dashboard configurable (SDD-0114 · Slice B).
 *
 * Los widgets del Norte que traían data MOCK (`chart`, `activeShipments`,
 * `upcomingEta`) se cablean acá contra `shipments` reales del tenant (RLS). Los
 * widgets transversales que ya tenían fuente en prod (`recentActivity`,
 * `quickActions`, `alerts`) se alimentan desde el page con lo ya fetcheado.
 *
 * Funciones puras `(supabase, …) => Promise<T>`, degradan a vacío ante error.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

/** Statuses NO activos (no aparecen en "en curso" ni en el gráfico de volumen). */
const INACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "delivered",
  "cancelled",
]);

export type ActiveShipmentPreview = {
  id: string;
  code: string;
  clientName: string | null;
  status: ShipmentStatus;
  destination: string | null;
  createdAt: string;
};

/** Embarques activos del tenant, más recientes primero (para 2 widgets). */
export async function getActiveShipmentsPreview(
  supabase: SupabaseClient,
  limit = 6,
): Promise<ActiveShipmentPreview[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, client_name, status, destination, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .filter((r) => !INACTIVE_STATUSES.has(String(r.status)))
    .slice(0, limit)
    .map((r) => ({
      id: String(r.id),
      code: String(r.code),
      clientName: (r.client_name as string | null) ?? null,
      status: r.status as ShipmentStatus,
      destination: (r.destination as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
}

export type MonthlyVolumePoint = { label: string; value: number };

const MONTH_LABELS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

/**
 * CBM recibido por mes en los últimos 12 meses (para el ChartWidget). Suma
 * `volume_m3` agrupando por mes de creación. Devuelve SIEMPRE 12 puntos (rellena
 * meses sin data con 0) para que el gráfico no salte de ancho.
 */
export async function getMonthlyVolume(
  supabase: SupabaseClient,
): Promise<MonthlyVolumePoint[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const fromIso = from.toISOString().slice(0, 10);

  // Paginado: el CBM mensual del widget se suma sobre estas filas.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("shipments")
        .select("volume_m3, created_at")
        .is("deleted_at", null)
        .gte("created_at", fromIso)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Los embarques del período superan el tope de lectura.");
  }

  // 12 buckets: index 0 = hace 11 meses … index 11 = mes actual.
  const buckets: MonthlyVolumePoint[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    buckets.push({ label: MONTH_LABELS[d.getMonth()], value: 0 });
  }

  if (data.length === 0) return buckets;

  for (const raw of data) {
    const created = String(raw.created_at ?? "");
    const dt = new Date(created);
    if (Number.isNaN(dt.getTime())) continue;
    const idx =
      (dt.getFullYear() - from.getFullYear()) * 12 + (dt.getMonth() - from.getMonth());
    if (idx < 0 || idx > 11) continue;
    buckets[idx].value += Number(raw.volume_m3) || 0;
  }

  return buckets.map((b) => ({ label: b.label, value: Math.round(b.value * 10) / 10 }));
}
