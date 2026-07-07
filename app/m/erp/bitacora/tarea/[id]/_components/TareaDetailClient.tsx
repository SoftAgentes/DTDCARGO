"use client";

/**
 * TareaDetailClient · detalle de tarea en el teléfono (SDD-0146 · Fase 1).
 * Meta (estado, prioridad, dueño, vence) + checklist tap-to-toggle (target
 * ≥44px) + botón grande de avance + "Tomar tarea" si está en la cola del rol.
 */

import { startTransition, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ErpBottomNav } from "@/app/m/erp/_components/ErpBottomNav";
import type {
  AssignableProfile,
  BitacoraTask,
} from "@/lib/studio/bitacora/bitacora-queries";
import {
  ESTADO_META,
  PRIORIDAD_META,
  ROLE_QUEUE_LABELS,
  nextEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import { dueDateLabel } from "@/lib/studio/bitacora/dates";
import { formatRelativeTime } from "@/lib/studio/comments/types";
import {
  moveTaskAction,
  takeTaskAction,
  toggleChecklistItemAction,
} from "@/app/studio/(app)/bitacora/actions";
import { TaskCollabSection } from "@/app/studio/(app)/bitacora/_components/TaskCollabSection";

interface Props {
  task: BitacoraTask;
  profiles: AssignableProfile[];
  myUserId: string;
  myRole: string;
  canEdit: boolean;
  tenantId: string;
  hoyISO: string;
}

export function TareaDetailClient({
  task: initialTask,
  profiles,
  myUserId,
  myRole,
  canEdit,
  tenantId,
  hoyISO,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startRefresh] = useTransition();

  const [task, setTask] = useState(initialTask);

  const nameByUserId: Record<string, string> = {};
  for (const p of profiles) nameByUserId[p.user_id] = p.display_name;

  const next = nextEstado(task.estado);
  const estadoMeta = ESTADO_META[task.estado];
  const prioMeta = PRIORIDAD_META[task.prioridad];
  const overdue =
    task.due_date != null && task.due_date < hoyISO && task.estado !== "hecho";
  const inQueue = task.assignees.length === 0 && task.assigned_role != null;
  const ownerName =
    task.assignees.length > 0
      ? (nameByUserId[task.assignees[0].user_id] ?? "Usuario")
      : null;
  const doneCount = task.checklist.filter((c) => c.done).length;

  const toggleItem = (itemId: string, done: boolean) => {
    if (!canEdit) return;
    const prevItem = task.checklist.find((c) => c.id === itemId);
    // Optimista: quién/cuándo = yo/ahora (espejo de toggleChecklistItemAction).
    setTask((t) => ({
      ...t,
      checklist: t.checklist.map((c) =>
        c.id === itemId
          ? {
              ...c,
              done,
              done_by: done ? myUserId : null,
              done_at: done ? new Date().toISOString() : null,
            }
          : c,
      ),
    }));
    startTransition(async () => {
      const res = await toggleChecklistItemAction(itemId, done);
      if (res?.error) {
        setTask((t) => ({
          ...t,
          checklist: t.checklist.map((c) =>
            c.id === itemId && prevItem ? prevItem : c,
          ),
        }));
        toast.error(res.error);
      }
    });
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        maxWidth: 480,
        margin: "0 auto",
        background: "var(--bg-base)",
        paddingBottom: "calc(76px + env(safe-area-inset-bottom))",
        position: "relative",
      }}
    >
      {/* Top bar con volver */}
      <header
        style={{
          padding: "14px 18px 12px",
          paddingTop: "max(14px, env(safe-area-inset-top))",
          background: "var(--bg-sidebar)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <Link
          href="/m/erp/bitacora"
          aria-label="Volver a Hoy"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--r-pill)",
            background: "var(--wine-tint)",
            color: "var(--wine-soft)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {Icon.arrowL(16)}
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-inv-mute)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            DTD · Bitácora
          </div>
          <div
            style={{
              font: "500 12px/1 var(--f-sans)",
              color: "var(--ink-inv-soft)",
              marginTop: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Detalle de tarea
          </div>
        </div>
      </header>

      <main style={{ padding: "20px 18px" }}>
        <h1
          style={{
            font: "900 22px/1.2 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {task.titulo}
        </h1>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 10,
            marginBottom: 16,
          }}
        >
          <Badge tone={estadoMeta.tone}>{estadoMeta.label}</Badge>
          <Badge tone={prioMeta.tone}>Prioridad {prioMeta.label.toLowerCase()}</Badge>
          {task.tipo === "entregable_cliente" && (
            <Badge tone="warning">Esperando al cliente</Badge>
          )}
          {task.para_agente && <Badge tone="info">prompt → CC</Badge>}
        </div>

        {task.descripcion && (
          <p
            style={{
              font: "500 13px/1.55 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "0 0 16px",
              whiteSpace: "pre-wrap",
            }}
          >
            {task.descripcion}
          </p>
        )}

        {/* Meta */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <MetaField
            label="Vence"
            value={task.due_date ? dueDateLabel(task.due_date, hoyISO) : "Sin fecha"}
            danger={overdue}
          />
          <MetaField
            label="Dueño"
            value={
              ownerName ??
              (inQueue
                ? `Cola ${
                    ROLE_QUEUE_LABELS[
                      task.assigned_role as keyof typeof ROLE_QUEUE_LABELS
                    ] ?? task.assigned_role
                  }`
                : task.responsable_nombre
                  ? `Sin asignar (${task.responsable_nombre})`
                  : "Sin asignar")
            }
          />
          <MetaField
            label="Checklist"
            value={
              task.checklist.length > 0
                ? `${doneCount}/${task.checklist.length} completado${doneCount === 1 ? "" : "s"}`
                : "Sin puntos"
            }
          />
          <MetaField
            label="Creada"
            value={new Date(task.created_at).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "short",
            })}
          />
        </div>

        {/* Tomar de la cola */}
        {canEdit && inQueue && (myRole === "admin" || task.assigned_role === myRole) && (
          <div style={{ display: "flex", minHeight: 44, marginBottom: 12 }}>
            <ActionButton
              variant="dark"
              size="default"
              idleLabel="Tomar tarea"
              loadingLabel="Tomando…"
              successLabel="Tuya"
              idleIcon={Icon.check(14)}
              onAction={async () => takeTaskAction(task.id)}
              onSuccess={() => {
                setTask((t) => ({
                  ...t,
                  assigned_role: null,
                  assignees: [{ user_id: myUserId }],
                }));
                toast.success(`Tomaste "${task.titulo}"`);
                startRefresh(() => router.refresh());
              }}
              onError={(m) => toast.error(m)}
            />
          </div>
        )}

        {/* Avance grande (≥44px) */}
        {canEdit && next && (
          <div style={{ display: "flex", minHeight: 48, marginBottom: 18 }}>
            <ActionButton
              variant={next === "hecho" ? "primary" : "dark"}
              size="default"
              idleLabel={
                next === "hecho"
                  ? "Marcar como hecha"
                  : `Pasar a ${ESTADO_META[next].label.toLowerCase()}`
              }
              loadingLabel="Guardando…"
              successLabel={next === "hecho" ? "Hecha" : null}
              idleIcon={next === "hecho" ? Icon.check(14) : Icon.arrowR(14)}
              successIcon={Icon.check(14)}
              onAction={async () => {
                const res = await moveTaskAction(task.id, next);
                if (res?.error) return res;
                setTask((t) => ({ ...t, estado: next }));
                if (next === "hecho") {
                  toast.success(`"${task.titulo}" marcada como hecha`, {
                    link: { href: "/m/erp/bitacora", label: "Volver a Hoy" },
                  });
                }
                startRefresh(() => router.refresh());
                return undefined;
              }}
              onError={(m) => toast.error(m)}
            />
          </div>
        )}

        {/* Checklist tap-to-toggle */}
        {task.checklist.length > 0 && (
          <section aria-label="Checklist" style={{ marginBottom: 18 }}>
            <div
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--wine)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Checklist · {doneCount}/{task.checklist.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {task.checklist.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggleItem(it.id, !it.done)}
                  disabled={!canEdit}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    minHeight: 48,
                    padding: "12px 14px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    textAlign: "left",
                    cursor: canEdit ? "pointer" : "default",
                    font: "500 13px/1.4 var(--f-sans)",
                    color: it.done ? "var(--ink-mute)" : "var(--ink)",
                    width: "100%",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `1.5px solid ${it.done ? "var(--success)" : "var(--border)"}`,
                      background: it.done ? "var(--success-bg)" : "transparent",
                      color: "var(--success)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {it.done && Icon.check(12)}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ textDecoration: it.done ? "line-through" : "none" }}>
                      {it.texto}
                    </span>
                    {it.done && (
                      <span
                        style={{
                          font: "500 11px/1.3 var(--f-sans)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        Hecho por{" "}
                        {(it.done_by && nameByUserId[it.done_by]) || "alguien del equipo"}
                        {it.done_at ? ` · ${formatRelativeTime(it.done_at)}` : ""}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Colaboración (SDD-0146 · Fase 4): prueba de avance (cámara) +
            comentarios con @menciones. */}
        <section aria-label="Colaboración" style={{ marginBottom: 18 }}>
          <TaskCollabSection
            taskId={task.id}
            taskTitulo={task.titulo}
            canEdit={canEdit}
            tenantId={tenantId}
            allowCamera
          />
        </section>

        <Link
          href="/studio/bitacora"
          style={{
            display: "block",
            padding: "12px 16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            textDecoration: "none",
            textAlign: "center",
            font: "700 12px/1 var(--f-sans)",
            color: "var(--wine)",
          }}
        >
          Editar en el Studio →
        </Link>
      </main>

      <ErpBottomNav active="bitacora" role={myRole} />
    </div>
  );
}

function MetaField({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "600 13px/1.3 var(--f-sans)",
          color: danger ? "var(--danger)" : "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
