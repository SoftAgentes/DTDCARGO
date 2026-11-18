import type { Page } from "@playwright/test";

/**
 * Evita que el `next dev` del e2e recargue una página a mitad de una prueba.
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * El cliente de HMR recarga la página cuando recibe un `sync` con un hash
 * distinto al del último `sync` (`next/dist/client/dev/hot-reloader/app/web-socket.js`,
 * líneas 86-92 en Next 16.2.11). Lo pensaron para detectar un servidor reiniciado.
 * Pero el servidor le manda `sync` a TODAS las páginas abiertas cada vez que se
 * conecta una nueva (`server/dev/hot-middleware.js`), y ese hash cambia con cada
 * compilación. Así que, con varios workers en la primera pasada por las rutas:
 *
 *   1. la página de esta prueba abre y recibe `sync` con el hash A;
 *   2. otro worker visita una ruta sin compilar: `built` con el hash B;
 *   3. otro worker abre una página: llega `sync` con B y esta página se recarga.
 *
 * Si en ese momento había una navegación en curso, se pierde: el pedido RSC muere
 * con `ERR_ABORTED`, la URL sigue en `/` y nadie vuelve a pulsar. Medido el
 * 2026-11-02 sobre `sin-scroll-horizontal.spec.ts` con 8 workers: el `GET /` del
 * documento sale en el mismo milisegundo que el `sync`, en los dos intentos. Con
 * un worker no pasa, porque nadie compila ni se conecta mientras la prueba espera.
 *
 * Producción no tiene HMR, así que descartar el `sync` deja a la página como la ve
 * un cliente real. El resto de los mensajes pasa igual, incluidos los `built` y el
 * canal de depuración de React.
 *
 * Llámalo ANTES del primer `goto`. Sin HMR (un destino de producción) no hace nada.
 */
export async function evitarRecargaDeHmr(page: Page): Promise<void> {
  await page.routeWebSocket(/\/_next\/webpack-hmr/, (ws) => {
    const servidor = ws.connectToServer();
    servidor.onMessage((mensaje) => {
      if (!esSync(mensaje)) ws.send(mensaje);
    });
  });
}

function esSync(mensaje: string | Buffer): boolean {
  if (typeof mensaje !== "string") return false;
  try {
    return (JSON.parse(mensaje) as { type?: unknown }).type === "sync";
  } catch {
    return false;
  }
}
