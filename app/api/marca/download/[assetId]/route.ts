/**
 * Descarga de UN asset del brand book (SDD-0238).
 *
 * El navegador nunca habla con Storage directo: el bucket `brand-assets` es
 * privado y no tiene políticas para `authenticated`. Acá se valida el gate y se
 * firma una URL para esa clave exacta, con 60 s de vida.
 *
 * Los route handlers NO pasan por el layout ni por el gate de la página → la
 * validación se repite acá. Sin esto, `/api/marca/download/<id>` sería una
 * puerta abierta al lado del candado.
 *
 * `Content-Disposition: attachment` siempre: un `.svg` servido inline ejecuta el
 * script que traiga adentro en nuestro propio origen. Como adjunto, se baja.
 */

import { NextResponse } from "next/server";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { findBrandAsset } from "@/lib/marca/catalog-queries";
import { createAdminClient } from "@/lib/db/admin";

export const runtime = "nodejs";

/**
 * Los únicos MIME que se pueden servir INLINE (para la miniatura de la ficha).
 * SVG queda fuera a propósito: es XML con `<script>` permitido, y servirlo inline
 * en nuestro origen sería XSS almacenado — cualquiera con acceso al ERP podría
 * subir uno. Un SVG se descarga, no se previsualiza.
 */
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  if (!(await hasBrandAccess())) {
    return new NextResponse("No autorizado.", { status: 401 });
  }

  const { assetId } = await params;
  // Sin esto, un id mal formado llega a Postgres y devuelve un 500 con el texto
  // del error de tipo uuid — ruido innecesario en los logs.
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) {
    return new NextResponse("No encontrado.", { status: 404 });
  }

  const tenantId = await resolveBrandTenantId();
  if (!tenantId) return new NextResponse("No disponible.", { status: 503 });

  const asset = await findBrandAsset(tenantId, assetId);
  if (!asset) return new NextResponse("No encontrado.", { status: 404 });

  const filename = asset.storagePath.split("/").pop() ?? "archivo";
  const wantsPreview =
    new URL(req.url).searchParams.get("preview") === "1" &&
    asset.mime != null &&
    PREVIEWABLE.has(asset.mime);

  const { data, error } = await createAdminClient()
    .storage.from("brand-assets")
    .createSignedUrl(
      asset.storagePath,
      60,
      wantsPreview ? undefined : { download: filename },
    );

  if (error || !data?.signedUrl) {
    return new NextResponse("No se pudo preparar la descarga.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
