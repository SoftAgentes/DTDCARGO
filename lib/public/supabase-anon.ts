/**
 * Cliente Supabase anon compartido por la capa de datos del sitio público.
 *
 * El sitio público NO está autenticado: usa la anon key (NO service_role).
 * Las operaciones sensibles pasan por RPCs `SECURITY DEFINER` de retorno
 * mínimo (tracking, tarifas). La excepción editorial es `news_posts`: anon tiene
 * SELECT solo sobre las columnas públicas (0526) y RLS la limita a
 * `published = true`.
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
