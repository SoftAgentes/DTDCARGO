/**
 * SDD-0289 · Los CSV de Clientes, Cobranzas y Tracking.
 *
 * Misma regla que los del carril comercial (SDD-0281): **el export es la vista,
 * no un dump del schema** — columnas y orden como en la tabla, etiquetas como
 * las lee el usuario, y montos crudos con dos decimales para que Excel los pueda
 * sumar (con separador de miles los lee como texto).
 *
 * ## 🔴 Lo que estos tres tienen y los comerciales no: topes silenciosos
 *
 * Las funciones que alimentan estas pantallas están acotadas a propósito —
 * `listShipments` corta en 100 filas y `listClients` en `CLIENTS_MAX`— porque
 * una pantalla no necesita más. **Un export sí.** Reusarlas tal cual daría un
 * archivo truncado sin decirlo: el que lo abre no tiene forma de saber que le
 * faltan filas, y un CSV parece completo por definición.
 *
 * Por eso acá hay lecturas propias que paginan con `fetchAllPaged`, y cuando la
 * paginación topa el máximo de páginas **se lanza**, en vez de devolver un
 * archivo a medias. Un error se ve; un CSV corto, no.
 *
 * Cobranzas es la excepción: `receivablesQueue` ya pagina entero y ya grita si
 * topa, así que se reusa tal cual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import { buildCsv, type CsvRow } from "./csv";
import type { Client } from "@/lib/studio/client-types";
import { tierLabel } from "@/lib/studio/client-types";
import type { Receivable } from "@/lib/studio/payment-queries";
import { stageLabel } from "@/lib/studio/payment-types";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import { serviceLabel, STATUS_LABELS } from "@/lib/shared/shipment-public";

/** Monto para celda de CSV: `2720.00`, sin separador de miles. Ver SDD-0281. */
function monto(v: number | null | undefined): string {
  if (v == null) return "";
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** `YYYY-MM-DD` a partir de un ISO con o sin hora. */
function fecha(v: string | null | undefined): string {
  return (v ?? "").slice(0, 10);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Clientes                                                  ║
// ╚═══════════════════════════════════════════════════════════╝

export const CLIENTES_CSV_HEADERS = [
  "shipping_mark",
  "nombre",
  "contacto",
  "tier",
  "email",
  "telefono",
  "documento",
  "tipo_documento",
  "verificacion",
  "direccion",
  "origen_del_alta",
  "creado",
] as const;

const CANAL_LABEL: Record<string, string> = {
  admin: "Asesor",
  portal: "Auto-registro",
};

const VERIFY_LABEL: Record<string, string> = {
  ok: "Verificado",
  mismatch: "No coincide",
  unavailable: "No verificable",
};

export function buildClientesCsv(clients: readonly Client[]): string {
  const rows: CsvRow[] = clients.map((c) => [
    c.markbox,
    c.name,
    c.contact_name ?? "",
    tierLabel(c.tier),
    c.email ?? "",
    c.phone ?? "",
    c.rif ?? "",
    c.doc_kind === "empresa" ? "RIF" : c.doc_kind === "persona" ? "Cédula" : "",
    // `null` = nunca se verificó, que NO es lo mismo que "no verificable".
    c.doc_verify_status ? (VERIFY_LABEL[c.doc_verify_status] ?? c.doc_verify_status) : "Sin verificar",
    c.address ?? "",
    CANAL_LABEL[c.registration_channel] ?? c.registration_channel,
    fecha(c.created_at),
  ]);
  return buildCsv(CLIENTES_CSV_HEADERS, rows);
}

export function clientesCsvFilename(hoyISO: string): string {
  return `clientes-${hoyISO}.csv`;
}

/**
 * TODOS los clientes vivos, paginando. No usa `listClients` a propósito: aquella
 * topa en `CLIENTS_MAX` porque alimenta una pantalla con "Ver más".
 */
export async function listarClientesParaExport(
  supabase: SupabaseClient,
): Promise<Client[]> {
  const { rows, complete } = await fetchAllPaged<Client>((d, h) =>
    supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Los clientes superan el tope de lectura: el CSV saldría incompleto sin decirlo.",
    );
  }
  return rows;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Cobranzas                                                 ║
// ╚═══════════════════════════════════════════════════════════╝

export const COBRANZAS_CSV_HEADERS = [
  "factura",
  "etapa",
  "cliente",
  "shipping_mark",
  "embarque",
  "moneda",
  "saldo",
  "saldo_usd",
  "dias_vencido",
  "emitida",
  "vence",
  "promesa_de_pago",
] as const;

export function buildCobranzasCsv(receivables: readonly Receivable[]): string {
  const rows: CsvRow[] = receivables.map((r) => [
    r.invoice.invoice_code,
    stageLabel(r.stage),
    r.invoice.client_name,
    r.invoice.client_markbox,
    r.invoice.shipment_code ?? "",
    r.invoice.currency,
    monto(r.balance),
    // El saldo nativo es multi-moneda y NO se puede sumar. La columna en USD es
    // la que sirve para totalizar — por eso van las dos y con nombres distintos.
    monto(r.balanceUsd),
    r.daysOverdue == null ? "" : r.daysOverdue,
    fecha(r.invoice.issued_at),
    fecha(r.invoice.due_date),
    fecha(r.promiseDate),
  ]);
  return buildCsv(COBRANZAS_CSV_HEADERS, rows);
}

export function cobranzasCsvFilename(hoyISO: string): string {
  return `cobranzas-${hoyISO}.csv`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Tracking                                                  ║
// ╚═══════════════════════════════════════════════════════════╝

export const TRACKING_CSV_HEADERS = [
  "codigo",
  "estado",
  "cliente",
  "shipping_mark",
  "servicio",
  "origen",
  "destino",
  "cbm",
  "peso_kg",
  "creado",
] as const;

export function buildTrackingCsv(shipments: readonly ShipmentListRow[]): string {
  const rows: CsvRow[] = shipments.map((s) => [
    s.code,
    STATUS_LABELS[s.status] ?? s.status,
    s.client_name ?? "",
    s.client_markbox ?? "",
    serviceLabel(s.shipment_service),
    s.origin ?? "",
    s.destination ?? "",
    s.volume_m3 == null ? "" : Number(s.volume_m3).toFixed(3),
    monto(s.weight_kg),
    fecha(s.created_at),
  ]);
  return buildCsv(TRACKING_CSV_HEADERS, rows);
}

export function trackingCsvFilename(hoyISO: string): string {
  return `embarques-${hoyISO}.csv`;
}

/**
 * TODOS los embarques vivos, paginando. No usa `listShipments`: aquella tiene un
 * `.limit(100)` fijo — suficiente para la pantalla, mentiroso para un archivo.
 */
export async function listarEmbarquesParaExport(
  supabase: SupabaseClient,
): Promise<ShipmentListRow[]> {
  const { rows, complete } = await fetchAllPaged<ShipmentListRow>((d, h) =>
    supabase
      .from("shipments")
      .select(
        "id, code, client_name, client_markbox, origin, destination, shipment_service, status, weight_kg, volume_m3, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Los embarques superan el tope de lectura: el CSV saldría incompleto sin decirlo.",
    );
  }
  return rows;
}
