/**
 * Tablero CRM · pestaña Dirección (SDD-0078).
 *
 * Presentacional puro (sin hooks → server-renderable; se pasa como slot al
 * KommoClient client). Muestra el diagnóstico de SDD-0062 en vivo + el cruce con
 * la plata real del ERP. Reusa KpiCard + Progress (mini-charts de Reportes) +
 * EmptyState. Solo tokens `var(--*)` (regla de marca).
 */

import type { ReactNode } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Progress } from "@/app/studio/(app)/reportes/_components/charts";
import type { KommoDireccionData, OwnerSlice } from "@/lib/studio/kommo-analytics";

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function pct1(n: number): string {
  return `${n.toFixed(n < 10 ? 1 : 0)}%`;
}

/** % de conversión legible cuando el valor es positivo pero redondea a 0. */
function fmtConvPct(n: number): string {
  if (n <= 0) return "0%";
  if (n < 0.1) return "<0.1%";
  return pct1(n);
}

// ── Wrappers visuales ──────────────────────────────────────────
function SectionCard({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "18px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <span className="studio-eyebrow">{eyebrow}</span>
        <h2
          className="studio-display"
          style={{ fontSize: 17, margin: "6px 0 0", color: "var(--ink)" }}
        >
          {title}
        </h2>
        {hint && (
          <p
            style={{
              font: "400 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
              margin: "4px 0 0",
            }}
          >
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Fila: etiqueta + barra de progreso + conteo + %. */
function BarRow({
  label,
  count,
  pct,
  tone,
  badge,
}: {
  label: string;
  count: number;
  pct: number;
  tone: string;
  badge?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            font: "600 12.5px/1.3 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          {badge && (
            <Badge tone="danger" size="sm">
              {badge}
            </Badge>
          )}
        </span>
        <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>
          {count}
        </span>
        <span
          style={{
            font: "600 11px/1 var(--f-mono)",
            color: "var(--ink-mute)",
            minWidth: 42,
            textAlign: "right",
          }}
        >
          {pct1(pct)}
        </span>
      </div>
      <Progress value={pct} tone={tone} height={7} />
    </div>
  );
}

export function DireccionTab({ data }: { data: KommoDireccionData }) {
  if (data.totals.leads === 0) {
    return (
      <EmptyState
        eyebrow="Sin datos"
        title="Todavía no hay leads sincronizados."
        description="Corre el sync de Kommo para traer el embudo al espejo y ver el tablero."
      />
    );
  }

  const { conversion, email, funnel, aging, ownership, value, convertedCount } =
    data;

  // Cartera: top 6 + "Otros" colapsado para el chart.
  const topOwners = ownership.owners.slice(0, 6);
  const restOwners = ownership.owners.slice(6);
  const restCount = restOwners.reduce((s, o) => s + o.count, 0);
  const chartOwners: OwnerSlice[] = restOwners.length
    ? [
        ...topOwners,
        {
          id: null,
          label: `Otros (${restOwners.length})`,
          count: restCount,
          pct: ownership.total ? (restCount / ownership.total) * 100 : 0,
        },
      ]
    : topOwners;

  const emailTone =
    email.pct >= 40 ? "var(--success)" : email.pct >= 15 ? "var(--warning)" : "var(--danger)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(184px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={data.totals.leads} label="Leads" highlightWhenPositive={false} />
        <KpiCard value={data.totals.contacts} label="Contactos" highlightWhenPositive={false} />
        <KpiCard
          value={fmtConvPct(conversion.closedRatePct)}
          label="Conversión Kommo"
          valueColor={conversion.closedRatePct < 1 ? "var(--danger)" : "var(--ink)"}
          sub={`${conversion.won} ganados · ${conversion.lost} perdidos (histórico)`}
        />
        <KpiCard
          value={convertedCount}
          label="Convertidos a cliente"
          valueColor="var(--wine)"
          sub="Leads que ya son cliente DTD"
        />
        <KpiCard
          value={pct1(email.pct)}
          label="Cobertura email"
          valueColor={emailTone}
          sub={`${email.withEmail} de ${email.total} contactos`}
        />
        <KpiCard
          value={fmtUsd(value.erpBilledUsd)}
          label="Valor real ERP"
          valueColor="var(--success)"
          sub="Facturado (12m) de leads convertidos"
        />
      </div>

      {/* 2 columnas: embudo + cementerio */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          eyebrow="Embudo principal"
          title={funnel.pipelineName}
          hint={`${funnel.total} leads en este embudo`}
        >
          {funnel.stages.length === 0 ? (
            <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
              Sin etapas en el embudo principal.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {funnel.stages.map((s) => (
                <BarRow
                  key={s.id}
                  label={s.name}
                  count={s.count}
                  pct={s.pct}
                  tone={s.tone}
                  badge={s.isBottleneck ? "Cuello" : undefined}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Antigüedad"
          title="Cementerio del embudo"
          hint="Tiempo sin moverse (kommo_updated_at)"
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                font: "900 30px/1 var(--f-display)",
                fontVariantNumeric: "tabular-nums",
                color: aging.medianDays >= 180 ? "var(--danger)" : "var(--ink)",
                letterSpacing: "-0.02em",
              }}
            >
              {aging.medianDays}
            </span>
            <span style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
              días · mediana sin movimiento
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {aging.buckets.map((b) => (
              <BarRow key={b.key} label={b.label} count={b.count} pct={b.pct} tone={b.tone} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 2 columnas: cartera + valor */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          eyebrow="Cartera"
          title="Concentración por asesor"
          hint={
            ownership.dominant
              ? `${ownership.dominant.label} concentra ${pct1(ownership.dominant.pct)} de los leads`
              : undefined
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chartOwners.map((o, i) => (
              <BarRow
                key={o.id ?? `otros-${i}`}
                label={o.label}
                count={o.count}
                pct={o.pct}
                tone={
                  o.pct >= 90
                    ? "var(--danger)"
                    : i === 0
                      ? "var(--wine)"
                      : "var(--info)"
                }
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Valor"
          title="Kommo vs ERP"
          hint="Kommo no ve la plata del ERP — este cruce sí."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 130px" }}>
                <div
                  style={{
                    font: "900 26px/1 var(--f-display)",
                    fontVariantNumeric: "tabular-nums",
                    color: value.kommoPipelineValueUsd > 0 ? "var(--ink)" : "var(--danger)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {fmtUsd(value.kommoPipelineValueUsd)}
                </div>
                <div
                  style={{
                    font: "600 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginTop: 6,
                  }}
                >
                  Valor en Kommo
                </div>
                <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 4 }}>
                  Σ price de los leads
                </div>
              </div>
              <div style={{ flex: "1 1 130px" }}>
                <div
                  style={{
                    font: "900 26px/1 var(--f-display)",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--success)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {fmtUsd(value.erpBilledUsd)}
                </div>
                <div
                  style={{
                    font: "600 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginTop: 6,
                  }}
                >
                  Facturado en el ERP
                </div>
                <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 4 }}>
                  {value.convertedWithBilling} de {value.convertedCount} leads convertidos facturan
                </div>
              </div>
            </div>
            <p
              style={{
                font: "400 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              El embudo de Kommo está ciego al dinero (price ≈ $0). El valor real vive en el ERP
              (facturas) y se ata al lead cuando se convierte a cliente.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
