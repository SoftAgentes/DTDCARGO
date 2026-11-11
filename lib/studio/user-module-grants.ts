/**
 * Accesos adicionales por persona · reglas puras de pantalla (SDD-0622).
 *
 * DATA PURA (sin React, sin server-only): la usan la ficha de Usuarios (client)
 * y las pruebas. La decisión de acceso vive en `rbac.ts`; aquí está solo lo que
 * la PANTALLA necesita para no prometer lo que la base niega (§5.3):
 *
 *   - `GRANT_COVERAGE`: qué módulos se pueden conceder HOY porque su capa de base
 *     ya acepta el extra (migr 0526/0527, o RLS solo por tenant). El resto se
 *     muestra con el motivo por el que todavía no.
 *   - `grantableStatus`: el estado de un módulo para UNA persona concreta (ya lo
 *     da su rol, sensible, bloqueado por la fase de dinero…).
 *
 * Cubrir un módulo nuevo = su migración + su prueba + mover la entrada aquí.
 */

import {
  LOCKED_MODULES,
  MONEY_MODULES,
  READ_ONLY_GRANT_MODULES,
  SUPERADMIN_ONLY_MODULES,
  canAccessModule,
  canEditModule,
  type RoleModuleOverrides,
} from "@/lib/studio/rbac";
import { MODULES, type Group } from "@/lib/studio/modules";
import type { StudioUserRole } from "@/lib/studio/user-types";

/**
 * Por qué un módulo se puede o no conceder hoy.
 *   covered       → la base acepta el extra: se ofrece.
 *   money_phase   → dinero: la base exige el rol contabilidad (R3, fase 8 de la spec).
 *   admin_base    → la base o la página lo reservan al rol administrador.
 *   superadmin    → R2: además exige superadministrador de plataforma.
 *   not_reviewed  → nadie revisó todavía su base para extras (fuera de esta fase).
 */
export type GrantCoverage = "covered" | "money_phase" | "admin_base" | "superadmin" | "not_reviewed";

/**
 * Módulos cubiertos en la base (SDD-0622 §12, grupos C y D, más `users`):
 *   - kommo: `crm_puede_usar()`/`crm_puede_editar()` usan `user_has_module` (0527).
 *   - clients: `document_entity_authorized` suma los extras (0527). La fusión de
 *     fichas (0358/0361) y el cambio de código (0371) siguen pidiendo su rol.
 *   - quotes, sales-orders, purchase-orders, conversaciones, rates, suppliers:
 *     RLS solo por tenant (0007, 0012, 0106, 0124, 0125, 0236).
 *
 * Fuera a propósito, con su motivo en `COVERAGE_HINT`:
 *   - bandeja: el ciclo de agentes de Chatwoot (`lib/studio/chatwoot/agentes-*`)
 *     decide quién es agente solo por rol; tocarlo es del carril de Chatwoot.
 *   - users / direccion: sus páginas exigen hoy el rol admin en la aplicación.
 */
const COVERED: ReadonlySet<string> = new Set([
  "kommo",
  "clients",
  "quotes",
  "sales-orders",
  "purchase-orders",
  "conversaciones",
  "rates",
  "suppliers",
]);

export function moduleCoverage(moduleId: string): GrantCoverage {
  if (COVERED.has(moduleId)) return "covered";
  if (SUPERADMIN_ONLY_MODULES.has(moduleId)) return "superadmin";
  if (MONEY_MODULES.has(moduleId)) return "money_phase";
  if (LOCKED_MODULES.has(moduleId)) return "admin_base";
  return "not_reviewed";
}

export const COVERAGE_LABEL: Record<Exclude<GrantCoverage, "covered">, string> = {
  money_phase: "Requiere fase de dinero",
  admin_base: "Reservado al administrador",
  superadmin: "Solo superadministrador",
  not_reviewed: "Aún no disponible",
};

export const COVERAGE_HINT: Record<Exclude<GrantCoverage, "covered">, string> = {
  money_phase:
    "La base todavía exige el rol contabilidad para el dinero. Se habilita en la fase de dinero de la SDD-0622.",
  admin_base: "La base todavía reserva este módulo al rol administrador.",
  superadmin: "Este módulo exige además ser superadministrador de la plataforma.",
  not_reviewed: "Falta revisar su base para que funcione con un acceso adicional.",
};

/** Módulo sensible = dinero ∪ solo-administrador: lleva doble aviso. */
export function isSensitiveModule(moduleId: string): boolean {
  return LOCKED_MODULES.has(moduleId);
}

/** ¿El extra sobre este módulo solo puede ser de ver? (R1, `support`). */
export function grantViewOnly(moduleId: string, role: StudioUserRole | null | undefined): boolean {
  return READ_ONLY_GRANT_MODULES.has(moduleId) || role === "support";
}

export type GrantableStatus =
  | { kind: "role_full" } // el rol ya ve y edita
  | { kind: "role_view" } // el rol ya ve: el extra solo puede sumar edición
  | { kind: "grantable" }
  | { kind: "blocked"; coverage: Exclude<GrantCoverage, "covered"> };

/** Estado de un módulo para una persona: qué le puede sumar un extra. */
export function grantableStatus(
  role: StudioUserRole | null | undefined,
  moduleId: string,
  overrides?: RoleModuleOverrides,
): GrantableStatus {
  const view = canAccessModule(role, moduleId, overrides);
  const edit = canEditModule(role, moduleId, overrides);
  const coverage = moduleCoverage(moduleId);
  if (view && (edit || grantViewOnly(moduleId, role))) return { kind: "role_full" };
  if (coverage !== "covered") return { kind: "blocked", coverage };
  if (view) return { kind: "role_view" };
  return { kind: "grantable" };
}

/** Áreas de la pantalla «Lo que puede ver»: los grupos del sidebar, en su orden. */
export const AREA_ORDER: readonly Group[] = ["COMERCIAL", "OPERACIÓN", "FINANZAS", "MARKETING", "SISTEMA"];

export const AREA_LABEL: Record<Group, string> = {
  COMERCIAL: "Comercial",
  "OPERACIÓN": "Operación",
  FINANZAS: "Finanzas",
  MARKETING: "Marketing",
  SISTEMA: "Sistema",
};

/** Módulos que se ofrecen en el buscador «Agregar módulo o área…» (los visibles del registro). */
export const GRANTABLE_MODULES = MODULES.filter((m) => !m.hidden || m.id === "legal");

/** Atajo «Agregar todo Comercial»: los comerciales cubiertos. */
export const COMMERCIAL_COVERED = MODULES.filter(
  (m) => m.group === "COMERCIAL" && COVERED.has(m.id),
).map((m) => m.id);

/** Validación de motivo idéntica a la RPC (0526): 5 a 500 caracteres sin bordes. */
export function reasonError(reason: string): string | null {
  const len = reason.trim().length;
  if (len < 5) return "Escribe el motivo (mínimo 5 caracteres).";
  if (len > 500) return "El motivo admite hasta 500 caracteres.";
  return null;
}
