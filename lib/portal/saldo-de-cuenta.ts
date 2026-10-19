/**
 * Saldo de cuenta del portal — UNA sola definición de deuda (SDD-0556).
 *
 * Antes había tres copias del cálculo (Inicio, Facturas y Finanzas) y no
 * coincidían: dos sumaban el saldo sin recortar a 0 y la tercera sí. Las tres
 * contaban las facturas ANULADAS como deuda, y el filtro «por pagar» también.
 * Este módulo es puro (sin red ni fecha): lo usan los KPIs de las tres
 * pantallas, el filtro `?saldo=1`, el detalle, el comprobante y el ledger.
 *
 * ## La regla
 *
 * - Una factura **anulada** se sigue viendo (lista, ledger en 0), pero no es
 *   deuda: no suma a lo facturado, a lo pagado ni a lo que falta pagar.
 * - Lo que se pagó en una anulada **no desaparece**: se informa aparte, con su
 *   moneda, y **no se descuenta** del saldo pendiente. Hoy no existe saldo a
 *   favor ni nota de crédito para aplicarlo: Sam eligió la regla «estricta» el
 *   2026-09-18 (`docs/specs/0488-carrera-cobro-factura/spec.md`). Restarlo le
 *   diría al cliente que pague menos de lo que el ERP mantiene abierto.
 * - Una anulada que **nunca se emitió** (`issuedAt` vacío) era un borrador
 *   anulado: el cliente nunca la recibió, así que queda fuera del portal, igual
 *   que un borrador.
 * - Una anulada **no decide** la moneda dominante.
 */
import {
  formatInvoiceAmount,
  invoiceBalance,
  type InvoiceCurrency,
  type PortalInvoiceRow,
} from "./portal-types";

type ConEstado = Pick<PortalInvoiceRow, "status">;

/** ¿La factura está anulada? */
export function esAnulada(inv: ConEstado): boolean {
  return inv.status === "anulada";
}

/**
 * ¿Es una anulada que nunca se emitió? Un borrador anulado: no tiene fecha de
 * emisión porque el cliente nunca lo recibió. El portal la trata como borrador.
 */
export function esAnuladaSinEmitir(
  inv: Pick<PortalInvoiceRow, "status" | "issuedAt">,
): boolean {
  return esAnulada(inv) && !inv.issuedAt;
}

/**
 * Lo que falta pagar de UNA factura: 0 si está anulada; si no,
 * `total − pagado` recortado a 0 (un sobrepago no es deuda negativa).
 */
export function saldoPorPagar(
  inv: Pick<PortalInvoiceRow, "status" | "total" | "paid">,
): number {
  if (esAnulada(inv)) return 0;
  return Math.max(0, invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid }));
}

/**
 * La moneda DOMINANTE: la de mayor total facturado entre las facturas NO
 * anuladas. Sumar entre monedas es incorrecto, así que las cifras se dan en
 * una sola y se avisa si hay otras.
 *
 * - A igual peso gana la moneda que tenga facturas vigentes y, después, la
 *   que aparece primero en la lista.
 * - Si todas están anuladas, la de la primera fila; sin filas, USD.
 * - `mixed` cuenta sólo las monedas con facturas vigentes: una anulada en otra
 *   moneda no dispara el aviso de «otras monedas».
 */
export function monedaDominante(
  invoices: Pick<PortalInvoiceRow, "status" | "currency" | "total">[],
): { currency: InvoiceCurrency; mixed: boolean } {
  const stats = new Map<InvoiceCurrency, { peso: number; vivas: number; orden: number }>();
  for (const inv of invoices) {
    const e = stats.get(inv.currency) ?? { peso: 0, vivas: 0, orden: stats.size };
    if (!esAnulada(inv)) {
      e.peso += inv.total;
      e.vivas += 1;
    }
    stats.set(inv.currency, e);
  }
  const ranked = [...stats.entries()].sort(
    ([, a], [, b]) =>
      b.peso - a.peso ||
      Number(b.vivas > 0) - Number(a.vivas > 0) ||
      a.orden - b.orden,
  );
  const conVivas = [...stats.values()].filter((e) => e.vivas > 0).length;
  return { currency: ranked[0]?.[0] ?? "USD", mixed: conVivas > 1 };
}

