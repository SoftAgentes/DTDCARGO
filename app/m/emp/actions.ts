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
import { createClient } from "@/lib/db/server";
import { getInviteByToken } from "@/lib/studio/nomina/invite-queries";
import { isInviteUsable } from "@/lib/studio/nomina/invite-types";
import { validateRegistrationInput } from "@/lib/studio/nomina/registration-types";
import {
  validateEmployeeProfileInput,
  bankDataChanged,
} from "@/lib/studio/nomina/profile-types";
import {
  getMyEmployee,
  getMyPayslip,
  type MyPayslip,
} from "@/lib/studio/nomina/employee-self-queries";

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

// ╔═══════════════════════════════════════════════════════════╗
// ║ App del empleado · sesión propia (SDD-0113 Slice C)        ║
// ╚═══════════════════════════════════════════════════════════╝
//
// Estas actions NO llevan moduleEditDenial("nomina"): el caller es el EMPLEADO,
// no un rol Studio. El candado es la RLS por empleado (employee_id =
// get_employee_id_for_user()) + el allowlist server-side del perfil. La sesión
// es la del empleado (createClient lee su cookie); la RLS lo acota a lo suyo.

export type EmpActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** true si el cambio bancario quedó pendiente de verificación del admin. */
  bankPending?: boolean;
};

/**
 * Trae MI recibo de un período (cambio de selector). Vía RPC get_my_payslip:
 * SOLO mi renglón, SOLO confirmado/pagado. La RLS/RPC acota al propio empleado.
 */
export async function fetchMyPayslipAction(period: string): Promise<MyPayslip | null> {
  const supabase = await createClient();
  return getMyPayslip(supabase, period || null);
}

/**
 * Marca una comunicación como LEÍDA (read_at). La RLS self-update solo deja tocar
 * los comms del propio empleado → no puede marcar los de otro. Solo set read_at
 * si estaba vacío (idempotente; no pisa el primer timestamp).
 */
export async function markCommReadAction(
  commId: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!commId) return { error: "Falta el id de la comunicación." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("nomina_employee_comms")
    .update({ read_at: new Date().toISOString() })
    .eq("id", commId)
    .is("read_at", null);

  if (error) return { error: `No se pudo marcar como leída: ${error.message}` };

  revalidatePath("/m/emp");
  return { ok: true };
}

/**
 * "Acuso recibo" → setea acked_at (timestamp in-app). RLS self-update acota al
 * dueño. Solo si requires_ack y aún sin acked. Marca read_at de paso.
 */
export async function ackCommAction(
  commId: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!commId) return { error: "Falta el id de la comunicación." };
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .update({ acked_at: now, read_at: now })
    .eq("id", commId)
    .eq("requires_ack", true)
    .is("acked_at", null)
    .select("id");

  if (error) return { error: `No se pudo confirmar: ${error.message}` };
  if (!data || data.length === 0) {
    return { error: "Esta comunicación no requiere confirmación o ya fue confirmada." };
  }

  revalidatePath("/m/emp");
  return { ok: true };
}

/**
 * Actualiza el perfil self-service. ALLOWLIST server-side: solo phone/email/bank_*
 * (validateEmployeeProfileInput descarta el resto, aunque venga en el FormData).
 * phone/email → directo vía RPC update_my_contact (allowlist en la DB). Cambio
 * bancario → NO entra directo: queda PENDIENTE de verificación del admin
 * (request_my_bank_change). Sin moduleEditDenial: candado = RLS por empleado.
 */
export async function updateMyProfileAction(
  _prev: EmpActionState,
  formData: FormData,
): Promise<EmpActionState> {
  const supabase = await createClient();

  // Defensa de sesión: sin ficha enlazada → no autorizado (no se confía en input).
  const me = await getMyEmployee(supabase);
  if (!me) return { error: "No tienes una ficha de empleado activa." };

  const { input, fieldErrors } = validateEmployeeProfileInput({
    phone: strOrNull(formData.get("phone")),
    email: strOrNull(formData.get("email")),
    bank_name: strOrNull(formData.get("bank_name")),
    bank_account_type: strOrNull(formData.get("bank_account_type")),
    bank_account: strOrNull(formData.get("bank_account")),
    // Estos llegan en el FormData de un atacante pero el validador NO los copia:
    salary_usd: strOrNull(formData.get("salary_usd")),
    position_label: strOrNull(formData.get("position_label")),
    status: strOrNull(formData.get("status")),
  });
  if (fieldErrors) return { fieldErrors };

  // 1) Contacto directo (phone/email) → RPC allowlist en la DB.
  const { error: contactErr } = await supabase.rpc("update_my_contact", {
    p_phone: input!.phone,
    p_email: input!.email,
  });
  if (contactErr) return { error: `No se pudo guardar el contacto: ${contactErr.message}` };

  // 2) Cambio bancario → SOLO si cambió → staging pendiente de verificación.
  let bankPending = false;
  const changed = bankDataChanged(
    {
      bank_name: input!.bank_name,
      bank_account_type: input!.bank_account_type,
      bank_account: input!.bank_account,
    },
    { bank_name: me.bank_name, bank_account_type: me.bank_account_type, bank_account: me.bank_account },
  );
  if (changed) {
    const { error: bankErr } = await supabase.rpc("request_my_bank_change", {
      p_bank_name: input!.bank_name,
      p_bank_account_type: input!.bank_account_type,
      p_bank_account: input!.bank_account,
    });
    if (bankErr) return { error: `No se pudo solicitar el cambio bancario: ${bankErr.message}` };
    bankPending = true;
  }

  revalidatePath("/m/emp");
  return { ok: true, bankPending };
}
