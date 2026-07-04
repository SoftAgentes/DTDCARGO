"use client";

/**
 * BitacoraClient · orquestador del módulo (SDD-0146 · Fase 1).
 *
 * Tabs Tablero | Lista (persistidas en localStorage `bitacora:view`), sección
 * "Cola del rol" (tareas sin dueño esperando que alguien las tome), drawer de
 * crear/editar y mutación optimista de estado con revert ante error.
 */

import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type {
  AssignableProfile,
  BitacoraTask,
} from "@/lib/studio/bitacora/bitacora-queries";
import type { BitacoraMeetingListItem } from "@/lib/studio/bitacora/bitacora-meeting-queries";
import {
  BITACORA_EMPTY_RULE,
  ESTADO_META,
  ROLE_QUEUE_LABELS,
  type BitacoraTaskEstado,
} from "@/lib/studio/bitacora/bitacora-types";
import {
  countEsperandoCliente,
  filterEsperandoCliente,
} from "@/lib/studio/bitacora/grouping";
import { useBitacoraTasksRealtime } from "@/lib/studio/bitacora/use-bitacora-realtime";
import { moveTaskAction, takeTaskAction } from "../actions";
import { BoardKanban } from "./BoardKanban";
import { BoardList } from "./BoardList";
import { TaskDrawer } from "./TaskDrawer";
import { ActasList } from "./ActasList";

type View = "tablero" | "lista" | "actas";

const VIEW_LABELS: Record<View, string> = {
  tablero: "Tablero",
  lista: "Lista",
  actas: "Actas",
};

const VIEW_STORAGE_KEY = "bitacora:view";

interface Props {
  tasks: BitacoraTask[];
  profiles: AssignableProfile[];
  meetings: BitacoraMeetingListItem[];
  canEdit: boolean;
  myUserId: string | null;
  myRole: string | null;
  tenantId: string | null;
  /** Deep-link (?task=): abre el drawer de esta tarea al montar. */
  initialOpenTaskId: string | null;
  hoyISO: string;
}

