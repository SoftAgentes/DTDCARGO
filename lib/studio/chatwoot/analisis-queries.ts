import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PIEZAS, type Informe, type MotivoRespaldo, type PiezaInforme, type Recomendacion } from "./analisis";

/**
 * Lecturas y escrituras de `chatwoot_version_analyses` (0509, SDD-0588, paso 3.4).
 * La escribe solo service_role (la acción, después del gate de admin); la lee el
 * admin del tenant. Sin la 0509 las lecturas devuelven null o 0 y la
 * escritura devuelve false: la pantalla no muestra informe.
 */

export interface AnalisisGuardado {
  id: number;
  desde: string;
  hasta: string;
  motor: "glm" | "sin_ia";
  modelo: string | null;
  motivoRespaldo: MotivoRespaldo | null;
  informe: Informe;
  archivos: number;
  caracteres: number;
  recortado: boolean;
  creado: string;
}

interface FilaAnalisis {
  id: number;
  from_version: string;
  to_version: string;
  engine: "glm" | "sin_ia";
  model: string | null;
  recommendation: Recomendacion;
  report: unknown;
  package_files: number;
  package_chars: number;
  truncated: boolean;
  fallback_reason: MotivoRespaldo | null;
  created_at: string;
}

const COLUMNAS =
  "id, from_version, to_version, engine, model, recommendation, report, package_files, package_chars, truncated, fallback_reason, created_at";

function aAnalisis(f: FilaAnalisis): AnalisisGuardado {
  const r = (f.report && typeof f.report === "object" ? f.report : {}) as { resumen?: unknown; piezas?: unknown };
  const piezas = Array.isArray(r.piezas) ? (r.piezas as PiezaInforme[]).filter((p) => PIEZAS.some((x) => x.id === p?.id)) : [];
  return {
    id: Number(f.id),
    desde: f.from_version,
    hasta: f.to_version,
    motor: f.engine,
    modelo: f.model,
    motivoRespaldo: f.fallback_reason,
    informe: { recomendacion: f.recommendation, resumen: typeof r.resumen === "string" ? r.resumen : "", piezas },
    archivos: f.package_files,
    caracteres: f.package_chars,
    recortado: f.truncated,
    creado: f.created_at,
  };
}

/** El análisis más reciente del salto; con `soloConIa`, el más reciente hecho por el motor. */
export async function ultimoAnalisis(
  db: SupabaseClient,
  tenantId: string,
  desde: string,
  hasta: string,
  opciones: { soloConIa?: boolean; desdeFecha?: Date } = {},
): Promise<AnalisisGuardado | null> {
  let q = db
    .from("chatwoot_version_analyses")
    .select(COLUMNAS)
    .eq("tenant_id", tenantId)
    .eq("from_version", desde)
    .eq("to_version", hasta);
  if (opciones.soloConIa) q = q.eq("engine", "glm");
  if (opciones.desdeFecha) q = q.gte("created_at", opciones.desdeFecha.toISOString());
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return aAnalisis(data as FilaAnalisis);
}

/** Cuántos análisis hizo el tenant desde `desdeFecha` (tope diario). null si no se pudo contar. */
export async function contarAnalisis(admin: SupabaseClient, tenantId: string, desdeFecha: Date): Promise<number | null> {
  const { count, error } = await admin
    .from("chatwoot_version_analyses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", desdeFecha.toISOString());
  if (error || typeof count !== "number") return null;
  return count;
}

export async function guardarAnalisis(
  admin: SupabaseClient,
  fila: {
    tenantId: string;
    desde: string;
    hasta: string;
    checkId: number | null;
    usuarioId: string;
    motor: "glm" | "sin_ia";
    modelo: string | null;
    motivoRespaldo: MotivoRespaldo | null;
    informe: Informe;
    archivos: number;
    caracteres: number;
    recortado: boolean;
  },
): Promise<boolean> {
  const { error } = await admin.from("chatwoot_version_analyses").insert({
    tenant_id: fila.tenantId,
    from_version: fila.desde,
    to_version: fila.hasta,
    check_id: fila.checkId,
    requested_by: fila.usuarioId,
    engine: fila.motor,
    model: fila.modelo,
    recommendation: fila.informe.recomendacion,
    report: { resumen: fila.informe.resumen, piezas: fila.informe.piezas },
    package_files: fila.archivos,
    package_chars: fila.caracteres,
    truncated: fila.recortado,
    fallback_reason: fila.motivoRespaldo,
  });
  if (error) {
    console.warn(`[chatwoot-analisis] no se guardó el análisis: ${error.code ?? "sin código"}`);
    return false;
  }
  return true;
}
