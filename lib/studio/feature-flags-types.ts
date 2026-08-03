/**
 * Feature flags · types + helpers (SDD futuro · sin Zod).
 *
 * Portado de Claude Design v1.7:
 * docs/design/studio/_norte/erp/feature-flags.jsx
 *
 * El catálogo salió del handoff con 20 keys "aspiracionales": nombraban
 * features que el Norte pensaba construir, no features construidas. Casi
 * todas siguen sin consumidor — apagarlas no apaga nada. Ver
 * FEATURE_FLAG_EFFECT: es la clasificación honesta, medida contra el
 * código, y el panel de admin la muestra para que nadie crea que apagó
 * algo que sigue encendido.
 *
 * MODULE_FLAG_MAP mapea id de módulo del sidebar → flag key. Los módulos
 * sin entry en el map se consideran "core" (siempre visibles).
 */

export type FeatureFlagKey =
  | "customs_seniat"
  | "cargo_insurance"
  | "hs_autodetect"
  | "cn_translation"
  | "ai_copilot"
  | "whatsapp"
  | "email_sequences"
  | "branding_xcliente"
  | "multi_currency"
  | "vault"
  | "audit_log"
  | "api_public"
  | "webhooks"
  | "comments"
  | "consolidation_partial"
  | "portal_cliente"
  | "mobile_operator"
  | "sustainability"
  | "backup_auto"
  | "sso"
  | "marketing_news"
  // Sembrado por 0066 y LEÍDO de verdad por la PWA del bodeguero
  // (app/m/ve/bodeguero/page.tsx), pero nunca estuvo en este catálogo:
  // el panel de admin no lo mostraba y sólo se podía tocar por SQL.
  | "dispatch.show_warehouse_location";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export interface FeatureFlagRow {
  id: string;
  tenant_id: string;
  key: FeatureFlagKey;
  enabled: boolean;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Defaults · mismos valores que el handoff. Sirve como fallback si la
 * query devuelve menos rows que las esperadas (defensa contra migrations
 * incompletas o tenants nuevos sin seed).
 */
export const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
  customs_seniat: false,
  cargo_insurance: false,
  hs_autodetect: true,
  cn_translation: true,
  ai_copilot: false,
  whatsapp: true,
  email_sequences: false,
  branding_xcliente: true,
  multi_currency: true,
  vault: true,
  audit_log: true,
  api_public: false,
  webhooks: true,
  comments: true,
  consolidation_partial: true,
  portal_cliente: true,
  mobile_operator: false,
  sustainability: false,
  backup_auto: true,
  sso: false,
  // Default off · habilitar manualmente cuando migrations 0053-0056
  // (seo_drafts, news_writers, news_posts, seed) estén aplicadas a prod.
  marketing_news: false,
  // Default off: la bodega no está zoneada por default (0066).
  "dispatch.show_warehouse_location": false,
};

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = Object.keys(
  FEATURE_FLAG_DEFAULTS,
) as FeatureFlagKey[];

/**
 * Labels en castellano-VE para UI admin.
 */
export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  customs_seniat: "Aduana SENIAT",
  cargo_insurance: "Seguro de carga",
  hs_autodetect: "Auto-detección HS code",
  cn_translation: "Traductor CN",
  ai_copilot: "AI Copilot",
  whatsapp: "WhatsApp Business",
  email_sequences: "Email sequences automáticas",
  branding_xcliente: "Branding por cliente",
  multi_currency: "Multi-moneda (USD/VES/CNY)",
  vault: "No-Olvidar (caja fuerte)",
  audit_log: "Audit log con drill-down",
  api_public: "API pública",
  webhooks: "Webhooks salientes",
  comments: "Comments con @menciones",
  consolidation_partial: "Consolidación parcial",
  portal_cliente: "Portal del cliente",
  mobile_operator: "App móvil operario",
  sustainability: "Reportes de sustentabilidad",
  backup_auto: "Backup automático",
  sso: "Single Sign-On",
  marketing_news: "Marketing · Generador de Noticias Web",
  "dispatch.show_warehouse_location": "Ubicación en bodega (pasillo/zona/estante)",
};

