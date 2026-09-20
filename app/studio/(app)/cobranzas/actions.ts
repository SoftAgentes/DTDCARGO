/**
 * Server actions del módulo Cobranzas (SDD-0041 + SDD-0068).
 *
 * - registerCollection: registra un cobro sobre una factura (delega en la
 *   lógica compartida `registerCollectionFor`: recibo + saldo + asiento +
 *   pagador + fund_class).
 * - registerUnidentifiedPayment: pago SIN referencia (cláusula 7.3) → recibo
 *   sin factura + asiento a la cuenta puente "Fondos por identificar".
 * - identifyPayment: identificación RETROACTIVA de un sin-ref contra una
 *   factura (conserva received_at + reclasifica, decisión #6).
 * - logActivity: registra una gestión de cobranza (contacto/promesa/nota/
 *   recordatorio).
 * - voidReceipt: anula un recibo (revierte saldo + anula sus asientos).
 * - getReceivableHistory: lee recibos + gestiones de una factura (gate de VISTA).
 *
 * Sin Zod: validación con `validate*Input()` propio. Las acciones sensibles
 * (cobro, anular recibo) escriben en entity_audit_log via la lógica compartida
 * (entity_type 'payment_receipt', habilitado en la migración 0079).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import { receivablesQueue } from "@/lib/studio/payment-queries";
import { contextoDeEnvio } from "@/lib/studio/collections/recordatorios-queries";
import {
  intersectarPedido,
  MOTIVO_LABEL,
  resumirSeleccion,
  seleccionarParaRecordatorio,
} from "@/lib/studio/collections/recordatorios";
import {
  identifyPaymentFor,
  registerCollectionFor,
  registerUnidentifiedPaymentFor,
  voidReceiptFor,
} from "@/lib/studio/collections-actions";
import {
  validateActivityInput,
  type ActivityInput,
  type PaymentInput,
  type UnidentifiedPaymentInput,
} from "@/lib/studio/payment-types";

/**
 * Registra un cobro desde el módulo Cobranzas. Mismo camino que el detalle de
 * factura (SDD-0021). Devuelve receiptCode + fullyPaid para la traza.
 */
export async function registerCollection(
  invoiceId: string,
  payload: Partial<PaymentInput>,
): Promise<{
  ok?: boolean;
  error?: string;
  receiptCode?: string;
  fullyPaid?: boolean;
}> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };
  const result = await registerCollectionFor(supabase, invoiceId, payload);

  if (!result.ok) {
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return {
      error: result.error ?? firstFieldError ?? "No se pudo registrar el cobro.",
    };
  }

  revalidatePath("/studio/cobranzas");
  revalidatePath("/studio/facturacion");
  return { ok: true, receiptCode: result.receiptCode, fullyPaid: result.fullyPaid };
}

/**
 * Registra un pago que llegó SIN referencia (SDD-0068 #2 · cláusula 7.3):
 * recibo sin factura, snapshots de cliente NULL, asiento a la cuenta puente.
 * Devuelve el primer fieldError aplanado (el drawer valida client-side).
 */
export async function registerUnidentifiedPayment(
  payload: Partial<UnidentifiedPaymentInput>,
): Promise<{ ok?: boolean; error?: string; receiptCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };
  const result = await registerUnidentifiedPaymentFor(supabase, payload);

  if (!result.ok) {
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return {
      error:
        result.error ?? firstFieldError ?? "No se pudo registrar el pago.",
    };
  }

  revalidatePath("/studio/cobranzas");
  return { ok: true, receiptCode: result.receiptCode };
}

/**
 * Identifica un pago sin referencia contra una factura (SDD-0068 #3 ·
 * decisión #6): conserva `received_at` original (imputación retroactiva),
 * aplica el saldo y reclasifica el asiento.
 */
