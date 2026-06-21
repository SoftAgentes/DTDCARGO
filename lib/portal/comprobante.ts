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
import {
  invoiceBalance,
  type PortalInvoiceDetail,
} from "./portal-types";

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
  /** Sin saldo y con algo pagado → "pagada". */
  isPaid: boolean;
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
  // `invoiceBalance` puede dar negativo si hubo sobrepago; un comprobante nunca
  // muestra saldo negativo → clamp a 0 (invariante del modelo: saldo ≥ 0).
  const balance = Math.max(
    0,
    invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid }),
  );
  const hasBalance = balance > 0.005; // tolerancia de centavo

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
    isPaid: !hasBalance && inv.paid > 0,
  };
}
