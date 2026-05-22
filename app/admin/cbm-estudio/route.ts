/**
 * Ruta protegida que sirve la presentación interna "Transporte CBM China-Venezuela".
 *
 * Acceso: https://dtdcargo.com/admin/cbm-estudio?token=XXX
 *
 * El token se valida contra la env var `CBM_ESTUDIO_TOKEN` (set en Vercel).
 * Si el token no coincide o no está presente, devuelve una página simple
 * de "acceso restringido" — no expone el contenido.
 *
 * Por qué Route Handler en vez de Page:
 * - El HTML embebido tiene JS y CSS inline que necesitan ejecutarse tal cual
 * - dangerouslySetInnerHTML en un Page no ejecuta los <script> tags
 * - Servir el HTML completo como text/html es la forma limpia
 *
 * Para actualizar el contenido:
 * 1. Editar `_handoff_preview/transporte-cbm-china-venezuela/index.html`
 * 2. Copiar a `app/admin/cbm-estudio/content.html`
 * 3. Push → Vercel re-deploya
 */

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Forzar render dinámico (no static) porque dependemos de query params
export const dynamic = "force-dynamic";

const ACCESS_DENIED_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Acceso restringido — DTD-CARGO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&family=Archivo+Black&display=swap" rel="stylesheet">
  <style>
    body{margin:0;font-family:'Archivo',system-ui,sans-serif;background:#0F1E3D;color:#fff;min-height:100vh;display:grid;place-items:center;padding:24px}
    .card{max-width:480px;text-align:center;padding:48px 36px}
    h1{font-family:'Archivo Black';font-size:28px;letter-spacing:-0.02em;margin:0 0 16px}
    h1 span{color:#C2747F}
    p{font-size:15px;line-height:1.55;color:rgba(255,255,255,0.75);margin:0 0 12px}
    a{color:#C2747F;text-decoration:underline}
    .badge{display:inline-block;background:rgba(127,15,26,0.5);color:#fff;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:24px}
    code{background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:4px;font-size:12.5px}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">DTD·CARGO · Interno</span>
    <h1>Acceso <span>restringido</span></h1>
    <p>Esta presentación interna requiere un token de acceso.</p>
    <p>Si formás parte del equipo DTD, pedile el link completo a Sam o consultá el archivo standalone que se compartió por WhatsApp.</p>
    <p style="margin-top:32px;font-size:13px;color:rgba(255,255,255,0.4)">URL esperada: <code>/admin/cbm-estudio?token=XXX</code></p>
    <p style="margin-top:24px"><a href="/">Volver al sitio público</a></p>
  </div>
</body>
</html>`;

// Cache del HTML en memoria — no leer disk en cada request
let cachedContent: string | null = null;

async function loadContent(): Promise<string> {
  if (cachedContent) return cachedContent;
  const filePath = path.join(process.cwd(), "app", "admin", "cbm-estudio", "content.html");
  cachedContent = await fs.readFile(filePath, "utf-8");
  return cachedContent;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expectedToken = process.env.CBM_ESTUDIO_TOKEN;

  // Si no hay token configurado en el server, NUNCA permitir acceso
  // (protección contra deployments mal configurados)
  if (!expectedToken) {
    return new NextResponse(ACCESS_DENIED_HTML, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Validación token
  if (token !== expectedToken) {
    return new NextResponse(ACCESS_DENIED_HTML, {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Token OK → servir contenido
  try {
    const content = await loadContent();
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // No cachear: queremos que cualquier update del HTML se vea inmediato
        "Cache-Control": "no-store, must-revalidate",
        // Permitir scripts inline (necesarios para la interactividad del HTML)
        // El HTML embebido confía en su propio JS — no hay user input.
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    return new NextResponse(
      `<html><body><h1>Error cargando contenido</h1><p>${
        err instanceof Error ? err.message : "Error desconocido"
      }</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}
