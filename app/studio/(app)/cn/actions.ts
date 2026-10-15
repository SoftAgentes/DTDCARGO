/**
 * Server actions del módulo Almacén CN (SDD-0016).
 *
 * - createReceiptAction: insert receipt (el receipt_code WR- o SIN-CODIGO- lo
 *   asigna la base al insertar, SDD-0491) + insert items + insert event
 *   'received' en una operación pseudo-atómica (rollback manual si falla items).
 * - changeReceiptStatusAction: update status + insert event 'status_change'.
 * - deleteReceiptsAction: borrado auditado por lote, sólo admin (SDD-0522, migr 0476).
 *
 * Validación con validateReceiptInput() — patrón del proyecto (sin zod).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { capabilityDenial, moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import {
  codigoResultadoRecepciones,
  normalizarLote,
  type ResultadoAccionRecepciones,
} from "@/lib/studio/borrado/reglas";
import { eliminarRecepciones } from "@/lib/studio/borrado/servidor";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import { autoInvoiceForReceipt } from "@/lib/studio/sales-orders/actions";
import {
  notaSinAviso,
  scheduleReceiptInWarehouse,
} from "@/lib/studio/notifications/schedule-fanout";
import {
  findOrCreateConsolidationShipment,
  ensureActiveAlert,
  revertAlertIfShipmentEmpty,
} from "@/lib/studio/expense-alerts-queries";
import {
  validateReceiptInput,
  type WarehouseReceiptActionState,
  type WarehouseReceiptInput,
  type WarehouseReceiptItemInput,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";

// ─────────────────────────────────────────────────────────────
// FormData parsing
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

/**
 * Items vienen serializados como JSON en un campo hidden `items_json`.
 * Mucho más simple que items[0][description], items[1][description]…
 * y permite que el client maneje el array internamente.
 */
function parseItemsJson(v: FormDataEntryValue | null): WarehouseReceiptItemInput[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => ({
      description: typeof it.description === "string" ? it.description : "",
      description_translated:
        typeof it.description_translated === "string"
          ? it.description_translated
          : null,
      hs_code: typeof it.hs_code === "string" ? it.hs_code : null,
      quantity:
        typeof it.quantity === "number" && Number.isFinite(it.quantity)
          ? it.quantity
          : null,
      unit_value_usd:
        typeof it.unit_value_usd === "number" && Number.isFinite(it.unit_value_usd)
          ? it.unit_value_usd
          : null,
      notes: typeof it.notes === "string" ? it.notes : null,
    }));
  } catch {
    return [];
  }
}

function inputFromFormData(
  formData: FormData,
): Partial<WarehouseReceiptInput> {
  return {
    warehouse_id: parseStringOrNull(formData.get("warehouse_id")) ?? undefined,
    client_markbox: parseStringOrNull(formData.get("client_markbox")),
    client_name: parseStringOrNull(formData.get("client_name")),
    is_orphan: parseBool(formData.get("is_orphan")),
    orphan_marks: parseStringOrNull(formData.get("orphan_marks")),
    orphan_brought_by: parseStringOrNull(formData.get("orphan_brought_by")),
    orphan_suspected_client: parseStringOrNull(
      formData.get("orphan_suspected_client"),
    ),
    supplier_name: parseStringOrNull(formData.get("supplier_name")),
    supplier_name_translated: parseStringOrNull(
      formData.get("supplier_name_translated"),
    ),
    boxes: (() => {
      const n = parseNumberOrNull(formData.get("boxes"));
      return n == null ? 0 : Math.round(n);
    })(),
    total_cbm: parseNumberOrNull(formData.get("total_cbm")),
    total_weight_kg: parseNumberOrNull(formData.get("total_weight_kg")),
    received_at:
      parseStringOrNull(formData.get("received_at")) ??
      new Date().toISOString().slice(0, 10),
    notes: parseStringOrNull(formData.get("notes")),
    items: parseItemsJson(formData.get("items_json")),
  };
}

// ─────────────────────────────────────────────────────────────
// createReceiptAction
// ─────────────────────────────────────────────────────────────

