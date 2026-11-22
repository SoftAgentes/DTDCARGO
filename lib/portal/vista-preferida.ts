/**
 * SDD-0654 fase 1 · Vista preferida del Portal: «Vista simple» o «Vista Pro».
 *
 * La preferencia vive en `client_users.portal_vista` (migración 0557) y sigue al
 * cliente entre dispositivos. Tres reglas que no se negocian (spec §5):
 *
 *   · **Interruptor.** Sin `PORTAL_VISTA_SIMPLE=true` nadie ve el selector ni la
 *     Vista simple, y el layout ni siquiera hace la consulta.
 *   · **Lectura aparte.** La lectura del principal del Portal no se toca: si
 *     pidiera una columna que todavía no existe, el principal saldría null y el
 *     layout mandaría a TODOS a `/entrar`. Esta consulta es otra y cualquier fallo
 *     (columna inexistente, red, fila ausente o un valor raro) degrada a «pro» y
 *     a «guía ya vista». Nunca lanza ni redirige.
 *   · **Escritura por RPC.** `client_users` no tiene privilegios ni policies de
 *     escritura para la sesión. Las dos RPC de la 0557 derivan la fila de
 *     `auth.uid()` y no reciben a quién escribir.
 *
 * El log lleva solo el código del error, nunca ids, correos ni Shipping Marks.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalVista = "simple" | "pro";

export type PortalVistaPreferida = {
  vista: PortalVista;
  /** true si la guía de las primeras veces ya se mostró (o si no se pudo leer). */
  guiaVista: boolean;
};

/** Lo que ve quien no tiene preferencia legible: el portal de hoy, sin guía. */
export const VISTA_POR_OMISION: Readonly<PortalVistaPreferida> = Object.freeze({
  vista: "pro",
  guiaVista: true,
});

/** Nombres que ve el cliente (en código: `simple` / `pro`; «light» es el tema). */
export const NOMBRE_VISTA: Readonly<Record<PortalVista, string>> = Object.freeze({
  simple: "Vista simple",
  pro: "Vista Pro",
});

export function esPortalVista(valor: unknown): valor is PortalVista {
  return valor === "simple" || valor === "pro";
}

/** ¿Está encendido el interruptor general? Solo el texto exacto `true`. */
export function isPortalVistaSimpleEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PORTAL_VISTA_SIMPLE === "true";
}

/**
 * Lee la preferencia del cliente con SU sesión. `userId` es el del principal
 * ya resuelto por el layout; la consulta filtra por él y por el vínculo activo.
 */
export async function getMyPortalVista(
  db: SupabaseClient,
  userId: string,
): Promise<PortalVistaPreferida> {
  if (typeof userId !== "string" || !userId.trim()) return { ...VISTA_POR_OMISION };
  try {
    const { data, error } = await db
      .from("client_users")
      .select("portal_vista, portal_guia_vista_at")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      if (error) console.error("[vista-preferida] no se pudo leer:", errorLabel(error, "error sin código"));
      return { ...VISTA_POR_OMISION };
    }
    const row = data as Record<string, unknown>;
    if (!esPortalVista(row.portal_vista)) return { ...VISTA_POR_OMISION };
    // Solo un null explícito dice «todavía no se mostró»; cualquier otra cosa
    // degrada a «ya vista», para no abrirle la guía a quien no corresponde.
    return { vista: row.portal_vista, guiaVista: row.portal_guia_vista_at !== null };
  } catch (err) {
    console.error("[vista-preferida] no se pudo leer:", errorLabel(err, "excepción sin detalle"));
    return { ...VISTA_POR_OMISION };
  }
}

/**
 * Guarda la vista elegida. Devuelve la vista que quedó en la base, o null si no
 * se pudo (sin la 0557, sin vínculo activo o un valor que no vale).
 */
export async function setMyPortalVista(
  db: SupabaseClient,
  vista: unknown,
): Promise<PortalVista | null> {
  if (!esPortalVista(vista)) return null;
  try {
    const { data, error } = await db.rpc("portal_set_vista", { p_vista: vista });
    if (error) {
      console.error("[vista-preferida] no se pudo guardar:", errorLabel(error, "error sin código"));
      return null;
    }
    return esPortalVista(data) ? data : null;
  } catch (err) {
    console.error("[vista-preferida] no se pudo guardar:", errorLabel(err, "excepción sin detalle"));
    return null;
  }
}

/** Marca la guía de las primeras veces como vista (una sola vez). */
export async function markMyPortalGuiaVista(db: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await db.rpc("portal_marcar_guia_vista");
    if (error) {
      console.error("[vista-preferida] no se pudo marcar la guía:", errorLabel(error, "error sin código"));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[vista-preferida] no se pudo marcar la guía:", errorLabel(err, "excepción sin detalle"));
    return false;
  }
}

/** Solo el código o el mensaje del error, nunca el objeto completo. */
function errorLabel(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (typeof code === "string" && code) return code;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
