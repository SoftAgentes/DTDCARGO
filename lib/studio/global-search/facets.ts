/**
 * Matriz de facetas del buscador global (SDD-0135 §3 · el corazón de seguridad).
 *
 * Cada faceta pertenece a un **módulo real** del ERP. El permiso para correrla
 * se deriva EXCLUSIVAMENTE de la matriz RBAC (`canAccessModule`) — NUNCA de
 * consultar una tabla financiera. Esto es lo que hace que el candado sea
 * "transparente": no revela si el cliente tiene o no movimientos.
 *
 * HALLAZGO DE SEGURIDAD (spec §3): la RLS de Supabase filtra por `tenant_id`,
 * no por rol. La DB NO impide que un rol operativo lea `payment_receipts` si
 * arma el query → **este gate server-side es la única defensa real**.
 * Fail-closed: sin permiso, la query NUNCA se ejecuta.
 *
 * Viewers read-only de la faceta Cliente (spec §3, tabla de gating):
 *   - `marketing` (decisión del founder §2.4): puede UBICAR un contacto
 *     (nombre / Shipping Mark / cédula) sin ver dinero.
 *   - `warehouse`: la tabla §3 le lista "Cliente" aunque la matriz de MÓDULO no
 *     le dé `clients` (bodega no navega el módulo, pero sí ubica a quién es una
 *     caja al recibir).
 * A ambos se les abre la faceta Cliente en modo **read-only** vía `viewerRoles`,
 * SIN abrirles el módulo `clients` completo (no se toca
 * `ROLE_MODULE_ACCESS.clients` → el sidebar y la página de Clientes les siguen
 * vedados). La faceta Cliente no expone dinero, así que "read-only de
 * identidad/contacto" es inherente a su forma.
 *
 * DATA PURA → importable desde el server action y los tests (sin red, sin DB).
 */

import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  canAccessModule,
  type RoleModuleOverrides,
  type UserModuleGrants,
} from "@/lib/studio/rbac";
import type { FacetGroup, GlobalSearchFacetId } from "./types";

export interface FacetDef {
  id: GlobalSearchFacetId;
  /** Módulo real del ERP cuyo permiso gobierna la faceta (matriz RBAC). */
  module: string;
  /** operativo (se muestra primero) o dinero (después; candado si no hay permiso). */
  group: FacetGroup;
  /**
   * Roles que obtienen acceso READ-ONLY a la faceta aunque la matriz no les
   * dé el módulo completo. Solo para facetas SIN dinero (hoy: Cliente→marketing).
   */
  viewerRoles?: readonly StudioUserRole[];
}

/**
 * Registro de facetas. El orden define el orden de render (operativo → dinero).
 * Cada `id` debe existir como faceta en types.ts y cada `module` como módulo
 * real en modules.ts (lo garantiza `global-search.test.ts`, anti-drift).
 */
export const FACETS: readonly FacetDef[] = [
  { id: "clients", module: "clients", group: "operativo", viewerRoles: ["marketing", "warehouse"] },
  { id: "shipments", module: "shipments", group: "operativo" },
  { id: "quotes", module: "quotes", group: "operativo" },
  { id: "invoices", module: "invoices", group: "dinero" },
  { id: "payments", module: "collections", group: "dinero" },
];

/** Facetas de dinero (las que llevan candado para roles sin módulo de dinero). */
export const MONEY_FACETS: readonly GlobalSearchFacetId[] = FACETS.filter(
  (f) => f.group === "dinero",
).map((f) => f.id);

const FACET_BY_ID = new Map<GlobalSearchFacetId, FacetDef>(
  FACETS.map((f) => [f.id, f]),
);

export function getFacet(id: GlobalSearchFacetId): FacetDef {
  const f = FACET_BY_ID.get(id);
  if (!f) throw new Error(`Faceta desconocida: ${id}`);
  return f;
}

/**
 * ¿El rol puede correr esta faceta? Derivado SOLO de la matriz RBAC:
 *   - permiso de módulo (`canAccessModule`), o
 *   - viewerRoles read-only (excepción marketing→Cliente).
 * Fail-closed: rol nulo/desconocido = no. NUNCA consulta datos.
 *
 * `access` (opcional) trae los desvíos por rol y los extras de la persona
 * (SDD-0622): con ellos la búsqueda ⌘K abre las mismas facetas que el sidebar.
 */
export function canRunFacet(
  role: StudioUserRole | null | undefined,
  facet: FacetDef,
  access?: { overrides?: RoleModuleOverrides; grants?: UserModuleGrants },
): boolean {
  if (canAccessModule(role, facet.module, access?.overrides, access?.grants)) return true;
  if (role && facet.viewerRoles?.includes(role)) return true;
  return false;
}

/** Facetas que el rol PUEDE correr (subconjunto de FACETS). */
export function runnableFacets(
  role: StudioUserRole | null | undefined,
): FacetDef[] {
  return FACETS.filter((f) => canRunFacet(role, f));
}