export async function createReceiptAction(
  _prev: WarehouseReceiptActionState,
  formData: FormData,
): Promise<WarehouseReceiptActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateReceiptInput(partial);
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };

  // Resolver tenant_id
  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  // Insertar receipt SIN receipt_code: lo asigna la base al insertar (SDD-0491,
  // trigger de la migración 0469): WR-YYYY-NNNN, o SIN-CODIGO-NNNN si es
  // huérfana, en la misma transacción del INSERT y con un lock por tenant, así
  // dos altas a la vez no reciben el mismo número. Antes se pedía aparte a
  // next_receipt_code, que desde la 0079 da la serie R- de los cobros, y la
  // huérfana a next_orphan_code, que el Studio no puede ejecutar desde la 0211.
  const { data: receipt, error: insertErr } = await supabase
    .from("warehouse_receipts_cn")
    .insert({
      tenant_id: link.tenant_id,
      warehouse_id: input!.warehouse_id,
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      is_orphan: input!.is_orphan,
      orphan_marks: input!.orphan_marks,
      orphan_brought_by: input!.orphan_brought_by,
      orphan_suspected_client: input!.orphan_suspected_client,
      supplier_name: input!.supplier_name,
      supplier_name_translated: input!.supplier_name_translated,
      boxes: input!.boxes,
      total_cbm: input!.total_cbm,
      total_weight_kg: input!.total_weight_kg,
      received_at: input!.received_at,
      notes: input!.notes,
      status: "pendiente_consolidacion",
    })
    .select("id, receipt_code")
    .single<{ id: string; receipt_code: string }>();

  if (insertErr || !receipt) {
    return {
      error: `No se pudo crear la recepción: ${insertErr?.message ?? "sin detalle"}`,
    };
  }
  const receipt_code = receipt.receipt_code;

  // Insertar items (rollback manual si falla)
  const itemsToInsert = input!.items.map((it, idx) => ({
    tenant_id: link.tenant_id,
    receipt_id: receipt.id,
    description: it.description,
    description_translated: it.description_translated,
    hs_code: it.hs_code,
    quantity: it.quantity,
    unit_value_usd: it.unit_value_usd,
    notes: it.notes,
    position: idx,
  }));

  const { error: itemsErr } = await supabase
    .from("warehouse_receipt_items")
    .insert(itemsToInsert);

  if (itemsErr) {
    // Rollback técnico (MP-01 P0): borrar la recepción recién creada y sin
    // items. Va por el cliente admin porque la 0476 (SDD-0522) le quitó el
    // DELETE físico a `authenticated`; acotado a ese id y a este tenant.
    const { error: rollbackErr } = await createAdminClient()
      .from("warehouse_receipts_cn")
      .delete()
      .eq("id", receipt.id)
      .eq("tenant_id", link.tenant_id);
    if (rollbackErr) {
      console.error("[createReceiptAction] rollback", rollbackErr.message);
    }
    return {
      error: `No se pudieron registrar los items: ${itemsErr.message}`,
    };
  }

  // Insertar event 'received' (best effort — no rollback si falla)
  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receipt.id,
    event_type: "received",
    description: `Recepción ${receipt_code} registrada${
      input!.supplier_name ? ` · supplier: ${input!.supplier_name}` : ""
    } · ${input!.items.length} item${input!.items.length === 1 ? "" : "s"}`,
  });

  // ── Wiring recepción → compra → OV · SDD-0072 Fase 2, revisado en SDD-0284 ──
  //
  // 🔴 Antes esto ataba las DOS cosas de una sola vez y con la regla FINANCIERA:
  // sólo vinculaba la compra si además tenía una orden de venta sin facturar.
  //
  // Medido en producción el 2026-08-24: **0 de 8 compras tienen orden de venta**,
  // así que esa condición no se cumplía nunca y **0 de 6 recepciones quedaron
  // atadas a su compra**. El efecto no era financiero —era operativo—: sin ese
  // vínculo, `/portal/compras/[code]` (SDD-0307) le dice "todavía no registramos
  // la llegada" al cliente cuya mercancía SÍ está en la bodega, y el aviso de
  // SDD-0283 se queda sin dónde colgar.
  //
  // Ahora son dos decisiones separadas, porque responden preguntas distintas:
  //
  //   · `prealerta_id`  → OPERATIVO: "¿de qué compra es esta mercancía?".
  //     Regla: UNA sola compra abierta del cliente. Sigue sin adivinarse con
  //     dos candidatas, pero ya no exige orden de venta.
  //   · `sales_order_id` → FINANCIERO: "¿qué OV cumple?". Regla intacta.
  //
  // **Aflojar el operativo no puede facturar de más**, y no es una opinión: el
  // RPC `sales_order_claim_and_invoice` (migr 0128) devuelve `no_sales_order`
  // cuando la compra no resuelve una OV, y `autoInvoiceForReceipt` lo traduce a
  // `notApplicable` sin emitir nada. La caja sin OV se ata para que el cliente
  // vea su llegada, y el motor financiero la ignora.
  if (!input!.is_orphan && input!.client_markbox) {
    try {
      const { data: cands } = await supabase
        .from("prealertas")
        .select("id, sales_order_id, invoice_id")
        .eq("tenant_id", link.tenant_id)
        .eq("client_markbox", input!.client_markbox)
        .in("status", ["anunciada", "en_camino"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2);
      const list =
        (cands as
          | { id: string; sales_order_id: string | null; invoice_id: string | null }[]
          | null) ?? [];

      // Con dos o más candidatas no se elige: atar la caja equivocada le
      // mostraría al cliente que llegó algo que no llegó (y, si esa compra
      // tuviera OV, facturaría la equivocada).
      if (list.length === 1) {
        const compra = list[0];
        const patch: { prealerta_id: string; sales_order_id?: string } = {
          prealerta_id: compra.id,
        };
        // El vínculo financiero conserva su regla estricta: OV atada y todavía
        // sin facturar.
        if (compra.sales_order_id && !compra.invoice_id) {
          patch.sales_order_id = compra.sales_order_id;
        }
        await supabase
          .from("warehouse_receipts_cn")
          .update(patch)
          .eq("id", receipt.id)
          .eq("tenant_id", link.tenant_id);
      }
    } catch {
      // best-effort: si el match falla, la recepción queda sin caja atada (no
      // auto-factura). NO rompe la creación de la recepción.
    }
  }

  // ── SDD-0282/0283 · avisarle al cliente que su carga llegó a Yiwu ──
  //
  // 🔴 Esta recepción NO avisaba a nadie. El aviso existía sólo en el camino del
  // operario (`/m/cn/recibir`, SDD-0162): la mercancía que la OFICINA registraba
  // a mano —la huérfana que aparece sin etiqueta, la que se carga en lote, la de
  // un cliente que no pre-declaró— llegaba a Yiwu en silencio absoluto.
  //
  // Va DESPUÉS del wiring de arriba a propósito: si ese paso ató una compra, el
  // aviso cuelga de ESA y no hay nada que adivinar.
  //
  // Best-effort y con `await` (no fire-and-forget como en el móvil): acá la
  // action ya terminó de escribir y el operador de oficina puede esperar los
  // milisegundos; a cambio, si el cliente se queda sin aviso, la nota entra en
  // la bitácora ANTES de que la pantalla se refresque y el operador la ve.
  //
  // Una recepción huérfana no notifica a nadie a propósito: todavía no se sabe
  // de quién es, y adivinar sería avisarle al cliente equivocado.
  if (!input!.is_orphan && input!.client_markbox) {
    try {
      const notifAdmin = createAdminClient();
      const compra = await compraParaElAviso(
        supabase,
        link.tenant_id,
        receipt.id,
        input!.client_markbox,
      );
      const fanout = await scheduleReceiptInWarehouse(notifAdmin, link.tenant_id, [
        {
          markbox: input!.client_markbox,
          prealertaId: compra?.id ?? null,
          prealertaCode: compra?.code ?? null,
        },
      ]);
      const nota = notaSinAviso(fanout.sinDestino);
      if (nota) {
        await notifAdmin.from("warehouse_receipt_events").insert({
          tenant_id: link.tenant_id,
          receipt_id: receipt.id,
          event_type: "note",
          description: nota,
        });
      }
    } catch (err) {
      // Un fallo del aviso NO invalida una recepción ya escrita.
      console.error("[cn] aviso de recepción falló:", err);
    }
  }

  revalidatePath("/studio/cn");
  return { ok: true, createdReceiptCode: receipt_code };
}


