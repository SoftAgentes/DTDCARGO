"use server";

/**
 * SDD-0487 · El cliente agrega su empresa (o, si se registró como empresa, sus
 * datos personales), la quita, y elige a nombre de quién se le factura.
 *
 * Las RPC de 0466 resuelven el cliente por SESIÓN, validan de nuevo en SQL,
 * bloquean un documento de otra ficha sin revelarlo y auditan sin PII. Nada de
 * esto gasta los 3 cambios del perfil (decisión de Sam). Estas actions sólo
 * normalizan, traducen el resultado y, si hubo bloqueo, avisan al asesor con
 * los Shipping Marks de las dos fichas, nunca con el valor intentado.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  BILLING_MESSAGES,
  isBillingOutcome,
  parseBillingProfile,
  secondaryKindFor,
  validateBillingIdentity,
  type BillingIdentityField,
  type BillingKind,
  type BillingOutcome,
} from "@/lib/portal/billing-identity";
import {
  notifyBlockedProfileEditToAdmin,
  type BlockedProfileField,
} from "@/lib/studio/change-request-notify";

export type BillingActionState = {
  ok?: boolean;
  /** Qué quedó hecho, para el anuncio de estado de la UI. */
  done?: "saved" | "removed" | "kind";
  error?: string;
  fieldErrors?: Partial<Record<BillingIdentityField, string>>;
};

const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a entrar al portal.";

function outcomeError(outcome: BillingOutcome): string | null {
  switch (outcome) {
    case "applied":
      return null;
    case "no_changes":
      return BILLING_MESSAGES.noChanges;
    case "blocked":
      return BILLING_MESSAGES.blocked;
    case "rate_limited":
      return BILLING_MESSAGES.rateLimited;
    case "missing_identity":
      return BILLING_MESSAGES.missingIdentity;
  }
}

function firstOutcome(data: unknown): BillingOutcome | null {
  const first = Array.isArray(data) ? data[0] : data;
  const outcome = (first as { outcome?: unknown } | null)?.outcome;
  return isBillingOutcome(outcome) ? outcome : null;
}

function translateRpcError(message: string): string {
  if (message === "portal_session_required") return SESSION_EXPIRED;
  if (message === "invalid_billing_name" || message === "invalid_billing_document"
      || message === "invalid_billing_address") {
    return "Revisa los datos marcados.";
  }
  return BILLING_MESSAGES.failed;
}

/**
 * Aviso al asesor tras un bloqueo. Best-effort: el cliente ve el mensaje igual.
 * Tenant, markbox y nombre salen del principal de sesión; con el admin sólo se
 * lee el asesor, que el principal no trae (SDD-0552).
 */
async function notifyBlocked(): Promise<void> {
  try {
    const supabase = await createClient();
    const principal = await getPortalClientPrincipal(supabase);
    if (!principal) return;
    const id = principal.client.id;
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("clients")
      .select("advisor_id")
      .eq("id", id)
      .maybeSingle<{ advisor_id: string | null }>();
    if (!row) return;
    const { data: attempt } = await admin
      .from("client_profile_blocked_attempts")
      .select("field, conflicting_client_id")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ field: string; conflicting_client_id: string | null }>();
    let conflictingMarkbox: string | null = null;
    if (attempt?.conflicting_client_id) {
      const { data: other } = await admin
        .from("clients")
        .select("markbox")
        .eq("id", attempt.conflicting_client_id)
        .maybeSingle<{ markbox: string | null }>();
      conflictingMarkbox = other?.markbox ?? null;
    }
    const field: BlockedProfileField =
      attempt?.field === "personal_doc" ? "personal_doc" : "company_rif";
    await notifyBlockedProfileEditToAdmin(admin, {
      tenantId: principal.tenantId,
      markbox: principal.client.markbox,
      clientName: principal.client.name,
      advisorId: row.advisor_id,
      field,
      conflictingMarkbox,
    });
  } catch {
    console.error("[billing-actions] aviso de bloqueo falló");
  }
}

/** Agrega o corrige la identidad secundaria. `set_default` sólo viaja al agregarla. */
export async function saveBillingIdentityAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const supabase = await createClient();

  let principalKind: BillingKind;
  try {
    const { data, error } = await supabase.rpc("portal_get_my_billing_profile");
    if (error) return { error: BILLING_MESSAGES.unavailable };
    const profile = parseBillingProfile(data);
    if (!profile) return { error: SESSION_EXPIRED };
    principalKind = profile.principalKind;
  } catch {
    return { error: BILLING_MESSAGES.unavailable };
  }

  const kind = secondaryKindFor(principalKind);
  const validation = validateBillingIdentity(kind, {
    legalName: String(formData.get("legal_name") ?? ""),
    doc: String(formData.get("doc") ?? ""),
    fiscalAddress: String(formData.get("fiscal_address") ?? ""),
  });
  if (!validation.ok) {
    return { error: "Revisa los datos marcados.", fieldErrors: validation.fieldErrors };
  }

  // Al agregar, la casilla decide; al editar no se toca la preferencia.
  const mode = String(formData.get("mode") ?? "add");
  const setDefault = mode === "add" ? formData.get("set_default") != null : null;

  let data: unknown;
  let rpcError: { message?: string } | null;
  try {
    const result = await supabase.rpc("portal_upsert_my_billing_identity", {
      p_legal_name: validation.values.legalName,
      p_doc: validation.values.doc,
      p_fiscal_address: validation.values.fiscalAddress,
      p_set_default: setDefault,
    });
    data = result.data;
    rpcError = result.error;
  } catch {
    rpcError = {};
  }
  if (rpcError) return { error: translateRpcError(rpcError.message ?? "") };

  const outcome = firstOutcome(data);
  if (!outcome) return { error: BILLING_MESSAGES.failed };
  if (outcome === "blocked") await notifyBlocked();
  const error = outcomeError(outcome);
  if (error) return { error };

  revalidatePath("/portal/perfil");
  return { ok: true, done: "saved" };
}

export async function removeBillingIdentityAction(): Promise<BillingActionState> {
  const supabase = await createClient();
  let data: unknown;
  let rpcError: { message?: string } | null;
  try {
    const result = await supabase.rpc("portal_delete_my_billing_identity");
    data = result.data;
    rpcError = result.error;
  } catch {
    rpcError = {};
  }
  if (rpcError) return { error: translateRpcError(rpcError.message ?? "") };
  const outcome = firstOutcome(data);
  if (outcome !== "applied" && outcome !== "no_changes") return { error: BILLING_MESSAGES.failed };

  revalidatePath("/portal/perfil");
  return { ok: true, done: "removed" };
}

export async function setBillingKindAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const kind = String(formData.get("billing_kind") ?? "");
  if (kind !== "persona" && kind !== "empresa") return { error: BILLING_MESSAGES.failed };

  const supabase = await createClient();
  let data: unknown;
  let rpcError: { message?: string } | null;
  try {
    const result = await supabase.rpc("portal_set_my_billing_kind", { p_kind: kind });
    data = result.data;
    rpcError = result.error;
  } catch {
    rpcError = {};
  }
  if (rpcError) return { error: translateRpcError(rpcError.message ?? "") };

  const outcome = firstOutcome(data);
  if (!outcome) return { error: BILLING_MESSAGES.failed };
  // Elegir lo que ya estaba elegido no es un error para el cliente.
  if (outcome !== "applied" && outcome !== "no_changes") {
    return { error: outcomeError(outcome) ?? BILLING_MESSAGES.failed };
  }

  revalidatePath("/portal/perfil");
  return { ok: true, done: "kind" };
}
