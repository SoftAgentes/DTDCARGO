import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type D1OperationType =
  | "membership.invite"
  | "membership.role_change"
  | "membership.scope_change"
  | "membership.invitation_revoke"
  | "notification_channel.link"
  | "notification_channel.unlink"
  | "api_key.create"
  | "api_key.revoke"
  | "webhook.save"
  | "webhook.delete"
  | "tenant.identity_update"
  | "office.save"
  | "office.delete"
  | "bank_account.save"
  | "bank_account.delete"
  | "feature_flag.toggle"
  | "numbering.legal_legend_update"
  | "notification_rule.upsert"
  | "notification_rule.delete"
  | "notification_rule.restore_defaults"
  | "agent.install"
  | "agent.status_change";

export interface D1OperationResult {
  entity_id: string;
  invitation_id?: string;
  token?: string;
}

export interface ExecuteD1OperationInput {
  operationId?: string;
  operationType: D1OperationType;
  targetId?: string | null;
  input?: Record<string, unknown>;
  reason?: string | null;
}

export class D1OperationError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "permission_denied"
      | "invalid_state"
      | "idempotency_conflict"
      | "audit_failed"
      | "query_failed",
  ) {
    super(code);
    this.name = "D1OperationError";
  }
}

function mapDatabaseError(error: {
  code?: string;
  message?: string;
}): D1OperationError {
  const message = error.message ?? "";
  if (error.code === "42501" || message.includes("permission_denied")) {
    return new D1OperationError("permission_denied");
  }
  if (error.code === "23505" || message.includes("idempotency_conflict")) {
    return new D1OperationError("idempotency_conflict");
  }
  if (error.code === "P0002" || message.includes("invalid_state")) {
    return new D1OperationError("invalid_state");
  }
  if (error.code === "22023" || message.includes("invalid_input")) {
    return new D1OperationError("invalid_input");
  }
  if (message.toLowerCase().includes("audit")) {
    return new D1OperationError("audit_failed");
  }
  return new D1OperationError("query_failed");
}

export function createD1OperationId(): string {
  return randomUUID();
}

export async function executeD1Operation(
  supabase: SupabaseClient,
  operation: ExecuteD1OperationInput,
): Promise<D1OperationResult> {
  const operationId = operation.operationId ?? createD1OperationId();
  const { data, error } = await supabase.rpc("audit_d1_execute", {
    p_operation_id: operationId,
    p_operation_type: operation.operationType,
    p_target_id: operation.targetId ?? null,
    p_input: operation.input ?? {},
    p_reason: operation.reason ?? null,
  });

  if (error) throw mapDatabaseError(error);
  if (!data || typeof data !== "object" || !("entity_id" in data)) {
    throw new D1OperationError("query_failed");
  }
  return data as unknown as D1OperationResult;
}

export function d1Reason(
  value: FormDataEntryValue | null,
  fallback: string,
): string {
  if (typeof value === "string" && value.trim().length >= 8) {
    return value.trim().slice(0, 500);
  }
  return fallback;
}
