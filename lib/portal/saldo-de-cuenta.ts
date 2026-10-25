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
 * - Una anulada **no decide** la moneda dominante. Si hay deuda, la moneda
 *   dominante es la que la lleva (ver `monedaDominante`).
 * - Un **sobrepago** no es deuda negativa: «Saldo pendiente» recorta cada
 *   factura a 0, y el libro, que da el neto, explica la diferencia con
 *   `notaSobrepagos`.
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
 * Lo pagado de más en UNA factura vigente: `pagado − total` si es positivo; 0
 * si no. Una anulada da 0: lo que se le pagó va en `pagosEnAnuladas`.
 *
 * Con `saldoPorPagar` cuadra el libro: `total − pagado = saldoPorPagar −
 * sobrepago` en cada factura vigente, así que el saldo neto del estado de
 * cuenta es `porPagar − sobrepagos` (SDD-0556).
 */
export function sobrepago(
  inv: Pick<PortalInvoiceRow, "status" | "total" | "paid">,
): number {
  if (esAnulada(inv)) return 0;
  return Math.max(0, -invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid }));
}

/**
 * La moneda DOMINANTE. Sumar entre monedas es incorrecto, así que las cifras
 * se dan en una sola y se avisa si hay otras. Se elige en este orden:
 *
 * 1. Entre las monedas con algo por pagar, la de mayor saldo por pagar. Así,
 *    si hay deuda, la moneda de las cifras la lleva: Inicio no puede decir
 *    «al día» en VES mientras el cliente debe en USD.
 * 2. Si ninguna debe nada, la de mayor total facturado entre las NO anuladas.
 * 3. A igual peso gana la moneda que tenga facturas vigentes y, después, la
 *    que aparece primero en la lista.
 *
 * - Si todas están anuladas, la de la primera fila; sin filas, USD.
 * - `mixed` cuenta sólo las monedas con facturas vigentes: una anulada en otra
 *   moneda no dispara el aviso de «otras monedas».
 * - Los montos de dos monedas se comparan por su número, sin tasa: el portal
 *   no tiene una tasa común para todas. Por eso el paso 1 importa: la moneda
 *   elegida puede no ser «la más grande», pero nunca deja la deuda afuera.
 */
