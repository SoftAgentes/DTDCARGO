/**
 * Identidad de la persona (SDD-0106). La cédula/RIF (`national_id`) es el ancla
 * estable a través de servicios (carga, academia). `clients` es el perfil de
 * carga de una persona (ver `client-types.ts`).
 *
 * Fase 1: la tabla y el backfill existen; la unificación de academia y el alta
 * de persona-sin-carga son Fase 2.
 */
import type { ClientDocKind } from "./client-types";

export type Person = {
  id: string;
  tenant_id: string;
  /** Cédula/RIF normalizable. Único por tenant (índice parcial, migr 0170). null = sin documento aún. */
  national_id: string | null;
  doc_kind: ClientDocKind | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** Auditoría del backfill: el clients.id del que se derivó esta persona (0170). */
  legacy_client_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * Normaliza una cédula/RIF **igual que el índice único de la DB** (migr 0095/0170:
 * `upper(regexp_replace(doc,'[^A-Za-z0-9]','','g'))`): saca puntos/guiones/espacios
 * y pasa a mayúsculas. `V-12.345.678` ≡ `v12345678` → `V12345678`. Útil para
 * comparar/dedup en TS sin ir a la DB.
 */
export function normalizeCedula(doc: string): string {
  return doc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
