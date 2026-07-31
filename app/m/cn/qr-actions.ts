"use server";

/**
 * Server action de impresión QR desde el operario CN (Sprint 1.5 v3).
 *
 * Conecta el botón "Imprimir QR" del detail modal con el RPC
 * `push_qr_order_as_operario` (SDD-0028 · ya existía). Encola una orden
 * en qr_print_orders que el admin consume desde /studio/cola-qr y manda
 * a la impresora del hub.
 *
 * Lee los datos (markbox, cliente, bultos) de la recepción · el operario
 * solo elige imprimir, no re-tipea nada.
 */

import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";

export type QrPrintResult =
  | { ok: true; orderCode: string }
  | { ok: false; error: string };

export async function pushQrPrintForReceiptAction(
  receiptId: string,
): Promise<QrPrintResult> {
  const operario = await getCurrentOperario();
  if (!operario) return { ok: false, error: "Sesión expirada." };
  if (operario.region !== "cn") {
    return { ok: false, error: "Solo operarios CN pueden imprimir QR." };
  }

  const admin = createAdminClient();

  // Leer la recepción para sacar markbox + cliente + bultos
  const { data: r, error: rErr } = await admin
    .from("warehouse_receipts_cn")
    // PRIVACIDAD (hallazgo H-7): sin `client_name`. La etiqueta QR se imprime y
    // se pega a la caja EN EL ALMACÉN DE YIWU — poner ahí el nombre del
    // importador es la fuga más difícil de recoger, porque queda en papel.
    .select("id, warehouse_id, client_markbox, supplier_name, boxes, is_orphan")
    .eq("id", receiptId)
    .eq("tenant_id", operario.tenant_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      warehouse_id: string | null;
      client_markbox: string | null;
      supplier_name: string | null;
      boxes: number;
      is_orphan: boolean;
    }>();

  if (rErr || !r) return { ok: false, error: "Recepción no encontrada." };

  // Las huérfanas no tienen MARKBOX · no se pueden etiquetar con QR de cliente
  const markbox = r.client_markbox?.trim();
  if (r.is_orphan || !markbox) {
    return {
      ok: false,
      error: "Caja huérfana sin Shipping Mark · asigna cliente antes de imprimir QR.",
    };
  }
  if (!r.boxes || r.boxes <= 0) {
    return { ok: false, error: "La recepción no tiene cajas." };
  }

  const { data, error } = await admin.rpc("push_qr_order_as_operario", {
    p_operario_id: operario.operario_id,
    p_warehouse_id: r.warehouse_id,
    p_markbox: markbox,
    // La etiqueta lleva el Shipping Mark, que es lo que identifica la carga.
    p_client_name: markbox,
    p_supplier_name: r.supplier_name,
    p_bultos: r.boxes,
    p_priority: "normal",
    p_notes: null,
  });

  if (error) return { ok: false, error: humanizeQrError(error.message) };

  const row = Array.isArray(data) ? data[0] : null;
  const orderCode = (row as { order_code?: string } | null)?.order_code ?? "";
  const orderId = (row as { id?: string } | null)?.id;

  // SDD-0152 · dejar el rastro a la recepción para que la impresión pueda
  // resolver las cajas y poner su código único en cada etiqueta. Va como UPDATE
  // aparte en vez de un param nuevo del RPC: cambiarle la firma a
  // push_qr_order_as_operario crearía una sobrecarga ambigua en Postgres.
  // Si esto falla, la orden igual existe y la impresión cae al modo legacy
  // (rotula sin código) — no se pierde la orden por esto.
  if (orderId) {
    await admin
      .from("qr_print_orders")
      .update({ receipt_id: receiptId })
      .eq("id", orderId)
      .eq("tenant_id", operario.tenant_id);
  }

  return { ok: true, orderCode };
}

function humanizeQrError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Falta Shipping Mark.";
  if (msg.includes("P0004")) return "Cantidad de bultos inválida.";
  return msg;
}
