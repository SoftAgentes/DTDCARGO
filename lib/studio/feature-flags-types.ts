/**
 * Feature flags · types + helpers (SDD futuro · sin Zod).
 *
 * Portado de Claude Design v1.7:
 * docs/design/studio/_norte/erp/feature-flags.jsx
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
  | "marketing_news"
  // SDD-0585: Bandeja de Chatwoot. Sembrado por el catálogo de 0503.
  | "chatwoot_inbox"
  // Sembrado por 0066 y por el catálogo de 0337, y LEÍDO por la PWA de
  // bodeguero. Faltaba acá, así que el panel de admin nunca lo mostró: la
  // migración dice "para que el panel pueda tocarlo" y el panel no lo veía.
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
  chatwoot_inbox: false,
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
  chatwoot_inbox: "Bandeja de Chatwoot dentro de Studio",
  "dispatch.show_warehouse_location":
    "Bodeguero · mostrar pasillo/zona/estante del paquete",
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
  bandeja: "chatwoot_inbox",
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

/** Qué hace de verdad un interruptor cuando se apaga. */
export type FeatureFlagEffect =
  /** Bloquea la URL: un `layout.tsx`/`page.tsx` rebota si está apagado. */
  | "ruta"
  /** Sólo esconde el módulo del sidebar; la URL sigue abriendo. */
  | "sidebar"
  /**
   * Lo consume la PWA (`app/m/**`), no el Studio. Existe porque el detector de
   * "ruta" sólo recorre `app/studio/(app)`: sin esta categoría, un flag que la
   * PWA sí respeta habría que marcarlo "ninguno" — una mentira.
   */
  | "movil"
  /** Nada. El interruptor se mueve y el sistema no cambia. */
  | "ninguno";

/**
 * EFECTO REAL DE CADA FLAG — medido contra el código, no declarado de deseo.
 *
 * El panel de admin muestra 21 interruptores. Este mapa dice cuáles hacen algo,
 * y `__tests__/feature-flags-catalog.test.ts` verifica que sea CIERTO: recorre
 * `app/studio/(app)` buscando guards reales y se pone rojo si un flag marcado
 * `ruta` no tiene quién lo lea, o si uno marcado `ninguno` sí se consume.
 *
 * ⚠️ **17 de los 21 son `ninguno` hoy.** No es un descuido de este mapa: es el
 * estado real, medido el 2026-08-10 buscando toda lectura (`flags.<key>`,
 * `requireFeatureEnabled`, `MODULE_FLAG_MAP`) en `app`, `lib` y `components`.
 * Sólo cuatro se consumen en algún lado. Los demás se prenden y se apagan sin
 * que el sistema cambie — el panel promete un control que no existe.
 *
 * Eso NO se arregla acá: cablearlos es trabajo por flag, cada uno con su
 * decisión de producto. Lo que este mapa hace es dejar de esconderlo, y que la
 * próxima vez que alguien cablee uno el contrato le exija actualizar la fila.
 */
export const FEATURE_FLAG_EFFECT: Record<FeatureFlagKey, FeatureFlagEffect> = {
  // ── Los que sí hacen algo ──
  /** `seniat/layout.tsx` → requireFeatureEnabled("seniat"). */
  customs_seniat: "ruta",
  /** `cola-qr/layout.tsx` → requireFeatureEnabled("qrqueue"). */
  mobile_operator: "ruta",
  /** `marketing/noticias-web/page.tsx:62` lee `flags.marketing_news` directo. */
  marketing_news: "ruta",
  /** `bandeja/layout.tsx` → requireFeatureEnabled("bandeja") (SDD-0585). */
  chatwoot_inbox: "ruta",
  /** Sólo esconde "no-olvidar" del sidebar; la ruta no lo consulta. */
  vault: "sidebar",
  /** `app/m/ve/bodeguero/page.tsx` lo consulta por `.eq("key", …)`. */
  "dispatch.show_warehouse_location": "movil",

  // ── Los que hoy no hacen nada ──
  // Sembrados y visibles en el panel, sin un solo consumidor en el código.
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
