/**
 * Armado del .zip de descarga del centro de marca (SDD-0238). SOLO SERVIDOR.
 *
 * Compartido por las dos rutas que empaquetan —`/api/marca/bundle/[section]` y
 * `/api/marca/seleccion`— porque son el mismo trabajo con distinta lista de
 * entrada, y tenerlo dos veces garantizaba que una de las dos se quedara atrás.
 *
 * SI FALTA UN ARCHIVO, EL ZIP LO DICE. El zip viejo del hub interno
 * (`/interno/marca/d/[bundle]`) se comía en silencio los archivos que no
 * encontraba: bajabas un paquete que parecía completo y le faltaban piezas. Acá
 * los ausentes van nombrados en un `_FALTANTES.txt` adentro.
 */

import "server-only";
import { zipSync, type Zippable } from "fflate";
import { createAdminClient } from "@/lib/db/admin";
import type { BrandAsset } from "./catalog-types";

const BUCKET = "brand-assets";

/**
 * Tope del paquete armado en memoria. El bucket admite 200 MB por archivo, pero
 * `zipSync` mantiene todo en RAM y la función tiene su límite. Pasado esto se
 * responde 413 con una instrucción útil, en vez de morir con un out-of-memory
 * que el usuario ve como "la descarga falló".
 */
export const MAX_BUNDLE_BYTES = 180 * 1024 * 1024;

/** Evita que dos assets con el mismo nombre se pisen dentro del zip. */
function uniqueName(taken: Set<string>, name: string): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (taken.has(`${stem}-${i}${ext}`)) i++;
  const out = `${stem}-${i}${ext}`;
  taken.add(out);
  return out;
}

/**
 * `Uint8Array<ArrayBuffer>` y no `Uint8Array` a secas: el tipo por defecto es
 * `Uint8Array<ArrayBufferLike>`, que incluye `SharedArrayBuffer` y por eso NO
 * satisface `BodyInit`. Con el genérico explícito, la respuesta lo acepta.
 */
export type ZipResult =
  | { ok: true; body: Uint8Array<ArrayBuffer> }
  | { ok: false; status: 413 | 502; message: string };

/** Suma de lo declarado en la DB, para rechazar ANTES de bajar nada. */
export function declaredBytes(assets: BrandAsset[]): number {
  return assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);
}

export async function buildBrandZip(assets: BrandAsset[]): Promise<ZipResult> {
  if (declaredBytes(assets) > MAX_BUNDLE_BYTES) {
    return {
      ok: false,
      status: 413,
      message:
        "El paquete es muy pesado para bajarlo de una. Descarga menos archivos por vez.",
    };
  }

  const storage = createAdminClient().storage.from(BUCKET);
  const entries: Zippable = {};
  const taken = new Set<string>();
  const missing: string[] = [];

  // Secuencial a propósito: en paralelo, una sección de 40 archivos abre 40
  // conexiones a Storage y la función se queda sin sockets antes que sin tiempo.
  for (const asset of assets) {
    const name = uniqueName(taken, asset.storagePath.split("/").pop() ?? asset.id);
    try {
      const { data, error } = await storage.download(asset.storagePath);
      if (error || !data) {
        missing.push(`${asset.title} (${name})`);
        continue;
      }
      entries[name] = new Uint8Array(await data.arrayBuffer());
    } catch {
      missing.push(`${asset.title} (${name})`);
    }
  }

  if (Object.keys(entries).length === 0) {
    return {
      ok: false,
      status: 502,
      message: "No se pudo leer ningún archivo del paquete.",
    };
  }

  if (missing.length > 0) {
    entries["_FALTANTES.txt"] = new TextEncoder().encode(
      [
        "Estos archivos del catálogo no se pudieron incluir en el paquete:",
        "",
        ...missing.map((m) => `  · ${m}`),
        "",
        "Escríbele al equipo de DTD Cargo para que los reponga.",
      ].join("\n"),
    );
  }

  // Copia a un buffer propio: `zipSync` puede devolver una vista sobre un
  // buffer mayor, y `Content-Length` se calcula sobre el byteLength de la vista.
  const zipped = zipSync(entries, { level: 6 });
  const body = new Uint8Array(zipped.length);
  body.set(zipped);
  return { ok: true, body };
}

/** Headers de una respuesta .zip de descarga. */
export function zipHeaders(filename: string, byteLength: number) {
  return {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}.zip"`,
    "Content-Length": String(byteLength),
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
