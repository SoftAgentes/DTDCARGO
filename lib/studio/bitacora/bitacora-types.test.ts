// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  nextEstado,
  prioridadRank,
  validateBitacoraTaskInput,
} from "./bitacora-types";
import { dueDateLabel, isIsoDate, todayCaracasISO } from "./dates";

describe("validateBitacoraTaskInput (SDD-0146 · aceptación Fase 1)", () => {
  it("título vacío → fieldError, sin input", () => {
    const r = validateBitacoraTaskInput({ titulo: "   " });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.titulo).toBeTruthy();
  });

  it("título ausente → fieldError", () => {
    const r = validateBitacoraTaskInput({});
    expect(r.fieldErrors?.titulo).toBeTruthy();
  });

  it("título > 300 chars → fieldError", () => {
    const r = validateBitacoraTaskInput({ titulo: "x".repeat(301) });
    expect(r.fieldErrors?.titulo).toBeTruthy();
  });

  it("prioridad inválida → normaliza a 'media' (espejo del post-proceso)", () => {
    const r = validateBitacoraTaskInput({
      titulo: "Llamar a naviera",
      prioridad: "urgentísima",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.prioridad).toBe("media");
  });

  it("prioridad válida se respeta", () => {
    const r = validateBitacoraTaskInput({ titulo: "T", prioridad: "alta" });
    expect(r.input?.prioridad).toBe("alta");
  });

  it("tipo inválido → normaliza a 'empleado'", () => {
    const r = validateBitacoraTaskInput({ titulo: "T", tipo: "externo" });
    expect(r.input?.tipo).toBe("empleado");
  });

  it("due_date malformada → fieldError (solo ISO estricto)", () => {
    for (const bad of ["12/03/2026", "2026-3-9", "mañana", "2026-13-01", "2026-02-30"]) {
      const r = validateBitacoraTaskInput({ titulo: "T", due_date: bad });
      expect(r.fieldErrors?.due_date, `due_date "${bad}" debía fallar`).toBeTruthy();
    }
  });

  it("due_date ISO válida pasa; vacía → null", () => {
    const ok = validateBitacoraTaskInput({ titulo: "T", due_date: "2026-07-04" });
    expect(ok.input?.due_date).toBe("2026-07-04");
    const empty = validateBitacoraTaskInput({ titulo: "T", due_date: "" });
    expect(empty.input?.due_date).toBeNull();
  });

  it("dueño Y cola a la vez → el dueño gana (assigned_role se anula)", () => {
    const r = validateBitacoraTaskInput({
      titulo: "T",
      assignee_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      assigned_role: "operations",
    });
    expect(r.input?.assignee_id).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(r.input?.assigned_role).toBeNull();
  });

  it("assignee_id con shape inválido → fieldError", () => {
    const r = validateBitacoraTaskInput({ titulo: "T", assignee_id: "pedro" });
    expect(r.fieldErrors?.assignee_id).toBeTruthy();
  });

  it("assigned_role fuera del vocabulario → fieldError (llamada forjada)", () => {
    const r = validateBitacoraTaskInput({ titulo: "T", assigned_role: "gerente" });
    expect(r.fieldErrors?.assigned_role).toBeTruthy();
  });

  it("para_agente acepta 'on' del checkbox HTML", () => {
    const r = validateBitacoraTaskInput({ titulo: "T", para_agente: "on" });
    expect(r.input?.para_agente).toBe(true);
    const off = validateBitacoraTaskInput({ titulo: "T" });
    expect(off.input?.para_agente).toBe(false);
  });
});

describe("nextEstado · flujo de avance", () => {
  it("recorre los 4 estados en orden y termina en null", () => {
    expect(nextEstado("pendiente")).toBe("en_curso");
    expect(nextEstado("en_curso")).toBe("en_revision");
    expect(nextEstado("en_revision")).toBe("hecho");
    expect(nextEstado("hecho")).toBeNull();
  });
});

describe("prioridadRank · alta→media→baja", () => {
  it("ordena alta < media < baja < desconocida", () => {
    expect(prioridadRank("alta")).toBeLessThan(prioridadRank("media"));
    expect(prioridadRank("media")).toBeLessThan(prioridadRank("baja"));
    expect(prioridadRank("baja")).toBeLessThan(prioridadRank("otra"));
  });
});

describe("dates · hoy en Caracas (UTC-4 fijo)", () => {
  it("todayCaracasISO devuelve YYYY-MM-DD", () => {
    expect(todayCaracasISO(new Date("2026-07-04T12:00:00Z"))).toBe("2026-07-04");
  });

  it("a las 02:00 UTC todavía es 'ayer' en Caracas (22:00 VE)", () => {
    expect(todayCaracasISO(new Date("2026-07-05T02:00:00Z"))).toBe("2026-07-04");
  });

  it("a las 05:00 UTC ya es el día nuevo en Caracas (01:00 VE)", () => {
    expect(todayCaracasISO(new Date("2026-07-05T05:00:00Z"))).toBe("2026-07-05");
  });

  it("isIsoDate acepta solo fechas reales con shape estricto", () => {
    expect(isIsoDate("2026-07-04")).toBe(true);
    expect(isIsoDate("2026-7-4")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("04-07-2026")).toBe(false);
  });

  it("dueDateLabel: Hoy / Mañana / Ayer relativos al hoy inyectado", () => {
    expect(dueDateLabel("2026-07-04", "2026-07-04")).toBe("Hoy");
    expect(dueDateLabel("2026-07-05", "2026-07-04")).toBe("Mañana");
    expect(dueDateLabel("2026-07-03", "2026-07-04")).toBe("Ayer");
  });
});
