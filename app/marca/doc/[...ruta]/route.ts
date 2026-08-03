/**
 * Sirve el SISTEMA DE MARCA navegable (SDD-0238) — no un archivo, un sitio.
 *
 * POR QUÉ EXISTE. El Brand Book no es un documento: es el índice de un sistema
 * de 35 piezas (`Logo Oficial`, `Iconos de Perfil`, `Aplicaciones de Marca`,
 * `Manual de Producción`…). Sus enlaces internos son relativos:
 *
 *     <a href="Logo Oficial.html">
 *
 * El visor anterior servía UN archivo autocontenido, así que esos enlaces no
 * tenían a dónde ir: el empaquetador los mandaba a `/marca` a falta de algo
 * mejor, y el founder los reportó como "no abren" (2026-08-02). Embeber los 35
 * documentos dentro del maestro tampoco servía — multiplica el peso por diez y
 * duplica cada asset en cada copia.
 *
 * Sirviendo el proyecto como sitio bajo un prefijo común, los enlaces relativos
 * resuelven SOLOS: `/marca/doc/Brand Book DTD v5.0.html` + `Logo Oficial.html`
 * → `/marca/doc/Logo Oficial.html`. **No se reescribe un solo href**, que es lo
 * que hace que esto sobreviva al próximo NORTE-SYNC: no hay parche que
 * mantener cuando llegue la v5.1.
 *
 * QUÉ SE PUBLICA. Sólo marca (decisión del founder, 2026-08-02). Las piezas de
 * producto —el ERP por dentro, la app del operario, los formularios de
 * inspección— NO se suben: `/marca` es el enlace que se le pasa a diseño
 * externo y a la imprenta. Sus enlaces no quedan muertos: caen en la página de
 * aviso de abajo, que explica y devuelve al catálogo.
 *
 * SEGURIDAD
 *  · Mismo gate que el resto de `/marca`: sesión del ERP **o** código.
 *  · El bucket es privado y el navegador nunca habla con Storage: el cuerpo se
 *    transmite desde nuestro origen. Un redirect a la URL firmada mandaría el
 *    documento a `*.supabase.co`, donde no rige nuestra CSP y donde los enlaces
 *    relativos saldrían del gate.
 *  · SVG va como adjunto, nunca inline: es XML que admite `<script>`, y servirlo
 *    inline en nuestro origen sería XSS almacenado. Misma regla que
 *    `/api/marca/download/[assetId]`.
 */

import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { createAdminClient } from "@/lib/db/admin";
import {
  claveProyecto,
  PROYECTO_INDICE,
  PROYECTO_PREFIJO,
  tipoDeContenido,
} from "@/lib/marca/proyecto";

export const runtime = "nodejs";

/**
 * Página para una pieza que no está publicada — sea porque es de producto y se
 * decidió dejarla fuera, sea porque Cloud Design no la mandó. No se distingue
 * el motivo a propósito: mantener acá la lista de lo excluido significaría
 * mantenerla en dos lugares, y para quien la abre el resultado es el mismo.
 *
 * ⚠️ Por eso el texto NO afirma un motivo. Decía «es parte del sistema interno
 * de producto», que es cierto para las 22 piezas excluidas y MENTIRA para un
 * documento que simplemente no llegó en el handoff o que cambió de nombre — y
 * ese segundo caso es el que va a pasar solo, cada vez que llegue una versión
 * nueva del Norte.
 *
 * Va con 200 y no con 404: no es un error del visitante ni un enlace roto, es
 * una pieza que existe y no se comparte. Un 404 le diría "te equivocaste".
 */
function avisoNoPublicado(nombre: string): Response {
  const seguro = nombre.replace(/[<>&"]/g, "");
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pieza no publicada — DTD Cargo</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
       background:#0F1E3D;color:#fff;font-family:Archivo,system-ui,sans-serif}
  .c{max-width:460px;text-align:center}
  h1{font-size:22px;letter-spacing:-.02em;margin:0 0 14px}
  p{font-size:15px;line-height:1.6;color:rgba(255,255,255,.75);margin:0 0 10px}
  code{background:rgba(255,255,255,.1);padding:2px 7px;border-radius:4px;font-size:13px}
  a{display:inline-block;margin-top:22px;color:#0F1E3D;background:#fff;
    padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700}
</style></head><body><div class="c">
<h1>Esta pieza no está en el centro de marca</h1>
<p><code>${seguro}</code> no forma parte del material publicado acá.</p>
<p>Si la necesitas para un trabajo concreto, pídela al equipo de DTD.</p>
<a href="/marca">Volver al centro de marca</a>
</div></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  if (!(await hasBrandAccess())) {
    return new Response("No autorizado.", { status: 401 });
  }

  const { ruta } = await params;
  // Next ya entrega los segmentos decodificados y sin `/`, pero un `..` sí
  // llega tal cual. Storage no resuelve rutas como un filesystem —no habría
  // traversal— aunque sí generaría claves absurdas contra las que consultar.
  const limpio = (ruta ?? []).filter((s) => s !== "." && s !== "..");
  if (limpio.length === 0) return new Response("No encontrado.", { status: 404 });

  const relativa = limpio.join("/");
  const nombre = limpio[limpio.length - 1];
  const tipo = tipoDeContenido(nombre);

  const tenantId = await resolveBrandTenantId();
  if (!tenantId) return new Response("No disponible.", { status: 503 });

  const { data, error } = await createAdminClient()
    .storage.from("brand-assets")
    .download(`${tenantId}/${PROYECTO_PREFIJO}/${claveProyecto(relativa)}`);

  if (error || !data) {
    // Si falta EL ÍNDICE, no es que la pieza no se comparta: es que nadie corrió
    // la subida todavía. Decir "esto es interno" ahí sería mentira, y mandaría a
    // buscar un permiso en vez de a correr un script.
    if (relativa === PROYECTO_INDICE) {
      return new Response(
        "El sistema de marca navegable todavía no está publicado.\n" +
          'Súbelo con: pnpm tsx scripts/upload-brand-proyecto.ts "<carpeta del proyecto>"',
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    // Un documento ausente es una pieza no publicada; un asset ausente es un
    // 404 de verdad (una imagen rota dentro de una página que sí existe).
    return nombre.toLowerCase().endsWith(".html")
      ? avisoNoPublicado(nombre)
      : new Response("No encontrado.", { status: 404 });
  }

  const esSvg = tipo === "image/svg+xml";
  return new Response(data, {
    headers: {
      "Content-Type": esSvg ? "application/octet-stream" : tipo,
      // Los HTML llevan el gate encima y no se cachean. Los assets sí: son 185
      // archivos y 91 MB, y sin cache cada navegación los vuelve a bajar de
      // Storage. `private` para que no los guarde ningún intermediario.
      "Cache-Control": tipo === "text/html; charset=utf-8"
        ? "private, no-store"
        : "private, max-age=3600",
      ...(esSvg
        ? { "Content-Disposition": `attachment; filename="${nombre.replace(/"/g, "")}"` }
        : {}),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
