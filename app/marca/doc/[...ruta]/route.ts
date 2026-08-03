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
 *
 * ⚠️ SALIR DE ACÁ TIENE DOS TRAMPAS, y las dos se vieron en producción.
 *
 * 1. **`<a href="/marca">` a secas deja la pantalla gris del documento roto.**
 *    Este aviso se pinta DENTRO del `<iframe>` del visor, así que un enlace sin
 *    `target` carga `/marca` dentro del iframe — y `/marca` declara
 *    `frame-ancestors 'none'`, con lo que el navegador lo BLOQUEA. El visitante
 *    ve el ícono de archivo roto sobre fondo gris y se queda encerrado.
 *    Por eso va `target="_top"`: navega la ventana entera, no el marco.
 *
 * 2. **Al centro de marca no es a donde quiere ir.** Venía leyendo el Brand
 *    Book y tocó un enlace; lo que espera es volver AL BOOK, no al catálogo.
 *    Por eso la acción primaria es `history.back()` —dentro del iframe, que
 *    tiene su propio historial— y el catálogo queda como salida secundaria.
 *    Si no hay historial (alguien entró directo por URL) el botón se esconde y
 *    la única salida pasa a ser la primaria.
 */
function avisoNoPublicado(nombre: string): Response {
  const seguro = nombre.replace(/[<>&"]/g, "");
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pieza no publicada — DTD Cargo</title>
<style>
  /* Valores de marca, no inventados: navy y wine del sistema. Van literales
     porque esta página se sirve suelta desde el route handler y no carga
     globals.css, así que no hay var() del sistema que resolver.
     (Sin acentos graves en este comentario: está dentro de un template
     literal y cerrarían la cadena.) */
  :root{
    --navy:#0F1E3D; --navy-hondo:#0B1428; --navy-claro:#1F3055;
    --wine:#7F0F1A;
    --tinta:#FFFFFF;        /* 15,3:1 sobre navy */
    --tinta-suave:#C3C7CE;  /*  9,7:1 sobre navy — sólido, no rgba */
  }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 24px;
       background:linear-gradient(90deg,var(--navy-hondo) 0%,var(--navy) 44%,var(--navy-claro) 100%);
       color:var(--tinta);
       font-family:Archivo,'Archivo',system-ui,-apple-system,Segoe UI,sans-serif}
  .c{max-width:480px}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
           color:var(--tinta-suave);margin:0 0 14px}
  h1{font-size:clamp(21px,4vw,26px);line-height:1.25;letter-spacing:-.02em;margin:0 0 16px;font-weight:800}
  p{font-size:15px;line-height:1.65;color:var(--tinta-suave);margin:0 0 12px}
  code{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
       font-size:13px;background:var(--navy-hondo);color:var(--tinta);
       padding:3px 8px;border-radius:5px;word-break:break-word}
  .acciones{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
  .btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;
       padding:12px 20px;border-radius:8px;font-size:14.5px;font-weight:700;
       text-decoration:none;cursor:pointer;border:1.5px solid transparent;
       font-family:inherit;transition:background .15s ease,border-color .15s ease}
  .btn-primario{background:var(--tinta);color:var(--navy)}
  .btn-primario:hover{background:var(--tinta-suave)}
  .btn-secundario{background:transparent;color:var(--tinta);border-color:var(--tinta-suave)}
  .btn-secundario:hover{background:var(--navy-hondo);border-color:var(--tinta)}
  .btn:focus-visible{outline:3px solid var(--tinta);outline-offset:3px}
  .nota{margin-top:22px;padding-top:18px;border-top:1px solid var(--navy-claro);
        font-size:13.5px;color:var(--tinta-suave)}
  .nota b{color:var(--tinta)}
</style></head><body><main class="c">
<p class="eyebrow">DTD Cargo · Centro de marca</p>
<h1>Esta pieza no está publicada aquí</h1>
<p><code>${seguro}</code></p>
<p>No forma parte del material que se comparte en el centro de marca.</p>
<div class="acciones">
  <button type="button" class="btn btn-primario" id="volver" hidden>← Volver al Brand Book</button>
  <a class="btn btn-secundario" href="/marca" target="_top">Ir al centro de marca</a>
</div>
<p class="nota">Si la necesitas para un trabajo concreto, <b>pídela al equipo de DTD</b>.</p>
</main>
<script>
  // El iframe tiene su propio historial: si el visitante llegó navegando desde
  // el book, back() lo devuelve al documento exacto donde estaba. Si entró
  // directo por URL no hay a dónde volver, y un botón que no hace nada es peor
  // que no tenerlo, así que sólo se muestra cuando de verdad hay historial.
  (function () {
    var b = document.getElementById('volver');
    if (history.length > 1) {
      b.hidden = false;
      b.addEventListener('click', function () { history.back(); });
    }
  })();
</script>
</body></html>`,
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
