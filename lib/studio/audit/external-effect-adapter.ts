import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type D5ExternalOperationType =
  | "portal.whatsapp_link"
  | "portal.bulk_whatsapp_link"
  | "portal.email_invite"
  | "portal.email_resend"
  /**
   * Reponerle el acceso al Studio a un miembro del equipo (SDD-0250 · migr
   * 0350). Va por D5 y no por D1 porque no escribe nada en `public`: genera un
   * enlace contra Supabase Auth y manda un correo — un efecto externo.
   */
  | "studio.access_link";

export async function beginD5ExternalEffect(
  supabase: SupabaseClient,
  operationType: D5ExternalOperationType,
  targetId?: string | null,
  operationId = randomUUID(),
): Promise<string> {
  const intent = await supabase.rpc("audit_d5_external_intent", {
    p_operation_id: operationId,
    p_operation_type: operationType,
    p_target_id: targetId ?? null,
  });
  if (intent.error) throw new Error("audit_intent_failed");

  const claim = await supabase.rpc("audit_d5_external_transition", {
    p_operation_id: operationId,
    p_transition: "claim",
    p_error_code: null,
  });
  if (claim.error) throw new Error("audit_claim_failed");
  return operationId;
}

export async function finishD5ExternalEffect(
  supabase: SupabaseClient,
  operationId: string,
  outcome: { ok: true } | { ok: false; errorCode: string },
): Promise<void> {
  const transitionName = outcome.ok ? "succeed" : "fail";
  const transition = await supabase.rpc("audit_d5_external_transition", {
    p_operation_id: operationId,
    p_transition: transitionName,
    p_error_code: outcome.ok ? null : outcome.errorCode,
  });
  if (!transition.error) return;

  const reconciliation = await supabase.rpc("audit_d5_external_transition", {
    p_operation_id: operationId,
    p_transition: outcome.ok ? "reconcile_succeed" : "reconcile_fail",
    p_error_code: outcome.ok ? null : outcome.errorCode,
  });
  if (reconciliation.error) throw new Error("audit_transition_failed");
}

export async function reconcileD5ExternalEffect(
  supabase: SupabaseClient,
  operationId: string,
  observedOutcome:
    | { ok: true }
    | { ok: false; errorCode: string }
    | { ok: null; errorCode: string },
): Promise<void> {
  const transition =
    observedOutcome.ok === true
      ? "reconcile_succeed"
      : observedOutcome.ok === false
        ? "reconcile_fail"
        : "reconciliation_required";
  const result = await supabase.rpc("audit_d5_external_transition", {
    p_operation_id: operationId,
    p_transition: transition,
    p_error_code:
      observedOutcome.ok === true ? null : observedOutcome.errorCode,
  });
  if (result.error) throw new Error("audit_reconciliation_failed");
}
