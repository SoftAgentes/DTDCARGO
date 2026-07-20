import type { ReactNode } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  ArrowIcon,
  BoxIcon,
  CheckIcon,
  DocIcon,
  PaymentIcon,
  WhatsAppIcon,
} from "@/components/Icon";
import { ChinaSupplierClip } from "@/components/ChinaSupplierClip";
import {
  SERVICE_LABELS,
  SERVICE_SHORT_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  computeProgress,
  formatInvoiceAmount,
  type PortalClient,
  type PortalDashboardKpis,
  type PortalNextArrival,
  type PortalShipmentRow,
} from "@/lib/portal/portal-types";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";
import type { PortalActivityItem } from "@/lib/portal/shipment-events-queries";
import type { PortalSailing } from "@/lib/portal/next-sailing-queries";
import { ShipmentRow } from "../../_components/ShipmentRow";
import { PortalNextSailingCard } from "./PortalNextSailingCard";

/**
 * Inicio / dashboard del cliente — REDISEÑO NORTE (founder 2026-06-20).
 *
 * GATEADO al demo (`isDemoMarkbox`): los clientes reales siguen con `PortalDashboard`
 * (lo de hoy). Esta versión eleva el dashboard a la imagen del Norte (PortalHome de
 * `_norte/portal/app.jsx`) — héroe navy "Próximo arribo" con arco SVG, KPIs con
 * acento, columna derecha de 3 cards — y vive en MODO OSCURO por defecto (los tokens
 * los conmuta el shell vía `[data-portal-theme]`).
 *
 * MISMOS datos que `PortalDashboard` (client/kpis/nextArrival/shipments) → cero query
 * nueva, cero migración. Honesto donde la data no existe: el progreso del héroe se
 * deriva del status con `computeProgress` (mapa canónico del repo, no inventado);
 * no hay contenedor/buque (Tier 1 Naviera). La "Actividad reciente" se deriva de los
 * envíos por `updatedAt` (real). El bloque de "texto para WeChat" (ChinaSupplierClip)
 * se mantiene en la derecha (founder lo mudó acá desde el cierre del registro).
 */
