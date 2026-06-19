/**
 * Sirve los HTML de marca (Brand Book + herramientas WhatsApp) GATEADOS por login.
 *
 * Por qué existe: estos HTML vivían en `public/marca/` y Next los servía
 * ESTÁTICAMENTE a cualquiera por URL directa (no indexables, pero scrapeables).
 * Se movieron a `private/marca/` (fuera de `public/`, que Next no expone) y se
 * sirven solo acá validando `getUser()` — mismo patrón que las descargas ZIP del
 * hub (`/interno/marca/d/[bundle]`). El gate es el `getUser()`, NO el prefijo de URL.
 *
 * Headers: la ruta cae bajo `/marca/*`, así que next.config le aplica la CSP
 * relajada del Brand Book + `X-Frame-Options: SAMEORIGIN` (lo enmarca el visor) +
 * `X-Robots-Tag: noindex`. `outputFileTracingIncludes` incluye `./private/marca/**`
 * para que el fs.read funcione en el bundle de la función en Vercel.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const ROOT = process.cwd();

// Whitelist: nombre público → ruta relativa en private/marca/. Cerrada a propósito
// (evita path traversal: solo estos 3 archivos se pueden pedir).
const ASSETS: Record<string, string> = {
  "brand-book": "private/marca/brand-book-v4.4.html",
  "wa-catalogo": "private/marca/herramientas/whatsapp-catalogo-plantillas.html",
  "wa-guia": "private/marca/herramientas/whatsapp-business-guia.html",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("No autorizado.", { status: 401 });

  const { name } = await params;
  const rel = ASSETS[name];
  if (!rel) return new Response("No encontrado.", { status: 404 });

  let html: string;
  try {
    html = await readFile(path.join(ROOT, rel), "utf8");
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
