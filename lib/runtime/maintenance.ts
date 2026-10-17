/**
 * Modo mantenimiento (SDD-0505).
 *
 * Para el corte al servidor propio: mientras se hace la copia final de la base
 * nadie puede escribir, porque lo que se guarde en Cloud después del dump se
 * perdería sin aviso. Con `MAINTENANCE_MODE=1` el proxy corta TODA escritura:
 *
 *   · API (`/api/*`) y cualquier método que no sea GET/HEAD → 503 en JSON, con
 *     `Retry-After`. Los webhooks (Resend, Telegram) reintentan solos.
 *   · Pantallas cubiertas por el matcher (Studio, Back, Portal, /m, /p, /marca,
 *     /entrar, /registro) → 503 con la página «Volvemos en unos minutos».
 *   · Server actions (header `Next-Action`, desde cualquier página) → 503.
 *
 * Las páginas públicas que solo muestran (/, /tarifas…) no pasan por el proxy y
 * siguen sirviéndose: leer no pierde nada.
 *
 * Para revisar la app antes de apagar el modo (el smoke del corte), quien tenga
 * `MAINTENANCE_BYPASS_SECRET` entra por `/mantenimiento/entrar?clave=…`: recibe
 * una cookie de 4 horas y navega normal. La cookie guarda un hash, no la clave.
 *
 * En Vercel el cambio de variable exige redeploy; en el VPS, recrear `web`.
 */
import { NextResponse, type NextRequest } from "next/server";

export const COOKIE_BYPASS = "dtd_mantenimiento";
const RETRY_AFTER_S = "300";

/** Variables que se leen: `process.env` en la app, un objeto simple en las pruebas. */
export type Entorno = Readonly<Record<string, string | undefined>>;

export function mantenimientoActivo(env: Entorno = process.env): boolean {
  return ["1", "true", "on", "si", "sí"].includes((env.MAINTENANCE_MODE ?? "").trim().toLowerCase());
}

/** Hash que viaja en la cookie: nunca la clave. */
export async function tokenDeBypass(secreto: string): Promise<string> {
  const datos = new TextEncoder().encode(`dtd-mantenimiento:${secreto}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Solo rutas internas del mismo sitio: nunca un redirect abierto. */
function destinoSeguro(ir: string | null): string {
  if (!ir || !ir.startsWith("/") || ir.startsWith("//") || ir.includes("\\")) return "/studio";
  return ir;
}

export const PAGINA_MANTENIMIENTO = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60">
<title>Volvemos en unos minutos · DTD Cargo</title>
<style>
  :root { --wine: #7F0F1A; --ink: #0F1E3D; --ink-soft: #6B6B6B; --bg: #FBFAF7; --card: #FFFFFF; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
    background: var(--bg); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { max-width: 440px; width: 100%; background: var(--card); border-radius: 16px; padding: 32px 28px;
    box-shadow: 0 1px 2px rgba(15, 30, 61, .06), 0 8px 24px rgba(15, 30, 61, .08); text-align: center; }
  .marca { font-weight: 900; font-size: 22px; letter-spacing: -.01em; margin: 0 0 24px; }
  .marca b { color: var(--wine); font-weight: 900; }
  h1 { font-size: 22px; line-height: 1.3; margin: 0 0 12px; }
  p { margin: 0 0 10px; color: var(--ink-soft); font-size: 16px; line-height: 1.55; }
  .nota { margin-top: 20px; font-size: 14px; }
</style>
</head>
<body>
<main>
  <p class="marca"><b>DTD</b> Cargo</p>
  <h1>Estamos haciendo una mejora</h1>
  <p>El sistema vuelve en unos minutos. Tus datos están a salvo.</p>
  <p>Si estabas guardando algo, espera a que vuelva y repítelo.</p>
  <p class="nota">Esta página se actualiza sola cada minuto.</p>
</main>
</body>
</html>`;

function respuestaApi(): NextResponse {
  return NextResponse.json(
    { error: "mantenimiento", mensaje: "El sistema está en mantenimiento. Vuelve a intentar en unos minutos." },
    { status: 503, headers: { "Retry-After": RETRY_AFTER_S, "Cache-Control": "no-store" } },
  );
}

function respuestaPagina(): NextResponse {
  return new NextResponse(PAGINA_MANTENIMIENTO, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": RETRY_AFTER_S, "Cache-Control": "no-store" },
  });
}

/**
 * Respuesta del modo mantenimiento para esta request, o `null` si pasa.
 * Se llama al principio del proxy, antes de cualquier llamada a Supabase.
 */
export async function respuestaDeMantenimiento(
  request: NextRequest,
  env: Entorno = process.env,
): Promise<NextResponse | null> {
  if (!mantenimientoActivo(env)) return null;
  const { pathname, searchParams } = request.nextUrl;
  const secreto = (env.MAINTENANCE_BYPASS_SECRET ?? "").trim();
  const token = secreto ? await tokenDeBypass(secreto) : "";

  if (token && igualesEnTiempoConstante(request.cookies.get(COOKIE_BYPASS)?.value ?? "", token)) {
    return null;
  }
  if (pathname === "/mantenimiento/entrar") {
    const clave = searchParams.get("clave") ?? "";
    if (token && clave && igualesEnTiempoConstante(await tokenDeBypass(clave), token)) {
      const url = request.nextUrl.clone();
      url.pathname = destinoSeguro(searchParams.get("ir"));
      url.search = "";
      const res = NextResponse.redirect(url);
      res.cookies.set(COOKIE_BYPASS, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 4 * 60 * 60 });
      return res;
    }
    return respuestaPagina();
  }

  const escribe = !["GET", "HEAD"].includes(request.method) || request.headers.has("next-action");
  if (pathname.startsWith("/api/") || pathname === "/api" || escribe) return respuestaApi();
  return respuestaPagina();
}