/**
 * SDD-0283 · La compra de la que va a colgar el aviso de recepción.
 *
 * Dos pasos, en orden de confianza:
 *
 *   1. Si el wiring financiero ya ató una compra a esta recepción, ésa es —
 *      viene de una regla conservadora y no hay nada que adivinar.
 *   2. Si no, se busca UNA compra abierta del cliente. **Exactamente una**: con
 *      dos o más no se elige, porque el aviso llevaría al cliente al detalle de
 *      la compra equivocada y le diría que llegó algo que todavía no llegó.
 *
 * Sin candidata inequívoca devuelve null y el aviso queda sin ancla → la nota de
 * la bitácora lo dice. Mejor que el operador escriba a mano a que el sistema
 * mande al cliente a la pantalla de otra compra.
 *
 * Best-effort: cualquier fallo devuelve null, nunca throwea.
 */
async function compraParaElAviso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  receiptId: string,
  markbox: string,
): Promise<{ id: string; code: string } | null> {
  try {
    const { data: rec } = await supabase
      .from("warehouse_receipts_cn")
      .select("prealerta_id")
      .eq("id", receiptId)
      .maybeSingle<{ prealerta_id: string | null }>();

    if (rec?.prealerta_id) {
      const { data: pre } = await supabase
        .from("prealertas")
        .select("id, code")
        .eq("id", rec.prealerta_id)
        .maybeSingle<{ id: string; code: string }>();
      if (pre) return pre;
    }

    const { data: abiertas } = await supabase
      .from("prealertas")
      .select("id, code")
      .eq("tenant_id", tenantId)
      .eq("client_markbox", markbox)
      .in("status", ["anunciada", "en_camino", "recibida"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(2);

    const lista = (abiertas as { id: string; code: string }[] | null) ?? [];
    return lista.length === 1 ? lista[0] : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// changeReceiptStatusAction
// ─────────────────────────────────────────────────────────────

const VALID_NEW_STATUSES: WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "consolidado",
  "incidencia",
];

export async function changeReceiptStatusAction(
  receiptId: string,
  newStatus: WarehouseReceiptStatus,
  options?: {
    note?: string;
    /**
     * Ciudad destino. REQUIRED si newStatus = 'consolidado' (Opción A SDD-0029 ·
     * migración 0044 agregó la columna). Ignorado para otros status.
     * Validar contra dispatch_city_catalog del tenant lo hace el caller (UI).
     */
    destinationCity?: string;
  },
): Promise<{
  ok?: boolean;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
}> {
  if (!VALID_NEW_STATUSES.includes(newStatus)) {
    return { errorCode: "invalid_input" };
  }

  const destinationCity = options?.destinationCity?.trim();
  const note = options?.note?.trim();

  // Consolidar requiere city. Para volver a pendiente_consolidacion o incidencia,
  // no se toca la city (puede quedar de un consolidado previo).
  if (newStatus === "consolidado" && !destinationCity) {
    return { errorCode: "cn_destination_required" };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  // Resolver tenant_id (necesario para el event)
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  // Leer current status para no insertar event redundante
  const { data: current, error: readErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("status, receipt_code, destination_city, shipment_id")
    .eq("id", receiptId)
    .maybeSingle<{
      status: WarehouseReceiptStatus;
      receipt_code: string;
      destination_city: string | null;
      shipment_id: string | null;
    }>();

  if (readErr || !current) {
    return { errorCode: "cn_receipt_not_found" };
  }

  if (
    current.status === newStatus &&
    (newStatus !== "consolidado" || current.destination_city === destinationCity)
  ) {
    return { ok: true }; // no-op
  }

  // Modelo A (SDD-0039): al consolidar, find-or-create el contenedor
  // (shipment service=consolidado_lcl, status=consolidating) agrupado por
  // destino y colgamos la recepción + la alerta de gastos de ahí. Es un
  // side-effect de sistema → admin client (el warehouse+cn no inserta
  // shipments por RLS). Best-effort: la consolidación NO debe fallar si
  // el contenedor/alerta falla.
  const wasConsolidated = current.status === "consolidado";
  const isConsolidating = newStatus === "consolidado";
  const isReverting = wasConsolidated && !isConsolidating;
  const admin = isConsolidating || isReverting ? createAdminClient() : null;

  let containerShipmentId: string | null = null;
  let containerCode: string | null = null;
  if (isConsolidating && destinationCity && admin) {
    const res = await findOrCreateConsolidationShipment(admin, {
      tenantId: link.tenant_id,
      destination: destinationCity,
    });
    if ("shipmentId" in res) {
      containerShipmentId = res.shipmentId;
      containerCode = res.code;
    } else {
      console.error("[cn] contenedor consolidación:", res.error);
    }
  }

  // Update: persiste destination_city + shipment_id al consolidar; limpia
  // shipment_id al revertir (la recepción sale del contenedor).
  const patch: {
    status: WarehouseReceiptStatus;
    destination_city?: string;
    shipment_id?: string | null;
  } = { status: newStatus };
  if (isConsolidating && destinationCity) {
    patch.destination_city = destinationCity;
    if (containerShipmentId) patch.shipment_id = containerShipmentId;
  }
  if (isReverting) patch.shipment_id = null;

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update(patch)
    .eq("id", receiptId);

  if (updateErr) {
    return { error: `No se pudo cambiar el estado: ${updateErr.message}` };
  }

  // Side-effects de alerta CN (best-effort).
  if (isConsolidating && containerShipmentId && admin) {
    const ensured = await ensureActiveAlert(admin, {
      tenantId: link.tenant_id,
      shipmentId: containerShipmentId,
    });
    if (ensured.created) {
      // Notificar al equipo CN · solo si el tenant tiene regla activa.
      // SIN nombre real del cliente (privacidad CN) → solo código contenedor.
      await fireMailEvent(admin, link.tenant_id, {
        event: "shipment_consolidated_cn",
        vars: {
          shipment_code: containerCode ?? "",
          destination: destinationCity ?? "—",
        },
        sourceRef: { kind: "shipment", id: containerShipmentId },
      });
    }
  } else if (isReverting && current.shipment_id && admin) {
    await revertAlertIfShipmentEmpty(admin, current.shipment_id);
  }

  // ── SDD-0072 Fase 2 · auto-Factura en la confirmación de Warehouse ──
  // Consolidar = "Warehouse confirma con datos reales". Si la recepción resuelve
  // una Orden de venta (vía su prealerta) y cumple los requisitos (§3.5), genera
  // la Factura (0021) parcial por defecto. BEST-EFFORT: try/catch — si falla o
  // faltan datos, la consolidación se completó igual (NO se bloquea). El "faltan
  // datos" / "facturada" queda como evento en el timeline de la recepción para que
  // sea visible. La idempotencia la garantiza el guard de prealertas.invoice_id.
  if (isConsolidating) {
    try {
      const invAdmin = admin ?? createAdminClient();
      const inv = await autoInvoiceForReceipt({
        admin: invAdmin,
        tenantId: link.tenant_id,
        receiptId,
      });
      if (inv.ok) {
        await invAdmin.from("warehouse_receipt_events").insert({
          tenant_id: link.tenant_id,
          receipt_id: receiptId,
          event_type: "note",
          description: `Factura ${inv.invoiceCode} generada automáticamente · $${inv.amountUsd.toFixed(2)} (SDD-0072 Fase 2).`,
        });
        revalidatePath("/studio/facturacion");
        revalidatePath("/studio/ordenes-venta");
      } else if (!inv.notApplicable) {
        // Solo dejamos rastro cuando hay una OV pero faltan datos (no para el caso
        // "no aplica" = recepción sin OV, que es el flujo normal de la mayoría).
        await invAdmin.from("warehouse_receipt_events").insert({
          tenant_id: link.tenant_id,
          receipt_id: receiptId,
          event_type: "note",
          description: `No se facturó automáticamente: ${inv.reason}`,
        });
      }
    } catch (e) {
      // NUNCA bloquea la consolidación.
      console.error("[cn auto-invoice] hook falló (no bloquea):", e);
    }
  }

  // Insertar event 'status_change' (o 'consolidated' / 'incident' según el destino)
  const eventType =
    newStatus === "consolidado"
      ? "consolidated"
      : newStatus === "incidencia"
        ? "incident"
        : "status_change";

  let description =
    note ||
    `Estado: ${current.status} → ${newStatus} · ${current.receipt_code}`;
  if (newStatus === "consolidado" && destinationCity) {
    description += ` · destino: ${destinationCity}`;
  }

  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: eventType,
    description,
  });

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  revalidatePath("/studio/gastos");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// changeReceiptPaymentStatusAction (Opción A · SDD-0029)
//
// Admin marca pago del paquete · alimenta scoring de Despacho.
// Permitido en cualquier status (paquete pendiente, consolidado, etc).
// ─────────────────────────────────────────────────────────────

const VALID_PAYMENT_STATUSES = ["pagado", "parcial", "pendiente"] as const;
type PaymentStatusOpt = (typeof VALID_PAYMENT_STATUSES)[number];

export async function changeReceiptPaymentStatusAction(
  receiptId: string,
  newPaymentStatus: PaymentStatusOpt,
): Promise<{
  ok?: boolean;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
}> {
  if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
    return { errorCode: "cn_invalid_payment_status" };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  const { data: current, error: readErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("payment_status, receipt_code")
    .eq("id", receiptId)
    .maybeSingle<{ payment_status: PaymentStatusOpt; receipt_code: string }>();

  if (readErr || !current) {
    return { errorCode: "cn_receipt_not_found" };
  }

  if (current.payment_status === newPaymentStatus) {
    return { ok: true }; // no-op
  }

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ payment_status: newPaymentStatus })
    .eq("id", receiptId);

  if (updateErr) {
    return { error: `No se pudo cambiar el pago: ${updateErr.message}` };
  }

  // Audit event
  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: "status_change",
    description: `Pago: ${current.payment_status} → ${newPaymentStatus} · ${current.receipt_code}`,
  });

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true };
}

