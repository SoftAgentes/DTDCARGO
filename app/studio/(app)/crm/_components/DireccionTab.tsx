import { billingStatus, formatAnnualUsd } from "@/lib/shared/annual-billing";
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
import type { WritebackGate, WritebackStatus } from "@/lib/studio/kommo-writeback";
import type {
  KommoCustomFieldRow,
  KommoPipelineRow,
  KommoStageMap,
  KommoStatusRow,
} from "@/lib/studio/kommo-types";
import { StageMapConfig } from "./StageMapConfig";
import { MarkboxFieldConfig } from "./MarkboxFieldConfig";
import { fmtUsd } from "@/lib/money";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wbGateLabel(g: WritebackGate): string {
  return g === "live" ? "Activo" : g === "dry_run" ? "Dry-run (ensayo)" : "Apagado";
}
function wbGateTone(g: WritebackGate): "success" | "warning" | "neutral" {
  return g === "live" ? "success" : g === "dry_run" ? "warning" : "neutral";
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
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
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
            color: "var(--ink-soft)",
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

/**
 * Stat compacto del panel de write-back (más chico que KpiCard, para el 4-up).
 * El dígito va SIEMPRE en `var(--ink)` (convención del sistema); el estado lo
 * comunica un punto de color (`tone`) junto al label — no se colorea el número
 * grande (evita warning/ink-soft como texto display, ui-ux SDD-0083).
 */
function WbStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          font: "800 20px/1 var(--f-display)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: tone,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            font: "600 10px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function DireccionTab({
  data,
  writeback,
  pipelines,
  statuses,
  stageMap,
  canEditStageMap,
  markboxFields,
  markboxFieldId,
  markboxContactFields,
  markboxContactFieldId,
}: {
  data: KommoDireccionData;
  writeback: WritebackStatus | null;
  pipelines: KommoPipelineRow[];
  statuses: KommoStatusRow[];
  stageMap: KommoStageMap;
  canEditStageMap: boolean;
  markboxFields: KommoCustomFieldRow[];
  markboxFieldId: number | null;
  markboxContactFields: KommoCustomFieldRow[];
  markboxContactFieldId: number | null;
}) {
  if (data.totals.leads === 0) {
    return (
      <EmptyState
        eyebrow="Sin datos"
        title="Todavía no hay leads sincronizados."
        description="Corre la sincronización para traer el embudo al espejo y ver el tablero."
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
      {/* Lectura incompleta: TODO lo de abajo sería una muestra, no el total.
          Decirlo es el punto — un tablero que subcuenta en silencio es peor
          que uno que no carga (el 2026-08-11 mostró 1.000 de 3.145 sin avisar). */}
      {!data.complete && (
        <div
          role="alert"
          style={{
            border: "1px solid var(--warning)",
            background: "var(--warning-bg)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-3) var(--s-4)",
            font: "500 12.5px/1.45 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <strong>Estos números son parciales.</strong> No se pudo leer el espejo
          completo, así que los totales, el embudo, la antigüedad y la cartera
          salen de una muestra. No los uses para decidir hasta que la
          sincronización vuelva a completarse.
        </div>
      )}

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
        {/*
          Conversión = ganados sobre los que YA se decidieron, no sobre el total.
          Antes pintaba `closedRatePct` (cuántos llegaron a un estado final) con
          esta misma etiqueta, y decía 96% cuando la real era 8,0%. El `sub`
          ahora muestra el denominador completo para que el número se pueda
          reconstruir a ojo.
        */}
        <KpiCard
          value={fmtConvPct(conversion.wonOfClosedPct)}
          label="Conversión del CRM"
          valueColor={
            conversion.closed > 0 && conversion.won === 0
              ? "var(--danger)"
              : "var(--ink)"
          }
          sub={`${conversion.won} ganados · ${conversion.lost} perdidos · ${conversion.open} abiertos`}
        />
        <KpiCard
          value={convertedCount ?? "—"}
          label="Convertidos a cliente"
          valueColor="var(--wine-text)"
          sub="Leads que ya son cliente DTD"
        />
        <KpiCard
          value={pct1(email.pct)}
          label="Cobertura email"
          valueColor={emailTone}
          sub={`${email.withEmail} de ${email.total} contactos`}
        />
        <KpiCard
          value={formatAnnualUsd(value.billing.subtotalUsd)}
          label="Facturación ERP atribuida"
          valueColor={value.billing.state === "completo" ? "var(--success)" : "var(--ink-soft)"}
          sub={billingStatus(value.billing)}
          style={{ overflowWrap: "anywhere" }}
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
            <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
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
          title="CRM vs ERP"
          hint="El CRM no ve la plata del ERP — este cruce sí."
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
                  Valor en el CRM
                </div>
                <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
                  Σ price de los leads
                </div>
              </div>
              <div style={{ flex: "1 1 130px", minWidth: 0, overflowWrap: "anywhere" }}>
                <div
                  style={{
                    font: "900 26px/1 var(--f-display)",
                    fontVariantNumeric: "tabular-nums",
                    color: value.billing.state === "completo" ? "var(--success)" : "var(--ink-soft)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatAnnualUsd(value.billing.subtotalUsd)}
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
                  {billingStatus(value.billing)}
                </div>
                <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
                  {value.convertedWithBilling ?? "—"} de {value.convertedCount ?? "—"} leads convertidos tienen facturación positiva completa. Atribución por lead; no es facturación única del tenant.
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
              El embudo del CRM está ciego al dinero (valor ≈ $0). El valor real vive en el ERP
              (facturas) y se ata al lead cuando se convierte a cliente.
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Write-back a Kommo (SDD-0083): estado del canal de escritura + cola. */}
      {writeback && (
        <SectionCard
          eyebrow="Integración"
          title="Escritura al CRM"
          hint="Manda el valor del estimado al lead. Nace apagado; míralo antes de prenderlo."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Badge tone={wbGateTone(writeback.gate)}>
                {wbGateLabel(writeback.gate)}
              </Badge>
              <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                {writeback.lastDrainAt
                  ? `Último drain: ${fmtDateTime(writeback.lastDrainAt)}${writeback.lastDrainEntity === "writeback_dryrun" ? " · ensayo" : ""}`
                  : "Todavía no corrió el drain"}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
              }}
            >
              <WbStat
                label="Pendientes"
                value={writeback.counts.pending}
                tone={writeback.counts.pending > 0 ? "var(--warning)" : "var(--ink)"}
              />
              <WbStat label="Enviados" value={writeback.counts.sent} tone="var(--success)" />
              <WbStat
                label="Saltados (dry-run)"
                value={writeback.counts.skipped}
                tone="var(--ink-soft)"
              />
              <WbStat
                label="Con error"
                value={writeback.counts.error}
                tone={writeback.counts.error > 0 ? "var(--danger)" : "var(--ink)"}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Mapa de etapas (SDD-0084): a qué etapa de Kommo mover el lead por estado. */}
      <SectionCard
        eyebrow="Automatización"
        title="Mapa de etapas"
        hint="A qué etapa mover el lead cuando el estimado cambia de estado."
      >
        <StageMapConfig
          pipelines={pipelines}
          statuses={statuses}
          initial={stageMap}
          canEdit={canEditStageMap}
        />
      </SectionCard>

      {/* MARKBOX → Kommo (SDD-0086): campo del lead donde va el Shipping Mark. */}
      <SectionCard
        eyebrow="Identidad"
        title="Shipping Mark en el CRM"
        hint="En qué campo del lead escribir el Shipping Mark cuando se convierte en cliente."
      >
        <MarkboxFieldConfig
          fields={markboxFields}
          initialFieldId={markboxFieldId}
          canEdit={canEditStageMap}
        />
      </SectionCard>

      {/* SDD-0244 rebanada B: la marca PERMANENTE, en el contacto. El campo del
          lead de arriba se lo lleva el trato al cerrarse; este sobrevive. */}
      <SectionCard
        eyebrow="Identidad"
        title="Shipping Mark en el contacto"
        hint="El campo permanente: sobrevive al cierre del trato y hace que el cliente que vuelve se reconozca solo."
      >
        <MarkboxFieldConfig
          entity="contacts"
          fields={markboxContactFields}
          initialFieldId={markboxContactFieldId}
          canEdit={canEditStageMap}
        />
      </SectionCard>
    </div>
  );
}
