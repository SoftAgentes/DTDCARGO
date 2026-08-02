/**
 * Descargas en .zip del hub de marca (`/interno/marca/d/<bundle>`).
 *
 * Arma el paquete al vuelo con fflate y lo stream-ea. GATEADO: los route handlers
 * NO pasan por el layout-guard, así que verifica `getUser()` acá mismo.
 *
 * Bundles: `logos` (4 isologos + OG + favicon) · `whatsapp` (las 2 herramientas +
 * el doc canónico + logos) · `todo` (todo lo anterior). El Brand Book se bajó de
 * acá cuando salió de git a Storage — se descarga desde `/marca`.
 *
 * Lee de disco (process.cwd()); para prod, `outputFileTracingIncludes` en
 * next.config incluye estos archivos en el bundle de la función.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

type AssetRoot = "brand" | "marca" | "marketing";
type BundleFile = readonly [name: string, root: AssetRoot, relativePath: string];

function assetPath(root: AssetRoot, relativePath: string): string {
  switch (root) {
    case "brand":
      return path.join(process.cwd(), "public", "brand", relativePath);
    case "marca":
      return path.join(process.cwd(), "private", "marca", relativePath);
    case "marketing":
      return path.join(process.cwd(), "docs", "marketing", relativePath);
  }
}

// [nombre en el zip, raíz estática, ruta relativa dentro de esa raíz]
const LOGOS: ReadonlyArray<BundleFile> = [
  ["dtdcargo-isologo-primary.png", "brand", "dtdcargo-isologo-primary.png"],
  ["dtdcargo-isologo-reverse.png", "brand", "dtdcargo-isologo-reverse.png"],
  ["dtdcargo-isologo-mono-light.png", "brand", "dtdcargo-isologo-mono-light.png"],
  ["dtdcargo-isologo-mono-dark.png", "brand", "dtdcargo-isologo-mono-dark.png"],
  ["og-image.png", "brand", "og-image.png"],
  ["favicon-32.png", "brand", "favicon-32.png"],
];

const WHATSAPP: ReadonlyArray<BundleFile> = [
  ["whatsapp-catalogo-plantillas.html", "marca", "herramientas/whatsapp-catalogo-plantillas.html"],
  ["whatsapp-business-guia.html", "marca", "herramientas/whatsapp-business-guia.html"],
  ["whatsapp-business.md", "marketing", "whatsapp-business.md"],
  ["logo-primary.png", "brand", "dtdcargo-isologo-primary.png"],
  ["logo-reverse.png", "brand", "dtdcargo-isologo-reverse.png"],
];

/**
 * El Brand Book YA NO VIAJA EN ESTOS PAQUETES (founder, 2026-08-02).
 *
 * Salió de git a Supabase Storage por peso (cada versión son 15-27 MB
 * permanentes), así que acá no hay disco de dónde leerlo. Su descarga vive
 * ahora en `/marca`, que lo baja del bucket — y de paso es la superficie que
 * de verdad se comparte con diseño.
 *
 * Importa que esto quede explícito: el bucle de abajo se come en silencio los
 * archivos que no encuentra, así que dejar la entrada apuntando a un archivo
 * borrado no habría fallado — habría producido un "kit de marca" sin el Brand
 * Book adentro, y nadie se entera hasta que el diseñador lo abre.
 */
const BUNDLES: Record<
  string,
  { filename: string; files: ReadonlyArray<BundleFile> }
> = {
  logos: { filename: "dtd-logos", files: LOGOS },
  whatsapp: { filename: "dtd-whatsapp-business-services", files: WHATSAPP },
  todo: { filename: "dtd-kit-de-marca", files: [...LOGOS, ...WHATSAPP] },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bundle: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("No autorizado.", { status: 401 });

  const { bundle } = await params;
  const def = BUNDLES[bundle];
  if (!def) return new Response("Paquete no encontrado.", { status: 404 });

  const entries: Record<string, Uint8Array> = {};
  // Deduplicar por nombre (el bundle "todo" puede repetir logos): el último gana.
  for (const [name, root, relativePath] of def.files) {
    try {
      entries[name] = new Uint8Array(await readFile(assetPath(root, relativePath)));
    } catch {
      // Si falta un archivo no rompemos toda la descarga; se omite.
    }
  }

  if (Object.keys(entries).length === 0) {
    return new Response("No se pudo armar el paquete.", { status: 500 });
  }

  const zipped = zipSync(entries, { level: 6 });
  // Copia a un ArrayBuffer "limpio" para el BodyInit.
  const body = zipped.slice();

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${def.filename}.zip"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
