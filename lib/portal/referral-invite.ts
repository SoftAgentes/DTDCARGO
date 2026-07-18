/**
 * Invitar por correo — núcleo del programa de Referidos del Portal (SDD-0051,
 * cara cliente). Un cliente del portal invita a un nuevo importador por correo:
 * se crea la fila `referrals` en estado 'invitado' (= "el cliente fue contactado",
 * el seguimiento que pide el negocio) y la action envía el correo.
 *
 * IMPORTANTE (riesgo del negocio): invitar NO acredita nada. El bono (referrerReward)
 * se gana SOLO cuando el referido hace su PRIMERA compra, y esa acreditación será
 * AUTOMÁTICA — pero esa parte ("pagos") todavía no se habilita (va como
 * "Próximamente" en la UI). Acá solo dejamos el registro de seguimiento en
 * `reward_usd: 0` / status 'invitado'.
 *
 * AISLAMIENTO: igual que `portal-referral-queries.ts` — corre con el ADMIN client
 * (la tabla `referrals` no tiene RLS de portal) pero SCOPEADO EXPLÍCITO por el
 * `tenantId` + `referrerMarkbox` que la action ya resolvió por sesión
 * (getPortalClient). El admin nunca llega al bundle del cliente.
 *
 * Puro-ish y testeable: recibe el admin client inyectado (no resuelve sesión ni
 * envía correo — eso lo hace la server action fina).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERRAL_RULES } from "@/lib/studio/fidelizacion/types";

/** Email laxo pero suficiente: algo@algo.tld sin espacios (espejo de fidelizacion/types). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Tope de invitaciones por referidor por día (anti-abuso · el correo lo dispara el cliente). */
export const MAX_INVITES_PER_DAY = 10;

export type InviteReferralParams = {
  /** Tenant del cliente (resuelto por sesión). */
  tenantId: string;
  /** Shipping Mark del referidor (DTD-XXXX). */
  referrerMarkbox: string;
  /** id del cliente referidor en `clients` (para la FK; el trigger valida el tenant). */
  referrerClientId: string | null;
  /** Correo del invitado (requerido). */
  email: string;
  /** Nombre del invitado (opcional; si falta se usa el correo como display). */
  name?: string | null;
};

export type InviteReferralResult =
  | {
      ok: true;
      referralCode: string;
      referredName: string;
      referredEmail: string;
    }
  | { ok: false; error: string; field?: "email" | "name" };

/**
 * Registra una invitación (fila `referrals` status 'invitado', reward_usd 0).
 * Valida el correo, deduplica el mismo correo del mismo referidor, aplica el tope
 * diario, genera el código secuencial y hace el insert. NO envía el correo.
 */
export async function inviteReferral(
  admin: SupabaseClient,
  params: InviteReferralParams,
  now: Date = new Date(),
): Promise<InviteReferralResult> {
  const email = String(params.email ?? "").trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Escribe el correo de tu invitado.", field: "email" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Ese correo no es válido.", field: "email" };
  }

  const name = String(params.name ?? "").trim();
  if (name.length > 200) {
    return { ok: false, error: "El nombre es muy largo (máx. 200).", field: "name" };
  }
  // Sin nombre → el correo hace de display hasta que el referido se registre.
  const referredName = name || email;

  const markbox = params.referrerMarkbox.trim().toUpperCase();

  // Dedupe: no re-invitar el mismo correo desde el mismo referidor.
  const { data: dup } = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_markbox", markbox)
    .eq("referred_email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (dup) {
    return { ok: false, error: "Ya invitaste a ese correo.", field: "email" };
  }

  // Tope diario por referidor (anti-abuso).
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const { count } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_markbox", markbox)
    .is("deleted_at", null)
    .gte("created_at", startOfDay);
  if ((count ?? 0) >= MAX_INVITES_PER_DAY) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${MAX_INVITES_PER_DAY} invitaciones por día. Intenta mañana.`,
    };
  }

  // Código secuencial REF-YYYY-NNNN (mismo RPC que el Studio).
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_referral_code",
    { p_tenant: params.tenantId },
  );
  if (codeErr || !codeData) {
    return { ok: false, error: "No se pudo generar el código. Intenta de nuevo." };
  }
  const referralCode = String(codeData);

  // Insert espejo de registerReferral (Studio) — status 'invitado', sin recompensa.
  const { error: insErr } = await admin.from("referrals").insert({
    tenant_id: params.tenantId,
    referral_code: referralCode,
    referrer_client_id: params.referrerClientId,
    referrer_markbox: markbox,
    referred_name: referredName,
    referred_email: email,
    status: "invitado",
    reward_usd: 0,
  });
  if (insErr) {
    return { ok: false, error: "No se pudo registrar la invitación. Intenta de nuevo." };
  }

  return { ok: true, referralCode, referredName, referredEmail: email };
}

/**
 * Contenido del correo de invitación (puro · testeable). Tono de marca: tuteo VE,
 * sin exclamaciones múltiples. Estilos inline (los clientes de correo no cargan CSS
 * externo); solo navy/wine de la paleta. El enlace lleva a /registro con el código.
 */
export function buildReferralInviteEmail(input: {
  referrerName: string;
  referredName: string;
  code: string;
  registerUrl: string;
  /** Descuento del referido en USD (SDD-0159 · config). Default al histórico. */
  discountUsd?: number;
}): { subject: string; html: string } {
  const { referrerName, referredName, code, registerUrl } = input;
  const discount = input.discountUsd ?? REFERRAL_RULES.referredReward;
  const greetingName = referredName.includes("@") ? "" : ` ${referredName}`;
  const subject = `${referrerName} te invita a importar con DTD Cargo`;
  const html = `
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Regístrate con tu código ${code} y $${discount} de descuento en tu primer embarque.</div>
<div style="font-family:Archivo,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0F1E3D;line-height:1.6">
  <div style="background:linear-gradient(135deg,#0F1E3D 0%,#1F3055 100%);color:#fff;padding:28px 28px 24px;border-radius:14px 14px 0 0">
    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.7)">Invitación</div>
    <div style="font-size:22px;font-weight:900;margin-top:8px">Importa de China, con confianza.</div>
  </div>
  <div style="border:1px solid #E8E6E2;border-top:0;border-radius:0 0 14px 14px;padding:26px 28px">
    <p style="margin:0 0 14px">Hola${greetingName},</p>
    <p style="margin:0 0 14px"><strong>${referrerName}</strong> te recomienda a <strong>DTD Cargo</strong> para traer tu carga puerta a puerta desde China a Venezuela.</p>
    <p style="margin:0 0 18px">Regístrate con este código y obtén <strong>$${discount} de descuento</strong> en tu primer embarque:</p>
    <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;letter-spacing:0.02em;background:#F2F0EC;border-radius:10px;padding:14px 18px;text-align:center;color:#0F1E3D">${code}</div>
    <div style="margin:22px 0 8px">
      <a href="${registerUrl}" style="display:inline-block;background:#7F0F1A;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Registrarme en DTD Cargo</a>
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#6B6B6B">Con Confianza, de China a tu puerta.</p>
  </div>
</div>`.trim();
  return { subject, html };
}