export async function identifyPayment(
  receiptId: string,
  invoiceId: string,
): Promise<{
  ok?: boolean;
  error?: string;
  receiptCode?: string;
  invoiceCode?: string;
  fullyPaid?: boolean;
}> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };
  const result = await identifyPaymentFor(supabase, receiptId, invoiceId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/studio/cobranzas");
  revalidatePath("/studio/facturacion");
  return {
    ok: true,
    receiptCode: result.receiptCode,
    invoiceCode: result.invoiceCode,
    fullyPaid: result.fullyPaid,
  };
}

/**
 * Registra una gestión de cobranza (log liviano). El stage de la cola se
 * deriva de estas gestiones + saldo/vencimiento, no se persiste como estado.
 */
export async function logActivity(
  invoiceId: string,
  raw: Partial<ActivityInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateActivityInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de gestión inválidos." };
  }

  // Resolver tenant del usuario logueado (RLS) + validar que la factura existe.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .maybeSingle<{ id: string }>();
  if (!inv) return { error: "Factura no encontrada." };

  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase.from("collection_activities").insert({
    tenant_id: link.tenant_id,
    invoice_id: invoiceId,
    kind: input!.kind,
    promised_amount: input!.promisedAmount,
    promised_date: input!.promisedDate,
    next_followup: input!.nextFollowup,
    body: input!.body,
    created_by: user.user?.id ?? null,
  });
  if (error) return { error: `No se pudo registrar la gestión: ${error.message}` };

  revalidatePath("/studio/cobranzas");
  return { ok: true };
}

/** Anula un recibo: revierte saldo de la factura + anula su asiento. */
export async function voidReceipt(
  receiptId: string,
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };
  const r = await voidReceiptFor(supabase, receiptId, reason);
  if (!r.ok) return { error: r.error };

  revalidatePath("/studio/cobranzas");
  revalidatePath("/studio/facturacion");
  return { ok: true };
}

/**
 * Lee los recibos + gestiones de una factura (para el historial del drawer).
 * Devuelve datos serializables (el drawer es client).
 *
 * Gate de VISTA (SDD-0497): gemelo exacto del `getBillHistory` de Tesorería que
 * cerró SDD-0494. Era la única de las ocho acciones de este archivo sin gate,
 * mientras las otras siete llaman `moduleEditDenial(supabase, "collections")`.
 * El `requireModuleView("collections")` del layout protege la PÁGINA, no esta
 * action —endpoint invocable directo, SDD-0085 §Seguridad—, y la RLS no compensa:
 * `payment_receipts_team_select` (0470:186-191) y `"collection_activities by
 * tenant"` (0079:151-155) sólo comparan `tenant_id`, sin predicado de rol. Sin
 * este candado, cualquier miembro del tenant leía monto, fecha, método y banco
 * de los cobros de un módulo de DINERO que la matriz reserva a `accounting`.
 *
 * Es el de VISTA, no el de edición: no muta nada, pero expone dinero.
 */
export async function getReceivableHistory(invoiceId: string): Promise<{
  receipts: import("@/lib/studio/payment-types").PaymentReceipt[];
  activities: import("@/lib/studio/payment-types").CollectionActivity[];
  error?: string;
}> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "collections");
  if (denial) return { receipts: [], activities: [], error: denial };
  const { listReceipts, listActivities } = await import(
    "@/lib/studio/payment-queries"
  );
  const [receipts, activities] = await Promise.all([
    listReceipts(supabase, { invoiceId }),
    listActivities(supabase, invoiceId),
  ]);
  return { receipts, activities };
}

// ─────────────────────────────────────────────────────────────
// SDD-0306 · Recordatorio de cobranza
//
// 🔴 DOS acciones, no una, y la separación ES la seguridad:
//
//   · `previewRecordatorios()` NO manda nada. Devuelve a quién se le
//     escribiría y —lo más importante— a quién no y por qué.
//   · `enviarRecordatorios(codes)` manda, y exige la lista explícita.
//
// Nunca hay un botón que mande «a los vencidos» sin que una persona haya visto
// antes la lista. Un recordatorio de cobranza incomoda a un cliente que paga.
// ─────────────────────────────────────────────────────────────

