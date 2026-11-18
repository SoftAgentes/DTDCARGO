/**
 * SDD-0650 F1 · Reglas puras de la ficha del cliente. Sin red ni base: la página
 * (`app/studio/(app)/clientes/[markbox]/page.tsx`) las llama con lo que ya leyó.
 */

/** «Sin nombre» cuando la ficha no tiene nombre (sistema anterior, Kommo). */
export function nombreDeLaFicha(name: string | null | undefined): { texto: string; sinNombre: boolean } {
  const limpio = (name ?? "").trim();
  return limpio === "" ? { texto: "Sin nombre", sinNombre: true } : { texto: name as string, sinNombre: false };
}

/**
 * Acciones rápidas de la cabecera. Cada una aparece solo si el rol abre el
 * módulo de destino: un botón que rebota no es una acción.
 *
 * `conversaciones` es `null` sin acceso a la Bandeja (o con su flag apagado) y
 * viene ordenada por actividad: la primera es la más reciente.
 */
export function accionesRapidas(args: {
  markbox: string;
  puedeVerCotizaciones: boolean;
  conversaciones: readonly { conversation_id: number }[] | null;
}): { cotizacionesHref: string | null; chatHref: string | null } {
  const { markbox, puedeVerCotizaciones, conversaciones } = args;
  return {
    cotizacionesHref: puedeVerCotizaciones ? `/studio/cotizador?client=${encodeURIComponent(markbox)}` : null,
    chatHref:
      conversaciones && conversaciones.length > 0
        ? `/studio/bandeja?c=${conversaciones[0].conversation_id}`
        : null,
  };
}

/**
 * Los códigos de la ficha, cayendo al vigente si la cadena no se puede leer: la
 * ficha muestra lo de siempre en vez de caerse.
 */
export async function codigosConCaida(
  leer: () => Promise<string[]>,
  vigente: string,
): Promise<string[]> {
  try {
    const codigos = await leer();
    return codigos.length > 0 ? codigos : [vigente];
  } catch {
    return [vigente];
  }
}

/**
 * SDD-0669 · Pestañas de la ficha. La activa viaja en `?pestana=`. Solo vale
 * una de las que la página armó PARA ESTE ROL (`disponibles`): un valor
 * desconocido, vacío o de una pestaña que el rol no tiene cae en «resumen». Así
 * la URL nunca abre algo que la página no le pintó.
 */
export const PESTANAS_FICHA = ["resumen", "envios", "documentos", "configuracion"] as const;
export type IdPestanaFicha = (typeof PESTANAS_FICHA)[number];

export function pestanaDeLaFicha(
  valor: string | string[] | null | undefined,
  disponibles: readonly IdPestanaFicha[],
): IdPestanaFicha {
  const v = Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null);
  return disponibles.find((p) => p === v) ?? "resumen";
}

/** Cuántos envíos muestra el Resumen; el resto, en la pestaña Envíos. */
export const ENVIOS_EN_RESUMEN = 5;
