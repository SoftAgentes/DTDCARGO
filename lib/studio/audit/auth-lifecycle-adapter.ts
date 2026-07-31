import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BAN_FOREVER = "876000h";

type AuthUserAdmin = {
  updateUserById(
    userId: string,
    attributes: { ban_duration: string },
  ): Promise<{ error: { status?: number; message?: string } | null }>;
};

export type AuthLifecycleCode =
  | "confirmed"
  | "auth_retryable"
  | "auth_terminal"
  | "compensated"
  | "reconciliation_required"
  | "query_failed";

export interface AuthLifecycleResult {
  ok: boolean;
  code: AuthLifecycleCode;
  operationId: string;
}

interface AuthOperationRow {
  operation_key: string;
  target_id: string;
  desired_state: "disabled" | "enabled";
  previous_state?: "disabled" | "enabled";
  status: string;
}

async function transition(
  supabase: SupabaseClient,
  operationId: string,
  name: string,
  errorCode?: string,
): Promise<AuthOperationRow> {
  const { data, error } = await supabase.rpc("audit_d1_auth_transition", {
    p_operation_id: operationId,
    p_transition: name,
    p_error_code: errorCode ?? null,
  });
  if (error || !data || typeof data !== "object") {
    throw new Error("query_failed");
  }
  return data as unknown as AuthOperationRow;
}

function isRetryable(error: { status?: number } | null): boolean {
  if (!error?.status) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

async function setBan(
  admin: AuthUserAdmin,
  targetUserId: string,
  disabled: boolean,
): Promise<{ ok: true } | { ok: false; retryable: boolean }> {
  try {
    const { error } = await admin.updateUserById(targetUserId, {
      ban_duration: disabled ? BAN_FOREVER : "none",
    });
    if (error) return { ok: false, retryable: isRetryable(error) };
    return { ok: true };
  } catch {
    return { ok: false, retryable: true };
  }
}

export async function executeAuthLifecycle(
  supabase: SupabaseClient,
  admin: AuthUserAdmin,
  input: {
    targetUserId: string;
    disabled: boolean;
    reason: string;
    operationId?: string;
  },
): Promise<AuthLifecycleResult> {
  const operationId = input.operationId ?? randomUUID();
  const { data: intent, error: intentError } = await supabase.rpc(
    "audit_d1_auth_intent",
    {
      p_operation_id: operationId,
      p_target_id: input.targetUserId,
      p_disabled: input.disabled,
      p_reason: input.reason,
    },
  );
  if (intentError || !intent) {
    return { ok: false, code: "query_failed", operationId };
  }

  try {
    await transition(supabase, operationId, "claim");
  } catch {
    return { ok: false, code: "query_failed", operationId };
  }

  const authResult = await setBan(admin, input.targetUserId, input.disabled);
  if (!authResult.ok) {
    const code = authResult.retryable ? "auth_retryable" : "auth_terminal";
    try {
      await transition(supabase, operationId, code, code);
    } catch {
      return { ok: false, code: "query_failed", operationId };
    }
    return { ok: false, code, operationId };
  }

  try {
    await transition(supabase, operationId, "auth_succeeded");
    await transition(supabase, operationId, "confirm");
    return { ok: true, code: "confirmed", operationId };
  } catch {
    try {
      await transition(supabase, operationId, "confirmation_failed");
      await transition(supabase, operationId, "compensation_started");
    } catch {
      return {
        ok: false,
        code: "reconciliation_required",
        operationId,
      };
    }

    const compensation = await setBan(
      admin,
      input.targetUserId,
      !input.disabled,
    );
    if (compensation.ok) {
      try {
        await transition(supabase, operationId, "compensated");
        return { ok: false, code: "compensated", operationId };
      } catch {
        return {
          ok: false,
          code: "reconciliation_required",
          operationId,
        };
      }
    }

    try {
      await transition(
        supabase,
        operationId,
        "reconciliation_required",
        "compensation_failed",
      );
    } catch {
      // El estado externo sigue siendo incierto aunque no se pueda registrar
      // una transición adicional. Nunca convertirlo en éxito.
    }
    return {
      ok: false,
      code: "reconciliation_required",
      operationId,
    };
  }
}
