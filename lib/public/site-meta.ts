/**
 * Título y descripción por defecto del sitio público.
 *
 * Viven aquí y no en `app/layout.tsx` porque la portada los necesita también para
 * su nodo `WebPage` (JSON-LD), y un `layout.tsx` de Next solo puede exportar sus
 * campos reservados. Una sola fuente: si cambia el texto, cambia en los dos
 * lugares a la vez. Sin imports: lo puede usar cualquier página pública.
 */
export const SITE_TITLE = "DTD Cargo — Con Confianza, de China a tu puerta.";

export const SITE_DESCRIPTION =
  "Logística de punta a punta China → Venezuela desde 2015. Carga puerta a puerta todo incluido (DDP), agente de compra, inspección de fábrica. Equipo propio Yiwu/Valencia.";
