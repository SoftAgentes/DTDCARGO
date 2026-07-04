"use client";

/**
 * BoardList · vista de tabla básica de Bitácora (SDD-0146 · Fase 1).
 * Columnas configurables + agrupación por persona llegan en Fase 6.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import {
  ESTADO_META,
  PRIORIDAD_META,
  ROLE_QUEUE_LABELS,
  nextEstado,
  type BitacoraTaskEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import { dueDateLabel } from "@/lib/studio/bitacora/dates";

interface Props {
  tasks: BitacoraTask[];
  nameByUserId: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  onMove: (taskId: string, estado: BitacoraTaskEstado) => void;
  onOpen: (task: BitacoraTask) => void;
}

const TH: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  font: "700 10.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  font: "500 12.5px/1.35 var(--f-sans)",
  color: "var(--ink)",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

export function BoardList({
  tasks,
  nameByUserId,
  canEdit,
  hoyISO,
  onMove,
  onOpen,
}: Props) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflowX: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Tarea</th>
            <th style={TH}>Estado</th>
            <th style={TH}>Prioridad</th>
            <th style={TH}>Vence</th>
            <th style={TH}>Dueño</th>
            <th style={TH}>Checklist</th>
            {canEdit && <th style={TH} aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const estado = ESTADO_META[t.estado];
            const prio = PRIORIDAD_META[t.prioridad];
            const next = nextEstado(t.estado);
            const doneCount = t.checklist.filter((c) => c.done).length;
            const overdue =
              t.due_date != null && t.due_date < hoyISO && t.estado !== "hecho";
            const owner =
              t.assignees.length > 0
                ? (nameByUserId[t.assignees[0].user_id] ?? "Usuario")
                : t.assigned_role
                  ? `Cola ${
                      ROLE_QUEUE_LABELS[
                        t.assigned_role as keyof typeof ROLE_QUEUE_LABELS
                      ] ?? t.assigned_role
                    }`
                  : t.responsable_nombre
                    ? `Sin asignar (${t.responsable_nombre})`
                    : "Sin asignar";
            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                style={{
                  cursor: "pointer",
                  opacity: t.estado === "hecho" ? 0.65 : 1,
                }}
              >
                <td style={{ ...TD, maxWidth: 380 }}>
                  <div
                    style={{
                      font: "700 12.5px/1.35 var(--f-sans)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.titulo}
                  </div>
                  {t.tipo === "entregable_cliente" && (
                    <Badge tone="warning" size="sm" style={{ marginTop: 4 }}>
                      Esperando al cliente
                    </Badge>
                  )}
                </td>
                <td style={TD}>
                  <Badge tone={estado.tone} size="sm">
                    {estado.label}
                  </Badge>
                </td>
                <td style={TD}>
                  <Badge tone={prio.tone} size="sm">
                    {prio.label}
                  </Badge>
                </td>
                <td
                  style={{
                    ...TD,
                    color: overdue ? "var(--danger)" : "var(--ink)",
                    fontWeight: overdue ? 700 : 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.due_date ? dueDateLabel(t.due_date, hoyISO) : "—"}
                </td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{owner}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>
                  {t.checklist.length > 0 ? (
                    <code style={{ font: "700 12px/1 var(--f-mono)" }}>
                      {doneCount}/{t.checklist.length}
                    </code>
                  ) : (
                    "—"
                  )}
                </td>
                {canEdit && (
                  <td style={{ ...TD, whiteSpace: "nowrap", textAlign: "right" }}>
                    {next && (
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(t.id, next);
                        }}
                        aria-label={`Pasar "${t.titulo}" a ${ESTADO_META[next].label}`}
                      >
                        {ESTADO_META[next].label} {Icon.arrowR(11)}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
