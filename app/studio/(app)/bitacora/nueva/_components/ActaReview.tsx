"use client";

/**
 * ActaReview · el humano autoriza (SDD-0146 · Fase 2).
 *
 * Revisión editable ANTES de confirmar (regla de oro: la IA propone, el humano
 * autoriza). Se puede editar título/resumen, y por cada tarea: título, dueño
 * (reasignar), fecha, prioridad, `para_agente`, checklist, o quitarla. Si la IA
 * sugirió un responsable sin match, se muestra en ámbar y la tarea queda sin
 * asignar hasta que el humano elija. "Confirmar y crear tareas" llama la RPC
 * transaccional `bitacora_confirm_meeting` (todo o nada).
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { AssignableProfile } from "@/lib/studio/bitacora/bitacora-queries";
import type { ResolvedActa, ResolvedTask } from "@/lib/studio/bitacora/match";
import {
  type ActaData,
  type ActaDuda,
  type ActaHilo,
  type BitacoraPrioridad,
  type ConfirmActaInput,
  type MeetingTipo,
} from "@/lib/studio/bitacora/bitacora-types";
import { tasksHaveManualEdits } from "@/lib/studio/bitacora/acta-edits";
import { confirmActaAction, regenerateActaTasksAction } from "../../actions";

interface EditTask extends ResolvedTask {
  _id: string;
}

/** Mapea la propuesta resuelta a tareas editables con id estable. */
function toEditTasks(tasks: readonly ResolvedTask[]): EditTask[] {
  return tasks.map((t, i) => ({ ...t, _id: `t${i}` }));
}

interface Props {
  meetingId: string;
  resolved: ResolvedActa;
  profiles: AssignableProfile[];
  tipo: MeetingTipo;
  clienteNombre: string | null;
  myUserId: string | null;
  onBack: () => void;
}

