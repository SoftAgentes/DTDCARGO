import Link from "next/link";
import { buildWhatsAppLink, CONTACT } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import {
  SERVICE_LABELS,
  formatInvoiceAmount,
  type PortalClient,
  type PortalDashboardKpis,
  type PortalNextArrival,
  type PortalShipmentRow,
} from "@/lib/portal/portal-types";
import { ShipmentRow } from "../../_components/ShipmentRow";
import { StatusBadge } from "../../_components/StatusBadge";
import { NewPurchaseButton } from "../../_components/NewPurchaseButton";

/**
 * Inicio / dashboard del cliente (SDD-0042 · Fase 5.2 · Norte PortalHome).
 *
 * Marca del PORTAL (paper/wine + clases del sitio público), sólo tokens `var(--*)`.
 * El PortalHome del Norte es referencia de LAYOUT (qué widgets, en qué orden), no
 * de tipografía. DEGRADADO donde la data no existe (próximo arribo sin contenedor/
 * buque/progreso = Tier 1 Naviera; "tu agente" = contacto público hasta que exista
 * clients.advisor_id).
 */
export function PortalDashboard({
  client,
  kpis,
  nextArrival,
  shipments,
}: {
  client: PortalClient;
  kpis: PortalDashboardKpis;
  nextArrival: PortalNextArrival | null;
  shipments: PortalShipmentRow[];
}) {
  const firstName = client.name.trim().split(/\s+/)[0] || client.name;
  const today = formatToday();
  const preview = shipments.slice(0, 4);

  const activeWord =
    kpis.activeShipments === 1 ? "envío activo" : "envíos activos";
  const pendingWord =
    kpis.pendingInvoiceCount === 1 ? "factura pendiente" : "facturas pendientes";

  return (
    <div>
      {/* ── Saludo + acciones ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="eyebrow">{today}</span>
          <h1
            className="h-display mt-3"
            style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
          >
            Hola {firstName}.
          </h1>
          <p className="lead mt-2">
            {kpis.activeShipments} {activeWord} · {kpis.pendingInvoiceCount}{" "}
            {pendingWord}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* SDD-0057 — "Nueva compra · = prealerta" (control único del portal). */}
          <NewPurchaseButton href="/portal/proveedores" />
          {/* Slice 5.7 — cotización aún deshabilitada ("Próximamente"). */}
          <SoonButton label="Nueva cotización" />
        </div>
      </div>

      {/* ── Próximo arribo (DEGRADADO: sin contenedor/buque/progreso/mapa) ── */}
      {nextArrival ? <NextArrivalCard arrival={nextArrival} /> : null}

      {/* ── 4 KPIs ── */}
      <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Envíos activos" value={String(kpis.activeShipments)} sub="en curso" />
        <Kpi
          label="Entregados YTD"
          value={String(kpis.deliveredYtd)}
          sub={`${new Date().getFullYear()} acumulado`}
        />
        <Kpi
          label="Facturado"
          value={formatInvoiceAmount(kpis.invoicedTotal, kpis.currency)}
          sub={kpis.mixedCurrencies ? "moneda dominante" : `${kpis.currency} acumulado`}
        />
        <Kpi
          label="Saldo pendiente"
          value={formatInvoiceAmount(kpis.outstandingBalance, kpis.currency)}
          sub={kpis.outstandingBalance > 0 ? "por pagar" : "al día"}
          highlight={kpis.outstandingBalance > 0}
        />
      </div>

      {/* ── Dos columnas: preview envíos + (saldo · agente) ── */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
        {/* Preview "Tus envíos" */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
            <div>
              <div className="text-[15px] font-bold text-ink">Tus envíos</div>
              <div className="mt-0.5 text-[12px] text-grey-500">
                {shipments.length === 1
                  ? "1 envío en total"
                  : `${shipments.length} envíos en total`}
              </div>
            </div>
            <Link
              href="/portal/envios"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-wine hover:underline"
            >
              Ver todos <ArrowIcon size={14} />
            </Link>
          </div>

          {preview.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="text-[16px] font-bold text-ink">
                Todavía no tienes envíos.
              </div>
              <p className="mt-1.5 text-[13px] text-grey-700 max-w-[42ch] mx-auto leading-[1.5]">
                Cuando confirmes tu primera carga, va a aparecer acá con su
                estado.
              </p>
              <a
                href={buildWhatsAppLink(
                  `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y quiero coordinar mi primera carga.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost mt-4 inline-flex items-center gap-2"
              >
                <WhatsAppIcon size={16} /> Escribir a mi asesor
              </a>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {preview.map((s) => (
                <ShipmentRow key={s.id} shipment={s} />
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha: saldo + agente */}
        <div className="flex flex-col gap-5">
          {kpis.outstandingBalance > 0 ? (
            <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
                Saldo pendiente
              </div>
              <div
                className="mt-3 text-[26px] leading-none"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  letterSpacing: "-0.01em",
                  color: "var(--color-status-warning)",
                }}
              >
                {formatInvoiceAmount(kpis.outstandingBalance, kpis.currency)}
              </div>
              <div className="mt-2 text-[12.5px] text-grey-700">
                {kpis.pendingInvoiceCount === 1
                  ? "1 factura por pagar"
                  : `${kpis.pendingInvoiceCount} facturas por pagar`}
              </div>
              <Link
                href="/portal/facturas"
                className="btn btn-primary mt-4 inline-flex w-full justify-center"
              >
                Ver facturas <ArrowIcon size={15} />
              </Link>
            </div>
          ) : null}

          <AgentCard client={client} />
        </div>
      </div>
    </div>
  );
}

/**
 * Card "Próximo arribo" (DEGRADADO). Code mono + ruta + estado + ETA estimada.
 * Misma piel que el resto del portal (paper/white + wine), destacada con un borde
 * wine a la izquierda. SIN contenedor/buque/progreso/mapa (Tier 1 Naviera).
 */
function NextArrivalCard({ arrival }: { arrival: PortalNextArrival }) {
  const svc = SERVICE_LABELS[arrival.service];
  const route =
    arrival.origin || arrival.destination
      ? `${arrival.origin ?? "—"} → ${arrival.destination ?? "—"}`
      : null;

  return (
    <Link
      href={`/portal/envios/${encodeURIComponent(arrival.code)}`}
      className="card-link group mt-7 block bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-8 hover:border-ink focus-visible:border-ink transition-colors"
      style={{ borderLeftColor: "var(--color-wine)" }}
      aria-label={`Ver detalle del próximo arribo ${arrival.code}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-wine">
            Próximo arribo
          </div>
          <div
            className="mt-2.5 text-[24px] sm:text-[28px] leading-none text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              letterSpacing: "-0.01em",
            }}
          >
            {arrival.code}
          </div>
          <div className="mt-2.5 text-[13.5px] text-grey-700">
            <span className="font-semibold">{svc.primary}</span>
            {route ? (
              <span
                className="text-grey-500"
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              >
                {" · "}
                {route}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-6 flex-shrink-0">
          <div>
            <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500">
              Estado
            </div>
            <div className="mt-2">
              <StatusBadge status={arrival.status} />
            </div>
          </div>
          {arrival.etaIso ? (
            <div>
              <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500">
                Entrega estimada
              </div>
              <div
                className="mt-2 text-[16px] font-bold text-ink"
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              >
                {formatDate(arrival.etaIso)}
              </div>
            </div>
          ) : null}
          <ArrowIcon
            size={18}
            className="text-grey-300 transition-colors group-hover:text-wine hidden sm:block"
          />
        </div>
      </div>
    </Link>
  );
}

/**
 * Card "Tu agente" (DEGRADADO). No existe `clients.advisor_id` todavía → usamos el
 * contacto único público (CRM WhatsApp). TODO: clients.advisor_id cuando exista
 * asignación de asesor.
 */
function AgentCard({ client }: { client: PortalClient }) {
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y tengo una consulta.`,
  );
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Tu asesor
      </div>
      <p className="mt-3 text-[13.5px] text-grey-700 leading-[1.55]">
        Tu asesor DTD te acompaña en cada carga. Escribinos por WhatsApp para
        cotizar, prealertar una compra o resolver cualquier duda.
      </p>
      <div
        className="mt-4 text-[13px] text-grey-700"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {CONTACT.ve.whatsapp}
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost mt-4 inline-flex w-full justify-center items-center gap-2"
      >
        <WhatsAppIcon size={18} /> Escribir por WhatsApp
      </a>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      <div className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </div>
      <div
        className="mt-2.5 text-[26px] leading-none text-ink"
        style={{
          fontFamily: "var(--font-archivo-black)",
          letterSpacing: "-0.01em",
          color: highlight ? "var(--color-status-warning)" : undefined,
        }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-grey-500">{sub}</div>
    </div>
  );
}

/** Botón deshabilitado con copy "Próximamente" (slices 5.6 / 5.7 aún no listos). */
function SoonButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Próximamente"
      aria-disabled
      className="btn btn-ghost inline-flex items-center gap-1.5 opacity-55 cursor-not-allowed pointer-events-none"
    >
      {label}
      <span className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-grey-500">
        Próximamente
      </span>
    </button>
  );
}

function formatToday(): string {
  try {
    return new Date().toLocaleDateString("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
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
