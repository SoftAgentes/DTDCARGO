// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expenseVoidErrorMessage,
  validateExpenseVoidInput,
  voidExpenseGoverned,
} from "../expense-void";

const VALID = {
  expenseId: "30000000-0000-4000-8000-000000000001",
  reason: "Gasto duplicado confirmado en conciliación",
  requestRef: "expense-void:test-0001",
};

describe("validateExpenseVoidInput", () => {
  it("normaliza el contrato R3", () => {
    expect(
      validateExpenseVoidInput({
        ...VALID,
        reason: `  ${VALID.reason}  `,
      }),
    ).toEqual({ input: VALID });
  });

  it.each([
    [{ ...VALID, expenseId: "no-uuid" }, "identificador válido"],
    [{ ...VALID, reason: "x" }, "4 a 1000"],
    [{ ...VALID, requestRef: "ref con espacios" }, "referencia"],
  ])("rechaza un payload inválido antes de llamar DB", (raw, message) => {
    expect(validateExpenseVoidInput(raw)).toMatchObject({
      error: expect.stringContaining(message),
    });
  });
});

describe("voidExpenseGoverned", () => {
  it.each(["voided", "replayed"] as const)(
    "delega una sola mutación al RPC y conserva %s",
    async (outcome) => {
      const rpc = vi.fn().mockResolvedValue({ data: outcome, error: null });
      const supabase = { rpc } as unknown as SupabaseClient;

      await expect(voidExpenseGoverned(supabase, VALID)).resolves.toBe(outcome);
      expect(rpc).toHaveBeenCalledWith("void_expense_governed", {
        p_expense_id: VALID.expenseId,
        p_reason: VALID.reason,
        p_request_ref: VALID.requestRef,
      });
    },
  );

  it("propaga el error estructurado del RPC", async () => {
    const dbError = { code: "40001", message: "detalle interno" };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    } as unknown as SupabaseClient;
    await expect(voidExpenseGoverned(supabase, VALID)).rejects.toBe(dbError);
  });

  it("rechaza una respuesta que no confirma durabilidad", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: "unknown", error: null }),
    } as unknown as SupabaseClient;
    await expect(voidExpenseGoverned(supabase, VALID)).rejects.toThrow(
      "Respuesta inválida",
    );
  });
});

describe("expenseVoidErrorMessage", () => {
  it.each([
    ["42501", "permiso"],
    ["P0002", "tenant"],
    ["40001", "cambió"],
    ["22023", "no son válidos"],
    ["23514", "período contable cerrado"],
  ])("traduce %s sin exponer el mensaje SQL", (code, expected) => {
    const message = expenseVoidErrorMessage(
      { code, message: "secreto SQL" },
      VALID.requestRef,
    );
    expect(message).toContain(expected);
    expect(message).not.toContain("secreto SQL");
  });

  it("incluye la referencia recuperable en un fallo inesperado", () => {
    expect(expenseVoidErrorMessage(new Error("boom"), VALID.requestRef)).toContain(
      VALID.requestRef,
    );
  });
});
