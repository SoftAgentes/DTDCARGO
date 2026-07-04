"use client";

/**
 * BoardList · vista Lista de Bitácora (SDD-0146 · Fase 1 → columnas
 * configurables + agrupación "Por persona" en Fase 6).
 *
 * Dos modos (persistidos por navegador):
 *   · "Lista"       → tabla con COLUMNAS CONFIGURABLES (useColumnConfig +
 *     ColumnManager, regla Studio): Tarea/Estado/Prioridad/Dueño/Vence/
 *     Checklist/Reunión origen (orden + visibilidad guardados por usuario).
 *   · "Por persona" → agrupa por dueño (DRI) con barra de progreso hechas/total
 *     por persona + progreso global (el piloto del founder). Color solo para
 *     significado: el progreso usa UN token (--success), no arcoíris.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  ColumnManager,
  useColumnConfig,
  type ColumnLabels,
  type ColumnVisibility,
} from "@/app/studio/_components/ui/columns/ColumnConfig";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import {
  ESTADO_META,
  PRIORIDAD_META,
  ROLE_QUEUE_LABELS,
  nextEstado,
  type BitacoraTaskEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import { groupTasksByPerson } from "@/lib/studio/bitacora/grouping";
import { dueDateLabel } from "@/lib/studio/bitacora/dates";

interface Props {
  tasks: BitacoraTask[];
  nameByUserId: Record<string, string>;
  meetingTitleById: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  onMove: (taskId: string, estado: BitacoraTaskEstado) => void;
  onOpen: (task: BitacoraTask) => void;
}

type Mode = "lista" | "persona";
const MODE_KEY = "bitacora:lista-mode";

// ── Columnas configurables (regla Studio · handoff Norte) ──────────────
const COLS_KEY = "bitacora-lista-cols-v1";
const COLS_DEFAULT: ColumnVisibility[] = [
  { key: "tarea", visible: true },
  { key: "estado", visible: true },
  { key: "prioridad", visible: true },
  { key: "dueno", visible: true },
  { key: "vence", visible: true },
  { key: "checklist", visible: true },
  { key: "reunion", visible: false },
];

const COL_LABELS: ColumnLabels = {
  tarea: { label: "Tarea" },
  estado: { label: "Estado" },
  prioridad: { label: "Prioridad" },
  dueno: { label: "Dueño", hint: "responsable de la tarea (DRI)" },
  vence: { label: "Vence" },
  checklist: { label: "Checklist", hint: "puntos hechos / total" },
  reunion: { label: "Reunión origen", hint: "acta de la que nació" },
};

type ColDef = {
  key: string;
  label: string;
  width: string;
  align?: "right";
  render: (ctx: RenderCtx) => React.ReactNode;
};

type RenderCtx = {
  t: BitacoraTask;
  hoyISO: string;
  nameByUserId: Record<string, string>;
  meetingTitleById: Record<string, string>;
};

/** Texto del dueño (DRI → cola por rol → sin asignar con crudo visible). */
function ownerLabel(
  t: BitacoraTask,
  nameByUserId: Record<string, string>,
): string {
  if (t.assignees.length > 0) {
    return nameByUserId[t.assignees[0].user_id] ?? "Usuario";
  }
  if (t.assigned_role) {
    return `Cola ${
      ROLE_QUEUE_LABELS[t.assigned_role as keyof typeof ROLE_QUEUE_LABELS] ??
      t.assigned_role
    }`;
  }
  return t.responsable_nombre
    ? `Sin asignar (${t.responsable_nombre})`
    : "Sin asignar";
}

