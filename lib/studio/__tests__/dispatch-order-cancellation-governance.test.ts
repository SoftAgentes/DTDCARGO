import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelDispatchOrderGoverned } from "../dispatch-queries";
import type { CancelDispatchOrderInput } from "../dispatch-types";
import { validateCancelDispatchOrderInput } from "../dispatch-types";

const VALID = {
  od_id: "30000000-0000-4000-8000-000000000001",
  from: "en_ruta" as const,
  reason: "Cancelación confirmada por Operaciones",
  request_ref: "dispatch-order-cancellation:test-0001",
};

describe("validateCancelDispatchOrderInput", () => {
  it("acepta y normaliza el payload R3 completo", () => {
    expect(
      validateCancelDispatchOrderInput({
        ...VALID,
        reason: `  ${VALID.reason}  `,
      }),
    ).toEqual({
      input: VALID,
    });
  });

  it.each([
    [{ ...VALID, od_id: "no-uuid" }, "OD inválida."],
    [
      { ...VALID, from: "entregada" },
      "La OD cambió de estado. Actualiza la página.",
    ],
    [{ ...VALID, reason: "x" }, "El motivo es muy corto."],
    [
      { ...VALID, request_ref: "ref con espacios" },
      "La referencia de la operación es inválida.",
    ],
  ])("rechaza el payload inválido sin tocar DB", (raw, error) => {
    expect(
      validateCancelDispatchOrderInput(
        raw as Partial<CancelDispatchOrderInput>,
      ),
    ).toMatchObject({
      fieldErrors: expect.objectContaining(
        error === "OD inválida."
          ? { od_id: error }
          : error.startsWith("La OD")
            ? { from: error }
            : error.startsWith("El motivo")
              ? { reason: error }
              : { request_ref: error },
      ),
    });
  });
});

describe("cancelDispatchOrderGoverned", () => {
  it.each(["transitioned", "replayed"] as const)(
    "delega al RPC y conserva el resultado %s",
    async (result) => {
      const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;

      await expect(
        cancelDispatchOrderGoverned(supabase, {
          orderId: VALID.od_id,
          expectedStatus: VALID.from,
          reason: VALID.reason,
          requestRef: VALID.request_ref,
        }),
      ).resolves.toBe(result);
      expect(rpc).toHaveBeenCalledWith("cancel_dispatch_order_governed", {
        p_order_id: VALID.od_id,
        p_expected_status: VALID.from,
        p_reason: VALID.reason,
        p_request_ref: VALID.request_ref,
      });
    },
  );

  it("propaga el error estructurado del RPC", async () => {
    const dbError = { code: "40001", message: "internal" };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    } as unknown as SupabaseClient;
    await expect(
      cancelDispatchOrderGoverned(supabase, {
        orderId: VALID.od_id,
        expectedStatus: VALID.from,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toBe(dbError);
  });

  it("rechaza una respuesta inesperada del RPC", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: "unknown", error: null }),
    } as unknown as SupabaseClient;
    await expect(
      cancelDispatchOrderGoverned(supabase, {
        orderId: VALID.od_id,
        expectedStatus: VALID.from,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toThrow("Respuesta inválida");
  });
});
