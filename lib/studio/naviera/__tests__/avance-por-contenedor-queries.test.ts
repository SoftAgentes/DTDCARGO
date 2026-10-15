// @vitest-environment node
/**
 * SDD-0530 · La llamada a la RPC nunca lanza, y un resultado de otro avance no
 * se toma por bueno. El camino feliz y el de los avisos los prueba la acción
 * (app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock("@/lib/studio/notifications/schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => mocks.schedule(...a),
}));

import { avanzarContenedorGobernado, programarAvisosDelAvance } from "../avance-por-contenedor-queries";

function cliente(rpc: () => Promise<unknown>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("avanzarContenedorGobernado", () => {
  it("si la llamada lanza, devuelve un error y no lanza", async () => {
    const r = await avanzarContenedorGobernado(cliente(async () => { throw new Error("red caída"); }), "c1", "zarpado");
    expect(r).toEqual({
      ok: false,
      code: "red",
      error: "No se pudo cambiar el estado del contenedor. No cambió nada; vuelve a intentarlo.",
    });
  });

  it("sin la migración lo dice en el log y no cambia nada", async () => {
    const r = await avanzarContenedorGobernado(
      cliente(async () => ({ data: null, error: { code: "PGRST202", message: "not found" } })),
      "c1",
      "zarpado",
    );
    expect(r.ok).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("falta aplicar la migración 0477_naviera_zarpe_avanza_envios"),
    );
  });

  it("un resultado de arribo no vale como zarpe", async () => {
    const data = {
      outcome: "transitioned",
      tenant_id: "t1",
      consolidation_ref: "DTD-CONSOL-0102",
      to: "arribado",
      shipment_status: "in_customs",
      advanced: [],
      skipped: [],
      pieces_without_shipment: 0,
    };
    const r = await avanzarContenedorGobernado(cliente(async () => ({ data, error: null })), "c1", "zarpado");
    expect(r.ok).toBe(false);
  });
});

describe("programarAvisosDelAvance", () => {
  it("programa uno por envío, en serie, y suma sólo los que quedaron en la agenda", async () => {
    const orden: string[] = [];
    mocks.schedule.mockImplementation(async (_a: unknown, _t: unknown, ev: { ancla: { shipmentId: string } }) => {
      orden.push(`inicio ${ev.ancla.shipmentId}`);
      await new Promise((r) => setTimeout(r, 5));
      orden.push(`fin ${ev.ancla.shipmentId}`);
      return ev.ancla.shipmentId === "s2" ? { scheduled: 0, skipped: 1 } : { scheduled: 1, skipped: 0 };
    });
    const admin = {} as SupabaseClient;
    const hora = new Date("2026-10-15T12:00:00Z");
    const n = await programarAvisosDelAvance(admin, "t1", "shipped", [
      { shipmentId: "s1", code: "ENV-1", from: "draft", clientMarkbox: "DTD-1", clientName: "Ana" },
      { shipmentId: "s2", code: "ENV-2", from: "in_warehouse", clientMarkbox: null, clientName: null },
    ], hora);

    expect(n).toBe(1);
    expect(orden).toEqual(["inicio s1", "fin s1", "inicio s2", "fin s2"]);
    expect(mocks.schedule.mock.calls[1]).toEqual([
      admin,
      "t1",
      {
        ancla: { kind: "shipment", shipmentId: "s2", shipmentCode: "ENV-2" },
        clientMarkbox: null,
        clientName: null,
        event: "status:shipped",
        eventTime: hora,
      },
    ]);
  });
});
