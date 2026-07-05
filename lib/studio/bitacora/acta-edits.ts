/**
 * lib/studio/bitacora/acta-edits.ts · SDD-0146 (mejora "volver a generar tareas").
 *
 * Helper PURO de la pantalla de revisión del acta. `tasksHaveManualEdits`
 * compara la propuesta ACTUAL contra la línea base (la última propuesta de la
 * IA) para decidir si el humano ya ajustó tareas — dueño, fecha, prioridad,
 * checklist, título, `para_agente`, o si quitó/agregó tareas. Sirve para avisar
 * (ConfirmDialog) antes de reemplazar esas tareas al regenerar.
 *
 * Sin red, sin reloj, sin React → testeable 1:1 en Vitest.
 */

/** Campos editables por el humano que definen "hubo un ajuste manual". */
export interface ReviewTaskSnapshot {
  _id: string;
  titulo: string;
  assignee_user_id: string | null;
  prioridad: string;
  due_date: string | null;
  para_agente: boolean;
  checklist: string[];
}

/** Igualdad ordenada de dos listas de sub-pasos (orden importa: reordenar = editar). */
function sameChecklist(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * ¿El humano tocó alguna tarea respecto de la propuesta base? true si cambió el
 * número de tareas (quitó o agregó) o si en alguna difiere título (trim), dueño,
 * prioridad, fecha, `para_agente` o checklist. Empareja por `_id` estable.
 */
export function tasksHaveManualEdits(
  current: readonly ReviewTaskSnapshot[],
  baseline: readonly ReviewTaskSnapshot[],
): boolean {
  if (current.length !== baseline.length) return true;

  const baseById = new Map(baseline.map((t) => [t._id, t]));
  for (const t of current) {
    const b = baseById.get(t._id);
    if (!b) return true; // tarea que no estaba en la base
    if (t.titulo.trim() !== b.titulo.trim()) return true;
    if ((t.assignee_user_id ?? null) !== (b.assignee_user_id ?? null)) return true;
    if (t.prioridad !== b.prioridad) return true;
    if ((t.due_date ?? null) !== (b.due_date ?? null)) return true;
    if (t.para_agente !== b.para_agente) return true;
    if (!sameChecklist(t.checklist, b.checklist)) return true;
  }
  return false;
}
