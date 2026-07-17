/**
 * SDD-0156 · Slice D — buildTimeline con hiddenStatuses: ocultar un hito del
 * stepper del portal sin descolocar los pasos cumplidos/pendientes.
 */
import { describe, it, expect } from "vitest";
import { buildTimeline } from "../tracking-progress";

describe("buildTimeline hiddenStatuses", () => {
  it("sin hiddenStatuses → comportamiento intacto (todos los pasos)", () => {
    const steps = buildTimeline("in_transit", "consolidacion");
    expect(steps.some((s) => s.status === "in_customs")).toBe(true);
  });

  it("oculta el status pedido y conserva el resto con su estado", () => {
    const steps = buildTimeline(
      "in_transit",
      "consolidacion",
      new Set(["in_customs"] as const),
    );
    expect(steps.some((s) => s.status === "in_customs")).toBe(false);
    // Los previos siguen 'done', el actual 'active'.
    expect(steps.find((s) => s.status === "shipped")?.state).toBe("done");
    expect(steps.find((s) => s.status === "in_transit")?.state).toBe("active");
  });

  it("ocultar el status ACTUAL no rompe el done de los previos", () => {
    // Envío en aduana, pero in_customs oculto: se ven los cumplidos + pendientes.
    const steps = buildTimeline(
      "in_customs",
      "consolidacion",
      new Set(["in_customs"] as const),
    );
    expect(steps.some((s) => s.status === "in_customs")).toBe(false);
    expect(steps.find((s) => s.status === "in_transit")?.state).toBe("done");
    expect(steps.find((s) => s.status === "arrived_destination")?.state).toBe(
      "pending",
    );
  });

  it("set vacío = mismo resultado que sin parámetro", () => {
    const a = buildTimeline("shipped", "consolidacion");
    const b = buildTimeline("shipped", "consolidacion", new Set());
    expect(b).toEqual(a);
  });
});
