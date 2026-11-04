/**
 * Origen público del despliegue, para armar destinos en un route handler
 * (SDD-0602).
 *
 * `request.url` no sirve para eso detrás de un proxy. En el contenedor
 * (`HOSTNAME=0.0.0.0`, `Dockerfile`) Next lo arma con la dirección donde escucha,
 * y un destino hecho con él manda al navegador a `https://0.0.0.0:3000`: medido
 * en producción el 2026-11-04. `proxy.ts` no lo sufre porque Next deja relativo
 * el `Location` de sus redirecciones, cosa que no hace en un route handler.
 *
 * Por entorno (`lib/runtime/app-env.ts`):
 *   · `production` y `staging`: `NEXT_PUBLIC_SITE_URL`.
 *   · `preview`: `APP_URL`, nunca el canónico: saltar de un preview a producción
 *     ejecutaría ahí lo que se estaba probando (la misma lección de
 *     `resolveNewsletterSiteUrl`). En Vercel no hay `APP_URL`, y su `request.url`
 *     ya trae el host real.
 *   · `local`: la petición. `next dev` escucha en su host real, y `.env.example`
 *     propone el dominio de producción: con él, una prueba local saldría a
 *     producción.
 *
 * Si no hay un valor http(s) utilizable, se cae a la petición. En la imagen eso
 * no ocurre: sin la variable, `app/layout.tsx` hace morir el build.
 */

import { resolveAppEnv, type EnvSource } from "./app-env";

function httpOrigin(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function configuredOrigin(env: EnvSource): string | null {
  switch (resolveAppEnv(env)) {
    case "production":
    case "staging":
      return httpOrigin(env.NEXT_PUBLIC_SITE_URL);
    case "preview":
      return httpOrigin(env.APP_URL);
    case "local":
      return null;
  }
}

/**
 * `NEXT_PUBLIC_SITE_URL` va escrita completa a propósito: Next la reemplaza por
 * el valor del build, que es el único que trae la imagen. Leída con `env[...]`
 * dependería del `.env` del servidor.
 */
function runtimeEnv(): EnvSource {
  return { ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
}

export function publicOrigin(requestUrl: string, env: EnvSource = runtimeEnv()): string {
  return configuredOrigin(env) ?? new URL(requestUrl).origin;
}
