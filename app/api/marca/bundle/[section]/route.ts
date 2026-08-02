/**
 * Descarga de una SECCIÓN entera del brand book en .zip (SDD-0238).
 *
 * Es el botón "Descargar todos los logos" que pidió el founder al pie de cada
 * sección. `section` es el slug (`logos`, `tipografia`, …) o `todo` para el kit
 * completo.
 *
 * DIFERENCIA CON EL ZIP VIEJO (`/interno/marca/d/[bundle]`): aquel arma paquetes
 * FIJOS listados en el código y **se come en silencio** los archivos que no
 * encuentra — bajas un zip que parece bien y le faltan piezas. Acá el contenido
 * sale del catálogo, y si algún archivo no se pudo leer, el zip incluye un
 * `_FALTANTES.txt` que los nombra. Un paquete incompleto que lo dice es
 * recuperable; uno que calla, no.
 */

import { NextResponse } from "next/server";
import { zipSync, type Zippable } from "fflate";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { assetsForBundle } from "@/lib/marca/catalog-queries";
import { createAdminClient } from "@/lib/db/admin";

export const runtime = "nodejs";

/**
 * Tope del paquete armado en memoria. El bucket admite 200 MB por archivo, pero
 * `zipSync` mantiene todo en RAM y la función tiene su límite. Pasado esto se
 * responde 413 con instrucción de bajar por secciones, en vez de morir con un
 * out-of-memory que el usuario ve como "la descarga falló".
 */
const MAX_BUNDLE_BYTES = 180 * 1024 * 1024;

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  if (!(await hasBrandAccess())) {
    return new NextResponse("No autorizado.", { status: 401 });
  }

  const { section } = await params;
  const tenantId = await resolveBrandTenantId();
  if (!tenantId) return new NextResponse("No disponible.", { status: 503 });

  const bundle = await assetsForBundle(tenantId, section);
  if (!bundle) return new NextResponse("Sección no encontrada.", { status: 404 });
  if (bundle.assets.length === 0) {
    return new NextResponse("Esa sección todavía no tiene archivos.", { status: 404 });
  }

  const declared = bundle.assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);
  if (declared > MAX_BUNDLE_BYTES) {
    return new NextResponse(
      "El paquete completo es muy pesado para bajarlo de una. Descarga sección por sección.",
      { status: 413 },
    );
  }

  const storage = createAdminClient().storage.from("brand-assets");
  const entries: Zippable = {};
  const taken = new Set<string>();
  const missing: string[] = [];

  // Secuencial a propósito: en paralelo, una sección de 40 archivos abre 40
  // conexiones a Storage y la función se queda sin sockets antes que sin tiempo.
  for (const asset of bundle.assets) {
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
    return new NextResponse("No se pudo leer ningún archivo del paquete.", {
      status: 502,
    });
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

  const zipped = zipSync(entries, { level: 6 });
  const body = zipped.slice();

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dtd-${bundle.label}.zip"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
