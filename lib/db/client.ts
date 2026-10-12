/**
 * Cliente Supabase para Client Components del Studio.
 *
 * Usar en archivos con "use client" donde necesites hacer queries
 * desde el browser (forms, suscripciones realtime, etc.).
 *
 * Respeta RLS: solo ve lo que las policies permiten para el usuario autenticado.
 *
 * Para queries server-side (server components, route handlers, server actions)
 * usar `lib/db/server.ts` en su lugar.
 */

import { createBrowserClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./session-cookie";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: sessionCookieOptions() },
  );
}
