/**
 * Accesos adicionales por persona · reglas puras de pantalla (SDD-0622).
 *
 * DATA PURA (sin React, sin server-only): la usan la ficha de Usuarios (client)
 * y las pruebas. La decisión de acceso vive en `rbac.ts`; aquí está solo lo que
 * la PANTALLA necesita para no prometer lo que la base niega (§5.3):
 *
 *   - `GRANT_COVERAGE`: qué módulos se pueden conceder HOY porque su capa de base
 *     ya acepta el extra (migr 0538/0539, o RLS solo por tenant). El resto se
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
 * Módulos cubiertos en la base (SDD-0622 §12, grupos C y D; `users` NO está):
 *   - kommo: `crm_puede_usar()`/`crm_puede_editar()` usan `user_has_module` (0539).
 *   - clients: `document_entity_authorized` suma los extras (0539). La fusión de
 *     fichas (0358/0361) y el cambio de código (0371) siguen pidiendo su rol.
 *   - quotes, sales-orders, purchase-orders, conversaciones, rates: la 0540
 *     reemplazó su RLS solo por tenant (0012, 0106, 0124, 0125) por policies que
 *     deciden con `user_has_module`/`user_has_any_module`, así que el extra entra
 *     por ahí (también en `chatwoot_conversations`, solo lectura).
 *   - suppliers: RLS solo por tenant (0236); el extra no necesita cambio en la base.
 *   - bandeja (SDD-0675, migr 0565): la RLS ya usa `user_has_module('bandeja')`
 *     (0540, 0554); el ciclo de agentes de Chatwoot suma el extra y le da Leads y
 *     Clientes (decisión de Sam del 2026-11-18). Sin la 0565 la RPC lo rechaza.
 *
 * Fuera a propósito, con su motivo en `COVERAGE_HINT`:
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
  "bandeja",
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

/**
 * Atajo «Agregar todo Comercial»: los comerciales cubiertos, menos la Bandeja
 * (SDD-0675): abre chats y una cuenta en Chatwoot, así que se da a propósito.
 */
export const COMMERCIAL_COVERED = MODULES.filter(
  (m) => m.group === "COMERCIAL" && COVERED.has(m.id) && m.id !== "bandeja",
).map((m) => m.id);

/** Validación de motivo idéntica a la RPC (0538): 5 a 500 caracteres sin bordes. */
export function reasonError(reason: string): string | null {
  const len = reason.trim().length;
  if (len < 5) return "Escribe el motivo (mínimo 5 caracteres).";
  if (len > 500) return "El motivo admite hasta 500 caracteres.";
  return null;
}

/**
 * Aviso junto a cada campo de motivo (SDD-0622 §8): el texto queda en la fila
 * del extra, que lee la persona destinataria, y en `entity_audit_log`, que se
 * ve en Actividad. El límite de 5 a 500 caracteres lo pone `reasonError`.
 */
/**
 * SDD-0675: lo que ve el admin cuando conceder o quitar la Bandeja quedó
 * guardado pero no llegó todavía a Chatwoot. El ciclo diario lo completa.
 */
export const AVISO_CHATWOOT_PENDIENTE = "Guardado; Chatwoot quedó pendiente hasta el próximo ciclo.";

export const MOTIVO_AVISO_PII =
  "No escribas datos personales en el motivo (cédula, teléfono, salud): queda guardado en Actividad.";

// ─── Mapa «Lo que puede hacer» (SDD-0635 §3.1 y §3.2) ─────────────────────

/** Nivel de un acceso extra que se quiere dejar: sin extra, solo ver, ver y editar. */
export type NivelExtra = "none" | "view" | "edit";

/** Extra tal como lo usa el mapa: el nivel que da hoy y si sigue vigente. */
export type ExtraActual = { nivel: Exclude<NivelExtra, "none">; vigente: boolean; expiresAt: string | null };

/**
 * Estado de un chip del mapa para una persona:
 *   role     → su rol lo da (y un extra, si lo hay, no suma nada: «sobra»).
 *   grant    → lo tiene por un extra vigente que sí suma algo.
 *   none     → no lo tiene y se le puede dar como extra.
 *   blocked  → no lo tiene y todavía no se puede dar (la base no lo acepta).
 *   admin    → un administrador ve y edita todo.
 */
export type ChipSrc = "role" | "grant" | "none" | "blocked" | "admin";

export type EstadoModulo = {
  moduleId: string;
  src: ChipSrc;
  /** Lo que ve y edita hoy, con extras vigentes. */
  view: boolean;
  edit: boolean;
  /** Lo que da su rol solo (default de código ± desvío por rol). */
  viewByRole: boolean;
  editByRole: boolean;
  sensitive: boolean;
  /** Qué le puede sumar un extra (regla de la 0622). */
  status: GrantableStatus;
  extra: ExtraActual | null;
  /** Hay un extra vigente que su rol ya cubre: no suma nada y se puede quitar. */
  sobra: boolean;
  /** El extra sobre este módulo solo puede ser de ver (R1 o `support`). */
  soloVer: boolean;
};

export function estadoModulo(
  role: StudioUserRole | null | undefined,
  moduleId: string,
  overrides: RoleModuleOverrides | undefined,
  extra: ExtraActual | null,
): EstadoModulo {
  const viewByRole = canAccessModule(role, moduleId, overrides);
  const editByRole = canEditModule(role, moduleId, overrides);
  const soloVer = grantViewOnly(moduleId, role);
  const vigente = extra?.vigente ? extra : null;
  const extraEdit = !!vigente && vigente.nivel === "edit" && !soloVer && role !== "support";
  const view = viewByRole || !!vigente;
  const edit = role === "admin" || editByRole || (view && extraEdit);
  const status = grantableStatus(role, moduleId, overrides);
  // Sobra = el extra no agrega nada a lo que ya da el rol.
  const sobra = !!vigente && viewByRole && (editByRole || !extraEdit);
  const src: ChipSrc =
    role === "admin" ? "admin" : vigente && !sobra ? "grant" : viewByRole ? "role" : status.kind === "blocked" ? "blocked" : "none";
  return { moduleId, src, view, edit, viewByRole, editByRole, sensitive: isSensitiveModule(moduleId), status, extra, sobra, soloVer };
}

/** Nivel visible de un chip en palabras cortas (las mismas de la matriz por rol). */
export function nivelCorto(e: Pick<EstadoModulo, "view" | "edit">): string | null {
  if (!e.view) return null;
  return e.edit ? "Edita" : "Ve";
}

export const NIVEL_LARGO: Record<NivelExtra, string> = {
  none: "sin extra",
  view: "solo ver",
  edit: "ver y editar",
};

/**
 * Fecha `AAAA-MM-DD` en hora de Caracas de un vencimiento guardado. La acción
 * guarda `T23:59:59-04:00`: cortar el ISO en UTC daría el día siguiente.
 */
export function fechaCaracas(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}
