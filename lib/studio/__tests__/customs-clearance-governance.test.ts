import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearCustomsFilingGoverned } from "../customs-queries";
import { validateCustomsClearanceInput } from "../customs-types";

const VALID = {
  filing_id: "30000000-0000-4000-8000-000000000001",
  from: "pagado",
  effective_date: "2026-07-31",
  reason: "Liberación confirmada contra DUA y pago",
  request_ref: "customs-clearance:test-0001",
};

describe("validateCustomsClearanceInput", () => {
  it("acepta el payload R3 completo", () => {
    expect(validateCustomsClearanceInput(VALID, "2026-07-31")).toEqual({
      ok: true,
      input: VALID,
    });
  });

  it.each([
    [{ ...VALID, filing_id: "no-uuid" }, "Trámite aduanal inválido."],
    [
      { ...VALID, from: "liberacion" },
      "El trámite cambió de estado. Actualiza la página.",
    ],
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
    expect(validateCustomsClearanceInput(raw, "2026-07-31")).toEqual({
      ok: false,
      error,
    });
  });
});

describe("clearCustomsFilingGoverned", () => {
  it.each(["transitioned", "replayed"] as const)(
    "delega al RPC y conserva el resultado %s",
    async (result) => {
      const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;

      await expect(
        clearCustomsFilingGoverned(supabase, {
          filingId: VALID.filing_id,
          effectiveDate: VALID.effective_date,
          reason: VALID.reason,
          requestRef: VALID.request_ref,
        }),
      ).resolves.toBe(result);
      expect(rpc).toHaveBeenCalledWith("clear_customs_filing_governed", {
        p_filing_id: VALID.filing_id,
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
      clearCustomsFilingGoverned(supabase, {
        filingId: VALID.filing_id,
        effectiveDate: VALID.effective_date,
        reason: VALID.reason,
        requestRef: VALID.request_ref,
      }),
    ).rejects.toBe(dbError);
  });
});
