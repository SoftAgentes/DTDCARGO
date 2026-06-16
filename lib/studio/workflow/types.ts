/**
 * Tipos + validación del motor de flujo interno por servicio (SDD-0091 Slice 1).
 * Matchea el schema de supabase/migrations/0143_workflow_engine.sql.
 *
 * Diseño aprobado: docs/specs/0076-configuracion-servicios/assets/FASE-FUTURA-motor-flujo-interno-y-rbac.md.
 * Sin Zod — validación manual con `validateWorkflowStepInput()`, igual que el resto del Studio.
 * La REGLA DURA (gated ≠ automatico) vive acá (candado server-side), NO en el schema.
 */

import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

// ── Nodos (10) ───────────────────────────────────────────────
export type WorkflowNodeKind =
  | "enviar_email"
  | "enviar_whatsapp"
  | "recordatorio_interno"
  | "crear_tarea"
  | "avanzar_estado"
  | "montar_documento"
  | "solicitar_doc_cliente"
  | "solicitar_a_tercero"
  | "esperar_confirmacion_humana"
  | "ejecutar_ia";

export const WORKFLOW_NODE_KINDS: WorkflowNodeKind[] = [
  "enviar_email",
  "enviar_whatsapp",
  "recordatorio_interno",
  "crear_tarea",
  "avanzar_estado",
  "montar_documento",
  "solicitar_doc_cliente",
  "solicitar_a_tercero",
  "esperar_confirmacion_humana",
  "ejecutar_ia",
];

export const NODE_KIND_LABEL: Record<WorkflowNodeKind, string> = {
  enviar_email: "Enviar email",
  enviar_whatsapp: "Enviar WhatsApp",
  recordatorio_interno: "Recordatorio interno",
  crear_tarea: "Crear tarea",
  avanzar_estado: "Avanzar estado",
  montar_documento: "Montar documento (borrador)",
  solicitar_doc_cliente: "Solicitar documento al cliente",
  solicitar_a_tercero: "Solicitar a un tercero",
  esperar_confirmacion_humana: "Esperar confirmación humana",
  ejecutar_ia: "Ejecutar IA",
};

/**
 * Nodos GATED: escriben a un cliente o tercero, o mueven dinero. NUNCA pueden ser
 * `automatico` (tope = auto_con_compuerta). Es la lista de la REGLA DURA del diseño.
 */
export const GATED_NODE_KINDS: WorkflowNodeKind[] = [
  "enviar_email",
  "enviar_whatsapp",
  "solicitar_doc_cliente",
  "solicitar_a_tercero",
];

/**
 * Nodos que SÍ pueden correr desatendidos (nivel 4): interno o borrador / IA read-only.
 * Los 4 gated + `esperar_confirmacion_humana` quedan fuera por definición.
 */
export const AUTOMATABLE_NODE_KINDS: WorkflowNodeKind[] = [
  "recordatorio_interno",
  "crear_tarea",
  "avanzar_estado",
  "montar_documento",
  "ejecutar_ia",
];

export const isGatedNode = (k: WorkflowNodeKind): boolean =>
  GATED_NODE_KINDS.includes(k);
export const canRunUnattended = (k: WorkflowNodeKind): boolean =>
  AUTOMATABLE_NODE_KINDS.includes(k);

// ── Niveles de automatización (4) ────────────────────────────
export type AutomationLevel =
  | "manual"
  | "asistido"
  | "auto_con_compuerta"
  | "automatico";

export const AUTOMATION_LEVELS: AutomationLevel[] = [
  "manual",
  "asistido",
  "auto_con_compuerta",
  "automatico",
];

export const AUTOMATION_LEVEL_LABEL: Record<AutomationLevel, string> = {
  manual: "Manual (solo recuerda)",
  asistido: "Asistido (arma el borrador, tú envías)",
  auto_con_compuerta: "Auto con compuerta (1 click final)",
  automatico: "Automático (corre solo)",
};

/** Etiqueta corta para badges (sin el paréntesis explicativo). */
export const AUTOMATION_LEVEL_SHORT: Record<AutomationLevel, string> = {
  manual: "Manual",
  asistido: "Asistido",
  auto_con_compuerta: "Compuerta",
  automatico: "Auto",
};

// ── Eventos disparadores ─────────────────────────────────────
/**
 * Vocabulario de eventos del motor. Reusa los de `mail_rule_event` (continuidad) y suma
 * los de hito que hoy NO avisan, el de la pista de oferta (SDD-0090) y el de pre-bodega.
 * Es `text` en la DB (no enum) porque la lista crece — se valida contra esta all-list.
 */
export type WorkflowEvent =
  | "shipment_created"
  | "shipment_arrived"
  | "shipment_consolidated_cn"
  | "shipment_in_warehouse"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "quote_sent"
  | "quote_accepted"
  | "invoice_emitted"
  | "invoice_overdue"
  | "oferta_aceptada"
  | "cliente_anuncia_carga_cn";

export const WORKFLOW_EVENTS: WorkflowEvent[] = [
  "shipment_created",
  "shipment_arrived",
  "shipment_consolidated_cn",
  "shipment_in_warehouse",
  "shipped",
  "out_for_delivery",
  "delivered",
  "quote_sent",
  "quote_accepted",
  "invoice_emitted",
  "invoice_overdue",
  "oferta_aceptada",
  "cliente_anuncia_carga_cn",
];