/**
 * Marca / desmarca una recepción como VERIFICADA para auto-facturar (SDD-0072 Fase 3).
 *
 * Flag HUMANO explícito (decisión founder 2026-06-13): la auto-factura de la OV
 * (gate canAutoInvoice) exige esta confirmación además de CBM/peso/packing/adjuntos.
 * Setea invoice_verified_at + invoice_verified_by (o los limpia al desmarcar) + audita.
 */
export async function markReceiptVerifiedAction(
  receiptId: string,
  verified: boolean,
): Promise<{
  ok?: boolean;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
}> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current, error: readErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("invoice_verified_at, receipt_code")
    .eq("id", receiptId)
    .maybeSingle<{ invoice_verified_at: string | null; receipt_code: string }>();
  if (readErr || !current) {
    return { errorCode: "cn_receipt_not_found" };
  }

  if ((current.invoice_verified_at != null) === verified) {
    return { ok: true }; // no-op (ya está en el estado pedido)
  }

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update(
      verified
        ? {
            invoice_verified_at: new Date().toISOString(),
            invoice_verified_by: user?.id ?? null,
          }
        : { invoice_verified_at: null, invoice_verified_by: null },
    )
    .eq("id", receiptId);
  if (updateErr) {
    return { error: `No se pudo actualizar la verificación: ${updateErr.message}` };
  }

  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: "status_change",
    description: verified
      ? `Verificada para facturar · ${current.receipt_code}`
      : `Verificación removida · ${current.receipt_code}`,
  });

  revalidatePath("/studio/cn");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Bulk actions · marcar N recibos en una sola operación
