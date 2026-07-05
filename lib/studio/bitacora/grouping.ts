/**
 * Vistas derivadas de la Lista de Bitácora (SDD-0146 · Fase 6). Todo PURO
 * (sin red, sin reloj) → testeable en Vitest.
 *
 *  - `groupTasksByPerson`: agrupa por dueño (DRI) con progreso hechas/total
 *    por persona + progreso global. Es la vista "Por persona" que el founder
 *    validó en su HTML piloto. Sin dueño → bucket "Sin asignar" (siempre al
 *    final). Color solo para significado: el progreso usa UN token, no arcoíris.
 *  - `filterEsperandoCliente` / `countEsperandoCliente`: filtro "Esperando al
 *    cliente" del tablero (solo tareas tipo `entregable_cliente`).
 */

import { prioridadRank } from "./bitacora-types";

/** Clave estable del bucket "sin dueño". */
export const UNASSIGNED_KEY = "__unassigned__";

/** Shape mínimo para agrupar (los tests usan fixtures chicos). */
export interface PersonGroupable {
  id: string;
  estado: string;
  assignees: { user_id: string }[];
  due_date?: string | null;
  prioridad?: string;
  orden?: number;
  titulo?: string;
}

export interface PersonProgress<T extends PersonGroupable> {
  /** userId del dueño, o `UNASSIGNED_KEY` para el bucket sin asignar. */
  key: string;
  userId: string | null;
  name: string;
  tasks: T[];
  /** Tareas en estado `hecho` dentro del grupo. */
  done: number;
  /** Total de tareas del grupo. */
  total: number;
}

export interface PersonGrouping<T extends PersonGroupable> {
  groups: PersonProgress<T>[];
  globalDone: number;
  globalTotal: number;
}

/** `hecho` al final; el resto por orden de flujo estable. */
function estadoRank(estado: string): number {
  return estado === "hecho" ? 1 : 0;
}

/** Comparador de tareas dentro de un grupo (abiertas → vencimiento → prioridad). */
function cmpTask<T extends PersonGroupable>(a: T, b: T): number {
  const er = estadoRank(a.estado) - estadoRank(b.estado);
  if (er !== 0) return er;
  const dueA = a.due_date ?? "9999-12-31";
  const dueB = b.due_date ?? "9999-12-31";
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;
  const pr = prioridadRank(a.prioridad ?? "media") - prioridadRank(b.prioridad ?? "media");
  if (pr !== 0) return pr;
  const or = (a.orden ?? 0) - (b.orden ?? 0);
  if (or !== 0) return or;
  return (a.titulo ?? "").localeCompare(b.titulo ?? "", "es");
}

/**
 * Agrupa por dueño (DRI = `assignees[0]`) con progreso por persona + global.
 *
 * - Dueño resuelto por `nameByUserId` (si falta el nombre → "Usuario").
 * - Sin dueño → bucket "Sin asignar" (`UNASSIGNED_KEY`), SIEMPRE al final.
 * - Grupos ordenados alfabéticamente por nombre (es), "Sin asignar" al final.
 * - `done` = tareas en `hecho`; el progreso es `done/total`.
 */
export function groupTasksByPerson<T extends PersonGroupable>(
  tasks: readonly T[],
  nameByUserId: Record<string, string>,
): PersonGrouping<T> {
  const buckets = new Map<string, PersonProgress<T>>();
  let globalDone = 0;

  for (const t of tasks) {
    const userId = t.assignees[0]?.user_id ?? null;
    const key = userId ?? UNASSIGNED_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        userId,
        name: userId ? (nameByUserId[userId] ?? "Usuario") : "Sin asignar",
        tasks: [],
        done: 0,
        total: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.tasks.push(t);
    bucket.total += 1;
    if (t.estado === "hecho") {
      bucket.done += 1;
      globalDone += 1;
    }
  }

  const groups = [...buckets.values()];
  for (const g of groups) g.tasks.sort(cmpTask);
  groups.sort((a, b) => {
    // "Sin asignar" siempre al final.
    if (a.key === UNASSIGNED_KEY) return 1;
    if (b.key === UNASSIGNED_KEY) return -1;
    return a.name.localeCompare(b.name, "es");
  });

  return { groups, globalDone, globalTotal: tasks.length };
}

/** Solo las tareas tipo `entregable_cliente` (filtro "Esperando al cliente"). */
export function filterEsperandoCliente<T extends { tipo: string }>(
  tasks: readonly T[],
): T[] {
  return tasks.filter((t) => t.tipo === "entregable_cliente");
}

/** Conteo de tareas tipo `entregable_cliente` (para mostrar el chip y su badge). */
export function countEsperandoCliente<T extends { tipo: string }>(
  tasks: readonly T[],
): number {
  let n = 0;
  for (const t of tasks) if (t.tipo === "entregable_cliente") n += 1;
  return n;
}

// ─── Cola "Para Claude Code" (tareas para_agente) ─────────────

/** Shape mínimo para la cola de agente (los tests usan fixtures chicos). */
export interface AgentQueueable {
  estado: string;
  para_agente: boolean;
}

export interface AgentQueueSplit<T> {
  /** para_agente accionables (estado != 'hecho'), en el orden de entrada. */
  pendientes: T[];
  /** para_agente ya en 'hecho', en el orden de entrada. */
  hechas: T[];
}

/**
 * Filtra las tareas `para_agente` y las parte en pendientes (accionables) y
 * hechas, preservando el orden de entrada (que ya viene por vencimiento desde
 * `listTasks`). Las que no son `para_agente` se descartan. PURA → testeable.
 */
export function partitionAgentTasks<T extends AgentQueueable>(
  tasks: readonly T[],
): AgentQueueSplit<T> {
  const pendientes: T[] = [];
  const hechas: T[] = [];
  for (const t of tasks) {
    if (!t.para_agente) continue;
    if (t.estado === "hecho") hechas.push(t);
    else pendientes.push(t);
  }
  return { pendientes, hechas };
}
