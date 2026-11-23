/**
 * SDD-0680 (adenda 2026-11-23) · candado de origen para las rutas `POST /studio/bandeja/sso` y
 * `POST /studio/bandeja/reconciliar`.
 *
 * Las server actions traen su propio control de origen; una ruta propia no. El
 * SSO devuelve un enlace de login de un solo uso, así que solo se responde a la
 * página del mismo Studio: con `Sec-Fetch-Site` debe ser `same-origin`, y con
 * `Origin` su host debe ser el de la petición (el de Traefik, `x-forwarded-host`).
 * Sin ninguna de las dos cabeceras (un navegador viejo) se acepta: la cookie de
 * sesión con SameSite=Lax ya no viaja en un POST de otro sitio.
 */
export function esMismoOrigen(req: Request): boolean {
  const sitio = req.headers.get("sec-fetch-site");
  if (sitio !== null && sitio !== "same-origin") return false;
  const origen = req.headers.get("origin");
  if (origen === null) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origen).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
