/**
 * lib/studio/guia/estado-queries.ts · Lectura del estado de la guía (SDD-0589, 9.3).
 *
 * La RLS de `user_guide_prefs` (0517) ya deja ver solo la fila del propio usuario en
 * un tenant activo; el filtro por `user_id` es defensa además de eso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoGuiaVacio, validarEstadoGuia, type EstadoGuia } from "./estado-types";

/**
 * Estado validado del usuario. Sin fila todavía, un estado vacío: nunca vio la guía.
 *
 * Devuelve `null` si no se pudo leer, por ejemplo antes de aplicar la 0517. Con `null`
 * la guía no arranca sola y guarda solo en el navegador, como en 9.2. Nunca lanza.
 */
export async function leerEstadoGuia(supabase: SupabaseClient, userId: string): Promise<EstadoGuia | null> {
  try {
    const { data, error } = await supabase
      .from("user_guide_prefs")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle<{ state: unknown }>();
    if (error) return null;
    return data ? validarEstadoGuia(data.state) : estadoGuiaVacio();
  } catch {
    return null;
  }
}
