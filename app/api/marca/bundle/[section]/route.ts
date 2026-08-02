/**
 * Descarga de una SECCIÓN entera del brand book en .zip (SDD-0238).
 *
 * Es el botón "Descargar los 6" del encabezado de cada sección. `section` es el
 * slug (`logos`, `tipografia`, …) o `todo` para el kit completo.
 *
 * El armado vive en `lib/marca/zip.ts`, compartido con `/api/marca/seleccion`.
 */

import { NextResponse } from "next/server";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { assetsForBundle } from "@/lib/marca/catalog-queries";
import { buildBrandZip, zipHeaders } from "@/lib/marca/zip";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  // Los route handlers NO pasan por el gate de la página → se revalida acá. Sin
  // esto sería una puerta abierta al lado del candado.
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

  const zip = await buildBrandZip(bundle.assets);
  if (!zip.ok) return new NextResponse(zip.message, { status: zip.status });

  return new NextResponse(zip.body, {
    headers: zipHeaders(`dtd-${bundle.label}`, zip.body.byteLength),
  });
}
