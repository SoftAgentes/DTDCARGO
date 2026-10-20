/**
 * La propuesta automática de tarifa para una recepción (SDD-0571, decisión 9):
 * estimado aceptado → lista del cliente o aliado → tarifario de la casa.
 *
 * Esto solo ELIGE la fila de origen. Los números los pone la base
 * (`congelar_tarifa_recepcion`), que vuelve a clasificar la fila con la misma
 * regla de `resolveRateForClient`. Así la app no puede congelar un número que
 * no sale de su fuente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { clientIdByMarkbox, resolveRateForClient } from "../price-books/price-book-queries";
import type { OrigenTarifa } from "../price-books/price-book-types";
import type { ShipmentService } from "../shipment-types";

export type PropuestaTarifa =
  | { kind: "estimado"; quoteId: string; quoteCode: string; service: ShipmentService }
  | { kind: "tarifario"; rateId: string; origen: OrigenTarifa; bookName: string | null; service: ShipmentService }
  | { kind: "ninguna"; motivo: "sin_cliente" | "sin_destino" | "sin_tarifa" | "sin_cbm" };

/** Lo que la propuesta necesita de la recepción. */
export type RecepcionParaTarifa = {
  client_markbox: string | null;
  destination_city: string | null;
  sales_order_id: string | null;
  total_cbm: number | null;
  is_orphan: boolean;
};

const clave = (markbox: string | null | undefined) => (markbox ?? "").trim().toUpperCase();

/**
 * El estimado aceptado de la orden de venta ligada a la recepción, si es del
 * mismo cliente y cobra por CBM. Solo ese: un estimado suelto del cliente se
 * elige a mano en el cajón, porque «el último aceptado» puede ser de otra carga.
 */
async function estimadoDeLaOrden(
  supabase: SupabaseClient,
  receipt: RecepcionParaTarifa,
): Promise<{ id: string; quote_code: string; service: ShipmentService } | null> {
  if (!receipt.sales_order_id) return null;
  const { data: orden, error: eOrden } = await supabase
    .from("sales_orders")
    .select("quote_id")
    .eq("id", receipt.sales_order_id)
    .is("deleted_at", null)
    .maybeSingle<{ quote_id: string | null }>();
  if (eOrden) throw eOrden;
  if (!orden?.quote_id) return null;

  const { data: quote, error: eQuote } = await supabase
    .from("quotes")
    .select("id, quote_code, client_markbox, service, rate_per_cbm, status")
    .eq("id", orden.quote_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      quote_code: string;
      client_markbox: string | null;
      service: ShipmentService;
      rate_per_cbm: number | string | null;
      status: string;
    }>();
  if (eQuote) throw eQuote;
  if (!quote || quote.status !== "accepted") return null;
  if (clave(quote.client_markbox) !== clave(receipt.client_markbox)) return null;
  if (quote.rate_per_cbm == null || !(Number(quote.rate_per_cbm) > 0)) return null;
  return { id: quote.id, quote_code: quote.quote_code, service: quote.service };
}

export async function proponerTarifa(
  supabase: SupabaseClient,
  receipt: RecepcionParaTarifa,
  service: ShipmentService,
): Promise<PropuestaTarifa> {
  if (receipt.is_orphan || !clave(receipt.client_markbox)) return { kind: "ninguna", motivo: "sin_cliente" };
  if (receipt.total_cbm == null || !(Number(receipt.total_cbm) > 0)) return { kind: "ninguna", motivo: "sin_cbm" };

  const estimado = await estimadoDeLaOrden(supabase, receipt);
  if (estimado) {
    return { kind: "estimado", quoteId: estimado.id, quoteCode: estimado.quote_code, service: estimado.service };
  }

  const clientId = await clientIdByMarkbox(supabase, receipt.client_markbox ?? "");
  if (!clientId) return { kind: "ninguna", motivo: "sin_cliente" };
  if (!receipt.destination_city?.trim()) return { kind: "ninguna", motivo: "sin_destino" };

  const resuelta = await resolveRateForClient(supabase, {
    service,
    destination: receipt.destination_city,
    clientId,
  });
  // Solo cuenta una fila que cobre por CBM: la recepción mide CBM.
  if (!resuelta || resuelta.rate.per_cbm == null || !(Number(resuelta.rate.per_cbm) > 0)) {
    return { kind: "ninguna", motivo: "sin_tarifa" };
  }
  return {
    kind: "tarifario",
    rateId: resuelta.rateId,
    origen: resuelta.origen,
    bookName: resuelta.bookName,
    service,
  };
}

/** Los estimados aceptados del cliente, para elegir uno a mano en el cajón. */
export async function listAcceptedQuotesForMarkbox(
  supabase: SupabaseClient,
  markbox: string,
): Promise<{ id: string; quote_code: string; rate_per_cbm: number; service: ShipmentService }[]> {
  const codigo = markbox.trim();
  if (!codigo) return [];
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_code, rate_per_cbm, service, accepted_at")
    .ilike("client_markbox", codigo)
    .eq("status", "accepted")
    .is("deleted_at", null)
    .not("rate_per_cbm", "is", null)
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as { id: string; quote_code: string; rate_per_cbm: number | string; service: ShipmentService }[])
    .map((q) => ({ id: q.id, quote_code: q.quote_code, rate_per_cbm: Number(q.rate_per_cbm), service: q.service }))
    .filter((q) => q.rate_per_cbm > 0);
}
