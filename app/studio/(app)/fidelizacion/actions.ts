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
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  REFERRAL_RULES,
  REFERRAL_STEPS,
  validateReferralInput,
  type ReferralActionState,
  type ReferralInput,
  type ReferralStatus,
} from "@/lib/studio/fidelizacion/types";
import {
  applicableInvoicesForReferrer,
  isPurchaseAfterCredit,
  CREDIT_APPLICABLE_INVOICE_STATUSES,
  type ApplicableInvoice,
} from "@/lib/studio/fidelizacion/referral-credit-queries";
import {
  postReferralCreditJournalEntry,
  voidReferralCreditEntry,
} from "@/lib/studio/accounting/referral-credit-posting";

type Result = { ok?: boolean; error?: string };

/** Redondeo a 2 decimales (dinero). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Estados billable. Deriva de la FUENTE ÚNICA (referral-credit-queries) para que
 *  el gate de la action y el filtro del picker no puedan divergir. */
const APPLICABLE_INVOICE_STATUSES = new Set<string>(
  CREDIT_APPLICABLE_INVOICE_STATUSES,
);
const APPLICABLE_INVOICE_CURRENCIES = new Set(["USD", "USDT"]);

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
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };


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
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };

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

/** Avanza/cambia el estado de un referido (manual; valida enum del PIPELINE). */
export async function updateReferralStatus(
  id: string,
  status: ReferralStatus,
): Promise<Result> {
  // VALID_STATUS = REFERRAL_STEPS → 'aplicado' NO es alcanzable por avance
  // manual (es estado de dinero: pasa solo por applyReferralCredit con gate).
  if (!VALID_STATUS.has(status)) return { error: "Estado de referido inválido." };
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("referrals")
    .update({ status })
    .eq("id", id);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// SDD-0137 · Aplicación del crédito de referido (MUEVE PLATA)
//
// El sistema PROPONE, accounting APLICA (fail-closed). Aplicar el crédito
// acreditado ($80) reduce la CxC del referidor en su próxima factura y genera un
// asiento con clasificación FIJA (DR 4.9 Descuentos sobre ventas / CR 1.1.2 CxC).
// Sin setting y sin nada fiscal: el módulo Fiscal está apagado y lleva su propio
// libro (founder 2026-07-15). Idempotente por estado ('acreditado'→'aplicado' con
// row-lock).
// ─────────────────────────────────────────────────────────────

/**
 * Facturas del referidor a las que se puede aplicar el crédito de un referido
 * acreditado (para el picker de la UI). Gate de dinero: accounting/admin.
 */
export async function listApplicableInvoices(
  referralId: string,
): Promise<{ invoices?: ApplicableInvoice[]; error?: string }> {
  const supabase = await createClient();
  // Gate de DINERO (fail-closed): mostrar/aplicar créditos es de accounting/admin.
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  if (!referralId) return { error: "Falta el crédito." };

  const { data: ref } = await supabase
    .from("referrals")
    .select("referrer_markbox, reward_usd, status, accredited_at")
    .eq("id", referralId)
    .maybeSingle<{
      referrer_markbox: string;
      reward_usd: number;
      status: ReferralStatus;
      accredited_at: string | null;
    }>();
  if (!ref) return { error: "Crédito no encontrado." };
  if (ref.status !== "acreditado") {
    return { error: "Este crédito no está disponible para aplicar." };
  }

  try {
    const invoices = await applicableInvoicesForReferrer(
      supabase,
      ref.referrer_markbox,
      Number(ref.reward_usd) || 0,
      ref.accredited_at ?? null,
    );
    return { invoices };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudieron leer las facturas.",
    };
  }
}

/**
 * Aplica el crédito acreditado de un referido a una factura del referidor.
 *
 * Fail-closed en capas:
 *  1. GATE DE DINERO: moduleEditDenial("accounting") → solo accounting/admin.
 *  2. Validación de coherencia: crédito 'acreditado' con monto, factura del
 *     MISMO referidor, billable, USD/USDT y total ≥ crédito (V1 no parte).
 *  3. Claim atómico idempotente: UPDATE ... WHERE status='acreditado' (row-lock
 *     → un segundo intento no re-aplica; devuelve 0 filas).
 *  4. Asiento best-effort (clasificación fija: descuento sobre la venta). Si NO se
 *     pudo crear (falta la cuenta del plan, etc.) → REVIERTE el claim (todo o nada).
 */
