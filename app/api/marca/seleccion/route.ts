/**
 * Descarga de una SELECCIÓN armada por el visitante (SDD-0238).
 *
 * Es el "escoge qué quiere bajar y lo descarga" del pedido original: el
 * diseñador marca 4 archivos de 3 secciones distintas y se lleva un solo .zip.
 * Antes sólo se podía bajar de a uno o la sección completa — para llevarse tres
 * cosas sueltas había que bajar tres paquetes enteros.
 *
 * Los ids llegan del navegador, así que `assetsByIds` filtra además por
 * `tenant_id` y descarta lo que ya no exista. Nada de lo que llega se usa para
 * construir una ruta de Storage: el `storage_path` sale siempre de la DB.
 */

import { NextResponse } from "next/server";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { assetsByIds } from "@/lib/marca/catalog-queries";
import { buildBrandZip, zipHeaders } from "@/lib/marca/zip";

export const runtime = "nodejs";

/**
 * Tope de archivos por selección. No es una restricción de producto (para
 * llevarse todo está "Descargar todo"): es para que un `?ids=` fabricado a mano
 * no dispare miles de descargas de Storage en una sola petición.
 */
const MAX_IDS = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  if (!(await hasBrandAccess())) {
    return new NextResponse("No autorizado.", { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];

  if (ids.length === 0) {
    return new NextResponse("No seleccionaste ningún archivo.", { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return new NextResponse(
      `Son demasiados archivos de una. Usa "Descargar todo" o baja por secciones.`,
      { status: 400 },
    );
  }
  // Un id mal formado llegaría a Postgres y volvería como error de tipo uuid.
  if (ids.some((id) => !UUID.test(id))) {
    return new NextResponse("Selección inválida.", { status: 400 });
  }

  const tenantId = await resolveBrandTenantId();
  if (!tenantId) return new NextResponse("No disponible.", { status: 503 });

  const assets = await assetsByIds(tenantId, ids);
  if (assets.length === 0) {
    return new NextResponse(
      "Los archivos que seleccionaste ya no están disponibles. Recarga la página.",
      { status: 404 },
    );
  }

  const zip = await buildBrandZip(assets);
  if (!zip.ok) return new NextResponse(zip.message, { status: zip.status });

  return new NextResponse(zip.body, {
    headers: zipHeaders("dtd-seleccion", zip.body.byteLength),
  });
}
