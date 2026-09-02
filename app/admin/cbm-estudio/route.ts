/**
 * Ruta protegida que sirve la presentación interna "Transporte CBM China-Venezuela".
 *
 * Acceso: formulario POST en https://dtdcargo.com/admin/cbm-estudio. La credencial
 * se valida contra `CBM_ESTUDIO_TOKEN` y, si coincide, se acuña una sesión corta
 * en cookie HttpOnly. El secreto nunca forma parte de la URL ni de la cookie.
 *
 * Para actualizar el contenido: editar `app/admin/cbm-estudio/content.html`.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE_PATH = "/admin/cbm-estudio";
const SESSION_COOKIE = "__Host-dtd-cbm-estudio";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_CONTEXT = "cbm-estudio-session-v1";

const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, must-revalidate",
  "Content-Type": "text/html; charset=utf-8",
  "X-Robots-Tag": "noindex, nofollow",
};

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function sessionSignature(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret)
    .update(`${SESSION_CONTEXT}:${expiresAt}`)
    .digest("base64url");
}

function createSession(secret: string): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  return `${expiresAt}.${sessionSignature(secret, expiresAt)}`;
}

function hasValidSession(request: NextRequest, secret: string): boolean {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const separator = value.indexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(value.slice(0, separator));
  const signature = value.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;

  return safeEqual(signature, sessionSignature(secret, expiresAt));
}

function accessPage(options: { invalid?: boolean; unavailable?: boolean } = {}): string {
  const { invalid = false, unavailable = false } = options;
  const status = unavailable
    ? "El acceso está temporalmente no disponible. Inténtalo más tarde."
    : invalid
      ? "La credencial no es válida. Verifica el dato e inténtalo de nuevo."
      : "Ingresa la credencial interna para continuar.";
  const statusRole = invalid || unavailable ? ' role="alert"' : "";
  const describedBy = invalid
    ? ' aria-describedby="access-status" autofocus'
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Acceso restringido — DTD Cargo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&family=Archivo+Black&display=swap" rel="stylesheet">
  <style>
    :root{--wine:#7F0F1A;--wine-deep:#5E0A12;--wine-soft:#C2747F;--ink:#0F1E3D;--white:#FFFFFF;--border:#E8E6E2;--s-2:8px;--s-3:12px;--s-4:16px;--s-6:24px;--s-8:32px;--s-12:48px;--r-sm:5px}
    *{box-sizing:border-box}
    body{margin:0;font-family:'Archivo',system-ui,sans-serif;background:var(--ink);color:var(--white);min-height:100vh;display:grid;place-items:center;padding:var(--s-6)}
    main{width:min(100%,480px);padding:var(--s-12) var(--s-8)}
    .badge{display:inline-block;color:var(--white);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:var(--s-6)}
    h1{font-family:'Archivo Black','Archivo',sans-serif;font-size:28px;line-height:1.2;letter-spacing:-.02em;margin:0 0 var(--s-4)}
    h1 span{color:var(--wine-soft)}
    p{font-size:16px;line-height:1.6;margin:0 0 var(--s-6)}
    form{display:grid;gap:var(--s-3);margin-top:var(--s-8)}
    label{font-size:14px;font-weight:700}
    input{width:100%;min-height:44px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--white);color:var(--ink);font:inherit;padding:var(--s-3) var(--s-4)}
    input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--wine-soft);outline-offset:3px}
    button{min-height:44px;border:0;border-radius:var(--r-sm);background:var(--wine);color:var(--white);font:700 16px 'Archivo',system-ui,sans-serif;padding:var(--s-3) var(--s-4);cursor:pointer}
    button:hover{background:var(--wine-deep)}
    #access-status{font-size:14px;margin:0;color:var(--white)}
    a{color:var(--wine-soft);font-size:14px;text-underline-offset:3px}
    .back{margin-top:var(--s-8)}
    @media (max-width:520px){main{padding:var(--s-8) var(--s-2)}}
  </style>
</head>
<body>
  <main>
    <span class="badge">DTD Cargo · Interno</span>
    <h1>Acceso <span>restringido</span></h1>
    <p id="access-status"${statusRole}>${status}</p>
    ${
      unavailable
        ? ""
        : `<form method="post" action="${ROUTE_PATH}">
      <label for="access-token">Credencial de acceso</label>
      <input id="access-token" name="token" type="password" autocomplete="current-password" maxlength="512" required${describedBy}>
      <button type="submit">Entrar</button>
    </form>`
    }
    <p class="back"><a href="/">Volver al sitio público</a></p>
  </main>
</body>
</html>`;
}

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: BASE_HEADERS,
  });
}

let cachedContent: string | null = null;

async function loadContent(): Promise<string> {
  if (cachedContent) return cachedContent;
  const filePath = path.join(process.cwd(), "app", "admin", "cbm-estudio", "content.html");
  cachedContent = await fs.readFile(filePath, "utf-8");
  return cachedContent;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // Los enlaces legacy se limpian sin aceptar la credencial desde la URL.
  if (url.searchParams.has("token")) {
    url.searchParams.delete("token");
    return NextResponse.redirect(url, 303);
  }

  const expectedToken = process.env.CBM_ESTUDIO_TOKEN;
  if (!expectedToken) return htmlResponse(accessPage({ unavailable: true }), 503);
  if (!hasValidSession(request, expectedToken)) return htmlResponse(accessPage(), 401);

  try {
    const content = await loadContent();
    const headers: Record<string, string> = {
      ...BASE_HEADERS,
    };
    if (url.searchParams.get("download") === "1") {
      headers["Content-Disposition"] =
        'attachment; filename="presentacion-cbm-china-venezuela.html"';
    }
    return new NextResponse(content, { status: 200, headers });
  } catch (error) {
    console.error("[cbm-estudio] no se pudo cargar el contenido", error);
    return htmlResponse(
      "<html lang=\"es\"><body><h1>Contenido no disponible</h1><p>Inténtalo de nuevo más tarde.</p></body></html>",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.CBM_ESTUDIO_TOKEN;
  if (!expectedToken) return htmlResponse(accessPage({ unavailable: true }), 503);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return htmlResponse(accessPage({ invalid: true }), 413);
  }

  let submittedToken = "";
  try {
    const formData = await request.formData();
    submittedToken = String(formData.get("token") ?? "");
  } catch {
    return htmlResponse(accessPage({ invalid: true }), 400);
  }

  if (submittedToken.length > 512 || !safeEqual(submittedToken, expectedToken)) {
    return htmlResponse(accessPage({ invalid: true }), 401);
  }

  const response = NextResponse.redirect(new URL(ROUTE_PATH, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSession(expectedToken),
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
