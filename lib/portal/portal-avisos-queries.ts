/**
 * SDD-0526 · Bandeja de avisos del Portal — lecturas y «visto».
 *
 * Todo va por las dos RPC de la migración 0479, con la SESIÓN del cliente: no
 * reciben tenant ni cliente, los derivan de `auth.uid()` y aplican en la base la
 * frontera de tenant y Shipping Mark, el ancla viva y «Visible en el portal».
 * Acá no hay cliente admin ni filtros que se puedan olvidar.
 *
 * Degradan, no rompen: sin la migración (o ante cualquier error) la bandeja sale
 * vacía y marcar como visto devuelve false. El log lleva sólo el código del
 * error, nunca ids, Shipping Marks ni el texto de los avisos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisoDesdeFila, type PortalAviso } from "./portal-avisos";

/** Cuántos avisos trae la campana. La RPC acepta de 1 a 50. */
export const BANDEJA_LIMITE = 20;

export async function listMyPortalAvisos(
  db: SupabaseClient,
  opts: { prealertaId?: string | null; limit?: number } = {},
): Promise<PortalAviso[]> {
  try {
    const { data, error } = await db.rpc("portal_list_my_notifications", {
      p_prealerta_id: opts.prealertaId ?? null,
      p_limit: opts.limit ?? BANDEJA_LIMITE,
    });
    if (error || !Array.isArray(data)) {
      console.error("[portal-avisos] la bandeja no se pudo leer:", errorLabel(error, "respuesta sin lista"));
      return [];
    }
    return data
      .map(avisoDesdeFila)
      .filter((aviso): aviso is PortalAviso => aviso !== null);
  } catch (err) {
    console.error("[portal-avisos] la bandeja no se pudo leer:", errorLabel(err, "excepción sin detalle"));
    return [];
  }
}

/**
 * Marca como vistos los avisos hasta `hasta` (la fecha del más nuevo que la
 * bandeja mostró). La base lo recorta a ahora y nunca retrocede.
 */
export async function markMyPortalAvisosSeen(
  db: SupabaseClient,
  hasta: string,
): Promise<boolean> {
  if (typeof hasta !== "string" || Number.isNaN(Date.parse(hasta))) return false;
  try {
    const { error } = await db.rpc("portal_mark_my_notifications_seen", {
      p_hasta: hasta,
    });
    if (error) {
      console.error("[portal-avisos] no se pudo marcar como visto:", errorLabel(error, "error sin código"));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[portal-avisos] no se pudo marcar como visto:", errorLabel(err, "excepción sin detalle"));
    return false;
  }
}

/** Sólo el código o el mensaje del error, nunca el objeto completo. */
function errorLabel(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (typeof code === "string" && code) return code;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
