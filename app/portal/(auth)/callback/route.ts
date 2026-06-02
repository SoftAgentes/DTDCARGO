import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";

/**
 * Callback del magic-link de Supabase Auth para el portal (SDD-0042).
 *
 * 1. `exchangeCodeForSession(code)` → setea las cookies de sesión SSR.
 * 2. `portal_bind_session()` → vincula la sesión con su `client_users` invited
 *    (match por email). Idempotente: si ya está active, solo refresca login.
 * 3. Si vinculó → `/portal`. Si no (email sin invitación) → login con aviso.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/portal/login?error=expired`);
  }

  // Vincular la sesión con su cliente (match por email). Idempotente.
  const { data } = await supabase.rpc("portal_bind_session");
  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_id: string | null; bound: boolean }
    | null
    | undefined;

  if (!row?.bound) {
    // Sesión válida pero el email no corresponde a un cliente invitado.
    return NextResponse.redirect(`${origin}/portal/login?status=nohabilitado`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
