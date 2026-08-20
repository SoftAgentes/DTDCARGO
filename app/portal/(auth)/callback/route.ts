import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";

/**
 * Callback del magic-link de Supabase Auth para el portal (SDD-0042).
 *
 * Acepta DOS flujos (lo que mande Supabase según cómo se generó el enlace):
 *  - **PKCE** `?code=…` → `exchangeCodeForSession` (magic-link iniciado en el
 *    navegador; usa el code_verifier de la cookie).
 *  - **token-hash** `?token_hash=…&type=…` → `verifyOtp` (links generados
 *    server-side o por `admin.generateLink`; no dependen de cookie del browser).
 *    Patrón SSR recomendado de Supabase + más resiliente si se pierde el verifier.
 *
 * Luego `portal_bind_session()` vincula la sesión con su `client_users` (match
 * por email). Si vinculó → `/portal`; si no (email sin invitación) → login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;

  if (!result) {
    return NextResponse.redirect(`${origin}/entrar?error=link`);
  }
  if (result.error) {
    return NextResponse.redirect(`${origin}/entrar?error=expired`);
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
