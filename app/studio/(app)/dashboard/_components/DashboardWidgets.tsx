"use client";

/**
 * Widgets del dashboard configurable (SDD-0114 · Slice B).
 *
 * Todos reciben data ya fetcheada por el server (props serializables) — cero
 * queries del lado cliente. El `chart` es el único con estado propio (el
 * selector de período), que sube al orquestador vía `onPeriodChange` para
 * persistir en la config.
 *
 * Solo tokens `var(--*)`. Los <Link> de Next se hidratan solos.
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { StatusIcon } from "@/components/StatusIcon";
import { STATUS_LABELS } from "@/lib/shared/shipment-public";
import { TONE_TO_VALUE_COLOR, type ChartPeriod, type KpiTone } from "@/lib/studio/dashboard/dashboard-catalog";
import { CHART_PERIODS } from "@/lib/studio/dashboard/dashboard-catalog";
import type { ActiveShipmentPreview, MonthlyVolumePoint } from "@/lib/studio/dashboard/dashboard-widget-queries";
import type { KpiValue } from "@/lib/studio/dashboard/dashboard-kpi-queries";

export type AlertItem = { tone: KpiTone; title: string; meta: string; href?: string };
export type NominaSummary = {
  neto: KpiValue;
  prestamos: KpiValue;
  ausencias: KpiValue;
  empleados: KpiValue;
} | null;

// ── Card shell compartido de los widgets ──────────────────────
function WCard({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <section
      style={{
        // grad-card (BD-034): degradado sutil en vez de blanco plano.
        background: "var(--grad-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: padded ? "18px 20px" : 0,
        overflow: "hidden",
      }}
    >
      {children}
    </section>
  );
}

// ── Gráfico de volumen (CBM/mes) + selector de período ────────
export function ChartWidget({
  data,
  period,
  onPeriodChange,
}: {
  data: MonthlyVolumePoint[];
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
}) {
  const slice = period === "1M" ? 1 : period === "3M" ? 3 : period === "YTD" ? new Date().getMonth() + 1 : 12;
  const points = data.slice(-slice);
  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const W = 640;
  const H = 200;
  const pad = 28;
  const bw = (W - pad * 2) / Math.max(1, values.length);

  return (
    <WCard>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
            VOLUMEN RECIBIDO
          </div>
          <div style={{ font: "900 20px/1.1 var(--f-display)", color: "var(--ink)", marginTop: 6, letterSpacing: "-0.02em" }}>
            CBM por mes
          </div>
        </div>
        <div className="studio-tabs" role="tablist" aria-label="Período del gráfico">
          {CHART_PERIODS.map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active}
                data-activa={active ? "true" : undefined}
                onClick={() => onPeriodChange(p)}
                className="studio-tab"
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
      {values.every((v) => v === 0) ? (
        <div
          style={{
            padding: "36px 16px",
            textAlign: "center",
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          Sin volumen registrado en el período.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Barras de CBM por mes">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line
              key={i}
              x1={pad}
              x2={W - pad}
              y1={H - p * (H - 20)}
              y2={H - p * (H - 20)}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
          ))}
          {points.map((pt, i) => {
            const h = (pt.value / max) * (H - 20);
            const x = pad + i * bw + bw * 0.15;
            const w = bw * 0.7;
            const y = H - h;
            const isLast = i === points.length - 1;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={Math.max(0, h)} fill="var(--wine)" opacity={isLast ? 1 : 0.5} rx="2" />
                {isLast && pt.value > 0 && (
                  <text x={x + w / 2} y={y - 6} fontFamily="var(--f-display)" fontSize="11" fill="var(--wine-text)" textAnchor="middle">
                    {pt.value}
                  </text>
                )}
                <text x={x + w / 2} y={H + 18} fontFamily="var(--f-sans)" fontSize="9.5" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="0.08em">
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </WCard>
  );
}

// ── Embarques en curso (tabla preview) ────────────────────────
export function ActiveShipmentsWidget({ items }: { items: ActiveShipmentPreview[] }) {
  return (
    <WCard padded={false}>
      <div
        style={{
          padding: "16px 20px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ font: "900 14px/1 var(--f-display)", color: "var(--ink)" }}>Embarques en curso</div>
          <div style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-mute)", marginTop: 4 }}>
            {items.length} activo(s) · recientes primero
          </div>
        </div>
        <Link href="/studio/tracking" className="studio-btn studio-btn-ghost studio-btn-xs" style={{ textDecoration: "none" }}>
          Ver todos →
        </Link>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "28px 20px", textAlign: "center", font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-mute)" }}>
          No hay embarques activos ahora mismo.
        </div>
      ) : (
        <div>
          {items.map((s, i) => (
            <Link
              key={s.id}
              href={`/studio/tracking/${s.id}`}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 120px",
                gap: 12,
                padding: "13px 28px 13px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              <code style={{ font: "800 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>{s.code}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.clientName ?? "Sin cliente"}
                </div>
                <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-mute)", marginTop: 2 }}>
                  {s.destination ?? "Destino —"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge tone="neutral" size="xs">{STATUS_LABELS[s.status] ?? s.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WCard>
  );
}

// ── Próximos por llegar (mismos activos, formato ligero) ──────
export function UpcomingEtaWidget({ items }: { items: ActiveShipmentPreview[] }) {
  const next = items.slice(0, 4);
  return (
    <WCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
          PRÓXIMOS POR LLEGAR
        </div>
        <Link href="/studio/calendario" className="studio-btn studio-btn-ghost studio-btn-xs" style={{ textDecoration: "none" }}>
          Calendario →
        </Link>
      </div>
      {next.length === 0 ? (
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-mute)" }}>Sin embarques activos.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {next.map((s) => (
            <Link
              key={s.id}
              href={`/studio/tracking/${s.id}`}
              className="studio-tracking-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 28px 9px 11px",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
              }}
            >
              <span style={{ color: "var(--wine-text)", display: "inline-flex" }}>{Icon.ship(15)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 12px/1.2 var(--f-mono)", color: "var(--ink)" }}>{s.code}</div>
                <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.clientName ?? "Sin cliente"}
                </div>
              </div>
              <Badge tone="neutral" size="xs">{STATUS_LABELS[s.status] ?? s.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </WCard>
  );
}

// ── Atención requerida ────────────────────────────────────────

/**
 * Franja de cada pendiente, como en `<Aviso>` (BRAND §Estados): el tono va en
 * el fondo suave y en la forma del icono; el texto, siempre en tinta. En
 * atención el icono va en tinta: el dorado no llega a 3:1 sobre su franja en
 * claro. `wine` y `neutral` no son estados: se leen como información.
 */
