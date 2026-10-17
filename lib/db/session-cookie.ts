/**
 * Nombre fijo de la cookie de sesión de Supabase (SDD-0505).
 *
 * Por defecto supabase-js nombra la sesión con el primer tramo del host de
 * Supabase: `sb-${hostname.split(".")[0]}-auth-token`. Hoy, con
 * `xpfuzqombmjmxvprjgmi.supabase.co`, es `sb-xpfuzqombmjmxvprjgmi-auth-token`.
 * En el servidor propio el host pasa a ser `supabase.dtdcargo.com` y el nombre
 * cambiaría a `sb-supabase-auth-token`: el navegador seguiría mandando la
 * cookie vieja, nadie la leería y TODOS los usuarios (Studio, Back, Portal,
 * operarios) tendrían que volver a entrar el día del corte.
 *
 * `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` fija el nombre. Vacía, no cambia nada (el
 * despliegue de Vercel sigue con el nombre por defecto); en el servidor propio
 * va con el nombre de hoy, junto con el mismo JWT secret de Cloud, para que las
 * sesiones abiertas sigan valiendo. Es NEXT_PUBLIC porque el cliente del
 * navegador también la usa: se inlinea al construir la imagen (build arg).
 */

/** Nombre configurado, o `undefined` si se deja el de supabase-js. */
export function sessionCookieName(): string | undefined {
  const name = process.env.NEXT_PUBLIC_SUPABASE_AUTH_COOKIE?.trim();
  return name ? name : undefined;
}

/** `cookieOptions` para `createBrowserClient` / `createServerClient`. */
export function sessionCookieOptions(): { name: string } | undefined {
  const name = sessionCookieName();
  return name ? { name } : undefined;
}
