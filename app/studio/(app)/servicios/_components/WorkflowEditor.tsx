"use client";

/**
 * WorkflowEditor — tab "Flujo" del ServicioDrawer (SDD-0091 Slice 3).
 *
 * Configura los pasos del flujo interno del servicio (+ ver lo pendiente de humano).
 * Patrón de los sub-editores hermanos (AddonEditor): lista + alta + eliminar, SIN
 * edición inline (set-once: editar = eliminar + re-crear). La REGLA DURA la enforza
 * el server (validateWorkflowStepInput); acá se muestra como hint + el error vuelve por toast.
 */

import { useActionState, useEffect } from "react";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  upsertWorkflowStepAction,
  softDeleteWorkflowStepAction,
} from "@/lib/studio/workflow/actions";
import {
  WORKFLOW_NODE_KINDS,
  NODE_KIND_LABEL,
  AUTOMATION_LEVELS,
  AUTOMATION_LEVEL_LABEL,
  AUTOMATION_LEVEL_SHORT,
  WORKFLOW_EVENTS,
  WORKFLOW_EVENT_LABEL,
  workflowEventLabel,
  canRunUnattended,
  type ServiceWorkflowStep,
  type WorkflowStepActionState,
} from "@/lib/studio/workflow/types";
import type { AwaitingRun } from "@/lib/studio/workflow/queries";
import { STUDIO_USER_ROLES, ROLE_LABELS } from "@/lib/studio/user-types";

const initial: WorkflowStepActionState = {};
const labelStyle = { display: "block", marginBottom: 6 } as const;
const emptyStyle = {
  font: "400 13px/1.5 var(--f-sans)",
  color: "var(--ink-soft)",
  margin: "0 0 12px",
};

export function WorkflowEditor({
  serviceKey,
  steps,
  awaiting,
}: {
  serviceKey: string;
  steps: ServiceWorkflowStep[];
  awaiting: AwaitingRun[];
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    upsertWorkflowStepAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) toast.success("Paso guardado.");
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  const fe = state.fieldErrors;

  return (
    <div>
      <p style={emptyStyle}>
        Cada paso corre cuando ocurre un evento (se define una vez). Si el paso escribe
        a un cliente o tercero, o mueve dinero, su tope es{" "}
        <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
          “Auto con compuerta”
        </strong>{" "}
        — nunca automático.
      </p>

      {/* Lista de pasos */}
      {steps.length === 0 ? (
        <p style={emptyStyle}>Todavía no hay pasos para este servicio.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((s) => (
            <li
              key={s.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 12,
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <p style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0, flex: 1 }}>
                  {s.nombre}
                </p>
                {s.service_key === null && (
                  <Badge tone="info" size="sm">Backbone</Badge>
                )}
                <Badge tone={s.automation_level === "automatico" ? "success" : "neutral"} size="sm">
                  {AUTOMATION_LEVEL_SHORT[s.automation_level]}
                </Badge>
                <ActionButton
                  variant="danger"
                  size="sm"
                  idleLabel="Eliminar"
                  loadingLabel="Eliminando…"
                  successLabel={null}
                  onAction={() => softDeleteWorkflowStepAction(s.id)}
                  onSuccess={() => toast.success("Paso eliminado.")}
                  onError={(m) => toast.error(m)}
                />
              </div>
              <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
                {NODE_KIND_LABEL[s.node_kind]}
                {s.trigger_event ? ` · cuando ${workflowEventLabel(s.trigger_event)}` : ""}
                {s.owner_role ? ` · ${ROLE_LABELS[s.owner_role]}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Pendientes de humano (bandeja del servicio) */}
      {awaiting.length > 0 && (
        <div style={{ margin: "0 0 16px", padding: 12, border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--bg-surface)" }}>
          <p className="studio-eyebrow" style={{ color: "var(--ink-soft)", margin: "0 0 8px" }}>
            Pendientes de acción ({awaiting.length})
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {awaiting.map((r) => (
              <li key={r.id} style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                {r.step_nombre}{" "}
                <span style={{ color: "var(--ink-soft)" }}>
                  — {r.source_kind} {r.source_id.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alta de paso */}
      <form key={steps.length} action={formAction} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <p className="studio-eyebrow" style={{ color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Agregar paso
        </p>

        <label className="studio-label" style={labelStyle}>Nombre</label>
        <input className="studio-input" name="nombre" required style={{ marginBottom: 10 }} />
        {fe?.nombre && <ErrText msg={fe.nombre} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <label className="studio-label" style={labelStyle}>Alcance</label>
            <select className="studio-input" name="service_key" defaultValue={serviceKey}>
              <option value={serviceKey}>Este servicio</option>
              <option value="">Todos los núcleo (backbone)</option>
            </select>
          </div>
          <div>
            <label className="studio-label" style={labelStyle}>Orden</label>
            <input className="studio-input" type="number" name="orden" defaultValue={0} min={0} />
          </div>
        </div>

        <label className="studio-label" style={labelStyle}>Tipo de paso</label>
        <select className="studio-input" name="node_kind" defaultValue="recordatorio_interno" style={{ marginBottom: 10 }}>
          {WORKFLOW_NODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {NODE_KIND_LABEL[k]}
              {canRunUnattended(k) ? "" : " (tope: con compuerta)"}
            </option>
          ))}
        </select>
        {fe?.node_kind && <ErrText msg={fe.node_kind} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <label className="studio-label" style={labelStyle}>Disparador</label>
            <select className="studio-input" name="trigger_event" defaultValue="">
              <option value="">— Sin disparador —</option>
              {WORKFLOW_EVENTS.map((e) => (
                <option key={e} value={e}>{WORKFLOW_EVENT_LABEL[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" style={labelStyle}>Nivel</label>
            <select className="studio-input" name="automation_level" defaultValue="manual">
              {AUTOMATION_LEVELS.map((l) => (
                <option key={l} value={l}>{AUTOMATION_LEVEL_LABEL[l]}</option>
              ))}
            </select>
          </div>
        </div>
        {fe?.automation_level && <ErrText msg={fe.automation_level} />}

        <label className="studio-label" style={labelStyle}>Rol dueño</label>
        <select className="studio-input" name="owner_role" defaultValue="" style={{ marginBottom: 14 }}>
          <option value="">— Sin asignar —</option>
          {STUDIO_USER_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {fe?.owner_role && <ErrText msg={fe.owner_role} />}

        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Agregando…" : "Agregar paso"}
        </button>
      </form>
    </div>
  );
}

function ErrText({ msg }: { msg: string }) {
  return (
    <p style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: "-4px 0 10px" }}>
      {msg}
    </p>
  );
}
