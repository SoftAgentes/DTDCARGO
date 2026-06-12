/**
 * Recibo de cobranza con mandato (SDD-0068 · capa legal SDD-C) — builder PURO.
 *
 * Produce la estructura tipada + el texto plano del recibo EXACTAMENTE según
 * la plantilla de `docs/legal/COPY_LEGAL_UI.md §2` (copy LITERAL, efecto
 * probatorio — cambiarlo es decisión de Claude Chat, no de código). La página
 * imprimible (`app/studio/(app)/cobranzas/recibo/[code]/page.tsx`) renderiza
 * estas mismas líneas; los tests fijan el string contra el COPY.
 *
 * BRAND-CHECK (documentado en el spec, decisión #6): la razón social
 * "Inversiones DTD Services, C.A." SÍ es visible en este documento porque el
 * copy legal literal la exige (es el agente de cobranza que firma el recibo).
 * Es una excepción acotada al recibo: la regla "razón social solo en schema"
 * sigue vigente para el sitio público/marketing. PROHIBIDO en cualquier caso:
 * "DoorTuDoor Trading" y el RIF J-50220185-8 (regla absoluta del handoff).
 *
 * Sin Supabase, sin React: testeable string-exacto.
 */

import {
  applicationStatusClientView,
  paymentMethodLabel,
  type ApplicationStatus,
  type PayerKind,
} from "@/lib/studio/payment-types";

// ── Literales COPY §2 (NO editar acá) ─────────────────────────

export const RECEIPT_TITLE = "RECIBO DE PAGO — DTD CARGO";
export const RECEIPT_MANDATE_LEGEND =
  "Gestión de cobranza por cuenta de DTD Cargo (operadora internacional)";
export const RECEIPT_SERVICE_LINE = "Servicio puerta a puerta China–Venezuela";
export const RECEIPT_RECEIVED_BY =
  "Recibido por: Inversiones DTD Services, C.A., agente de cobranza de la Operadora.";
export const RECEIPT_NOT_FISCAL =
  "Este recibo acredita la recepción del pago indicado y NO constituye factura fiscal.";

/** Ref./cliente de un pago sin referencia todavía no identificado. */
export const RECEIPT_PENDING_REF = "Pendiente de identificación";

/** Key del documento "Acuerdo de Servicios" en `legal_docs` (hoy = T&C). */
export const ACUERDO_DOC_KEY = "tyc";

// ── Tipos de entrada (subsets serializables) ──────────────────

export type ReceiptTemplateReceipt = {
  receipt_code: string;
  client_name: string | null;
  client_markbox: string | null;
  amount: number;
  currency: string;
  method: string;
  received_at: string; // YYYY-MM-DD — fecha de recepción de fondos
  payer_kind: PayerKind;
  payer_name: string | null;
  payer_relation: string | null;
  application_status: ApplicationStatus;
};

export type ReceiptTemplateInvoice = {
  invoice_code: string;
  shipment_code: string | null;
  client_markbox: string | null;
} | null;

/** El recibo armado, campo a campo + texto plano completo. */
export type ReceiptDoc = {
  title: string;
  legend: string;
  serviceLine: string;
  refEnvio: string;
  cliente: string;
  pagador: string;
  /** "Monto: {monto} {moneda}   ·   Canal: {canal_pago}" ya armada. */
  montoLine: string;
  /** "Fecha de recepción de fondos: {fecha}" ya armada. */
  fechaLine: string;
  recibidoPor: string;
  noFiscal: string;
  /** "Documento sujeto al Acuerdo de Servicios v{version} aceptado por el Cliente." */
  acuerdoLine: string;
  /**
   * Estado visible al cliente (COPY §7) cuando el pago está sin identificar —
   * el recibo sin factura es imprimible como constancia (decisión #6). null
   * para recibos aplicados.
   */
  estadoCliente: string | null;
  /** El documento completo, línea a línea (string-exacto vs COPY §2). */
  lines: string[];
  /** lines.join("\n"). */
  text: string;
};

// ── Helpers puros ─────────────────────────────────────────────

/** Formato del monto del recibo (en-US, 2 decimales). Exportado para que la
 *  página imprimible lo destaque visualmente sin re-derivar el formato. */
