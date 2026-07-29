/**
 * Estado de cuenta del portal — libro de movimientos (SDD-0175).
 *
 * Deriva un ledger de cargos/abonos con saldo corrido a partir de las facturas
 * que ya trae `listMyInvoices`. **Función pura**: sin red, sin Supabase, sin
 * `Date.now()` — todo lo que decide sale de los argumentos, así el test la fija
 * sin fixtures de DB.
 *
 * NO HAY TABLA DE MOVIMIENTOS. El modelo del ERP guarda `total_amount` y
 * `paid_amount` en la factura, no un asiento por pago. El ledger es una LECTURA
 * de eso, no una fuente nueva: por construcción el saldo final cuadra con
 * Σ(total) − Σ(paid) de las facturas de esa moneda.
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

/** Un movimiento del estado de cuenta. */
export type StatementMove = {
  /** `YYYY-MM-DD`, o `null` si la factura no tiene la fecha que corresponde. */
  date: string | null;
  kind: "cargo" | "abono";
  /** "Factura F-2026-0007" / "Abono · F-2026-0007". */
  concept: string;
  /** Código de envío asociado, si lo hay. */
  reference: string | null;
  /** Monto SIEMPRE positivo; el signo lo pone `kind`. */
  amount: number;
  /** Saldo corrido DESPUÉS de aplicar este movimiento. */
  balance: number;
};

export type StatementLedger = {
  moves: StatementMove[];
  totalCargo: number;
  totalAbono: number;
  /** `totalCargo − totalAbono`. Puede ser negativo si hubo sobrepago. */
  balance: number;
  /** Moneda en la que está expresado TODO el ledger. */
  currency: InvoiceCurrency;
  /** ¿Había facturas en otras monedas que quedaron fuera? */
  mixedCurrencies: boolean;
};

/**
 * La moneda DOMINANTE = la de mayor total facturado. Mismo criterio que los KPIs
 * de `/portal/finanzas` y `/portal/facturas`: sumar entre monedas es incorrecto,
 * y un saldo corrido que mezcla USD con EUR es peor que no mostrarlo.
 */
function dominantCurrency(invoices: PortalInvoiceRow[]): {
  currency: InvoiceCurrency;
  mixed: boolean;
} {
  const totals = new Map<InvoiceCurrency, number>();
  for (const inv of invoices) {
    totals.set(inv.currency, (totals.get(inv.currency) ?? 0) + inv.total);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return {
    currency: ranked[0]?.[0] ?? "USD",
    mixed: ranked.length > 1,
  };
}

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
 *
 * Se asume que `invoices` YA viene sin borradores ni borradas: `listMyInvoices`
 * filtra `status <> 'borrador'` y `deleted_at is null` en la query. Si algún día
 * entra un borrador acá, aparecería como cargo — el filtro vive en la query a
 * propósito (una sola definición de "factura del cliente"), no duplicado acá.
 */
export function buildStatementLedger(
  invoices: PortalInvoiceRow[],
): StatementLedger {
  const { currency, mixed } = dominantCurrency(invoices);
  const scoped = invoices.filter((inv) => inv.currency === currency);

  const moves: StatementMove[] = [];
  for (const inv of scoped) {
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

  const totalCargo = scoped.reduce((s, inv) => s + inv.total, 0);
  const totalAbono = scoped.reduce((s, inv) => s + inv.paid, 0);

  return {
    moves,
    totalCargo,
    totalAbono,
    balance: totalCargo - totalAbono,
    currency,
    mixedCurrencies: mixed,
  };
}
