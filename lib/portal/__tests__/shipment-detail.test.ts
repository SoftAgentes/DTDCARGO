/**
 * Tests del slice "detalle de envío con timeline" del Portal del Cliente
 * (SDD-0042 · Fase 2).
 *
 * Cubre los criterios de la spec §3.3 / §8:
 *  - El portal REUSA la derivación canónica de timeline desde el status
 *    (`buildTimeline`, vía el re-export de portal-types). Verificamos los casos
 *    pedidos: status inicial, intermedio, entregado, exception — y que el paso
 *    "actual" quede resaltado con los cumplidos vs pendientes.
 *  - `estimatePortalEta`: heurística honesta (null en terminal / ya en bodega).
 *
 * Es la MISMA función que pinta el Studio (`TrackingTimeline`) y el tracking
 * público; este test fija el contrato que consume la UI del portal.
 */
import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  estimatePortalEta,
  flowForService,
  type ShipmentStatus,
  type TimelineStepState,
} from "../portal-types";

/** Helper: estado de un status puntual dentro de la timeline construida. */
function stateOf(
  steps: { status: ShipmentStatus; state: TimelineStepState }[],
  status: ShipmentStatus,
): TimelineStepState | undefined {
  return steps.find((s) => s.status === status)?.state;
}

describe("portal timeline — derivación desde el status (reusa buildTimeline)", () => {
  it("status inicial (in_warehouse): el actual = active, el resto pending, nada done", () => {
    const steps = buildTimeline("in_warehouse", "consolidado_lcl");

    // El primer paso del flow marítimo es in_warehouse → active.
    expect(steps[0]?.status).toBe("in_warehouse");
    expect(steps[0]?.state).toBe("active");

    // No hay pasos cumplidos todavía.
    expect(steps.some((s) => s.state === "done")).toBe(false);
    // Todos los posteriores quedan pendientes.
    expect(stateOf(steps, "shipped")).toBe("pending");
    expect(stateOf(steps, "delivered")).toBe("pending");
  });

  it("status intermedio (in_transit): anteriores done, actual active, posteriores pending", () => {
    const steps = buildTimeline("in_transit", "consolidado_lcl");

    // Lo recorrido antes de in_transit queda cumplido.
    expect(stateOf(steps, "in_warehouse")).toBe("done");
    expect(stateOf(steps, "consolidating")).toBe("done");
    expect(stateOf(steps, "shipped")).toBe("done");

    // El actual resaltado.
    expect(stateOf(steps, "in_transit")).toBe("active");
    expect(steps.filter((s) => s.state === "active")).toHaveLength(1);

    // Lo que falta, pendiente.
    expect(stateOf(steps, "in_customs")).toBe("pending");
    expect(stateOf(steps, "delivered")).toBe("pending");
  });

  it("entregado (delivered): todo el flow done hasta el último, sin pendientes", () => {
    const steps = buildTimeline("delivered", "consolidado_lcl");
    const last = steps[steps.length - 1];

    expect(last?.status).toBe("delivered");
    expect(last?.state).toBe("active"); // el actual = delivered
    // Todos los pasos previos quedaron cumplidos.
    expect(steps.slice(0, -1).every((s) => s.state === "done")).toBe(true);
    expect(steps.some((s) => s.state === "pending")).toBe(false);
  });

  it("exception: marca un paso como exception y no muestra ningún active", () => {
    const steps = buildTimeline("exception", "consolidado_lcl");

    expect(steps.some((s) => s.state === "exception")).toBe(true);
    // En estado de alerta no hay "en curso" normal.
    expect(steps.some((s) => s.state === "active")).toBe(false);
  });

  it("transporte_terrestre usa el flow corto (sin consolidación/aduana)", () => {
    const flow = flowForService("transporte_terrestre");
    expect(flow).not.toContain("consolidating");
    expect(flow).not.toContain("in_customs");

    const steps = buildTimeline("in_transit", "transporte_terrestre");
    expect(stateOf(steps, "in_warehouse")).toBe("done");
    expect(stateOf(steps, "in_transit")).toBe("active");
    expect(stateOf(steps, "delivered")).toBe("pending");
  });
});

describe("portal — estimatePortalEta", () => {
  const base = {
    service: "consolidado_lcl" as const,
    arrivedDestinationAt: null as string | null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("envío en tránsito → ETA en el futuro (createdAt + días por servicio)", () => {
    const eta = estimatePortalEta({ ...base, status: "in_transit" });
    expect(eta).not.toBeNull();
    // consolidado_lcl = 45 días sobre createdAt.
    expect(new Date(eta as string).getTime()).toBe(
      new Date(base.createdAt).getTime() + 45 * 24 * 60 * 60 * 1000,
    );
  });

  it("entregado → null (ya llegó)", () => {
    expect(estimatePortalEta({ ...base, status: "delivered" })).toBeNull();
  });

  it("ya en bodega VE (arrivedDestinationAt presente) → null (mostramos la llegada real)", () => {
    expect(
      estimatePortalEta({
        ...base,
        status: "arrived_destination",
        arrivedDestinationAt: "2026-02-15T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("cancelado/borrador → null (sin tránsito en curso)", () => {
    expect(estimatePortalEta({ ...base, status: "cancelled" })).toBeNull();
    expect(estimatePortalEta({ ...base, status: "draft" })).toBeNull();
  });
});
