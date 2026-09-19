// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  beginD5ExternalEffect,
  finishD5ExternalEffect,
  reconcileD5ExternalEffect,
} from "../external-effect-adapter";

function client(responses: Array<{ data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn().mockImplementation(async () => responses.shift()),
  };
}

describe("adapter durable D5", () => {
  it("persiste y reclama la intención antes del efecto", async () => {
    const supabase = client([
      { data: { status: "intent_recorded" }, error: null },
      { data: { status: "in_progress" }, error: null },
    ]);
    const id = await beginD5ExternalEffect(
      supabase as never,
      "portal.email_invite",
      "10000000-0000-0000-0000-000000000001",
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[0]?.[0]).toBe("audit_d5_external_intent");
  });

  it("reutiliza una operation_key entregada por el caller", async () => {
    const supabase = client([
      { data: { status: "intent_recorded" }, error: null },
      { data: { status: "in_progress" }, error: null },
    ]);
    const stableId = "20000000-0000-0000-0000-000000000001";

    await expect(
      beginD5ExternalEffect(
        supabase as never,
        "portal.email_invite",
        "10000000-0000-0000-0000-000000000001",
        stableId,
      ),
    ).resolves.toBe(stableId);
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      "audit_d5_external_intent",
      expect.objectContaining({ p_operation_id: stableId }),
    );
  });

  it("registra éxito o código estable de fallo", async () => {
    const supabase = client([{ data: { status: "failed" }, error: null }]);
    await finishD5ExternalEffect(
      supabase as never,
      "20000000-0000-0000-0000-000000000001",
      { ok: false, errorCode: "email_send_failed" },
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "audit_d5_external_transition",
      expect.objectContaining({
        p_transition: "fail",
        p_error_code: "email_send_failed",
      }),
    );
  });

  it("reconcilia con la misma clave si falla la confirmación inicial", async () => {
    const supabase = client([
      { data: null, error: { message: "transient" } },
      { data: { status: "succeeded" }, error: null },
    ]);
    const operationId = "20000000-0000-0000-0000-000000000002";

    await expect(
      finishD5ExternalEffect(supabase as never, operationId, { ok: true }),
    ).resolves.toBeUndefined();
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      "audit_d5_external_transition",
      expect.objectContaining({
        p_operation_id: operationId,
        p_transition: "reconcile_succeed",
      }),
    );
  });

  it("expone reconciliación explícita para operaciones pendientes", async () => {
    const supabase = client([
      { data: { status: "reconciliation_required" }, error: null },
    ]);
    await reconcileD5ExternalEffect(
      supabase as never,
      "20000000-0000-0000-0000-000000000003",
      { ok: null, errorCode: "provider_outcome_unknown" },
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "audit_d5_external_transition",
      expect.objectContaining({ p_transition: "reconciliation_required" }),
    );
  });
});
