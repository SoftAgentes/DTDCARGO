/**
 * Queries puras del módulo Inspecciones (SDD-0066 · Fase 1).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/inspecciones/page.tsx`. RLS filtra por tenant. Numéricos
 * `numeric` llegan como string → se coercen con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  num,
  computeInspectionKpis,
  type InspectionReport,
  type InspectionKpis,
  type InspectionType,
  type InspectionConclusion,
  type InspectionStatus,
  type InspectionPayload,
} from "./types";

const REPORT_COLUMNS =
  "id, tenant_id, report_no, type, client_id, client_name, title, product, " +
  "inspection_date, duration_mandays, score, conclusion, status, payload, " +
  "provider_internal, created_by, created_at, updated_at, deleted_at";

/** Coacciona la fila cruda (numeric→number) a InspectionReport tipado. */
function rowToReport(row: Record<string, unknown>): InspectionReport {
  return {
    ...(row as InspectionReport),
    duration_mandays:
      row.duration_mandays == null ? null : num(row.duration_mandays),
    score: row.score == null ? null : num(row.score),
    payload: (row.payload ?? {}) as InspectionPayload,
  };
}

export type ListInspectionFilters = {
  type?: InspectionType;
  status?: InspectionStatus;
  conclusion?: InspectionConclusion;
  client_id?: string;
};

/**
 * Lista los reportes vivos del tenant, más nuevos primero. Filtros opcionales
 * por tipo / estado / cliente (los aplica la query; el listado también filtra
 * client-side para el deep-link).
 */
export async function listInspectionReports(
  supabase: SupabaseClient,
  filters: ListInspectionFilters = {},
): Promise<InspectionReport[]> {
  let q = supabase
    .from("inspection_reports")
    .select(REPORT_COLUMNS)
    .is("deleted_at", null);

  if (filters.type) q = q.eq("type", filters.type);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.conclusion) q = q.eq("conclusion", filters.conclusion);
  if (filters.client_id) q = q.eq("client_id", filters.client_id);

  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) {
    console.error("[listInspectionReports]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToReport(r as unknown as Record<string, unknown>),
  );
}

/** Un reporte por id (o null). */
export async function getInspectionReport(
  supabase: SupabaseClient,
  id: string,
): Promise<InspectionReport | null> {
  const { data, error } = await supabase
    .from("inspection_reports")
    .select(REPORT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getInspectionReport]", error.message);
    return null;
  }
  return data ? rowToReport(data as unknown as Record<string, unknown>) : null;
}

/** Clientes vivos del tenant para el selector del drawer (markbox + nombre). */
export type InspectionClientOption = {
  id: string;
  markbox: string;
  name: string;
};

export async function listInspectionClients(
  supabase: SupabaseClient,
): Promise<InspectionClientOption[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, markbox, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("[listInspectionClients]", error.message);
    return [];
  }
  return (data ?? []) as InspectionClientOption[];
}

/**
 * KPIs del mes corriente (count, aprobados, observados, borradores). Lee solo
 * las columnas necesarias y delega el cálculo a `computeInspectionKpis` (puro).
 */
export async function getInspectionKpis(
  supabase: SupabaseClient,
  ref = new Date(),
): Promise<InspectionKpis> {
  const { data, error } = await supabase
    .from("inspection_reports")
    .select("inspection_date, conclusion, status")
    .is("deleted_at", null);

  if (error || !data) {
    console.error("[getInspectionKpis]", error?.message);
    return {
      month_count: 0,
      month_approved: 0,
      month_observed: 0,
      draft_count: 0,
    };
  }
  return computeInspectionKpis(
    data as {
      inspection_date: string | null;
      conclusion: InspectionConclusion | null;
      status: InspectionStatus;
    }[],
    ref,
  );
}
