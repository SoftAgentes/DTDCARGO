/**
 * Academia DTD — contenido de la landing pública (SDD-0093, Fase 3 · teaser).
 *
 * Datos ESTÁTICOS de marketing: el sitio público vive afuera del ERP (frontera
 * dura), así que la cara pública NO consulta academy_courses por DB — muestra el
 * catálogo "Próximamente" como contenido editorial. Cuando el ERP exponga un
 * endpoint público de cursos, esto se reemplaza por un fetch (patrón de
 * lib/public/*). Por ahora, copy curado y estable.
 *
 * Norte estratégico (principio rector): la Academia es el ANZUELO de captación,
 * no el negocio. El copy enseña el "hazlo tú mismo" y puentea al servicio DTD
 * (puerta a puerta) — la lealtad es a la marca DTD, no a una cara.
 */

export type AcademiaNivel = "Gratis" | "Inicial" | "Core" | "Complemento";

export interface AcademiaCurso {
  slug: string;
  titulo: string;
  gancho: string;
  nivel: AcademiaNivel;
  /** Meta corta (duración / formato) para la tarjeta. */
  meta: string;
  /** Curso gratis (lead magnet) — realce verde. */
  gratis?: boolean;
  /** Programa insignia — realce. */
  insignia?: boolean;
}

/** Los 4 cursos del value ladder (mismos títulos que el seed del ERP). */
export const ACADEMIA_CURSOS: AcademiaCurso[] = [
  {
    slug: "guia-rapida",
    titulo: "Importar desde China: Guía Rápida para Venezolanos",
    gancho:
      "El camino completo de un vistazo: del primer clic a tu mercancía en la puerta. Para perderle el miedo y arrancar.",
    nivel: "Gratis",
    meta: "Curso 0 · gratis · ~45 min",
    gratis: true,
  },
  {
    slug: "domina-yiwu",
    titulo: "Domina Yiwu: De la Pantalla al Contenedor",
    gancho:
      "Tu primera importación de prueba, sin intermediarios: elegir producto, verificar al proveedor, negociar y calcular si te deja ganancia.",
    nivel: "Inicial",
    meta: "Curso 1 · ~26 lecciones",
  },
  {
    slug: "de-0-a-contenedor",
    titulo: "De 0 a Contenedor en 4 Semanas",
    gancho:
      "El programa insignia. Cohorte en vivo de 4 semanas para llevar tu primer contenedor del cero a embarcado, con acompañamiento.",
    nivel: "Core",
    meta: "Curso 2 · cohorte 4 semanas + sesiones en vivo",
    insignia: true,
  },
  {
    slug: "masterclass-1688",
    titulo: "MasterClass 1688: Compra como los chinos",
    gancho:
      "Compra directa en 1688 (30-50% más barato que Alibaba) y cómo DTD resuelve la fricción de pago y envío interno en China.",
    nivel: "Complemento",
    meta: "Masterclass · ~7 lecciones",
  },
];

/** Lo que el alumno logra (bloque de beneficios del hero). */
export const ACADEMIA_LOGROS: { titulo: string; detalle: string }[] = [
  {
    titulo: "Comprar sin intermediarios",
    detalle: "Proveedores, MOQ, muestras y precio real — directo en Alibaba y 1688.",
  },
  {
    titulo: "Traer puerta a puerta",
    detalle: "CBM, consolidación y aduana de Venezuela sin sustos ni sorpresas.",
  },
  {
    titulo: "Hacerlo con respaldo",
    detalle: "La operación real de DTD en Yiwu y Valencia detrás de cada paso.",
  },
];
