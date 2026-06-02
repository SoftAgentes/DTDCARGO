import Link from "next/link";
import {
  formatInvoiceAmount,
  invoiceBalance,
  type PortalInvoiceRow,
} from "@/lib/portal/portal-types";
import { ArrowIcon } from "@/components/Icon";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Fila read-only de "Mis facturas". Toda la card linkea al detalle
 * (`/portal/facturas/[code]`). Muestra total, saldo pendiente (si hay) y el
 * envío asociado (si la factura está ligada a uno).
 */
export function InvoiceRow({ invoice }: { invoice: PortalInvoiceRow }) {
  const balance = invoiceBalance({
    total_amount: invoice.total,
    paid_amount: invoice.paid,
  });

  return (
    <Link
      href={`/portal/facturas/${encodeURIComponent(invoice.code)}`}
      className="card-link group bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 transition-colors hover:border-ink focus-visible:border-ink"
      aria-label={`Ver detalle de la factura ${invoice.code}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {invoice.code}
          </span>
          <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />
        </div>
        <div className="mt-1.5 text-[13.5px] text-grey-700">
          <span className="text-grey-500">Total</span>{" "}
          <span className="font-semibold text-ink">
            {formatInvoiceAmount(invoice.total, invoice.currency)}
          </span>
          {balance > 0 ? (
            <>
              {" · "}
              <span className="text-grey-500">Saldo</span>{" "}
              <span className="font-semibold text-ink">
                {formatInvoiceAmount(balance, invoice.currency)}
              </span>
            </>
          ) : null}
        </div>
        {invoice.shipmentCode ? (
          <div
            className="mt-0.5 text-[13px] text-grey-500"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            Envío {invoice.shipmentCode}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 sm:justify-end">
        <span className="text-[12px] text-grey-500">
          {invoice.issuedAt ? `Emitida ${formatDate(invoice.issuedAt)}` : "Sin emitir"}
        </span>
        <ArrowIcon
          className="text-grey-300 transition-colors group-hover:text-wine"
          size={18}
        />
      </div>
    </Link>
  );
}
