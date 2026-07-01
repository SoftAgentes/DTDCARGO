/**
 * Numeración & legal (SDD-0122) — types + formatos de referencia + validator.
 *
 * Los FORMATOS de correlativo son fijos por diseño (viven en RPCs). Acá se
 * listan como referencia read-only; solo Facturas y Estimados muestran el
 * "próximo" en vivo (sus RPCs son SELECT max+1, no consumen). Lo editable son
 * las leyendas legales del pie de factura.
 */

export interface NumberingFormat {
  /** Etiqueta visible. */
  label: string;
  /** Patrón del código (informativo). */
  format: string;
  /** Próximo código, si se pudo calcular en vivo sin consumir correlativo. */
  next: string | null;
  /** Nota corta del origen (RPC / secuencia). */
  source: string;
}

export interface LegalLegends {
  footer: string;
  terms: string;
}

export interface NumberingOverview {
  formats: NumberingFormat[];
  legends: LegalLegends;
}

export interface NumberingActionState {
  ok?: boolean;
  error?: string;
}

/**
 * Catálogo estático de correlativos del Studio (fijos por diseño). `live`
 * marca los que tienen preview seguro del próximo valor.
 */
export const NUMBERING_CATALOG: Array<{
  label: string;
  format: string;
  source: string;
  live: boolean;
}> = [
  { label: "Estimados", format: "Q-YYYY-NNNN", source: "next_quote_code()", live: true },
  { label: "Facturas", format: "F-YYYY-NNNN", source: "next_invoice_code()", live: true },
  { label: "Shipping Mark (cliente)", format: "DTD-NNNN", source: "next_markbox()", live: false },
  { label: "Embarques", format: "S-YYYY-NNNN", source: "correlativo por año", live: false },
  { label: "Rutas", format: "R-YYYY-NNNN", source: "correlativo por año", live: false },
];

const MAX_LEN = 2000;

export function validateLegalLegendsInput(fd: FormData): {
  input?: LegalLegends;
  error?: string;
} {
  const footer = typeof fd.get("footer") === "string" ? (fd.get("footer") as string).trim() : "";
  const terms = typeof fd.get("terms") === "string" ? (fd.get("terms") as string).trim() : "";

  if (footer.length > MAX_LEN || terms.length > MAX_LEN) {
    return { error: `Cada leyenda admite hasta ${MAX_LEN} caracteres.` };
  }
  return { input: { footer, terms } };
}
