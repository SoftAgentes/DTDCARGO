"use client";

/**
 * Orquestador client del módulo Inspecciones (SDD-0066 · Fase 1).
 *
 * KPIs del mes + filtros (tipo / estado / cliente) + tabla del listado + drawer
 * de alta/edición de la CABECERA. El builder completo del payload y el preview
 * imprimible (window.print con report.css portado) llegan en Fase 2/3.
 */

import { useState, useTransition, type CSSProperties } from "react";
import {
  INSPECTION_TYPE_FILTERS,
  INSPECTION_STATUS_FILTERS,
  inspectionTypeShort,
  inspectionTypeTone,
  inspectionConclusionLabel,
  inspectionConclusionTone,
  inspectionStatusLabel,
  inspectionStatusTone,
  inspectionMatchesFilters,
  type InspectionReport,
  type InspectionKpis,
  type InspectionTypeFilter,
  type InspectionStatusFilter,
} from "@/lib/studio/inspecciones/types";
import type { InspectionClientOption } from "@/lib/studio/inspecciones/queries";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";
import { softDeleteInspectionReportAction } from "../actions";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { InspeccionDrawer } from "./InspeccionDrawer";
import { ReportEditor } from "./ReportEditor";

type DrawerState =
  | null
  | { mode: "create" }
  | { mode: "edit"; report: InspectionReport };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TH: CSSProperties = {
  font: "700 10px/1.2 var(--f-sans)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  textAlign: "left",
  padding: "11px 14px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

export function InspeccionesClient({
  reports,
  clients,
  kpis,
  photos,
  canEdit,
}: {
  reports: InspectionReport[];
  clients: InspectionClientOption[];
  kpis: InspectionKpis;
  photos: Record<string, InspectionPhotoItem[]>;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [editing, setEditing] = useState<InspectionReport | null>(null);
  const [typeFilter, setTypeFilter] = useState<InspectionTypeFilter>("todos");
  const [statusFilter, setStatusFilter] =
    useState<InspectionStatusFilter>("todos");
  const [clientFilter, setClientFilter] = useState<string>("todos");

  const rows = reports.filter((r) =>
    inspectionMatchesFilters(r, typeFilter, statusFilter, clientFilter),
  );

  const clientNameById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div style={{ maxWidth: 1200 }}>
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
          <span className="studio-eyebrow">Operación · Calidad</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Inspecciones de calidad.
          </h1>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "66ch",
            }}
          >
            Reportes white-label de inspección de producto (PSI / AQL) y
            auditoría de fábrica, con marca DTD. El proveedor que ejecuta la
            inspección es interno y nunca aparece en el reporte al cliente.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setDrawer({ mode: "create" })}
          >
            + Nuevo reporte
          </button>
        )}
      </div>

      {/* KPIs del mes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <KpiCard
          label="Inspecciones del mes"
          value={kpis.month_count}
          sub="con fecha en el mes corriente"
        />
        <KpiCard
          label="Aprobadas"
          value={kpis.month_approved}
          sub="del mes"
          valueColor={kpis.month_approved > 0 ? "var(--success)" : "var(--ink)"}
          highlightWhenPositive={false}
        />
        <KpiCard
          label="Con observaciones"
          value={kpis.month_observed}
          sub="observadas o rechazadas"
          valueColor={kpis.month_observed > 0 ? "var(--warning)" : "var(--ink)"}
          highlightWhenPositive={false}
        />
        <KpiCard label="Borradores" value={kpis.draft_count} sub="sin emitir" />
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label className="studio-label" htmlFor="ins-f-type">
            Tipo
          </label>
          <select
            id="ins-f-type"
            className="studio-input"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as InspectionTypeFilter)
            }
            style={{ minWidth: 180 }}
          >
            {INSPECTION_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="studio-label" htmlFor="ins-f-status">
            Estado
          </label>
          <select
            id="ins-f-status"
            className="studio-input"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as InspectionStatusFilter)
            }
            style={{ minWidth: 140 }}
          >
            {INSPECTION_STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="studio-label" htmlFor="ins-f-client">
            Cliente
          </label>
          <select
            id="ins-f-client"
            className="studio-input"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="todos">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.markbox} · {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla o empty */}
      {rows.length === 0 ? (
        reports.length === 0 ? (
          <EmptyState
            eyebrow="Sin reportes"
            title="No hay reportes de inspección."
            description="Crea un reporte para re-capturar los datos de una inspección de producto o de una auditoría de fábrica con marca DTD."
            action={
              canEdit ? (
                <button
                  type="button"
                  className="studio-btn studio-btn-primary"
                  onClick={() => setDrawer({ mode: "create" })}
                >
                  + Nuevo reporte
                </button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            eyebrow="Sin resultados"
            title="Ningún reporte coincide con estos filtros."
            description="Prueba con otro tipo, estado o cliente."
          />
        )
      ) : (
        <ReportsTable
          rows={rows}
          clientNameById={clientNameById}
          canEdit={canEdit}
          onOpen={(report) => setEditing(report)}
          onEdit={(report) => setDrawer({ mode: "edit", report })}
          onDeleted={(no) => toast.success(`Reporte ${no} eliminado`)}
        />
      )}

      {drawer && (
        <InspeccionDrawer
          mode={drawer.mode}
          report={drawer.mode === "edit" ? drawer.report : undefined}
          clients={clients}
          onClose={() => setDrawer(null)}
        />
      )}

      {editing && (
        <ReportEditor
          report={editing}
          photos={photos[editing.id] ?? []}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Tabla ───────────────────────────────────────────────────────
function ReportsTable({
  rows,
  clientNameById,
  canEdit,
  onOpen,
  onEdit,
  onDeleted,
}: {
  rows: InspectionReport[];
  clientNameById: Map<string, InspectionClientOption>;
  canEdit: boolean;
  onOpen: (report: InspectionReport) => void;
  onEdit: (report: InspectionReport) => void;
  onDeleted: (no: string) => void;
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
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            {[
              "Reporte",
              "Tipo",
              "Título",
              "Cliente",
              "Fecha",
              "Conclusión",
              "Estado",
              "",
            ].map((h, i) => (
              <th
                key={i}
                style={{ ...TH, textAlign: i === 7 ? "right" : "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const client =
              (r.client_id && clientNameById.get(r.client_id)) || null;
            const clientLabel = client
              ? `${client.markbox} · ${client.name}`
              : (r.client_name ?? "—");
            return (
              <tr
                key={r.id}
                style={{
                  borderBottom:
                    i < rows.length - 1 ? "1px solid var(--border)" : "0",
                }}
              >
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12px/1 var(--f-mono)",
                    color: "var(--wine)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.report_no}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={inspectionTypeTone(r.type)} size="sm">
                    {inspectionTypeShort(r.type)}
                  </Badge>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 13px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    maxWidth: 240,
                  }}
                >
                  {r.title}
                  {r.product && (
                    <span
                      style={{
                        display: "block",
                        font: "400 11.5px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {r.product}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "500 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {clientLabel}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "500 12px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtDate(r.inspection_date)}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {r.conclusion ? (
                    <Badge
                      tone={inspectionConclusionTone(r.conclusion)}
                      size="sm"
                    >
                      {inspectionConclusionLabel(r.conclusion)}
                    </Badge>
                  ) : (
                    <span
                      style={{
                        font: "500 12px/1 var(--f-sans)",
                        color: "var(--ink-mute)",
                      }}
                    >
                      —
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={inspectionStatusTone(r.status)} size="sm">
                    {inspectionStatusLabel(r.status)}
                  </Badge>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="studio-btn studio-btn-dark studio-btn-sm"
                      onClick={() => onOpen(r)}
                    >
                      Abrir
                    </button>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="studio-btn studio-btn-ghost studio-btn-sm"
                          onClick={() => onEdit(r)}
                        >
                          Editar
                        </button>
                        <DeleteReportButton
                          reportId={r.id}
                          onDeleted={() => onDeleted(r.report_no)}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Botón eliminar con confirmación inline ──────────────────────
function DeleteReportButton({
  reportId,
  onDeleted,
}: {
  reportId: string;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirm) {
    return (
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        style={{ color: "var(--danger)" }}
        onClick={() => setConfirm(true)}
      >
        Eliminar
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        className="studio-btn studio-btn-danger studio-btn-sm"
        disabled={isDeleting}
        onClick={() =>
          startDelete(async () => {
            const res = await softDeleteInspectionReportAction(reportId);
            if (res.error) setError(res.error);
            else onDeleted();
          })
        }
      >
        {isDeleting ? "Eliminando…" : "Sí, eliminar"}
      </button>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        onClick={() => setConfirm(false)}
        disabled={isDeleting}
      >
        No
      </button>
      {error && (
        <span
          role="alert"
          style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--danger)" }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
