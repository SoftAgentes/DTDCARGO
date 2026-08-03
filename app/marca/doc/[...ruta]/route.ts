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

import {
  hasBrandAccess,
  hasBrandInternalAccess,
  resolveBrandTenantId,
  submitBrandInternalCode,
} from "@/lib/marca/access";
import { createAdminClient } from "@/lib/db/admin";
import {
  claveProyecto,
  PROYECTO_INDICE,
  PROYECTO_PREFIJO,
  PROYECTO_PREFIJO_INTERNO,
  tipoDeContenido,
} from "@/lib/marca/proyecto";

export const runtime = "nodejs";

const BUCKET = "brand-assets";

/**
 * ¿Existe la pieza en la carpeta interna? Sólo existencia, sin traer el cuerpo.
 *
 * Sirve para que el aviso sepa QUÉ decir: "esto se abre con el código de
 * producto" no es lo mismo que "esto no está acá", y antes la página no podía
 * distinguirlo, así que afirmaba un motivo que no le constaba.
 *
 * Que revele la existencia a quien tiene el código de marca no agrega nada: el
 * Brand Book ya enlaza estas piezas por nombre, así que quien llegó hasta el
 * aviso llegó siguiendo un enlace que las nombra.
 */
async function existeEnInterno(tenantId: string, relativa: string): Promise<boolean> {
  const clave = `${tenantId}/${PROYECTO_PREFIJO_INTERNO}/${claveProyecto(relativa)}`;
  const corte = clave.lastIndexOf("/");
  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .list(clave.slice(0, corte), { search: clave.slice(corte + 1), limit: 1 });
  return (data?.length ?? 0) > 0;
}

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
function avisoNoPublicado(
  nombre: string,
  opts: { bloqueada?: boolean; error?: string } = {},
): Response {
  const seguro = nombre.replace(/[<>&"]/g, "");
  const bloqueada = Boolean(opts.bloqueada);
  const errorSeguro = (opts.error ?? "").replace(/[<>&"]/g, "");

  const titulo = bloqueada
    ? "Esta pieza pide el código de producto"
    : "Esta pieza no está publicada aquí";
  const bajada = bloqueada
    ? "Es material del sistema interno — el ERP, la app del operario, los formularios. No se comparte con el código de marca."
    : "No forma parte del material que se comparte en el centro de marca.";

  // El formulario sólo aparece cuando la pieza EXISTE detrás del segundo código.
  // Ofrecerlo siempre convertiría el aviso en un oráculo: se probaría un código
  // cualquiera contra rutas inventadas para averiguar cuáles existen.
  const desbloqueo = bloqueada
    ? `<form class="desbloqueo" method="post" action="">
  <label class="lbl" for="codigo">Código de producto</label>
  <div class="fila">
    <input class="campo" id="codigo" name="codigo" inputmode="numeric" autocomplete="one-time-code"
           pattern="[0-9]{6}" maxlength="6" required placeholder="6 dígitos"
           aria-describedby="${errorSeguro ? "err" : "ayuda"}">
    <button class="btn btn-primario" type="submit">Abrir</button>
  </div>
  ${
    errorSeguro
      ? `<p class="err" id="err" role="alert">${errorSeguro}</p>`
      : `<p class="ayuda" id="ayuda">Lo pone un administrador en Studio › Marketing › HUB de marca.</p>`
  }
</form>`
    : "";

  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${bloqueada ? "Pieza de producto" : "Pieza no publicada"} — DTD Cargo</title>
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
    /* El wine del sistema (#7F0F1A) sobre navy da 1,6:1 — ilegible. Sobre fondo
       oscuro el rojo tiene que subir de luminosidad, no de saturación. Este es
       el wine aclarado: 9,1:1 sobre --navy-hondo, medido. */
    --alerta:#FF9AA5;
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
  .desbloqueo{margin-top:24px;padding:18px;border-radius:10px;
              background:var(--navy-hondo);border:1px solid var(--navy-claro)}
  .lbl{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;
       text-transform:uppercase;color:var(--tinta-suave);margin-bottom:9px}
  .fila{display:flex;flex-wrap:wrap;gap:9px}
  .campo{flex:1 1 150px;min-width:0;min-height:44px;padding:11px 14px;border-radius:8px;
         border:1.5px solid var(--tinta-suave);background:var(--navy);color:var(--tinta);
         font-family:'JetBrains Mono',ui-monospace,monospace;font-size:17px;letter-spacing:.22em}
  .campo::placeholder{color:var(--tinta-suave);letter-spacing:normal;font-size:14px}
  .campo:focus-visible{outline:3px solid var(--tinta);outline-offset:2px;border-color:var(--tinta)}
  .ayuda{font-size:12.5px;color:var(--tinta-suave);margin:11px 0 0}
  .err{font-size:13px;color:var(--alerta);font-weight:700;margin:11px 0 0}
</style></head><body><main class="c">
<p class="eyebrow">DTD Cargo · Centro de marca</p>
<h1>${titulo}</h1>
<p><code>${seguro}</code></p>
<p>${bajada}</p>
${desbloqueo}
<div class="acciones">
  <!-- Con el formulario en pantalla la acción primaria es Abrir, y sólo esa: dos
       botones rellenos compitiendo dejan al visitante sin saber cuál es la
       salida esperada. Sin formulario, volver SÍ es lo primario. -->
  <button type="button" class="btn ${bloqueada ? "btn-secundario" : "btn-primario"}" id="volver" hidden>← Volver al Brand Book</button>
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
  req: Request,
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

  const admin = createAdminClient();
  const clave = claveProyecto(relativa);

  // Primero la carpeta pública. Si está acá, se sirve y no hay más que decidir.
  let { data, error } = await admin
    .storage.from(BUCKET)
    .download(`${tenantId}/${PROYECTO_PREFIJO}/${clave}`);

  // Y SÓLO si el visitante trae el segundo código, además la interna. Nótese
  // que no hay un `if (esInterna)` en ningún lado: la pieza de producto no está
  // "prohibida", está en una clave que sin ese código no se consulta nunca.
  // Ver el porqué en PROYECTO_PREFIJO_INTERNO.
  if ((error || !data) && (await hasBrandInternalAccess())) {
    ({ data, error } = await admin
      .storage.from(BUCKET)
      .download(`${tenantId}/${PROYECTO_PREFIJO_INTERNO}/${clave}`));
  }

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
    if (!nombre.toLowerCase().endsWith(".html")) {
      return new Response("No encontrado.", { status: 404 });
    }
    // Ahora el aviso SÍ puede saber por qué no la tiene: si la pieza está en la
    // carpeta interna, ofrece el código; si no está en ninguna, no inventa un
    // motivo. Distinguirlo era lo que le faltaba a la versión anterior.
    return avisoNoPublicado(nombre, {
      bloqueada: await existeEnInterno(tenantId, relativa),
      error: new URL(req.url).searchParams.get("e") ?? undefined,
    });
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

/**
 * Recibe el código de producto (SDD-0242) desde el formulario del aviso.
 *
 * VIVE ACÁ Y NO EN `/api/marca/...` POR LA CSP. El aviso se pinta dentro del
 * `<iframe>` del visor, así que el formulario postea desde adentro del marco.
 * Un endpoint bajo `/api/` cae en la CSP estricta del sitio (`frame-ancestors
 * 'none'`) en vez de la permisiva que `next.config.ts` le da a `/marca/doc/*`, y
 * bastaría que el navegador evaluara la política sobre la respuesta intermedia
 * para dejar al visitante otra vez frente a la pantalla gris. Posteando a su
 * propia URL no hay frontera que cruzar.
 *
 * Responde con 303 —no 302— para que la recarga no reenvíe el código: tras el
 * redirect el navegador hace GET, y refrescar no vuelve a gastar un intento del
 * contador de bloqueo.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  if (!(await hasBrandAccess())) {
    return new Response("No autorizado.", { status: 401 });
  }

  const { ruta } = await params;
  const limpio = (ruta ?? []).filter((s) => s !== "." && s !== "..");
  if (limpio.length === 0) return new Response("No encontrado.", { status: 404 });

  const destino = `/marca/doc/${limpio.map(encodeURIComponent).join("/")}`;
  const volver = (motivo?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: motivo ? `${destino}?e=${encodeURIComponent(motivo)}` : destino,
        "Cache-Control": "private, no-store",
      },
    });

  const form = await req.formData().catch(() => null);
  const bruto = form?.get("codigo");
  const codigo = typeof bruto === "string" ? bruto.trim() : "";

  // La forma se valida acá para no gastar un intento del contador por un dedazo:
  // un campo vacío o con letras no es un intento de adivinar.
  if (!/^\d{6}$/.test(codigo)) return volver("El código son 6 dígitos.");

  const veredicto = await submitBrandInternalCode(codigo);
  switch (veredicto.status) {
    case "ok":
      return volver();
    case "wrong":
      return volver(
        veredicto.attemptsLeft === 1
          ? "Código incorrecto. Te queda 1 intento."
          : `Código incorrecto. Te quedan ${veredicto.attemptsLeft} intentos.`,
      );
    case "locked": {
      const min = Math.max(1, Math.ceil((veredicto.until.getTime() - Date.now()) / 60000));
      return volver(`Demasiados intentos. Prueba de nuevo en ${min} min.`);
    }
    case "closed":
      return volver("Nadie ha puesto el código de producto todavía.");
    case "unavailable":
      return volver("No pudimos verificar el código. Prueba de nuevo en un rato.");
  }
}