export function ActaReview({
  meetingId,
  resolved,
  profiles,
  tipo,
  myUserId,
  onBack,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [titulo, setTitulo] = useState(resolved.titulo);
  const [resumen, setResumen] = useState(resolved.resumen);
  const [confidencial, setConfidencial] = useState(false);
  const [tasks, setTasks] = useState<EditTask[]>(() => toEditTasks(resolved.tasks));
  // Acta (puntos/decisiones/etc.) sólo se refresca al regenerar — título y
  // resumen los edita el humano arriba y NUNCA se tocan al regenerar.
  const [acta, setActa] = useState<ActaData>(() => ({
    puntos: resolved.puntos,
    hablaron: resolved.hablaron,
    decisiones: resolved.decisiones,
    pendientes: resolved.pendientes,
    proxima_reunion: resolved.proxima_reunion,
    hilos: resolved.hilos,
    dudas_clasificacion: resolved.dudas_clasificacion,
  }));

  // Línea base = última propuesta de la IA (para saber si el humano ya ajustó
  // tareas antes de regenerar). Se actualiza cuando la IA vuelve a proponer.
  const baselineRef = useRef<EditTask[]>(tasks);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const nameByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) m[p.user_id] = p.display_name;
    return m;
  }, [profiles]);

  const equipoTasks = tasks.filter((t) => t.tipo === "empleado");
  const clienteTasks = tasks.filter((t) => t.tipo === "entregable_cliente");

  const patch = (id: string, over: Partial<EditTask>) =>
    setTasks((ts) => ts.map((t) => (t._id === id ? { ...t, ...over } : t)));

  const removeTask = (id: string) =>
    setTasks((ts) => ts.filter((t) => t._id !== id));

  const canConfirm = titulo.trim().length > 0;

  // "Volver a generar tareas": si el humano ya ajustó tareas, avisa antes de
  // reemplazarlas; si no, regenera directo.
  function onRegenerateClick() {
    if (regenerating) return;
    if (tasksHaveManualEdits(tasks, baselineRef.current)) {
      setShowRegenConfirm(true);
    } else {
      void runRegenerate();
    }
  }

  async function runRegenerate() {
    setShowRegenConfirm(false);
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await regenerateActaTasksAction({
        meetingId,
        resumenEditado: resumen.trim(),
      });
      if (res.ok && res.resolved) {
        const next = toEditTasks(res.resolved.tasks);
        baselineRef.current = next;
        setTasks(next);
        // Refresca el acta (menos título/resumen, que son del humano).
        setActa({
          puntos: res.resolved.puntos,
          hablaron: res.resolved.hablaron,
          decisiones: res.resolved.decisiones,
          pendientes: res.resolved.pendientes,
          proxima_reunion: res.resolved.proxima_reunion,
          hilos: res.resolved.hilos,
          dudas_clasificacion: res.resolved.dudas_clasificacion,
        });
        toast.success("Tareas regeneradas");
      } else {
        toast.error(res.error ?? "No se pudieron regenerar las tareas.");
      }
    } catch {
      toast.error("No se pudieron regenerar las tareas.");
    } finally {
      setRegenerating(false);
    }
  }

  async function confirm() {
    const payload: ConfirmActaInput = {
      meetingId,
      titulo: titulo.trim(),
      resumen: resumen.trim(),
      visibilidad: confidencial ? "gestores" : "equipo",
      acta,
      tasks: tasks.map((t) => ({
        titulo: t.titulo.trim(),
        descripcion: t.descripcion,
        prioridad: t.prioridad,
        tipo: t.tipo,
        due_date: t.due_date,
        para_agente: t.para_agente,
        assignee_user_id: t.assignee_user_id,
        responsable_nombre: t.responsable_nombre,
        checklist: t.checklist,
      })),
    };
    return confirmActaAction(payload);
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "600 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 0,
          marginBottom: 14,
        }}
      >
        {Icon.arrowL(14)} Volver a la transcripción
      </button>

      <div style={{ marginBottom: 18 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
          Revisar y confirmar
        </div>
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "6px 0 0",
          }}
        >
          La IA propuso este acta. Revísala, ajusta las tareas y confirma —
          recién ahí se crean las tareas.
        </p>
      </div>

      {/* Acta */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "18px 20px",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <label className="studio-label" htmlFor="ar-titulo" style={{ marginBottom: 6, display: "block" }}>
            Título del acta
          </label>
          <input
            id="ar-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={300}
            className="studio-input"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="ar-resumen" style={{ marginBottom: 6, display: "block" }}>
            Resumen
          </label>
          <textarea
            id="ar-resumen"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            rows={3}
            className="studio-input"
            style={{ width: "100%", resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        <ReadonlyList label="Puntos clave" items={acta.puntos} />
        <ReadonlyList label="Decisiones" items={acta.decisiones} />
        <ReadonlyList label="Quedó en el aire" items={acta.pendientes} />
        <HilosPanel hilos={acta.hilos ?? []} />
        <DudasPanel dudas={acta.dudas_clasificacion ?? []} />
        {acta.hablaron.length > 0 && (
          <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            <span style={{ color: "var(--ink-mute)" }}>Hablaron: </span>
            {acta.hablaron.join(", ")}
          </div>
        )}
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          <span style={{ color: "var(--ink-mute)" }}>Próxima reunión: </span>
          {acta.proxima_reunion.fecha ?? "por definir"}
          {acta.proxima_reunion.foco ? ` · ${acta.proxima_reunion.foco}` : ""}
        </div>

        <label
          htmlFor="ar-confidencial"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "500 12px/1.3 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
            paddingTop: 4,
          }}
        >
          <input
            id="ar-confidencial"
            type="checkbox"
            checked={confidencial}
            onChange={(e) => setConfidencial(e.target.checked)}
          />
          Reunión confidencial
          <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}>
            (sólo dirección ve el acta; las tareas siguen visibles para su dueño)
          </span>
        </label>
      </section>

      {/* Volver a generar tareas con el resumen editado como guía */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            maxWidth: 520,
          }}
        >
          ¿Ajustaste el resumen? Vuelve a generar las tareas tomándolo como guía.
          Tu título y tu resumen se mantienen.
        </span>
        <button
          type="button"
          className="studio-btn studio-btn-secondary studio-btn-sm"
          onClick={onRegenerateClick}
          disabled={regenerating}
          aria-busy={regenerating}
        >
          {regenerating ? (
            <>
              <span
                className="studio-spin"
                aria-hidden
                style={{ width: 14, height: 14 }}
              />
              Regenerando…
            </>
          ) : (
            <>
              {Icon.refresh(14)} Volver a generar tareas
            </>
          )}
        </button>
      </div>

      {/* Tareas del equipo */}
      <TaskGroup
        title={`Tareas del equipo (${equipoTasks.length})`}
        empty="La IA no propuso tareas internas."
        tasks={equipoTasks}
        profiles={profiles}
        myUserId={myUserId}
        nameByUserId={nameByUserId}
        onPatch={patch}
        onRemove={removeTask}
      />

      {/* Esperando del cliente (solo variante cliente) */}
      {tipo === "cliente" && (
        <TaskGroup
          title={`Esperando del cliente (${clienteTasks.length})`}
          empty="La IA no registró entregables del cliente."
          tasks={clienteTasks}
          profiles={profiles}
          myUserId={myUserId}
          nameByUserId={nameByUserId}
          onPatch={patch}
          onRemove={removeTask}
        />
      )}

      {/* Confirmar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {tasks.length} tarea{tasks.length === 1 ? "" : "s"} se crearán al confirmar.
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a
            className="studio-btn studio-btn-ghost"
            href={`/api/studio/bitacora/export?tipo=acta&id=${encodeURIComponent(meetingId)}`}
          >
            {Icon.download(14)} Descargar acta
          </a>
          <ActionButton
            variant="primary"
            idleLabel="Confirmar y crear tareas"
            loadingLabel="Confirmando…"
            successLabel="Acta confirmada"
            idleIcon={Icon.check(14)}
            disabled={!canConfirm}
            onAction={confirm}
            onSuccess={() => {
              toast.success("Acta confirmada · tareas creadas");
              router.push("/studio/bitacora");
            }}
            onError={(m) => toast.error(m)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={showRegenConfirm}
        title="Volver a generar las tareas"
        message="Vas a reemplazar las tareas actuales por unas nuevas que propondrá la IA. Se perderán los ajustes que hiciste en las tareas (tu título y tu resumen se mantienen). ¿Continuar?"
        confirmLabel="Volver a generar"
        cancelLabel="Cancelar"
        pending={regenerating}
        onCancel={() => setShowRegenConfirm(false)}
        onConfirm={() => void runRegenerate()}
      />
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function ReadonlyList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="studio-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((it, i) => (
          <li
            key={i}
            style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Panel colapsable (native <details>, cerrado por defecto) para los campos
 * ricos del acta (SDD-0150). Etiqueta con contador; `tone` pinta el borde.
 */
function Collapsible({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: string;
  children: ReactNode;
}) {
  return (
    <details
      style={{
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${tone}`,
        borderRadius: "var(--r-sm)",
        background: "var(--bg-elevated)",
        padding: "0 12px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          padding: "9px 0",
          font: "700 11px/1 var(--f-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {label}
        <Badge tone="neutral" size="sm">
          {count}
        </Badge>
      </summary>
      <div style={{ paddingBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </details>
  );
}

/** Hilos cosidos (tema → estado final; marca las contradicciones sin resolver). */
function HilosPanel({ hilos }: { hilos: ActaHilo[] }) {
  if (hilos.length === 0) return null;
  return (
    <Collapsible label="Hilos" count={hilos.length} tone="var(--info)">
      {hilos.map((h, i) => (
        <div
          key={i}
          style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}
        >
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{h.tema}</span>
          {h.estado_final ? ` — ${h.estado_final}` : ""}
          {h.contradiccion_sin_resolver && (
            <span style={{ marginLeft: 8 }}>
              <Badge tone="warning" size="sm">
                sin resolver
              </Badge>
            </span>
          )}
        </div>
      ))}
    </Collapsible>
  );
}

/** Dudas de clasificación empleado-vs-externo que el humano debe resolver. */
function DudasPanel({ dudas }: { dudas: ActaDuda[] }) {
  if (dudas.length === 0) return null;
  return (
    <Collapsible label="Dudas de clasificación" count={dudas.length} tone="var(--warning)">
      {dudas.map((d, i) => (
        <div
          key={i}
          style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}
        >
          {d.texto}
          {d.hablante ? (
            <span style={{ color: "var(--ink-mute)" }}> · {d.hablante}</span>
          ) : null}
          {d.opciones.length > 0 && (
            <span style={{ color: "var(--ink-mute)" }}>
              {" "}
              ({d.opciones.join(" / ")})
            </span>
          )}
        </div>
      ))}
    </Collapsible>
  );
}

interface TaskGroupProps {
  title: string;
  empty: string;
  tasks: EditTask[];
  profiles: AssignableProfile[];
  myUserId: string | null;
  nameByUserId: Record<string, string>;
  onPatch: (id: string, over: Partial<EditTask>) => void;
  onRemove: (id: string) => void;
}

function TaskGroup({
  title,
  empty,
  tasks,
  profiles,
  myUserId,
  onPatch,
  onRemove,
}: TaskGroupProps) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 10 }}>
        {title}
      </div>
      {tasks.length === 0 ? (
        <p
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: 0,
          }}
        >
          {empty}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((t) => (
            <TaskEditCard
              key={t._id}
              task={t}
              profiles={profiles}
              myUserId={myUserId}
              onPatch={onPatch}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface TaskEditCardProps {
  task: EditTask;
  profiles: AssignableProfile[];
  myUserId: string | null;
  onPatch: (id: string, over: Partial<EditTask>) => void;
  onRemove: (id: string) => void;
}

function TaskEditCard({
  task,
  profiles,
  myUserId,
  onPatch,
  onRemove,
}: TaskEditCardProps) {
  const [chkDraft, setChkDraft] = useState("");
  const unassignedWithSuggestion = !task.assignee_user_id && task.suggestedName;

  const addChk = () => {
    const v = chkDraft.trim();
    if (!v) return;
    onPatch(task._id, { checklist: [...task.checklist, v.slice(0, 500)] });
    setChkDraft("");
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          value={task.titulo}
          onChange={(e) => onPatch(task._id, { titulo: e.target.value })}
          maxLength={300}
          aria-label="Título de la tarea"
          className="studio-input"
          style={{ flex: 1, font: "700 13px/1.3 var(--f-sans)" }}
        />
        <button
          type="button"
          onClick={() => onRemove(task._id)}
          aria-label="Quitar tarea"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ color: "var(--danger)" }}
        >
          {Icon.trash(13)}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
        <div>
          <label
            className="studio-label"
            style={{ marginBottom: 5, display: "block" }}
            htmlFor={`asg-${task._id}`}
          >
            Dueño
          </label>
          <select
            id={`asg-${task._id}`}
            value={task.assignee_user_id ?? ""}
            onChange={(e) =>
              onPatch(task._id, { assignee_user_id: e.target.value || null })
            }
            className="studio-input"
            style={{
              width: "100%",
              borderColor: unassignedWithSuggestion ? "var(--warning)" : undefined,
            }}
          >
            <option value="">Sin asignar</option>
            {profiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.display_name}
                {p.user_id === myUserId ? " (tú)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="studio-label"
            style={{ marginBottom: 5, display: "block" }}
            htmlFor={`prio-${task._id}`}
          >
            Prioridad
          </label>
          <select
            id={`prio-${task._id}`}
            value={task.prioridad}
            onChange={(e) =>
              onPatch(task._id, { prioridad: e.target.value as BitacoraPrioridad })
            }
            className="studio-input"
            style={{ width: "100%" }}
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div>
          <label
            className="studio-label"
            style={{ marginBottom: 5, display: "block" }}
            htmlFor={`due-${task._id}`}
          >
            Vence
          </label>
          <input
            id={`due-${task._id}`}
            type="date"
            value={task.due_date ?? ""}
            onChange={(e) => onPatch(task._id, { due_date: e.target.value || null })}
            className="studio-input"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {unassignedWithSuggestion && (
        <div
          role="note"
          style={{
            font: "600 11.5px/1.4 var(--f-sans)",
            color: "var(--warning)",
            background: "var(--warning-bg)",
            padding: "7px 10px",
            borderRadius: "var(--r-sm)",
          }}
        >
          La IA sugirió «{task.suggestedName}», sin match en el equipo. Elige a
          quién asignar (o déjala sin asignar).
        </div>
      )}

      {/* para_agente */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "500 12px/1.3 var(--f-sans)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={task.para_agente}
          onChange={(e) => onPatch(task._id, { para_agente: e.target.checked })}
        />
        Ejecutable por agente
        <Badge tone="info" size="sm">
          prompt → CC
        </Badge>
      </label>

      {/* Checklist */}
      <div>
        <div className="studio-label" style={{ marginBottom: 6 }}>
          Checklist
        </div>
        {task.checklist.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {task.checklist.map((c, i) => (
              <div
                key={`${i}-${c}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                <span style={{ flex: 1 }}>{c}</span>
                <button
                  type="button"
                  onClick={() =>
                    onPatch(task._id, {
                      checklist: task.checklist.filter((_, j) => j !== i),
                    })
                  }
                  aria-label={`Quitar "${c}"`}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--ink-mute)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  {Icon.close(12)}
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chkDraft}
            onChange={(e) => setChkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addChk();
              }
            }}
            maxLength={500}
            placeholder="Agregar sub-paso…"
            className="studio-input"
            style={{ flex: 1 }}
            aria-label="Nuevo sub-paso"
          />
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={addChk}
            disabled={chkDraft.trim() === ""}
          >
            {Icon.plus(12)} Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
