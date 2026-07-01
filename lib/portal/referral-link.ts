/**
 * Linkear un referido cuando el invitado se REGISTRA (SDD-0051, Fase 2 · cara
 * cliente). Al crear la cuenta con `?ref=`, conectamos al nuevo cliente con su
 * fila `referrals` (avanzar `invitado → registrado`, setear `referred_client_id`)
 * — el paso que faltaba para que la acreditación automática (trigger de la 1ª
 * factura) tenga a quién acreditar.
 *
 * Best-effort: lo llama `app/registro/actions.ts` DESPUÉS de crear el cliente; un
 * fallo acá NUNCA rompe el alta (igual que el link de estimado web).
 *
 * Dos caminos:
 *  - Invitación por correo → `ref` = `referral_code` secuencial (REF-YYYY-NNNN):
 *    ya existe la fila en 'invitado' → se actualiza.
 *  - Código compartido → `ref` = shareCode (REF-XXXX) o markbox (DTD-XXXX): puede
 *    reclamar una invitación previa por correo del mismo referidor, o crear la fila.
 *
 * AISLAMIENTO: admin client inyectado, scopeado EXPLÍCITO por `tenantId`. El
 * trigger de `referrals` (migr 0098) valida cross-tenant en la DB igual.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** `referral_code` secuencial (REF-YYYY-NNNN) — el de la invitación por correo. */
const SEQ_CODE_RE = /^REF-\d{4}-\d+$/;

export type LinkReferralParams = {
  tenantId: string;
  /** Valor crudo del `?ref=` del registro. */
  ref: string;
  newClientId: string;
  newClientMarkbox: string;
  newClientName: string;
  newClientEmail: string | null;
};

export type LinkReferralResult =
  | { linked: true; mode: "updated" | "created"; referralId: string | null }
  | { linked: false; reason: string };

/** markbox del referidor a partir del `ref` (shareCode REF-XXXX o markbox DTD-XXXX). */
function referrerMarkboxFromRef(ref: string): string {
  return ref.startsWith("DTD-") ? ref : "DTD-" + ref.replace(/^REF-/, "");
}

export async function linkReferralOnRegister(
  admin: SupabaseClient,
  params: LinkReferralParams,
): Promise<LinkReferralResult> {
  const ref = String(params.ref ?? "").trim().toUpperCase();
  if (!ref) return { linked: false, reason: "sin ref" };

  const newMarkbox = params.newClientMarkbox.trim().toUpperCase();
  const newEmail = params.newClientEmail?.trim().toLowerCase() || null;

  // ── Camino invitación por correo: ref = referral_code secuencial ──
  if (SEQ_CODE_RE.test(ref)) {
    const { data: row } = await admin
      .from("referrals")
      .select("id, status, referrer_markbox")
      .eq("tenant_id", params.tenantId)
      .eq("referral_code", ref)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; status: string; referrer_markbox: string }>();
    if (!row) return { linked: false, reason: "código no encontrado" };
    if (String(row.referrer_markbox).toUpperCase() === newMarkbox) {
      return { linked: false, reason: "autoreferido" };
    }
    if (row.status !== "invitado") {
      return { linked: false, reason: "referido ya avanzó" };
    }
    const { error } = await admin
      .from("referrals")
      .update({ status: "registrado", referred_client_id: params.newClientId })
      .eq("id", row.id);
    if (error) return { linked: false, reason: "update falló" };
    return { linked: true, mode: "updated", referralId: row.id };
  }

  // ── Camino código compartido: derivar el markbox del referidor ──
  const referrerMarkbox = referrerMarkboxFromRef(ref);
  if (referrerMarkbox === newMarkbox) {
    return { linked: false, reason: "autoreferido" };
  }

  // El referidor debe existir en el tenant.
  const { data: referrer } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("markbox", referrerMarkbox)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (!referrer) return { linked: false, reason: "referidor inexistente" };

  // Dedupe: ¿este cliente ya está linkeado como referido?
  const { data: already } = await admin
    .from("referrals")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("referred_client_id", params.newClientId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (already) return { linked: false, reason: "ya linkeado" };

  // Reclamar una invitación previa por correo del mismo referidor (evita huérfanos).
  if (newEmail) {
    const { data: invited } = await admin
      .from("referrals")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("referrer_markbox", referrerMarkbox)
      .eq("referred_email", newEmail)
      .eq("status", "invitado")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (invited) {
      const { error } = await admin
        .from("referrals")
        .update({ status: "registrado", referred_client_id: params.newClientId })
        .eq("id", invited.id);
      if (error) return { linked: false, reason: "update falló" };
      return { linked: true, mode: "updated", referralId: invited.id };
    }
  }

  // Crear la fila 'registrado' (código compartido sin invitación previa).
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_referral_code",
    { p_tenant: params.tenantId },
  );
  if (codeErr || !codeData) return { linked: false, reason: "sin código" };

  const { data: created, error: insErr } = await admin
    .from("referrals")
    .insert({
      tenant_id: params.tenantId,
      referral_code: String(codeData),
      referrer_client_id: referrer.id,
      referrer_markbox: referrerMarkbox,
      referred_name: params.newClientName,
      referred_email: newEmail,
      referred_client_id: params.newClientId,
      status: "registrado",
      reward_usd: 0,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (insErr) return { linked: false, reason: "insert falló" };
  return { linked: true, mode: "created", referralId: created?.id ?? null };
}