//
// MVP intencionalmente NO incluye bulk-consolidar (cada destino_city
// puede diferir por row · forzaría UI multi-step). Sí cubre pago bulk
// y status bulk excluyendo "consolidado" (pendiente / incidencia OK).
// ─────────────────────────────────────────────────────────────

const MAX_BULK_RECEIPTS = 100;

export async function bulkChangeReceiptPaymentStatusAction(
  receiptIds: string[],
  newPaymentStatus: PaymentStatusOpt,
): Promise<{
  ok?: boolean;
  updated?: number;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
}> {
  if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
    return { errorCode: "invalid_input" };
  }
  if (receiptIds.length > MAX_BULK_RECEIPTS) {
    return { errorCode: "cn_bulk_max_exceeded" };
  }
  if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
    return { errorCode: "cn_invalid_payment_status" };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  // Update atómico · RLS filtra por tenant
  const { data: updated, error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ payment_status: newPaymentStatus })
    .in("id", receiptIds)
    .select("id");

  if (updateErr) {
    return { error: `No se pudo cambiar el pago: ${updateErr.message}` };
  }

  const updatedCount = updated?.length ?? 0;

  // Audit event 1 por receipt (best effort · no falla la operación)
  if (updatedCount > 0) {
    const events = (updated ?? []).map((r) => ({
      tenant_id: link.tenant_id,
      receipt_id: r.id,
      event_type: "status_change" as const,
      description: `Pago bulk → ${newPaymentStatus} (${updatedCount} recepciones)`,
    }));
    await supabase.from("warehouse_receipt_events").insert(events);
  }

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true, updated: updatedCount };
}