const COLUMNS: ColDef[] = [
  {
    key: "tarea",
    label: "Tarea",
    width: "minmax(220px, 2fr)",
    render: ({ t }) => (
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 12.5px/1.35 var(--f-sans)",
            color: "var(--ink)",
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
      </div>
    ),
  },
  {
    key: "estado",
    label: "Estado",
    width: "120px",
    render: ({ t }) => (
      <Badge tone={ESTADO_META[t.estado].tone} size="sm">
        {ESTADO_META[t.estado].label}
      </Badge>
    ),
  },
  {
    key: "prioridad",
    label: "Prioridad",
    width: "110px",
    render: ({ t }) => (
      <Badge tone={PRIORIDAD_META[t.prioridad].tone} size="sm">
        {PRIORIDAD_META[t.prioridad].label}
      </Badge>
    ),
  },
  {
    key: "dueno",
    label: "Dueño",
    width: "minmax(120px, 1fr)",
    render: ({ t, nameByUserId }) => (
      <span
        style={{
          font: "500 12px/1.3 var(--f-sans)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
      >
        {ownerLabel(t, nameByUserId)}
      </span>
    ),
  },
  {
    key: "vence",
    label: "Vence",
    width: "96px",
    render: ({ t, hoyISO }) => {
      const overdue =
        t.due_date != null && t.due_date < hoyISO && t.estado !== "hecho";
      return (
        <span
          style={{
            font: "500 12px/1.3 var(--f-sans)",
            color: overdue ? "var(--danger)" : "var(--ink)",
            fontWeight: overdue ? 700 : 500,
            whiteSpace: "nowrap",
          }}
        >
          {t.due_date ? dueDateLabel(t.due_date, hoyISO) : "—"}
        </span>
      );
    },
  },
  {
    key: "checklist",
    label: "Checklist",
    width: "92px",
    render: ({ t }) => {
      const done = t.checklist.filter((c) => c.done).length;
      return t.checklist.length > 0 ? (
        <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          {done}/{t.checklist.length}
        </code>
      ) : (
        <span style={{ color: "var(--ink-mute)" }}>—</span>
      );
    },
  },
  {
    key: "reunion",
    label: "Reunión origen",
    width: "minmax(120px, 1fr)",
    render: ({ t, meetingTitleById }) => {
      const title = t.meeting_id ? meetingTitleById[t.meeting_id] : null;
      return title ? (
        <span
          style={{
            font: "500 11.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {title}
        </span>
      ) : (
        <span style={{ color: "var(--ink-mute)" }}>—</span>
      );
    },
  },
];

const COL_MAP: Record<string, ColDef> = {};
for (const c of COLUMNS) COL_MAP[c.key] = c;

export function BoardList({
  tasks,
  nameByUserId,
  meetingTitleById,
  canEdit,
  hoyISO,
  onMove,
  onOpen,
}: Props) {
  const [mode, setMode] = useState<Mode>("lista");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "lista" || saved === "persona") setMode(saved);
    } catch {
      /* default */
    }
  }, []);
  const changeMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* en memoria */
    }
  };

  const [colCfg, setColCfg] = useColumnConfig(COLS_KEY, COLS_DEFAULT);

  return (
    <div>
      {/* Toolbar: modo + gestor de columnas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          role="tablist"
          aria-label="Modo de la lista"
          style={{
            display: "inline-flex",
            gap: 4,
            padding: 4,
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
          }}
        >
          {(
            [
              { v: "lista", label: "Lista" },
              { v: "persona", label: "Por persona" },
            ] as { v: Mode; label: string }[]
          ).map((o) => {
            const active = mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeMode(o.v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--r-sm)",
                  background: active ? "var(--bg-surface)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                  border: 0,
                  font: `${active ? "700" : "500"} 12px/1 var(--f-sans)`,
                  boxShadow: active ? "var(--shadow-xs)" : "none",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {mode === "lista" && (
          <div style={{ marginLeft: "auto" }}>
            <ColumnManager
              cfg={colCfg}
              setCfg={setColCfg}
              defaults={COLS_DEFAULT}
              labels={COL_LABELS}
            />
          </div>
        )}
      </div>

      {mode === "persona" ? (
        <PersonView
          tasks={tasks}
          nameByUserId={nameByUserId}
          hoyISO={hoyISO}
          canEdit={canEdit}
          onMove={onMove}
          onOpen={onOpen}
        />
      ) : (
        <TableView
          tasks={tasks}
          colCfg={colCfg}
          nameByUserId={nameByUserId}
          meetingTitleById={meetingTitleById}
          canEdit={canEdit}
          hoyISO={hoyISO}
          onMove={onMove}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tabla con columnas configurables
// ════════════════════════════════════════════════════════════════

function TableView({
  tasks,
  colCfg,
  nameByUserId,
  meetingTitleById,
  canEdit,
  hoyISO,
  onMove,
  onOpen,
}: {
  tasks: BitacoraTask[];
  colCfg: ColumnVisibility[];
  nameByUserId: Record<string, string>;
  meetingTitleById: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  onMove: (taskId: string, estado: BitacoraTaskEstado) => void;
  onOpen: (task: BitacoraTask) => void;
}) {
  // visibleColumns con .filter(Boolean): red de seguridad ante un key sin
  // entrada en el mapa (config vieja).
  const visibleColumns = colCfg
    .filter((c) => c.visible)
    .map((c) => COL_MAP[c.key])
    .filter(Boolean);
  const grid =
    visibleColumns.map((c) => c.width).join(" ") + (canEdit ? " 150px" : "");

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflowX: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
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
        {visibleColumns.map((col) => (
          <span
            key={col.key}
            style={col.align === "right" ? { textAlign: "right" } : undefined}
          >
            {col.label}
          </span>
        ))}
        {canEdit && <span aria-hidden />}
      </div>

      {/* Filas */}
      {tasks.map((t, i) => {
        const next = nextEstado(t.estado);
        return (
          <div
            key={t.id}
            onClick={() => onOpen(t)}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: grid,
              gap: 12,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              opacity: t.estado === "hecho" ? 0.65 : 1,
            }}
          >
            {visibleColumns.map((col) => (
              <div key={col.key} style={{ minWidth: 0 }}>
                {col.render({ t, hoyISO, nameByUserId, meetingTitleById })}
              </div>
            ))}
            {canEdit && (
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Vista "Por persona" con progreso
// ════════════════════════════════════════════════════════════════

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        style={{
          flex: 1,
          minWidth: 90,
          height: 6,
          borderRadius: "var(--r-pill)",
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--success)",
            borderRadius: "var(--r-pill)",
          }}
        />
      </div>
      <code
        style={{
          font: "700 11px/1 var(--f-mono)",
          color: "var(--ink-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {done}/{total}
      </code>
    </div>
  );
}

function PersonView({
  tasks,
  nameByUserId,
  hoyISO,
  canEdit,
  onMove,
  onOpen,
}: {
  tasks: BitacoraTask[];
  nameByUserId: Record<string, string>;
  hoyISO: string;
  canEdit: boolean;
  onMove: (taskId: string, estado: BitacoraTaskEstado) => void;
  onOpen: (task: BitacoraTask) => void;
}) {
  const { groups, globalDone, globalTotal } = groupTasksByPerson(
    tasks,
    nameByUserId,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Progreso global */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          className="studio-eyebrow"
          style={{ color: "var(--wine)", whiteSpace: "nowrap" }}
        >
          Progreso del equipo
        </span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <ProgressBar done={globalDone} total={globalTotal} />
        </div>
      </div>

      {/* Un bloque por persona */}
      {groups.map((g) => (
        <section
          key={g.key}
          aria-label={g.name}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                font: "700 13.5px/1.2 var(--f-sans)",
                color: g.userId ? "var(--ink)" : "var(--ink-soft)",
                whiteSpace: "nowrap",
              }}
            >
              {g.name}
            </span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <ProgressBar done={g.done} total={g.total} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.tasks.map((t) => {
              const next = nextEstado(t.estado);
              const overdue =
                t.due_date != null && t.due_date < hoyISO && t.estado !== "hecho";
              return (
                <div
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className="studio-tracking-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-elevated)",
                    cursor: "pointer",
                    opacity: t.estado === "hecho" ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: "600 12.5px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration:
                        t.estado === "hecho" ? "line-through" : "none",
                    }}
                  >
                    {t.titulo}
                  </span>
                  {t.due_date && (
                    <span
                      style={{
                        font: "700 10.5px/1 var(--f-sans)",
                        color: overdue ? "var(--danger)" : "var(--ink-soft)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dueDateLabel(t.due_date, hoyISO)}
                    </span>
                  )}
                  <Badge tone={ESTADO_META[t.estado].tone} size="sm">
                    {ESTADO_META[t.estado].label}
                  </Badge>
                  {canEdit && next && (
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(t.id, next);
                      }}
                      aria-label={`Pasar "${t.titulo}" a ${ESTADO_META[next].label}`}
                      style={{ flexShrink: 0 }}
                    >
                      {ESTADO_META[next].label} {Icon.arrowR(11)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
