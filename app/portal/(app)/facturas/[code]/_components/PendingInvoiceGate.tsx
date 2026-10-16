import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import type { PendingAcceptanceDetail } from "@/lib/portal/portal-legal-queries";
import { formatInvoiceAmount, type InvoiceCurrency } from "@/lib/portal/portal-types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * SDD-0543 · Lo que ve el cliente al abrir una factura que todavía está en
 * borrador esperando su aceptación de T&C. Antes era un 404: con los
 * contenedores en camino, el cliente llega acá desde el estado de cuenta y tiene
 * que entender que la factura existe, cuánto es y qué le falta para verla.
 *
 * Muestra el monto y el embarque (lo mismo que la tarjeta de la portada) y
 * NADA del desglose: los conceptos se abren cuando acepta. Tono de ATENCIÓN
 * (borde dorado), igual que `PendingAcceptanceCard`.
 */
export function PendingInvoiceGate({ pendiente }: { pendiente: PendingAcceptanceDetail }) {
  const currency = pendiente.currency as InvoiceCurrency;
  const aceptar = `/portal/facturas/${encodeURIComponent(pendiente.code)}/aceptar`;
  return (
    <div>
      <Link
        href="/portal/facturas"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis facturas
      </Link>

      <div className="mt-5">
        <span className="eyebrow">Factura por aceptar</span>
        <div
          className="mt-2 text-[30px] sm:text-[40px] leading-none text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
        >
          {pendiente.code}
        </div>
      </div>

      <div
        className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-8 max-w-[640px]"
        style={{ borderLeftColor: "var(--color-status-warning)" }}
      >
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-grey-700">
          Pendiente de tu aceptación
        </div>
        <h2 className="mt-2.5 text-[18px] font-bold text-ink leading-[1.3]">
          Tienes que aceptar los T&amp;C del portal para ver el detalle de esta factura.
        </h2>
        <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55] max-w-[56ch]">
          La factura ya está preparada con el monto de tu carga. Al aceptar los términos
          vigentes la emitimos y acá vas a ver sus conceptos, el PDF y cómo reportar tu pago.
        </p>

        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-700">Monto</dt>
            <dd className="mt-1 text-[16px] font-bold text-ink" style={{ fontFamily: MONO }}>
              {formatInvoiceAmount(pendiente.totalAmount, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-700">Embarque</dt>
            <dd className="mt-1 text-[14px] font-semibold text-ink" style={{ fontFamily: MONO }}>
              {pendiente.shipmentCode ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-700">Medida</dt>
            <dd className="mt-1 text-[14px] font-semibold text-ink" style={{ fontFamily: MONO }}>
              {pendiente.cbm != null ? `${pendiente.cbm} m³` : "—"}
              {pendiente.weightKg != null ? ` · ${pendiente.weightKg} kg` : ""}
            </dd>
          </div>
        </dl>

        <Link href={aceptar} className="btn btn-primary mt-6 inline-flex items-center gap-2">
          Revisar y aceptar <ArrowIcon size={15} />
        </Link>
      </div>
    </div>
  );
}
