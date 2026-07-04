/**
 * Queries de Bitácora (SDD-0146 · Fase 1).
 *
 * Funciones puras que reciben SupabaseClient (patrón de la casa). Las de red
 * degradan a []/0 si la tabla aún no existe en la DB (las migraciones 0213/0214
 * las aplica el founder — mientras tanto /m/erp y /studio no deben romper).
 *
 * `groupTasksForHoy` es PURA (sin red, sin reloj) → testeable en Vitest.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  prioridadRank,
  type BitacoraPrioridad,
  type BitacoraTaskEstado,
  type BitacoraTaskTipo,
} from "./bitacora-types";

// ─── Shapes de fila (match 0213) ─────────────────────────────

export interface BitacoraChecklistItem {
  id: string;
  texto: string;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  orden: number;
}

export interface BitacoraAssignee {
  user_id: string;
}

export interface BitacoraTask {
  id: string;
  tenant_id: string;
  meeting_id: string | null;
  titulo: string;
  descripcion: string | null;
  estado: BitacoraTaskEstado;
  prioridad: BitacoraPrioridad;
  tipo: BitacoraTaskTipo;
  assigned_role: string | null;
  para_agente: boolean;
  client_id: string | null;
  responsable_nombre: string | null;
  due_date: string | null;
  orden: number;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignees: BitacoraAssignee[];
  checklist: BitacoraChecklistItem[];
}

export interface AssignableProfile {
  user_id: string;
  display_name: string;
}

const TASK_SELECT =
  "id, tenant_id, meeting_id, titulo, descripcion, estado, prioridad, tipo, assigned_role, para_agente, client_id, responsable_nombre, due_date, orden, completed_at, created_by, created_at, updated_at, assignees:bitacora_task_assignees(user_id), checklist:bitacora_task_checklist(id, texto, done, done_by, done_at, orden)";

function normalizeTask(row: BitacoraTask): BitacoraTask {
  return {
    ...row,
    assignees: row.assignees ?? [],
    checklist: [...(row.checklist ?? [])].sort((a, b) => a.orden - b.orden),
  };
}

/**
 * Lista de tareas del tenant (RLS filtra) con asignados + checklist embebidos
 * en UNA query PostgREST. Default: solo abiertas + hechas recientes quedan al
 * criterio del caller vía `includeDone`.
 */
export async function listTasks(
  supabase: SupabaseClient,
  opts: { includeDone?: boolean; limit?: number } = {},
): Promise<BitacoraTask[]> {
  let query = supabase
    .from("bitacora_tasks")
    .select(TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 500);

  if (!opts.includeDone) {
    query = query.neq("estado", "hecho");
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as BitacoraTask[]).map(normalizeTask);
}

/** Una tarea con relaciones (o null si no existe / sin permiso / sin tabla). */
export async function getTask(
  supabase: SupabaseClient,
  id: string,
): Promise<BitacoraTask | null> {
  const { data, error } = await supabase
    .from("bitacora_tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeTask(data as unknown as BitacoraTask);
}

/** Pool de asignables V1 (staff con cuenta Studio) vía RPC. Degrada a []. */
export async function listAssignableProfiles(
  supabase: SupabaseClient,
): Promise<AssignableProfile[]> {
  const { data, error } = await supabase.rpc("bitacora_assignable_profiles");
  if (error || !Array.isArray(data)) return [];
  return data as AssignableProfile[];
}

/**
 * Count barato de tareas ABIERTAS asignadas al user (badge del tab móvil).
 * head:true → sin filas por el cable. Degrada a 0 (tabla aún sin aplicar).
 */
export async function countMyOpenTasks(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("bitacora_task_assignees")
    .select("task_id, task:bitacora_tasks!inner(estado)", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .neq("task.estado", "hecho");
  if (error || count == null) return 0;
  return count;
}

// ─── Agrupación de la vista Hoy (PURA) ───────────────────────

/** Shape mínimo que la agrupación necesita (los tests usan fixtures chicos). */
export interface HoyGroupable {
  estado: string;
  prioridad: string;
  due_date: string | null;
  orden?: number;
  titulo?: string;
}

export interface HoyGroups<T extends HoyGroupable> {
  atrasadas: T[];
  paraHoy: T[];
  proximas: T[];
  sinFecha: T[];
}

/**
 * Agrupa tareas para la vista Hoy: Atrasadas (due < hoy) → Para hoy (due =
 * hoy) → Próximas (due > hoy) → Sin fecha. Excluye `hecho` (la vista lista lo
 * accionable). Orden dentro de cada grupo: due_date asc, luego prioridad
 * alta→media→baja, luego `orden`, luego título (estable).
 *
 * PURA: `hoyISO` viene inyectado (calculado server-side en America/Caracas).
 */
export function groupTasksForHoy<T extends HoyGroupable>(
  tasks: readonly T[],
  hoyISO: string,
): HoyGroups<T> {
  const atrasadas: T[] = [];
  const paraHoy: T[] = [];
  const proximas: T[] = [];
  const sinFecha: T[] = [];

  for (const t of tasks) {
    if (t.estado === "hecho") continue;
    if (!t.due_date) {
      sinFecha.push(t);
    } else if (t.due_date < hoyISO) {
      atrasadas.push(t);
    } else if (t.due_date === hoyISO) {
      paraHoy.push(t);
    } else {
      proximas.push(t);
    }
  }

  const cmp = (a: T, b: T): number => {
    const dueA = a.due_date ?? "9999-12-31";
    const dueB = b.due_date ?? "9999-12-31";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    const pr = prioridadRank(a.prioridad) - prioridadRank(b.prioridad);
    if (pr !== 0) return pr;
    const or = (a.orden ?? 0) - (b.orden ?? 0);
    if (or !== 0) return or;
    return (a.titulo ?? "").localeCompare(b.titulo ?? "", "es");
  };

  atrasadas.sort(cmp);
  paraHoy.sort(cmp);
  proximas.sort(cmp);
  sinFecha.sort(cmp);

  return { atrasadas, paraHoy, proximas, sinFecha };
}
