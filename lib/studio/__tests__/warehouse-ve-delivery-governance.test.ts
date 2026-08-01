import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeVeDeliveryGoverned } from "../warehouse-ve-queries";
import { validateVeDeliveryCompletionInput } from "../warehouse-ve-types";

const VALID = {
  shipment_id: "30000000-0000-4000-8000-000000000001",
  from: "last_mile",
  received_by: "Ana Pérez",
  reason: "Entrega verificada por Operaciones",
  request_ref: "warehouse-ve-delivery:test-0001",
};

describe("validateVeDeliveryCompletionInput", () => {
  it("acepta el payload manual R3 completo", () => {
    expect(validateVeDeliveryCompletionInput(VALID)).toEqual({
      ok: true,
      input: VALID,
    });
  });

  it.each([
    [{ ...VALID, shipment_id: "no-uuid" }, "Embarque inválido."],
    [
      { ...VALID, from: "arrived_destination" },
      "El embarque cambió de estado. Actualiza la página.",
    ],
    [
      { ...VALID, received_by: "x" },
      "Indica el receptor con 2 a 200 caracteres.",
    ],
    [
      { ...VALID, reason: "x" },
      "El motivo debe tener entre 4 y 1000 caracteres.",
    ],
    [
      { ...VALID, request_ref: "ref con espacios" },
      "La referencia de la operación es inválida.",
    ],
  ])("rechaza el payload inválido sin tocar DB", (raw, error) => {
    expect(validateVeDeliveryCompletionInput(raw)).toEqual({ ok: false, error });
  });
});

describe("completeVeDeliveryGoverned", () => {
  it.each(["transitioned", "replayed"] as const)(
    "delega al RPC y conserva el resultado %s",
    async (result) => {
      const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;
      await expect(
        completeVeDeliveryGoverned(supabase, {
          shipmentId: VALID.shipment_id,
          receivedBy: VALID.received_by,
          reason: VALID.reason,
          requestRef: VALID.request_ref,
        }),
      ).resolves.toBe(result);
      expect(rpc).toHaveBeenCalledWith("complete_ve_delivery_governed", {
        p_shipment_id: VALID.shipment_id,
        p_received_by: VALID.received_by,
        p_reason: VALID.reason,
        p_request_ref: VALID.request_ref,
      });
    },
  );

  it("propaga el error estructurado del RPC", async () => {
    const dbError = { code: "42501", message: "internal" };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    } as unknown as SupabaseClient;
    await expect(
      completeVeDeliveryGoverned(supabase, {
        shipmentId: VALID.shipment_id,
        receivedBy: VALID.received_by,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toBe(dbError);
  });
});
