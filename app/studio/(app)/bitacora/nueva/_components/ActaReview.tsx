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
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { AssignableProfile } from "@/lib/studio/bitacora/bitacora-queries";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";
import type { ResolvedActa, ResolvedTask } from "@/lib/studio/bitacora/match";
import {
  ESCUCHA_SUGERENCIA_LABEL,
  type ActaData,
  type ActaDuda,
  type ActaHilo,
  type ActaVinculoCliente,
  type BitacoraPrioridad,
  type ConfirmActaInput,
  type EscuchaSugerencia,
  type MeetingTipo,
} from "@/lib/studio/bitacora/bitacora-types";
import { tasksHaveManualEdits } from "@/lib/studio/bitacora/acta-edits";
import {
  analyzeEscuchaAction,
  confirmActaAction,
  regenerateActaTasksAction,
} from "../../actions";

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
  /** ¿Mostrar el 2º botón privado de Escucha Activa? (capability admin). */
  canEscucha: boolean;
  onBack: () => void;
}

export function ActaReview({
  meetingId,
  resolved,
  profiles,
  tipo,
  myUserId,
  canEscucha,
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
    vinculo_cliente: resolved.vinculo_cliente,
  }));

  // Cliente atado por el humano en la revisión (SDD-0150 Fase B). Se pre-ata si
  // el meeting ya venía con cliente (necesita_confirmar=false); si es una
  // sugerencia del match, arranca sin atar y el humano confirma.
  const [linkedClient, setLinkedClient] = useState<{ id: string; name: string } | null>(
    () => {
      const v = resolved.vinculo_cliente;
      return v.client_id_sugerido && !v.necesita_confirmar
        ? { id: v.client_id_sugerido, name: v.cliente_nombre_sugerido ?? "Cliente" }
        : null;
    },
  );

  // Línea base = última propuesta de la IA (para saber si el humano ya ajustó
  // tareas antes de regenerar). Se actualiza cuando la IA vuelve a proponer.
  const baselineRef = useRef<EditTask[]>(tasks);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // ── Escucha Activa (SDD-0150 Fase D · privado, admin-only) ──
  const [escucha, setEscucha] = useState<EscuchaSugerencia[] | null>(null);
  const [escuchaTaskIds, setEscuchaTaskIds] = useState<string[]>([]);
  const [escuchaRunning, setEscuchaRunning] = useState(false);
  // Índices de sugerencias ya aplicadas/descartadas (para plegarlas).
  const [resolvedSug, setResolvedSug] = useState<Set<number>>(() => new Set());
  const escSeq = useRef(0);

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
        const r = res.resolved;
        const next = toEditTasks(r.tasks);
        baselineRef.current = next;
        setTasks(next);
        // Refresca el acta (menos título/resumen, que son del humano).
        setActa((prev) => ({
          puntos: r.puntos,
          hablaron: r.hablaron,
          decisiones: r.decisiones,
          pendientes: r.pendientes,
          proxima_reunion: r.proxima_reunion,
          hilos: r.hilos,
          dudas_clasificacion: r.dudas_clasificacion,
          // El vínculo no cambia al regenerar tareas: conserva el ya resuelto.
          vinculo_cliente: prev.vinculo_cliente,
        }));
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
    // Refleja el cliente confirmado por el humano en el vínculo del acta.
    const confirmedActa: ActaData = acta.vinculo_cliente
      ? {
          ...acta,
          vinculo_cliente: {
            ...acta.vinculo_cliente,
            client_id_sugerido: linkedClient?.id ?? null,
            cliente_nombre_sugerido: linkedClient?.name ?? null,
            necesita_confirmar: false,
          },
        }
      : acta;
    const payload: ConfirmActaInput = {
      meetingId,
      titulo: titulo.trim(),
      resumen: resumen.trim(),
      visibilidad: confidencial ? "gestores" : "equipo",
      acta: confirmedActa,
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
        // Ata cada tarea al cliente confirmado (o null si el humano no ató ninguno).
        client_id: linkedClient?.id ?? null,
      })),
    };
    return confirmActaAction(payload);
  }

  async function runEscucha() {
    if (escuchaRunning) return;
    setEscuchaRunning(true);
    try {
      const res = await analyzeEscuchaAction({
        meetingId,
        actaResumen: resumen.trim(),
        actaTareas: tasks.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad })),
      });
      if (res.ok && res.sugerencias) {
        setEscuchaTaskIds(tasks.map((t) => t._id));
        setResolvedSug(new Set());
        setEscucha(res.sugerencias);
        if (res.sugerencias.length === 0) {
          toast.success("Escucha Activa no encontró nada que ajustar");
        }
      } else {
        toast.error(res.error ?? "No se pudo correr la Escucha Activa.");
      }
    } catch {
      toast.error("No se pudo correr la Escucha Activa.");
    } finally {
      setEscuchaRunning(false);
    }
  }

  // Aplica una sugerencia sobre el estado local (edición manual del founder).
  function applySugerencia(i: number, s: EscuchaSugerencia) {
    if (s.tipo === "agregar_tarea") {
      const nueva: EditTask = {
        _id: `esc-${escSeq.current++}`,
        titulo: s.sugerido.slice(0, 300),
        descripcion: null,
        prioridad: "media",
        tipo: "empleado",
        due_date: null,
        para_agente: false,
        checklist: [],
        assignee_user_id: null,
        responsable_nombre: null,
        matched: false,
        suggestedName: null,
      };
      setTasks((ts) => [...ts, nueva]);
    } else if (s.task_index != null) {
      const id = escuchaTaskIds[s.task_index];
      if (!id) {
        toast.error("Esa tarea ya no está en la lista.");
        return;
      }
      if (s.tipo === "subir_prioridad") patch(id, { prioridad: "alta" });
      else if (s.tipo === "reescribir_tarea" || s.tipo === "hacer_explicito") {
        patch(id, { titulo: s.sugerido.slice(0, 300) });
      }
    }
    setResolvedSug((prev) => new Set(prev).add(i));
    toast.success("Sugerencia aplicada");
  }

  function dismissSugerencia(i: number) {
    setResolvedSug((prev) => new Set(prev).add(i));
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
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
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
          marginBottom: "var(--s-4)",
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
            <span style={{ color: "var(--ink-soft)" }}>Hablaron: </span>
            {acta.hablaron.join(", ")}
          </div>
        )}
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          <span style={{ color: "var(--ink-soft)" }}>Próxima reunión: </span>
          {acta.proxima_reunion.fecha ?? "por definir"}
          {acta.proxima_reunion.foco ? ` · ${acta.proxima_reunion.foco}` : ""}
        </div>

        <label
          htmlFor="ar-confidencial"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            font: "500 12px/1.3 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
            paddingTop: "var(--s-1)",
          }}
        >
          <input
            id="ar-confidencial"
            type="checkbox"
            checked={confidencial}
            onChange={(e) => setConfidencial(e.target.checked)}
          />
          Reunión confidencial
          <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
            (sólo dirección ve el acta; las tareas siguen visibles para su dueño)
          </span>
        </label>
      </section>

      {/* Vínculo con cliente (SDD-0150 Fase B): confirmar el externo detectado */}
      <VinculoPanel
        vinculo={acta.vinculo_cliente}
        linked={linkedClient}
        onLink={setLinkedClient}
      />

      {/* Volver a generar tareas con el resumen editado como guía */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          marginBottom: "var(--s-3)",
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

      {/* Escucha Activa (SDD-0150 Fase D · privado, solo admin) */}
      {canEscucha && (
        <EscuchaPanel
          running={escuchaRunning}
          sugerencias={escucha}
          resolvedSug={resolvedSug}
          escuchaTaskIds={escuchaTaskIds}
          onRun={runEscucha}
          onApply={applySugerencia}
          onDismiss={dismissSugerencia}
        />
      )}

      {/* Confirmar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
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
          gap: "var(--s-1)",
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
          gap: "var(--s-2)",
        }}
      >
        {label}
        <Badge tone="neutral" size="sm">
          {count}
        </Badge>
      </summary>
      <div style={{ paddingBottom: "var(--s-3)", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
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
            <span style={{ marginLeft: "var(--s-2)" }}>
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
            <span style={{ color: "var(--ink-soft)" }}> · {d.hablante}</span>
          ) : null}
          {d.opciones.length > 0 && (
            <span style={{ color: "var(--ink-soft)" }}>
              {" "}
              ({d.opciones.join(" / ")})
            </span>
          )}
        </div>
      ))}
    </Collapsible>
  );
}

/**
 * Vínculo con cliente (SDD-0150 Fase B). Muestra el externo que detectó la IA y
 * deja que el humano lo ate a un cliente real (acepta la sugerencia del match, o
 * busca otro en el combobox). NUNCA se auto-crea un cliente. Se oculta si no hubo
 * externo detectado.
 */
function VinculoPanel({
  vinculo,
  linked,
  onLink,
}: {
  vinculo: ActaVinculoCliente | undefined;
  linked: { id: string; name: string } | null;
  onLink: (c: { id: string; name: string } | null) => void;
}) {
  const [search, setSearch] = useState("");
  if (!vinculo || !vinculo.nombre_detectado) return null;

  const sugId = vinculo.client_id_sugerido;
  const sugNombre = vinculo.cliente_nombre_sugerido;

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--wine)",
        borderRadius: "var(--r-md)",
        background: "var(--bg-surface)",
        padding: "14px 16px",
        marginBottom: "var(--s-4)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
        Vínculo con cliente
      </div>
      <div style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        La IA detectó que hablaste con{" "}
        <strong style={{ color: "var(--ink)" }}>«{vinculo.nombre_detectado}»</strong>
        {vinculo.tipo_externo && vinculo.tipo_externo !== "indeterminado"
          ? ` (${vinculo.tipo_externo})`
          : ""}
        .
      </div>

      {linked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Badge tone="success" size="sm">
            Atado a {linked.name}
          </Badge>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => onLink(null)}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          {sugId && sugNombre && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                ¿Es <strong>{sugNombre}</strong>?
              </span>
              <Badge tone="neutral" size="sm">
                confianza {vinculo.confianza}
              </Badge>
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                onClick={() => onLink({ id: sugId, name: sugNombre })}
              >
                Sí, atar
              </button>
            </div>
          )}
          <div>
            <label
              className="studio-label"
              htmlFor="ar-vinculo-cli"
              style={{ marginBottom: 5, display: "block" }}
            >
              {sugId ? "…o busca otro cliente" : "Busca y ata el cliente"}
            </label>
            <ClientCombobox
              id="ar-vinculo-cli"
              value={search}
              onManualChange={setSearch}
              onSelect={(hit: ClientSearchHit) => {
                onLink({ id: hit.id, name: hit.name });
                setSearch("");
              }}
              ariaLabel="Buscar cliente para atar la reunión"
            />
          </div>
          {vinculo.posible_cliente_nuevo && (
            <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
              Parece un cliente nuevo. Si aplica, regístralo en Clientes; por ahora
              puedes dejarlo sin atar.
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Tipos de sugerencia que se pueden "Aplicar" (mutan una tarea); el resto es
 *  informativo (se "descarta/visto"). */
const ESCUCHA_APLICABLES = new Set<EscuchaSugerencia["tipo"]>([
  "subir_prioridad",
  "reescribir_tarea",
  "hacer_explicito",
  "agregar_tarea",
]);

/**
 * Panel PRIVADO de Escucha Activa (SDD-0150 Fase D · solo admin). Corre la capa
 * suspicaz sobre el acta y muestra recomendaciones que el founder aplica a mano.
 * No se guarda el análisis.
 */
function EscuchaPanel({
  running,
  sugerencias,
  resolvedSug,
  escuchaTaskIds,
  onRun,
  onApply,
  onDismiss,
}: {
  running: boolean;
  sugerencias: EscuchaSugerencia[] | null;
  resolvedSug: Set<number>;
  escuchaTaskIds: string[];
  onRun: () => void;
  onApply: (i: number, s: EscuchaSugerencia) => void;
  onDismiss: (i: number) => void;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--wine)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-elevated)",
        padding: "16px 18px",
        marginTop: 18,
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <div>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
            Escucha Activa · privado
          </div>
          <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "5px 0 0", maxWidth: 560 }}>
            Análisis de escucha profunda solo para ti (lectura entre líneas). No se
            guarda; aplicas lo que quieras.
          </p>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-secondary studio-btn-sm"
          onClick={onRun}
          disabled={running}
          aria-busy={running}
          style={{ alignSelf: "flex-start" }}
        >
          {running ? (
            <>
              <span className="studio-spin" aria-hidden style={{ width: 14, height: 14 }} />
              Analizando…
            </>
          ) : (
            <>
              {Icon.spark(14)}
              {sugerencias === null ? "Analizar con Escucha Activa" : "Volver a analizar"}
            </>
          )}
        </button>
      </div>

      {sugerencias !== null && sugerencias.length === 0 && (
        <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          No encontró nada que ajustar. El acta se ve consistente.
        </p>
      )}

      {sugerencias !== null && sugerencias.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {sugerencias.map((s, i) =>
            resolvedSug.has(i) ? null : (
              <SugerenciaCard
                key={i}
                idx={i}
                s={s}
                hasTask={s.task_index != null && Boolean(escuchaTaskIds[s.task_index])}
                onApply={onApply}
                onDismiss={onDismiss}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function SugerenciaCard({
  idx,
  s,
  hasTask,
  onApply,
  onDismiss,
}: {
  idx: number;
  s: EscuchaSugerencia;
  hasTask: boolean;
  onApply: (i: number, s: EscuchaSugerencia) => void;
  onDismiss: (i: number) => void;
}) {
  const aplicable = ESCUCHA_APLICABLES.has(s.tipo);
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
        <Badge tone="neutral" size="sm">
          {ESCUCHA_SUGERENCIA_LABEL[s.tipo]}
        </Badge>
        {s.task_index != null && hasTask && (
          <span style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
            Tarea #{s.task_index + 1}
          </span>
        )}
      </div>
      {s.actual && (
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          <span style={{ textDecoration: "line-through" }}>{s.actual}</span>
        </div>
      )}
      <div style={{ font: "600 12.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
        {s.sugerido}
      </div>
      <div style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", fontStyle: "italic" }}>
        {s.motivo}
      </div>
      <div style={{ display: "flex", gap: "var(--s-2)" }}>
        {aplicable && (
          <button
            type="button"
            className="studio-btn studio-btn-secondary studio-btn-sm"
            onClick={() => onApply(idx, s)}
          >
            {Icon.check(13)} Aplicar
          </button>
        )}
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={() => onDismiss(idx)}
        >
          {aplicable ? "Descartar" : "Visto"}
        </button>
      </div>
    </div>
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
    <section style={{ marginBottom: "var(--s-4)" }}>
      <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 10 }}>
        {title}
      </div>
      {tasks.length === 0 ? (
        <p
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
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
        <Aviso tono="atencion" compacto>
          La IA sugirió «{task.suggestedName}», sin match en el equipo. Elige a
          quién asignar (o déjala sin asignar).
        </Aviso>
      )}

      {/* para_agente */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "var(--s-2)" }}>
            {task.checklist.map((c, i) => (
              <div
                key={`${i}-${c}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
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
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
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
