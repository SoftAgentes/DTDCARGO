/**
 * SDD-0281 · Los CSV del carril comercial: estimados y facturas.
 *
 * Regla de diseño: **el export es la vista, no un dump del schema.** Las
 * columnas y su orden son las de la tabla que el usuario tiene delante, con las
 * etiquetas que lee en pantalla (no los enums crudos de Postgres). Un CSV con
 * `puerta_a_puerta_DDP` y `accepted` obliga a traducir a mano lo que la app ya
 * sabía traducir.
 *
 * Dos derivados se calculan acá porque la tabla los muestra y la DB no los
 * guarda: el **saldo** de la factura (`total - abonado`) y si está **vencida**
 * (`due_date` pasada con saldo). Salen de los mismos helpers que pinta la UI
 * —`computeBalance` e `isOverdue`— para que el número del Excel y el de la
 * pantalla no puedan discrepar.
 *
 * Todo PURO: recibe filas ya consultadas (con su RLS aplicada) y devuelve
 * texto. Sin DB, sin `Date.now()` salvo donde el propio dominio lo pide.
 */

import { buildCsv, type CsvRow } from "./csv";
import type { Invoice } from "@/lib/studio/invoice-types";
import {
  computeBalance,
  isOverdue,
  statusLabel as facturaStatusLabel,
} from "@/lib/studio/invoice-types";
import type { Quote } from "@/lib/studio/quote-types";
import {
  packagingLabel,
  quoteServiceLabel,
  statusLabel as quoteStatusLabel,
} from "@/lib/studio/quote-types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estimados                                                 ║
// ╚═══════════════════════════════════════════════════════════╝

export const ESTIMADOS_CSV_HEADERS = [
  "codigo",
  "estado",
  "cliente",
  "shipping_mark",
  "servicio",
  "origen",
  "destino",
  "cbm",
  "peso_kg",
  "bultos",
  "embalaje",
  "tarifa_por_cbm",
  "tarifa_fija",
  "subtotal_usd",
  "costo_embalaje_usd",
  "total_usd",
  "vigente_hasta",
  "origen_del_estimado",
  "convertido_a_embarque",
  "creado",
] as const;

/**
 * Un monto para una celda de CSV: `2720.00`, **sin separador de miles**.
 *
 * 🔴 A propósito NO usa `fmtAmount` (que da `2,720.00`). Eso se ve bien en
 * pantalla, pero Excel lee una celda con coma como TEXTO —no como número— y la
 * columna deja de poderse sumar, que es literalmente para lo que alguien baja
 * un CSV de facturación. El formato bonito es de la app; el CSV lleva el dato.
 */
function monto(v: number): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** `null` → celda vacía; un `0` legítimo se imprime como `0.00`. */
function montoOVacio(v: number | null | undefined): string {
  return v == null ? "" : monto(v);
}

export function buildEstimadosCsv(quotes: readonly Quote[]): string {
  const rows: CsvRow[] = quotes.map((q) => [
    q.quote_code,
    quoteStatusLabel(q.status),
    q.client_name,
    q.client_markbox ?? "",
    quoteServiceLabel(q.service),
    q.origin,
    q.destination,
    q.cbm == null ? "" : Number(q.cbm).toFixed(3),
    montoOVacio(q.weight_kg),
    q.boxes ?? "",
    packagingLabel(q.packaging),
    montoOVacio(q.rate_per_cbm),
    montoOVacio(q.flat_rate),
    monto(q.subtotal_usd),
    monto(q.packaging_cost),
    monto(q.total_usd),
    q.valid_until,
    q.source === "web" ? "Calculadora web" : "Studio",
    // Interesa SI se convirtió, no el uuid del embarque: el CSV lo lee una
    // persona, y un uuid en una celda no le dice nada a nadie.
    q.converted_to_shipment_id ? "Sí" : "No",
    (q.created_at ?? "").slice(0, 10),
  ]);
  return buildCsv(ESTIMADOS_CSV_HEADERS, rows);
}

export function estimadosCsvFilename(hoyISO: string): string {
  return `estimados-${hoyISO}.csv`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Facturas                                                  ║
// ╚═══════════════════════════════════════════════════════════╝

export const FACTURAS_CSV_HEADERS = [
  "codigo",
  "estado",
  "vencida",
  "cliente",
  "shipping_mark",
  "embarque",
  "moneda",
  "tasa",
  "base",
  "iva_pct",
  "iva",
  "total",
  "abonado",
  "saldo",
  "emitida",
  "vence",
  "ultimo_pago",
  "creada",
] as const;

export function buildFacturasCsv(invoices: readonly Invoice[]): string {
  const rows: CsvRow[] = invoices.map((i) => [
    i.invoice_code,
    facturaStatusLabel(i.status),
    // `vencida` es una columna aparte y no un estado: la DB guarda `emitida` y
    // el vencimiento se DERIVA de la fecha. Aplastarlas en una sola celda
    // perdería el estado real de la factura.
    isOverdue(i) ? "Sí" : "No",
    i.client_name,
    i.client_markbox,
    i.shipment_code ?? "",
    i.currency,
    montoOVacio(i.fx_rate),
    monto(i.base_amount),
    i.iva_rate,
    monto(i.iva_amount),
    monto(i.total_amount),
    monto(i.paid_amount),
    monto(computeBalance(i)),
    i.issued_at ?? "",
    i.due_date ?? "",
    (i.last_payment_at ?? "").slice(0, 10),
    (i.created_at ?? "").slice(0, 10),
  ]);
  return buildCsv(FACTURAS_CSV_HEADERS, rows);
}

export function facturasCsvFilename(hoyISO: string): string {
  return `facturas-${hoyISO}.csv`;
}