const ESTADO_DE_ALERTA: Record<
  KpiTone,
  { fondo: string; icono: "info" | "success" | "warning" | "danger"; color: string }
> = {
  danger: { fondo: "var(--danger-bg)", icono: "danger", color: "var(--danger-text)" },
  warning: { fondo: "var(--warning-bg)", icono: "warning", color: "var(--ink)" },
  success: { fondo: "var(--success-bg)", icono: "success", color: "var(--success)" },
  info: { fondo: "var(--info-bg)", icono: "info", color: "var(--info)" },
  wine: { fondo: "var(--info-bg)", icono: "info", color: "var(--info)" },
  neutral: { fondo: "var(--info-bg)", icono: "info", color: "var(--info)" },
};

export function AlertsWidget({ alerts }: { alerts: AlertItem[] }) {
  return (
    <WCard>
      <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 12 }}>
        ATENCIÓN REQUERIDA
      </div>
      {alerts.length === 0 ? (
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-mute)" }}>
          Todo en orden. Sin pendientes críticos.
        </div>
      ) : (
        // SDD-0603 · menores del Studio (BD-037): cada pendiente es una franja
        // plana con icono, sin contorno. No es `<Aviso>` porque es una lista
        // fija del tablero, no un anuncio: con `role="alert"` interrumpiría al
        // lector cada vez que se abre el Dashboard. Lo que se pulsa es «Abrir»,
        // un secundario con contorno de tinta; la franja ya no es un enlace.
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((a, i) => {
            const estado = ESTADO_DE_ALERTA[a.tone];
            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "10px 12px",
                  background: estado.fondo,
                  borderRadius: "var(--r-md)",
                }}
              >
                <StatusIcon tone={estado.icono} size={16} style={{ color: estado.color, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "700 12px/1.3 var(--f-sans)", color: "var(--ink)" }}>{a.title}</div>
                  <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{a.meta}</div>
                </div>
                {a.href ? (
                  <Link
                    href={a.href}
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    aria-label={`Abrir: ${a.title}`}
                    style={{ textDecoration: "none" }}
                  >
                    Abrir
                    {Icon.chevR(14)}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </WCard>
  );
}

// ── Acciones rápidas ──────────────────────────────────────────
export function QuickActionsWidget() {
  const items = [
    // SDD-0542 · el cotizador no abre el alta desde la URL: se llega al
    // listado, donde está «+ Nueva cotización».
    { label: "Nuevo estimado", icon: "calc", href: "/studio/cotizador" },
    { label: "Nuevo cliente", icon: "users", href: "/studio/clientes" },
    { label: "Recepción CN", icon: "warehouse", href: "/studio/cn" },
    { label: "Nuevo envío", icon: "box", href: "/studio/tracking/nuevo" },
  ];
  return (
    <WCard>
      <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 12 }}>
        ACCIONES RÁPIDAS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {items.map((a) => (
          // SDD-0603 · tramo 5a: se oprime, así que lleva contorno de tinta
          // (secundario). El color lo pone la clase, también al invertirse.
          <Link
            key={a.label}
            href={a.href}
            className="studio-btn studio-btn-ghost"
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
              padding: "12px 14px",
              textDecoration: "none",
            }}
          >
            <span style={{ display: "inline-flex" }}>
              {(Icon as Record<string, ((n?: number) => React.ReactNode) | undefined>)[a.icon]?.(16)}
            </span>
            <span style={{ font: "700 12.5px/1.2 var(--f-sans)" }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </WCard>
  );
}

// ── Nómina · resumen ──────────────────────────────────────────
export function NominaResumenWidget({ summary }: { summary: NominaSummary }) {
  if (!summary) return null;
  const stats = [
    { label: "Neto del corte", v: summary.neto },
    { label: "Saldo préstamos", v: summary.prestamos },
    { label: "Ausencias", v: summary.ausencias },
    { label: "Empleados", v: summary.empleados },
  ];
  return (
    <WCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
          NÓMINA · RESUMEN
        </div>
        <Link href="/studio/nomina" className="studio-btn studio-btn-ghost studio-btn-xs" style={{ textDecoration: "none" }}>
          Ir a nómina →
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ padding: "10px 0" }}>
            <div style={{ font: "800 17px/1 var(--f-display)", color: TONE_TO_VALUE_COLOR[s.v.tone ?? "neutral"] }}>{s.v.value}</div>
            <div style={{ font: "500 10.5px/1.2 var(--f-sans)", color: "var(--ink-mute)", marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </WCard>
  );
}
