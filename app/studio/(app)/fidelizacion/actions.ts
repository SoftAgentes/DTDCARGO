/**
 * Server actions del módulo Fidelización & Referidos (SDD-0051, Slice B).
 *
 * Patrón del Studio: "use server" + parsing/validación manual con
 * `validateReferralInput()` de lib/studio/fidelizacion/types (NO Zod) +
 * resolución de tenant vía rpc("get_user_tenant_id") + revalidatePath.
 *
 * Acciones:
 *  - registerReferral(prev, formData)  → alta de referido (useActionState).
 *                                         Genera referral_code con
 *                                         next_referral_code y resuelve el
 *                                         referrer_client_id por MARKBOX (si el
 *                                         cliente existe en el tenant).
 *  - accreditReferral(id)              → status='acreditado' + reward_usd=80.
 *                                         ADVISORY · NO postea a CxC/Facturación
 *                                         (decisión §3.6). El operador aplica el
 *                                         crédito a mano en la próxima factura.
 *  - updateReferralStatus(id, status)  → avanza estado manual (valida enum).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  REFERRAL_RULES,
  REFERRAL_STEPS,
  validateReferralInput,
  type ReferralActionState,
  type ReferralInput,
  type ReferralStatus,
} from "@/lib/studio/fidelizacion/types";

type Result = { ok?: boolean; error?: string };

const VALID_STATUS = new Set<string>(REFERRAL_STEPS);

/** Resuelve el tenant del usuario logueado (RLS). null si no se puede. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.rpc("get_user_tenant_id");
  return (data as string | null) ?? null;
}

function revalidate(): void {
  revalidatePath("/studio/fidelizacion");
}

/** FormData → Partial<ReferralInput> (parsing manual). */
function inputFromFormData(formData: FormData): Partial<ReferralInput> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    referrer_markbox: str("referrer_markbox"),
    referred_name: str("referred_name"),
    referred_company: str("referred_company") || null,
    referred_email: str("referred_email") || null,
    referred_phone: str("referred_phone") || null,
    notes: str("notes") || null,
    // El alta siempre arranca en 'invitado' (default del validador).
    status: "invitado",
  };
}

/**
 * Registra un nuevo referido (useActionState).
 *
 * - Valida con validateReferralInput.
 * - Resuelve el tenant (RLS).
 * - Busca el cliente referidor por MARKBOX en el tenant para denormalizar el
 *   referrer_client_id (si existe; el trigger DB valida que sea del tenant).
 * - Genera el referral_code secuencial vía RPC next_referral_code.
 * - Inserta en `referrals`.
 */
export async function registerReferral(
  _prev: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateReferralInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Resolver el client_id del referidor por MARKBOX (denormalizado). Opcional:
  // el MARKBOX queda guardado igual aunque el cliente no exista en el ERP.
  let referrerClientId: string | null = null;
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("markbox", input!.referrer_markbox)
    .maybeSingle<{ id: string }>();
  if (clientRow?.id) referrerClientId = clientRow.id;

  // Código secuencial REF-YYYY-NNNN.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_referral_code",
    { p_tenant: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del referido." };
  }
  const referralCode = String(codeData);

  const { error } = await supabase.from("referrals").insert({
    tenant_id: tenantId,
    referral_code: referralCode,
    referrer_client_id: referrerClientId,
    referrer_markbox: input!.referrer_markbox,
    referred_name: input!.referred_name,
    referred_company: input!.referred_company,
    referred_email: input!.referred_email,
    referred_phone: input!.referred_phone,
    status: input!.status,
    reward_usd: 0,
    notes: input!.notes,
  });
  if (error) {
    return { error: `No se pudo registrar el referido: ${error.message}` };
  }

  revalidate();
  return { ok: true, createdCode: referralCode };
}

/**
 * Acredita el crédito al referidor (ADVISORY).
 * Marca status='acreditado' + setea reward_usd = referrerReward (80 USD).
 * NO postea a CxC/Facturación (decisión §3.6) — el operador aplica el crédito
 * a mano en la próxima factura.
 */
export async function accreditReferral(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("referrals")
    .update({
      status: "acreditado" satisfies ReferralStatus,
      reward_usd: REFERRAL_RULES.referrerReward,
    })
    .eq("id", id);
  if (error) return { error: `No se pudo acreditar: ${error.message}` };
  revalidate();
  return { ok: true };
}

/** Avanza/cambia el estado de un referido (manual; valida enum). */
export async function updateReferralStatus(
  id: string,
  status: ReferralStatus,
): Promise<Result> {
  if (!VALID_STATUS.has(status)) return { error: "Estado de referido inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("referrals")
    .update({ status })
    .eq("id", id);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}
