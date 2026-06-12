/**
 * Export CSV de la Rendición (SDD-0069 · decisión #8a) — PURO, server-safe.
 *
 * Un row por recibo incluido + filas de TOTALES (con su base). Reusa `rowsToCsv`
 * (escape CRLF) de `reports/export-csv.ts`. Sin dep nueva (consistencia con
 * 0067/0068): el "XLSX" del handoff se cubre con CSV que Excel abre nativo.
 *
 * El filename usa el rango del período: `rendicion-{from}-{to}.csv`.
 * Cero "DoorTuDoor Trading" / "Canopy" en el contenido (no se nombran).
 */

import { rowsToCsv, type CsvValue } from "../reports/export-csv";
import { fmtUsd } from "./printable";
import type { Rendition, RenditionLine } from "./types";

const CSV_HEADERS = [
  "Recibo",
  "Cliente",
  "Shipping Mark",
  "Ref. envío",
  "Fecha",
  "Monto",
  "Moneda",
  "Monto USD",
];

/** El export armado: nombre de archivo + contenido CSV. */
export type RenditionCsv = { filename: string; content: string };

/** `rendicion-{from}-{to}.csv` a partir del período (strings YYYY-MM-DD). */
export function renditionCsvFilename(from: string, to: string): string {
  return `rendicion-${from}-${to}.csv`;
}

/**
 * Construye el CSV de una rendición: un row por recibo + 3 filas de totales con
 * su base (recaudado de terceros [caja], servicios locales facturados
 * [devengado], saldo a favor de la Operadora). PURA — testeable sin DB.
 */
export function buildRenditionCsv(
  rendition: Rendition,
  lines: RenditionLine[],
): RenditionCsv {
  const rows: CsvValue[][] = lines.map((l) => [
    l.receiptCode,
    l.clientName ?? "",
    l.clientMarkbox ?? "",
    l.reference ?? "",
    l.receivedAt,
    l.amount,
    l.currency,
    l.amountUsd,
  ]);

  // Separador + totales (con su base). Las celdas vacías mantienen el ancho.
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push([
    "Recaudado de terceros (caja)",
    "",
    "",
    "",
    "",
    "",
    "USD",
    rendition.third_party_usd,
  ]);
  rows.push([
    "Servicios locales facturados (devengado)",
    "",
    "",
    "",
    "",
    "",
    "USD",
    rendition.local_revenue_usd,
  ]);
  rows.push([
    "Saldo a favor de la Operadora",
    "",
    "",
    "",
    "",
    "",
    "USD",
    rendition.net_to_operadora_usd,
  ]);

  return {
    filename: renditionCsvFilename(rendition.period_from, rendition.period_to),
    content: rowsToCsv(CSV_HEADERS, rows),
  };
}

/** Re-export para que el caller no formatee aparte. */
export { fmtUsd };
