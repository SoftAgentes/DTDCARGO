/**
 * Comprobante de factura del portal (Norte · cierra el botón "Descargar PDF ·
 * próximamente" del detalle de factura). Builder PURO: toma el detalle de factura
 * read-only del portal (`getMyInvoice`) y devuelve el modelo de presentación del
 * documento imprimible — subtotales por línea + totales + flags. El render
 * (page.tsx) sólo formatea con `formatInvoiceAmount`/fechas; toda la aritmética
 * vive acá para poder testearla sin DOM.
 *
 * El documento es un COMPROBANTE, no una factura fiscal (la facturación fiscal
 * SENIAT es SDD-0073, write-path diferido) — la página lo declara explícito,
 * mismo criterio que el recibo de cobranza del Studio (SDD-0068).
 */
import type { PortalInvoiceDetail } from "./portal-types";
import { esAnulada, saldoPorPagar } from "./saldo-de-cuenta";

/** Una línea del comprobante con su subtotal ya calculado (qty × precio unit.). */
export type ComprobanteLine = {
  desc: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

/** Modelo de presentación del comprobante (números crudos; el render formatea). */
export type Comprobante = {
  lines: ComprobanteLine[];
  /** Suma de subtotales de línea (informativa; puede diferir de `base` si hubo descuentos/ajustes). */
  linesTotal: number;
  /** Base imponible de la factura (subtotal antes de IVA). */
  subtotal: number;
  ivaOn: boolean;
  ivaRate: number;
  ivaAmount: number;
  total: number;
  paid: number;
  balance: number;
  /** Hay saldo por pagar (> 0) → se resalta en dorado. */
  hasBalance: boolean;
  /** Sin saldo y con algo pagado → "pagada". Nunca en una anulada. */
  isPaid: boolean;
  /** La factura está anulada: no hay saldo ni «pagada» (SDD-0556). */
  isVoided: boolean;
  /** Lo que se pagó en la factura si está anulada; 0 si no. No se descuenta de nada. */
  paidOnVoided: number;
};

/**
 * Arma el modelo de presentación del comprobante desde el detalle de factura.
 * No toca la red ni la DB — entrada validada por RLS aguas arriba (`getMyInvoice`).
 */
export function buildComprobante(inv: PortalInvoiceDetail): Comprobante {
  const lines: ComprobanteLine[] = inv.lines.map((l) => {
    const qty = Number(l.qty) || 0;
    const unitPrice = Number(l.unitPrice) || 0;
    return { desc: l.desc, qty, unitPrice, subtotal: qty * unitPrice };
  });

  const linesTotal = lines.reduce((acc, l) => acc + l.subtotal, 0);
  // `saldoPorPagar` recorta el sobrepago a 0 (un comprobante nunca muestra
  // saldo negativo) y da 0 en una anulada: la misma definición de deuda que
  // la lista y los KPIs (SDD-0556).
  const balance = saldoPorPagar(inv);
  const hasBalance = balance > 0.005; // tolerancia de centavo
  const isVoided = esAnulada(inv);

  return {
    lines,
    linesTotal,
    subtotal: inv.base,
    ivaOn: inv.ivaRate > 0,
    ivaRate: inv.ivaRate,
    ivaAmount: inv.ivaAmount,
    total: inv.total,
    paid: inv.paid,
    balance,
    hasBalance,
    isPaid: !isVoided && !hasBalance && inv.paid > 0,
    isVoided,
    paidOnVoided: isVoided ? inv.paid : 0,
  };
}

/** Lo que dice el pill de estado del comprobante. */
export type ComprobantePill = {
  label: "Anulada" | "Pagada" | "Vencida" | "Pendiente" | "Emitida";
  color: string;
};

/**
 * El pill de estado del comprobante. Puro: `now` entra como argumento.
 *
 * La anulada va PRIMERO (SDD-0556): antes pintaba «Vencida» o «Pendiente» en
 * una anulada con saldo, que es decirle al cliente que debe una factura que ya
 * no existe.
 */
export function estadoDelComprobante(
  c: Pick<Comprobante, "isVoided" | "isPaid" | "hasBalance">,
  dueDate: string | null,
  now: number = Date.now(),
): ComprobantePill {
  if (c.isVoided) return { label: "Anulada", color: "var(--doc-ink-soft)" };
  if (c.isPaid) return { label: "Pagada", color: "var(--doc-success)" };
  if (c.hasBalance && isPast(dueDate, now))
    return { label: "Vencida", color: "var(--doc-danger)" };
  if (c.hasBalance) return { label: "Pendiente", color: "var(--doc-warning)" };
  return { label: "Emitida", color: "var(--doc-ink-soft)" };
}

function isPast(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < now;
}
