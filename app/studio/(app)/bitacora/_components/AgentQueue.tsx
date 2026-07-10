"use client";

/**
 * AgentQueue · pestaña "Para Claude Code" de Bitácora (SDD-0146).
 *
 * Junta todas las tareas marcadas "Ejecutable por agente" (`para_agente`) para
 * copiar sus prompts sin abrir cada tarea. Pendientes arriba (accionables) y
 * las ya hechas plegadas abajo. Solo-lectura + copiar: no muta nada.
 *
 * El armado del prompt es PURO (buildAgentPrompt / buildAllAgentPrompts); acá
 * solo se filtra/ordena (partitionAgentTasks) y se copia al portapapeles con el
 * mismo patrón que TaskDrawer.
 */

import { useMemo } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { BitacoraTask } from "@/lib/studio/bitacora/bitacora-queries";
import {
  ESTADO_META,
  PRIORIDAD_META,
} from "@/lib/studio/bitacora/bitacora-types";
import { partitionAgentTasks } from "@/lib/studio/bitacora/grouping";
import {
  buildAgentPrompt,
  buildAllAgentPrompts,
  type AgentPromptTask,
} from "@/lib/studio/bitacora/agent-prompt";

interface Props {
  tasks: BitacoraTask[];
  /** Abrir el drawer de la tarea (click en el título). Opcional. */
  onOpen?: (task: BitacoraTask) => void;
}

/** Tarea → forma que consume el armador de prompt (mismo mapeo que TaskDrawer). */
function toPrompt(task: BitacoraTask): AgentPromptTask {
  return {
    titulo: task.titulo,
    descripcion: task.descripcion,
    checklist: task.checklist.map((i) => ({ texto: i.texto, done: i.done })),
  };
}

export function AgentQueue({ tasks, onOpen }: Props) {
  const toast = useToast();

  const { pendientes, hechas } = useMemo(
    () => partitionAgentTasks(tasks),
    [tasks],
  );
  const total = pendientes.length + hechas.length;

  // Copiado al portapapeles con fallback + toast (mismo patrón que TaskDrawer).
  const copyText = async (text: string, okMsg: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error("No se pudo copiar. Copia el texto a mano.");
    }
  };

  const copyAll = () =>
    copyText(
      buildAllAgentPrompts(pendientes.map(toPrompt)),
      `${pendientes.length} prompt${
        pendientes.length === 1 ? "" : "s"
      } copiados`,
    );

  const copyOne = (task: BitacoraTask) =>
    copyText(
      buildAgentPrompt(toPrompt(task)),
      "Prompt copiado. Pégalo en Claude Code.",
    );

  if (total === 0) {
    return (
      <EmptyState
        eyebrow="Para Claude Code"
        title="Ninguna tarea marcada para agente"
        description="Marca una tarea como «Ejecutable por agente» para que aparezca acá y puedas pasársela a Claude Code de una."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Encabezado: conteo + copiar todas las pendientes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "14px 18px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
            Para Claude Code
          </div>
          <div
            style={{
              font: "700 15px/1.3 var(--f-sans)",
              color: "var(--ink)",
              marginTop: 3,
            }}
          >
            {total} tarea{total === 1 ? "" : "s"} para Claude Code
          </div>
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "3px 0 0",
            }}
          >
            {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}
            {hechas.length > 0
              ? ` · ${hechas.length} ya hecha${hechas.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={copyAll}
          disabled={pendientes.length === 0}
        >
          {Icon.copy(14)} Copiar todas las pendientes
        </button>
      </div>

      {/* Pendientes (accionables) */}
      {pendientes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {pendientes.map((t) => (
            <AgentTaskCard
              key={t.id}
              task={t}
              onOpen={onOpen}
              onCopy={() => copyOne(t)}
            />
          ))}
        </div>
      ) : (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          No quedan tareas pendientes para el agente. Las que hay ya están
          hechas.
        </p>
      )}

      {/* Hechas · plegadas */}
      {hechas.length > 0 && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              font: "600 12px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              padding: "6px 2px",
            }}
          >
            Ya hechas ({hechas.length})
          </summary>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
              marginTop: 10,
            }}
          >
            {hechas.map((t) => (
              <AgentTaskCard
                key={t.id}
                task={t}
                onOpen={onOpen}
                onCopy={() => copyOne(t)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AgentTaskCard({
  task,
  onOpen,
  onCopy,
}: {
  task: BitacoraTask;
  onOpen?: (task: BitacoraTask) => void;
  onCopy: () => void;
}) {
  const done = task.checklist.filter((c) => c.done).length;
  const totalItems = task.checklist.length;
  const isDone = task.estado === "hecho";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-3)",
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        opacity: isDone ? 0.72 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(task)}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              display: "block",
              maxWidth: "100%",
              font: "700 13px/1.3 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.titulo}
          </button>
        ) : (
          <div
            style={{
              font: "700 13px/1.3 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.titulo}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <Badge tone={ESTADO_META[task.estado].tone} size="sm">
            {ESTADO_META[task.estado].label}
          </Badge>
          <Badge tone={PRIORIDAD_META[task.prioridad].tone} size="sm">
            {PRIORIDAD_META[task.prioridad].label}
          </Badge>
          {totalItems > 0 && (
            <code
              style={{
                font: "700 11px/1 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {done}/{totalItems}
            </code>
          )}
        </div>
      </div>

      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        onClick={onCopy}
        style={{ flexShrink: 0 }}
      >
        {Icon.copy(13)} Copiar prompt
      </button>
    </div>
  );
}
