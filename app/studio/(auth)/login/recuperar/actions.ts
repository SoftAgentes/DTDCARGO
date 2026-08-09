"use server";

/**
 * Recuperar acceso al Studio, self-service (SDD-0252 · corte 4).
 *
 * Hasta acá el login sólo ofrecía un `mailto:` a Sam — el único camino era que
 * un admin le mandara "Enviar acceso" desde Usuarios (SDD-0250). Esto es la
 * mitad que faltaba: el propio usuario lo dispara sin sesión.
 *
 * Reusa TODO lo de SDD-0250: la tabla `studio_access_tokens` (migr 0354, ya
 * pensada para consumirse en el POST del formulario, nunca al abrir el
 * enlace) y sus helpers de `lib/studio/access-token.ts`. `generateAccessToken`
 * se duplica acá (no se importa desde `usuarios/actions.ts`) por el mismo
 * motivo que ese archivo documenta: es "use server" y usa `node:crypto`, que
 * rompe el bundle si algún día un client component importa este módulo.
 *
 * Respuesta SIEMPRE genérica (exista o no el email, esté activo o no) — igual
 * que el magic-link del portal (`app/portal/(auth)/login/actions.ts`): sin
 * esto, el formulario sería un oráculo de "qué correos tienen cuenta admin".
 * Throttle por IP reusando `portal_registro_throttle` con prefijo propio
 * `studio-recuperar:` — mismo patrón que `/api/contact`.
 */

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { accessTokenExpiry, accessTokenPath } from "@/lib/studio/access-token";
import { sendEmail } from "@/lib/studio/mail/send-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "studio-recuperar:";
const RL_LIMIT = 5;
const RL_WINDOW_MINUTES = 60;

export type RecoveryState = { sent?: boolean; error?: string };

/** Ver docstring de arriba: node:crypto vive acá, no en access-token.ts. */
function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

function generic(): RecoveryState {
  return { sent: true };
}

export async function requestStudioRecoveryAction(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Ingresa un email válido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return generic();
  }

  // Throttle por IP — antes de tocar cualquier dato de usuario.
  const originHash = createHash("sha256")
    .update(await getRequestIp())
    .digest("hex");
  const originKey = `${RL_IP_PREFIX}${originHash}`;
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error: throttleError } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", originKey)
    .gte("created_at", windowStart);
  if (throttleError || (count ?? 0) >= RL_LIMIT) {
    return generic();
  }
  const { error: insertError } = await admin.from(RL_TABLE).insert({ ip: originKey });
  if (insertError) return generic();

  // ¿Existe la cuenta? listUsers + find, mismo patrón que usuarios/actions.ts
  // y usuarios/page.tsx (no hay un getUserByEmail directo en supabase-js).
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = authUsers?.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return generic();

  // Debe ser miembro ACTIVO de un tenant — un usuario desactivado no recupera
  // acceso solo (lo reactiva un admin, igual que sendAccessLinkAction).
  const { data: membership } = await admin
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!membership) return generic();

  const token = generateAccessToken();
  const { error: tokenErr } = await admin.from("studio_access_tokens").insert({
    tenant_id: membership.tenant_id,
    user_id: user.id,
    token,
    // Auto-solicitado: el creador es el propio usuario (created_by exige un
    // auth.users válido; no hay un "admin" que lo dispare acá).
    created_by: user.id,
    expires_at: accessTokenExpiry(),
  });
  if (tokenErr) {
    console.error("[requestStudioRecoveryAction] insert token:", tokenErr.message);
    return generic();
  }

  const accessLink = `${SITE_URL}${accessTokenPath(token)}`;
  const sendResult = await sendEmail(admin, membership.tenant_id, {
    subject: "Recupera tu acceso al Studio · DTD Cargo",
    html: buildRecoveryHtml(accessLink),
    to: email,
    metadata: { source: "studio-recovery-self-service", user_id: user.id },
  });
  if (!sendResult.ok) {
    console.error("[requestStudioRecoveryAction] envío falló:", sendResult.error);
  }

  return generic();
}

function buildRecoveryHtml(accessLink: string): string {
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:18px;margin:0 0 12px"><b>Recupera tu acceso al Studio</b></p>
<p style="margin:0 0 16px;color:#333333;font-size:14px;line-height:1.55">Pediste un enlace para volver a entrar. Ábrelo y crea una contraseña nueva — el anterior sigue funcionando si aún lo recuerdas.</p>
<p style="margin:0 0 20px"><a href="${accessLink}" style="display:inline-block;background:#7F0F1A;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px">Crear contraseña nueva &rarr;</a></p>
<p style="margin:0;color:#6B6B6B;font-size:12px;line-height:1.5">Si no pediste esto, ignora este correo — nadie pudo entrar con solo verlo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Studio</p>
</div>`;
}
