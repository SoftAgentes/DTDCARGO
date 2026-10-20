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
import { resolveRateForClient } from "../price-books/price-book-queries";
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

/** El Shipping Mark se compara como la RPC: `upper(btrim())` en los dos lados. */
export const clave = (markbox: string | null | undefined) => (markbox ?? "").trim().toUpperCase();

/** `%`, `_` y `\` son comodines de ILIKE: se escapan para buscar el texto tal cual. */
function sinComodines(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => "\\" + c);
}

const PAGINA_CLIENTES = 50;
const PAGINA_ESTIMADOS = 20;
const MAX_ESTIMADOS = 20;

/**
 * El cliente del Shipping Mark, comparado como la RPC (`upper(btrim())`). El
 * ILIKE con `%…%` trae candidatos sin importar mayúsculas ni espacios; la
 * comparación exacta se hace aquí, así `DTD-0001` no encuentra a `DTD-00012`.
 * Se recorren todas las páginas: limitar candidatos antes de normalizarlos
 * puede ocultar al cliente correcto o una segunda ficha ambigua.
 * Más de uno o ninguno = sin cliente (la RPC exige exactamente uno).
 */
async function clientePorShippingMark(supabase: SupabaseClient, markbox: string): Promise<string | null> {
  const key = clave(markbox);
  if (!key) return null;
  let clientId: string | null = null;
  for (let desde = 0; ; desde += PAGINA_CLIENTES) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, markbox")
      .ilike("markbox", `%${sinComodines(markbox.trim())}%`)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA_CLIENTES - 1);
    if (error) throw error;
    const candidatos = (data ?? []) as { id: string; markbox: string }[];
    for (const cliente of candidatos) {
      if (clave(cliente.markbox) !== key) continue;
      if (clientId !== null) return null;
      clientId = cliente.id;
    }
    if (candidatos.length < PAGINA_CLIENTES) return clientId;
  }
}

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

  const clientId = await clientePorShippingMark(supabase, receipt.client_markbox ?? "");
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
  const key = clave(codigo);
  type Candidato = {
    id: string;
    quote_code: string;
    client_markbox: string | null;
    rate_per_cbm: number | string;
    service: ShipmentService;
  };
  const encontrados: { id: string; quote_code: string; rate_per_cbm: number; service: ShipmentService }[] = [];
  for (let desde = 0; ; desde += PAGINA_ESTIMADOS) {
    const { data, error } = await supabase
      .from("quotes")
      .select("id, quote_code, client_markbox, rate_per_cbm, service, accepted_at")
      .ilike("client_markbox", `%${sinComodines(codigo)}%`)
      .eq("status", "accepted")
      .is("deleted_at", null)
      .not("rate_per_cbm", "is", null)
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA_ESTIMADOS - 1);
    if (error) throw error;
    const candidatos = (data ?? []) as Candidato[];
    for (const q of candidatos) {
      if (clave(q.client_markbox) !== key || !(Number(q.rate_per_cbm) > 0)) continue;
      encontrados.push({ id: q.id, quote_code: q.quote_code, rate_per_cbm: Number(q.rate_per_cbm), service: q.service });
      if (encontrados.length === MAX_ESTIMADOS) return encontrados;
    }
    if (candidatos.length < PAGINA_ESTIMADOS) return encontrados;
  }
}
