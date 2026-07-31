import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  D1OperationError,
  d1Reason,
  executeD1Operation,
} from "../d1-access-config-adapters";

function clientWith(
  response: { data: unknown; error: null | { code?: string; message?: string } },
): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  } as unknown as SupabaseClient;
}

describe("executeD1Operation", () => {
  it("envía una clave idempotente y devuelve el resultado tipado", async () => {
    const supabase = clientWith({
      data: { entity_id: "00000000-0000-0000-0000-000000000123" },
      error: null,
    });

    await expect(
      executeD1Operation(supabase, {
        operationId: "00000000-0000-0000-0000-000000000999",
        operationType: "feature_flag.toggle",
        input: { key: "audit_log", enabled: true },
      }),
    ).resolves.toEqual({
      entity_id: "00000000-0000-0000-0000-000000000123",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("audit_d1_execute", {
      p_operation_id: "00000000-0000-0000-0000-000000000999",
      p_operation_type: "feature_flag.toggle",
      p_target_id: null,
      p_input: { key: "audit_log", enabled: true },
      p_reason: null,
    });
  });

  it("reduce errores DB a códigos estables sin propagar mensajes", async () => {
    const supabase = clientWith({
      data: null,
      error: {
        code: "23505",
        message: "idempotency_conflict with secret-looking details",
      },
    });

    await expect(
      executeD1Operation(supabase, {
        operationType: "api_key.revoke",
        targetId: "00000000-0000-0000-0000-000000000123",
        reason: "Rotación programada",
      }),
    ).rejects.toEqual(new D1OperationError("idempotency_conflict"));
  });

  it("normaliza motivos y usa fallback gobernado", () => {
    expect(d1Reason("  Incidente confirmado  ", "fallback")).toBe(
      "Incidente confirmado",
    );
    expect(d1Reason("corto", "Cambio desde Administración")).toBe(
      "Cambio desde Administración",
    );
  });
});
