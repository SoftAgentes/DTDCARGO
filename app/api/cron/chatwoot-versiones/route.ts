/**
 * /api/cron/chatwoot-versiones — vigilante de versiones de Chatwoot (SDD-0588,
 * paso 3.2). Una vez al día.
 *
 * Compara `GET <CHATWOOT_URL>/api` (versión instalada, pública) con los releases
 * públicos de chatwoot/chatwoot, guarda la revisión en `chatwoot_version_checks`
 * (0507) y, si aparece una versión nueva, avisa por push a los admins. No
 * despliega nada: subir de versión es `docs/runbooks/chatwoot-versiones.md` con el
 * OK nominal de Sam.
 *
 * Tenant: `CHATWOOT_TENANT_ID`, el mismo del webhook. No necesita el token de la
 * Platform App. Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por
 * cabecera. Sin tenant o sin la 0507 responde 200 con `omitido` y no rompe. La
 * respuesta lleva solo estado, versiones y conteos.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { chatwootTenantId } from "@/lib/studio/chatwoot/config";
import { vigilarVersiones } from "@/lib/studio/chatwoot/versiones-vigilante";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (matchesBearerSecret(auth, secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const tenantId = chatwootTenantId();
  if (!tenantId) return NextResponse.json({ ok: true, omitido: true });

  const r = await vigilarVersiones({ admin: createAdminClient(), tenantId, origen: chatwootOriginFromEnv() });
  if (r.omitido || !r.revision) return NextResponse.json({ ok: true, omitido: true });
  return NextResponse.json({
    ok: true,
    estado: r.revision.estado,
    instalada: r.revision.instalada,
    disponible: r.revision.disponible,
    pendientes: r.revision.pendientes.length,
    error: r.revision.error,
    avisados: r.avisados,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
