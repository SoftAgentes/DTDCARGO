/**
 * SDD-0654 fase 2 · Recorridos de la Vista simple (§6.2, AC-15).
 *
 * Dos recorridos con el mismo motor:
 *   · la guía de las primeras veces: bienvenida, 4 consejos, «¿Quieres
 *     continuar?» y 2 consejos opcionales;
 *   · el tutorial del código (6 pasos), que se abre desde el bloque 5.
 *
 * Cada paso apunta a un ancla `[data-guia="…"]` de la pantalla, o a ninguna
 * (tarjeta centrada). Los textos son los de la maqueta aprobada. Faro del
 * cliente es de la fase 3 y nace apagado: mientras no exista, el cuarto consejo
 * apunta al chat con el asesor (bloque 6), no a Faro.
 */

export type PasoGuia = {
  /** Selector CSS del ancla que se resalta; null = tarjeta centrada. */
  ancla: string | null;
  /** Línea chica de arriba: «Consejo 1 de 4», «Paso 2 de 6». */
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Texto del botón que avanza; por omisión «Siguiente». */
  siguiente?: string;
};

export type Recorrido = {
  id: "primeras-veces" | "tutorial-codigo";
  pasos: readonly PasoGuia[];
  /** Pregunta al final de `pasos`; si se acepta, siguen los `extra`. */
  continuar?: { etiqueta: string; titulo: string; texto: string; si: string; no: string };
  extra?: readonly PasoGuia[];
};

export const ancla = (nombre: string) => `[data-guia="${nombre}"]`;

/** El botón de tema de la barra (no lleva ancla propia: se busca por su nombre). */
export const ANCLA_TEMA =
  'button[aria-label="Cambiar a modo oscuro"], button[aria-label="Cambiar a modo claro"]';

export const GUIA_PRIMERAS_VECES: Recorrido = Object.freeze({
  id: "primeras-veces",
  pasos: Object.freeze([
    {
      ancla: null,
      etiqueta: "Bienvenida",
      titulo: "Te mostramos tu portal en 1 minuto",
      texto: "Son 4 consejos cortos. Puedes saltarlos y repetirlos después con el botón «Guía».",
      siguiente: "Empezar",
    },
    {
      ancla: ancla("donde"),
      etiqueta: "Consejo 1 de 4",
      titulo: "Aquí ves dónde está tu carga",
      texto: "Si tienes un envío en camino, aquí ves en qué va y cuándo se estima que llegue.",
    },
    {
      ancla: ancla("tareas"),
      etiqueta: "Consejo 2 de 4",
      titulo: "Aquí está lo que te toca hacer",
      texto: "Si falta un papel o un pago, aparece aquí con su botón. Al lado ves cuánto debes, siempre en dólares.",
    },
    {
      ancla: ancla("proveedor"),
      etiqueta: "Consejo 3 de 4",
      titulo: "Esto es lo que le mandas a tu proveedor",
      texto:
        "Eliges al proveedor y te damos el código y el mensaje listos para copiar. Hay un tutorial de 1 minuto dentro.",
    },
    {
      ancla: ancla("duda"),
      etiqueta: "Consejo 4 de 4",
      titulo: "Recuerda: tu asesor te ayuda",
      texto: "Si te queda una duda, escríbele por el chat. Para cambios en tu cuenta, tu asesor es la persona.",
    },
  ]),
  continuar: Object.freeze({
    etiqueta: "¿Quieres continuar?",
    titulo: "Ya sabes lo básico",
    texto: "Si quieres, te damos 2 consejos más para sacarle provecho al portal.",
    si: "Sí, 2 consejos más",
    no: "Listo por ahora",
  }),
  extra: Object.freeze([
    {
      ancla: ancla("vista"),
      etiqueta: "Consejo extra 1 de 2",
      titulo: "Aquí cambias de vista",
      texto:
        "La Vista Pro tiene todo el detalle: compras, cotizaciones, academia. Puedes volver a la simple cuando quieras. Toca «Comparar» para ver las diferencias.",
    },
    {
      ancla: ANCLA_TEMA,
      etiqueta: "Consejo extra 2 de 2",
      titulo: "Día o noche",
      texto: "El portal empieza en claro. Con este botón lo pasas a noche si te cansa la vista.",
      siguiente: "Terminar",
    },
  ]),
});

export const TUTORIAL_CODIGO: Recorrido = Object.freeze({
  id: "tutorial-codigo",
  pasos: Object.freeze([
    {
      ancla: ancla("proveedores"),
      etiqueta: "Paso 1 de 6",
      titulo: "Primero, elige a tu proveedor",
      texto:
        "Cada proveedor que registras recibe un número: 1, 2, 3… Ese número es suyo para siempre. Tócalo en tu lista.",
    },
    {
      ancla: ancla("codigo-dtd"),
      etiqueta: "Paso 2 de 6",
      titulo: "«DTD» va siempre",
      texto: "Todas nuestras cargas empiezan así. Le dice al almacén que la caja es de DTD Cargo.",
    },
    {
      ancla: ancla("codigo-cliente"),
      etiqueta: "Paso 3 de 6",
      titulo: "Tu número de cliente",
      texto: "Es solo tuyo y no cambia. Con «DTD» adelante forma tu Shipping Mark.",
    },
    {
      ancla: ancla("codigo-proveedor"),
      etiqueta: "Paso 4 de 6",
      titulo: "El número de tu proveedor",
      texto: "Sale de tu lista. Si el proveedor no está en la lista, regístralo antes de comprar. No lo inventes.",
    },
    {
      ancla: ancla("codigo-compra"),
      etiqueta: "Paso 5 de 6",
      titulo: "El número de la compra",
      texto:
        "Cuenta las veces que le has comprado a ese proveedor. Primera compra: 1. Segunda: 2. El portal lo calcula por ti.",
    },
    {
      ancla: ancla("mensaje"),
      etiqueta: "Paso 6 de 6",
      titulo: "Recuerda: mándaselo a tu proveedor",
      texto:
        "El mensaje ya trae la dirección del almacén y el código completo. Cópialo y pídele una foto de la caja marcada.",
      siguiente: "Terminar",
    },
  ]),
});