export function BitacoraClient({
  tasks,
  profiles,
  meetings,
  canEdit,
  myUserId,
  myRole,
  tenantId,
  initialOpenTaskId,
  hoyISO,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startRefresh] = useTransition();

  // Realtime: un avance en otro dispositivo re-pull del server (<2s) → el
  // useEffect([tasks]) re-syncea localTasks. Ver use-bitacora-realtime.ts.
  useBitacoraTasksRealtime(tenantId);

  const [view, setView] = useState<View>("tablero");
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "lista" || saved === "tablero" || saved === "actas") {
      setView(saved);
    }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    window.localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  // Optimista con revert: el server refresca vía router.refresh().
  const [localTasks, setLocalTasks] = useState<BitacoraTask[]>(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  // Filtro "Esperando al cliente" (solo tareas tipo entregable_cliente).
  const [esperandoOnly, setEsperandoOnly] = useState(false);

  const [drawer, setDrawer] = useState<
    | { mode: "create" }
    | { mode: "edit"; task: BitacoraTask }
    | null
  >(null);

  // Deep-link desde la bandeja de menciones: abrir el drawer de la tarea del
  // ?task= UNA vez al montar (no re-dispara en router.refresh — el efecto corre
  // solo en el mount inicial; el drawer sobrevive el refresh por estado cliente).
  useEffect(() => {
    if (!initialOpenTaskId) return;
    const t = tasks.find((x) => x.id === initialOpenTaskId);
    if (t) setDrawer({ mode: "edit", task: t });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) m[p.user_id] = p.display_name;
    return m;
  }, [profiles]);

  const meetingTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mt of meetings) m[mt.id] = mt.titulo;
    return m;
  }, [meetings]);

  const openTasks = useMemo(
    () => localTasks.filter((t) => t.estado !== "hecho"),
    [localTasks],
  );

  // Chip "Esperando al cliente": aparece solo si hay tareas de ese tipo.
  const esperandoCount = useMemo(
    () => countEsperandoCliente(localTasks),
    [localTasks],
  );
  const boardTasks = useMemo(
    () => (esperandoOnly ? filterEsperandoCliente(localTasks) : localTasks),
    [localTasks, esperandoOnly],
  );

  // Filtros activos de la Lista → params del export (respeta lo que se ve).
  // La route re-aplica sobre datos gated por RLS (nunca confía en el cliente).
  const exportParams = useMemo<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    if (esperandoOnly) p.tipoTarea = "entregable_cliente";
    return p;
  }, [esperandoOnly]);

  // Cola del rol: sin dueño, con rol, no hechas.
  const queueTasks = useMemo(
    () =>
      openTasks.filter(
        (t) => t.assigned_role != null && t.assignees.length === 0,
      ),
    [openTasks],
  );

  const handleMove = (taskId: string, estado: BitacoraTaskEstado) => {
    if (!canEdit) {
      toast.info("Tu rol es de solo lectura en Bitácora.");
      return;
    }
    const prev = localTasks;
    setLocalTasks((ts) =>
      ts.map((t) => (t.id === taskId ? { ...t, estado } : t)),
    );
    startTransition(async () => {
      const res = await moveTaskAction(taskId, estado);
      if (res?.error) {
        setLocalTasks(prev);
        toast.error(res.error);
        return;
      }
      if (estado === "hecho") {
        const t = prev.find((x) => x.id === taskId);
        toast.success(`"${t?.titulo ?? "Tarea"}" marcada como hecha`);
      }
      startRefresh(() => router.refresh());
    });
  };

  const closeDrawer = () => setDrawer(null);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
            Operación · Equipo
          </div>
          <h1
            className="studio-display"
            style={{ fontSize: 26, margin: "4px 0 0", color: "var(--ink)" }}
          >
            Bitácora
          </h1>
          <p
            style={{
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            {openTasks.length} tarea{openTasks.length === 1 ? "" : "s"} abierta
            {openTasks.length === 1 ? "" : "s"} · {queueTasks.length} en cola por
            rol
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Toggle Tablero | Lista */}
          <div
            role="tablist"
            aria-label="Vista"
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 4,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            {(["tablero", "lista", "actas"] as View[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeView(v)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "var(--r-sm)",
                    background: active ? "var(--bg-surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    border: 0,
                    font: `${active ? "700" : "500"} 12px/1 var(--f-sans)`,
                    boxShadow: active ? "var(--shadow-xs)" : "none",
                    cursor: "pointer",
                  }}
                >
                  {VIEW_LABELS[v]}
                </button>
              );
            })}
          </div>

          {canEdit && (
            <Link
              href="/studio/bitacora/nueva"
              className="studio-btn studio-btn-ghost"
            >
              {Icon.spark(14)} Nueva conversación
            </Link>
          )}
          {canEdit && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setDrawer({ mode: "create" })}
            >
              {Icon.plus(14)} Nueva tarea
            </button>
          )}
        </div>
      </div>

      {/* Filtro "Esperando al cliente" · solo si hay tareas de ese tipo */}
      {view !== "actas" && esperandoCount > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            aria-pressed={esperandoOnly}
            onClick={() => setEsperandoOnly((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 30,
              padding: "0 12px",
              borderRadius: "var(--r-pill)",
              background: esperandoOnly ? "var(--warning-bg)" : "var(--bg-surface)",
              border: `1px solid ${esperandoOnly ? "var(--warning)" : "var(--border)"}`,
              color: esperandoOnly ? "var(--warning)" : "var(--ink-soft)",
              font: "600 12px/1 var(--f-sans)",
              cursor: "pointer",
            }}
          >
            Esperando al cliente
            <span style={{ font: "700 11px/1 var(--f-mono)" }}>{esperandoCount}</span>
          </button>
        </div>
      )}

      {/* Cola del rol */}
      {queueTasks.length > 0 && (
        <section
          aria-label="Cola del rol"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 16px",
            marginBottom: 18,
          }}
        >
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine)", marginBottom: 10 }}
          >
            Cola del rol · sin dueño
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {queueTasks.map((t) => {
              const roleLabel =
                ROLE_QUEUE_LABELS[
                  t.assigned_role as keyof typeof ROLE_QUEUE_LABELS
                ] ?? t.assigned_role;
              const mine = t.assigned_role === myRole || myRole === "admin";
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDrawer({ mode: "edit", task: t })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        font: "700 13px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.titulo}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 3,
                      }}
                    >
                      Cola {roleLabel} · {ESTADO_META[t.estado].label}
                      {t.due_date ? ` · vence ${t.due_date}` : ""}
                    </div>
                  </button>
                  <Badge tone="info" size="sm">
                    {roleLabel}
                  </Badge>
                  {canEdit && (
                    <ActionButton
                      variant={mine ? "primary" : "ghost"}
                      size="sm"
                      idleLabel="Tomar tarea"
                      loadingLabel="Tomando…"
                      successLabel="Tuya"
                      onAction={async () => takeTaskAction(t.id)}
                      onSuccess={() => {
                        toast.success(`Tomaste "${t.titulo}"`);
                        startRefresh(() => router.refresh());
                      }}
                      onError={(m) => toast.error(m)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Contenido principal */}
      {view === "actas" ? (
        <ActasList meetings={meetings} canEdit={canEdit} />
      ) : localTasks.length === 0 ? (
        <EmptyState
          eyebrow="Bitácora"
          title="Sin tareas todavía"
          description={
            <>
              {BITACORA_EMPTY_RULE}.{" "}
              {canEdit
                ? "Crea la primera con “Nueva tarea” o analiza una conversación."
                : "Cuando el equipo cree tareas las verás acá."}
            </>
          }
          action={
            canEdit ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setDrawer({ mode: "create" })}
              >
                {Icon.plus(14)} Nueva tarea
              </button>
            ) : undefined
          }
        />
      ) : view === "tablero" ? (
        <BoardKanban
          tasks={boardTasks}
          nameByUserId={nameByUserId}
          canEdit={canEdit}
          hoyISO={hoyISO}
          onMove={handleMove}
          onOpen={(t) => setDrawer({ mode: "edit", task: t })}
        />
      ) : (
        <BoardList
          tasks={boardTasks}
          nameByUserId={nameByUserId}
          meetingTitleById={meetingTitleById}
          canEdit={canEdit}
          hoyISO={hoyISO}
          exportParams={exportParams}
          onMove={handleMove}
          onOpen={(t) => setDrawer({ mode: "edit", task: t })}
        />
      )}

      {drawer && (
        <TaskDrawer
          mode={drawer.mode}
          task={drawer.mode === "edit" ? drawer.task : null}
          profiles={profiles}
          canEdit={canEdit}
          myUserId={myUserId}
          tenantId={tenantId}
          onClose={closeDrawer}
          onSaved={() => {
            closeDrawer();
            startRefresh(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
