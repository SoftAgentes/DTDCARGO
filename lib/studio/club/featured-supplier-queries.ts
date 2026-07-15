/**
 * Queries de lectura del "Proveedor del mes" del Club (SDD-0116, Slice D).
 * Funciones puras que reciben un SupabaseClient (RLS scope-a por tenant).
 * Devuelven [] ante error (no lanzan).
 *
 * D8: el proveedor se respalda con una inspección VERIFICADA (SDD-0066). La lista
 * de inspecciones elegibles = reportes 'final' (emitidos) del tenant. Nunca se
 * expone provider_internal (white-label, regla SDD-0066).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeaturedSupplier } from "@/lib/studio/club/featured-supplier-types";

type SupplierRow = {
  id: string;
  period: string;
  supplier_name: string;
  inspection_id: string | null;
  category: string | null;
  blurb: string | null;
  cover_path: string | null;
  status: "borrador" | "publicado";
};

/** Inspección elegible para respaldar un proveedor del mes (white-label). */
export interface EligibleInspection {
  id: string;
  reportNo: string;
  title: string;
  /** product_psi | factory_audit. */
  type: string;
}

/**
 * Proveedores del mes vivos, ordenados por período (más reciente primero). Adjunta
 * el report_no de la inspección ligada (NO el provider_internal — white-label).
 */
export async function listFeaturedSuppliers(
  supabase: SupabaseClient,
): Promise<FeaturedSupplier[]> {
  const { data } = await supabase
    .from("club_featured_suppliers")
    .select("id, period, supplier_name, inspection_id, category, blurb, cover_path, status")
    .is("deleted_at", null)
    .order("period", { ascending: false });

  const rows = (data ?? []) as SupplierRow[];
  if (rows.length === 0) return [];

  // report_no de las inspecciones ligadas (para mostrar, NUNCA el proveedor crudo).
  const inspectionIds = Array.from(
    new Set(rows.map((r) => r.inspection_id).filter((v): v is string => Boolean(v))),
  );
  const reportNoById = new Map<string, string>();
  if (inspectionIds.length > 0) {
    const { data: iData } = await supabase
      .from("inspection_reports")
      .select("id, report_no")
      .in("id", inspectionIds);
    for (const i of (iData ?? []) as { id: string; report_no: string }[]) {
      reportNoById.set(i.id, i.report_no);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    supplierName: r.supplier_name,
    inspectionId: r.inspection_id,
    category: r.category,
    blurb: r.blurb,
    coverPath: r.cover_path,
    status: r.status,
    inspectionReportNo: r.inspection_id ? reportNoById.get(r.inspection_id) ?? null : null,
  }));
}

/**
 * Inspecciones elegibles para respaldar un proveedor del mes (D8): reportes
 * emitidos ('final') del tenant. Devuelve solo datos white-label (id, report_no,
 * título, tipo) — NUNCA provider_internal. Ordenadas por fecha desc.
 */
export async function listEligibleInspections(
  supabase: SupabaseClient,
): Promise<EligibleInspection[]> {
  const { data } = await supabase
    .from("inspection_reports")
    .select("id, report_no, title, type, inspection_date")
    .eq("status", "final")
    .is("deleted_at", null)
    .order("inspection_date", { ascending: false, nullsFirst: false })
    .limit(200);

  return ((data ?? []) as {
    id: string;
    report_no: string;
    title: string;
    type: string;
  }[]).map((r) => ({
    id: r.id,
    reportNo: r.report_no,
    title: r.title,
    type: r.type,
  }));
}
