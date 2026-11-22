"use server";

/**
 * Enlace de comprobación del correo (SDD-0646, D-1 opción C) — el POST.
 *
 * ⚠️ Todo el valor de este archivo está en tres cosas:
 *   1. Es un POST. Un filtro de correo o un robot de vista previa abre el enlace
 *      con GET, y `page.tsx` sólo lee. El enlace se gasta aquí.
 *   2. EL ENLACE SOLO NO COMPRUEBA. Tener el enlace prueba que se lee ese buzón,
 *      no que quien lo lee sea el cliente. Por eso se exige la sesión del portal
 *      del titular de la comprobación: el usuario sale de la sesión (nunca del
 *      formulario), y la base vuelve a compararlo al reclamar y al confirmar.
 *      Sin sesión, o con la sesión de otra cuenta, no se confirma y el enlace no
 *      se gasta.
 *   3. SOLO comprueba. Lee la sesión que ya existe; no crea ninguna, no acuña
 *      ningún enlace de entrada y no devuelve nada con qué entrar.
 *
 * Orden: sesión → reclamar (atómico, un solo uso, compara el titular) → el
 * correo pasa a la cuenta con la API de Auth → la base marca «comprobado» (y
 * exige que la cuenta YA lleve ese correo y que la sesión sea la del titular).
 *
 * Si algo falla después de reclamar, cada paso de la vuelta se revisa:
 *   · fallo pasajero de Auth → se suelta el enlace para reintentar;
 *   · ese correo ya es de otra cuenta → queda marcado para el equipo;
 *   · la confirmación quedó a medias y no se pudo deshacer → el enlace NO se
 *     suelta y la fila queda «para revisar» en «Registros por link».
 * Los avisos de consola llevan códigos, nunca el correo ni el token.
 */

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import {
  COMPROBAR_CORREO_ENTRA_PRIMERO,
  COMPROBAR_CORREO_NO_SIRVE,
  COMPROBAR_CORREO_REINTENTA,
  esCorreoInterno,
  type ComprobarCorreoState,
} from "@/lib/portal/correo-comprobacion";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import { isRegistroTokenShape } from "@/lib/portal/registro-link-types";

type Claim = {
  check_id: string | null;
  auth_user_id: string | null;
  pending_email: string | null;
  outcome: "ok" | "conflicto" | "sin_sesion_del_titular";
};

/**
 * ¿Auth dice «ese correo ya es de otra cuenta»? Sólo por su código o su texto:
 * un 422 a secas puede ser otra validación (formato, política), y un 500 a
 * secas puede ser cualquier cosa; nada de eso es un choque permanente.
 *
 * Las dos formas conocidas:
 *   · 422 con `email_exists` (lo que documenta Auth);
 *   · 500 con código 23505, violación de unicidad: es lo que respondió el Auth
 *     real del entorno de prueba al cambiar una cuenta a un correo que ya tenía
 *     otra (medido el 2026-11-18). Sin el código, sólo si el texto dice
 *     violación de unicidad Y nombra el correo.
 *
 * Es la red de seguridad para la carrera: el chequeo previo lo hace la base al
 * reclamar (`portal_email_check_claim` mira si ese correo ya es de otra cuenta
 * y responde «conflicto» sin que la app toque Auth).
 */
