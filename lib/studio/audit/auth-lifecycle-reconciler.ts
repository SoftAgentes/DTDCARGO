import type { SupabaseClient } from "@supabase/supabase-js";

type AuthLookup = {
  getUserById(
    userId: string,
  ): Promise<{
    data: { user: { banned_until?: string | null } | null };
    error: unknown;
  }>;
};

export interface ReconciliationObservation {
  operationId: string;
  targetUserId: string;
  desiredState: "disabled" | "enabled";
}

/**
 * Reconciliación acotada: observa únicamente user_id + estado de ban y emite
 * una transición estable. No consulta email, metadata ni filas de negocio.
 */
export async function reconcileAuthLifecycle(
  supabase: SupabaseClient,
  auth: AuthLookup,
  observation: ReconciliationObservation,
): Promise<"confirmed" | "retry_required" | "reconciliation_required"> {
  const { data, error } = await auth.getUserById(observation.targetUserId);
  if (error || !data.user) return "reconciliation_required";

  const banned =
    typeof data.user.banned_until === "string" &&
    new Date(data.user.banned_until).getTime() > Date.now();
  const matches =
    observation.desiredState === "disabled" ? banned : !banned;

  if (!matches) return "retry_required";

  const { error: transitionError } = await supabase.rpc(
    "audit_d1_auth_transition",
    {
      p_operation_id: observation.operationId,
      p_transition: "reconcile_auth_succeeded",
      p_error_code: null,
    },
  );
  if (transitionError) return "reconciliation_required";

  const { error: confirmationError } = await supabase.rpc(
    "audit_d1_auth_transition",
    {
      p_operation_id: observation.operationId,
      p_transition: "confirm",
      p_error_code: null,
    },
  );
  if (confirmationError) return "reconciliation_required";
  return "confirmed";
}
