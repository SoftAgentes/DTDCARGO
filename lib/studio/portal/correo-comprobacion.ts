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
 * La dirección con la que se acuña la entrada de un cliente cuya cuenta por
 * link sigue sin comprobar (acceso por WhatsApp, SDD-0253). Se le pregunta a
 * Auth qué lleva la cuenta en este momento, en vez de suponerlo: así la entrada
 * siempre se acuña para la cuenta del cliente, esté el paso que esté. `null` =
 * no es una cuenta de esas (o falta la migración): se usa el correo de siempre.
 */
export async function direccionInternaDelCliente(
  admin: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("client_email_checks")
      .select("auth_user_id")
      .eq("client_id", clientId)
      .is("verified_at", null)
      .maybeSingle<{ auth_user_id: string }>();
    if (error || !data?.auth_user_id) return null;
    const { data: cuenta, error: cuentaErr } = await admin.auth.admin.getUserById(data.auth_user_id);
    const email = cuenta?.user?.email?.trim().toLowerCase();
    if (cuentaErr || !email) return null;
    return email;
  } catch {
    return null;
  }
}