const BULK_VALID_STATUSES: WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "incidencia",
];

export async function bulkChangeReceiptStatusAction(
  receiptIds: string[],
  newStatus: (typeof BULK_VALID_STATUSES)[number],
): Promise<{
  ok?: boolean;
  updated?: number;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
}> {
  if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
    return { errorCode: "invalid_input" };
  }
  if (receiptIds.length > MAX_BULK_RECEIPTS) {
    return { errorCode: "cn_bulk_max_exceeded" };
  }
  if (!BULK_VALID_STATUSES.includes(newStatus)) {
    return { errorCode: "invalid_input" };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { errorCode: "tenant_unresolved" };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ status: newStatus })
    .in("id", receiptIds)
    .select("id");

  if (updateErr) {
    return { error: `No se pudo cambiar el estado: ${updateErr.message}` };
  }

  const updatedCount = updated?.length ?? 0;
  if (updatedCount > 0) {
    const eventType = newStatus === "incidencia" ? "incident" : "status_change";
    const events = (updated ?? []).map((r) => ({
      tenant_id: link.tenant_id,
      receipt_id: r.id,
      event_type: eventType,
      description: `Estado bulk → ${newStatus} (${updatedCount} recepciones)`,
    }));
    await supabase.from("warehouse_receipt_events").insert(events);
  }

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true, updated: updatedCount };
}

