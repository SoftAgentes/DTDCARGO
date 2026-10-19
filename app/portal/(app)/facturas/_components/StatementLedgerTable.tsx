import {
  buildStatementLedger,
  type StatementMove,
} from "@/lib/portal/statement-ledger";
import {
  formatInvoiceAmount,
  type PortalInvoiceRow,
} from "@/lib/portal/portal-types";
import { notaPagosEnAnuladas, notaSobrepagos } from "@/lib/portal/saldo-de-cuenta";
import { DocIcon, CheckIcon } from "@/components/Icon";

/**
 * Anchos MEDIDOS, no estimados (Playwright + `getBoundingClientRect`, con la
 * tipografía real de la tabla — JetBrains Mono 12.5px/700):
 *
 *   `−USD 128,450.00`   → 105px      `VES 12,845,000.00` → 115px
 *   `USDT 1,284,500.00` → 116px      `DTD-2026-0311`     →  86px
 *   `29 jul 26`         →  44px
 *
 * Con las columnas de monto en 100px (primer intento, a ojo) un consolidado de
 * seis cifras partía el monto en dos líneas y la fila crecía a 72px de alto. Las
 * de monto van en 124px y llevan `whitespace-nowrap`: si algún día entra un
 * número más largo, desborda a la vista en lugar de re-maquetar la fila en
 * silencio.
 */
const COLS = "grid-cols-[76px_minmax(0,1fr)_100px_124px_124px_132px]";
const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Estado de cuenta · libro de movimientos (SDD-0177 · brecha 4 de la Fase 7).
 *
 * Server component: no tiene estado. Alternar con la lista de facturas es un
 * `?vista=` en la URL, no `useState` — así la vista se comparte por link y no
 * baja JS de más a una pantalla que sólo lee.
 *
 * CONTRASTE (medido con `getComputedStyle` + fórmula WCAG en los DOS temas, no
 * mirado — BRAND §♿). El Norte pinta la columna Abono con `--success`; acá NO:
 * `--color-status-success` mide 4.33:1 sobre papel claro, bajo el umbral de body.
 * Los montos van en `--color-ink` (16.49 claro / 13.08 oscuro) y la distinción
 * cargo↔abono la llevan **el signo `−`, la columna y el ícono**, no el color
 * solo (WCAG 1.4.1). El saldo final usa `--color-wine-text` (BD-026 · 10.13 /
 * 7.93), que es wine COMO TEXTO y no voltea en el portal oscuro.
 */
