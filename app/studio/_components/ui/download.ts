/**
 * Descarga un archivo de texto en el cliente (Blob + <a download>), sin lib
 * externa. Helper compartido del Studio para exports CSV/TXT.
 *
 * Solo se invoca en el cliente (al click) — referencia `document`/`Blob` dentro
 * del cuerpo, nunca a nivel de módulo, así que importarlo es SSR-safe.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8",
): void {
  // BOM UTF-8 al frente (U+FEFF): sin él, Excel en Windows (el entorno del
  // operador) abre el CSV en Windows-1252 y rompe →, m³ y acentos en los
  // encabezados. Inocuo para Google Sheets / LibreOffice / parsers modernos.
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
