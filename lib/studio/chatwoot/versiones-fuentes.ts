import "server-only";

import {
  evaluarVersiones,
  releasesEstables,
  versionDeApi,
  type ReleaseChatwoot,
  type ResultadoVersiones,
} from "./versiones";

/**
 * Las dos lecturas del vigilante de versiones (SDD-0588, paso 3.2). Nunca lanzan.
 *
 * - `GET <origen>/api`: pública en Chatwoot (`api_controller.rb`), sin token. La
 *   misma que mira el monitor «Chatwoot · versión» de Uptime Kuma.
 * - `GET https://api.github.com/repos/chatwoot/chatwoot/releases`: pública, sin
 *   token. Sin autenticar, GitHub admite 60 pedidos por hora por IP; el cron corre
 *   una vez al día y el botón «Revisar ahora» reutiliza una lectura de menos de
 *   10 min.
 *
 * Nada de lo que viaja lleva datos de DTD: el pedido a GitHub no tiene parámetros
 * propios y el de Chatwoot no lleva credenciales.
 */

const TIMEOUT_MS = 10_000;
export const RELEASES_URL = "https://api.github.com/repos/chatwoot/chatwoot/releases?per_page=30";

type Fetch = typeof fetch;

async function leerJson(fetchImpl: Fetch, url: string, headers: Record<string, string>): Promise<{ ok: true; cuerpo: unknown } | { ok: false }> {
  try {
    const res = await fetchImpl(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false };
    return { ok: true, cuerpo: await res.json() };
  } catch {
    return { ok: false };
  }
}

export async function leerVersionInstalada(
  origen: string,
  fetchImpl: Fetch = fetch,
): Promise<{ ok: true; version: string } | { ok: false; error: "instalada_no_responde" | "instalada_formato" }> {
  const r = await leerJson(fetchImpl, `${origen}/api`, { accept: "application/json" });
  if (!r.ok) return { ok: false, error: "instalada_no_responde" };
  const version = versionDeApi(r.cuerpo);
  return version ? { ok: true, version } : { ok: false, error: "instalada_formato" };
}

export async function leerReleases(
  fetchImpl: Fetch = fetch,
): Promise<{ ok: true; lista: ReleaseChatwoot[] } | { ok: false; error: "releases_no_responde" | "releases_formato" }> {
  const r = await leerJson(fetchImpl, RELEASES_URL, {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "dtd-studio-vigilante-chatwoot",
  });
  if (!r.ok) return { ok: false, error: "releases_no_responde" };
  const lista = releasesEstables(r.cuerpo);
  return lista ? { ok: true, lista } : { ok: false, error: "releases_formato" };
}

/** Las dos lecturas en paralelo y el resultado listo para guardar. */
export async function revisarVersiones(origen: string, fetchImpl: Fetch = fetch): Promise<ResultadoVersiones> {
  const [instalada, releases] = await Promise.all([leerVersionInstalada(origen, fetchImpl), leerReleases(fetchImpl)]);
  return evaluarVersiones(instalada, releases);
}