// ─────────────────────────────────────────────────────────────
// deleteReceiptsAction · borrado auditado por lote (SDD-0522)
//
// Reemplaza a `softDeleteReceiptAction`, que ponía `deleted_at` con un UPDATE
// por RLS, sin motivo, sin evento y sin mirar dependencias (y nunca tuvo UI).
// Desde la 0476 ese UPDATE directo lo rechaza la base: se borra sólo por
// `soft_delete_warehouse_receipts_cn_with_audit_reason`, de admin, con motivo,
// todo o nada, retirando las cajas y con el evento warehouse_receipt_cn_deleted.
// ─────────────────────────────────────────────────────────────

export async function deleteReceiptsAction(
  receiptIds: string[],
  reason: string,
): Promise<ResultadoAccionRecepciones> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "delete_warehouse_receipts");
  if (denial) return { error: denial, errorCode: "permission_denied" };

  const lote = normalizarLote(receiptIds);
  if (!lote.ok) {
    return { errorCode: lote.motivo === "maximo" ? "cn_bulk_max_exceeded" : "invalid_input" };
  }

  const motivo = validateAuditReason(reason);
  if (!motivo.ok) {
    return {
      errorCode: String(reason ?? "").trim().length < 4 ? "cn_delete_reason_short" : "cn_delete_reason_long",
    };
  }

  const resultado = await eliminarRecepciones(supabase, lote.ids, motivo.reason);
  if (resultado.estado === "eliminado" || (resultado.estado === "error" && resultado.tipo === "sin_confirmar")) {
    revalidatePath("/studio/cn");
    revalidatePath("/studio/despacho");
  }
  return codigoResultadoRecepciones(resultado);
}
