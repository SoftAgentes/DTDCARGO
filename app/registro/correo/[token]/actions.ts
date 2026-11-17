"use server";

/**
 * Enlace de comprobación del correo (SDD-0646, D-1 opción C) — el POST.
 *
 * ⚠️ Todo el valor de este archivo está en dos cosas:
 *   1. Es un POST. Un filtro de correo o un robot de vista previa abre el enlace
 *      con GET, y `page.tsx` sólo lee. El enlace se gasta aquí.
 *   2. SOLO comprueba. No crea sesión, no acuña ningún enlace de entrada y no
 *      devuelve nada con qué entrar: quien reciba este correo por error no abre
 *      el portal de nadie. Lo que habilita es que, de ahí en adelante, ese
 *      correo sirva para pedir el enlace de acceso en `/entrar`.
 *
 * Orden, a propósito: primero se reclama el enlace (atómico, un solo uso),
 * después el correo pasa a la cuenta con la API de Auth, y al final la base
 * marca «comprobado» (y exige que la cuenta YA lleve ese correo). Si el paso de
 * Auth falla por algo pasajero, el enlace se suelta para reintentar; si ese
 * correo ya tiene otra cuenta, queda marcado para que el equipo lo revise en
 * «Registros por link» y no se fusiona nada.
 *
 * Un solo mensaje para todo lo que no comprueba: no confirma qué tokens son
 * reales ni qué correos tienen cuenta.
 */

import { createAdminClient } from "@/lib/db/admin";
import {
  COMPROBAR_CORREO_NO_SIRVE,
  COMPROBAR_CORREO_REINTENTA,
  type ComprobarCorreoState,
} from "@/lib/portal/correo-comprobacion";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import { isRegistroTokenShape } from "@/lib/portal/registro-link-types";

type Claim = {
  check_id: string;
  auth_user_id: string;
  pending_email: string;
  outcome: "ok" | "conflicto";
};

/** Auth dice «ese correo ya es de otra cuenta» con estos códigos y textos. */
function esCorreoOcupado(err: { status?: number; code?: string; message?: string }): boolean {
  return (
    err.code === "email_exists" ||
    err.status === 422 ||
    /already (been )?registered|already exists|email_exists/i.test(err.message ?? "")
  );
}

export async function comprobarCorreoAction(
  _prev: ComprobarCorreoState,
  formData: FormData,
): Promise<ComprobarCorreoState> {
  const token = String(formData.get("token") ?? "");
  if (!isRegistroTokenShape(token)) return { error: COMPROBAR_CORREO_NO_SIRVE };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: COMPROBAR_CORREO_REINTENTA };
  }

  // 1. Reclamar. Vencido, usado, reemplazado o inventado: ninguna fila.
  const { data, error } = await admin.rpc("portal_email_check_claim", {
    p_token_hash: hashRegistroToken(token),
  });
  if (error) {
    console.error("[comprobarCorreoAction] reclamar falló:", error.code);
    return { error: COMPROBAR_CORREO_REINTENTA };
  }
  const claim = (Array.isArray(data) ? data[0] : data) as Claim | null | undefined;
  if (!claim?.check_id) return { error: COMPROBAR_CORREO_NO_SIRVE };
  // Ese correo ya tiene otra cuenta: quedó marcado para el equipo.
  if (claim.outcome !== "ok") return { error: COMPROBAR_CORREO_NO_SIRVE };

  // 2. El correo pasa a la cuenta. Recién aquí entra a Auth.
  const { error: authErr } = await admin.auth.admin.updateUserById(claim.auth_user_id, {
    email: claim.pending_email,
    email_confirm: true,
  });
  if (authErr) {
    const ocupado = esCorreoOcupado(authErr);
    await admin.rpc("portal_email_check_release", {
      p_check_id: claim.check_id,
      p_conflicto: ocupado,
    });
    console.error("[comprobarCorreoAction] Auth no tomó el correo:", authErr.status, authErr.code);
    return { error: ocupado ? COMPROBAR_CORREO_NO_SIRVE : COMPROBAR_CORREO_REINTENTA };
  }

  // 3. Marcar comprobado. La base exige que la cuenta ya lleve ese correo.
  const { error: confirmErr } = await admin.rpc("portal_email_check_confirm", {
    p_check_id: claim.check_id,
  });
  if (confirmErr) {
    // La cuenta ya lleva el correo pero no quedó «comprobado»: se devuelve la
    // cuenta a su dirección interna y se suelta el enlace, para no dejar un
    // correo habilitado en Auth que la base considera sin comprobar.
    console.error("[comprobarCorreoAction] confirmar falló:", confirmErr.code);
    const { data: fila } = await admin
      .from("client_email_checks")
      .select("internal_email")
      .eq("id", claim.check_id)
      .maybeSingle<{ internal_email: string }>();
    if (fila?.internal_email) {
      await admin.auth.admin.updateUserById(claim.auth_user_id, {
        email: fila.internal_email,
        email_confirm: true,
      });
    }
    await admin.rpc("portal_email_check_release", {
      p_check_id: claim.check_id,
      p_conflicto: false,
    });
    return { error: COMPROBAR_CORREO_REINTENTA };
  }

  return { ok: true };
}
