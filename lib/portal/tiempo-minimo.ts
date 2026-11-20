/**
 * SDD-0672 · piso de tiempo de respuesta de `/entrar`.
 *
 * Condición del Director General para el cambio: el mismo tiempo de respuesta en
 * todos los casos. Mandar el enlace (acuñar y enviar) tarda más que «no
 * encontramos»; con el piso, los caminos rápidos esperan hasta el mismo mínimo.
 *
 * ⚠️ Límite, dicho sin adornos: desde la decisión de Sam («Decirlo en pantalla»)
 * la pantalla ya nombra el caso, así que hoy este piso no oculta nada que el texto
 * no diga. Queda como defensa para no reabrir un canal por tiempo si una pantalla
 * vuelve a ser común a varios casos, y para que el envío lento no se distinga
 * por cronómetro de los otros en los registros de quien mire desde afuera.
 *
 * Módulo propio para que las pruebas de la acción lo reemplacen: con el reloj
 * congelado, una espera real por pedido haría las suites lentas.
 */

/** Mínimo, en milisegundos, que tarda cualquier respuesta después de validar el correo. */
export const ENTRAR_TIEMPO_MINIMO_MS = 700;

/** Espera lo que falte para que, desde `inicio`, hayan pasado `minimoMs`. Nunca tira. */
export async function esperarTiempoMinimo(
  inicio: number,
  minimoMs: number = ENTRAR_TIEMPO_MINIMO_MS,
): Promise<void> {
  const falta = inicio + minimoMs - Date.now();
  if (falta <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, falta));
}
