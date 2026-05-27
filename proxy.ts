/**
 * Proxy (antes "middleware") de autenticación · Studio + Back.
 *
 * En Next.js 16 el convention `middleware.ts` quedó deprecado a favor de
 * `proxy.ts` con función `proxy()`. Migrado en SDD-0004 cleanup.
 *
 * Responsabilidades:
 * 1. Refrescar la sesión Supabase en cookies para que server components la vean fresca.
 * 2. Studio: redirigir /studio/** sin sesión → /studio/login; con sesión y en
 *    /studio/login → /studio/resumen.
 * 3. Back:   redirigir /back/** sin sesión → /back/login; con sesión y en
 *    /back/login → /back (dashboard). NOTA: el gating de roles back fino
 *    (admin/disenador/editor) lo hace requireAnyBackRole() en el layout
 *    protegido — acá solo gatekeep sesión vs no-sesión.
 *
 * El sitio público (/, /calculadora, /cotizar, /servicios, /contacto, /track)
 * queda intocado y con cero overhead (matcher abajo no los incluye).
 *
 * Referencia oficial: https://supabase.com/docs/guides/auth/server-side/nextjs
 * Next.js 16 proxy: https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() (no getSession()) — valida el JWT contra Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ─── /studio/** ─────────────────────────────────────────────
  if (pathname.startsWith("/studio")) {
    // Sin sesión y NO en login → redirect a login
    if (!user && pathname !== "/studio/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/studio/login";
      return NextResponse.redirect(url);
    }
    // Con sesión y EN login → redirect al resumen
    if (user && pathname === "/studio/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/studio/resumen";
      return NextResponse.redirect(url);
    }
  }

  // ─── /back/** ───────────────────────────────────────────────
  // Mismo patrón que Studio pero apuntando al login y home del back.
  // El check fino de rol back (admin/disenador/editor) NO ocurre acá —
  // lo hace requireAnyBackRole() en app/back/(app)/layout.tsx, que
  // redirige a /back/login?reason=no_role si el user tiene sesión pero
  // ningún rol back en su tenant.
  if (pathname.startsWith("/back")) {
    if (!user && pathname !== "/back/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/back/login";
      return NextResponse.redirect(url);
    }
    if (user && pathname === "/back/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/back";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Solo correr en rutas /studio/** y /back/**.
  // El sitio publico (/, /calculadora, /cotizar, /servicios, /contacto, /track, etc.)
  // queda intocado y con cero overhead.
  matcher: ["/studio/:path*", "/back/:path*"],
};
