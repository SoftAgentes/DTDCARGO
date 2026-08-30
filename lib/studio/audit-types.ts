/**
 * Auditoría gobernada (SDD-0166 Corte C).
 *
 * El contrato de lista excluye payload/before/after/reason por diseño. Añadir
 * cualquiera de esos campos a AuditEvent sería una regresión de seguridad.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

export const AUDIT_ACTOR_TYPES = [
  "user",
  "operario",
  "system",
  "agent",
  "integration",
] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_SOURCES = [
  "studio",
  "mobile",
  "rpc",
  "job",
  "webhook",
  "integration",
  "ai",
  "legacy_unknown",
] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const AUDIT_RESULTS = [
  "succeeded",
  "rejected",
  "failed",
  "legacy_unknown",
] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const AUDIT_SENSITIVITIES = [
  "metadata",
  "internal",
  "sensitive",
  "restricted",
  "legacy_unknown",
] as const;
export type AuditSensitivity = (typeof AUDIT_SENSITIVITIES)[number];

export const COMMENT_LIFECYCLE_AUDIT_ACTIONS = [
  "self_delete",
  "moderation",
  "undo",
  "ordinary_restore",
  "exceptional_restore",
] as const;
export type CommentLifecycleAuditAction =
  (typeof COMMENT_LIFECYCLE_AUDIT_ACTIONS)[number];

export type AuditSummary =
  | { action: CommentLifecycleAuditAction }
  | null;

export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  actorType: AuditActorType;
  actorId: string | null;
  actorLabel: string | null;
  actorResolved: boolean;
  eventType: string;
  occurredAt: string;
  correlationId: string | null;
  source: AuditSource;
  result: AuditResult;
  sensitivity: AuditSensitivity;
  schemaVersion: number;
  timezone: "UTC";
  summary: AuditSummary;
}

export interface AuditListFilters {
  entityType?: string;
  actorType?: AuditActorType;
  eventType?: string;
  source?: AuditSource;
  result?: AuditResult;
  sensitivity?: AuditSensitivity;
  from?: string;
  to?: string;
  correlationId?: string;
  cursor?: string;
}

export type AuditListErrorCode =
  | "forbidden"
  | "invalid_filter"
  | "query_failed";

export type AuditListResult =
  | {
      ok: true;
      events: AuditEvent[];
      nextCursor: string | null;
      hasMore: boolean;
    }
  | {
      ok: false;
      events: [];
      code: AuditListErrorCode;
    };

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  shipment: "Embarque",
  dispatch_order: "Orden de despacho",
  dispatch_order_package: "Bulto de orden",
  warehouse_receipt_cn: "Recepción CN",
  warehouse_receipt_ve: "Recepción VE",
  invoice: "Factura",
  comment: "Comentario",
  rendition: "Rendición",
  purchase_order: "Orden de compra",
  sales_order: "Orden de venta",
};

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

export function auditActorLabel(actor: AuditActorType): string {
  switch (actor) {
    case "user":
      return "Usuario";
    case "operario":
      return "Operario";
    case "system":
      return "Sistema";
    case "agent":
      return "Agente";
    case "integration":
      return "Integración";
  }
}

export function auditActorTone(actor: AuditActorType): BadgeTone {
  switch (actor) {
    case "user":
      return "info";
    case "operario":
      return "wine";
    case "system":
      return "neutral";
    case "agent":
      return "warning";
    case "integration":
      return "success";
  }
}

export function auditResultLabel(result: AuditResult): string {
  switch (result) {
    case "succeeded":
      return "Completado";
    case "rejected":
      return "Rechazado";
    case "failed":
      return "Falló";
    case "legacy_unknown":
      return "Legacy";
  }
}

export function auditResultTone(result: AuditResult): BadgeTone {
  switch (result) {
    case "succeeded":
      return "success";
    case "rejected":
      return "warning";
    case "failed":
      return "danger";
    case "legacy_unknown":
      return "neutral";
  }
}

export function auditSensitivityLabel(value: AuditSensitivity): string {
  switch (value) {
    case "metadata":
      return "Metadatos";
    case "internal":
      return "Interno";
    case "sensitive":
      return "Sensible";
    case "restricted":
      return "Restringido";
    case "legacy_unknown":
      return "Legacy";
  }
}

/** Humaniza event_type machine-readable ('status_change' → 'Status change'). */
export function auditEventLabel(eventType: string): string {
  const spaced = eventType.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
