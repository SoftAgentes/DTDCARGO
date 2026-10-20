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
 *  - accreditReferral(id, motivo)      → acredita A MANO, sin venta: solo el
 *                                         admin, con motivo (SDD-0567, RPC de la
 *                                         0494). ⚠️ **El caso normal es
 *                                         AUTOMÁTICO**: el trigger
 *                                         `invoices_accredit_referral` (migr 0197,
 *                                         reescrito en 0250 y 0494) acredita en la 1ª
 *                                         factura billable del referido y guarda
 *                                         esa factura. Contrato: SDD-0309.
 *  - updateReferralStatus(id, status, markbox?) → avanza a mano: invitado →
 *                                         registrado (con el cliente) o registrado
 *                                         → primer embarque (RPC de la 0494).
 *  - saveReferralSettingsAction(...)   → premio por tenant (`referral_settings`,
 *                                         migr 0250). Es de ahí que el trigger lee
 *                                         el monto; antes estaba fijo en 80.
 *  - listApplicableInvoices / applyReferralCredit → aplican el crédito ya
 *                                         acreditado a una factura concreta.
 *
 * 🔴 **Acreditar sigue siendo ADVISORY**: registra el premio, NO postea a
 * CxC. Lo que dejó de ser manual es CUÁNDO se acredita, no que mueva plata.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateReferralInput,
  type ReferralActionState,
  type ReferralInput,
  type ReferralStatus,
} from "@/lib/studio/fidelizacion/types";
import {
  validateReferralSettingsInput,
  type ReferralSettingsActionState,
  type ReferralSettingsInput,
} from "@/lib/studio/fidelizacion/referral-settings-types";
import {
  applicableInvoicesForReferrer,
  isPurchaseAfterCredit,
  CREDIT_APPLICABLE_INVOICE_STATUSES,
  type ApplicableInvoice,
} from "@/lib/studio/fidelizacion/referral-credit-queries";
import {
  postReferralCreditJournalEntry,
  revertReferralCreditsForInvoice,
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

/**
 * Los códigos de dominio de `apply_referral_credit` (migración 0471) en
 * castellano. La función revalida todo bajo el lock de la factura, así que un
 * rechazo suyo llega DESPUÉS de que las validaciones de la action pasaron: es
 * una carrera real (entró un pago, se anuló la factura, otro aplicó el crédito)
 * y el mensaje lo dice. Un código que no reconozcamos se muestra tal cual en vez
 * de esconderse.
 */
function applyReferralCreditError(message: string, amount: number): string {
  switch (message) {
    case "REFERRAL_CREDIT_FORBIDDEN":
      return "No tienes permiso para aplicar créditos: es una acción de contabilidad o administración.";
    case "REFERRAL_CREDIT_INPUT":
      return "Faltan datos para aplicar el crédito.";
    case "REFERRAL_CREDIT_NOT_FOUND":
      return "Crédito no encontrado.";
    case "REFERRAL_CREDIT_INVOICE_NOT_FOUND":
      return "Factura no encontrada.";
    case "REFERRAL_CREDIT_STATE":
      return "El crédito ya fue aplicado (o cambió de estado). Recarga la lista.";
    case "REFERRAL_CREDIT_AMOUNT":
      return "El crédito no tiene monto para aplicar.";
    case "REFERRAL_CREDIT_OTHER_CLIENT":
      return "La factura no es del cliente que refiere.";
    case "REFERRAL_CREDIT_INVOICE_STATE":
      return "La factura ya no admite crédito: cambió de estado mientras lo aplicabas (revisa si se anuló o se pagó).";
    case "REFERRAL_CREDIT_CURRENCY":
      return "En V1 el crédito solo se aplica a facturas en USD o USDT.";
    case "REFERRAL_CREDIT_OLD_INVOICE":
      return "El crédito solo se aplica a una compra NUEVA (posterior al crédito), no a facturas anteriores ni a deuda vieja.";
    case "REFERRAL_CREDIT_EXCEEDS_BALANCE":
      return `El saldo de la factura ya no alcanza para el crédito ($${amount.toFixed(2)}): entró un pago mientras lo aplicabas. Elige otra factura (V1 no parte el crédito).`;
    default:
      return `No se pudo aplicar el crédito: ${message}`;
  }
}

/**
 * SDD-0567 · El mensaje de una RPC de la 0494, en palabras de la persona. Solo
 * se muestran los mensajes propios (22023 o 42501 con hint 'dtd-referidos'): un
 * 42501 nativo («permission denied …») tiene el mismo código y no se muestra,
 * ni ningún otro error de la base (ERR-01).
 */
function errorDeReferido(
  error: { code?: string; message?: string; hint?: string },
  generico: string,
): string {
  if (error.hint === "dtd-referidos" && (error.code === "22023" || error.code === "42501") && error.message) {
    return error.message;
  }
  console.error("[referidos] rpc:", error.code, error.message);
  return generico;
}

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
 * Acredita a mano, SIN venta, el crédito al referidor (SDD-0567).
 * Lo normal es que lo acredite la primera venta del referido (disparador de
 * 0250). Esta acción es la excepción: solo el admin, con un motivo de 10 a 1000
 * caracteres, y la base guarda el motivo y quién (`acreditar_referido_con_motivo`,
 * migración 0494). El monto sale de la configuración (referral_settings, fallback
 * $80 · SDD-0159) y queda CONGELADO: el guardián de la 0494 no deja cambiarlo.
 */
export async function accreditReferral(id: string, motivo: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };
  const reason = motivo.trim();
  if (reason.length < 10 || reason.length > 1000) {
    return { error: "El motivo debe tener entre 10 y 1000 caracteres." };
  }

  const { error } = await supabase.rpc("acreditar_referido_con_motivo", {
    p_referral_id: id,
    p_motivo: reason,
  });
  if (error) return { error: errorDeReferido(error, "No se pudo acreditar el referido. Intenta de nuevo.") };
  revalidate();
  return { ok: true };
}

