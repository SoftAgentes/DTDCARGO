import { describe, it, expect } from "vitest";
import {
  validateWorkflowStepInput,
  planStepRun,
  WORKFLOW_NODE_KINDS,
  GATED_NODE_KINDS,
  AUTOMATABLE_NODE_KINDS,
  type WorkflowStepInput,
  type ServiceWorkflowStep,
} from "../types";
import { buildRunRows } from "../workflow-rule-engine";

const base: Partial<WorkflowStepInput> = {
  nombre: "Avisar al cliente",
  node_kind: "recordatorio_interno",
  automation_level: "manual",
};

describe("validateWorkflowStepInput · básicos", () => {
  it("rechaza un paso sin nombre", () => {
    const { fieldErrors } = validateWorkflowStepInput({ ...base, nombre: "  " });
    expect(fieldErrors?.nombre).toBeTruthy();
  });

  it("rechaza un node_kind inválido", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      ...base,
      node_kind: "teletransporte" as WorkflowStepInput["node_kind"],
    });
    expect(fieldErrors?.node_kind).toBeTruthy();
  });

  it("rechaza un owner_role fuera de los 6", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      ...base,
      owner_role: "ceo" as WorkflowStepInput["owner_role"],
    });
    expect(fieldErrors?.owner_role).toBeTruthy();
  });

  it("rechaza un trigger_event desconocido", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      ...base,
      trigger_event: "evento_inventado",
    });
    expect(fieldErrors?.trigger_event).toBeTruthy();
  });

  it("normaliza: trim, depends_on filtrado, sla null", () => {
    const { input } = validateWorkflowStepInput({
      ...base,
      nombre: "  Paso  ",
      depends_on: ["a", "  ", "b"],
    });
    expect(input?.nombre).toBe("Paso");
    expect(input?.depends_on).toEqual(["a", "b"]);
    expect(input?.sla_hours).toBeNull();
    expect(input?.trigger_event).toBeNull();
  });
});

describe("validateWorkflowStepInput · REGLA DURA (gated/esperar ≠ automatico)", () => {
  it("rechaza enviar_email automatico (escribe al cliente)", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      nombre: "Correo",
      node_kind: "enviar_email",
      automation_level: "automatico",
    });
    expect(fieldErrors?.automation_level).toBeTruthy();
  });

  it("rechaza solicitar_a_tercero automatico (tercero + dinero)", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      nombre: "Pedir a proveedor",
      node_kind: "solicitar_a_tercero",
      automation_level: "automatico",
    });
    expect(fieldErrors?.automation_level).toBeTruthy();
  });

  it("rechaza esperar_confirmacion_humana automatico (es la compuerta)", () => {
    const { fieldErrors } = validateWorkflowStepInput({
      nombre: "Compuerta",
      node_kind: "esperar_confirmacion_humana",
      automation_level: "automatico",
    });
    expect(fieldErrors?.automation_level).toBeTruthy();
  });

  it("acepta enviar_email auto_con_compuerta (tope permitido)", () => {
    const { input, fieldErrors } = validateWorkflowStepInput({
      nombre: "Correo",
      node_kind: "enviar_email",
      automation_level: "auto_con_compuerta",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.automation_level).toBe("auto_con_compuerta");
  });

  it("acepta recordatorio_interno automatico (interno, puede correr solo)", () => {
    const { input, fieldErrors } = validateWorkflowStepInput({
      nombre: "Recordar",
      node_kind: "recordatorio_interno",
      automation_level: "automatico",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.automation_level).toBe("automatico");
  });
});

describe("clasificación de nodos · anti-drift", () => {
  it("gated ∪ automatable ∪ {esperar} cubre los 10 nodos, sin solape", () => {
    const union = new Set([
      ...GATED_NODE_KINDS,
      ...AUTOMATABLE_NODE_KINDS,
      "esperar_confirmacion_humana" as const,
    ]);
    expect(union.size).toBe(WORKFLOW_NODE_KINDS.length);
    for (const k of WORKFLOW_NODE_KINDS) expect(union.has(k)).toBe(true);
    // sin solape gated/automatable
    for (const k of GATED_NODE_KINDS) {
      expect(AUTOMATABLE_NODE_KINDS).not.toContain(k);
    }
  });
});

describe("planStepRun", () => {
  it("automatico + automatable → pending", () => {
    expect(
      planStepRun({ node_kind: "recordatorio_interno", automation_level: "automatico" }),
    ).toBe("pending");
  });

  it("automatico + gated → awaiting_human (defensa, aunque el validador lo prohíbe)", () => {
    expect(
      planStepRun({ node_kind: "enviar_email", automation_level: "automatico" }),
    ).toBe("awaiting_human");
  });

  it("manual / asistido / auto_con_compuerta → awaiting_human", () => {
    for (const lvl of ["manual", "asistido", "auto_con_compuerta"] as const) {
      expect(
        planStepRun({ node_kind: "crear_tarea", automation_level: lvl }),
      ).toBe("awaiting_human");
    }
  });
});

describe("buildRunRows", () => {
  const step = (over: Partial<ServiceWorkflowStep>): ServiceWorkflowStep => ({
    id: "s1",
    service_key: null,
    momento: null,
    orden: 0,
    nombre: "x",
    node_kind: "recordatorio_interno",
    owner_role: null,
    automation_level: "manual",
    trigger_event: "oferta_aceptada",
    ai_skill_slug: null,
    template_ref: null,
    channel: null,
    sla_hours: null,
    depends_on: [],
    active: true,
    ...over,
  });

  it("una fila por paso, con tenant/source y estado de planStepRun", () => {
    const rows = buildRunRows(
      [
        step({ id: "a", node_kind: "recordatorio_interno", automation_level: "automatico" }),
        step({ id: "b", node_kind: "enviar_email", automation_level: "auto_con_compuerta" }),
      ],
      "tenant-1",
      { sourceKind: "shipment", sourceId: "SHP-9" },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tenant_id: "tenant-1",
      step_id: "a",
      source_kind: "shipment",
      source_id: "SHP-9",
      status: "pending",
    });
    expect(rows[1].status).toBe("awaiting_human");
  });

  it("lista vacía → sin filas", () => {
    expect(buildRunRows([], "t", { sourceKind: "x", sourceId: "y" })).toEqual([]);
  });
});
