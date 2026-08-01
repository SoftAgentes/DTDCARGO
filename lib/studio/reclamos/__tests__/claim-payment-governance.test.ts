import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { payClaimIndemnityGoverned } from "../claims-queries";
import { validateClaimIndemnityPaymentInput } from "../claims-types";

const VALID = {
  claim_id: "30000000-0000-4000-8000-000000000001",
  from: "aprobado",
  payment_method: "transfer",
  effective_date: "2026-07-31",
  reason: "Transferencia confirmada contra comprobante",
  request_ref: "claim-indemnity-payment:test-0001",
};

describe("validateClaimIndemnityPaymentInput", () => {
  it("acepta el payload R3 completo", () => {
    expect(validateClaimIndemnityPaymentInput(VALID, "2026-07-31")).toEqual({
      ok: true,
      input: VALID,
    });
  });

  it.each([
    [{ ...VALID, claim_id: "no-uuid" }, "Reclamo inválido."],
    [
      { ...VALID, from: "evaluacion" },
      "El reclamo cambió de estado. Actualiza la página.",
    ],
    [{ ...VALID, payment_method: "card" }, "El medio de pago es inválido."],
    [
      { ...VALID, effective_date: "2026-08-01" },
      "La fecha efectiva debe ser válida y no futura.",
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
    expect(validateClaimIndemnityPaymentInput(raw, "2026-07-31")).toEqual({
      ok: false,
      error,
    });
  });
});

describe("payClaimIndemnityGoverned", () => {
  it.each(["transitioned", "replayed"] as const)(
    "delega al RPC y conserva el resultado %s",
    async (result) => {
      const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;

      await expect(
        payClaimIndemnityGoverned(supabase, {
          claimId: VALID.claim_id,
          paymentMethod: "transfer",
          effectiveDate: VALID.effective_date,
          reason: VALID.reason,
          requestRef: VALID.request_ref,
        }),
      ).resolves.toBe(result);
      expect(rpc).toHaveBeenCalledWith("pay_claim_indemnity_governed", {
        p_claim_id: VALID.claim_id,
        p_payment_method: "transfer",
        p_effective_date: VALID.effective_date,
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
      payClaimIndemnityGoverned(supabase, {
        claimId: VALID.claim_id,
        paymentMethod: "transfer",
        effectiveDate: VALID.effective_date,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toBe(dbError);
  });
});
