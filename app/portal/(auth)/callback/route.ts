import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";

/**
 * Callback del magic-link de Supabase Auth para el portal (SDD-0042).
 *
 * Acepta DOS flujos (lo que mande Supabase según cómo se generó el enlace):
 *  - **PKCE** `?code=…` → `exchangeCodeForSession` (usa el `code_verifier` de la
 *    cookie del navegador que pidió el enlace).
 *  - **token-hash** `?token_hash=…&type=…` → `verifyOtp` (links generados
 *    server-side o por `admin.generateLink`; no dependen de cookie del browser).
 *
 * Luego `portal_bind_session()` vincula la sesión con su `client_users` (match
 * por email). Si vinculó → `/portal`; si no (email sin invitación) → la puerta.
 *
 * 🔴 **Esta ruta es HEREDADA (SDD-0278).** Los enlaces nuevos ya no pasan por
 * acá: van a `/abrir`, que dibuja en GET y consume en POST para que ningún
 * escáner de correo queme el token. Esto sigue vivo por los correos que ya están
 * en las bandejas de los clientes, y por eso conserva el camino PKCE.
 *
 * ⚠️ **Y ya no miente.** Antes cualquier fallo —vencido, usado, o abierto en otro
 * navegador— salía como `error=expired`, "el enlace venció". Medido el 2026-08-21
 * sobre `auth_logs`: en 24 h, los fallos por tiempo vencido fueron **cero**. Cada
 * causa tiene ahora su propio código y su propio mensaje.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // El fallo típico de este camino no es el tiempo: es que el correo se
      // abrió en un navegador distinto al que pidió el enlace, así que la cookie
      // `code_verifier` no está. Auth lo dice con "code challenge / verifier".
      const porDispositivo = /code (challenge|verifier)/i.test(error.message ?? "");
      return NextResponse.redirect(
        `${origin}/entrar?error=${porDispositivo ? "dispositivo" : "enlace"}`,
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(`${origin}/entrar?error=enlace`);
  } else {
    return NextResponse.redirect(`${origin}/entrar?error=incompleto`);
  }

  // Vincular la sesión con su cliente (match por email). Idempotente.
  const { data } = await supabase.rpc("portal_bind_session");
  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_id: string | null; bound: boolean }
    | null
    | undefined;

  if (!row?.bound) {
    // Sesión válida pero el email no corresponde a un cliente invitado.
    return NextResponse.redirect(`${origin}/entrar?status=nohabilitado`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
