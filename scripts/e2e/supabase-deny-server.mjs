/**
 * SDD-0479 · Supabase sintético deny-only para el e2e local.
 *
 * Sin `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `proxy.ts`
 * no puede crear su cliente y las rutas de su matcher responden error. Este
 * servidor le da al `next dev` del e2e una URL local que existe y rechaza todo:
 *
 * - `GET /__health` responde 200 (Playwright lo espera antes de levantar Next);
 * - `OPTIONS` responde 204, para que un preflight CORS del navegador no quede
 *   colgado;
 * - todo lo demás, lecturas y escrituras de Auth, PostgREST, Storage o
 *   Realtime, responde 503 con un JSON corto.
 *
 * No habla con ninguna red externa, no guarda nada y no registra cuerpos,
 * cabeceras ni tokens: sólo escucha en 127.0.0.1. Es el de SDD-0320
 * (`8725a341`), que nunca llegó a main, con la ruta de salud compartida.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { RUTA_SALUD_SINTETICO } = require("../../e2e/_helpers/supabase-publico.cjs");

export const RESPUESTA_DENEGADA = Object.freeze({
  code: "E2E_SUPABASE_SINTETICO",
  message: "Supabase sintético deny-only: este e2e local no tiene Supabase real (SDD-0479).",
});

function cabecerasComunes(respuesta) {
  respuesta.setHeader("access-control-allow-headers", "*");
  respuesta.setHeader("access-control-allow-methods", "*");
  respuesta.setHeader("access-control-allow-origin", "*");
  respuesta.setHeader("cache-control", "no-store");
  respuesta.setHeader("content-type", "application/json; charset=utf-8");
}

export function crearServidorDenyOnly() {
  return createServer((pedido, respuesta) => {
    // El cuerpo no se lee ni se guarda: se descarta.
    pedido.resume();
    cabecerasComunes(respuesta);
    const ruta = String(pedido.url ?? "").split("?")[0];
    if (pedido.method === "GET" && ruta === RUTA_SALUD_SINTETICO) {
      respuesta.writeHead(200);
      respuesta.end(JSON.stringify({ mode: "deny-only", ok: true }));
      return;
    }
    if (pedido.method === "OPTIONS") {
      respuesta.writeHead(204);
      respuesta.end();
      return;
    }
    respuesta.writeHead(503);
    respuesta.end(JSON.stringify(RESPUESTA_DENEGADA));
  });
}

export function parsearPuerto(valor) {
  const puerto = Number(valor);
  if (!Number.isInteger(puerto) || puerto < 1_024 || puerto > 65_535) {
    throw new Error("El puerto del Supabase sintético debe ser un entero entre 1024 y 65535.");
  }
  return puerto;
}

function arrancarDesdeCli() {
  const puerto = parsearPuerto(process.argv[2]);
  const servidor = crearServidorDenyOnly();
  const cerrar = () => servidor.close(() => process.exit(0));
  process.once("SIGINT", cerrar);
  process.once("SIGTERM", cerrar);
  servidor.listen(puerto, "127.0.0.1", () => {
    process.stdout.write(`Supabase sintético deny-only en 127.0.0.1:${puerto} (SDD-0479)\n`);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  arrancarDesdeCli();
}
