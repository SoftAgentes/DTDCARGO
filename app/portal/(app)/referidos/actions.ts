/**
 * Server action del Portal · "Invitar por correo" (Referidos, cara cliente de
 * SDD-0051). Fina: resuelve identidad por SESIÓN (getPortalClient), delega la
 * lógica testeable a `lib/portal/referral-invite`, y envía el correo best-effort.
 *
 * Identidad + aislamiento: el markbox/tenant salen de la sesión (nunca del form).
 * El write corre con ADMIN client SCOPEADO explícito por ese markbox/tenant (la
 * tabla `referrals` no tiene RLS de portal — mismo patrón que las queries del
 * portal). El correo es best-effort: si falla, la invitación queda igual como
 * 'invitado' (el seguimiento no se pierde).
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  inviteReferral,
  buildReferralInviteEmail,
} from "@/lib/portal/referral-invite";
import { getReferralSettings } from "@/lib/studio/fidelizacion/referral-settings-queries";

export type InviteReferralState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { email?: string; name?: string };
  /** Correo al que se envió la invitación (para el mensaje de éxito). */
  invitedEmail?: string;
};

export async function inviteReferralAction(
  _prev: InviteReferralState,
  formData: FormData,
): Promise<InviteReferralState> {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }

  const admin = createAdminClient();

  // Tenant del cliente (scopeado por su id de sesión).
  const { data: row } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = row?.tenant_id;
  if (!tenantId) {
    return { error: "No se pudo resolver tu cuenta. Intenta de nuevo." };
  }

  const res = await inviteReferral(admin, {
    tenantId,
    referrerMarkbox: client.markbox,
    referrerClientId: client.id,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
  });

  if (!res.ok) {
    if (res.field) return { fieldErrors: { [res.field]: res.error } };
    return { error: res.error };
  }

  // Correo best-effort (no rompe la invitación si falla / no hay key).
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com").replace(
    /\/$/,
    "",
  );
  const registerUrl = `${site}/registro?ref=${encodeURIComponent(res.referralCode)}`;
  // Descuento del referido = el configurado (SDD-0159, fallback $60).
  const settings = await getReferralSettings(admin, tenantId);
  const { subject, html } = buildReferralInviteEmail({
    referrerName: client.name || "Un cliente de DTD Cargo",
    referredName: res.referredName,
    code: res.referralCode,
    registerUrl,
    discountUsd: settings.referredRewardUsd,
  });
  await sendEmail(admin, tenantId, {
    to: res.referredEmail,
    to_name: res.referredName,
    subject,
    html,
    metadata: { kind: "referral_invite", referral_code: res.referralCode },
  });

  revalidatePath("/portal/referidos");
  return { ok: true, invitedEmail: res.referredEmail };
}
