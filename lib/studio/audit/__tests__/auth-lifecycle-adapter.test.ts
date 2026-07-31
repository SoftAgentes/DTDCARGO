import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAuthLifecycle } from "../auth-lifecycle-adapter";
import { reconcileAuthLifecycle } from "../auth-lifecycle-reconciler";

function dbClient(options?: {
  failTransition?: string;
}): SupabaseClient {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "audit_d1_auth_intent") {
        return { data: { status: "intent_recorded" }, error: null };
      }
      if (
        name === "audit_d1_auth_transition" &&
        args.p_transition === options?.failTransition
      ) {
        return { data: null, error: { message: "forced" } };
      }
      return {
        data: {
          operation_key: args.p_operation_id,
          target_id: "00000000-0000-0000-0000-000000000123",
          desired_state: "disabled",
          status: args.p_transition,
        },
        error: null,
      };
    }),
  } as unknown as SupabaseClient;
}

describe("executeAuthLifecycle", () => {
  const base = {
    targetUserId: "00000000-0000-0000-0000-000000000123",
    disabled: true,
    reason: "Suspensión administrativa confirmada",
    operationId: "00000000-0000-0000-0000-000000000999",
  };

  it("solo confirma después de Auth y confirmación PostgreSQL", async () => {
    const admin = {
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
    };
    const db = dbClient();

    await expect(executeAuthLifecycle(db, admin, base)).resolves.toEqual({
      ok: true,
      code: "confirmed",
      operationId: base.operationId,
    });
    expect(admin.updateUserById).toHaveBeenCalledWith(base.targetUserId, {
      ban_duration: "876000h",
    });
  });

  it("clasifica 429 como reintentable sin anunciar éxito", async () => {
    const admin = {
      updateUserById: vi.fn().mockResolvedValue({
        error: { status: 429, message: "provider details" },
      }),
    };

    await expect(
      executeAuthLifecycle(dbClient(), admin, base),
    ).resolves.toMatchObject({
      ok: false,
      code: "auth_retryable",
    });
  });

  it("compensa Auth cuando falla la confirmación DB", async () => {
    const admin = {
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
    };
    const result = await executeAuthLifecycle(
      dbClient({ failTransition: "confirm" }),
      admin,
      base,
    );

    expect(result).toMatchObject({ ok: false, code: "compensated" });
    expect(admin.updateUserById).toHaveBeenNthCalledWith(
      2,
      base.targetUserId,
      { ban_duration: "none" },
    );
  });

  it("eleva reconciliación cuando también falla la compensación", async () => {
    const admin = {
      updateUserById: vi
        .fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { status: 500 } }),
    };
    const result = await executeAuthLifecycle(
      dbClient({ failTransition: "confirm" }),
      admin,
      base,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "reconciliation_required",
    });
  });
});

describe("reconcileAuthLifecycle", () => {
  it("confirma PostgreSQL después de observar el estado Auth deseado", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const db = { rpc } as unknown as SupabaseClient;
    const auth = {
      getUserById: vi.fn().mockResolvedValue({
        data: { user: { banned_until: "9999-12-31T23:59:59.000Z" } },
        error: null,
      }),
    };

    await expect(
      reconcileAuthLifecycle(db, auth, {
        operationId: "00000000-0000-0000-0000-000000000999",
        targetUserId: "00000000-0000-0000-0000-000000000123",
        desiredState: "disabled",
      }),
    ).resolves.toBe("confirmed");

    expect(rpc).toHaveBeenNthCalledWith(1, "audit_d1_auth_transition", {
      p_operation_id: "00000000-0000-0000-0000-000000000999",
      p_transition: "reconcile_auth_succeeded",
      p_error_code: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "audit_d1_auth_transition", {
      p_operation_id: "00000000-0000-0000-0000-000000000999",
      p_transition: "confirm",
      p_error_code: null,
    });
  });
});
