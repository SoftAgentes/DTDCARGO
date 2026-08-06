/**
 * GET /api/debug/health
 *
 * Estado del entorno + integraciones tal como las ve este deploy (production /
 * preview). Pensado para chequear desde local cómo están las integraciones REALES
 * en producción sin tener las keys de prod en .env.local.
 *
 * GATE (2026-06-10): requiere el secreto `DEBUG_HEALTH_SECRET`. Antes era público
 * y exponía entorno, vercelUrl, rama git, commit SHA y la topología de
 * integraciones a cualquiera (reconocimiento gratis). Ahora:
 *   - sin `DEBUG_HEALTH_SECRET` en el server → 503 (fail-closed; no responde nada).
 *   - con secreto pero sin/clave incorrecta → 401.
 *   - secreto correcto → payload completo.
 * El secreto viaja por `Authorization: Bearer <s>` (preferido — lo manda el propio
 * Studio vía `fetchRemoteHealth`) o `?key=<s>` (fallback para chequeo manual desde
 * el navegador; el query puede quedar en logs, preferí el header).
 *
 * MODO BARATO (SDD-0247): `?cheap=1` salta las integraciones que consumen cuota o
 * tokens por ping (SeaRates, Anthropic, OpenRouter) y las marca `skipped` con el
 * motivo. Es para el vigía externo, que sondea cada 15 min: el chequeo completo
 * a esa cadencia son ~96 llamadas/día contra la cuota de SeaRates, que es de 100
 * al MES y la comparte con el cotizador FCL. Sin el param no cambia nada.
 *
 * Privacidad: solo devuelve booleans + estados + latencias. NUNCA expone valores de
 * env vars ni secrets.
 */

import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/studio/env-status";
import { checkAllIntegrations } from "@/lib/studio/integration-health";

// El gate lee headers/URL del request → render dinámico (no cacheable a nivel ruta).
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_HEALTH_SECRET;
  if (!expected) return false; // fail-closed: sin secreto configurado, nadie pasa
  // Solo `Authorization: Bearer <secreto>`. Se eliminó el fallback `?key=` porque
  // el secreto en la URL queda en logs de servidor/proxy, historial y Referer.
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return bearer != null && bearer === expected;
}

export async function GET(request: Request) {
  const noStore = { "cache-control": "no-store" };

  if (!process.env.DEBUG_HEALTH_SECRET) {
    return NextResponse.json(
      { error: "debug health no configurado" },
      { status: 503, headers: noStore },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "no autorizado" },
      { status: 401, headers: noStore },
    );
  }

  // `?cheap=1` salta las integraciones que cobran por ping (SeaRates, Anthropic,
  // OpenRouter) y las devuelve como `skipped` con el motivo en `detail`. Existe
  // para el vigía externo: sondear el chequeo completo cada 15 min son ~96
  // llamadas/día contra la cuota de SeaRates, que es de 100 al MES y la comparte
  // con el cotizador FCL. Sin el param, el comportamiento es el de siempre.
  const cheap = new URL(request.url).searchParams.get("cheap") === "1";

  const env = getEnvStatus();
  const health = await checkAllIntegrations({ skipMetered: cheap });

  return NextResponse.json(
    {
      env: env.env,
      vercelUrl: env.vercelUrl,
      branch: env.branch,
      commitShaShort: env.commitShaShort,
      integrations: env.integrations,
      cheap,
      health,
      at: Date.now(),
    },
    { headers: noStore },
  );
}
