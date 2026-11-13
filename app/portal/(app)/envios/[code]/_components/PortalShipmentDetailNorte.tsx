import type { ComponentProps } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import {
  SERVICE_LABELS,
  SERVICE_SHORT_LABELS,
  STATUS_LABELS,
  buildTimeline,
  estimatePortalEta,
  type PortalShipmentDetail,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/portal/portal-types";
import {
  hasNavieraData,
  type NavieraSnapshot,
} from "@/lib/studio/naviera-tracking/types";
import type { TrackingSnapshotRow } from "@/lib/studio/naviera-tracking/snapshot-queries";
import type { PendingAcceptanceInvoice } from "@/lib/portal/portal-legal-queries";
import {
  rotuloFuente,
  type SeguimientoEstimado,
} from "@/lib/portal/seguimiento-estimado";
import type { PortalNotificationHistoryItem } from "@/lib/studio/notifications/notification-history-queries";
import { StatusBadge } from "../../../../_components/StatusBadge";
import { PortalDocsCard } from "../../../../_components/PortalDocsCard";
import { PortalNotificationHistory } from "../../../../_components/PortalNotificationHistory";
import { PortalTrackingEnConstruccion } from "../../../../_components/PortalTrackingEnConstruccion";
import { PendingAcceptanceCard } from "../../../_components/PendingAcceptanceCard";

/**
 * Detalle de envío — REDISEÑO NORTE (founder 2026-06-20). GATEADO al demo; los
 * clientes reales siguen con el detalle actual. Eleva el detalle a la imagen del
 * Norte (`PortalShipmentDetail` de `_norte/portal/app.jsx`): STEPPER HORIZONTAL de
 * seguimiento (en vez del timeline vertical) + 2 columnas (detalle de la carga ·
 * documentos). Server component: recibe lo que ya calculó la página (envío +
 * documentos + URLs firmadas) — cero query nueva.
 *
 * El stepper sale de `buildTimeline(status, service)` (flow canónico del repo).
 * Honesto donde no hay data: sin Naviera/ETD/Valor declarado (Tier 1 Naviera).
 */
type DocsProps = ComponentProps<typeof PortalDocsCard>;

export function PortalShipmentDetailNorte({
  shipment,
  documents,
  signedUrls,
  naviera,
  live,
  stepDates,
  estimado,
  hiddenStatuses,
  notificationHistory,
  pendingAcceptance,
}: {
  shipment: PortalShipmentDetail;
  documents: DocsProps["documents"];
  signedUrls: DocsProps["signedUrls"];
  /** Snapshot naviero real resuelto de la cadena (SDD-0101). null = aún sin consolidar. */
  naviera?: NavieraSnapshot | null;
  /** Snapshot VIVO de SeaRates cacheado (SDD-0101 · B.3). null = aún sin rastrear. */
  live?: TrackingSnapshotRow | null;
  /** Fecha real (ISO) por status del stepper (SDD-0132). Opcional. */
  stepDates?: Partial<Record<ShipmentStatus, string>>;
  /**
   * Seguimiento estimado desde el zarpe (SDD-0627). null = todavía no zarpó o
   * ya no aplica: el stepper queda como antes, sólo con fechas reales.
   */
  estimado?: SeguimientoEstimado | null;
  /** Statuses ocultos por config del tenant (SDD-0156 · visible_in_portal). */
  hiddenStatuses?: ReadonlySet<ShipmentStatus>;
  /** Historial de avisos enviados de este envío (SDD-0156 · Slice C). */
  notificationHistory?: PortalNotificationHistoryItem[];
  /**
   * Orden DDP de ESTE envío esperando aceptación (SDD-0075 §1 · Slice A). null =
   * nada que aceptar (o el CTA aún no está prendido para este cliente). La página
   * ya resolvió el gate `showShipmentAcceptanceCta` + la query.
   */
  pendingAcceptance?: PendingAcceptanceInvoice | null;
}) {
  const svc = SERVICE_LABELS[shipment.service];
  const serviceLabel = svc.sub ? `${svc.primary} · ${svc.sub}` : svc.primary;
  const route =
    shipment.origin || shipment.destination
      ? `${shipment.origin ?? "—"} → ${shipment.destination ?? "—"}`
      : null;
  // SDD-0627 · después del zarpe manda la estimación desde el zarpe; antes, la
  // heurística de siempre por servicio.
  const eta = estimado ? estimado.entregaIso : estimatePortalEta(shipment);
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, tengo una consulta sobre mi envío ${shipment.code}.`,
  );

  return (
    <div>
      <Link
        href="/portal/envios"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis envíos
      </Link>

      {/* Header: código + ruta + tipo + estado */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div
            className="text-[30px] sm:text-[40px] leading-none text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              letterSpacing: "-0.02em",
            }}
          >
            {shipment.code}
          </div>
          <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[15px]">
            <span className="font-bold text-ink">{cityOf(shipment.origin)}</span>
            <span className="text-wine-text">→</span>
            <span className="font-bold text-ink">
              {cityOf(shipment.destination)}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-grey-700 bg-grey-100">
              {SERVICE_SHORT_LABELS[shipment.service]}
            </span>
          </div>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {/* Aceptación cosida al ciclo del envío (SDD-0075 §1 · Slice A): arriba del
          stepper porque es lo ÚNICO que frena el avance de la carga — sin aceptar,
          no se emite la factura. Mismo card del dashboard (acceso duplicado, no
          movido: /portal/facturas/[code]/aceptar sigue siendo la pantalla). */}
      {pendingAcceptance ? (
        <div className="mt-6">
          <PendingAcceptanceCard
            pending={[pendingAcceptance]}
            heading="Este envío espera tu aceptación para que podamos facturarlo."
          />
        </div>
      ) : null}

      {/* SDD-0514 · aviso de seguimiento en construcción. Va ARRIBA del stepper
          y no en su lugar: si el envío ya tiene hitos con fecha, se siguen
          viendo debajo. */}
      <PortalTrackingEnConstruccion className="mt-8" />

      {/* Stepper de seguimiento (horizontal, canónico) */}
      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-7">
          Seguimiento
        </h2>
        <Stepper
          status={shipment.status}
          service={shipment.service}
          stepDates={stepDates}
          estimatedDates={estimado?.porEtapa}
          hiddenStatuses={hiddenStatuses}
        />
        {estimado ? (
          <p
            className="mt-6 text-[12px] text-grey-700 leading-[1.5]"
            data-testid="seguimiento-estimado-nota"
          >
            <span className="font-bold">Fechas estimadas.</span> Las marcadas
            «Est.» las calculamos desde el zarpe {rotuloFuente(estimado.fuente)}.
            Llegada estimada a puerto: {formatDate(estimado.etaPuertoIso)}. Pueden
            moverse con la naviera y la aduana.
          </p>
        ) : null}
        <p
          className={`${estimado ? "mt-2" : "mt-6"} text-[12px] text-grey-500 leading-[1.5]`}
        >
          Las actualizaciones de estado las carga nuestro equipo a medida que tu
          carga avanza.
        </p>
      </div>

      {/* Naviera Tier 1 (SDD-0101): buque/ETD/ETA/contenedor reales de la cadena +
          deep-link a SeaRates. Solo cuando hay data (envío consolidado con zarpe). */}
      {hasNavieraData(naviera) ? (
        <NavieraCard naviera={naviera} live={live} />
      ) : null}

      {/* 2 columnas: detalle de la carga · documentos */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Detalle de la carga
          </h2>
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Servicio" value={serviceLabel} />
            {route ? <Field label="Ruta" value={route} mono /> : null}
            {shipment.volumeM3 != null ? (
              <Field
                label="Volumen"
                value={`${shipment.volumeM3.toFixed(2)} m³`}
                mono
              />
            ) : null}
            {shipment.weightKg != null ? (
              <Field
                label="Peso"
                value={`${shipment.weightKg.toFixed(0)} kg`}
                mono
              />
            ) : null}
            {shipment.arrivedDestinationAt ? (
              <Field
                label="Llegó a bodega VE"
                value={formatDate(shipment.arrivedDestinationAt)}
                highlight
              />
            ) : eta ? (
              <Field
                label="Entrega estimada"
                value={formatDate(eta)}
                highlight
                hint="Estimada, sujeta a aduana y tránsito."
              />
            ) : null}
          </dl>

          <div className="mt-8 pt-6 border-t border-grey-200">
            <p className="text-[13.5px] text-grey-700 leading-[1.55]">
              ¿Necesitas un cambio o tienes una duda sobre este envío? Escríbele
              a tu asesor.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-4 inline-flex items-center gap-2"
            >
              <WhatsAppIcon size={18} /> Consultar por WhatsApp
            </a>
          </div>
        </div>

        <PortalDocsCard documents={documents} signedUrls={signedUrls} />
      </div>

      {/* Historial de avisos enviados (SDD-0156 · Slice C). Se oculta si no hay. */}
      {notificationHistory && notificationHistory.length > 0 ? (
        <div className="mt-6">
          <PortalNotificationHistory items={notificationHistory} />
        </div>
      ) : null}
    </div>
  );
}

/** Fecha del hito (ISO) → "12 jun" corto para el stepper, o null si no parseable. */
function formatStepDate(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return null;
  }
}

/**
 * Stepper horizontal de seguimiento. Usa `buildTimeline` (estados done/active/
 * pending/exception del flow canónico por servicio). Scroll horizontal en pantallas
 * chicas para no apretar los pasos.
 */
function Stepper({
  status,
  service,
  stepDates,
  estimatedDates,
  hiddenStatuses,
}: {
  status: ShipmentStatus;
  service: ShipmentService;
  stepDates?: Partial<Record<ShipmentStatus, string>>;
  /** Fecha ESTIMADA de las etapas que faltan (SDD-0627). */
  estimatedDates?: Partial<Record<ShipmentStatus, string>>;
  hiddenStatuses?: ReadonlySet<ShipmentStatus>;
}) {
  const steps = buildTimeline(status, service, hiddenStatuses);
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex">
        {steps.map((step, i) => {
          const done = step.state === "done";
          const active = step.state === "active";
          const exception = step.state === "exception";
          const reached = done || active || exception;
          const dotBg = active
            ? "var(--color-white)"
            : exception
              ? "var(--color-status-danger)"
              : reached
                ? "var(--color-wine)"
                : "var(--color-grey-100)";
          const dotBorder = exception
            ? "var(--color-status-danger)"
            : reached
              ? "var(--color-wine)"
              : "var(--color-grey-300)";
          // El paso ACTUAL se distingue como anillo wine hueco ("estás aquí"); los
          // completados van en wine sólido con ✓.
          const dotColor = active
            ? "var(--color-wine)"
            : reached
              ? "var(--color-on-accent)"
              : "var(--color-grey-500)";
          return (
            <div
              key={step.status}
              className="relative flex flex-col items-center text-center px-1"
              style={{ flex: "1 0 auto", minWidth: 72 }}
            >
              {i > 0 ? (
                <span
                  className="absolute h-0.5"
                  style={{
                    top: 12,
                    left: "calc(-50% + 13px)",
                    right: "calc(50% + 13px)",
                    background: reached
                      ? "var(--color-wine)"
                      : "var(--color-grey-200)",
                  }}
                />
              ) : null}
              <span
                className="grid place-items-center rounded-full text-[11px] font-bold"
                style={{
                  width: 26,
                  height: 26,
                  background: dotBg,
                  border: `2px solid ${dotBorder}`,
                  color: dotColor,
                  boxShadow: active
                    ? "0 0 0 3px color-mix(in srgb, var(--color-wine) 28%, transparent)"
                    : undefined,
                }}
              >
                {done ? "✓" : exception ? "!" : i + 1}
              </span>
              <span
                className="mt-2 text-[10.5px] leading-tight"
                style={{
                  fontWeight: active ? 800 : 600,
                  color: active
                    ? "var(--color-ink)"
                    : reached
                      ? "var(--color-grey-700)"
                      : "var(--color-grey-500)",
                }}
              >
                {STATUS_LABELS[step.status]}
              </span>
              {/* Fecha real del hito (SDD-0132) — solo si la operación la registró. */}
              {formatStepDate(stepDates?.[step.status]) ? (
                <span className="mt-0.5 text-[9.5px] font-semibold text-grey-500 leading-tight">
                  {formatStepDate(stepDates?.[step.status])}
                </span>
              ) : !reached && formatStepDate(estimatedDates?.[step.status]) ? (
                // SDD-0627 · fecha ESTIMADA de una etapa que falta: se rotula
                // «Est.» y se lee entera para lectores de pantalla.
                <span
                  className="mt-0.5 text-[9.5px] italic text-grey-500 leading-tight"
                  aria-label={`Fecha estimada: ${formatStepDate(estimatedDates?.[step.status])}`}
                  data-testid={`stepper-estimado-${step.status}`}
                >
                  Est. {formatStepDate(estimatedDates?.[step.status])}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Estado del contenedor → label de cara al cliente (SDD-0047 status). */
function navieraStatusLabel(status: string): string {
  switch (status) {
    case "consolidando":
      return "En consolidación";
    case "cerrado":
      return "Contenedor cerrado";
    case "zarpado":
      return "En tránsito marítimo";
    case "arribado":
      return "Arribado a puerto";
    default:
      return status;
  }
}

/** Estado SeaRates (metadata.status) → label de cara al cliente. */
function liveStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "PLANNED":
      return "Planificado";
    case "IN_TRANSIT":
      return "En tránsito marítimo";
    case "DISCHARGED":
      return "Descargado en puerto";
    case "DELIVERED":
      return "Entregado";
    case "EMPTY_RETURNED":
      return "Contenedor devuelto";
    default:
      return status.replace(/_/g, " ").toLowerCase();
  }
}

/** "hace X" (corto, es-VE) para el sello de actualización del tracking. */
function timeAgoEs(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Texto del último movimiento del tracking vivo (último hito, o la posición). */
function liveLastMovement(live: TrackingSnapshotRow): string {
  const last = live.milestones[live.milestones.length - 1];
  if (last) {
    const where = last.location ? ` · ${last.location}` : "";
    return `${last.description}${where}`;
  }
  if (live.lastLat != null && live.lastLng != null) {
    return `Posición ${live.lastLat.toFixed(2)}, ${live.lastLng.toFixed(2)}`;
  }
  return "—";
}

/**
 * Card "Naviera" (SDD-0101) — buque/viaje/naviera/ruta marítima/ETD/ETA/contenedor/
 * BL resueltos de la cadena (Tier 1 · Slice A) + ENRIQUECIDOS con el tracking VIVO de
 * SeaRates cuando existe (Slice B.3): ETA real, estado real, último movimiento. El
 * botón abre el seguimiento en vivo de SeaRates SIN gastar cuota.
 */
function NavieraCard({
  naviera,
  live,
}: {
  naviera: NavieraSnapshot;
  live?: TrackingSnapshotRow | null;
}) {
  // El tracking vivo (real, de la naviera) le gana al dato manual de la cadena.
  const liveData: TrackingSnapshotRow | null =
    live != null && live.fetchStatus === "ok" ? live : null;
  const etaValue = liveData?.podEta ?? naviera.eta;
  const etaConfirmed = !!liveData?.podEta;
  const statusText = liveData?.status
    ? liveStatusLabel(liveData.status)
    : naviera.navieraStatus
      ? navieraStatusLabel(naviera.navieraStatus)
      : null;
  const vessel = naviera.vessel
    ? naviera.voyage
      ? `${naviera.vessel} · ${naviera.voyage}`
      : naviera.vessel
    : null;
  const seaRoute =
    naviera.pol || naviera.pod
      ? `${naviera.pol ?? "—"} → ${naviera.pod ?? "—"}`
      : null;
  const container = naviera.containerNo
    ? naviera.containerType
      ? `${naviera.containerNo} · ${naviera.containerType}`
      : naviera.containerNo
    : null;

  return (
    <div className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Naviera
        </h2>
        {statusText ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[color:var(--color-on-accent)] bg-wine">
            {statusText}
          </span>
        ) : null}
      </div>
      <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {vessel ? <Field label="Buque" value={vessel} /> : null}
        {naviera.carrierName ? (
          <Field label="Naviera" value={naviera.carrierName} />
        ) : null}
        {seaRoute ? <Field label="Ruta marítima" value={seaRoute} mono /> : null}
        {naviera.etd ? (
          <Field label="Zarpe (ETD)" value={formatDate(naviera.etd)} />
        ) : null}
        {etaValue ? (
          <Field
            label="Arribo a puerto (ETA)"
            value={formatDate(etaValue)}
            highlight
            hint={
              etaConfirmed
                ? "Confirmada por la naviera (SeaRates)."
                : "Estimada por la naviera."
            }
          />
        ) : null}
        {container ? <Field label="Contenedor" value={container} mono /> : null}
        {naviera.blNumber ? <Field label="BL" value={naviera.blNumber} mono /> : null}
      </dl>

      {liveData &&
      (liveData.milestones.length > 0 ||
        (liveData.lastLat != null && liveData.lastLng != null)) ? (
        <div className="mt-8 pt-6 border-t border-grey-200">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Último movimiento
          </div>
          <p className="mt-1.5 text-[14px] font-semibold text-ink leading-[1.5]">
            {liveLastMovement(liveData)}
          </p>
          <p className="mt-1 text-[11.5px] text-grey-500">
            Actualizado {timeAgoEs(liveData.fetchedAt)} · vía SeaRates
          </p>
        </div>
      ) : null}

      {/* Acá vivía el botón "Ver seguimiento en SeaRates" (SDD-0101). Se quitó el
          24-ago-2026 (SDD-0291): SeaRates notificó el 13-ago la terminación de sus
          servicios con 30 días de plazo, así que el enlace queda MUERTO el ~12-sep
          — y este botón lo ve el CLIENTE. La card no pierde información: buque,
          viaje, ETD/ETA y contenedor salen de NUESTRA cadena
          (sailings/consolidations), no de SeaRates. No reponer un deep-link sin un
          proveedor vivo detrás. */}
    </div>
  );
}

function Field({
  label,
  value,
  highlight = false,
  mono = false,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className={`text-[15.5px] ${
          highlight ? "font-extrabold text-wine-text" : "font-semibold text-ink"
        }`}
        style={
          mono
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      >
        {value}
      </dd>
      {hint ? <span className="text-[11.5px] text-grey-500">{hint}</span> : null}
    </div>
  );
}

/** Ciudad (parte antes de la coma) para el header. */
function cityOf(loc: string | null): string {
  if (!loc) return "—";
  return loc.split(",")[0]?.trim() || loc;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
