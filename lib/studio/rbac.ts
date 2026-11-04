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
 * Las listas acá son el DEFAULT del código, y ahí se quedan: la decisión del
 * founder de 2026-07-02 (§Candados, más abajo) descartó formalmente la matriz
 * editable en DB y los overrides por usuario. ⚠️ Esta cabecera prometía lo
 * contrario —"a futuro los overrides viven en DB (SDD-0085 §Futuro)"— y quedó
 * contradiciendo a la decisión que vive 100 líneas más abajo en este MISMO
 * archivo: quien leía sólo el encabezado concluía al revés. Corregido 2026-08-07.
 *
 * SDD-0139 dejó cláusula de reapertura para la matriz en DB ("revisar recién
 * con el 'empleado 4-5' o el primer pedido real del founder, como spec propia");
 * los overrides por usuario exigen una spec que supersede a 0139.
 *
 * El test anti-drift (`rbac.test.ts`) garantiza que la matriz y el registro de
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
  // Bitácora (SDD-0146): tareas internas del equipo — transversal a todos los
  // roles; support read-only vía canEditModule (V1).
  bitacora: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
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
  // Bandeja de Chatwoot (SDD-0585, E2-D8): quien atiende. Verla no edita nada en
  // Studio; lo que cada persona puede hacer adentro lo decide su rol de Chatwoot.
  bandeja: ["commercial", "support"],
  // CRM (id interno "kommo", rótulo visible "CRM"). El placeholder vacío
  // "CRM · Leads" se eliminó en el rebrand del 2026-08-11; `support` no hereda
  // su acceso — ampliarle el alcance es una decisión de permisos aparte, no un
  // efecto colateral de borrar una pantalla que no mostraba nada.
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
  // marketing (SDD-0252, founder 2026-08-07): único rol excluido pese a estar
  // en casi todos los demás módulos transversales — era un olvido, no una
  // decisión (confirmado con el founder al medir la matriz).
  documents: ["commercial", "operations", "accounting", "warehouse", "support", "marketing"],
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
  // Lector de docs/marketing (SDD-0158): mismos roles que el módulo marketing.
  "marketing-docs": ["marketing", "commercial", "support"],

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

/**
 * Subconjunto de ADMIN_ONLY_MODULES que además exige `is_platform_admin()`
 * (SDD-0252, corte 2 tras la 0355). Mueven plata internacional (financiero
 * de China), tienen efecto legal (T&C) o custodian recuperación (No-Olvidar);
 * Rendiciones es dinero + admin-only a la vez. Dirección y Mailing se quedan
 * en admin-por-rol a propósito (founder 2026-08-07: menor daño, los necesita
 * cualquier director). El check real vive en `rbac-guard.ts` — acá sólo es
 * data pura, igual que el resto del archivo.
 */
export const SUPERADMIN_ONLY_MODULES: ReadonlySet<string> = new Set([
  "financiero-china",
  "legal",
  "no-olvidar",
  "renditions",
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
  /**
   * Correr la "Secretaria Escucha Activa" sobre un acta de Bitácora (SDD-0150):
   * la capa suspicaz (lectura entre líneas) es criterio del founder, no para
   * circular entre pares. Admin-only por ahora ([] = solo admin); se habilita a
   * gerentes agregando su rol acá, sin tocar los call sites.
   */
  escucha_activa: [],
  /**
   * Ver el Expediente de defensa de una operación (SDD-0070): evidencia con PII
   * (IP/user_agent de la aceptación, cédula del receptor del POD). Era admin-only
   * duro; el founder (2026-07-19) lo abre al asesor que atiende el reclamo —
   * `commercial` + `support` (los mismos que abren Reclamos). El RESTO de la capa
   * legal (T&C, aceptaciones, evidencia individual) sigue admin-only.
   */
  view_defense_file: ["commercial", "support"],
  /** Moderar comentarios ajenos (SDD-0168): admin-only por defecto. */
  moderate_comments: [],
  /** Consultar eliminados y restaurarlos (SDD-0168): admin-only por defecto. */
  restore_comments: [],
  /** Consultar metadatos redacted del audit log (SDD-0166 Corte C). */
  audit_view: [],
  /** Revelar allowlist sensible con motivo + AAL2 (SDD-0166 Corte C). */
  audit_view_sensitive: [],
  /** Anular un finiquito confirmado y su asiento (SDD-0226): admin-only. */
  void_payroll_settlement: [],
  /** Anular un gasto y su asiento (SDD-0243): accounting + admin implícito. */
  void_expense: ["accounting"],
  /**
   * Eliminar embarques (SDD-0522): admin-only, decisión de Sam. La base lo
   * exige por su cuenta —`soft_delete_shipments_with_audit_reason` (migr 0476)
   * pide `role = 'admin'` en user_tenants—, así que agregar un rol acá sin una
   * migración sólo mostraría la casilla a quien la base igual rechaza.
   */
  delete_shipments: [],
  /** Eliminar recepciones del Almacén CN (SDD-0522): admin-only, igual que embarques. */
  delete_warehouse_receipts: [],
  /**
   * La vía excepcional de la tarifa congelada (SDD-0571): fijarla a mano o con
   * el Excel de Yiwu, usar 1.000 kg/m³ o reemplazar una congelada, con motivo.
   * accounting + admin implícito, aunque la matriz no les dé `cn` (decisión del
   * Director del 2026-10-20: la matriz de `cn` no cambia). La base repite el
   * candado: `congelar_tarifa_recepcion` (migr 0496) exige admin o accounting.
   */
  fix_frozen_rate: ["accounting"],
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

/** Ver/editar de un (rol, módulo) — una fila de `studio_role_module_overrides`. */
export interface ModuleAccessOverride {
  view: boolean;
  edit: boolean;
}

/**
 * Desvíos del default de `ROLE_MODULE_ACCESS` por (rol, módulo) — SDD-0252,
 * migr 0357. Clave `"${role}:${moduleId}"`. Fila ausente en el mapa = aplica
 * el default de código. Se hidrata en `rbac-guard.ts` (gate real) y en
 * `app/studio/(app)/layout.tsx` → `StudioSidebar` (UX); el resto de los
 * call sites de `canAccessModule`/`canEditModule` no cambian.
 */
export type RoleModuleOverrides = Readonly<Record<string, ModuleAccessOverride>>;

function overrideKey(role: string, moduleId: string): string {
  return `${role}:${moduleId}`;
}

/**
 * ¿El rol puede VER el módulo? `admin` siempre; rol nulo/desconocido = no.
 * Fail-closed: un módulo sin entrada en la matriz solo lo ve admin.
 *
 * `overrides` (SDD-0252) es opcional y por defecto `undefined` → idéntico al
 * comportamiento de siempre. Un módulo LOCKED (dinero ∪ admin-only) IGNORA
 * cualquier override — el candado de gobernanza no se abre desde la matriz,
 * ni siquiera si una fila se coló por fuera del RPC (mismo candado que el
 * CHECK de la tabla, en la otra punta).
 */
export function canAccessModule(
  role: StudioUserRole | null | undefined,
  moduleId: string,
  overrides?: RoleModuleOverrides,
): boolean {
  if (role === "admin") return true;
  if (!role) return false;
  if (overrides && !LOCKED_MODULES.has(moduleId)) {
    const o = overrides[overrideKey(role, moduleId)];
    if (o) return o.view;
  }
  const allowed = ROLE_MODULE_ACCESS[moduleId];
  if (!allowed) return false; // fail-closed
  return allowed.includes(role);
}

/**
 * ¿El rol puede EDITAR (mutar) en el módulo? = puede ver Y no es `support`
 * (read-only V1, inmutable — la matriz NO lo cambia). `admin` siempre.
 */
export function canEditModule(
  role: StudioUserRole | null | undefined,
  moduleId: string,
  overrides?: RoleModuleOverrides,
): boolean {
  if (role === "admin") return true;
  if (role === "support") return false; // read-only V1
  if (!role) return false;
  if (overrides && !LOCKED_MODULES.has(moduleId)) {
    const o = overrides[overrideKey(role, moduleId)];
    if (o) return o.edit;
  }
  return canAccessModule(role, moduleId, overrides);
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
