"use client";

/**
 * TaskDrawer · crear/editar tarea (SDD-0146 · Fase 1).
 *
 * DrawerShell compartido: <form id="bitacora-task-form"> en el cuerpo +
 * DrawerFooter con formId (HTML5 estándar — NUNCA requestSubmit()).
 *
 * Dueño = select del pool de asignables (UN dueño, DRI). Sin dueño → puede ir
 * a la cola de un rol. Checklist plano agregable. El cliente vinculado llega
 * en Fase 2 (junto con las actas).
 */

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
} from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type {
  AssignableProfile,
  BitacoraTask,
} from "@/lib/studio/bitacora/bitacora-queries";
import {
  BITACORA_ASSIGNABLE_ROLES,
  ESTADO_META,
  ROLE_QUEUE_LABELS,
  type BitacoraActionState,
} from "@/lib/studio/bitacora/bitacora-types";
import {
  addChecklistItemAction,
  createTaskAction,
  toggleChecklistItemAction,
  updateTaskAction,
} from "../actions";

const FORM_ID = "bitacora-task-form";
const INITIAL_STATE: BitacoraActionState = {};

interface Props {
  mode: "create" | "edit";
  task: BitacoraTask | null;
  profiles: AssignableProfile[];
  canEdit: boolean;
  myUserId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskDrawer({
  mode,
  task,
  profiles,
  canEdit,
  myUserId,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const isCreate = mode === "create";

  const [titulo, setTitulo] = useState(task?.titulo ?? "");
  const [ownerId, setOwnerId] = useState(task?.assignees[0]?.user_id ?? "");
  const [role, setRole] = useState(task?.assigned_role ?? "");
  const [newItems, setNewItems] = useState<string[]>([]);
  const [newItemDraft, setNewItemDraft] = useState("");
  // Checklist existente (edit): toggle optimista local.
  const [items, setItems] = useState(task?.checklist ?? []);

  const [state, formAction, isPending] = useActionState(
    isCreate ? createTaskAction : updateTaskAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isCreate ? "Tarea creada" : "Tarea guardada");
      onSaved();
    }
  }, [state, isCreate, toast, onSaved]);

  const addDraftItem = () => {
    const v = newItemDraft.trim();
    if (!v) return;
    if (isCreate) {
      setNewItems((xs) => [...xs, v]);
      setNewItemDraft("");
      return;
    }
    if (!task) return;
    setNewItemDraft("");
    startTransition(async () => {
      const res = await addChecklistItemAction(task.id, v);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      // Optimista simple: aparece al refrescar; feedback inmediato acá.
      setItems((xs) => [
        ...xs,
        {
          id: `tmp-${Date.now()}`,
          texto: v,
          done: false,
          done_by: null,
          done_at: null,
          orden: xs.length,
        },
      ]);
    });
  };

  const toggleItem = (itemId: string, done: boolean) => {
    if (!canEdit || itemId.startsWith("tmp-")) return;
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, done } : x)));
    startTransition(async () => {
      const res = await toggleChecklistItemAction(itemId, done);
      if (res?.error) {
        setItems((xs) =>
          xs.map((x) => (x.id === itemId ? { ...x, done: !done } : x)),
        );
        toast.error(res.error);
      }
    });
  };

  const fieldError = (k: string) => state.fieldErrors?.[k];
  const canSubmit = canEdit && titulo.trim().length > 0;

  return (
    <DrawerShell
      title={isCreate ? "Nueva tarea" : "Editar tarea"}
      subtitle={
        isCreate
          ? "Compromiso interno del equipo"
          : task
            ? `Estado: ${ESTADO_META[task.estado].label}`
            : undefined
      }
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {state.error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-md)",
              font: "500 12px/1.4 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}

        {!isCreate && task && <input type="hidden" name="task_id" value={task.id} />}

        {/* Título */}
        <div>
          <label className="studio-label" htmlFor="bt-titulo" style={{ marginBottom: 6, display: "block" }}>
            Título *
          </label>
          <input
            id="bt-titulo"
            name="titulo"
            required
            maxLength={300}
            disabled={!canEdit}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Enviar packing list a Yiwu Trading"
            className="studio-input"
            style={{ width: "100%" }}
          />
          {fieldError("titulo") && <FieldError msg={fieldError("titulo")!} />}
        </div>

        {/* Descripción */}
        <div>
          <label className="studio-label" htmlFor="bt-desc" style={{ marginBottom: 6, display: "block" }}>
            Descripción
          </label>
          <textarea
            id="bt-desc"
            name="descripcion"
            rows={3}
            maxLength={4000}
            disabled={!canEdit}
            defaultValue={task?.descripcion ?? ""}
            placeholder="Contexto, links, acuerdos…"
            className="studio-input"
            style={{ width: "100%", resize: "vertical" }}
          />
          {fieldError("descripcion") && <FieldError msg={fieldError("descripcion")!} />}
        </div>

        {/* Prioridad + tipo + vence */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="bt-prio" style={{ marginBottom: 6, display: "block" }}>
              Prioridad
            </label>
            <select
              id="bt-prio"
              name="prioridad"
              disabled={!canEdit}
              defaultValue={task?.prioridad ?? "media"}
              className="studio-input"
              style={{ width: "100%" }}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="bt-tipo" style={{ marginBottom: 6, display: "block" }}>
              Tipo
            </label>
            <select
              id="bt-tipo"
              name="tipo"
              disabled={!canEdit}
              defaultValue={task?.tipo ?? "empleado"}
              className="studio-input"
              style={{ width: "100%" }}
            >
              <option value="empleado">Interna</option>
              <option value="entregable_cliente">Esperando al cliente</option>
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="bt-due" style={{ marginBottom: 6, display: "block" }}>
              Vence
            </label>
            <input
              id="bt-due"
              name="due_date"
              type="date"
              disabled={!canEdit}
              defaultValue={task?.due_date ?? ""}
              className="studio-input"
              style={{ width: "100%" }}
            />
            {fieldError("due_date") && <FieldError msg={fieldError("due_date")!} />}
          </div>
        </div>

        {/* Dueño + cola por rol */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="bt-owner" style={{ marginBottom: 6, display: "block" }}>
              Dueño
            </label>
            <select
              id="bt-owner"
              name="assignee_id"
              disabled={!canEdit}
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value);
                if (e.target.value) setRole("");
              }}
              className="studio-input"
              style={{ width: "100%" }}
            >
              <option value="">Sin dueño</option>
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name}
                  {p.user_id === myUserId ? " (tú)" : ""}
                </option>
              ))}
            </select>
            {fieldError("assignee_id") && <FieldError msg={fieldError("assignee_id")!} />}
          </div>
          <div>
            <label className="studio-label" htmlFor="bt-role" style={{ marginBottom: 6, display: "block" }}>
              Cola del rol
            </label>
            <select
              id="bt-role"
              name="assigned_role"
              disabled={!canEdit || ownerId !== ""}
              value={ownerId ? "" : role}
              onChange={(e) => setRole(e.target.value)}
              className="studio-input"
              style={{ width: "100%" }}
            >
              <option value="">Sin cola</option>
              {BITACORA_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_QUEUE_LABELS[r]}
                </option>
              ))}
            </select>
            <p
              style={{
                font: "500 10.5px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "5px 0 0",
              }}
            >
              {ownerId
                ? "Con dueño no hay cola: el dueño responde."
                : "Sin dueño, cualquiera del rol puede tomarla."}
            </p>
            {fieldError("assigned_role") && <FieldError msg={fieldError("assigned_role")!} />}
          </div>
        </div>

        {/* Para agente */}
        <label
          htmlFor="bt-agente"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "500 12.5px/1.3 var(--f-sans)",
            color: "var(--ink)",
            cursor: canEdit ? "pointer" : "default",
          }}
        >
          <input
            id="bt-agente"
            name="para_agente"
            type="checkbox"
            disabled={!canEdit}
            defaultChecked={task?.para_agente ?? false}
          />
          Ejecutable por agente
          <Badge tone="info" size="sm">
            prompt → CC
          </Badge>
        </label>

        {/* Checklist */}
        <div>
          <div className="studio-label" style={{ marginBottom: 8 }}>
            Checklist
          </div>

          {!isCreate && items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggleItem(it.id, !it.done)}
                  disabled={!canEdit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    textAlign: "left",
                    cursor: canEdit ? "pointer" : "default",
                    font: "500 12.5px/1.3 var(--f-sans)",
                    color: it.done ? "var(--ink-mute)" : "var(--ink)",
                    textDecoration: it.done ? "line-through" : "none",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${it.done ? "var(--success)" : "var(--border)"}`,
                      background: it.done ? "var(--success-bg)" : "transparent",
                      color: "var(--success)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {it.done && Icon.check(10)}
                  </span>
                  {it.texto}
                </button>
              ))}
            </div>
          )}

          {isCreate && newItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {newItems.map((texto, i) => (
                <div
                  key={`${i}-${texto}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    font: "500 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  <input type="hidden" name="checklist_item" value={texto} />
                  <span style={{ flex: 1 }}>{texto}</span>
                  <button
                    type="button"
                    onClick={() => setNewItems((xs) => xs.filter((_, j) => j !== i))}
                    aria-label={`Quitar "${texto}"`}
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

          {canEdit && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newItemDraft}
                onChange={(e) => setNewItemDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftItem();
                  }
                }}
                maxLength={500}
                placeholder="Agregar punto…"
                className="studio-input"
                style={{ flex: 1 }}
                aria-label="Nuevo punto del checklist"
              />
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={addDraftItem}
                disabled={newItemDraft.trim() === ""}
              >
                {Icon.plus(12)} Agregar
              </button>
            </div>
          )}
        </div>
      </form>

      {canEdit ? (
        <DrawerFooter
          formId={FORM_ID}
          onClose={onClose}
          isPending={isPending}
          canSubmit={canSubmit}
          submitLabel={isCreate ? "Crear tarea" : "Guardar cambios"}
        />
      ) : (
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      )}
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "5px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
