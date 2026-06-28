/**
 * lib/i18n/es-VE/pwa-operario.ts · Strings de la PWA `/m/cn` del operario CN.
 *
 * La PWA usa la función `t(locale, key)` del dict unificado vía un wrapper
 * `tr(lang, key)` que mapea Lang (cookie es|cn) → Locale con
 * `operarioLangToLocale()`. Cookie `dtd_op_lang` auto-seteada al login
 * según `operario.region`.
 *
 * Las traducciones zh-CN de la sección `pwa.receipt.*` son las que ya
 * estaban en uso en el wizard NuevaRecepcionClient (validadas en campo);
 * se preservaron al migrar al dict unificado (SDD-0038).
 */

export const pwaOperario = {
  // ── Login ────────────────────────────────────────────────
  "pwa.login.title": "Almacén Yiwu",
  "pwa.login.subtitle": "Operario · DTD Cargo",
  "pwa.login.pin_prompt": "Ingresa tu PIN de 4 dígitos",
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

  // ── Wizard · navegación ──────────────────────────────────
  "pwa.receipt.nav_back": "Atrás",
  "pwa.receipt.saving": "Guardando…",
  "pwa.receipt.next_arrow": "Siguiente →",

  // ── Wizard · paso 1 Fotos ────────────────────────────────
  "pwa.receipt.step1_title": "1 de 4 · Fotos",
  "pwa.receipt.step1_subtitle": "Toma 3 fotos mínimo",
  "pwa.receipt.photos_enough": "Fotos suficientes · puedes seguir",
  "pwa.receipt.take_photo": "Tomar foto",
  "pwa.receipt.photo_n": "Foto {n}",
  "pwa.receipt.remove_photo": "Quitar foto",
  "pwa.receipt.photos_missing": "Faltan {n} fotos · mínimo 3 para registrar",
  "pwa.receipt.photo_hint":
    "Toma: 1) frente con etiqueta · 2) supplier label · 3) contenido · 4) daños si hay",

  // ── Wizard · paso 2 Identificar ──────────────────────────
  "pwa.receipt.step2_title": "2 de 4 · Identificar",
  "pwa.receipt.step2_subtitle": "¿De quién es esta caja?",
  "pwa.receipt.visible_marks": "Marcas visibles en la caja",
  "pwa.receipt.marks_ph": "Ej: ACINDAR-VLN-04 · etiqueta china",
  "pwa.receipt.brought_by": "¿Quién la trajo?",
  "pwa.receipt.brought_by_ph": "Chofer o courier",
  "pwa.receipt.search_client": "Buscar cliente · Shipping Mark",
  "pwa.receipt.no_matches": "Sin coincidencias",
  "pwa.receipt.orphan_toggle": "Caja sin código · huérfana",

  // ── Wizard · paso 3 Datos ────────────────────────────────
  "pwa.receipt.step3_title": "3 de 4 · Datos",
  "pwa.receipt.step3_subtitle": "Dimensiones y supplier",
  "pwa.receipt.supplier": "Proveedor chino",
  "pwa.receipt.supplier_ph": "Nombre del supplier",
  "pwa.receipt.boxes": "Cajas",
  "pwa.receipt.total_weight": "Peso total",
  "pwa.receipt.hs_code": "HS Code (opcional · del supplier)",
  "pwa.receipt.dest_city": "Ciudad destino VE (opcional)",
  "pwa.receipt.choose": "— Elegir —",
  "pwa.receipt.city_ph": "ej: Valencia",
  "pwa.receipt.cities_loaded": "{n} ciudades cargadas del catálogo del tenant.",
  "pwa.receipt.cities_empty":
    "Catálogo VE vacío · escribe ciudad libre o pídele al admin seedear catálogo.",

  // ── Wizard · paso 4 Confirmar ────────────────────────────
  "pwa.receipt.step4_title": "4 de 4 · Confirmar",
  "pwa.receipt.step4_subtitle": "Revisa y guarda",
  "pwa.receipt.summary": "Resumen",
  "pwa.receipt.photos_label": "Fotos",
  "pwa.receipt.client": "Cliente",
  "pwa.receipt.orphan_summary": "Huérfana · {marks}",
  "pwa.receipt.supplier_label": "Supplier",
  "pwa.receipt.boxes_short": "Cajas",
  "pwa.receipt.weight_label": "Peso",
  "pwa.receipt.report_incident": "Reportar incidencia con la caja",
  "pwa.receipt.incident_desc": "Descripción de la incidencia",
  "pwa.receipt.incident_ph": "Ej: caja con daño en esquina superior",
  "pwa.receipt.submit_register": "Registrar recepción",

  // ── Wizard · upload + éxito ──────────────────────────────
  "pwa.receipt.uploading_photos": "Subiendo fotos…",
  "pwa.receipt.dont_close": "No cierres la app",
  "pwa.receipt.saved_toast": "Recepción {code} guardada",
  "pwa.receipt.saved_with_errors":
    "Recepción {code} guardada — {n} foto(s) con error",
  "pwa.receipt.saved_title": "Recepción guardada",
  "pwa.receipt.appears_in_studio": "Aparece en el panel del Studio en segundos",
  "pwa.receipt.photos_uploaded": "✓ {n} foto(s) subida(s)",
  "pwa.receipt.photos_progress": "{up}/{total} fotos · {err} con error",
  "pwa.receipt.photos_queued": "{n} foto(s) se subirán solas al volver la señal",
  "pwa.receipt.photo_retry_one": "Foto pendiente subida ✓",
  "pwa.receipt.photo_retry_many": "{n} fotos pendientes subidas ✓",
  "pwa.receipt.new_another": "+ Nueva recepción",
  "pwa.receipt.back_home": "Volver al home",
  "pwa.receipt.back_generic": "Volver",
} as const satisfies Record<string, string>;

export type PwaOperarioDict = Record<keyof typeof pwaOperario, string>;
