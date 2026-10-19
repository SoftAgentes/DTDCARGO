/**
 * Estado de cuenta del portal — libro de movimientos (SDD-0177).
 *
 * Deriva un ledger de cargos/abonos con saldo corrido a partir de las facturas
 * que ya trae `listMyInvoices`. **Función pura**: sin red, sin Supabase, sin
 * `Date.now()` — todo lo que decide sale de los argumentos, así el test la fija
 * sin fixtures de DB.
 *
 * NO HAY TABLA DE MOVIMIENTOS. El modelo del ERP guarda `total_amount` y
 * `paid_amount` en la factura, no un asiento por pago. El ledger es una LECTURA
 * de eso, no una fuente nueva: por construcción el saldo final cuadra con
 * Σ(total) − Σ(paid) de las facturas NO anuladas de esa moneda.
 *
 * ANULADAS (SDD-0556): siguen en el libro como una fila «Factura F-… · anulada»
 * con cargo 0 y sin abono, así que no mueven el saldo. Lo que se pagó en ellas
 * no desaparece: sale aparte en `voidedPayments`, de todas las monedas, y NO se
 * descuenta del saldo (no hay saldo a favor; regla «estricta» del 2026-09-18).
 * La moneda dominante sale de `saldo-de-cuenta.ts`, la misma definición que
 * usan los KPIs.
 *
 * ⚠️ LA FECHA DEL ABONO ES LA DE VENCIMIENTO, NO LA DEL PAGO.
 * Es el modelo del Norte (`_norte/portal/app.jsx` · `StatementLedger`) y lo
 * decidió el founder el 2026-07-29 sabiendo el desvío: la factura no registra
 * CUÁNDO se pagó, solo cuánto. La alternativa (derivar los abonos de
 * `payment_reports.paid_at`, que sí tienen fecha real) se evaluó y se descartó.
 * Consecuencia visible: un abono puede aparecer con fecha futura si su factura
 * aún no vence. Por eso la tabla lleva una nota al pie que lo dice — si algún día
 * se cambia el criterio, esa nota se va con él.
 */
import type { InvoiceCurrency, PortalInvoiceRow } from "./portal-types";
import {
  esAnulada,
  monedaDominante,
  pagosEnAnuladas,
  sobrepago,
  type PagoEnAnulada,
} from "./saldo-de-cuenta";

/** Un movimiento del estado de cuenta. */
export type StatementMove = {
  /** `YYYY-MM-DD`, o `null` si la factura no tiene la fecha que corresponde. */
  date: string | null;
  kind: "cargo" | "abono";
  /** "Factura F-2026-0007" / "Abono · F-2026-0007" / "Factura F-2026-0007 · anulada". */
  concept: string;
  /** Código de envío asociado, si lo hay. */
  reference: string | null;
  /** Monto SIEMPRE positivo; el signo lo pone `kind`. */
  amount: number;
  /** Saldo corrido DESPUÉS de aplicar este movimiento. */
  balance: number;
};

/** Un pago recibido en una factura anulada (ver `saldo-de-cuenta.ts`). */
export type StatementVoidedPayment = PagoEnAnulada;

export type StatementLedger = {
  moves: StatementMove[];
  /** Σ total de las facturas NO anuladas de la moneda del ledger. */
  totalCargo: number;
  /** Σ pagado de las facturas NO anuladas de la moneda del ledger. */
  totalAbono: number;
  /**
   * `totalCargo − totalAbono`. Puede ser negativo si hubo sobrepago. Es
   * `porPagar − sobrepagos` de `resumenDeCuenta` (prueba de contrato).
   */
  balance: number;
  /**
   * Σ lo pagado de más (`sobrepago`) en las NO anuladas de la moneda del
   * ledger. El saldo neto ya lo resta; la pantalla y el PDF lo dicen con
   * `notaSobrepagos` (SDD-0556).
   */
  sobrepagos: number;
  /**
   * Moneda en la que está expresado TODO el ledger (`monedaDominante`): la de
   * mayor saldo por pagar y, si nada se debe, la de mayor total facturado
   * entre las no anuladas. Es la misma de los KPIs. Sumar entre monedas es
   * incorrecto, y un saldo corrido que mezcla USD con EUR es peor que no
   * mostrarlo.
   */
  currency: InvoiceCurrency;
  /** ¿Había facturas vigentes en otras monedas que quedaron fuera? */
  mixedCurrencies: boolean;
  /**
   * Pagos recibidos en facturas anuladas, de TODAS las monedas, cada uno con la
   * suya. No entran al saldo: se informan aparte.
   */
  voidedPayments: StatementVoidedPayment[];
};

