/**
 * RBAC por módulo del Studio — SDD-0085.
 *
 * PROBLEMA: hoy el ERP solo distingue `admin` vs no-admin (un único gate
 * `isAdmin` en el layout). Los 7 roles (SDD-0024 + `marketing` de SDD-0119)
 * existen en DB pero los intermedios NO restringen ningún módulo — el aislamiento real es por
 * `tenant_id`/RLS, no por rol. Un `accounting` podía abrir Usuarios; un
 * `operations` podía abrir Tesorería.
 *
 * SOLUCIÓN: una matriz módulo×rol + helpers puros. DATA PURA (sin React, sin
 * server-only) → importable desde el sidebar (client), el layout, las pages y
 * las server actions. El gate server-side vive en `rbac-guard.ts`.
 *
 * Modelo (simple gana — founder 2026-06-14):
 *   - `admin` ve y edita TODO (no figura en la matriz; el helper lo concede).
 *   - `support` es read-only V1: ve lo que la matriz permita, NUNCA edita.
 *   - El resto ve/edita solo los módulos donde la matriz los incluye.
 *   - Fail-closed: un módulo sin entrada en la matriz = solo admin.
 *
 * Candados de gobernanza (doc `estructura-perfiles-dtdcargo.md`, separación
 * de poderes que el doc predica pero el ERP no aplicaba):
 *   - DINERO (tesorería/contabilidad/facturación/cobranzas/costing/reportes/
 *     fiscal) = solo `accounting` (+admin). NUNCA `operations` ni `commercial`.
 *     → Yolimar = accounting, NO admin.
 *   - ADMIN (usuarios/admin/dirección/rendiciones/financiero-china/legal/
 *     no-olvidar/mailing) = solo `admin`.
 *   - Sourcing/proveedores = `commercial`; `operations` verifica, NUNCA mueve
 *     plata.
 *
 * Las listas acá son el DEFAULT del código. A futuro la "Matriz rol→persona"
 * y los overrides por tenant viven en DB (SDD-0085 §Futuro). El test
 * anti-drift (`rbac.test.ts`) garantiza que la matriz y el registro de
 * módulos (`modules.ts`) nunca se desincronicen.
 *
 * El `owner_role` del motor de flujo interno (FASE-FUTURA) reusa estos mismos
 * 7 roles — un solo vocabulario en todo el sistema.
 */

import type { StudioUserRole, WarehouseScope } from "@/lib/studio/user-types";
import { MODULES } from "@/lib/studio/modules";

/**
 * Roles NO-admin con acceso de VISTA a cada módulo (clave = `id` del registro
 * en modules.ts). `admin` siempre pasa (no se lista). `[]` = solo admin.
 */