/**
 * Avanza a mano un referido (SDD-0567): invitado → registrado, con el markbox
 * del cliente referido, o registrado → primer embarque. Nunca acredita ni
 * retrocede: acreditar es de la venta (o de accreditReferral, con motivo). La
 * regla vive en la base (`avanzar_referido` y el guardián de la 0494).
 */
export async function updateReferralStatus(
  id: string,
  status: ReferralStatus,
  markbox?: string,
): Promise<Result> {
  if (status !== "registrado" && status !== "primer-embarque") {
    return { error: "Ese paso no se marca a mano." };
  }
  const cliente = markbox?.trim() ?? "";
  if (status === "registrado" && !cliente) {
    return { error: "Para marcarlo registrado, indica el markbox de un cliente activo." };
  }
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };

  const { error } = await supabase.rpc("avanzar_referido", {
    p_referral_id: id,
    p_estado: status,
    p_markbox: status === "registrado" ? cliente : null,
  });
  if (error) return { error: errorDeReferido(error, "No se pudo cambiar el estado. Intenta de nuevo.") };
  revalidate();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// SDD-0159 · Configurar referidos (montos editables desde el ERP)
//
// Upsert singleton por tenant en referral_settings. Gate del módulo Fidelización
// (no mueve plata: solo cambia el monto de FUTUROS créditos). Revalida el portal
// para que el cliente vea los montos nuevos.
// ─────────────────────────────────────────────────────────────

