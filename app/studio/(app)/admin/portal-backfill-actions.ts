/**
 * Server action del backfill de invitaciones al portal (adopción · 2026-07-11).
 *
 * Provisiona acceso + manda la invitación (magic-link) a los clientes existentes
 * que aún no tienen portal (solo 23 de 397 lo tenían). Reusa la MISMA lógica que
 * la invitación 1×1 (portal_invite_client + sendPortalInviteEmail), en lote.
 *
 * SEGURIDAD/CUIDADO: es outward-facing (manda correos reales). Tope de MAX_PER_BATCH
 * por invocación (rate-limits de Resend/Auth + timeout de la action) — el founder
 * corre varias tandas. portal_invite_client es idempotente (no re-invita a un
 * activo), así que reintentar es seguro.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { sendPortalInviteEmail } from "@/lib/studio/portal-invite-email";

export type BulkInviteState = {
  ok?: boolean;
  error?: string;
  /** invitados con correo enviado OK. */
  invited?: number;
  /** provisionados pero el correo no salió (reintentar). */
  emailFailed?: number;
  /** no se pudo ni provisionar (ej. sin email). */
  failed?: number;
  /** seleccionados que no se procesaron por el tope de la tanda. */
  remaining?: number;
  details?: string;
};

/** Tope por tanda: acota correos y el tiempo de la action (cada uno pega a Auth+Resend). */
const MAX_PER_BATCH = 20;

export async function bulkInvitePortalAction(
  _prev: BulkInviteState,
  formData: FormData,
): Promise<BulkInviteState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const raw = String(formData.get("client_ids") ?? "").trim();
  const ids = raw
    ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) return { error: "No seleccionaste ningún cliente." };

  const batch = ids.slice(0, MAX_PER_BATCH);
  const remaining = ids.length - batch.length;

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = link?.tenant_id ?? null;
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const admin = createAdminClient();

  let invited = 0;
  let emailFailed = 0;
  let failed = 0;
  const reasons: string[] = [];

  for (const clientId of batch) {
    const { data, error } = await supabase.rpc("portal_invite_client", {
      p_client_id: clientId,
    });
    if (error) {
      failed++;
      reasons.push(
        error.message.includes("no tiene email") ? "sin email" : "no se pudo habilitar",
      );
      continue;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { client_email?: string }
      | null;
    const email = row?.client_email ?? null;
    if (!email) {
      emailFailed++;
      reasons.push("acceso creado, sin correo");
      continue;
    }
    const { data: c } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle<{ name: string }>();
    const sent = await sendPortalInviteEmail(admin, tenantId, {
      email,
      name: c?.name ?? null,
    });
    if (sent.ok) {
      invited++;
    } else {
      emailFailed++;
      reasons.push("correo no salió");
    }
  }

  revalidatePath("/studio/admin");
  return {
    ok: true,
    invited,
    emailFailed,
    failed,
    remaining,
    details: reasons.length
      ? [...new Set(reasons)].slice(0, 5).join(" · ")
      : undefined,
  };
}
