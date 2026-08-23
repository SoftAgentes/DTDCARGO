/**
 * Acuñación del enlace de acceso al portal en modo `token_hash` (SDD-0278).
 *
 * ⚠️ **Por qué NO se arma el enlace con `signInWithOtp`.** El cliente de
 * `@supabase/ssr` corre en flujo **PKCE**: cuando el visitante pide el enlace,
 * Auth deja una cookie `code_verifier` en **ese** navegador y el correo llega con
 * un `?code=` que sólo sirve ahí. Si el correo se abre en otro lado —el navegador
 * interno de Gmail, el de WhatsApp, el teléfono cuando se pidió desde la laptop—
 * la cookie no existe, `exchangeCodeForSession` falla con
 * `400: code challenge does not match previously saved code verifier`, y el portal
 * le decía al cliente **"el enlace venció"**, que era mentira: el enlace estaba vivo.
 *
 * Medido en producción el 2026-08-21 sobre `auth_logs`: en 24 h hubo 11 `/verify`
 * con éxito, 5 con "One-time token not found" y 1 con ese 400 de PKCE. Fallos por
 * tiempo vencido: **cero**. El TTL de Auth (`MAILER_OTP_EXP`) es de 3600 s.
 *
 * `generateLink` no depende de ninguna cookie: devuelve un `hashed_token` que
 * `verifyOtp` valida server-side desde **cualquier** navegador. Es el mismo camino
 * que ya usan la invitación al portal y `/entrar/[code]`, ambos LIVE.
 *
 * 🔴 **El enlace no apunta al callback, apunta al intersticial `/abrir`.**
 * El token es de un solo uso y los escáneres de correo (Gmail, antivirus) hacen
 * GET sobre todo lo que llega: si el enlace consumiera en GET, el robot lo quema
 * antes que el cliente. Es exactamente el bug que `/entrar/[code]` ya cerró con
 * el mismo truco — se dibuja en GET y se consume en POST.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Base del sitio (el portal vive en una ruta de este dominio). */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Ruta del intersticial que consume el token en POST.
 *
 * Vive en la raíz, no bajo `/portal/`: es la puerta, no el portal. Bajo
 * `app/portal/layout.tsx` heredaría el remapeo de fuentes a Sora/Nunito y
 * quedaría con otra tipografía que `/entrar`, `/registro` y `/entrar/[code]`.
 */
export const PORTAL_OPEN_PATH = "/abrir";

/**
 * URL que viaja en el correo. Apunta al intersticial, NO al callback: quien la
 * abre ve un botón, y el token se gasta recién cuando ese botón se aprieta.
 */
export function portalOpenUrl(tokenHash: string): string {
  const qs = new URLSearchParams({ token_hash: tokenHash, type: "magiclink" });
  return `${SITE_URL}${PORTAL_OPEN_PATH}?${qs.toString()}`;
}

/**
 * Acuña un `hashed_token` de magic-link para ese email.
 *
 * Si el email todavía no tiene `auth.user` —el caso de los clientes en estado
 * `invited`, que hoy son 14 y **ninguno** tiene `auth_user_id`— lo crea confirmado
 * y reintenta, igual que hace la invitación al portal. Sin esto, `generateLink`
 * falla para ellos y el cliente invitado nunca puede entrar por su cuenta.
 *
 * ⚠️ Esto cambia el invariante viejo de "el login nunca crea `auth.users`". Se
 * puede porque el caller **ya verificó** que el email tiene fila en `client_users`
 * con estado `invited` o `active`: no lo crea cualquiera que escriba un correo en
 * la pantalla, sólo alguien a quien el equipo ya habilitó.
 *
 * Best-effort: NUNCA tira. Devuelve `null` y el caller decide el plan B.
 */
export async function mintPortalMagicToken(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const clean = email.trim().toLowerCase();
  const gen = () =>
    supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: clean,
      // No usamos el `action_link` que devuelve (ése pasa por `/auth/v1/verify`),
      // pero Auth exige un `redirectTo` permitido para acuñar.
      options: { redirectTo: `${SITE_URL}/portal/callback` },
    });

  try {
    let { data, error } = await gen();
    if (error || !data?.properties?.hashed_token) {
      // `createUser` sobre uno que ya existe devuelve error (no tira) → se ignora
      // y el reintento corre igual.
      await supabaseAdmin.auth.admin.createUser({
        email: clean,
        email_confirm: true,
      });
      ({ data, error } = await gen());
    }
    if (error || !data?.properties?.hashed_token) return null;
    return data.properties.hashed_token;
  } catch {
    return null;
  }
}
