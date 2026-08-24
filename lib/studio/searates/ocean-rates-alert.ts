/**
 * Salud del refresco de tarifas marítimas + texto del aviso (SDD-0287).
 *
 * **Por qué existe.** El 24-ago-2026 el cron semanal corrió, las 20 rutas
 * volvieron en `error` —SeaRates había revocado el acceso: `403 ACCESS_DENIED`
 * en rates FCL y LCL— y **nadie se enteró**. `refreshOceanRates` ya contaba
 * `ok`/`no_rate`/`error` en su `RefreshSummary`, pero el route lo escupía en el
 * JSON de la respuesta y ahí moría: el cotizador público `/fcl` se quedó mudo en
 * silencio, y el panel de salud encima lo pintaba verde (ver `checkSeaRates` en
 * `lib/studio/integration-health.ts`).
 *
 * Módulo **PURO**: sin red, sin Supabase, sin env. Todo lo que decide "esto hay
 * que avisarlo" se prueba con un objeto literal.
 */

import type { RefreshSummary } from "./ocean-rates-queries";

/**
 * Salud de una corrida del cron, desde el punto de vista del CLIENTE (no del
 * proveedor):
 *   - `dead`     → ninguna ruta quedó con tarifa usable. `/fcl` no da precio en
 *                  NINGUNA ruta. Es el estado del 24-ago.
 *   - `degraded` → hubo tarifas, pero alguna ruta falló contra el proveedor.
 *   - `ok`       → todas las rutas resolvieron sin error de proveedor.
 *
 * `no_rate` NO es un error del proveedor (es "SeaRates no tiene oferta para esa
 * ruta"), pero si TODO vuelve `no_rate` el cotizador queda igual de mudo — por
 * eso `dead` mira `ok === 0`, no `error > 0`.
 */
export type OceanRatesHealth = "ok" | "degraded" | "dead";

/** Lo mínimo que necesita el clasificador (así el test no arma un summary entero). */
export type RefreshCounts = Pick<
  RefreshSummary,
  "total" | "ok" | "no_rate" | "error"
>;

/**
 * Clasifica una corrida. El orden importa: `dead` gana sobre `degraded` — una
 * corrida donde todo falló es "muerta", no "degradada".
 *
 * Una corrida que no consultó NADA (`total === 0`) también es `dead`: un refresco
 * que no mira ninguna ruta está roto, aunque no haya devuelto un solo error.
 */
export function classifyRefreshHealth(summary: RefreshCounts): OceanRatesHealth {
  if (summary.total === 0) return "dead";
  if (summary.ok === 0) return "dead";
  if (summary.error > 0) return "degraded";
  return "ok";
}

/**
 * Código de error más repetido de la corrida, con su conteo. Es lo que separa
 * "se cayó la red un rato" de "nos revocaron el acceso":
 * `graphql_error` × 20 fue la firma exacta del corte de SeaRates.
 *
 * Empate → gana el alfabéticamente menor, para que el mensaje sea determinista
 * (los tests comparan texto; un desempate por orden de inserción sería frágil).
 */
export function dominantErrorCode(
  errorCodes: Readonly<Record<string, number>>,
): { code: string; count: number } | null {
  let best: { code: string; count: number } | null = null;
  for (const code of Object.keys(errorCodes).sort()) {
    const count = errorCodes[code] ?? 0;
    if (count <= 0) continue;
    if (!best || count > best.count) best = { code, count };
  }
  return best;
}

/** Traduce el código crudo del proveedor a algo que un humano pueda accionar. */
function errorHint(code: string): string {
  if (code === "graphql_error")
    return "El proveedor respondió pero rechazó la consulta — suele ser acceso revocado o suscripción vencida.";
  if (code === "auth_failed")
    return "No se pudo obtener el token: credenciales inválidas o cuenta caída.";
  if (code === "mock_no_key")
    return "Falta SEARATES_API_KEY en el entorno — el cron corrió en modo mock.";
  if (code.startsWith("http_"))
    return `El proveedor respondió ${code.replace("http_", "HTTP ")}.`;
  if (code.startsWith("network"))
    return "No se pudo conectar con el proveedor (red o timeout).";
  return "Revisa el detalle en /studio/debug › SeaRates.";
}

export type OceanRatesAlert = { subject: string; text: string; html: string };

/**
 * Arma el aviso. Devuelve `null` cuando la salud es `ok` — así el caller no tiene
 * que acordarse de no mandar nada; si no hay qué avisar, no hay mensaje.
 *
 * El mensaje dice **qué ve el cliente**, no solo qué falló: sin esa línea, un
 * aviso de "20 rutas en error" se lee como ruido técnico y se ignora.
 */
export function buildOceanRatesAlert(
  summary: RefreshCounts & { errorCodes?: Readonly<Record<string, number>> },
  health: OceanRatesHealth,
  siteUrl: string,
): OceanRatesAlert | null {
  if (health === "ok") return null;

  const dead = health === "dead";
  const emoji = dead ? "🔴" : "🟡";
  const titulo = dead
    ? "El cotizador de fletes se quedó sin tarifas"
    : "El refresco de fletes volvió incompleto";

  const impacto = dead
    ? "AHORA MISMO /fcl no da precio en ninguna ruta: todo cae a “pide por WhatsApp”."
    : `Quedaron ${summary.ok} de ${summary.total} rutas con tarifa; el resto muestra “sin estimado”.`;

  const top = summary.errorCodes ? dominantErrorCode(summary.errorCodes) : null;
  const causa = top
    ? `Error dominante: ${top.code} (${top.count} de ${summary.total}). ${errorHint(top.code)}`
    : "El cron no reportó errores de proveedor: las rutas volvieron sin oferta.";

  const url = `${siteUrl.replace(/\/+$/, "")}/studio/debug`;

  const subject = `${emoji} ${titulo} — ${summary.ok}/${summary.total} rutas con tarifa`;

  const text = [
    `${emoji} ${titulo}`,
    "",
    `Rutas con tarifa: ${summary.ok} de ${summary.total} (sin oferta: ${summary.no_rate} · con error: ${summary.error})`,
    impacto,
    causa,
    "",
    url,
  ].join("\n");

  const html = `
    <p><strong>${emoji} ${titulo}</strong></p>
    <p>Rutas con tarifa: <strong>${summary.ok} de ${summary.total}</strong>
       (sin oferta: ${summary.no_rate} · con error: ${summary.error})</p>
    <p>${impacto}</p>
    <p>${causa}</p>
    <p><a href="${url}">Abrir /studio/debug</a></p>
  `;

  return { subject, text, html };
}