export const ROLE_MODULE_ACCESS: Record<string, readonly StudioUserRole[]> = {
  // ─── OPERACIÓN ───────────────────────────────────────────────
  // dashboard (cockpit operativo) + calendario: transversales; marketing también
  // los ve (decisión founder 2026-07-02). NO confundir con el módulo `marketing`,
  // que trae su propio dashboard "buenos días".
  dashboard: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
  shipments: ["commercial", "operations", "accounting", "warehouse", "support"],
  tracking: ["commercial", "operations", "accounting", "warehouse", "support"],
  calendar: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
  cn: ["operations", "warehouse", "support"],
  qrqueue: ["operations", "warehouse"],
  labels: ["operations", "warehouse"],
  ve: ["operations", "warehouse", "support"],
  // Inventario / WMS (SDD-0081): torre de stock read-only. La corre operación +
  // bodega; support la consulta. Sin USD → no es módulo de dinero.
  inventory: ["operations", "warehouse", "support"],
  naviera: ["operations", "accounting"],
  seniat: ["operations", "accounting"],
  tms: ["operations", "warehouse"],
  despacho: ["operations", "warehouse"],
  "despacho-rules": ["operations"],
  "despacho-dashboard": ["operations", "warehouse"],
  "admin-rutas": ["operations"],
  // Post-venta (SDD-0101): atención (commercial/operations) abre; accounting ve
  // indemnizaciones; support read-only. admin siempre.
  reclamos: ["commercial", "operations", "accounting", "support"],
  // Inspecciones (SDD-0066): calidad la corre operación; comercial la usa con el
  // cliente; support read-only. White-label: el proveedor tercero es interno.
  inspecciones: ["operations", "commercial", "support"],

  // ─── COMERCIAL ───────────────────────────────────────────────
  quotes: ["commercial", "operations", "accounting", "support"],
  clients: ["commercial", "operations", "accounting", "support"],
  conversaciones: ["commercial", "operations", "support"],
  leads: ["commercial", "support"],
  kommo: ["commercial"],
  suppliers: ["commercial", "operations"],
  "purchase-orders": ["commercial", "operations", "accounting"],
  "sales-orders": ["commercial", "operations", "accounting"],
  // accounting: edita precio + cuenta contable de Academia DENTRO de servicios
  // (SDD-0093 "gate por campo"); el gate de vista lo dejaba afuera (review 2026-07-02).
  "service-catalog": ["commercial", "operations", "accounting"],
  rates: ["commercial", "accounting"],
  fidelizacion: ["commercial", "support"],
  // Academia (SDD-0093): contenido = commercial (Director); precio+cuenta = accounting (gate por campo en servicios).
  academia: ["commercial", "accounting", "support"],
  // Club DTD (SDD-0116 D6): lo administra comercial; support read-only. admin siempre.
  club: ["commercial", "support"],

  // ─── FINANZAS · DINERO = accounting (+admin) · admin-only = [] ─
  direccion: [], // admin only (tablero ejecutivo, SDD-0048)
  // operations + warehouse registran (el equipo CN puede, RLS expenses_cn_team
  // migr 0074); accounting paga. (Alinea matriz↔RLS — SDD-0085 §M1.)
  expenses: ["accounting", "operations", "warehouse"],
  invoices: ["accounting"],
  accounting: ["accounting"],
  collections: ["accounting"],
  renditions: [], // admin only
  treasury: ["accounting"], // tesorería mueve plata → accounting + admin
  fiscal: ["accounting"],
  "financiero-china": [], // admin only
  documents: ["commercial", "operations", "accounting", "warehouse", "support"],
  reports: ["accounting"],
  costing: ["accounting"], // márgenes — sensible
  // Nómina (SDD-0103): dinero + PII de empleados → SOLO accounting (+admin). La
  // RLS de la DB también gatea por rol (nomina_can_access), no solo por tenant.
  nomina: ["accounting"],

  // ─── MARKETING ───────────────────────────────────────────────
  // SDD-0119: módulo dedicado (dashboard "buenos días" + HUB + calendario).
  // Lo administra el área de marketing; comercial lo acompaña; support lo ve
  // read-only. admin siempre.
  marketing: ["marketing", "commercial", "support"],
  "noticias-web": ["commercial", "support", "marketing"],

  // ─── SISTEMA ─────────────────────────────────────────────────
  mentions: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
  mailing: [], // config de reglas de correo a clientes → admin only
  "no-olvidar": [], // recovery custodial M-of-N → admin only
  legal: [], // admin only (T&C, gates legales)
  users: [], // gestión de usuarios y roles → SOLO admin (keystone)
  operarios: ["operations"], // gestión de PINs de operario PWA
  bugs: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
  "mis-bugs": ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
  admin: [], // admin only
};

const MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map((m) => m.id));

// ─── Candados de gobernanza como invariante ejecutable (SDD-0139) ────────
// Decisión founder 2026-07-02 (opinión Codex + panel de expertos): la matriz
// NO se vuelve editable en DB, NO hay V/C/E/D ni overrides por usuario. Los
// candados pasan de comentario a set exportado que los tests verifican.

/** Módulos de DINERO: default = exactamente ['accounting'] (+admin implícito). */
export const MONEY_MODULES: ReadonlySet<string> = new Set([
  "invoices",
  "accounting",
  "collections",
  "treasury",
  "fiscal",
  "costing",
  "reports",
  "nomina",
]);

/** Módulos admin-only duro: matriz = [] (solo admin). */
export const ADMIN_ONLY_MODULES: ReadonlySet<string> = new Set([
  "users",
  "admin",
  "direccion",
  "renditions",
  "financiero-china",
  "legal",
  "no-olvidar",
  "mailing",
]);

