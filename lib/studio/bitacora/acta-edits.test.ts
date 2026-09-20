// @vitest-environment node
import { describe, it, expect } from "vitest";
import { tasksHaveManualEdits, type ReviewTaskSnapshot } from "./acta-edits";

const BASE: ReviewTaskSnapshot[] = [
  {
    _id: "t0",
    titulo: "Cerrar el embarque de Yiwu",
    assignee_user_id: "u1",
    prioridad: "media",
    due_date: "2026-07-10",
    para_agente: false,
    checklist: ["Confirmar CBM", "Pedir factura"],
  },
  {
    _id: "t1",
    titulo: "Cobrar el saldo a Importadora Sol",
    assignee_user_id: null,
    prioridad: "alta",
    due_date: null,
    para_agente: false,
    checklist: [],
  },
];

/** Copia profunda (checklist incluido) para no compartir referencias. */
function clone(ts: ReviewTaskSnapshot[]): ReviewTaskSnapshot[] {
  return ts.map((t) => ({ ...t, checklist: [...t.checklist] }));
}

describe("tasksHaveManualEdits (SDD-0146 · regenerar tareas)", () => {
  it("sin cambios respecto de la base → false", () => {
    expect(tasksHaveManualEdits(clone(BASE), BASE)).toBe(false);
  });

  it("dueño cambiado respecto al sugerido → true", () => {
    const c = clone(BASE);
    c[1].assignee_user_id = "u2";
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("dueño quitado (de asignado a sin asignar) → true", () => {
    const c = clone(BASE);
    c[0].assignee_user_id = null;
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("fecha cambiada → true", () => {
    const c = clone(BASE);
    c[0].due_date = "2026-07-12";
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("prioridad cambiada → true", () => {
    const c = clone(BASE);
    c[1].prioridad = "media";
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("para_agente cambiado → true", () => {
    const c = clone(BASE);
    c[0].para_agente = true;
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("título editado → true", () => {
    const c = clone(BASE);
    c[0].titulo = "Cerrar el embarque de Yiwu YA";
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("solo espacios alrededor del título → false (trim)", () => {
    const c = clone(BASE);
    c[0].titulo = "  Cerrar el embarque de Yiwu  ";
    expect(tasksHaveManualEdits(c, BASE)).toBe(false);
  });

  it("checklist con un sub-paso agregado → true", () => {
    const c = clone(BASE);
    c[0].checklist.push("Avisar al cliente");
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("checklist reordenado → true (el orden importa)", () => {
    const c = clone(BASE);
    c[0].checklist = ["Pedir factura", "Confirmar CBM"];
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("una tarea quitada → true", () => {
    const c = clone(BASE).slice(0, 1);
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("una tarea agregada → true", () => {
    const c = clone(BASE);
    c.push({ ...BASE[0], _id: "t2" });
    expect(tasksHaveManualEdits(c, BASE)).toBe(true);
  });

  it("ambas listas vacías → false", () => {
    expect(tasksHaveManualEdits([], [])).toBe(false);
  });
});
