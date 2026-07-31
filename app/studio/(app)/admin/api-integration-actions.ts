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
import {
  d1Reason,
  executeD1Operation,
} from "@/lib/studio/audit/d1-access-config-adapters";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateApiKeyInput,
  validateWebhookInput,
  type ApiIntegrationActionState,
} from "@/lib/studio/api-integration-types";

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

  // Token en claro: dtd_live_<48 hex>. Se muestra una sola vez.
  const token = `dtd_live_${randomBytes(24).toString("hex")}`;
  const keyPrefix = token.slice(0, 16); // "dtd_live_" + 7 chars
  const keyHash = sha256(token);

  try {
    await executeD1Operation(supabase, {
      operationType: "api_key.create",
      input: {
        name: input!.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
      },
    });
  } catch {
    return { error: "No se pudo crear la key." };
  }

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
  try {
    await executeD1Operation(supabase, {
      operationType: "api_key.revoke",
      targetId: id,
      reason: d1Reason(
        formData.get("reason"),
        "Revocación solicitada desde Administración",
      ),
    });
  } catch {
    return { error: "No se pudo revocar la key." };
  }

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

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  const active = formData.get("active") !== "false";

  try {
    await executeD1Operation(supabase, {
      operationType: "webhook.save",
      targetId: id || null,
      input: {
        name: input!.name,
        url: input!.url,
        events: input!.events,
        active,
        ...(id
          ? {}
          : { secret: `whsec_${randomBytes(24).toString("hex")}` }),
      },
    });
  } catch {
    return { error: "No se pudo guardar el webhook." };
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
  try {
    await executeD1Operation(supabase, {
      operationType: "webhook.delete",
      targetId: id,
      reason: d1Reason(
        formData.get("reason"),
        "Eliminación solicitada desde Administración",
      ),
    });
  } catch {
    return { error: "No se pudo eliminar el webhook." };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
