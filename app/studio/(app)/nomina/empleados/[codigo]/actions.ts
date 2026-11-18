/**
 * Server actions de la ficha del empleado (SDD-0652 fase 2).
 *
 *  - linkEmployeeUserAction / unlinkEmployeeUserAction · enlace ficha ↔ usuario (solo admin).
 *  - uploadEmployeePhotoAction / removeEmployeePhotoAction · foto (admin y Contabilidad).
 *  - revealBankAccountAction · cuenta bancaria completa, con motivo (admin y Contabilidad).
 *
 * Cada una pasa tres controles, en este orden:
 *
 *   1. `moduleEditDenial(supabase, "nomina")`: la puerta del módulo.
 *   2. `getFichaEmpleadoAccess`: rol `admin` o `accounting` con la membresía
 *      activa. Un acceso extra a `nomina` pasa la primera y no esta.
 *   3. La RPC de la migración 0555, que repite rol y tenant en la base y deja
 *      el evento en la misma transacción.
 *
 * Ninguna devuelve datos de la ficha salvo el revelado, que devuelve la cuenta
 * una sola vez y no la guarda en ningún lado.
 */

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { getFichaEmpleadoAccess } from "@/lib/studio/nomina/ficha-empleado-guard";
import { motivoValido } from "@/lib/studio/nomina/ficha-empleado";
import {
  EMPLOYEE_PHOTO_BUCKET,
  EMPLOYEE_PHOTO_MAX_BYTES,
  procesarFotoEmpleado,
  rutaFotoEmpleado,
} from "@/lib/studio/nomina/employee-photo";

const MODULE_ID = "nomina";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_PERMISO = "No tienes permiso para hacer esto en la ficha.";
const MOTIVO = "Escribe el motivo (entre 4 y 500 caracteres).";

export type FichaActionResult = { ok: true } | { error: string };

type RpcError = { code?: string; message?: string } | null;

/** Lo que la persona lee cuando la RPC rechaza. Nunca el texto crudo de un error inesperado. */
function mensajeDeRpc(error: RpcError, porDefecto: string): string {
  const code = error?.code ?? "";
  const texto = (error?.message ?? "").replace(/^nomina:\s*/, "");
  if (code === "PGRST202" || code === "42883") {
    return "Esta función todavía no está disponible. Avísale a quien administra el sistema.";
  }
  if (code === "42501") return SIN_PERMISO;
  if (code === "P0002") return "La ficha no existe o ya no está disponible.";
  if ((code === "22023" || code === "23505") && texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
  }
  return porDefecto;
}

function revalidar(codigo: string | null): void {
  revalidatePath("/studio/nomina");
  if (codigo) revalidatePath(`/studio/nomina/empleados/${codigo}`);
}

/** Enlaza la ficha con un miembro del Studio. Solo admin, con motivo. */
export async function linkEmployeeUserAction(
  employeeId: string,
  userId: string,
  reason: string,
): Promise<FichaActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };
  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok || acceso.nivel !== "admin") return { error: SIN_PERMISO };
  if (!UUID_RE.test(employeeId ?? "") || !UUID_RE.test(userId ?? "")) return { error: "Elige a la persona que vas a enlazar." };
  if (!motivoValido(reason)) return { error: MOTIVO };

  const { error } = await supabase.rpc("nomina_link_employee_user", {
    p_employee_id: employeeId,
    p_user_id: userId,
    p_reason: reason.trim(),
  });
  if (error) return { error: mensajeDeRpc(error, "No se pudo enlazar. Intenta de nuevo.") };

  revalidar(await codigoDe(supabase, acceso.tenantId, employeeId));
  return { ok: true };
}

/** Quita el enlace. La ficha y el usuario quedan. Solo admin, con motivo. */
export async function unlinkEmployeeUserAction(employeeId: string, reason: string): Promise<FichaActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };
  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok || acceso.nivel !== "admin") return { error: SIN_PERMISO };
  if (!UUID_RE.test(employeeId ?? "")) return { error: "Empleado inválido." };
  if (!motivoValido(reason)) return { error: MOTIVO };

  const { error } = await supabase.rpc("nomina_unlink_employee_user", {
    p_employee_id: employeeId,
    p_reason: reason.trim(),
  });
  if (error) return { error: mensajeDeRpc(error, "No se pudo quitar el enlace. Intenta de nuevo.") };

  revalidar(await codigoDe(supabase, acceso.tenantId, employeeId));
  return { ok: true };
}

