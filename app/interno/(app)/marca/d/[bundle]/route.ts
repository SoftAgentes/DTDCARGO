/**
 * Descargas en .zip del hub de marca (`/interno/marca/d/<bundle>`).
 *
 * Arma el paquete al vuelo con fflate y lo stream-ea. GATEADO: los route handlers
 * NO pasan por el layout-guard, así que verifica `getUser()` acá mismo.
 *
 * Bundles: `logos` (4 isologos + OG + favicon) · `whatsapp` (las 2 herramientas +
 * el doc canónico + logos) · `todo` (todo lo anterior + el Brand Book).
 *
 * Lee de disco (process.cwd()); para prod, `outputFileTracingIncludes` en
 * next.config incluye estos archivos en el bundle de la función.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const ROOT = process.cwd();
const abs = (rel: string) => path.join(ROOT, rel);

// [nombre en el zip, ruta relativa al root del repo]
const LOGOS: ReadonlyArray<readonly [string, string]> = [
  ["dtdcargo-isologo-primary.png", "public/brand/dtdcargo-isologo-primary.png"],
  ["dtdcargo-isologo-reverse.png", "public/brand/dtdcargo-isologo-reverse.png"],
  ["dtdcargo-isologo-mono-light.png", "public/brand/dtdcargo-isologo-mono-light.png"],
  ["dtdcargo-isologo-mono-dark.png", "public/brand/dtdcargo-isologo-mono-dark.png"],
  ["og-image.png", "public/brand/og-image.png"],
  ["favicon-32.png", "public/brand/favicon-32.png"],
];

const WHATSAPP: ReadonlyArray<readonly [string, string]> = [
  ["whatsapp-catalogo-plantillas.html", "public/marca/herramientas/whatsapp-catalogo-plantillas.html"],
  ["whatsapp-business-guia.html", "public/marca/herramientas/whatsapp-business-guia.html"],
  ["whatsapp-business.md", "docs/marketing/whatsapp-business.md"],
  ["logo-primary.png", "public/brand/dtdcargo-isologo-primary.png"],
  ["logo-reverse.png", "public/brand/dtdcargo-isologo-reverse.png"],
];

const BRAND_BOOK: readonly [string, string] = [
  "brand-book-v3.7.html",
  "public/marca/brand-book-v3.7.html",
];

const BUNDLES: Record<
  string,
  { filename: string; files: ReadonlyArray<readonly [string, string]> }
> = {
  logos: { filename: "dtd-logos", files: LOGOS },
  whatsapp: { filename: "dtd-whatsapp-business-services", files: WHATSAPP },
  todo: { filename: "dtd-kit-de-marca", files: [...LOGOS, BRAND_BOOK, ...WHATSAPP] },
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
  for (const [name, rel] of def.files) {
    try {
      entries[name] = new Uint8Array(await readFile(abs(rel)));
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
