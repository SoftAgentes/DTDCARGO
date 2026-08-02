/**
 * Sirve los HTML de marca (Brand Book + herramientas WhatsApp) desde el subárbol
 * privado, con el gate que corresponde A CADA UNO.
 *
 * Por qué existe: estos HTML vivían en `public/marca/` y Next los servía
 * ESTÁTICAMENTE a cualquiera por URL directa (no indexables, pero scrapeables).
 * Se movieron a `private/marca/` (fuera de `public/`, que Next no expone) y se
 * sirven solo acá, validando antes.
 *
 * DOS NIVELES DE ACCESO (SDD-0238). Antes todo exigía sesión del ERP; ahora
 * `/marca` se le puede pasar a un diseñador externo con un código, y no todo lo
 * que hay acá es para él:
 *   · `brand-book` → gate de `/marca` (sesión del ERP **o** código). Es
 *     justamente el material que se comparte.
 *   · `wa-catalogo` / `wa-guia` → SOLO sesión del ERP. Son herramientas
 *     operativas del equipo (plantillas del catálogo y configuración del perfil
 *     de WhatsApp Business), no material de marca para terceros.
 *
 * Headers: la ruta cae bajo `/marca/*`, así que next.config le aplica la CSP
 * relajada del Brand Book + `X-Frame-Options: SAMEORIGIN` (lo enmarca el visor) +
 * `X-Robots-Tag: noindex`. `outputFileTracingIncludes` incluye `./private/marca/**`
 * para que el fs.read funcione en el bundle de la función en Vercel.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@/lib/auth/session";
import { hasBrandAccess } from "@/lib/marca/access";
import { BRAND_BOOK_FILE } from "@/lib/marca/brand-book";

export const runtime = "nodejs";

type AssetDef = {
  /** Ruta relativa dentro de private/marca/. */
  file: string;
  /** `true` = basta el gate de /marca · `false` = exige sesión del ERP. */
  sharedWithDesigners: boolean;
};

// Whitelist cerrada a propósito (evita path traversal: solo estos 3 archivos se
// pueden pedir). El nombre del archivo del book sale de `lib/marca/brand-book.ts`
// para que un NORTE-SYNC toque un solo sitio.
const ASSETS: Record<string, AssetDef> = {
  "brand-book": { file: BRAND_BOOK_FILE, sharedWithDesigners: true },
  "wa-catalogo": {
    file: "herramientas/whatsapp-catalogo-plantillas.html",
    sharedWithDesigners: false,
  },
  "wa-guia": {
    file: "herramientas/whatsapp-business-guia.html",
    sharedWithDesigners: false,
  },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const def = ASSETS[name];
  // 404 antes de autorizar: el nombre no está en la whitelist, así que no hay
  // nada que autorizar y tampoco se revela si el gate habría pasado.
  if (!def) return new Response("No encontrado.", { status: 404 });

  const allowed = def.sharedWithDesigners
    ? await hasBrandAccess()
    : (await getUser()) !== null;
  if (!allowed) return new Response("No autorizado.", { status: 401 });

  let html: string;
  try {
    html = await readFile(
      path.join(process.cwd(), "private", "marca", def.file),
      "utf8",
    );
  } catch {
    return new Response("No encontrado.", { status: 404 });
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // CSP / X-Frame-Options / X-Robots-Tag los aplica next.config para `/marca/*`.
      "Cache-Control": "private, no-store",
    },
  });
}
