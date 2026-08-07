"use server";

/**
 * Server action que FIJA la contraseña y CONSUME el enlace de acceso.
 * SDD-0250 (corrección) · migr 0354.
 *
 * ⚠️ ESTE ES EL ÚNICO LUGAR DONDE EL TOKEN SE GASTA. Abrir la página no lo
 * toca: un GET lo dispara cualquier escáner de correo o vista previa, y así
 * fue como la primera versión murió en producción.
 *
 * El consumo va PRIMERO y de forma condicional (`.is("used_at", null)`), antes
 * de tocar la contraseña. Es un compare-and-swap: si dos peticiones llegan a la
 * vez, sólo una ve filas afectadas y la otra se va con "enlace ya usado". Al
 * revés —cambiar la clave y después marcar usado— dos envíos simultáneos
 * cambiarían la contraseña dos veces, y la segunda ganaría en silencio.
 *
 * Si el cambio de contraseña falla DESPUÉS de marcar el token, se revierte el
 * marcado para no dejar a la persona con un enlace quemado y sin clave nueva.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import {
  accessTokenStatus,
  validateNewPassword,
  type AccessTokenRow,
} from "@/lib/studio/access-token";

export interface SetPasswordState {
  error?: string;
}

export async function setPasswordWithAccessToken(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = ((formData.get("token") as string | null) ?? "").trim();
  const password = (formData.get("password") as string | null) ?? "";
  const repeat = (formData.get("repeat") as string | null) ?? "";

  if (!token) return { error: "Falta el enlace. Ábrelo de nuevo desde tu correo." };

  const invalido = validateNewPassword(password, repeat);
  if (invalido) return { error: invalido };

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("studio_access_tokens")
    .select("id, tenant_id, user_id, expires_at, used_at, revoked_at")
    .eq("token", token)
    .maybeSingle<AccessTokenRow>();

  if (!row) {
    return { error: "Este enlace no existe. Pídele uno nuevo a un admin." };
  }

  const estado = accessTokenStatus(row);
  if (estado === "usado") {
    return {
      error: "Este enlace ya se usó. Entra con tu correo y la clave que creaste.",
    };
  }
  if (estado === "revocado") {
    return { error: "Este enlace fue anulado. Pídele uno nuevo a un admin." };
  }
  if (estado === "expirado") {
    return { error: "Este enlace venció. Pídele uno nuevo a un admin." };
  }

  // Compare-and-swap: sólo gana quien todavía lo ve sin usar.
  const { data: consumido, error: consumoErr } = await admin
    .from("studio_access_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (consumoErr || !consumido) {
    return {
      error: "Este enlace acaba de usarse. Si no fuiste tú, pídele uno nuevo a un admin.",
    };
  }

  const { error: passErr } = await admin.auth.admin.updateUserById(row.user_id, {
    password,
  });

  if (passErr) {
    // Devolvemos el token a su estado anterior: sin esto la persona queda con
    // el enlace quemado Y sin contraseña nueva, o sea peor que antes.
    await admin
      .from("studio_access_tokens")
      .update({ used_at: null })
      .eq("id", row.id);
    console.error("[setPasswordWithAccessToken] updateUserById:", passErr.message);
    return {
      error: "No se pudo guardar la contraseña. Intenta de nuevo con el mismo enlace.",
    };
  }

  redirect("/studio/login?listo=1");
}
