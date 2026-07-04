"use client";

/**
 * BoardKanban · tablero de 4 columnas con drag & drop HTML5 NATIVO
 * (draggable + onDragStart/onDragOver/onDrop — sin @dnd-kit, decisión SDD-0146).
 *
 * La acción táctil primaria es el botón de avance por tarjeta (fallback para
 * touch: el DnD nativo no existe en móvil). Click en la tarjeta abre el drawer.
 */

import { useRef, useState, type DragEvent } from "react";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import {
  BITACORA_TASK_ESTADOS,
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

export function BoardKanban({
  tasks,
  nameByUserId,
  canEdit,
  hoyISO,
  onMove,
  onOpen,
}: Props) {
  const [overCol, setOverCol] = useState<BitacoraTaskEstado | null>(null);
  // El drop nativo dispara un click fantasma en algunos browsers → guard.
  const draggingRef = useRef(false);

  const byEstado = (estado: BitacoraTaskEstado) =>
    tasks.filter((t) => t.estado === estado);

  const handleDrop = (e: DragEvent, estado: BitacoraTaskEstado) => {
    e.preventDefault();
    setOverCol(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.estado === estado) return;
    onMove(id, estado);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
        gap: 12,
        alignItems: "start",
        overflowX: "auto",
      }}
    >
      {BITACORA_TASK_ESTADOS.map((estado) => {
        const col = byEstado(estado);
        const meta = ESTADO_META[estado];
        const isOver = overCol === estado;
        return (
          <section
            key={estado}
            aria-label={`Columna ${meta.label}`}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setOverCol(estado);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setOverCol((c) => (c === estado ? null : c));
            }}
            onDrop={(e) => canEdit && handleDrop(e, estado)}
            style={{
              background: isOver ? "var(--wine-tint)" : "var(--bg-elevated)",
              border: `1px ${isOver ? "dashed var(--wine)" : "solid var(--border)"}`,
              borderRadius: "var(--r-lg)",
              padding: 10,
              minHeight: 160,
              transition: "background 120ms ease, border-color 120ms ease",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "4px 6px 10px",
              }}
            >
              <span
                style={{
                  font: "700 11px/1 var(--f-sans)",
                  color: "var(--ink)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {meta.label}
              </span>
              <Badge tone={meta.tone} size="sm">
                {col.length}
              </Badge>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {col.length === 0 && (
                <div
                  style={{
                    padding: "18px 10px",
                    textAlign: "center",
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    border: "1px dashed var(--border)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  {canEdit ? "Arrastra una tarjeta acá" : "Sin tareas"}
                </div>
              )}
              {col.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  nameByUserId={nameByUserId}
                  canEdit={canEdit}
                  hoyISO={hoyISO}
                  draggingRef={draggingRef}
                  onMove={onMove}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  nameByUserId,
  canEdit,
  hoyISO,
  draggingRef,
  onMove,
  onOpen,
}: {
  task: BitacoraTask;
  nameByUserId: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  draggingRef: React.MutableRefObject<boolean>;
  onMove: (taskId: string, estado: BitacoraTaskEstado) => void;
  onOpen: (task: BitacoraTask) => void;
}) {
  const prio = PRIORIDAD_META[task.prioridad];
  const next = nextEstado(task.estado);
  const doneCount = task.checklist.filter((c) => c.done).length;
  const overdue =
    task.due_date != null && task.due_date < hoyISO && task.estado !== "hecho";
  const queueLabel =
    task.assignees.length === 0 && task.assigned_role
      ? (ROLE_QUEUE_LABELS[
          task.assigned_role as keyof typeof ROLE_QUEUE_LABELS
        ] ?? task.assigned_role)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canEdit}
      onDragStart={(e) => {
        draggingRef.current = true;
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          draggingRef.current = false;
        }, 50);
      }}
      onClick={() => {
        if (draggingRef.current) return;
        onOpen(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 12px",
        cursor: canEdit ? "grab" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: task.estado === "hecho" ? 0.75 : 1,
      }}
    >
      <div
        style={{
          font: "700 12.5px/1.35 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {task.titulo}
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <Badge tone={prio.tone} size="sm">
          {prio.label}
        </Badge>
        {task.tipo === "entregable_cliente" && (
          <Badge tone="warning" size="sm">
            Esperando al cliente
          </Badge>
        )}
        {task.para_agente && (
          <Badge tone="info" size="sm">
            prompt → CC
          </Badge>
        )}
        {queueLabel && (
          <Badge tone="neutral" size="sm">
            Cola {queueLabel}
          </Badge>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {task.assignees.length > 0 ? (
            <div style={{ display: "flex", gap: 2 }}>
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar
                  key={a.user_id}
                  initials={initialsOf(nameByUserId[a.user_id])}
                  color="wine"
                  size={20}
                />
              ))}
            </div>
          ) : (
            <span
              style={{
                font: "500 10.5px/1 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              {task.responsable_nombre
                ? `Sin asignar (${task.responsable_nombre})`
                : queueLabel
                  ? "En cola"
                  : "Sin asignar"}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span
              style={{
                font: "700 10.5px/1 var(--f-mono)",
                color:
                  doneCount === task.checklist.length
                    ? "var(--success)"
                    : "var(--ink-soft)",
              }}
            >
              {doneCount}/{task.checklist.length}
            </span>
          )}
          {task.due_date && (
            <span
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: overdue ? "var(--danger)" : "var(--ink-soft)",
              }}
            >
              {overdue ? "Atrasada · " : ""}
              {dueDateLabel(task.due_date, hoyISO)}
            </span>
          )}
        </div>

        {canEdit && next && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              onMove(task.id, next);
            }}
            aria-label={`Pasar "${task.titulo}" a ${ESTADO_META[next].label}`}
            style={{ flexShrink: 0 }}
          >
            {ESTADO_META[next].label} {Icon.arrowR(11)}
          </button>
        )}
      </div>
    </div>
  );
}

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase();
}