export function fmtAmount(n: number): string {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Normaliza la versión del Acuerdo para la línea "…Acuerdo de Servicios
 * v{version}…": las versiones del sistema vienen como "v2.1" (legal_docs) —
 * se pela la "v" inicial para no imprimir "vv2.1". Sin versión → "—"
 * (la línea queda "…v— aceptado por el Cliente.", fallback del spec).
 */
export function normalizeAcuerdoVersion(
  version: string | null | undefined,
): string {
  const v = String(version ?? "").trim();
  if (!v) return "—";
  return v.replace(/^v/i, "") || "—";
}

/**
 * Versión del Acuerdo que ampara este recibo (decisión #6):
 *  1. la aceptación MÁS RECIENTE de la orden que incluya el doc del Acuerdo
 *     (prefiriendo las de hash verificado — evidencia íntegra);
 *  2. fallback: la versión vigente de `legal_docs`;
 *  3. fallback: null → la línea imprime "v—".
 * PURA: recibe filas ya leídas (las queries viven en lib/studio/legal).
 */
export function pickAcuerdoVersion(
  acceptances: Array<{
    docs: Array<{ key: string; version: string }>;
    hash_verified?: boolean;
  }>,
  vigentes: Array<{ key: string; version: string }>,
): string | null {
  const withDoc = (a: { docs: Array<{ key: string; version: string }> }) =>
    a.docs.find((d) => d.key === ACUERDO_DOC_KEY) ?? null;

  // 1a. La más reciente con hash verificado (el array ya viene desc).
  for (const a of acceptances) {
    if (a.hash_verified === false) continue;
    const doc = withDoc(a);
    if (doc) return doc.version;
  }
  // 1b. Sin verificadas: la más reciente que tenga el doc.
  for (const a of acceptances) {
    const doc = withDoc(a);
    if (doc) return doc.version;
  }
  // 2. Versión vigente de legal_docs.
  const vigente = vigentes.find((d) => d.key === ACUERDO_DOC_KEY);
  return vigente?.version ?? null;
}

// ── Builder ───────────────────────────────────────────────────

/**
 * Arma el recibo según COPY §2.
 *
 *  - Ref. envío = `{shipping_mark}-{n_operacion}`: si la factura tiene
 *    `shipment_code` se usa su forma canónica (el código de la orden YA es
 *    shipping mark + sufijo); sin shipment, el Shipping Mark del cliente; un
 *    sin-ref imprime "Pendiente de identificación".
 *  - Pagador: el cliente (default) imprime su nombre; un tercero imprime
 *    "{nombre} (tercero — relación: {relación})" con la relación en minúscula
 *    tal como la variable del COPY.
 *  - La versión del Acuerdo llega resuelta por el caller (ver
 *    `pickAcuerdoVersion`); null ⇒ "v—".
 */
export function buildReceiptDoc(args: {
  receipt: ReceiptTemplateReceipt;
  invoice?: ReceiptTemplateInvoice;
  acuerdoVersion?: string | null;
}): ReceiptDoc {
  const { receipt } = args;
  const invoice = args.invoice ?? null;
  const sinRef = receipt.application_status === "recibido_sin_ref";

  const refEnvio = sinRef
    ? RECEIPT_PENDING_REF
    : invoice?.shipment_code?.trim() ||
      receipt.client_markbox?.trim() ||
      invoice?.client_markbox?.trim() ||
      "—";

  const cliente = sinRef
    ? RECEIPT_PENDING_REF
    : receipt.client_name?.trim() || "—";

  const pagador =
    receipt.payer_kind === "tercero" && receipt.payer_name
      ? `${receipt.payer_name} (tercero — relación: ${String(
          receipt.payer_relation ?? "otro",
        )})`
      : sinRef
        ? "—"
        : receipt.payer_name?.trim() || receipt.client_name?.trim() || "—";

  const montoLine = `Monto: ${fmtAmount(receipt.amount)} ${receipt.currency}   ·   Canal: ${paymentMethodLabel(receipt.method)}`;
  const fechaLine = `Fecha de recepción de fondos: ${receipt.received_at}`;
  const acuerdoLine = `Documento sujeto al Acuerdo de Servicios v${normalizeAcuerdoVersion(args.acuerdoVersion)} aceptado por el Cliente.`;

  const estadoCliente = sinRef
    ? applicationStatusClientView("recibido_sin_ref")
    : null;

  const lines: string[] = [
    RECEIPT_TITLE,
    RECEIPT_MANDATE_LEGEND,
    RECEIPT_SERVICE_LINE,
    "",
    `Ref. envío: ${refEnvio}`,
    `Cliente: ${cliente}`,
    `Pagador: ${pagador}`,
    montoLine,
    fechaLine,
    RECEIPT_RECEIVED_BY,
    "",
    RECEIPT_NOT_FISCAL,
    acuerdoLine,
  ];

  return {
    title: RECEIPT_TITLE,
    legend: RECEIPT_MANDATE_LEGEND,
    serviceLine: RECEIPT_SERVICE_LINE,
    refEnvio,
    cliente,
    pagador,
    montoLine,
    fechaLine,
    recibidoPor: RECEIPT_RECEIVED_BY,
    noFiscal: RECEIPT_NOT_FISCAL,
    acuerdoLine,
    estadoCliente,
    lines,
    text: lines.join("\n"),
  };
}
