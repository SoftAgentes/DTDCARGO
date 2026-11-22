/**
 * SDD-0654 fase 2 · Comparación «Vista simple o Vista Pro» (§6.1, AC-16).
 *
 * Es la tabla de la spec, en el texto que aprobó Sam en la maqueta. La abre el
 * botón «Comparar», que está junto al selector de vista en las dos vistas.
 */

export type FilaComparacion = {
  aspecto: string;
  simple: string;
  pro: string;
};

export const COMPARACION_TITULO = "Vista simple o Vista Pro: ¿cuál te conviene?";

export const COMPARACION_INTRO =
  "Son dos formas de ver la misma cuenta. Cambiar de vista no borra ni mueve nada, y puedes volver cuando quieras.";

export const COMPARACION_LEMAS = Object.freeze({
  simple: "Lo esencial, en una página",
  pro: "Todo el detalle, como hoy",
});

export const COMPARACION: readonly FilaComparacion[] = Object.freeze([
  {
    aspecto: "Para quién",
    simple: "Para quien empieza, entra de vez en cuando o solo quiere saber de su carga.",
    pro: "Para quien importa seguido, maneja varios proveedores y ya conoce el portal.",
  },
  {
    aspecto: "Qué ves",
    simple: "Una sola página con 6 bloques grandes. Siempre los mismos y en el mismo orden: nada se mueve.",
    pro: "Menú lateral con todas las secciones: envíos, compras, calculadora, finanzas, documentos, referidos, academia y soporte.",
  },
  {
    aspecto: "Qué haces",
    simple:
      "Ver dónde va tu carga, lo que te toca hacer, cuánto debes y tus papeles. Enviarle el código a tu proveedor. Preguntar.",
    pro: "Todo lo de la simple, y además: crear compras y cotizaciones, registrar proveedores, estado de cuenta, reclamos, perfil.",
  },
  {
    aspecto: "Qué se esconde",
    simple:
      "Cotizaciones, estimados, academia, referidos, club, indicadores y próxima salida. Siguen ahí, a un toque, en la Vista Pro.",
    pro: "Nada. Está todo.",
  },
  {
    aspecto: "Ventaja",
    simple: "Se entiende en un minuto. Pocos botones y grandes. Trae guía, consejos y las palabras explicadas.",
    pro: "Más herramientas y más detalle en cada pantalla. Más rápida para quien ya sabe dónde está cada cosa.",
  },
  {
    aspecto: "Ayuda",
    simple: "Guía paso a paso, consejos en cada bloque y tutorial del código.",
    pro: "El chat con tu asesor.",
  },
]);

/** Fila que vale para las dos vistas (va a lo ancho). */
export const COMPARACION_DATOS =
  "Tus datos son los mismos en las dos. Empiezas en una y pasas a la otra cuando quieras.";