/** Un pago recibido en una factura que después se anuló. */
export type PagoEnAnulada = {
  /** Código de la factura anulada. */
  code: string;
  /** Envío asociado, si lo hay. */
  reference: string | null;
  amount: number;
  currency: InvoiceCurrency;
};

/**
 * Los pagos recibidos en facturas anuladas, de TODAS las monedas, en el orden
 * de la lista. Cada uno lleva su moneda: no se suman entre monedas.
 */
export function pagosEnAnuladas(
  invoices: Pick<PortalInvoiceRow, "status" | "code" | "shipmentCode" | "paid" | "currency">[],
): PagoEnAnulada[] {
  return invoices
    .filter((inv) => esAnulada(inv) && inv.paid > 0)
    .map((inv) => ({
      code: inv.code,
      reference: inv.shipmentCode,
      amount: inv.paid,
      currency: inv.currency,
    }));
}

/**
 * La nota de los pagos en anuladas — UN solo texto para Facturas, Finanzas, el
 * estado de cuenta del portal y su PDF. `null` si no hay pagos que informar.
 *
 * Los montos se agrupan por moneda (nunca se suman entre monedas) y se citan
 * los códigos. No dice «saldo a favor»: hoy no existe (decisión del
 * 2026-09-18).
 */
export function notaPagosEnAnuladas(pagos: PagoEnAnulada[]): string | null {
  if (pagos.length === 0) return null;
  const porMoneda = new Map<InvoiceCurrency, number>();
  for (const p of pagos) porMoneda.set(p.currency, (porMoneda.get(p.currency) ?? 0) + p.amount);
  const montos = [...porMoneda.entries()].map(([currency, amount]) =>
    formatInvoiceAmount(amount, currency),
  );
  const monto =
    montos.length === 1 ? montos[0] : `${montos.slice(0, -1).join(", ")} y ${montos.at(-1)}`;
  const codigos = [...new Set(pagos.map((p) => p.code))].join(", ");
  return (
    `Recibimos ${monto} en pagos de facturas que después se anularon (${codigos}). ` +
    "No se descuentan de tu saldo pendiente: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución."
  );
}

/** Las cifras de la cuenta del cliente, ya en la moneda dominante. */
export type ResumenDeCuenta = {
  currency: InvoiceCurrency;
  /** ¿Hay facturas vigentes en más de una moneda? */
  mixedCurrencies: boolean;
  /** Σ total de las no anuladas de la moneda dominante. */
  facturado: number;
  /** Σ pagado de las no anuladas de la moneda dominante. */
  pagado: number;
  /** Σ lo que falta pagar (recortado a 0 por factura) en la moneda dominante. */
  porPagar: number;
  /**
   * Cuántas facturas no anuladas tienen algo por pagar, en TODAS las monedas
   * (es un conteo, no un monto: mismo criterio que tenía Inicio).
   */
  facturasPorPagar: number;
  /** Pagos en anuladas, de todas las monedas. No se descuentan de nada. */
  pagosEnAnuladas: PagoEnAnulada[];
};

/**
 * El resumen de la cuenta. El ledger (`buildStatementLedger`) usa los mismos
 * helpers, y una prueba de contrato ata `facturado`/`pagado` a su
 * `totalCargo`/`totalAbono`.
 */
export function resumenDeCuenta(invoices: PortalInvoiceRow[]): ResumenDeCuenta {
  const { currency, mixed } = monedaDominante(invoices);
  const vigentes = invoices.filter((inv) => !esAnulada(inv));
  const enMoneda = vigentes.filter((inv) => inv.currency === currency);
  return {
    currency,
    mixedCurrencies: mixed,
    facturado: enMoneda.reduce((s, inv) => s + inv.total, 0),
    pagado: enMoneda.reduce((s, inv) => s + inv.paid, 0),
    porPagar: enMoneda.reduce((s, inv) => s + saldoPorPagar(inv), 0),
    facturasPorPagar: vigentes.filter((inv) => saldoPorPagar(inv) > 0).length,
    pagosEnAnuladas: pagosEnAnuladas(invoices),
  };
}
