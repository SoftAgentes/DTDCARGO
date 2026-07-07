"use client";

/**
 * Tablero CRM Kommo (SDD-0078) — orquestador client con 2 pestañas.
 *
 * - Header con estado de conexión + último sync (sin CTA: no se muta nada).
 * - Pestañas (?tab=): **Dirección** (slot server con el diagnóstico + cruce ERP)
 *   y **Asesor** (worklist accionable: tabla de leads + filtros + convertir).
 * - SOLO LECTURA del espejo: esta pantalla no modifica nada en Kommo.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { OwnerSlice } from "@/lib/studio/kommo-analytics";
import {
  KOMMO_AGE_OPTIONS,
  type KommoFilters,
  type KommoSort,
} from "@/lib/studio/kommo-queries";
import type {
  KommoLeadRow,
  KommoOverview,
  KommoPipelineRow,
  KommoStatusRow,
} from "@/lib/studio/kommo-types";
import { KOMMO_TABS, type KommoTabKey } from "./kommo-tabs.shared";
import { ConvertLeadDrawer } from "./ConvertLeadDrawer";

const GRID = "1.5fr 0.9fr 0.8fr 56px 96px 148px";
const DAY_MS = 86_400_000;

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

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

function ageTone(days: number | null): string {
  if (days == null) return "var(--ink-mute)";
  if (days >= 180) return "var(--danger)";
  if (days >= 30) return "var(--warning)";
  return "var(--ink-soft)";
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
  tab,
  direccion,
  tablero,
  overview,
  pipelines,
  statuses,
  leads,
  filters,
  convertedLeads,
  valueByLead,
  responsibleUsers,
}: {
  tab: KommoTabKey;
  /** Slot server-renderizado con el tablero Dirección. */
  direccion: ReactNode;
  /** Slot server-renderizado con el Tablero kanban del embudo. */
  tablero: ReactNode;
  overview: KommoOverview;
  pipelines: KommoPipelineRow[];
  statuses: KommoStatusRow[];
  leads: KommoLeadRow[];
  filters: KommoFilters;
  /** kommo_lead_id → markbox de los leads ya convertidos en cliente. */
  convertedLeads: Record<number, string>;
  /** kommo_lead_id → USD facturado (12m) de los leads convertidos. */
  valueByLead: Record<number, number>;
  /** Asesores presentes (para el filtro), ordenados desc por leads. */
  responsibleUsers: OwnerSlice[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Estado local de convertidos: parte del prop del server y se actualiza
  // optimista al convertir (monotónico: una vez convertido, sigue convertido).
  const [converted, setConverted] = useState(convertedLeads);
  useEffect(() => {
    setConverted((prev) => ({ ...convertedLeads, ...prev }));
  }, [convertedLeads]);

  const [convertingLead, setConvertingLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const onConverted = (leadId: number, markbox: string, created: boolean) => {
    setConverted((prev) => ({ ...prev, [leadId]: markbox }));
    setConvertingLead(null);
    toast.success(
      `Cliente ${markbox} ${created ? "creado" : "vinculado"} desde el lead`,
      {
        link: {
          href: `/studio/clientes/${markbox}?highlight=${markbox}&hl-tone=warm`,
          label: "Ver en Clientes",
        },
      },
    );
  };

  // ── Filtros del worklist (solo pestaña Asesor) ──
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: {
    q?: string;
    pipeline?: string;
    asesor?: string;
    aged?: string;
    sort?: string;
  }) => {
    const cur = {
      q: params.get("q") ?? "",
      pipeline: params.get("pipeline") ?? "",
      asesor: params.get("asesor") ?? "",
      aged: params.get("aged") ?? "",
      sort: params.get("sort") ?? "",
      ...next,
    };
    const s = new URLSearchParams();
    s.set("tab", "asesor");
    if (cur.q && cur.q.trim()) s.set("q", cur.q.trim());
    if (cur.pipeline) s.set("pipeline", cur.pipeline);
    if (cur.asesor) s.set("asesor", cur.asesor);
    if (cur.aged) s.set("aged", cur.aged);
    if (cur.sort) s.set("sort", cur.sort);
    startTransition(() => {
      router.push(`/studio/kommo?${s.toString()}`);
    });
  };

  const goTab = (key: KommoTabKey) => {
    if (key === tab) return;
    startTransition(() => {
      router.push(key === "direccion" ? "/studio/kommo" : `/studio/kommo?tab=${key}`);
    });
  };

  const pipelineName = new Map<number, string>(
    pipelines.map((p) => [p.id, p.name ?? `Embudo #${p.id}`]),
  );
  const statusName = new Map<string, string>(
    statuses.map((s) => [`${s.pipeline_id}:${s.id}`, s.name ?? `#${s.id}`]),
  );

  const pipeline = params.get("pipeline") ?? "";
  const asesor = params.get("asesor") ?? "";
  const aged = params.get("aged") ?? "";
  const sort: KommoSort = params.get("sort") === "oldest" ? "oldest" : "recent";
  const hasFilters = Boolean(filters.q) || Boolean(pipeline) || Boolean(asesor) || Boolean(aged);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 20,
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
            Tablero <strong>solo lectura</strong> del espejo de tu cuenta Kommo,
            cruzado con la plata real del ERP. Se sincroniza una vez al día. Esta
            pantalla no modifica nada en Kommo.
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
            style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            Último sync: {fmtDateTime(overview.lastSyncAt)}
          </span>
        </div>
      </div>

      {/* Pestañas */}
      <div
        role="tablist"
        aria-label="Tablero CRM"
        style={{
          display: "flex",
          gap: "var(--s-2)",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "var(--s-2)",
          marginBottom: 20,
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {KOMMO_TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-tab={t.key}
              onClick={() => goTab(t.key)}
              className="studio-btn studio-btn-sm"
              style={{
                background: isActive ? "var(--bg-elevated)" : "transparent",
                border: isActive
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
                color: isActive ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {tab === "direccion" ? (
        direccion
      ) : tab === "tablero" ? (
        tablero
      ) : (
        <>
          {/* Toolbar del worklist */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
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
            <div style={{ flex: "0 0 200px" }}>
              <label className="studio-label" htmlFor="kommo-pipeline">
                Embudo
              </label>
              <select
                id="kommo-pipeline"
                className="studio-input"
                value={pipeline}
                onChange={(e) => pushFilters({ pipeline: e.target.value })}
              >
                <option value="">Todos</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name ?? `Embudo #${p.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "0 0 180px" }}>
              <label className="studio-label" htmlFor="kommo-asesor">
                Asesor
              </label>
              <select
                id="kommo-asesor"
                className="studio-input"
                value={asesor}
                onChange={(e) => pushFilters({ asesor: e.target.value })}
              >
                <option value="">Todos</option>
                {responsibleUsers
                  .filter((o) => o.id != null)
                  .map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.label} ({o.count})
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ flex: "0 0 150px" }}>
              <label className="studio-label" htmlFor="kommo-aged">
                Antigüedad
              </label>
              <select
                id="kommo-aged"
                className="studio-input"
                value={aged}
                onChange={(e) => pushFilters({ aged: e.target.value })}
              >
                <option value="">Cualquiera</option>
                {KOMMO_AGE_OPTIONS.map((d) => (
                  <option key={d} value={String(d)}>
                    {`> ${d} días`}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "0 0 150px" }}>
              <label className="studio-label" htmlFor="kommo-sort">
                Orden
              </label>
              <select
                id="kommo-sort"
                className="studio-input"
                value={sort}
                onChange={(e) => pushFilters({ sort: e.target.value })}
              >
                <option value="recent">Recientes</option>
                <option value="oldest">Más viejos</option>
              </select>
            </div>
            {hasFilters && (
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{ height: 38 }}
                onClick={() =>
                  startTransition(() => router.push("/studio/kommo?tab=asesor"))
                }
              >
                Limpiar
              </button>
            )}
          </div>

          <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.12s" }}>
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
                    ? "Prueba ajustar los filtros o limpia la búsqueda."
                    : "Corre el sync de Kommo para traer los leads al espejo."
                }
              />
            ) : (
              <LeadsTable
                leads={leads}
                pipelineName={pipelineName}
                statusName={statusName}
                subdomain={overview.subdomain}
                converted={converted}
                valueByLead={valueByLead}
                onConvertClick={(l) =>
                  setConvertingLead({ id: l.id, name: l.name || "(sin nombre)" })
                }
              />
            )}
          </div>

          <p
            style={{
              font: "400 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 14,
            }}
          >
            Mostrando hasta 200 leads. Valor = facturado en el ERP si el lead ya es
            cliente; si no, el price de Kommo. Datos espejados · solo lectura.
          </p>
        </>
      )}

      {convertingLead && (
        <ConvertLeadDrawer
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
          onConverted={onConverted}
        />
      )}
    </div>
  );
}

function LeadsTable({
  leads,
  pipelineName,
  statusName,
  subdomain,
  converted,
  valueByLead,
  onConvertClick,
}: {
  leads: KommoLeadRow[];
  pipelineName: Map<number, string>;
  statusName: Map<string, string>;
  subdomain: string | null;
  converted: Record<number, string>;
  valueByLead: Record<number, number>;
  onConvertClick: (lead: KommoLeadRow) => void;
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
      {/* Scroll de rescate en anchos chicos: la fila de acción no se aplasta. */}
      <div style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Leads de Kommo" style={{ minWidth: 680 }}>
          {/* Header */}
          <div
            role="row"
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
            <span role="columnheader">Lead</span>
            <span role="columnheader">Embudo</span>
            <span role="columnheader">Etapa</span>
            <span role="columnheader" style={{ textAlign: "right" }}>
              Días
            </span>
            <span role="columnheader" style={{ textAlign: "right" }}>
              Valor
            </span>
            <span role="columnheader" style={{ textAlign: "right" }}>
              Cliente DTD
            </span>
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
              l.pipeline_id != null
                ? pipelineName.get(l.pipeline_id) ?? "—"
                : "—";
            const markbox = converted[l.id];
            const days = daysSince(l.kommo_updated_at);
            const erpVal = valueByLead[l.id];
            const kommoPrice = Number(l.price) || 0;

            const nameStyle: CSSProperties = {
              display: "block",
              font: "600 13px/1.3 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            };
            const nameContent = l.name || "(sin nombre)";

            return (
              <div
                key={l.id}
                role="row"
                className="studio-row-hover"
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                }}
              >
                <span role="cell" style={{ minWidth: 0, overflow: "hidden" }}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir el lead en Kommo (pestaña nueva)"
                      className="studio-link-quiet"
                      style={nameStyle}
                    >
                      {nameContent}
                    </a>
                  ) : (
                    <span
                      style={{
                        ...nameStyle,
                        color: l.name ? "var(--ink)" : "var(--ink-mute)",
                      }}
                    >
                      {nameContent}
                    </span>
                  )}
                </span>
                <span
                  role="cell"
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
                <span role="cell">
                  <Badge tone="neutral" size="sm">
                    {etapa}
                  </Badge>
                </span>
                <span
                  role="cell"
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: ageTone(days),
                    textAlign: "right",
                  }}
                  title={days == null ? "Sin fecha" : `${days} días sin moverse`}
                >
                  {days == null ? "—" : days}
                </span>
                <span
                  role="cell"
                  style={{ textAlign: "right" }}
                  title={
                    erpVal != null
                      ? "Facturado en el ERP (12m)"
                      : kommoPrice > 0
                        ? "Valor en Kommo"
                        : "Sin valor"
                  }
                >
                  {erpVal != null ? (
                    <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--success)" }}>
                      {fmtUsd(erpVal)}
                    </span>
                  ) : kommoPrice > 0 ? (
                    <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      {fmtUsd(kommoPrice)}
                    </span>
                  ) : (
                    <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                      —
                    </span>
                  )}
                </span>
                <span role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>
                  {markbox ? (
                    <Link
                      href={`/studio/clientes/${markbox}`}
                      title="Ver el cliente en el Studio"
                      style={{ textDecoration: "none" }}
                    >
                      <Badge tone="success" size="sm">
                        {markbox}
                      </Badge>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="studio-btn studio-btn-dark studio-btn-sm"
                      onClick={() => onConvertClick(l)}
                    >
                      Convertir a cliente
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
