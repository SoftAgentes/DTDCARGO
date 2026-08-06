import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";

/**
 * Canje del enlace de acceso al Studio (SDD-0250).
 *
 * Es la pieza que faltaba: hasta ahora `app/studio/(auth)/` sólo tenía `login/`,
 * así que un correo de recuperación de Supabase LLEGABA pero su enlace no
 * aterrizaba en ninguna pantalla. El único callback de auth del repo era el del
 * portal de clientes, que es otro producto.
 *
 * Acepta los DOS flujos, igual que el callback del portal:
 *  - **token-hash** `?token_hash=…&type=recovery` → `verifyOtp`. Es el que
 *    produce `admin.generateLink` (server-side), o sea el del botón "Enviar
 *    acceso" de Studio › Usuarios. No depende de cookie del navegador, así que
 *    funciona aunque el usuario abra el correo en otro dispositivo.
 *  - **PKCE** `?code=…` → `exchangeCodeForSession`, por si el enlace se generó
 *    desde el navegador.
 *
 * Vive en una carpeta hermana de `/studio/reset` porque App Router no admite
 * `route.ts` y `page.tsx` en la misma ruta.
 *
 * Tras canjear queda una sesión de recuperación abierta; el redirect lleva a
 * `/studio/reset`, que exige esa sesión para dejar fijar la contraseña.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "recovery";

  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;

  // Enlace sin token: alguien llegó a la URL a mano.
  if (!result) {
    return NextResponse.redirect(`${origin}/studio/login?error=enlace`);
  }
  // Token vencido o ya usado — es de un solo uso.
  if (result.error) {
    return NextResponse.redirect(`${origin}/studio/login?error=vencido`);
  }

  return NextResponse.redirect(`${origin}/studio/reset`);
}
