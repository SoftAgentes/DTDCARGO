/**
 * Audit log (SDD-0123) — types + label helpers para el viewer read-only.
 *
 * Lee `entity_audit_log` (migr 0066): audit genérico cross-entity. El admin lo
 * consulta filtrado; no se escribe desde acá (INSERT es solo service_role).
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

export type AuditActorType = "user" | "operario" | "system";

export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  actorType: AuditActorType;
  actorId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  shipment: "Embarque",
  dispatch_order: "Orden de despacho",
  dispatch_order_package: "Bulto de orden",
  warehouse_receipt_cn: "Recepción CN",
  warehouse_receipt_ve: "Recepción VE",
  invoice: "Factura",
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
  }
}

/** Humaniza el event_type libre ('status_change' → 'Status change'). */
export function auditEventLabel(eventType: string): string {
  const spaced = eventType.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
