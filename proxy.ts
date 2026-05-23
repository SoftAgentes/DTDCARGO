/**
 * Proxy (antes "middleware") de autenticación para el Studio (DoorTuDoor).
 *
 * En Next.js 16 el convention `middleware.ts` quedó deprecado a favor de
 * `proxy.ts` con función `proxy()`. Migrado en SDD-0004 cleanup.
 *
 * Responsabilidades:
 * 1. Refrescar la sesión Supabase en cookies para que server components la vean fresca.
 * 2. Redirigir /studio/** sin sesión → /studio/login.
 * 3. Redirigir /studio/login con sesión activa → /studio/resumen.
 *
 * Solo corre en rutas /studio/** — el sitio público no se ve afectado.
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

  // Si NO está logueado y va a /studio/* (excepto /studio/login) → redirect a login
  if (!user && pathname.startsWith("/studio") && pathname !== "/studio/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/studio/login";
    return NextResponse.redirect(url);
  }

  // Si SÍ está logueado y va a /studio/login → redirect al resumen
  if (user && pathname === "/studio/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/studio/resumen";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Solo correr en rutas /studio/**.
  // El sitio publico (/, /calculadora, /cotizar, /servicios, /contacto, /track, etc.)
  // queda intocado y con cero overhead.
  matcher: ["/studio/:path*"],
};