/**
 * Qué hace REALMENTE cada flag, medido contra el código (no contra la
 * intención del handoff).
 *
 *  - `ruta`     → además de esconder el módulo, bloquea la URL. Apagarlo
 *                 apaga la feature de verdad.
 *  - `lectura`  → algún componente lee el flag y cambia lo que muestra.
 *  - `sidebar`  → sólo esconde el link del sidebar. **La URL sigue
 *                 abriendo**: es cosmético, no es un permiso. Para negar
 *                 acceso está RBAC (SDD-0085), no esto.
 *  - `ninguno`  → no tiene un solo consumidor en el código. El toggle
 *                 guarda en la base y no pasa nada más.
 *
 * ⚠️ Que un flag sea `ruta` NO lo convierte en un permiso. Cierra la feature
 * para toda la empresa, no para un rol. Los dos guards conviven y responden
 * preguntas distintas: `requireModuleView` = "¿tu rol puede?",
 * `requireFeatureEnabled` = "¿esta empresa lo usa?".
 *
 * Este mapa NO es documentación decorativa: `feature-flags-effect.test.ts`
 * lo verifica contra el código y se pone rojo si alguien conecta (o
 * desconecta) un flag sin actualizarlo acá.
 */
export type FeatureFlagEffect = "ruta" | "lectura" | "sidebar" | "ninguno";

export const FEATURE_FLAG_EFFECT: Record<FeatureFlagKey, FeatureFlagEffect> = {
  // Guard de ruta en app/studio/(app)/marketing/noticias-web/page.tsx.
  marketing_news: "ruta",
  // Leído por app/m/ve/bodeguero/page.tsx para mostrar u ocultar la ubicación.
  "dispatch.show_warehouse_location": "lectura",
  // Promovidos de `sidebar` a `ruta` el 2026-08-02 (decisión del founder):
  // `requireFeatureEnabled` en los layouts de seniat / cola-qr / operarios.
  // Antes apagarlos sólo escondía el link y /studio/seniat seguía abriendo.
  customs_seniat: "ruta",
  mobile_operator: "ruta",
  // Sigue siendo sólo-sidebar: esconde `no-olvidar` (SDD-0025, dormante). No se
  // le pone guard de ruta porque el módulo ya es un EmptyState "Próximamente"
  // que no toca la base — cerrarlo no protegería nada que no esté ya vacío.
  vault: "sidebar",
  // Sin consumidor. Nombran features del handoff que no se construyeron,
  // o que se construyeron sin cablear el flag.
  cargo_insurance: "ninguno",
  hs_autodetect: "ninguno",
  cn_translation: "ninguno",
  ai_copilot: "ninguno",
  whatsapp: "ninguno",
  email_sequences: "ninguno",
  branding_xcliente: "ninguno",
  multi_currency: "ninguno",
  audit_log: "ninguno",
  api_public: "ninguno",
  webhooks: "ninguno",
  comments: "ninguno",
  consolidation_partial: "ninguno",
  portal_cliente: "ninguno",
  sustainability: "ninguno",
  backup_auto: "ninguno",
  sso: "ninguno",
};

export const FEATURE_FLAG_EFFECT_LABELS: Record<FeatureFlagEffect, string> = {
  ruta: "Bloquea la ruta",
  lectura: "Cambia lo que se muestra",
  sidebar: "Sólo esconde del sidebar",
  ninguno: "Sin efecto",
};

/**
 * Map id de módulo del sidebar → flag key. Los módulos NO listados
 * son "core" (siempre visibles, no se pueden ocultar).
 *
 * Portado de window.MODULE_FLAG_MAP del v1.7 + adaptado a los slugs
 * actuales del prod (despacho-dashboard, etc.).
 */
export const MODULE_FLAG_MAP: Partial<Record<string, FeatureFlagKey>> = {
  seniat: "customs_seniat",
  "no-olvidar": "vault",
  qrqueue: "mobile_operator",
  operarios: "mobile_operator",
  "noticias-web": "marketing_news",
  // Cuando se porten estos módulos del v1.7, los enchufamos:
  // "audit-log": "audit_log",
  // "conciliacion": "audit_log", // o flag propio si crece
  // "ai-copilot": "ai_copilot",
};

/**
 * Decide si un módulo del sidebar debe mostrarse según los flags activos.
 * Módulos sin entry en MODULE_FLAG_MAP = siempre visibles (core).
 *
 * Pure function · safe para usar en server y client.
 */
export function isModuleEnabled(
  moduleId: string,
  flags: FeatureFlags,
): boolean {
  const flagKey = MODULE_FLAG_MAP[moduleId];
  if (!flagKey) return true; // core module
  return flags[flagKey];
}

/**
 * Merge defaults + rows de DB → FeatureFlags completo.
 * Cualquier flag que falte en DB cae al default del handoff (defensa
 * contra seeds incompletos o flags nuevos agregados después).
 */
export function mergeFlagsWithDefaults(rows: FeatureFlagRow[]): FeatureFlags {
  const out: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS };
  for (const r of rows) {
    out[r.key] = r.enabled;
  }
  return out;
}
