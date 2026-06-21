import {
  SERVICE_LABELS,
  INVOICE_TONE_COLOR,
  formatInvoiceAmount,
  portalEstimateStatusLabel,
  portalEstimateStatusTone,
  type PortalEstimateRow,
} from "@/lib/portal/portal-types";
import { buildWhatsAppLink } from "@/lib/design-tokens";

function formatDate(iso: string): string {
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

/** Badge de estado (de cara al cliente). Reusa el mapeo de estimados/quotes. */
function StatusBadge({ status }: { status: PortalEstimateRow["status"] }) {
  const tone = portalEstimateStatusTone(status);
  const color = INVOICE_TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {portalEstimateStatusLabel(status)}
    </span>
  );
}

/**
 * Fila read-only de "Cotizaciones" del portal (Norte). Espeja `EstimateRow` pero
 * para lo FORMAL: cuando el asesor todavía no puso precio (`totalUsd === 0`,
 * recién pedida) muestra "Pendiente de cotizar" en vez de "$0". No hay página de
 * detalle (la confirmación la maneja el asesor) → CTA a WhatsApp con el código.
 */
export function CotizacionRow({ cotizacion }: { cotizacion: PortalEstimateRow }) {
  const svc = SERVICE_LABELS[cotizacion.service];
  const route =
    cotizacion.origin || cotizacion.destination
      ? `${cotizacion.origin ?? "—"} → ${cotizacion.destination ?? "—"}`
      : null;
  const converted = !!cotizacion.convertedToShipmentId;
  const priced = cotizacion.totalUsd > 0;
  // El pedido del cliente viaja en `nota` con el prefijo interno de procedencia
  // ("Solicitud del portal · …") que el asesor ve en el Studio; al cliente le
  // mostramos sólo su texto.
  const pedido =
    cotizacion.nota?.replace(/^Solicitud del portal · /, "").trim() || null;
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, soy cliente y quiero avanzar con mi cotización ${cotizacion.code}.`,
  );

  return (
    <div className="bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {cotizacion.code}
          </span>
          <StatusBadge status={cotizacion.status} />
        </div>
        <div className="mt-1.5 text-[13.5px] text-grey-700">
          <span className="font-medium">{svc.primary}</span>
          {svc.sub ? <span className="text-grey-500"> · {svc.sub}</span> : null}
        </div>
        {route ? (
          <div
            className="mt-0.5 text-[13px] text-grey-500"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {route}
          </div>
        ) : null}
        {pedido ? (
          <p className="mt-2 text-[13px] text-grey-700 leading-[1.5]">
            <span className="text-grey-500">Tu pedido:</span> {pedido}
          </p>
        ) : null}
        {converted ? (
          <p className="mt-2 text-[12.5px] font-medium text-[color:var(--color-status-success)]">
            Convertida en envío.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2.5 flex-shrink-0">
        <div className="text-right">
          {priced ? (
            <>
              <div
                className="text-[15px] font-bold text-ink"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {formatInvoiceAmount(cotizacion.totalUsd, "USD")}
              </div>
              <div className="text-[11px] text-grey-500">cotizado</div>
            </>
          ) : (
            <div className="text-[12.5px] font-semibold text-grey-500">
              Pendiente de cotizar
            </div>
          )}
        </div>
        <span className="text-[12px] text-grey-500">
          {formatDate(cotizacion.createdAt)}
        </span>
        {!converted && cotizacion.status !== "rejected" ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-grey-300 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)] whitespace-nowrap"
          >
            Consultar con mi asesor
          </a>
        ) : null}
      </div>
    </div>
  );
}