/**
 * Sube o cambia la foto. Primero se sube el archivo nuevo; después la RPC
 * cambia la referencia y deja `photo_set` en una transacción. Si la RPC falla,
 * el archivo recién subido se borra aquí; si eso también falla, lo limpia la
 * reconciliación de huérfanos. El archivo anterior no se borra en el momento.
 */
export async function uploadEmployeePhotoAction(employeeId: string, formData: FormData): Promise<FichaActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };
  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok) return { error: SIN_PERMISO };
  if (!UUID_RE.test(employeeId ?? "")) return { error: "Empleado inválido." };

  const archivo = formData.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige una foto." };
  if (archivo.size > EMPLOYEE_PHOTO_MAX_BYTES) return { error: "La foto pesa más de 2 MB." };

  // La ficha, en el tenant de la membresía: existe y no está egresada.
  const { data: ficha, error: errFicha } = await supabase
    .from("nomina_employees")
    .select("id, employee_code, status")
    .eq("tenant_id", acceso.tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; employee_code: string; status: string }>();
  if (errFicha) return { error: "No se pudo leer la ficha. Intenta de nuevo." };
  if (!ficha) return { error: "La ficha no existe o ya no está disponible." };
  if (ficha.status === "egresado") return { error: "La foto de una ficha egresada no se cambia." };

  const procesada = await procesarFotoEmpleado(new Uint8Array(await archivo.arrayBuffer()));
  if (!procesada.ok) return { error: procesada.error };

  const ruta = rutaFotoEmpleado(acceso.tenantId, ficha.id, randomUUID());
  const admin = createAdminClient();
  const { error: errSubida } = await admin.storage
    .from(EMPLOYEE_PHOTO_BUCKET)
    .upload(ruta, procesada.webp, { contentType: "image/webp", upsert: false });
  if (errSubida) {
    console.error("[ficha-empleado] subir foto", errSubida.message);
    return { error: "No se pudo guardar la foto. Intenta de nuevo." };
  }

  const { error } = await supabase.rpc("nomina_set_employee_photo", {
    p_employee_id: ficha.id,
    p_photo_path: ruta,
  });
  if (error) {
    const { error: errLimpieza } = await admin.storage.from(EMPLOYEE_PHOTO_BUCKET).remove([ruta]);
    if (errLimpieza) console.error("[ficha-empleado] limpiar foto sin referencia", errLimpieza.message);
    return { error: mensajeDeRpc(error, "No se pudo guardar la foto. Intenta de nuevo.") };
  }

  revalidar(ficha.employee_code);
  return { ok: true };
}

/** Quita la foto: la ficha deja de tenerla. El archivo lo limpia la reconciliación. */
export async function removeEmployeePhotoAction(employeeId: string): Promise<FichaActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };
  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok) return { error: SIN_PERMISO };
  if (!UUID_RE.test(employeeId ?? "")) return { error: "Empleado inválido." };

  const { error } = await supabase.rpc("nomina_set_employee_photo", {
    p_employee_id: employeeId,
    p_photo_path: null,
  });
  if (error) return { error: mensajeDeRpc(error, "No se pudo quitar la foto. Intenta de nuevo.") };

  revalidar(await codigoDe(supabase, acceso.tenantId, employeeId));
  return { ok: true };
}

/**
 * Devuelve la cuenta bancaria completa, una vez, con motivo. La RPC deja
 * `bank_account_revealed` antes de devolverla; si no puede, no devuelve nada.
 * No se revalida ni se guarda: la cuenta vive solo en la respuesta.
 */
export async function revealBankAccountAction(
  employeeId: string,
  reason: string,
): Promise<{ ok: true; cuenta: string } | { error: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };
  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok) return { error: SIN_PERMISO };
  if (!UUID_RE.test(employeeId ?? "")) return { error: "Empleado inválido." };
  if (!motivoValido(reason)) return { error: MOTIVO };

  const { data, error } = await supabase.rpc("nomina_reveal_bank_account", {
    p_employee_id: employeeId,
    p_reason: reason.trim(),
  });
  if (error) return { error: mensajeDeRpc(error, "No se pudo mostrar la cuenta. Intenta de nuevo.") };
  if (typeof data !== "string" || !data) return { error: "No se pudo mostrar la cuenta. Intenta de nuevo." };
  return { ok: true, cuenta: data };
}

/** El código de la ficha, para revalidar su ruta. Si no se puede leer, se revalida solo la lista. */
async function codigoDe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  employeeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("nomina_employees")
    .select("employee_code")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .maybeSingle<{ employee_code: string }>();
  return data?.employee_code ?? null;
}
