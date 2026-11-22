/**
 * Comprobación del correo de una cuenta por link (SDD-0646, D-1 opción C) — lo
 * que toca la base y Auth. SIEMPRE con `service_role`, sólo en el servidor y
 * después del control que corresponda (el token en las rutas públicas, el rol
 * en Studio).
 *
 * Tres piezas:
 *   · `correoSinComprobar`  — la pregunta que hace todo camino que manda un
 *     enlace de entrada a un correo.
 *   · `pasarCuentaADireccionInterna` — deja la cuenta de Auth con la dirección
 *     interna (cuentas creadas antes del cambio, o correo corregido después de
 *     comprobado).
 *   · `emitirYEnviarComprobacion` — emite el enlace de un solo uso y lo manda
 *     al correo por comprobar.
 */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CORREO_INTERNO_DOMINIO, comprobarCorreoUrl, esDominioInterno } from "@/lib/portal/correo-comprobacion";
import { generateRegistroToken, hashRegistroToken } from "@/lib/portal/registro-link";
import { sendRegistroLinkAvisoEmail } from "@/lib/studio/registro-link-aviso-email";

/** Dirección interna nueva: 128 bits aleatorios. No sale de ningún dato del cliente. */
export function nuevoCorreoInterno(): string {
  return `c-${randomBytes(16).toString("hex")}@${CORREO_INTERNO_DOMINIO}`;
}

export type CorreoSinComprobar =
  /** `bloquea`: no se le manda ningún enlace de entrada. `pendiente`: es el correo por comprobar de una cuenta. */
  | { estado: "ok"; bloquea: boolean; pendiente: boolean }
  /** Falta la migración 0559: todavía no hay cuentas sin comprobar. */
  | { estado: "sin-migracion" }
  /** La consulta falló: quien pregunta NO manda el enlace. */
  | { estado: "error" };

/**
 * ¿Este correo está sin comprobar? Nunca tira.
 *
 * Falla cerrado: un error que no sea «la función no existe» devuelve `error`, y
 * los que llaman no mandan el enlace.
 */
export async function correoSinComprobar(
  admin: SupabaseClient,
  email: string,
): Promise<CorreoSinComprobar> {
  const clean = email.trim().toLowerCase();
  // La dirección interna se bloquea sin preguntar a la base.
  if (esDominioInterno(clean)) return { estado: "ok", bloquea: true, pendiente: false };
  try {
    const { data, error } = await admin.rpc("portal_email_sin_comprobar", { p_email: clean });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") return { estado: "sin-migracion" };
      return { estado: "error" };
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { bloquea?: boolean; pendiente?: boolean }
      | null
      | undefined;
    if (!row) return { estado: "error" };
    return { estado: "ok", bloquea: row.bloquea === true, pendiente: row.pendiente === true };
  } catch {
    return { estado: "error" };
  }
}

/**
 * Deja la cuenta de Auth con la dirección interna y lo anota en la base (que lo
 * comprueba contra Auth antes de anotarlo). Idempotente.
 */
export async function pasarCuentaADireccionInterna(
  admin: SupabaseClient,
  input: { checkId: string; authUserId: string; internalEmail: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error: authErr } = await admin.auth.admin.updateUserById(input.authUserId, {
      email: input.internalEmail,
      email_confirm: true,
    });
    if (authErr) return { ok: false, error: `auth: ${authErr.message}` };
    const { error } = await admin.rpc("portal_email_check_auth_interno", {
      p_check_id: input.checkId,
    });
    if (error) return { ok: false, error: `base: ${error.code ?? "sin código"}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Emite el enlace de comprobación (reemplaza el anterior) y lo manda al correo
 * por comprobar. El token sale de acá y a la base va sólo su sha256.
 */
export async function emitirYEnviarComprobacion(
  admin: SupabaseClient,
  checkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = generateRegistroToken();
    const { data, error } = await admin.rpc("portal_email_check_issue", {
      p_check_id: checkId,
      p_token_hash: hashRegistroToken(token),
    });
    if (error) return { ok: false, error: `emitir: ${error.message}` };
    const row = (Array.isArray(data) ? data[0] : data) as
      | { tenant_id?: string; markbox?: string; pending_email?: string }
      | null
      | undefined;
    if (!row?.tenant_id || !row.markbox || !row.pending_email) {
      return { ok: false, error: "emitir: sin datos" };
    }
    const sent = await sendRegistroLinkAvisoEmail(admin, row.tenant_id, {
      email: row.pending_email,
      markbox: row.markbox,
      url: comprobarCorreoUrl(token),
    });
    return sent.ok ? { ok: true } : { ok: false, error: `correo: ${sent.error ?? "no salió"}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * La dirección con la que se acuña la entrada de un cliente (acceso por
 * WhatsApp, SDD-0253) cuando hay una cuenta por link sin comprobar.
 *
 *   ficha  → no hay cuenta por link sin comprobar (o falta la migración), o la
 *            cuenta del link ya no es su acceso porque el equipo volvió a
 *            invitarlo por correo: se usa el correo de la ficha, como siempre.
 *   cuenta → la cuenta del link sigue siendo su acceso activo: la entrada se
 *            acuña para lo que lleva esa cuenta en Auth en este momento (se le
 *            pregunta, no se supone).
 *   error  → hay (o no se puede descartar que haya) una cuenta sin comprobar y
 *            no se pudo leer lo necesario; o el cliente no tiene ningún acceso
 *            activo. FALLA CERRADO: no se acuña nada. Caer al correo de la ficha
 *            crearía una cuenta confirmada con un correo que nadie comprobó.
 */
export type DireccionDeEntrada =
  | { estado: "ficha" }
  | { estado: "cuenta"; email: string }
  | { estado: "error" };

export async function direccionInternaDelCliente(
  admin: SupabaseClient,
  clientId: string,
): Promise<DireccionDeEntrada> {
  try {
    const { data, error } = await admin
      .from("client_email_checks")
      .select("auth_user_id")
      .eq("client_id", clientId)
      .is("verified_at", null)
      .maybeSingle<{ auth_user_id: string }>();
    if (error) {
      // Sólo «la tabla no existe» (falta la 0559) descarta la cuenta por link.
      if (error.code === "42P01" || error.code === "PGRST205") return { estado: "ficha" };
      return { estado: "error" };
    }
    if (!data) return { estado: "ficha" };
    if (!data.auth_user_id) return { estado: "error" };

    // ¿La cuenta del link sigue siendo el acceso activo del cliente? (lo mismo
    // que mira la 0559 para el estado). Si el equipo revocó y volvió a invitar
    // por correo, el acceso activo es otro y la cuenta vieja no recibe entrada.
    const { data: accesos, error: accesosErr } = await admin
      .from("client_users")
      .select("auth_user_id")
      .eq("client_id", clientId)
      .eq("status", "active");
    if (accesosErr || !Array.isArray(accesos)) return { estado: "error" };
    const activos = (accesos as { auth_user_id: string | null }[]).map((a) => a.auth_user_id);
    if (!activos.includes(data.auth_user_id)) {
      return activos.length > 0 ? { estado: "ficha" } : { estado: "error" };
    }

    const { data: cuenta, error: cuentaErr } = await admin.auth.admin.getUserById(data.auth_user_id);
    const email = cuenta?.user?.email?.trim().toLowerCase();
    if (cuentaErr || !email) return { estado: "error" };
    return { estado: "cuenta", email };
  } catch {
    return { estado: "error" };
  }
}
