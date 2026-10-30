/**
 * Proxy (antes "middleware") de autenticación.
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
 * ## 🔴 Refrescar la sesión NO es lo mismo que gatear la ruta (SDD-0302)
 *
 * Los puntos 2 y 3 son redirecciones y sólo aplican a `/studio` y `/back`. El
 * punto 1 —el refresco de cookies— le hace falta a **toda** ruta que resuelva
 * la sesión server-side, tenga o no redirección acá.
 *
 * Hasta hoy el matcher decía sólo `/studio` y `/back`, así que `/portal`,
 * `/m/erp` y `/m/emp` quedaban fuera **aunque autentican con el mismo
 * Supabase**. Al vencer el access token —1 h por defecto— la navegación
 * server-side veía la sesión muerta y echaba al usuario aunque su refresh
 * token siguiera vivo. Es el bug que se reporta como «me saca solo» y que
 * nadie reproduce, porque hay que esperar una hora.
 *
 * Esas tres rutas **no reciben ninguna redirección**: los únicos bloques de la
 * función son `startsWith("/studio")` y `startsWith("/back")`, así que caen al
 * `return supabaseResponse` final — exactamente el refresco que les faltaba.
 *
 * `/m/cn` y `/m/ve` quedan FUERA del refresco a propósito: el operario entra con
 * **PIN**, no con sesión de Supabase (ver `app/m/layout.tsx`), y meterlas sólo
 * agregaría un `getUser()` por request. Desde el modo mantenimiento (SDD-0505)
 * pasan por el proxy (para poder cortarlas) pero salen antes del `getUser()`:
 * el refresco solo corre en `RUTAS_CON_SESION`.
 *
 * ## ⚖️ `/entrar` y `/registro`: entran, y cuestan una llamada extra
 *
 * Son las puertas del portal y ya resuelven la sesión por su cuenta: si hay
 * usuario, redirigen a `/portal`. Sin el refresco, quien entró ayer pulsa
 * «Entrar» y —con el access token vencido pero el refresh vivo— ve **otra vez
 * el formulario de login** en vez de su portal. Cree que lo sacaron.
 *
 * El costo es real y acotado: esas dos páginas ya llaman a `getUser()`, así que
 * el proxy agrega una segunda ida al servidor **en esas dos**. El resto del
 * sitio público sigue con cero overhead. Si el tráfico de `/registro` lo hace
 * pesar, se sacan de una línea del matcher y se anotan en
 * `SIN_SESION_SUPABASE` del contrato.
 *
 * El sitio público (/, /tarifas, /calculadora-terrestre, /servicios, /contacto)
 * queda intocado y con cero overhead: el matcher no lo incluye.
 *
 * Referencia oficial: https://supabase.com/docs/guides/auth/server-side/nextjs
 * Next.js 16 proxy: https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/db/session-cookie";
import { respuestaDeMantenimiento } from "@/lib/runtime/maintenance";
import { necesitaSesion } from "@/lib/runtime/session-routes";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  // Modo mantenimiento (SDD-0505): antes de cualquier llamada a Supabase.
  const mantenimiento = await respuestaDeMantenimiento(request);
  if (mantenimiento) return mantenimiento;

  // El matcher cubre también la API, las server actions y las rutas que
  // escriben (para el mantenimiento); el refresco de sesión, con su getUser(),
  // solo corre en las rutas que la resuelven.
  if (!necesitaSesion(request.nextUrl.pathname)) return NextResponse.next();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
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

  /**
   * Rutas del Studio que se sirven SIN sesión porque su trabajo es crearla.
   *
   * Hoy sólo el login. La recuperación de acceso vive en `/acceso/[token]`
   * (SDD-0250 · migr 0354), FUERA de `/studio`, así que ni siquiera entra al
   * matcher de este proxy — igual que `/invitar`. Es a propósito: una pantalla
   * pensada para quien no tiene sesión no debería depender de que alguien
   * recuerde mantenerle un hueco abierto en el gate.
   */
  function isStudioEntryPoint(p: string): boolean {
    return p === "/studio/login";
  }

  /**
   * La Ficha DTD (SDD-0585, paso 2.4, E2-D29) vive en un iframe de Chatwoot:
   * redirigirla al login deja el marco en blanco, porque el login no se deja
   * enmarcar. Sin sesión, la página dice «Inicia sesión en Studio» y no lee
   * nada; la server action repite el candado. Solo la ruta exacta.
   *
   * `/studio/cerrar-chat` (paso 2.7, E2-D13) es el paso de salida: `signOut`
   * manda ahí ya sin sesión, para cerrar también la del chat. No lee nada.
   */
  function rendersOwnSignedOutState(p: string): boolean {
    return p === "/studio/ficha-chat" || p === "/studio/cerrar-chat";
  }

  // ─── /studio/** ─────────────────────────────────────────────
  if (pathname.startsWith("/studio")) {
    // Sin sesión y NO en una puerta de entrada → redirect a login.
    //
    // Las puertas de entrada son las rutas que EXISTEN PARA construir una
    // sesión, así que exigirles una sería circular. `/studio/reset/confirmar`
    // (SDD-0250) es el que canjea el token del correo: si el proxy lo rebota,
    // el enlace de acceso muere antes de llegar al handler y el usuario
    // termina otra vez en el login sin saber por qué — exactamente el
    // síntoma que este trabajo viene a eliminar.
    if (!user && !isStudioEntryPoint(pathname) && !rendersOwnSignedOutState(pathname)) {
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
  /**
   * Dos listas distintas desde el modo mantenimiento (SDD-0505):
   *
   *   · El MATCHER: todo lo que el mantenimiento tiene que poder cortar. Las
   *     pantallas con sesión, la app de operarios entera (/m, también el PIN),
   *     la API, las rutas fuera de /api que escriben (/p, /marca), la puerta
   *     del bypass (/mantenimiento) y cualquier server action, desde cualquier
   *     página: llegan con el header `Next-Action`.
   *   · `RUTAS_CON_SESION` (lib/runtime/session-routes.ts): dónde se refresca la
   *     sesión de Supabase. Toda pantalla con `auth.getUser()` tiene que estar
   *     ahí, o su access token vence sin refrescarse.
   *
   * Las páginas públicas que solo muestran (/, /tarifas…) siguen FUERA: cero
   * costo en Vercel, y en mantenimiento se pueden leer. Lo vigila
   * `proxy-matcher-contract.test.ts`.
   */
  matcher: [
    "/studio/:path*",
    "/back/:path*",
    "/portal/:path*",
    "/m/:path*",
    // `:path*` es CERO o más segmentos: cubre `/entrar` y `/registro` a secas.
    "/entrar/:path*",
    "/registro/:path*",
    "/api/:path*",
    "/p/:path*",
    "/marca/:path*",
    "/mantenimiento/:path*",
    { source: "/:path*", has: [{ type: "header", key: "next-action" }] },
  ],
};
