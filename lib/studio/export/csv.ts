/**
 * SDD-0281 · La primitiva de CSV del Studio.
 *
 * Existía una sola implementación —`csvCell` dentro de `bitacora/reports.ts`— y
 * al llegar los exports del carril comercial iban a ser dos. Dos escapes de CSV
 * en un repo se desincronizan calladas y el síntoma aparece en el Excel de
 * alguien, no en un test. Así que la primitiva se sube acá y bitácora la
 * reexporta: su API pública no cambia y sus tests siguen siendo el guardián.
 *
 * Convención del repo, en un solo lugar:
 *  - **UTF-8 con BOM** (`U+FEFF`). Sin él, Excel en Windows abre en
 *    Windows-1252 y destroza ñ y acentos — que en este negocio son la mitad de
 *    los nombres de cliente.
 *  - **CRLF** entre filas (RFC 4180).
 *  - Celdas entrecomilladas sólo si hace falta; comillas internas duplicadas.
 */

/**
 * Escapa una celda (RFC 4180): entrecomilla si hay coma, comilla o salto de
 * línea, y duplica las comillas internas.
 *
 * ⚠️ Esto NO neutraliza la inyección de fórmulas de Excel (`=`, `+`, `-`, `@`
 * al inicio). Es deliberado: estos exports los abre el propio equipo con datos
 * del propio tenant, y prefijar un apóstrofo ensuciaría códigos y montos. Si
 * algún día un CSV lleva texto que escribió un tercero (un nombre de proveedor
 * cargado por el cliente, por ejemplo), ese export necesita su propio saneo.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Fila de un CSV, ya en el orden de las cabeceras. */
export type CsvRow = readonly (string | number | null | undefined)[];

/**
 * Arma el documento completo: BOM + cabeceras + filas, unido con CRLF. PURA.
 */
export function buildCsv(headers: readonly string[], rows: readonly CsvRow[]): string {
  const lineas = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  return "﻿" + lineas.join("\r\n");
}

/**
 * La respuesta HTTP de una descarga CSV. `attachment` siempre: un CSV que se
 * abre en el navegador no le sirve a nadie.
 */
export function respuestaCsv(csv: string, nombreArchivo: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