/** Parsea un campo numérico del form (vacío/no-numérico → undefined). */
function parseNum(v: FormDataEntryValue | null): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function saveReferralSettingsAction(
  _prev: ReferralSettingsActionState,
  formData: FormData,
): Promise<ReferralSettingsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "fidelizacion");
  if (denial) return { error: denial };

  const partial: Partial<ReferralSettingsInput> = {
    referrerRewardUsd: parseNum(formData.get("referrerRewardUsd")),
    referredRewardUsd: parseNum(formData.get("referredRewardUsd")),
  };
  const { input, fieldErrors } = validateReferralSettingsInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Sesión no válida." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // tenant_id y updated_by son server-controlled (no vienen del form); el `with
  // check` de la RLS además impide upsertear la fila de otro tenant.
  const { error } = await supabase.from("referral_settings").upsert(
    {
      tenant_id: tenantId,
      referrer_reward_usd: input!.referrerRewardUsd,
      referred_reward_usd: input!.referredRewardUsd,
      updated_by: userId,
    },
    { onConflict: "tenant_id" },
  );
  if (error) {
    return { error: `No se pudieron guardar los montos: ${error.message}` };
  }

  revalidate();
  // Los montos alimentan el front del cliente → refrescar su cache.
  revalidatePath("/portal/referidos");
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

  // 3) APLICACIÓN ATÓMICA (SDD-0496): el claim del crédito ('acreditado' →
  //    'aplicado' con su rastro) y el ABONO NO MONETARIO a la factura
  //    (paid_amount + status, Fix C) los escribe `apply_referral_credit`
  //    (migración 0471) en UNA transacción, con la factura tomada FOR UPDATE.
  //    Antes eran dos peticiones con guard optimista: entre el claim y el UPDATE
  //    final cabían una anulación o la muerte del proceso, y el crédito quedaba
  //    'aplicado' sobre una factura sin el abono. Cuando después se revertía,
  //    a la factura se le restaban $80 que nunca habían entrado (SDD-0490,
  //    «Riesgo residual»). La función revalida TODO bajo el lock —estado del
  //    crédito, cliente, estado y moneda de la factura, compra nueva y saldo—,
  //    así que las validaciones de arriba son para el mensaje, no la autoridad.
  const { data: applied, error: applyErr } = await supabase.rpc("apply_referral_credit", {
    p_referral_id: referralId,
    p_invoice_id: invoiceId,
  });
  if (applyErr) return { error: applyReferralCreditError(applyErr.message, amount) };
  const result = applied as {
    invoice_code?: string;
    amount?: number;
    applied_at?: string;
  } | null;

  // 4) Asiento contable (best-effort, admin client), FUERA de la transacción de
  //    dinero, como en la 0467. Si NO se pudo crear (falta la cuenta del plan,
  //    monto cero, etc.) se COMPENSA con la reversión atómica: el crédito vuelve
  //    a 'acreditado' y la factura recupera su saldo. Mover plata sin asiento es
  //    peor que no moverla (SDD-0137), y ahora deshacerlo es una sola operación.
  const posting = await postReferralCreditJournalEntry({
    tenantId,
    referralId,
    referralCode: ref.referral_code,
    referrerMarkbox: ref.referrer_markbox,
    invoiceId,
    invoiceCode: result?.invoice_code ?? inv.invoice_code,
    amountUsd: round2(Number(result?.amount) || amount),
  });
  if (!posting.ok) {
    const back = await revertReferralCreditsForInvoice(supabase, tenantId, invoiceId, referralId);
    return {
      error:
        `No se pudo generar el asiento del crédito: ${posting.error ?? posting.skipped ?? "desconocido"}.` +
        (back.reverted > 0
          ? " Se revirtió todo; no se aplicó nada."
          : ` Además, no se pudo deshacer la aplicación: ${back.error ?? "motivo desconocido"}. Revisa el crédito y el saldo de la factura.`),
    };
  }

  // 5) Linkear el asiento creado al crédito (rastro + idempotencia del posting).
  //    El asiento ya trae referral_id → la reversión lo barre aunque este link
  //    quede NULL por un crash acá (hueco B cerrado en la reversión + UNIQUE DB).
  //    SDD-0567: sin UPDATE directo de referrals, por la RPC que verifica que el
  //    asiento sea el de este crédito y esta factura.
  if (posting.entryId) {
    const { error: linkErr } = await supabase.rpc("vincular_asiento_del_credito", {
      p_referral_id: referralId,
      p_entry_id: posting.entryId,
    });
    if (linkErr) console.error("[referidos] enlace del asiento:", linkErr.code, linkErr.message);
  }

  revalidate();
  revalidatePath("/studio/facturacion");
  return { ok: true, entryCode: posting.entryCode };
}
