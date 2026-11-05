/**
 * lib/i18n/es-VE/guide.ts · Guía «Antes en Kommo → Ahora aquí» (SDD-0589,
 * paso 9.2 del programa SDD-0582).
 *
 * Textos del motor (`guide.chrome.*`) y del recorrido de demostración
 * (`guide.dashboard.*`), copiados del guion aceptado de 9.1
 * (`docs/specs/0582-chatwoot-piloto/guia-guion.md`). Los recorridos por rol
 * (Bandeja, Embudo, Ficha DTD, IA, Usuarios, Actualizaciones) los agrega 9.5.
 *
 * Cada tarjeta tiene una clave base con cuatro sufijos: `.title`, `.what`,
 * `.before` (opcional: sin ella no se muestra «Antes en Kommo») y `.now`.
 */

export const guide = {
  // ── Controles del motor (guion 9.1, «Controles de la guía») ──
  "guide.chrome.toggle": "Guía",
  "guide.chrome.toggle_on_aria": "Mostrar la guía de esta pantalla",
  "guide.chrome.toggle_off_aria": "Ocultar la guía",
  "guide.chrome.welcome.title": "Así se hace ahora lo que hacías en Kommo",
  "guide.chrome.welcome.body":
    "Te mostramos cada tarea en pocos pasos. Puedes cerrarla cuando quieras y volver con el botón «Guía».",
  "guide.chrome.next": "Siguiente",
  "guide.chrome.prev": "Anterior",
  "guide.chrome.close": "Cerrar",
  "guide.chrome.step_of": "{n} de {total}",
  "guide.chrome.label_before": "Antes en Kommo",
  "guide.chrome.label_now": "Ahora aquí",
  "guide.chrome.dont_show": "No volver a mostrar",
  "guide.chrome.resume": "Seguir donde quedaste",
  "guide.chrome.restart": "Ver la guía desde el principio",
  "guide.chrome.missing_target":
    "Esta parte cambió de lugar. Sigue con el próximo paso.",
  // Agregadas en 9.2 (no estaban en el guion): cierre del último paso,
  // nombre de la tarjeta para el lector de pantalla y anuncio del paso.
  "guide.chrome.done": "Terminar",
  "guide.chrome.close_aria": "Cerrar la guía",
  "guide.chrome.card_aria": "Guía de la pantalla",
  "guide.chrome.announce": "Guía, paso {n} de {total}: {title}",
  "guide.chrome.closed": "Guía cerrada",

  // ── Recorrido de demostración · Dashboard (9.2) ──
  "guide.dashboard.welcome.title": "Tu inicio en Studio",
  "guide.dashboard.welcome.what":
    "Es la primera pantalla al entrar: el saludo, la fecha y la empresa con la que operas.",
  "guide.dashboard.welcome.now":
    "Desde aquí vas a cada módulo con el menú de la izquierda.",
  "guide.dashboard.kpis.title": "Los números del día",
  "guide.dashboard.kpis.what":
    "Cada tarjeta resume un indicador de la operación. Solo ves los que tu rol puede ver.",
  "guide.dashboard.kpis.now":
    "Revísalos al entrar. Si un indicador todavía no tiene datos, aparece con una raya.",
  "guide.dashboard.configure.title": "Elige qué ver",
  "guide.dashboard.configure.what":
    "Tú decides qué indicadores y paneles aparecen y en qué orden.",
  "guide.dashboard.configure.now":
    "Pulsa Configurar, activa lo que quieras ver y ordénalo. Se guarda solo.",
  "guide.dashboard.panels.title": "Tus paneles",
  "guide.dashboard.panels.what":
    "Debajo de los números van los paneles que activaste, como la actividad reciente.",
  "guide.dashboard.panels.now":
    "Entra a cada registro desde su panel. Si no ves ninguno, actívalo en Configurar.",
} as const satisfies Record<string, string>;

export type GuideDict = Record<keyof typeof guide, string>;
