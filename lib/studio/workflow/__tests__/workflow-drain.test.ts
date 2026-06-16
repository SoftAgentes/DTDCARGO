import { describe, it, expect } from "vitest";
import {
  planDrainAction,
  buildNoteBody,
  type DrainRun,
} from "../workflow-drain";

const UUID = "11111111-1111-1111-1111-111111111111";

const run = (over: Partial<DrainRun>): DrainRun => ({
  id: "r1",
  tenant_id: "t1",
  source_kind: "shipment",
  source_id: UUID,
  node_kind: "crear_tarea",
  nombre: "Pedir datos del proveedor",
  owner_role: "operations",
  ...over,
});

describe("planDrainAction", () => {
  it("crear_tarea sobre shipment con uuid → nota de timeline", () => {
    const plan = planDrainAction(run({}));
    expect(plan.action).toBe("note");
    if (plan.action === "note") {
      expect(plan.comment).toMatchObject({
        tenant_id: "t1",
        entity_type: "shipment",
        entity_id: UUID,
        author_id: null,
      });
      expect(plan.comment.body).toContain("Pedir datos del proveedor");
    }
  });

  it("recordatorio_interno también se materializa como nota", () => {
    expect(planDrainAction(run({ node_kind: "recordatorio_interno" })).action).toBe(
      "note",
    );
  });

  it("avanzar_estado se DIFIERE (ejecutor pendiente)", () => {
    const plan = planDrainAction(run({ node_kind: "avanzar_estado" }));
    expect(plan.action).toBe("defer");
    if (plan.action === "defer") expect(plan.note).toMatch(/ejecutor pendiente/i);
  });

  it("nota sobre entidad NO comentable se difiere (sin entidad comentable)", () => {
    const plan = planDrainAction(run({ source_kind: "cliente_anuncio" }));
    expect(plan.action).toBe("defer");
    if (plan.action === "defer") expect(plan.note).toMatch(/sin entidad comentable/i);
  });

  it("source_id que no es uuid se difiere (no se puede comentar)", () => {
    const plan = planDrainAction(run({ source_id: "SHP-9" }));
    expect(plan.action).toBe("defer");
  });
});

describe("buildNoteBody", () => {
  it("incluye el nombre y el rol dueño", () => {
    expect(buildNoteBody({ nombre: "Avisar", owner_role: "operations" })).toBe(
      "[Flujo] Avisar · dueño: operations",
    );
  });
  it("sin dueño omite el sufijo", () => {
    expect(buildNoteBody({ nombre: "Avisar", owner_role: null })).toBe(
      "[Flujo] Avisar",
    );
  });
});
