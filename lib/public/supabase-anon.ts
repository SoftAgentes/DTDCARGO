/**
 * Cliente Supabase anon compartido por la capa de datos del sitio público.
 *
 * El sitio público NO está autenticado: usa la anon key (NO service_role).
 * Toda lectura pública pasa por RPCs `SECURITY DEFINER` de retorno mínimo
 * (ver supabase/migrations/0059_public_track_rpc.sql, 0099_rates_*.sql) —
 * nunca queries directas a tablas (RLS por tenant las bloquea para anon).
 *
 * Frontera público↔ERP: este módulo vive en `lib/public/`, la única capa
 * autorizada por ESLint a importar `@supabase/*` desde el lado público.
 */

import { createClient } from "@supabase/supabase-js";

/** Cliente Supabase con la anon key. Sin sesión ni refresh (request-scoped). */
export function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
