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
 *  - Fórmulas de hoja de cálculo neutralizadas antes del escape RFC 4180.
 *  - Celdas entrecomilladas sólo si hace falta; comillas internas duplicadas.
 */

/**
 * Neutraliza fórmulas y luego escapa una celda según RFC 4180. Excel y otras
 * hojas interpretan texto iniciado por `=`, `+`, `-`, `@`, tab o retorno como
 * fórmula/comando. Se antepone `'` sólo cuando el valor no es un número válido:
 * `-100` sigue siendo número, mientras `-CMD()` queda forzado a texto.
 */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  if (s !== "" && /^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s))) {
    s = `'${s}`;
  }
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