export function StatementLedgerTable({
  invoices,
}: {
  invoices: PortalInvoiceRow[];
}) {
  const ledger = buildStatementLedger(invoices);

  if (ledger.moves.length === 0) {
    return (
      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
        <div className="text-[15px] font-bold text-ink">
          Sin movimientos todavía.
        </div>
        <p className="mt-2 text-[13.5px] text-grey-700 max-w-[42ch] mx-auto leading-[1.55]">
          Cuando tu asesor emita tu primera factura, acá vas a ver el detalle de
          cargos, abonos y saldo.
        </p>
      </div>
    );
  }

  const money = (n: number) => formatInvoiceAmount(n, ledger.currency);
  // SDD-0556 · las anuladas salen en el libro con cargo 0. Lo que se pagó en
  // ellas no entra al saldo, pero no se esconde: va en esta nota, con el MISMO
  // texto que los KPIs de Facturas y Finanzas y el PDF.
  const notaAnuladas = notaPagosEnAnuladas(ledger.voidedPayments);
  // El libro da el neto y el KPI «Saldo pendiente» recorta cada factura a 0:
  // con un sobrepago difieren justo en esto, y la nota lo dice (SDD-0556).
  const notaDeMas = notaSobrepagos(ledger.sobrepagos, ledger.currency);

  return (
    <>
      {ledger.mixedCurrencies ? (
        <p className="mt-6 text-[12.5px] text-grey-700">
          Movimientos en {ledger.currency}. Tienes facturas en otras monedas —
          ábrelas desde la lista para ver su detalle.
        </p>
      ) : null}

      {/* Escritorio: la tabla del Norte. En móvil scrollea horizontal dentro de
          su propia caja — un libro de 6 columnas no se apila sin mentir sobre el
          saldo corrido. */}
      <div className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Encabezado */}
            <div
              className={`grid ${COLS} items-center gap-3 px-5 py-3 border-b border-grey-200`}
              style={{ background: "var(--color-paper)" }}
            >
              {["Fecha", "Concepto", "Referencia", "Cargo", "Abono", "Saldo"].map(
                (h, i) => (
                  <span
                    key={h}
                    className={`text-[10px] font-bold tracking-[0.1em] uppercase text-grey-700 ${
                      i >= 3 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </span>
                ),
              )}
            </div>

            {ledger.moves.map((m, i) => (
              <LedgerRow key={`${m.concept}-${m.kind}-${i}`} move={m} money={money} />
            ))}

            {/* Totales */}
            <div
              className={`grid ${COLS} items-center gap-3 px-5 py-3.5 border-t-2 border-grey-300`}
              style={{ background: "var(--color-paper)" }}
            >
              <span className="col-span-3 text-[10px] font-bold tracking-[0.1em] uppercase text-grey-700">
                Totales
              </span>
              <span
                className="text-right text-[12.5px] font-bold text-ink whitespace-nowrap"
                style={{ fontFamily: MONO }}
              >
                {money(ledger.totalCargo)}
              </span>
              <span
                className="text-right text-[12.5px] font-bold text-ink whitespace-nowrap"
                style={{ fontFamily: MONO }}
              >
                {ledger.totalAbono > 0 ? `−${money(ledger.totalAbono)}` : "—"}
              </span>
              <span
                className="text-right text-[13px] font-bold whitespace-nowrap"
                style={{
                  fontFamily: MONO,
                  color:
                    ledger.balance > 0
                      ? "var(--color-wine-text)"
                      : "var(--color-ink)",
                }}
              >
                {money(ledger.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {notaDeMas ? (
        <p className="mt-3 text-[12px] text-grey-700 leading-[1.5] max-w-[64ch]">
          {notaDeMas}
        </p>
      ) : null}

      {notaAnuladas ? (
        <p className="mt-3 text-[12px] text-grey-700 leading-[1.5] max-w-[64ch]">
          {notaAnuladas}
        </p>
      ) : null}

      {/* La columna Abono NO lleva la fecha en que pagaste — la factura registra
          cuánto se pagó, no cuándo. Decirlo evita que el cliente lea una fecha
          de pago que no existe. */}
      <p className="mt-3 text-[12px] text-grey-700 leading-[1.5] max-w-[64ch]">
        Los abonos se ubican en la fecha de vencimiento de su factura. Para ver
        cuándo se registró un pago, abre la factura y revisa sus reportes de pago.
      </p>
    </>
  );
}

function LedgerRow({
  move,
  money,
}: {
  move: StatementMove;
  money: (n: number) => string;
}) {
  const esCargo = move.kind === "cargo";
  return (
    <div
      className={`grid ${COLS} items-center gap-3 px-5 py-3 border-b border-grey-200 last:border-0`}
    >
      <span
        className="text-[11.5px] font-semibold text-grey-700 whitespace-nowrap"
        style={{ fontFamily: MONO }}
      >
        {formatDate(move.date)}
      </span>

      <span className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-[22px] h-[22px] rounded-[6px] shrink-0 grid place-items-center"
          style={{
            background: esCargo
              ? "color-mix(in srgb, var(--color-wine) 12%, transparent)"
              : "color-mix(in srgb, var(--color-status-success) 14%, transparent)",
            color: esCargo
              ? "var(--color-wine-text)"
              : "var(--color-status-success)",
          }}
          aria-hidden="true"
        >
          {esCargo ? <DocIcon size={12} /> : <CheckIcon size={12} />}
        </span>
        <span className="text-[12.5px] font-semibold text-ink truncate">
          {move.concept}
        </span>
      </span>

      <span
        className="text-[11.5px] font-semibold text-grey-700 truncate"
        style={{ fontFamily: MONO }}
      >
        {move.reference ?? "—"}
      </span>

      <span
        className="text-right text-[12.5px] font-bold text-ink whitespace-nowrap"
        style={{ fontFamily: MONO }}
      >
        {esCargo ? money(move.amount) : "—"}
      </span>
      <span
        className="text-right text-[12.5px] font-bold text-ink whitespace-nowrap"
        style={{ fontFamily: MONO }}
      >
        {esCargo ? "—" : `−${money(move.amount)}`}
      </span>
      <span
        className="text-right text-[12.5px] font-bold text-ink whitespace-nowrap"
        style={{ fontFamily: MONO }}
      >
        {money(move.balance)}
      </span>
    </div>
  );
}