/** Etiqueta legible de cada evento (la UI nunca muestra el slug crudo). */
export const WORKFLOW_EVENT_LABEL: Record<WorkflowEvent, string> = {
  shipment_created: "Se creó el envío",
  shipment_arrived: "Llegó el envío",
  shipment_consolidated_cn: "Consolidado en China",
  shipment_in_warehouse: "Entró a bodega",
  shipped: "Zarpó",
  out_for_delivery: "Salió a reparto",
  delivered: "Entregado",
  quote_sent: "Cotización enviada",
  quote_accepted: "Cotización aceptada",
  invoice_emitted: "Factura emitida",
  invoice_overdue: "Factura vencida",
  oferta_aceptada: "Oferta aceptada",
  cliente_anuncia_carga_cn: "Cliente anuncia carga (China)",
};

/** Etiqueta legible de un evento por su string (defensivo: cae al slug si no mapea). */
export function workflowEventLabel(e: string | null | undefined): string {
  if (!e) return "";
  return WORKFLOW_EVENT_LABEL[e as WorkflowEvent] ?? e;
}

// ── Estado de una corrida (traza) ────────────────────────────
export type WorkflowStepStatus =
  | "pending"
  | "awaiting_human"
  | "done"
  | "skipped"
  | "failed";

export const WORKFLOW_STEP_STATUSES: WorkflowStepStatus[] = [
  "pending",
  "awaiting_human",
  "done",
  "skipped",
  "failed",
];

// ── Filas (normalizadas desde la DB) ─────────────────────────
export type ServiceWorkflowStep = {
  id: string;
  service_key: string | null;
  momento: string | null;
  orden: number;
  nombre: string;
  node_kind: WorkflowNodeKind;
  owner_role: StudioUserRole | null;
  automation_level: AutomationLevel;
  trigger_event: string | null;
  ai_skill_slug: string | null;
  template_ref: string | null;
  channel: string | null;
  sla_hours: number | null;
  depends_on: string[];
  active: boolean;
};

export type WorkflowStepRun = {
  id: string;
  step_id: string;
  source_kind: string;
  source_id: string;
  status: WorkflowStepStatus;
  result_note: string | null;
  created_at: string;
  completed_at: string | null;
};

// ── Input del editor (form → action) ─────────────────────────
export type WorkflowStepInput = {
  service_key: string | null;
  momento: string | null;
  orden: number;
  nombre: string;
  node_kind: WorkflowNodeKind;
  owner_role: StudioUserRole | null;
  automation_level: AutomationLevel;
  trigger_event: string | null;
  ai_skill_slug: string | null;
  template_ref: string | null;
  channel: string | null;
  sla_hours: number | null;
  depends_on: string[];
};

export type WorkflowStepActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof WorkflowStepInput, string>>;
};

/**
 * Valida y normaliza el input de un paso. La REGLA DURA del diseño es el candado central:
 * un nodo gated (o `esperar_confirmacion_humana`) NUNCA puede ser `automatico`.
 */
export function validateWorkflowStepInput(
  input: Partial<WorkflowStepInput>,
): {
  input?: WorkflowStepInput;
  fieldErrors?: WorkflowStepActionState["fieldErrors"];
} {
  const errors: WorkflowStepActionState["fieldErrors"] = {};

  if (!input.nombre || input.nombre.trim() === "") {
    errors.nombre = "El paso necesita un nombre.";
  }
  if (!input.node_kind || !WORKFLOW_NODE_KINDS.includes(input.node_kind)) {
    errors.node_kind = "Tipo de paso no válido.";
  }
  const level = input.automation_level ?? "manual";
  if (!AUTOMATION_LEVELS.includes(level)) {
    errors.automation_level = "Nivel de automatización no válido.";
  }
  if (
    input.owner_role != null &&
    !STUDIO_USER_ROLES.includes(input.owner_role)
  ) {
    errors.owner_role = "Rol dueño no válido.";
  }
  if (
    input.trigger_event != null &&
    input.trigger_event !== "" &&
    !(WORKFLOW_EVENTS as string[]).includes(input.trigger_event)
  ) {
    errors.trigger_event = "Evento disparador no válido.";
  }

  // ── REGLA DURA: gated / esperar NUNCA automatico ──
  if (
    input.node_kind &&
    WORKFLOW_NODE_KINDS.includes(input.node_kind) &&
    level === "automatico" &&
    !canRunUnattended(input.node_kind)
  ) {
    errors.automation_level = isGatedNode(input.node_kind)
      ? "Este paso escribe a un cliente o tercero (o mueve dinero): no puede ser automático. Tope: auto con compuerta."
      : "Este paso es una compuerta humana: no puede ser automático.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      service_key: input.service_key?.trim() || null,
      momento: input.momento?.trim() || null,
      orden: Number.isFinite(input.orden) ? Number(input.orden) : 0,
      nombre: input.nombre!.trim(),
      node_kind: input.node_kind!,
      owner_role: input.owner_role ?? null,
      automation_level: level,
      trigger_event: input.trigger_event?.trim() || null,
      ai_skill_slug: input.ai_skill_slug?.trim() || null,
      template_ref: input.template_ref?.trim() || null,
      channel: input.channel?.trim() || null,
      sla_hours:
        input.sla_hours != null && Number.isFinite(input.sla_hours)
          ? Number(input.sla_hours)
          : null,
      depends_on: (input.depends_on ?? []).filter((s) => s.trim() !== ""),
    },
  };
}

/**
 * Decide el estado INICIAL de una corrida (PURO). Solo un paso `automatico` que puede
 * correr desatendido arranca en `pending` (lo ejecutará el drain, S2); todo lo demás
 * arranca en `awaiting_human` → va a la bandeja de compuerta.
 */
export function planStepRun(
  step: Pick<ServiceWorkflowStep, "node_kind" | "automation_level">,
): WorkflowStepStatus {
  return step.automation_level === "automatico" && canRunUnattended(step.node_kind)
    ? "pending"
    : "awaiting_human";
}