export type PreviewRecordatorios = {
  error?: string;
  resumen?: string;
  aEnviar?: {
    code: string;
    markbox: string;
    clientName: string;
    balance: number;
    currency: string;
    daysOverdue: number | null;
  }[];
  omitidos?: { code: string; markbox: string; motivo: string }[];
};

/** Qué pasaría si se mandaran los recordatorios hoy. No manda nada. */
export async function previewRecordatorios(): Promise<PreviewRecordatorios> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };

  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const cola = await receivablesQueue(supabase, hoy);
    const ctx = await contextoDeEnvio(supabase, cola);
    const sel = seleccionarParaRecordatorio(cola, hoy, ctx);

    return {
      resumen: resumirSeleccion(sel),
      aEnviar: sel.aEnviar.map((r) => ({
        code: r.invoice.invoice_code,
        markbox: r.invoice.client_markbox,
        clientName: r.invoice.client_name,
        balance: r.balance,
        currency: r.invoice.currency,
        daysOverdue: r.daysOverdue,
      })),
      omitidos: sel.omitidos.map((o) => ({
        code: o.code,
        markbox: o.markbox,
        motivo: MOTIVO_LABEL[o.motivo],
      })),
    };
  } catch (e) {
    console.error("[previewRecordatorios]", e);
    return { error: "No se pudo calcular la lista de recordatorios." };
  }
}

/**
 * Manda el recordatorio de las facturas indicadas.
 *
 * 🔴 **La selección se vuelve a calcular en el servidor y se INTERSECTA con lo
 * que pidió el cliente.** La lista que llega sólo puede ACOTAR, nunca ampliar:
 * si viniera un código que hoy no corresponde —porque ya pagó, porque prometió
 * pagar, porque marcó spam— se descarta acá aunque el navegador lo mande.
 * Confiar en la lista del cliente sería un vector para escribirle a cualquiera.
 *
 * Como en SDD-0305, `fireMailEvent` no envía si el tenant no tiene una regla
 * activa para `invoice_overdue`: mientras no se configure en Studio › Mailing,
 * esto no saca ningún correo.
 */
export async function enviarRecordatorios(
  codes: string[],
): Promise<{ ok?: boolean; error?: string; enviados?: number; descartados?: number }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "collections");
  if (denial) return { error: denial };

  const pedidos = new Set((codes ?? []).filter((c) => typeof c === "string"));
  if (pedidos.size === 0) return { error: "No se indicó ninguna factura." };

  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const cola = await receivablesQueue(supabase, hoy);
    const ctx = await contextoDeEnvio(supabase, cola);
    const { aEnviar } = seleccionarParaRecordatorio(cola, hoy, ctx);

    const permitidos = intersectarPedido(aEnviar, [...pedidos]);
    const descartados = pedidos.size - permitidos.length;

    const admin = createAdminClient();
    let enviados = 0;
    for (const r of permitidos) {
      try {
        await fireMailEvent(admin, r.invoice.tenant_id, {
          event: "invoice_overdue",
          vars: {
            customer_name: r.invoice.client_name || "cliente",
            invoice_code: r.invoice.invoice_code,
            markbox: r.invoice.client_markbox,
            due_date: (r.invoice.due_date ?? "").slice(0, 10) || "—",
            days_overdue: String(r.daysOverdue ?? 0),
            total_usd: Number(r.balance).toFixed(2),
          },
          clientMarkbox: r.invoice.client_markbox,
          clientName: r.invoice.client_name,
          sourceRef: { kind: "invoice", id: r.invoice.id },
        });
        enviados += 1;
      } catch (e) {
        console.error(`[enviarRecordatorios] ${r.invoice.invoice_code}`, e);
      }
    }

    revalidatePath("/studio/cobranzas");
    return { ok: true, enviados, descartados };
  } catch (e) {
    console.error("[enviarRecordatorios]", e);
    return { error: "No se pudieron enviar los recordatorios." };
  }
}
