"use client";

/**
 * HoyClient · vista HOY de Bitácora en el teléfono (SDD-0146 · Fase 1).
 *
 * Lista agrupada Atrasadas → Para hoy → Próximas → Sin fecha (groupTasksForHoy,
 * hoy anclado a Caracas server-side). Filtro "mías" por default con toggle
 * "todas". Cola del rol con "Tomar tarea". Botón GRANDE de avance (≥44px zona
 * del pulgar); al pasar a "hecho" la tarea desaparece con toast.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ErpBottomNav } from "@/app/m/erp/_components/ErpBottomNav";
import { PushOptInBanner } from "./PushOptInBanner";
import type {
  AssignableProfile,
  BitacoraTask,
} from "@/lib/studio/bitacora/bitacora-queries";
import { groupTasksForHoy } from "@/lib/studio/bitacora/bitacora-queries";
import {
  BITACORA_EMPTY_RULE,
  ESTADO_META,
  PRIORIDAD_META,
  ROLE_QUEUE_LABELS,
  nextEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import { dueDateLabel } from "@/lib/studio/bitacora/dates";
import { useBitacoraTasksRealtime } from "@/lib/studio/bitacora/use-bitacora-realtime";
import { moveTaskAction, takeTaskAction } from "@/app/studio/(app)/bitacora/actions";

interface Props {
  tasks: BitacoraTask[];
  profiles: AssignableProfile[];
  myUserId: string;
  myRole: string;
  canEdit: boolean;
  hoyISO: string;
  tenantId: string | null;
}

export function HoyClient({
  tasks,
  profiles,
  myUserId,
  myRole,
  canEdit,
  hoyISO,
  tenantId,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startRefresh] = useTransition();

  // Realtime: un avance en desktop se refleja en el teléfono en <2s sin reload
  // (el server re-pull trae las relaciones; las props re-sincronizan el estado).
  useBitacoraTasksRealtime(tenantId);

  const [localTasks, setLocalTasks] = useState<BitacoraTask[]>(tasks);
  const [tasksSource, setTasksSource] = useState(tasks);
  if (tasksSource !== tasks) {
    setTasksSource(tasks);
    setLocalTasks(tasks);
  }

  const [soloMias, setSoloMias] = useState(true);

  const nameByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) m[p.user_id] = p.display_name;
    return m;
  }, [profiles]);

  // Cola del rol: sin dueño + con rol. admin ve todas las colas.
  const queueTasks = useMemo(
    () =>
      localTasks.filter(
        (t) =>
          t.estado !== "hecho" &&
          t.assignees.length === 0 &&
          t.assigned_role != null &&
          (myRole === "admin" || t.assigned_role === myRole),
      ),
    [localTasks, myRole],
  );

  const visibles = useMemo(() => {
    // Las tareas ya listadas en "Cola del rol" no se duplican en los grupos.
    const queueIds = new Set(queueTasks.map((t) => t.id));
    return soloMias
      ? localTasks.filter((t) =>
          t.assignees.some((a) => a.user_id === myUserId),
        )
      : localTasks.filter((t) => !queueIds.has(t.id));
  }, [localTasks, soloMias, myUserId, queueTasks]);

  const groups = useMemo(
    () => groupTasksForHoy(visibles, hoyISO),
    [visibles, hoyISO],
  );

  const totalVisible =
    groups.atrasadas.length +
    groups.paraHoy.length +
    groups.proximas.length +
    groups.sinFecha.length;

  const afterMove = (task: BitacoraTask, nuevo: string) => {
    if (nuevo === "hecho") {
      setLocalTasks((ts) => ts.filter((t) => t.id !== task.id));
      toast.success(`"${task.titulo}" marcada como hecha`);
    } else {
      setLocalTasks((ts) =>
        ts.map((t) =>
          t.id === task.id
            ? { ...t, estado: nuevo as BitacoraTask["estado"] }
            : t,
        ),
      );
    }
    startRefresh(() => router.refresh());
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
      {/* Top bar (mismo lenguaje que MobileErpClient) */}
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
        <BrandMark variant="reverse" size={28} isologoOnly />
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
            }}
          >
            Hoy · {hoyISO}
          </div>
        </div>
        <Link
          href="/studio/bitacora"
          aria-label="Abrir Bitácora en el Studio"
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
          {Icon.external(14)}
        </Link>
      </header>

      <main style={{ padding: "20px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <h1
              style={{
                font: "900 26px/1.1 var(--f-display)",
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Hoy
            </h1>
            <div
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 6,
              }}
            >
              {totalVisible} tarea{totalVisible === 1 ? "" : "s"}
              {soloMias ? " tuyas" : " del equipo"}
              {groups.atrasadas.length > 0 &&
                ` · ${groups.atrasadas.length} atrasada${groups.atrasadas.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>

        {/* Toggle mías | todas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            padding: 4,
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            marginBottom: 16,
          }}
        >
          {[
            { v: true, label: "Mías" },
            { v: false, label: "Todas" },
          ].map((opt) => {
            const active = soloMias === opt.v;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSoloMias(opt.v)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--r-sm)",
                  background: active ? "var(--bg-surface)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                  border: 0,
                  font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                  boxShadow: active ? "var(--shadow-xs)" : "none",
                  cursor: "pointer",
                  transition: "all 160ms ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Descubrimiento del recordatorio diario (opt-in · channel_push OFF por defecto) */}
        <PushOptInBanner />

        {/* Cola del rol */}
        {queueTasks.length > 0 && (
          <section aria-label="Cola del rol" style={{ marginBottom: 18 }}>
            <GroupHeader
              label={`Cola del rol · ${queueTasks.length}`}
              tone="var(--info)"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {queueTasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: "12px 14px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <Link
                    href={`/m/erp/bitacora/tarea/${t.id}`}
                    style={{ textDecoration: "none", minWidth: 0 }}
                  >
                    <div
                      style={{
                        font: "700 13.5px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {t.titulo}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 4,
                      }}
                    >
                      Cola{" "}
                      {ROLE_QUEUE_LABELS[
                        t.assigned_role as keyof typeof ROLE_QUEUE_LABELS
                      ] ?? t.assigned_role}
                      {t.due_date
                        ? ` · vence ${dueDateLabel(t.due_date, hoyISO)}`
                        : ""}
                    </div>
                  </Link>
                  {canEdit && (
                    <div style={{ display: "flex", minHeight: 44 }}>
                      <ActionButton
                        variant="primary"
                        size="default"
                        idleLabel="Tomar tarea"
                        loadingLabel="Tomando…"
                        successLabel="Tuya"
                        idleIcon={Icon.check(14)}
                        onAction={async () => takeTaskAction(t.id)}
                        onSuccess={() => {
                          setLocalTasks((ts) =>
                            ts.map((x) =>
                              x.id === t.id
                                ? {
                                    ...x,
                                    assigned_role: null,
                                    assignees: [{ user_id: myUserId }],
                                  }
                                : x,
                            ),
                          );
                          toast.success(`Tomaste "${t.titulo}"`);
                          startRefresh(() => router.refresh());
                        }}
                        onError={(m) => toast.error(m)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Grupos Hoy */}
        {totalVisible === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              background: "var(--bg-surface)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <div
              style={{
                font: "800 16px/1.2 var(--f-display)",
                color: "var(--ink)",
                marginBottom: 6,
              }}
            >
              {soloMias ? "Sin tareas tuyas abiertas" : "Sin tareas abiertas"}
            </div>
            <div
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                maxWidth: "36ch",
                margin: "0 auto",
              }}
            >
              {BITACORA_EMPTY_RULE}.
              {soloMias && localTasks.length > 0
                ? " Mira “Todas” para ver las del equipo."
                : ""}
            </div>
          </div>
        ) : (
          <>
            <TaskGroup
              label="Atrasadas"
              tone="var(--danger)"
              tasks={groups.atrasadas}
              {...{ hoyISO, canEdit, nameByUserId, afterMove, toast }}
            />
            <TaskGroup
              label="Para hoy"
              tone="var(--wine)"
              tasks={groups.paraHoy}
              {...{ hoyISO, canEdit, nameByUserId, afterMove, toast }}
            />
            <TaskGroup
              label="Próximas"
              tone="var(--info)"
              tasks={groups.proximas}
              {...{ hoyISO, canEdit, nameByUserId, afterMove, toast }}
            />
            <TaskGroup
              label="Sin fecha"
              tone="var(--ink-soft)"
              tasks={groups.sinFecha}
              {...{ hoyISO, canEdit, nameByUserId, afterMove, toast }}
            />
          </>
        )}
      </main>

      <ErpBottomNav active="bitacora" role={myRole} />
    </div>
  );
}

function GroupHeader({ label, tone }: { label: string; tone: string }) {
  return (
    <div
      style={{
        font: "700 10.5px/1 var(--f-sans)",
        color: tone,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        margin: "0 0 10px",
      }}
    >
      {label}
    </div>
  );
}

function TaskGroup({
  label,
  tone,
  tasks,
  hoyISO,
  canEdit,
  nameByUserId,
  afterMove,
  toast,
}: {
  label: string;
  tone: string;
  tasks: BitacoraTask[];
  hoyISO: string;
  canEdit: boolean;
  nameByUserId: Record<string, string>;
  afterMove: (task: BitacoraTask, nuevo: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  if (tasks.length === 0) return null;
  return (
    <section aria-label={label} style={{ marginBottom: 18 }}>
      <GroupHeader label={`${label} · ${tasks.length}`} tone={tone} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            hoyISO={hoyISO}
            canEdit={canEdit}
            nameByUserId={nameByUserId}
            afterMove={afterMove}
            toast={toast}
          />
        ))}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  hoyISO,
  canEdit,
  nameByUserId,
  afterMove,
  toast,
}: {
  task: BitacoraTask;
  hoyISO: string;
  canEdit: boolean;
  nameByUserId: Record<string, string>;
  afterMove: (task: BitacoraTask, nuevo: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const next = nextEstado(task.estado);
  const prio = PRIORIDAD_META[task.prioridad];
  const doneCount = task.checklist.filter((c) => c.done).length;
  const overdue = task.due_date != null && task.due_date < hoyISO;
  const ownerName =
    task.assignees.length > 0
      ? (nameByUserId[task.assignees[0].user_id] ?? "Usuario")
      : null;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: overdue ? "4px solid var(--danger)" : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Link
        href={`/m/erp/bitacora/tarea/${task.id}`}
        style={{ textDecoration: "none", minWidth: 0 }}
      >
        <div
          style={{
            font: "700 13.5px/1.3 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          {task.titulo}
        </div>
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            marginTop: 6,
            alignItems: "center",
          }}
        >
          <Badge tone={ESTADO_META[task.estado].tone} size="sm">
            {ESTADO_META[task.estado].label}
          </Badge>
          <Badge tone={prio.tone} size="sm">
            {prio.label}
          </Badge>
          {task.tipo === "entregable_cliente" && (
            <Badge tone="warning" size="sm">
              Esperando al cliente
            </Badge>
          )}
          {task.due_date && (
            <span
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: overdue ? "var(--danger)" : "var(--ink-soft)",
              }}
            >
              Vence {dueDateLabel(task.due_date, hoyISO)}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span
              style={{
                font: "700 10.5px/1 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {doneCount}/{task.checklist.length}
            </span>
          )}
        </div>
        {ownerName && (
          <div
            style={{
              font: "500 11px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 5,
            }}
          >
            {ownerName}
          </div>
        )}
      </Link>

      {/* Botón GRANDE de avance · ≥44px zona del pulgar */}
      {canEdit && next && (
        <div style={{ display: "flex", minHeight: 44 }}>
          <ActionButton
            variant={next === "hecho" ? "primary" : "dark"}
            size="default"
            idleLabel={
              next === "hecho"
                ? "Marcar como hecha"
                : `Pasar a ${ESTADO_META[next].label.toLowerCase()}`
            }
            loadingLabel="Guardando…"
            successLabel={null}
            idleIcon={next === "hecho" ? Icon.check(14) : Icon.arrowR(14)}
            onAction={async () => {
              const res = await moveTaskAction(task.id, next);
              if (res?.error) return res;
              afterMove(task, next);
              return undefined;
            }}
            onError={(m) => toast.error(m)}
          />
        </div>
      )}
    </div>
  );
}