/** Candados inmutables: cambiarlos SOLO pasa por PR + code review, jamás por UI/DB. */
export const LOCKED_MODULES: ReadonlySet<string> = new Set([
  ...MONEY_MODULES,
  ...ADMIN_ONLY_MODULES,
]);

// ─── Capabilities: acciones peligrosas con gate explícito (SDD-0139) ─────
// "Delete/Approve no son CRUD genérico, son reglas de negocio" (Codex). Una
// capability nombra el ACTO (no el módulo) y lista los roles no-admin que lo
// ejecutan. Se agregan solo cuando existe el flujo real — cero aspiracionales.

export const CAPABILITIES = {
  /**
   * Causar una CxP / mover plata desde un módulo NO-dinero: el puente OC→Bill
   * (`receivePurchaseOrder`). Antes se expresaba "prestándose" el gate del
   * módulo treasury.
   */
  approve_money: ["accounting"],
} as const satisfies Record<string, readonly StudioUserRole[]>;

export type StudioCapability = keyof typeof CAPABILITIES;

/** ¿El rol tiene la capability? `admin` siempre; rol nulo/desconocido = no. */
export function canSpecial(
  role: StudioUserRole | null | undefined,
  capability: StudioCapability,
): boolean {
  if (role === "admin") return true;
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly StudioUserRole[]).includes(role);
}

// ─── Scope de almacén por usuario (SDD-0139 · Norte users.jsx) ───────────
// Atributo OPERATIVO del usuario (user_tenants.warehouse_scope, migr 0202),
// NO una dimensión de la matriz. Gatea el acceso a los módulos con lado
// geográfico claro; el rol sigue decidiendo ver/editar. 'all' = sin
// restricción (default → cero cambio de comportamiento hasta que un admin
// asigne un scope). Tipo y labels viven en user-types.ts (atributo del user).

/** Módulos con lado geográfico → scope requerido para verlos (no-admin). */
export const WAREHOUSE_SCOPED_MODULES: Record<string, Exclude<WarehouseScope, "all">> = {
  cn: "cn",
  qrqueue: "cn",
  labels: "cn",
  ve: "ve",
};

/**
 * ¿El scope del usuario permite el módulo? Módulo sin lado = siempre sí.
 * Scope nulo/desconocido se trata como 'all' (pre-migración / sin asignación)
 * — el gate duro sigue siendo el rol; el scope solo RESTRINGE.
 */
export function scopeAllowsModule(
  scope: WarehouseScope | string | null | undefined,
  moduleId: string,
): boolean {
  const side = WAREHOUSE_SCOPED_MODULES[moduleId];
  if (!side) return true;
  if (!scope || scope === "all") return true;
  return scope === side;
}

/**
 * ¿El rol puede VER el módulo? `admin` siempre; rol nulo/desconocido = no.
 * Fail-closed: un módulo sin entrada en la matriz solo lo ve admin.
 */
export function canAccessModule(
  role: StudioUserRole | null | undefined,
  moduleId: string,
): boolean {
  if (role === "admin") return true;
  if (!role) return false;
  const allowed = ROLE_MODULE_ACCESS[moduleId];
  if (!allowed) return false; // fail-closed
  return allowed.includes(role);
}

/**
 * ¿El rol puede EDITAR (mutar) en el módulo? = puede ver Y no es `support`
 * (read-only V1). `admin` siempre.
 */
export function canEditModule(
  role: StudioUserRole | null | undefined,
  moduleId: string,
): boolean {
  if (role === "admin") return true;
  if (role === "support") return false; // read-only V1
  return canAccessModule(role, moduleId);
}

/**
 * Mapea un pathname `/studio/...` al `id` de módulo (o null si no matchea).
 * Match más específico primero, para que `/studio/despacho/reglas` gane sobre
 * `/studio/despacho`. Útil para un gate central futuro (hoy las pages pasan el
 * id explícito a `requireModuleView`).
 */
export function moduleIdForPath(pathname: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const m of MODULES) {
    if (pathname === m.slug || pathname.startsWith(m.slug + "/")) {
      if (!best || m.slug.length > best.len) best = { id: m.id, len: m.slug.length };
    }
  }
  return best?.id ?? null;
}

/** ¿El id existe en el registro de módulos? (guard de programación.) */
export function isKnownModule(moduleId: string): boolean {
  return MODULE_IDS.has(moduleId);
}
