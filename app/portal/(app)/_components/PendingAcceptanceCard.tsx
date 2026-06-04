import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import type { InvoiceCurrency } from "@/lib/portal/portal-types";
import type { PendingAcceptanceInvoice } from "@/lib/portal/portal-legal-queries";

/**
 * Card de descubrimiento de órdenes pendientes de aceptar T&C (SDD-0054 · Slice
 * C). El borrador NO aparece en "Mis facturas" (el portal lo oculta), así que
 * esta es la única vía por la que el cliente lo ve. Tono de ATENCIÓN (dorado
 * --warning, no wine). Si hay 1 → CTA directo a esa orden; si hay varias → lista.
 */
export function PendingAcceptanceCard({
  pending,
}: {
  pending: PendingAcceptanceInvoice[];
}) {
  if (pending.length === 0) return null;

  const count = pending.length;
  const single = count === 1 ? pending[0] : null;
  const warn = "var(--color-status-warning)";

  return (
    <div
      className="card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-7"
      style={{ borderLeftColor: warn }}
    >
      <div className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: warn }}>
        Pendiente de tu aceptación
      </div>
      <div className="mt-2.5 text-[16px] font-bold text-ink">
        {count === 1
          ? "Tenés 1 orden esperando tu aceptación de T&C."
          : `Tenés ${count} órdenes esperando tu aceptación de T&C.`}
      </div>
      <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] max-w-[56ch]">
        Para que podamos emitir tu factura de puerta a puerta DDP (prepago),
        necesitamos que confirmes el monto y aceptes los términos vigentes.
      </p>

      {single ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span
            className="text-[15px] font-semibold text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            {single.shipmentCode ?? single.code}
          </span>
          <span
            className="text-[14px] font-bold text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            {formatInvoiceAmount(single.totalAmount, single.currency as InvoiceCurrency)}
          </span>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.code}>
              <Link
                href={`/portal/facturas/${encodeURIComponent(p.code)}/aceptar`}
                className="card-link group flex items-center justify-between gap-3 rounded-[12px] border border-grey-200 px-4 py-3 hover:border-ink transition-colors"
              >
                <span
                  className="text-[14px] font-semibold text-ink"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  }}
                >
                  {p.shipmentCode ?? p.code}
                </span>
                <span className="flex items-center gap-2.5">
                  <span
                    className="text-[13.5px] font-bold text-ink"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    }}
                  >
                    {formatInvoiceAmount(p.totalAmount, p.currency as InvoiceCurrency)}
                  </span>
                  <ArrowIcon size={15} className="text-grey-300 group-hover:text-wine transition-colors" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {single ? (
        <Link
          href={`/portal/facturas/${encodeURIComponent(single.code)}/aceptar`}
          className="btn btn-primary mt-5 inline-flex items-center gap-2"
        >
          Revisar y aceptar <ArrowIcon size={15} />
        </Link>
      ) : null}
    </div>
  );
}
