"use server";

/**
 * API keys & webhooks (SDD-0128) — server actions (admin only).
 *
 * El token en claro se genera acá, se guarda SOLO su SHA-256, y se devuelve una
 * vez en el state (`token`) para mostrarlo. Revocar/borrar = soft.
 */

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateApiKeyInput,
  validateWebhookInput,
  type ApiIntegrationActionState,
} from "@/lib/studio/api-integration-types";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ── API keys ──────────────────────────────────────────────────
export async function createApiKeyAction(
  _prev: ApiIntegrationActionState,
  formData: FormData,
): Promise<ApiIntegrationActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateApiKeyInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };
  const { data: userResp } = await supabase.auth.getUser();

  // Token en claro: dtd_live_<48 hex>. Se muestra una sola vez.
  const token = `dtd_live_${randomBytes(24).toString("hex")}`;
  const keyPrefix = token.slice(0, 16); // "dtd_live_" + 7 chars
  const keyHash = sha256(token);

  const { error } = await supabase.from("api_keys").insert({
    tenant_id: tenantId,
    name: input!.name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    created_by: userResp.user?.id ?? null,
  });
  if (error) return { error: `No se pudo crear la key: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true, token };
}

export async function revokeApiKeyAction(
  _prev: ApiIntegrationActionState,
  formData: FormData,
): Promise<ApiIntegrationActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return { error: "Falta el id de la key." };
  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("revoked_at", null);
  if (error) return { error: `No se pudo revocar: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true };
}

// ── Webhooks ──────────────────────────────────────────────────
export async function saveWebhookAction(
  _prev: ApiIntegrationActionState,
  formData: FormData,
): Promise<ApiIntegrationActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateWebhookInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  const active = formData.get("active") !== "false";

  if (id) {
    const { error } = await supabase
      .from("webhooks")
      .update({ name: input!.name, url: input!.url, events: input!.events, active })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: `No se pudo guardar el webhook: ${error.message}` };
  } else {
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const { error } = await supabase.from("webhooks").insert({
      tenant_id: tenantId,
      name: input!.name,
      url: input!.url,
      events: input!.events,
      secret,
      active,
    });
    if (error) return { error: `No se pudo crear el webhook: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

export async function deleteWebhookAction(
  _prev: ApiIntegrationActionState,
  formData: FormData,
): Promise<ApiIntegrationActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return { error: "Falta el id del webhook." };
  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("webhooks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo eliminar el webhook: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true };
}
