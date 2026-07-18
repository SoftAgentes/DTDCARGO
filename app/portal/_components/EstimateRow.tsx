import {
  SERVICE_LABELS,
  INVOICE_TONE_COLOR,
  formatInvoiceAmount,
  portalEstimateStatusLabel,
  portalEstimateStatusTone,
  type PortalEstimateRow,
} from "@/lib/portal/portal-types";
import { canAdvanceEstimate } from "@/lib/portal/cotizacion-request";
import { AdvanceToCotizacionButton } from "./AdvanceToCotizacionButton";
import { ConvertedNote } from "./ConvertedNote";

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

/** Badge de estado de estimado (de cara al cliente). Espeja el de facturas. */
function EstimateStatusBadge({ status }: { status: PortalEstimateRow["status"] }) {
  const tone = portalEstimateStatusTone(status);
  const color = INVOICE_TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color,
        background: `${color}14`, // ~8% alpha
        border: `1px solid ${color}33`, // ~20% alpha
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
 * Fila read-only de "Estimados" (lead · `source='web'`). No hay página de detalle.
 * El CTA es "Avanzar a cotización" (`AdvanceToCotizacionButton`): formaliza el
 * estimado — el mismo quote pasa a la pista de cotización y el cliente cae en
 * /portal/cotizaciones. Sólo se muestra para estimados elegibles (`canAdvanceEstimate`).
 */
export function EstimateRow({ estimate }: { estimate: PortalEstimateRow }) {
  const svc = SERVICE_LABELS[estimate.service];
  const route =
    estimate.origin || estimate.destination
      ? `${estimate.origin ?? "—"} → ${estimate.destination ?? "—"}`
      : null;
  const converted = !!estimate.convertedToShipmentId;

  return (
    <div className="bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {estimate.code}
          </span>
          <EstimateStatusBadge status={estimate.status} />
          {estimate.source === "web" ? (
            <span className="text-[11px] font-semibold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
              Hecho por ti
            </span>
          ) : null}
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
        {estimate.nota ? (
          <p className="mt-2 text-[13px] text-grey-700 leading-[1.5]">
            <span className="text-grey-500">Tu nota:</span> {estimate.nota}
          </p>
        ) : null}
        {converted ? <ConvertedNote code={estimate.convertedToShipmentCode} /> : null}
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2.5 flex-shrink-0">
        <div className="text-right">
          <div
            className="text-[15px] font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {formatInvoiceAmount(estimate.totalUsd, "USD")}
          </div>
          <div className="text-[11px] text-grey-500">estimado</div>
        </div>
        <span className="text-[12px] text-grey-500">
          {formatDate(estimate.createdAt)}
        </span>
        {canAdvanceEstimate({
          status: estimate.status,
          convertedToShipmentId: estimate.convertedToShipmentId,
        }) ? (
          <AdvanceToCotizacionButton code={estimate.code} />
        ) : null}
      </div>
    </div>
  );
}