/**
 * Orden de los movimientos: por fecha ascendente.
 *
 * Dos reglas que el Norte no necesita y acá sí:
 *
 * 1. **Las fechas nulas van al FINAL.** `issuedAt`/`dueDate` son nullable en el
 *    repo (en el Norte siempre venían). Un `null` que ordena como "" se iría al
 *    principio y arrancaría el saldo corrido con un movimiento sin fecha.
 * 2. **A igual fecha, el cargo va ANTES que su abono.** El Norte lo resuelve
 *    sumando 1 milisegundo al timestamp del abono; acá las fechas son `date`
 *    (`YYYY-MM-DD`), no timestamps, así que el desempate es explícito por tipo.
 *    Sin esto, una factura emitida y pagada el mismo día mostraría el abono
 *    primero y un saldo corrido en negativo que después "se arregla".
 */
function compareMoves(a: StatementMove, b: StatementMove): number {
  if (a.date === null && b.date === null) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind === b.kind) return 0;
  return a.kind === "cargo" ? -1 : 1;
}

/**
 * Arma el estado de cuenta de la moneda dominante.
 *
 * Cada factura aporta un cargo (+ `total`, fechado en `issuedAt`) y, si tiene
 * algo pagado, un abono (− `paid`, fechado en `dueDate` — ver el ⚠️ de arriba).
 * Una anulada aporta sólo su fila de cargo en 0 (SDD-0556).
 *
 * Se asume que `invoices` YA viene sin borradores ni borradas: `listMyInvoices`
 * filtra `status <> 'borrador'` y `deleted_at is null` en la query, y saca las
 * anuladas que nunca se emitieron. Si algún día entra un borrador acá,
 * aparecería como cargo — el filtro vive en la query a propósito (una sola
 * definición de "factura del cliente"), no duplicado acá.
 */
export function buildStatementLedger(
  invoices: PortalInvoiceRow[],
): StatementLedger {
  const { currency, mixed } = monedaDominante(invoices);
  const scoped = invoices.filter((inv) => inv.currency === currency);
  const vigentes = scoped.filter((inv) => !esAnulada(inv));

  const moves: StatementMove[] = [];
  for (const inv of scoped) {
    if (esAnulada(inv)) {
      // Se ve en el libro, pero no es deuda: cargo 0 y sin abono. Lo pagado en
      // ella va a `voidedPayments`, no a la columna Abono.
      moves.push({
        date: inv.issuedAt,
        kind: "cargo",
        concept: `Factura ${inv.code} · anulada`,
        reference: inv.shipmentCode,
        amount: 0,
        balance: 0,
      });
      continue;
    }
    moves.push({
      date: inv.issuedAt,
      kind: "cargo",
      concept: `Factura ${inv.code}`,
      reference: inv.shipmentCode,
      amount: inv.total,
      balance: 0, // se completa abajo, cuando el orden está fijado
    });
    if (inv.paid > 0) {
      moves.push({
        date: inv.dueDate,
        kind: "abono",
        concept: `Abono · ${inv.code}`,
        reference: inv.shipmentCode,
        amount: inv.paid,
        balance: 0,
      });
    }
  }

  moves.sort(compareMoves);

  let running = 0;
  for (const m of moves) {
    running += m.kind === "cargo" ? m.amount : -m.amount;
    m.balance = running;
  }

  const totalCargo = vigentes.reduce((s, inv) => s + inv.total, 0);
  const totalAbono = vigentes.reduce((s, inv) => s + inv.paid, 0);
  const sobrepagos = vigentes.reduce((s, inv) => s + sobrepago(inv), 0);

  return {
    moves,
    totalCargo,
    totalAbono,
    balance: totalCargo - totalAbono,
    sobrepagos,
    currency,
    mixedCurrencies: mixed,
    voidedPayments: pagosEnAnuladas(invoices),
  };
}
