import { NextResponse } from "next/server";

/**
 * Redirección a una ruta propia desde un route handler, con `Location` relativo
 * (SDD-0602).
 *
 * El navegador la resuelve contra la URL que tiene abierta, así que sale bien en
 * cualquier dominio y no depende de lo que el servidor crea que es su host. Eso
 * importa porque `request.url` no sirve para armar un destino: en el contenedor
 * (`HOSTNAME=0.0.0.0`, `Dockerfile`) Next lo arma con la dirección donde escucha,
 * y `NextResponse.redirect(new URL(ruta, req.url))` manda al navegador a
 * `https://0.0.0.0:3000`. Medido en producción el 2026-11-04. `proxy.ts` no lo
 * sufre porque Next deja relativo el `Location` de sus redirecciones.
 *
 * Solo acepta rutas propias: nada de `https://…`, y tampoco `//otro.test` ni
 * `/\otro.test`, que el navegador lee como otro dominio. Los espacios también
 * quedan fuera, porque quita tabs y saltos de línea antes de resolver.
 */
export function localRedirect(path: string, status: 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) {
    throw new Error("localRedirect solo acepta una ruta propia.");
  }
  return new NextResponse(null, { status, headers: { Location: path } });
}