export function monedaDominante(
  invoices: Pick<PortalInvoiceRow, "status" | "currency" | "total" | "paid">[],
): { currency: InvoiceCurrency; mixed: boolean } {
  const stats = new Map<
    InvoiceCurrency,
    { deuda: number; peso: number; vivas: number; orden: number }
  >();
  for (const inv of invoices) {
    const e = stats.get(inv.currency) ?? { deuda: 0, peso: 0, vivas: 0, orden: stats.size };
    if (!esAnulada(inv)) {
      e.deuda += saldoPorPagar(inv);
      e.peso += inv.total;
      e.vivas += 1;
    }
    stats.set(inv.currency, e);
  }
  const ranked = [...stats.entries()].sort(
    ([, a], [, b]) =>
      b.deuda - a.deuda ||
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
 * Qué hacer con lo pagado en una anulada — UNA sola indicación para todo el
 * portal (SDD-0556): la usan `notaPagosEnAnuladas` (Facturas, Finanzas, el
 * estado de cuenta y su PDF), el detalle de la factura y su comprobante. Si
 * cambia la regla (por ejemplo, si deja de ofrecerse la devolución), se cambia
 * acá y en ningún otro lado; una prueba revisa que ninguna pantalla la escriba
 * a mano.
 *
 * Hoy no hay saldo a favor ni nota de crédito para aplicar ese dinero (regla
 * «estricta» del 2026-09-18): lo resuelve el asesor.
 *
 * - `singular`: «aplicarlo», cuando la frase habla de un pago («lo que
 *   pagaste»); por omisión, «aplicarlos».
 * - `inicioDeFrase`: con mayúscula inicial, cuando abre una oración.
 */
export function indicacionPagosEnAnuladas(
  forma: { singular?: boolean; inicioDeFrase?: boolean } = {},
): string {
  const texto = `escríbele a tu asesor para ${
    forma.singular ? "aplicarlo" : "aplicarlos"
  } a otra factura o pedir su devolución`;
  return forma.inicioDeFrase ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

/**
 * La nota de los pagos en anuladas — UN solo texto para Facturas, Finanzas, el
 * estado de cuenta del portal y su PDF. `null` si no hay pagos que informar.
 *
 * Los montos se agrupan por moneda (nunca se suman entre monedas) y se citan
 * los códigos. No dice «saldo a favor»: hoy no existe (decisión del
 * 2026-09-18). La indicación final sale de `indicacionPagosEnAnuladas`.
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
    `No se descuentan de tu saldo pendiente: ${indicacionPagosEnAnuladas()}.`
  );
}

/**
 * Dónde sale la nota de sobrepagos, porque cada lugar muestra otra cifra:
 * - `libro`: el estado de cuenta y su PDF dan el neto (`total − pagado`), que
 *   ya resta lo pagado de más. La nota dice cuánto falta pagar de verdad
 *   (`porPagar`), para que el cliente no pague de menos.
 * - `kpis`: Facturas y Finanzas muestran «Pagado» con el sobrepago incluido y
 *   «Saldo pendiente» recortado por factura. La nota explica por qué
 *   facturado − pagado no da el saldo.
 */
export type DondeNotaSobrepagos =
  | { donde: "libro"; porPagar: number }
  | { donde: "kpis" };

/**
 * La nota de los sobrepagos — UN solo texto para Facturas, Finanzas, el
 * estado de cuenta del portal y su PDF. `null` si no hay nada pagado de más.
 *
 * Por qué existe: el KPI «Saldo pendiente» recorta cada factura a 0 (lo que
 * falta pagar) y el libro da el neto, que resta lo pagado de más. Con un
 * sobrepago las cifras difieren justo en `sobrepagos`, y esta nota lo dice al
 * lado de cada una en vez de dejar al cliente con dos saldos sin explicación
 * (SDD-0556). Hoy no hay saldo a favor (decisión del 2026-09-18): la salida es
 * la misma indicación que para lo pagado en anuladas.
 */
export function notaSobrepagos(
  sobrepagos: number,
  currency: InvoiceCurrency,
  lugar: DondeNotaSobrepagos,
): string | null {
  if (!(sobrepagos > 0)) return null;
  const deMas = formatInvoiceAmount(sobrepagos, currency);
  if (lugar.donde === "libro") {
    return (
      `Este saldo ya descuenta ${deMas} pagados de más en facturas ya pagadas. ` +
      `Mientras no se apliquen, lo que falta pagar es ${formatInvoiceAmount(lugar.porPagar, currency)}: ` +
      `${indicacionPagosEnAnuladas()}.`
    );
  }
  return (
    `«Pagado» incluye ${deMas} pagados de más en facturas ya pagadas, que no se descuentan ` +
    `de tu saldo pendiente: ${indicacionPagosEnAnuladas()}.`
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
   * Σ lo pagado de más (`sobrepago`) en las no anuladas de la moneda dominante.
   * El saldo neto del libro es `porPagar − sobrepagos`; una prueba de contrato
   * lo fija.
   */
  sobrepagos: number;
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
 * helpers, y una prueba de contrato ata `facturado`/`pagado`/`sobrepagos` a su
 * `totalCargo`/`totalAbono`/`sobrepagos`, y su saldo a `porPagar − sobrepagos`.
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
    sobrepagos: enMoneda.reduce((s, inv) => s + sobrepago(inv), 0),
    facturasPorPagar: vigentes.filter((inv) => saldoPorPagar(inv) > 0).length,
    pagosEnAnuladas: pagosEnAnuladas(invoices),
  };
}
