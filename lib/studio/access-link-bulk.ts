/**
 * Orquestación del envío de enlaces de acceso en lote (SDD-0274 · Slice 4).
 *
 * VIVE ACÁ Y NO EN `actions.ts` POR DOS MOTIVOS, y los dos importan:
 *
 * 1. **Un archivo `"use server"` sólo puede exportar funciones async.** El tope
 *    y el tipo del resultado son un `const` y una `interface`; exportarlos
 *    desde la server action reventaría el build de Next.
 * 2. **La lógica que vale la pena probar es la orquestación**, no el envío. El
 *    lote recibe la función que manda uno y decide el resto: deduplicar, cortar
 *    por el tope antes de mandar nada, no detenerse en el primer fallo y
 *    devolver un veredicto por destinatario. Con el envío inyectado eso se
 *    prueba sin tocar Supabase, sin correos y sin dobles de cuatro capas.
 */

/** Techo del lote. Por encima, el admin manda en tandas y lo ve venir. */
export const ACCESS_LINK_BULK_MAX = 25;

export interface BulkAccessResult {
  userId: string;
  ok: boolean;
  error?: string;
}

/** Lo mínimo que el orquestador necesita saber del envío individual. */
type ResultadoDeEnvio = { ok?: boolean; error?: string; errorCode?: string };

export async function orquestarLoteDeAcceso(
  userIds: string[],
  enviarUno: (userId: string) => Promise<ResultadoDeEnvio>,
): Promise<{ resultados: BulkAccessResult[]; error?: string }> {
  const objetivos = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];

  if (objetivos.length === 0) {
    return { resultados: [], error: "No seleccionaste a nadie." };
  }
  // El tope se mira ANTES del bucle: cortar a mitad de camino ya habría
  // mandado correos que nadie pidió.
  if (objetivos.length > ACCESS_LINK_BULK_MAX) {
    return {
      resultados: [],
      error: `Son ${objetivos.length} personas y el máximo por tanda es ${ACCESS_LINK_BULK_MAX}. Filtra y manda por partes.`,
    };
  }

  const resultados: BulkAccessResult[] = [];
  for (const userId of objetivos) {
    // Secuencial a propósito: en paralelo se le tira el rate limit encima al
    // proveedor de correo, y con ≤25 destinatarios no se gana nada.
    //
    // Y sin `break`: un rebote NO puede dejar sin enviar a los que siguen.
    // Ese es justo el caso que un lote mal hecho esconde detrás de un "listo".
    const res = await enviarUno(userId);
    resultados.push({
      userId,
      ok: res.ok === true,
      error: res.ok === true ? undefined : (res.error ?? "No se pudo enviar."),
    });
  }

  return { resultados };
}
