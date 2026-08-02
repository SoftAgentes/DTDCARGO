/**
 * Sirve los HTML de marca (Brand Book + herramientas WhatsApp) con el gate que
 * corresponde A CADA UNO.
 *
 * Por qué existe: estos HTML vivían en `public/marca/` y Next los servía
 * ESTÁTICAMENTE a cualquiera por URL directa (no indexables, pero scrapeables).
 * Se sacaron de `public/` y se sirven solo acá, validando antes.
 *
 * DOS ORÍGENES, por peso (founder, 2026-08-02):
 *   · **Brand Book → Supabase Storage.** Cada versión pesa 15-27 MB, y en git
 *     eso es permanente: el v4.6 solo ya son 14 MB versionados para siempre.
 *     Vive en el bucket privado `brand-assets`, se sube desde el HUB sin
 *     desplegar y se lee acá con el admin client (el bucket no tiene políticas
 *     para `authenticated`: el navegador nunca habla con Storage directo).
 *   · **Herramientas de WhatsApp → `private/marca/herramientas/`.** Son dos
 *     HTML chicos, operativos del equipo y versionados con el código que los
 *     genera. No hay razón para moverlos.
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
 * POR QUÉ SE TRANSMITE EL CUERPO Y NO SE REDIRIGE A LA URL FIRMADA (como sí hace
 * `/api/marca/download/[assetId]`): el book se consume dentro de un `<iframe>`.
 * Un redirect lo mandaría a `*.supabase.co`, y la CSP del visor no declara
 * `frame-src`, así que cae a `default-src 'self'` y el iframe queda en blanco.
 * Transmitiéndolo desde nuestro origen, el documento hereda la CSP relajada de
 * `/marca/*` que necesita para sus `data:` y sus fuentes de Google.
 *
 * Headers: la ruta cae bajo `/marca/*`, así que next.config le aplica esa CSP +
 * `X-Frame-Options: SAMEORIGIN` (lo enmarca el visor) + `X-Robots-Tag: noindex`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { findBrandBookAsset } from "@/lib/marca/catalog-queries";

export const runtime = "nodejs";

/** Herramientas internas: archivo dentro de `private/marca/`, sesión del ERP. */
const TOOLS: Record<string, string> = {
  "wa-catalogo": "herramientas/whatsapp-catalogo-plantillas.html",
  "wa-guia": "herramientas/whatsapp-business-guia.html",
};

/** Cabeceras comunes. `no-store` porque el contenido es privado por gate. */
const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // CSP / X-Frame-Options / X-Robots-Tag los aplica next.config para `/marca/*`.
  "Cache-Control": "private, no-store",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  if (name === "brand-book") return serveBrandBook();

  const file = TOOLS[name];
  // 404 antes de autorizar: el nombre no está en la whitelist, así que no hay
  // nada que autorizar y tampoco se revela si el gate habría pasado.
  if (!file) return new Response("No encontrado.", { status: 404 });

  if ((await getUser()) === null) {
    return new Response("No autorizado.", { status: 401 });
  }

  let html: string;
  try {
    // La whitelist evita el path traversal: sólo estos dos archivos se piden.
    html = await readFile(
      path.join(process.cwd(), "private", "marca", file),
      "utf8",
    );
  } catch {
    return new Response("No encontrado.", { status: 404 });
  }
  return new Response(html, { headers: HTML_HEADERS });
}

async function serveBrandBook(): Promise<Response> {
  if (!(await hasBrandAccess())) {
    return new Response("No autorizado.", { status: 401 });
  }

  const tenantId = await resolveBrandTenantId();
  if (!tenantId) return new Response("No disponible.", { status: 503 });

  const asset = await findBrandBookAsset(tenantId);
  if (!asset) {
    // 404 con causa: si el book no está cargado, el que abre esto es del equipo
    // y necesita saber que le falta subirlo — no que "algo falló".
    return new Response(
      "El Brand Book todavía no está cargado. Súbelo en Studio › Marketing › HUB de marca.",
      { status: 404 },
    );
  }

  const { data, error } = await createAdminClient()
    .storage.from("brand-assets")
    .download(asset.storagePath);

  if (error || !data) {
    return new Response("No se pudo abrir el Brand Book.", { status: 502 });
  }

  // El Blob va directo como cuerpo: `Response` lo acepta como `BodyInit` y lo
  // transmite sin que tengamos que materializar los 15-27 MB en un string.
  // (Se pasa el Blob y no `data.stream()` a propósito: `Blob.stream()` no existe
  // en el entorno de test, y la diferencia en runtime es nula.)
  return new Response(data, { headers: HTML_HEADERS });
}
