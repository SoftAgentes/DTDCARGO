import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeTmsRouteGoverned } from "../tms-queries";
import { validateTmsRouteCompletionInput } from "../tms-types";

const VALID = {
  route_id: "30000000-0000-4000-8000-000000000001",
  from: "en_ruta",
  reason: "Ruta finalizada y entrega enviada a validación de POD",
  request_ref: "tms-route-completion:test-0001",
};

describe("validateTmsRouteCompletionInput", () => {
  it("acepta el payload R3 completo", () => {
    expect(validateTmsRouteCompletionInput(VALID)).toEqual({
      ok: true,
      input: VALID,
    });
  });

  it.each([
    [{ ...VALID, route_id: "no-uuid" }, "Ruta inválida."],
    [
      { ...VALID, from: "planificado" },
      "La ruta cambió de estado. Actualiza la página.",
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
    expect(validateTmsRouteCompletionInput(raw)).toEqual({ ok: false, error });
  });
});

describe("completeTmsRouteGoverned", () => {
  it.each(["transitioned", "replayed"] as const)(
    "delega al RPC y conserva el resultado %s",
    async (result) => {
      const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;

      await expect(
        completeTmsRouteGoverned(supabase, {
          routeId: VALID.route_id,
          reason: VALID.reason,
          requestRef: VALID.request_ref,
        }),
      ).resolves.toBe(result);
      expect(rpc).toHaveBeenCalledWith("complete_tms_route_governed", {
        p_route_id: VALID.route_id,
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
      completeTmsRouteGoverned(supabase, {
        routeId: VALID.route_id,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toBe(dbError);
  });
});