export function PortalDashboardNorte({
  client,
  kpis,
  nextArrival,
  nextArrivalNaviera,
  shipments,
  activity = [],
  sailing = null,
  sailingDaysToCutoff = null,
  advisorCard = null,
}: {
  client: PortalClient;
  kpis: PortalDashboardKpis;
  nextArrival: PortalNextArrival | null;
  /** Snapshot naviero del próximo arribo (SDD-0101) — el héroe muestra el buque real. */
  nextArrivalNaviera?: NavieraSnapshot | null;
  shipments: PortalShipmentRow[];
  /** Actividad reciente por hitos reales (SDD-0132), no por `updatedAt`. */
  activity?: PortalActivityItem[];
  /** Próximo zarpe abierto (SDD-0133). null = sin salida publicada → card oculta. */
  sailing?: PortalSailing | null;
  /** Días al cut-off calculados en el server (fallback pre-hidratación de la card). */
  sailingDaysToCutoff?: number | null;
  /** Card "Tu asesor" del Norte, ya resuelta en el server (datos reales). */
  advisorCard?: ReactNode;
}) {
  const firstName = client.name.trim().split(/\s+/)[0] || client.name;
  const today = formatToday();
  const preview = shipments.slice(0, 5);
  const recent = activity.slice(0, 4);

  const activeWord =
    kpis.activeShipments === 1 ? "envío activo" : "envíos activos";
  const pendingWord =
    kpis.pendingInvoiceCount === 1 ? "factura pendiente" : "facturas pendientes";

  return (
    <div>
      {/* ── Saludo ── (las acciones "Otros servicios" / calculadora se movieron:
            servicios → Alertas · mis envíos; calculadora → FAB flotante) */}
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

      {/* ── Héroe navy "Próximo arribo" (progreso derivado del status; buque real
            de la cadena naviera cuando existe, SDD-0101) ── */}
      {nextArrival ? (
        <NextArrivalHero arrival={nextArrival} naviera={nextArrivalNaviera} />
      ) : null}

      {/* ── 4 KPIs con acento ── */}
      <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <NorteKpi
          tone="wine"
          icon={<BoxIcon size={18} />}
          label="Envíos activos"
          value={String(kpis.activeShipments)}
          sub="en curso"
        />
        <NorteKpi
          tone="success"
          icon={<CheckIcon size={18} />}
          label="Entregados"
          value={String(kpis.deliveredYtd)}
          sub={`${new Date().getFullYear()} acumulado`}
        />
        <NorteKpi
          tone="info"
          icon={<DocIcon size={18} />}
          label="Facturado"
          value={formatInvoiceAmount(kpis.invoicedTotal, kpis.currency)}
          sub={
            kpis.mixedCurrencies
              ? "moneda dominante"
              : `${kpis.currency} acumulado`
          }
        />
        <NorteKpi
          tone={kpis.outstandingBalance > 0 ? "warning" : "success"}
          icon={<PaymentIcon size={18} />}
          label="Saldo pendiente"
          value={formatInvoiceAmount(kpis.outstandingBalance, kpis.currency)}
          sub={kpis.outstandingBalance > 0 ? "por pagar" : "al día"}
          highlight={kpis.outstandingBalance > 0}
        />
      </div>

      {/* ── Dos columnas: preview envíos + (saldo · WeChat · actividad) ── */}
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
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-wine-text hover:underline"
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

        {/* Columna derecha */}
        <div className="flex flex-col gap-6">
          {/* Próxima salida / cut-off (SDD-0133): organiza compras contra el calendario. */}
          {sailing ? (
            <PortalNextSailingCard
              sailing={sailing}
              serverDaysToCutoff={sailingDaysToCutoff}
            />
          ) : null}
          {kpis.outstandingBalance > 0 ? <SaldoCard kpis={kpis} /> : null}
          {advisorCard}
          {/* Texto listo para WeChat: dirección de bodega CN + código del cliente. */}
          <ChinaSupplierClip markbox={client.markbox} />
          {recent.length > 0 ? <ActividadCard activity={recent} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Héroe "Próximo arribo" — card navy a sangre con el arco SVG del barco. NAVY en
 * ambos temas (tokens `--hero-*`, que sólo existen en el shell del demo). El
 * progreso del arco sale de `computeProgress(status)` (mapa canónico del repo).
 */
function NextArrivalHero({
  arrival,
  naviera,
}: {
  arrival: PortalNextArrival;
  naviera?: NavieraSnapshot | null;
}) {
  const svc = SERVICE_LABELS[arrival.service];
  const progress = computeProgress(arrival.status);
  const vessel = naviera?.vessel
    ? naviera.voyage
      ? `${naviera.vessel} · ${naviera.voyage}`
      : naviera.vessel
    : null;
  const px = 30 + 260 * (progress / 100);
  const py = 100 - 70 * Math.sin(Math.PI * (progress / 100));

  return (
    <Link
      href={`/portal/envios/${encodeURIComponent(arrival.code)}`}
      className="group mt-7 block rounded-[18px] overflow-hidden border transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--hero-accent)] focus-visible:ring-offset-[var(--color-paper)]"
      style={{
        background:
          "linear-gradient(135deg, var(--hero-from) 0%, var(--hero-to) 100%)",
        borderColor: "var(--hero-to)",
      }}
      aria-label={`Ver detalle del próximo arribo ${arrival.code}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 md:gap-7 items-center p-6 sm:p-8">
        <div className="min-w-0">
          <div
            className="text-[11px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--hero-accent)" }}
          >
            Próximo arribo
          </div>
          <div
            className="mt-3 text-[26px] sm:text-[30px] leading-none"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              letterSpacing: "-0.01em",
              color: "var(--hero-ink)",
            }}
          >
            {arrival.code}
          </div>
          <div className="mt-2.5 text-[13.5px]" style={{ color: "var(--hero-soft)" }}>
            <span className="font-semibold" style={{ color: "var(--hero-ink)" }}>
              {svc.primary}
            </span>
            {arrival.origin || arrival.destination ? (
              <span>
                {" · "}
                {arrival.origin ?? "—"}{" "}
                <span style={{ color: "var(--hero-accent)" }}>→</span>{" "}
                {arrival.destination ?? "—"}
              </span>
            ) : null}
          </div>
          {vessel ? (
            <div
              className="mt-2 text-[12.5px] font-semibold"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                color: "var(--hero-soft)",
              }}
            >
              Buque {vessel}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            <HeroStat
              label="Entrega estimada"
              value={arrival.etaIso ? formatDate(arrival.etaIso) : "—"}
            />
            <HeroStat label="Progreso" value={`${progress}%`} accent />
            <HeroStat label="Tipo" value={SERVICE_SHORT_LABELS[arrival.service]} />
          </div>
        </div>

        <div className="relative">
          <svg viewBox="0 0 320 200" className="w-full" style={{ height: 180 }} aria-hidden>
            <path
              d="M 30 100 Q 160 30 290 100"
              fill="none"
              stroke="var(--hero-soft)"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.35"
            />
            <path
              d={`M 30 100 Q 160 30 ${px.toFixed(1)} ${py.toFixed(1)}`}
              fill="none"
              stroke="var(--hero-accent)"
              strokeWidth="3"
            />
            <circle cx="30" cy="100" r="7" fill="var(--hero-ink)" />
            <circle cx="290" cy="100" r="7" fill="var(--hero-accent)" />
            <g transform={`translate(${px.toFixed(1)}, ${py.toFixed(1)})`}>
              <circle r="20" fill="var(--hero-accent)" opacity="0.18">
                <animate
                  attributeName="r"
                  values="20;30;20"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                r="9"
                fill="var(--hero-accent)"
                stroke="var(--hero-ink)"
                strokeWidth="2.5"
              />
            </g>
            <text
              x="30"
              y="128"
              fontSize="10.5"
              fill="var(--hero-soft)"
              textAnchor="middle"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {cityOf(arrival.origin)}
            </text>
            <text
              x="290"
              y="128"
              fontSize="10.5"
              fill="var(--hero-soft)"
              textAnchor="middle"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {cityOf(arrival.destination)}
            </text>
          </svg>
        </div>
      </div>
    </Link>
  );
}

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10.5px] font-bold tracking-[0.14em] uppercase"
        style={{ color: "var(--hero-mute)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-[20px] sm:text-[22px] leading-none"
        style={{
          fontFamily: "var(--font-archivo-black)",
          color: accent ? "var(--hero-accent)" : "var(--hero-ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

type KpiTone = "wine" | "success" | "info" | "warning";

const TONE_COLOR: Record<KpiTone, string> = {
  wine: "var(--color-wine)",
  success: "var(--color-status-success)",
  info: "var(--portal-info)",
  warning: "var(--color-status-warning)",
};

function NorteKpi({
  tone,
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  tone: KpiTone;
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-grey-500">
          {label}
        </div>
        <span
          className="grid place-items-center h-8 w-8 rounded-[10px] flex-shrink-0"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 18%, var(--color-white))`,
          }}
        >
          {icon}
        </span>
      </div>
      <div
        className="mt-3 text-[26px] leading-none text-ink"
        style={{
          fontFamily: "var(--font-archivo-black)",
          letterSpacing: "-0.01em",
          color: highlight ? color : undefined,
        }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-grey-500">{sub}</div>
    </div>
  );
}

function SaldoCard({ kpis }: { kpis: PortalDashboardKpis }) {
  return (
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
  );
}

/**
 * Actividad reciente por HITOS reales del envío (`shipment_events` · SDD-0132) —
 * cada fila es un hito con su fecha real, no el `updatedAt` del envío.
 */
function ActividadCard({ activity }: { activity: PortalActivityItem[] }) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Actividad reciente
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        {activity.map((ev) => {
          // STATUS_COLORS son hex fijos (fuente compartida): la mayoría = navy de
          // marca (#0f1e3d), invisible sobre la card oscura. En ese caso usamos el
          // token de tinta (`--color-ink`, crema en oscuro / navy en claro).
          const raw = STATUS_COLORS[ev.status];
          const dot = raw.toLowerCase() === "#0f1e3d" ? "var(--color-ink)" : raw;
          return (
            <div key={ev.id} className="flex items-start gap-3">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: dot }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-ink leading-snug">
                  <span
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                    }}
                  >
                    {ev.shipmentCode}
                  </span>{" "}
                  · {STATUS_LABELS[ev.status]}
                </div>
                <div className="mt-0.5 text-[11px] text-grey-500">
                  {relTime(ev.occurredAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ciudad (parte antes de la coma) para las etiquetas del arco SVG. */
function cityOf(loc: string | null): string {
  if (!loc) return "—";
  return loc.split(",")[0]?.trim() || loc;
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

/** Tiempo relativo en español-VE para la actividad. */
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "hace 1 hora" : `hace ${h} horas`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "ayer" : `hace ${d} días`;
  return formatDate(iso);
}
