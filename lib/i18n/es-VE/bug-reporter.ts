/**
 * lib/i18n/es-VE/bug-reporter.ts · Strings del Bug Reporter (FAB + Modal).
 *
 * SDD-0036 Fase i18n: el operador CN abre el FAB violeta y reporta un bug
 * en chino. El triage VE necesita el reporte traducido al español para
 * accionarlo rápido — por eso V1 incluye un campo opcional "Traducción".
 */

export const bugReporter = {
  // ── FAB ──────────────────────────────────────────────────
  "bug.fab.aria": "Reportar un problema",
  "bug.fab.title": "Reportar un problema · arrastra para mover",
  "bug.fab.toggled_on": "Botón de reportes activado · Alt+B para ocultarlo",
  "bug.fab.toggled_off": "Botón de reportes oculto",
  "bug.fab.corner_label_top_left": "Arriba izquierda",
  "bug.fab.corner_label_top_right": "Arriba derecha",
  "bug.fab.corner_label_bottom_left": "Abajo izquierda",
  "bug.fab.corner_label_bottom_right": "Abajo derecha",
  "bug.fab.corner_menu_heading": "Mover botón a",
  "bug.fab.corner_menu_aria": "Mover botón de bugs a otra esquina",
  "bug.fab.corner_menu_tip": "Tip: arrastra el botón para moverlo.",
  "bug.fab.corner_menu_close": "Cerrar",
  "bug.fab.drag_target_here": "Aquí",

  // ── Modal · header ───────────────────────────────────────
  "bug.modal.title": "Reportar",
  "bug.modal.subtitle":
    "Estás en {module}. Adjuntamos URL + entorno técnico automáticamente.",
  "bug.modal.close_aria": "Cerrar",

  // ── Modal · success view ─────────────────────────────────
  "bug.modal.success_new": "Reporte recibido",
  "bug.modal.success_duplicated": "Ya estaba reportado",
  "bug.modal.success_new_desc": "Tu bug es {folio}. Te avisamos cuando avancemos.",
  "bug.modal.success_duplicated_desc":
    "Sumamos al contador del bug {folio}. Gracias por avisar.",

  // ── Modal · form ─────────────────────────────────────────
  "bug.modal.category_legend": "Tipo de reporte",
  "bug.modal.category_aria": "Categoría",
  "bug.modal.severity_legend": "Severidad",
  "bug.modal.severity_aria": "Severidad",
  "bug.modal.title_label": "Título",
  "bug.modal.title_placeholder": "Resumen corto del problema",
  "bug.modal.description_label": "Descripción",
  "bug.modal.description_placeholder":
    "Qué intentabas hacer, qué pasó, qué esperabas que pasara.",
  "bug.modal.translation_label": "Traducción al español (opcional)",
  "bug.modal.translation_placeholder":
    "Si lo escribiste en chino, traduce título y descripción acá para que el equipo VE lo accione más rápido.",
  "bug.modal.attached_label_module": "Módulo:",
  "bug.modal.attached_label_url": "URL:",
  "bug.modal.attached_label_build": "Build:",

  // ── Modal · footer ───────────────────────────────────────
  "bug.modal.cancel": "Cancelar",
  "bug.modal.submit_idle": "Enviar reporte",
  "bug.modal.submit_loading": "Enviando…",

  // ── Categorías ───────────────────────────────────────────
  "bug.category.error": "Error",
  "bug.category.improve": "Mejora",
  "bug.category.suggest": "Sugerencia",
  "bug.category.question": "Pregunta",

  // ── Severidades ──────────────────────────────────────────
  "bug.severity.baja": "Baja",
  "bug.severity.media": "Media",
  "bug.severity.alta": "Alta",
  "bug.severity.critica": "Crítica",
} as const satisfies Record<string, string>;

export type BugReporterDict = Record<keyof typeof bugReporter, string>;
