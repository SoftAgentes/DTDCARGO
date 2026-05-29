/**
 * lib/i18n/es-VE/pwa-operario.ts · Strings de la PWA `/m/cn` del operario CN.
 *
 * NOTA · estado de migración (2026-05-28):
 *   La PWA actualmente usa un helper inline `t(lang, es, cn)` en 3 client
 *   components (login, home, nueva recepción). Esos siguen funcionando.
 *   Este catálogo está armado para:
 *     1. Migración progresiva cuando se toquen features de la PWA.
 *     2. Componentes shared del Studio que se embedeen en `/m/cn`
 *        (BugFAB, Toast, Drawer) — leen el locale del LocaleProvider y
 *        usan estos keys.
 *
 * Cookie `dtd_op_lang` (es | cn) se sincroniza con el sistema unificado
 * via `operarioLangToLocale()` en `lib/lang.ts`. Al login, se auto-setea
 * según `operario.region`.
 */

export const pwaOperario = {
  // ── Login ────────────────────────────────────────────────
  "pwa.login.title": "Almacén Yiwu",
  "pwa.login.subtitle": "Operario · DTD Cargo",
  "pwa.login.pin_prompt": "Ingresá tu PIN de 4 dígitos",
  "pwa.login.verifying": "Verificando…",
  "pwa.login.backspace_aria": "Borrar último dígito",
  "pwa.login.lang_es": "Español",
  "pwa.login.lang_cn": "中文",
  "pwa.login.error_invalid_pin": "PIN inválido — son 4 dígitos numéricos.",
  "pwa.login.error_wrong_pin": "PIN incorrecto o operario inactivo.",

  // ── Home ─────────────────────────────────────────────────
  "pwa.home.greeting": "Hola, {name}",
  "pwa.home.warehouse_label": "Tu almacén",
  "pwa.home.shift_today": "Tu turno · hoy",
  "pwa.home.action_new_receipt": "Nueva recepción",
  "pwa.home.action_pending_list": "Pendientes",
  "pwa.home.action_logout": "Cerrar sesión",
  "pwa.home.lang_switcher_aria": "Cambiar idioma",

  // ── Nueva recepción (header del wizard) ──────────────────
  "pwa.receipt.title": "Nueva recepción",
  "pwa.receipt.step_label": "Paso {current} de {total}",
  "pwa.receipt.continue": "Continuar",
  "pwa.receipt.back": "Atrás",
  "pwa.receipt.cancel": "Cancelar",
  "pwa.receipt.cancel_confirm": "¿Cancelar carga? Vas a perder los datos cargados.",
  "pwa.receipt.success": "Recepción registrada",
  "pwa.receipt.start_another": "Cargar otra",
  "pwa.receipt.go_home": "Volver al inicio",
} as const satisfies Record<string, string>;

export type PwaOperarioDict = Record<keyof typeof pwaOperario, string>;
