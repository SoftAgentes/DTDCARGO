import { Fragment } from "react";
import { ArrowIcon } from "@/components/Icon";

/**
 * Card "TU CICLO · Estimado → Aprobado → Facturado" (Norte `PortalInvoices`, idea
 * del founder "ciclo dinámico del cliente"). GATEADA al demo. Muestra el recorrido
 * del cliente con números grandes: cuántos estimados pidió, cuántos están aprobados
 * (en proceso) y cuántos ya se facturaron. Datos reales (estimates/shipments/
 * invoices); honesta en cero.
 */
export function InvoiceCycleCard({
  estimatesCount,
  approvedCount,
  invoicesCount,
  invoicedLabel,
}: {
  estimatesCount: number;
  approvedCount: number;
  invoicesCount: number;
  /** Total facturado ya formateado (moneda dominante), o "—" si no hay. */
  invoicedLabel: string;
}) {
  // Los 3 números en tinta neutra (`--color-ink`, que el tema recalcula por modo →
  // lee igual en claro/oscuro); SOLO el cierre del ciclo (Facturados) va en verde
  // "logrado". Evita una escala de color semántica que no existe (wine no es
  // "in-progress") y que el gris se viera "deshabilitado" en oscuro.
  const steps = [
    {
      k: "Estimados",
      n: estimatesCount,
      s: estimatesCount > 0 ? "los pediste tú" : "aún ninguno",
      color: "var(--color-ink)",
    },
    {
      k: "Aprobados",
      n: approvedCount,
      s: approvedCount > 0 ? "en proceso" : "—",
      color: "var(--color-ink)",
    },
    {
      k: "Facturados",
      n: invoicesCount,
      s: invoicesCount > 0 ? invoicedLabel : "—",
      color: "var(--color-status-success)",
    },
  ];

  return (
    <div className="mt-7 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Tu ciclo · Estimado → Aprobado → Facturado
      </div>

      <div className="mt-4 flex items-stretch">
        {steps.map((st, i) => (
          <Fragment key={st.k}>
            <div className="flex-1 px-1 sm:px-2 min-w-0">
              <div
                className="text-[34px] sm:text-[40px] leading-none"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  letterSpacing: "-0.03em",
                  color: st.color,
                }}
              >
                {st.n}
              </div>
              <div className="mt-2 text-[13px] font-bold text-ink">{st.k}</div>
              <div className="mt-1 text-[11.5px] text-grey-500 truncate">
                {st.s}
              </div>
            </div>
            {i < steps.length - 1 ? (
              <div className="flex items-center text-grey-500 px-0.5 sm:px-1 flex-shrink-0">
                <ArrowIcon size={18} />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>

      <p className="mt-4 pt-4 border-t border-grey-200 text-[11.5px] text-grey-500 leading-[1.5]">
        Tú generas{" "}
        <b className="font-semibold text-grey-700">estimados</b> (calculadora o
        solicitud de servicio). Al aprobar la cotización los pasamos a{" "}
        <b className="font-semibold text-grey-700">orden</b>, y al entregar se{" "}
        <b className="font-semibold text-grey-700">facturan</b>.
      </p>
    </div>
  );
}
