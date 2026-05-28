/**
 * GET /api/debug/health
 *
 * Endpoint público que devuelve el estado del entorno + integraciones tal
 * como las ve este deploy (production / preview).
 *
 * Pensado para que desde local podamos chequear cómo están las integraciones
 * REALES en producción sin tener las keys de prod en .env.local.
 *
 * Privacidad: solo devuelve booleans + estados + latencias. NUNCA expone
 * valores de env vars ni secrets.
 *
 * Cache: 60s (igual que los chequeos individuales).
 */

import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/studio/env-status";
import { checkAllIntegrations } from "@/lib/studio/integration-health";

export const revalidate = 60;

export async function GET() {
  const env = getEnvStatus();
  const health = await checkAllIntegrations();

  return NextResponse.json(
    {
      env: env.env,
      vercelUrl: env.vercelUrl,
      branch: env.branch,
      commitShaShort: env.commitShaShort,
      integrations: env.integrations,
      health,
      at: Date.now(),
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
