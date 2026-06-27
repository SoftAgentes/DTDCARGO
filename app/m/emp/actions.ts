/**
 * Server actions de la app del empleado (SDD-0113 · /m/emp).
 *
 * Slice A: `submitRegistrationAction` — el auto-registro del candidato. Es
 * PÚBLICO (el candidato no tiene sesión todavía): corre con un cliente de
 * servicio que **valida el token de invitación** (decisión founder: registro
 * SOLO con token válido) e inserta la solicitud en `pendiente`. No lee ni
 * escribe ninguna otra tabla. El candidato NO gana acceso: el admin aprueba.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getInviteByToken } from "@/lib/studio/nomina/invite-queries";
import { isInviteUsable } from "@/lib/studio/nomina/invite-types";
import { validateRegistrationInput } from "@/lib/studio/nomina/registration-types";

export type RegistroActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Auto-registro del candidato por link de invitación. Público + service client:
 * valida el token, inserta la solicitud `pendiente`, y marca la invitación
 * `usada` (un link = un registro). El sueldo NO se acepta acá (lo fija la empresa
 * al aprobar). Anti-spam = token-only (sin token válido no hay registro).
 */
export async function submitRegistrationAction(
  _prev: RegistroActionState,
  formData: FormData,
): Promise<RegistroActionState> {
  const token = strOrNull(formData.get("token"));
  if (!token) return { error: "Falta el token de invitación. Abre el link que te enviaron." };

  const { input, fieldErrors } = validateRegistrationInput({
    full_name: strOrNull(formData.get("full_name")),
    national_id: strOrNull(formData.get("national_id")),
    birth_date: strOrNull(formData.get("birth_date")),
    phone: strOrNull(formData.get("phone")),
    email: strOrNull(formData.get("email")),
    cargo: strOrNull(formData.get("cargo")),
    start_date: strOrNull(formData.get("start_date")),
    bank_name: strOrNull(formData.get("bank_name")),
    bank_account_type: strOrNull(formData.get("bank_account_type")),
    bank_account: strOrNull(formData.get("bank_account")),
  });
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();

  // 1) Validar el token (sin sesión). El service client salta la RLS; el tenant
  //    sale del propio invite, no del cliente — no se confía en input externo.
  const invite = await getInviteByToken(admin, token);
  if (!invite || !isInviteUsable(invite)) {
    return { error: "La invitación no es válida o ya venció. Pídele al admin un link nuevo." };
  }

  // 2) Insertar la solicitud en staging (pendiente).
  const { error: insErr } = await admin.from("nomina_employee_registrations").insert({
    tenant_id: invite.tenant_id,
    invite_id: invite.id,
    full_name: input!.full_name,
    national_id: input!.national_id,
    birth_date: input!.birth_date,
    phone: input!.phone,
    email: input!.email,
    cargo: input!.cargo ?? invite.cargo,
    start_date: input!.start_date,
    bank_name: input!.bank_name,
    bank_account_type: input!.bank_account_type,
    bank_account: input!.bank_account,
    status: "pendiente",
  });

  if (insErr) {
    // Índice único parcial: una solicitud pendiente por (tenant, email).
    if (insErr.code === "23505") {
      return { error: "Ya enviaste una solicitud con ese correo. Espera la aprobación del admin." };
    }
    return { error: `No se pudo enviar la solicitud: ${insErr.message}` };
  }

  // 3) Marcar la invitación usada (un link = un registro).
  await admin
    .from("nomina_employee_invites")
    .update({ status: "usada", used_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "activa");

  revalidatePath("/m/emp/registro");
  return { ok: true };
}