export async function applyReferralCredit(
  referralId: string,
  invoiceId: string,
): Promise<Result & { entryCode?: string }> {
  const supabase = await createClient();
  // 1) GATE DE DINERO (fail-closed). moduleEditDenial de verdad: el módulo
  //    "accounting" solo lo edita accounting/admin (MONEY_MODULES, SDD-0085).
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  if (!referralId || !invoiceId) {
    return { error: "Faltan datos para aplicar el crédito." };
  }

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // 2a) El crédito debe estar 'acreditado' y tener monto.
  const { data: ref } = await supabase
    .from("referrals")
    .select("id, referral_code, referrer_markbox, reward_usd, status, accredited_at")
    .eq("id", referralId)
    .maybeSingle<{
      id: string;
      referral_code: string;
      referrer_markbox: string;
      reward_usd: number;
      accredited_at: string | null;
      status: ReferralStatus;
    }>();
  if (!ref) return { error: "Crédito no encontrado." };
  if (ref.status !== "acreditado") {
    return { error: "Este crédito no está disponible para aplicar (debe estar acreditado)." };
  }
  const amount = Number(ref.reward_usd) || 0;
  if (amount <= 0) return { error: "El crédito no tiene monto para aplicar." };

  // 2b) La factura debe ser del MISMO referidor, billable, USD/USDT, SALDO ≥ crédito.
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_code, client_markbox, currency, total_amount, paid_amount, status, issued_at")
    .eq("id", invoiceId)
    .maybeSingle<{
      id: string;
      invoice_code: string;
      client_markbox: string;
      currency: string;
      total_amount: number;
      paid_amount: number;
      status: string;
      issued_at: string | null;
    }>();
  if (!inv) return { error: "Factura no encontrada." };
  if (inv.client_markbox !== ref.referrer_markbox) {
    return { error: "La factura no es del cliente que refiere." };
  }
  if (!APPLICABLE_INVOICE_STATUSES.has(inv.status)) {
    return { error: "La factura no admite crédito (debe estar emitida, parcial o vencida)." };
  }
  if (!APPLICABLE_INVOICE_CURRENCIES.has(inv.currency)) {
    return { error: "En V1 el crédito solo se aplica a facturas en USD o USDT." };
  }
  // COMPRA NUEVA (regla del founder 2026-07-15): la factura debe ser del día en que
  // NACIÓ el crédito (accredited_at, migr 0238) en adelante — no de cuándo se
  // registró el referido, que puede ser meses antes y dejaría pasar deuda vieja.
  // Gate server-side: el picker filtra, pero la UI no es la autoridad (esta action
  // acepta cualquier invoiceId). Mismo helper que el picker → no pueden divergir.
  if (!isPurchaseAfterCredit(inv.issued_at, ref.accredited_at)) {
    return {
      error:
        "El crédito solo se aplica a una compra NUEVA (posterior al crédito), no a facturas anteriores ni a deuda vieja.",
    };
  }
  // Fix A (over-credit): validar contra el SALDO REAL, no el total. Una 'parcial'
  // con paid_amount alto puede tener saldo < crédito; aplicar el $80 completo
  // dejaría la CxC del referidor negativa (se le "regala" más de lo debido). V1
  // no parte el crédito → si el saldo no alcanza, se rechaza y se pide otra factura.
  const paidAmount = Number(inv.paid_amount) || 0;
  const balance = round2(Math.max(0, (Number(inv.total_amount) || 0) - paidAmount));
  if (balance < amount) {
    return {
      error: `El saldo de la factura ($${balance.toFixed(2)}) es menor que el crédito ($${amount.toFixed(2)}); espera una factura con saldo suficiente (V1 no parte el crédito).`,
    };
  }

  // 3) CLAIM ATÓMICO idempotente: transición 'acreditado' → 'aplicado'. El
  //    filtro por status en el UPDATE + el row-lock de Postgres garantizan que
  //    un segundo intento (doble-submit / carrera) no re-aplique: devuelve 0 filas.
  const appliedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("referrals")
    .update({
      status: "aplicado" satisfies ReferralStatus,
      applied_invoice_id: invoiceId,
      applied_at: appliedAt,
    })
    .eq("id", referralId)
    .eq("status", "acreditado")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (claimErr) return { error: `No se pudo aplicar el crédito: ${claimErr.message}` };
  if (!claimed) {
    return { error: "El crédito ya fue aplicado (o cambió de estado)." };
  }

  // 4) Asiento contable según el modo configurado (best-effort). Si NO se pudo
  //    crear (falta la cuenta del plan, monto cero, etc.) → revierte el claim:
  //    mover plata sin asiento es peor que no moverla.
  const posting = await postReferralCreditJournalEntry({
    tenantId,
    referralId,
    referralCode: ref.referral_code,
    referrerMarkbox: ref.referrer_markbox,
    invoiceId,
    invoiceCode: inv.invoice_code,
    amountUsd: amount,
  });
  if (!posting.ok) {
    await supabase
      .from("referrals")
      .update({
        status: "acreditado" satisfies ReferralStatus,
        applied_invoice_id: null,
        applied_entry_id: null,
        applied_at: null,
      })
      .eq("id", referralId)
      .eq("status", "aplicado");
    return {
      error: `No se pudo generar el asiento del crédito: ${posting.error ?? posting.skipped ?? "desconocido"}. No se aplicó nada.`,
    };
  }

  // 5) Linkear el asiento creado al crédito (rastro + idempotencia del posting).
  //    El asiento ya trae referral_id → la reversión lo barre aunque este link
  //    quede NULL por un crash acá (hueco B cerrado en la reversión + UNIQUE DB).
  if (posting.entryId) {
    await supabase
      .from("referrals")
      .update({ applied_entry_id: posting.entryId })
      .eq("id", referralId);
  }

  // 6) Fix C — consistencia GL↔subledger: el asiento bajó la CxC del referidor
  //    en el GL (CR 1.1.2 $80); acá bajamos el SALDO de su factura registrando
  //    el crédito como un ABONO NO-MONETARIO (sube paid_amount en el monto del
  //    crédito). Así el beneficio se "entrega" por saldo y el mayor no diverge
  //    del subledger. No hay payment_receipt (no entró caja): es un abono por
  //    crédito, con la misma traza temporal (applied_at). Idempotente: el claim
  //    de arriba garantiza un único paso 'acreditado'→'aplicado' por crédito.
  //    GUARD OPTIMISTA (.eq paid_amount): `paidAmount` se leyó en el paso 2b y
  //    entre esa lectura y este UPDATE puede haber entrado un pago real de la
  //    factura. Escribir `viejo + 80` a ciegas PISA ese pago y lo borra del
  //    subledger (lost update). Con el guard, si alguien lo movió el UPDATE
  //    matchea 0 filas y lo tratamos como conflicto en vez de corromper.
  //    (paid_amount es NOT NULL DEFAULT 0 → no hay caso NULL que rompa el .eq.)
  const newPaid = round2(paidAmount + amount);
  const fullyPaid = newPaid >= (Number(inv.total_amount) || 0) - 1e-6;
  const { data: paidRow, error: paidErr } = await supabase
    .from("invoices")
    .update({
      paid_amount: newPaid,
      status: fullyPaid ? "pagada" : "parcial",
      last_payment_at: appliedAt,
    })
    .eq("id", invoiceId)
    .eq("paid_amount", paidAmount)
    .select("id")
    .maybeSingle<{ id: string }>();

  //    Este paso NO puede ser best-effort: el asiento ya bajó la CxC $80 en el
  //    GL. Si el subledger no acompaña, el mayor y la factura divergen y nadie
  //    se entera (antes devolvía ok:true igual). Ante fallo o conflicto,
  //    compensamos TODO hacia atrás: anulamos el asiento y devolvemos el crédito
  //    a 'acreditado' para que se pueda reintentar sobre el saldo real.
  if (paidErr || !paidRow) {
    await voidReferralCreditEntry(tenantId, posting.entryId ?? "");
    await supabase
      .from("referrals")
      .update({
        status: "acreditado" satisfies ReferralStatus,
        applied_invoice_id: null,
        applied_entry_id: null,
        applied_at: null,
      })
      .eq("id", referralId)
      .eq("status", "aplicado");

    return {
      error: paidErr
        ? `No se pudo abonar el crédito en la factura: ${paidErr.message}. Se revirtió todo; no se aplicó nada.`
        : "La factura cambió de saldo mientras se aplicaba el crédito (¿entró un pago?). Se revirtió todo; volvé a intentar.",
    };
  }

  revalidate();
  revalidatePath("/studio/facturacion");
  return { ok: true, entryCode: posting.entryCode };
}
