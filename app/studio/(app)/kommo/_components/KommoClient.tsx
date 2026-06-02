"use client";

/**
 * Orquestador client del módulo Kommo CRM (SDD-0043) — SOLO LECTURA.
 *
 * - Header con estado de conexión + último sync (sin CTA: no se muta nada).
 * - KPIs: leads / contactos / embudos / etapas.
 * - Toolbar: filtro por embudo + búsqueda por nombre (URL state).
 * - Tabla de leads → con subdominio, la fila abre el lead en Kommo (pestaña
 *   nueva, solo ver). Sin subdominio, la fila NO es clickeable (no finge un
 *   destino inexistente).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { KommoFilters } from "@/lib/studio/kommo-queries";
import type {
  KommoLeadRow,
  KommoOverview,
  KommoPipelineRow,
  KommoStatusRow,
} from "@/lib/studio/kommo-types";

const GRID = "1.7fr 1.1fr 1fr 110px";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function connTone(status: string | null): BadgeTone {
  if (status === "active") return "success";
  if (status === "error") return "danger";
  return "neutral";
}

function connLabel(status: string | null): string {
  if (status === "active") return "Conectado";
  if (status === "error") return "Error de sync";
  if (status === "disabled") return "Desactivado";
  return "Sin conexión";
}

export function KommoClient({
  overview,
  pipelines,
  statuses,
  leads,
  filters,
}: {
  overview: KommoOverview;
  pipelines: KommoPipelineRow[];
  statuses: KommoStatusRow[];
  leads: KommoLeadRow[];
  filters: KommoFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [pipeline, setPipeline] = useState(params.get("pipeline") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setPipeline(params.get("pipeline") ?? "");
  }, [params]);

  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q, pipeline }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: { q?: string; pipeline?: string }) => {
    const s = new URLSearchParams();
    if (next.q && next.q.trim()) s.set("q", next.q.trim());
    if (next.pipeline) s.set("pipeline", next.pipeline);
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/kommo?${qs}` : "/studio/kommo");
    });
  };

  const pipelineName = new Map<number, string>(
    pipelines.map((p) => [p.id, p.name ?? `Embudo #${p.id}`]),
  );
  const statusName = new Map<string, string>(
    statuses.map((s) => [`${s.pipeline_id}:${s.id}`, s.name ?? `#${s.id}`]),
  );

  const hasFilters = Boolean(filters.q) || filters.pipeline !== "all";

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Comercial · Integración</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Kommo CRM.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Espejo <strong>solo lectura</strong> de tu cuenta Kommo. Se sincroniza
            una vez al día (o a demanda). Esta pantalla no modifica nada en Kommo.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <Badge tone={connTone(overview.connStatus)} dot>
            {connLabel(overview.connStatus)}
          </Badge>
          <span
            style={{
              font: "500 11.5px/1 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            Último sync: {fmtDateTime(overview.lastSyncAt)}
          </span>
          {!overview.subdomain && (
            <span
              style={{
                font: "500 11px/1.35 var(--f-sans)",
                color: "var(--ink-mute)",
                maxWidth: 220,
                textAlign: "right",
              }}
            >
              Configurá el subdominio de Kommo para abrir los leads.
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <KpiCard value={overview.leads} label="Leads" />
        <KpiCard value={overview.contacts} label="Contactos" />
        <KpiCard
          value={pipelines.length}
          label="Embudos"
          highlightWhenPositive={false}
        />
        <KpiCard
          value={statuses.length}
          label="Etapas"
          highlightWhenPositive={false}
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="kommo-q">
            Buscar lead
          </label>
          <input
            id="kommo-q"
            type="search"
            className="studio-input"
            placeholder="Nombre del lead…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 240px" }}>
          <label className="studio-label" htmlFor="kommo-pipeline">
            Embudo
          </label>
          <select
            id="kommo-pipeline"
            className="studio-input"
            value={pipeline}
            onChange={(e) => {
              setPipeline(e.target.value);
              pushFilters({ q, pipeline: e.target.value });
            }}
          >
            <option value="">Todos</option>
            {pipelines.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name ?? `Embudo #${p.id}`}
              </option>
            ))}
          </select>
        </div>
        {(q || pipeline) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setPipeline("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla o empty (atenúa al filtrar) */}
      <div
        style={{
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        {leads.length === 0 ? (
          <EmptyState
            eyebrow={hasFilters ? "Sin resultados" : "Sin leads"}
            title={
              hasFilters
                ? "Ningún lead coincide con estos filtros."
                : "Todavía no hay leads sincronizados."
            }
            description={
              hasFilters
                ? "Probá ajustar los filtros o limpiá la búsqueda."
                : "Corré el sync de Kommo para traer los leads al espejo."
            }
          />
        ) : (
          <LeadsTable
            leads={leads}
            pipelineName={pipelineName}
            statusName={statusName}
            subdomain={overview.subdomain}
          />
        )}
      </div>

      <p
        style={{
          font: "400 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          marginTop: 14,
        }}
      >
        Mostrando hasta 200 leads (más recientes primero). Datos espejados de Kommo
        · solo lectura.
      </p>
    </div>
  );
}

function LeadsTable({
  leads,
  pipelineName,
  statusName,
  subdomain,
}: {
  leads: KommoLeadRow[];
  pipelineName: Map<number, string>;
  statusName: Map<string, string>;
  subdomain: string | null;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 12,
          padding: "12px 20px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Lead</span>
        <span>Embudo</span>
        <span>Etapa</span>
        <span>Actualizado</span>
      </div>

      {leads.map((l, i) => {
        const href = subdomain
          ? `https://${subdomain}.kommo.com/leads/detail/${l.id}`
          : null;
        const etapa =
          l.pipeline_id != null && l.status_id != null
            ? statusName.get(`${l.pipeline_id}:${l.status_id}`) ?? "—"
            : "—";
        const embudo =
          l.pipeline_id != null ? pipelineName.get(l.pipeline_id) ?? "—" : "—";

        const rowStyle: CSSProperties = {
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 12,
          padding: "14px 20px",
          borderTop: i > 0 ? "1px solid var(--border)" : 0,
          alignItems: "center",
          textDecoration: "none",
          color: "inherit",
        };

        const cells = (
          <>
            <span
              style={{
                font: "600 13px/1.3 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {l.name || (
                <span style={{ color: "var(--ink-mute)" }}>(sin nombre)</span>
              )}
            </span>
            <span
              style={{
                font: "500 12.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {embudo}
            </span>
            <span>
              <Badge tone="neutral" size="sm">
                {etapa}
              </Badge>
            </span>
            <span
              style={{
                font: "500 11.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {fmtDate(l.kommo_updated_at)}
            </span>
          </>
        );

        return href ? (
          <a
            key={l.id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="studio-tracking-row"
            style={rowStyle}
          >
            {cells}
          </a>
        ) : (
          <div key={l.id} style={rowStyle}>
            {cells}
          </div>
        );
      })}
    </div>
  );
}
