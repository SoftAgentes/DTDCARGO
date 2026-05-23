/**
 * Cliente Supabase para Server Components, Route Handlers y Server Actions.
 *
 * Lee/escribe cookies de Next.js para mantener la sesión SSR.
 *
 * IMPORTANTE: la función es async porque `cookies()` de Next.js 15+ es async.
 * Llamar siempre con `await createClient()`.
 *
 * Respeta RLS: solo ve lo que las policies permiten para el usuario autenticado.
 *
 * Para queries desde el browser, usar `lib/db/client.ts` en su lugar.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll() llamado desde un Server Component:
            // se puede ignorar si el middleware refresca la sesión.
          }
        },
      },
    },
  );
}