function esCorreoOcupado(err: { status?: number; code?: string; message?: string }): boolean {
  const msg = err.message ?? "";
  if (err.code === "email_exists") return true;
  if (/email_exists|already (been )?registered|email address .*already/i.test(msg)) return true;
  if (err.status === 500) {
    if (err.code === "23505") return true;
    if (/23505|duplicate key value violates unique constraint/i.test(msg) && /email/i.test(msg)) return true;
  }
  return false;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Suelta el enlace (o lo deja como choque). Si falla, el enlace queda gastado: se anota. */
async function soltar(admin: Admin, checkId: string, conflicto: boolean): Promise<boolean> {
  const { error } = await admin.rpc("portal_email_check_release", {
    p_check_id: checkId,
    p_conflicto: conflicto,
  });
  if (error) console.error("[comprobarCorreoAction] soltar falló:", error.code);
  return !error;
}

/** Deja la fila para revisión del equipo, con el enlace gastado. */
async function dejarParaRevision(admin: Admin, checkId: string, paso: string): Promise<void> {
  console.error("[comprobarCorreoAction] quedó para revisión del equipo:", paso);
  const { error } = await admin.rpc("portal_email_check_revisar", { p_check_id: checkId });
  if (error) console.error("[comprobarCorreoAction] no se pudo marcar para revisión:", error.code);
}

export async function comprobarCorreoAction(
  _prev: ComprobarCorreoState,
  formData: FormData,
): Promise<ComprobarCorreoState> {
  const token = String(formData.get("token") ?? "");
  if (!isRegistroTokenShape(token)) return { error: COMPROBAR_CORREO_NO_SIRVE };

  // 0. La sesión del portal. Sin sesión no se toca nada: ni se consulta el enlace.
  let sessionUserId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    sessionUserId = data.user?.id ?? null;
  } catch {
    sessionUserId = null;
  }
  if (!sessionUserId) return { error: COMPROBAR_CORREO_ENTRA_PRIMERO };

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: COMPROBAR_CORREO_REINTENTA };
  }

  // 1. Reclamar. Vencido, usado, reemplazado o inventado: ninguna fila. La base
  //    compara la sesión con el titular: si no es, no gasta nada.
  const { data, error } = await admin.rpc("portal_email_check_claim", {
    p_token_hash: hashRegistroToken(token),
    p_session_user_id: sessionUserId,
  });
  if (error) {
    console.error("[comprobarCorreoAction] reclamar falló:", error.code);
    return { error: COMPROBAR_CORREO_REINTENTA };
  }
  const claim = (Array.isArray(data) ? data[0] : data) as Claim | null | undefined;
  if (!claim) return { error: COMPROBAR_CORREO_NO_SIRVE };
  // La sesión es de otra cuenta: el mismo texto que sin sesión, sin decir de quién es.
  if (claim.outcome === "sin_sesion_del_titular") return { error: COMPROBAR_CORREO_ENTRA_PRIMERO };
  // Ese correo ya tiene otra cuenta: quedó marcado para el equipo.
  if (claim.outcome !== "ok" || !claim.check_id || !claim.auth_user_id || !claim.pending_email) {
    return { error: COMPROBAR_CORREO_NO_SIRVE };
  }
  // Cinturón: la app tampoco sigue si la cuenta que devuelve la base no es la de la sesión.
  if (claim.auth_user_id !== sessionUserId) {
    await soltar(admin, claim.check_id, false);
    return { error: COMPROBAR_CORREO_ENTRA_PRIMERO };
  }

  // 2. El correo pasa a la cuenta. Recién aquí entra a Auth.
  const { error: authErr } = await admin.auth.admin.updateUserById(claim.auth_user_id, {
    email: claim.pending_email,
    email_confirm: true,
  });
  if (authErr) {
    const ocupado = esCorreoOcupado(authErr);
    console.error("[comprobarCorreoAction] Auth no tomó el correo:", authErr.status, authErr.code);
    const sinRespuesta = !ocupado && (typeof authErr.status !== "number" || authErr.status === 0);
    if (sinRespuesta) {
      // La respuesta se perdió (red caída, sin status): el cambio pudo haberse
      // aplicado. Se le pregunta a Auth en qué quedó la cuenta antes de decidir.
      let actual: string | null = null;
      try {
        const { data: cuenta, error: leerErr } = await admin.auth.admin.getUserById(claim.auth_user_id);
        actual = leerErr ? null : (cuenta?.user?.email?.trim().toLowerCase() ?? null);
      } catch {
        actual = null;
      }
      if (actual === claim.pending_email) {
        // Ya lo tomó: se sigue a marcar comprobado.
      } else if (actual && esCorreoInterno(actual)) {
        // No lo tomó: sigue con su dirección interna. Se suelta para reintentar.
        const suelto = await soltar(admin, claim.check_id, false);
        return { error: suelto ? COMPROBAR_CORREO_REINTENTA : COMPROBAR_CORREO_NO_SIRVE };
      } else {
        // No se puede leer, o lleva otra cosa: para revisión, sin soltar.
        await dejarParaRevision(admin, claim.check_id, "no se supo en qué quedó la cuenta");
        return { error: COMPROBAR_CORREO_NO_SIRVE };
      }
    } else if (!ocupado && (authErr.status ?? 0) >= 500) {
      // Un error del servidor de Auth que no es el choque: no se sabe en qué
      // quedó la cuenta. El enlace no se suelta y queda para revisión del equipo.
      await dejarParaRevision(admin, claim.check_id, "Auth falló al tomar el correo");
      return { error: COMPROBAR_CORREO_NO_SIRVE };
    } else {
      const suelto = await soltar(admin, claim.check_id, ocupado);
      // Si no se pudo soltar, el enlace quedó gastado: que pida uno nuevo.
      return { error: ocupado || !suelto ? COMPROBAR_CORREO_NO_SIRVE : COMPROBAR_CORREO_REINTENTA };
    }
  }

  // 3. Marcar comprobado. La base exige que la cuenta ya lleve ese correo y que
  //    la sesión sea la del titular.
  const { error: confirmErr } = await admin.rpc("portal_email_check_confirm", {
    p_check_id: claim.check_id,
    p_session_user_id: sessionUserId,
  });
  if (!confirmErr) return { ok: true };

  // La cuenta ya lleva el correo pero no quedó «comprobado». Hay que devolverla
  // a su dirección interna; cada paso de la vuelta se revisa.
  console.error("[comprobarCorreoAction] confirmar falló:", confirmErr.code);
  const { data: fila, error: filaErr } = await admin
    .from("client_email_checks")
    .select("internal_email, verified_at")
    .eq("id", claim.check_id)
    .maybeSingle<{ internal_email: string; verified_at: string | null }>();
  // La confirmación pudo quedar hecha aunque la respuesta volviera con error.
  // Si la base ya dice «comprobado», no se deshace nada: es un éxito.
  if (!filaErr && fila?.verified_at) return { ok: true };
  if (filaErr || !fila?.internal_email) {
    await dejarParaRevision(admin, claim.check_id, "leer la dirección interna");
    return { error: COMPROBAR_CORREO_NO_SIRVE };
  }
  const { error: vueltaErr } = await admin.auth.admin.updateUserById(claim.auth_user_id, {
    email: fila.internal_email,
    email_confirm: true,
  });
  if (vueltaErr) {
    await dejarParaRevision(admin, claim.check_id, "devolver la cuenta");
    return { error: COMPROBAR_CORREO_NO_SIRVE };
  }
  const suelto = await soltar(admin, claim.check_id, false);
  return { error: suelto ? COMPROBAR_CORREO_REINTENTA : COMPROBAR_CORREO_NO_SIRVE };
}
