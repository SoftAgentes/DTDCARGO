"use client";

/**
 * BoardKanban · tablero de 4 columnas con drag & drop HTML5 NATIVO
 * (draggable + onDragStart/onDragOver/onDrop — sin @dnd-kit, decisión SDD-0146).
 *
 * La alternativa accesible es un selector por tarjeta que alcanza cualquiera
 * de los cuatro estados con teclado/touch. Click en la tarjeta abre el drawer.
 */

import { useRef, useState, type DragEvent } from "react";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import {
  BITACORA_TASK_ESTADOS,
  ESTADO_META,
  PRIORIDAD_META,
  ROLE_QUEUE_LABELS,
  type BitacoraTaskEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import { dueDateLabel } from "@/lib/studio/bitacora/dates";

interface Props {
  tasks: BitacoraTask[];
  nameByUserId: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  onMove: (
    taskId: string,
    estado: BitacoraTaskEstado,
    expectedEstado: BitacoraTaskEstado,
  ) => void;
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
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
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
    setDraggingTaskId(null);
    setLiveMessage(`Moviendo ${task.titulo} a ${ESTADO_META[estado].label}.`);
    onMove(id, estado, task.estado);
  };

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {liveMessage}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
          gap: "var(--s-3)",
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
              transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--s-2)",
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

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {draggingTaskId &&
                tasks.find((task) => task.id === draggingTaskId)?.estado !== estado && (
                  <div
                    data-testid={`drop-placeholder-${estado}`}
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      font: "600 11px/1.4 var(--f-sans)",
                      color: "var(--wine-text)",
                      border: "1px dashed var(--wine)",
                      borderRadius: "var(--r-md)",
                      background: "var(--wine-tint)",
                    }}
                  >
                    Suelta para mover a {meta.label}
                  </div>
                )}
              {col.length === 0 && (
                <div
                  style={{
                    padding: "18px 10px",
                    textAlign: "center",
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
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
                  dragging={draggingTaskId === t.id}
                  onDragStart={() => {
                    setDraggingTaskId(t.id);
                    setLiveMessage(
                      `Levantaste ${t.titulo}. Hay ${BITACORA_TASK_ESTADOS.length - 1} destinos disponibles.`,
                    );
                  }}
                  onDragEnd={() => {
                    setDraggingTaskId(null);
                    setOverCol(null);
                  }}
                  onMove={onMove}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        );
      })}
      </div>
    </>
  );
}

function TaskCard({
  task,
  nameByUserId,
  canEdit,
  hoyISO,
  draggingRef,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  task: BitacoraTask;
  nameByUserId: Record<string, string>;
  canEdit: boolean;
  hoyISO: string;
  draggingRef: React.MutableRefObject<boolean>;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (
    taskId: string,
    estado: BitacoraTaskEstado,
    expectedEstado: BitacoraTaskEstado,
  ) => void;
  onOpen: (task: BitacoraTask) => void;
}) {
  const prio = PRIORIDAD_META[task.prioridad];
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
    <article
      draggable={canEdit}
      onDragStart={(e) => {
        draggingRef.current = true;
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          draggingRef.current = false;
        }, 50);
      }}
      onClick={() => {
        if (draggingRef.current) return;
        onOpen(task);
      }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 12px",
        cursor: canEdit ? "grab" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
        opacity: dragging ? 0.55 : task.estado === "hecho" ? 0.75 : 1,
        outline: dragging ? "2px solid var(--wine)" : "none",
        outlineOffset: dragging ? 2 : 0,
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(task);
        }}
        aria-label={`Abrir tarea ${task.titulo}`}
        style={{
          appearance: "none",
          padding: 0,
          border: 0,
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
          font: "700 12.5px/1.35 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {task.titulo}
      </button>

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
          gap: "var(--s-2)",
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
                color: "var(--ink-soft)",
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

        {canEdit && (
          <label
            onClick={(event) => event.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-1)",
              flexShrink: 0,
              font: "600 10.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <span>Mover a</span>
            <select
              value={task.estado}
              aria-label={`Mover ${task.titulo} a otro estado`}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                event.stopPropagation();
                const target = event.target.value as BitacoraTaskEstado;
                if (target !== task.estado) onMove(task.id, target, task.estado);
              }}
              style={{
                minHeight: 44,
                maxWidth: 112,
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                background: "var(--bg-surface)",
                color: "var(--ink)",
                font: "600 11px/1 var(--f-sans)",
                padding: "0 var(--s-2)",
              }}
            >
              {BITACORA_TASK_ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_META[estado].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </article>
  );
}

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase();
}
