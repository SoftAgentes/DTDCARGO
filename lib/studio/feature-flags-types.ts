/**
 * Feature flags · types + helpers (SDD futuro · sin Zod).
 *
 * Portado de Claude Design v1.7:
 * docs/design/studio/v1.7-claude-design/project/nuevo/feature-flags.jsx
 *
 * 20 flags · perfilados de FEATURE_FLAG_DEFAULTS del handoff. Cada flag
 * decide si una feature/módulo está activa para el tenant.
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
  | "marketing_news";

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
