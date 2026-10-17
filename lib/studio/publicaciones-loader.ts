/**
 * Lee el estado de las publicaciones que deja el vigilante del servidor
 * (SDD-0547). Server-only: usa el disco del contenedor web.
 *
 * El archivo vive en el servidor, en una carpeta propia que el compose monta en
 * el contenedor web en solo lectura (cambio coordinado con la sesión de Contabo:
 * ver la spec). El contenedor no recibe el socket de Docker ni otra carpeta del
 * host. En local, en las pruebas y mientras el montaje no exista, el archivo no
 * está y la pantalla muestra «Sin datos»: nunca se cae.
 *
 * Se monta la CARPETA, no el archivo: el vigilante reemplaza el archivo con un
 * `mv` atómico, y un montaje de archivo suelto seguiría viendo el viejo.
 */

import { readFile, stat } from "node:fs/promises";
import {
  parseEstadoPublicaciones,
  type LecturaPublicaciones,
  type ResultadoEstadoPublicaciones,
} from "./publicaciones-types";

/** Ruta DENTRO del contenedor web (destino del montaje de solo lectura). */
export const RUTA_ESTADO_PUBLICACIONES =
  "/var/lib/dtd-cargo/publicacion/publicaciones.json";

/** 20 eventos con 50 migraciones cada uno ocupan unos 70 KB: sobra margen. */
export const MAX_BYTES_ESTADO_PUBLICACIONES = 128 * 1024;

async function leer(ruta: string): Promise<ResultadoEstadoPublicaciones> {
  let tam: number;
  try {
    const info = await stat(ruta);
    if (!info.isFile()) return { ok: false, motivo: "ilegible" };
    tam = info.size;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | null)?.code;
    return {
      ok: false,
      motivo: code === "ENOENT" || code === "ENOTDIR" ? "sin-archivo" : "ilegible",
    };
  }
  if (tam > MAX_BYTES_ESTADO_PUBLICACIONES) {
    return { ok: false, motivo: "demasiado-grande" };
  }

  let texto: string;
  try {
    texto = await readFile(ruta, "utf8");
  } catch {
    return { ok: false, motivo: "ilegible" };
  }
  // Puede haber cambiado entre `stat` y `readFile`.
  if (Buffer.byteLength(texto, "utf8") > MAX_BYTES_ESTADO_PUBLICACIONES) {
    return { ok: false, motivo: "demasiado-grande" };
  }

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "formato" };
  }
  return parseEstadoPublicaciones(json);
}

/**
 * Nunca lanza: cualquier problema vuelve como `{ ok: false, motivo }`.
 * `leidoEn` es la referencia de los tiempos relativos de la pantalla.
 */
export async function cargarEstadoPublicaciones(
  ruta: string = RUTA_ESTADO_PUBLICACIONES,
  reloj: () => number = Date.now,
): Promise<LecturaPublicaciones> {
  let resultado: ResultadoEstadoPublicaciones;
  try {
    resultado = await leer(ruta);
  } catch {
    resultado = { ok: false, motivo: "ilegible" };
  }
  return { ...resultado, leidoEn: reloj() };
}
