/**
 * /api/cron/chatwoot-agentes — ciclo de vida de los agentes de Chatwoot
 * (SDD-0585, paso 2.5). Una vez al día.
 *
 *  1. `sincronizarAgentes`: da de baja a los agentes cuyo usuario de Studio ya
 *     no está activo, no es del tenant o perdió la Bandeja. Usuarios ya lo hace
 *     al momento; esto es la red para lo que se escapó (un override de rol, un
 *     fallo de Chatwoot en ese momento).
 *  2. La salud de la cuenta y, si hay alertas, un push a los admins (por
 *     ejemplo, si la cuenta queda sin ningún admin humano). Desde la 10.5
 *     (SDD-0586, PR 1b) suma el webhook de cuenta (`revisarWebhookCuenta`).
 *
 * Tenant: `CHATWOOT_TENANT_ID`, el mismo del webhook. Auth: CRON_SECRET en
 * `Authorization: Bearer <secret>`, solo por cabecera. Sin configuración de
 * Chatwoot o sin la 0503 responde 200 con `omitido` y no rompe. La respuesta
 * lleva solo conteos y códigos de alerta.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { chatwootConfig, chatwootServicioUserId, chatwootTenantId } from "@/lib/studio/chatwoot/config";
import { avisarSaludAAdmins, sincronizarAgentes } from "@/lib/studio/chatwoot/agentes-ciclo";
import { revisarWebhookCuenta, sumarAlertasWebhook } from "@/lib/studio/chatwoot/webhook-salud";

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

  const cfg = chatwootConfig();
  const tenantId = chatwootTenantId();
  if (!cfg || !tenantId) return NextResponse.json({ ok: true, omitido: true });

  const ctx = { admin: createAdminClient(), tenantId, cfg, servicioId: chatwootServicioUserId() };
  const r = await sincronizarAgentes(ctx);
  if (r.omitido) return NextResponse.json({ ok: true, omitido: true });
  sumarAlertasWebhook(r.salud, await revisarWebhookCuenta(cfg, ctx.servicioId));
  const avisados = await avisarSaludAAdmins(ctx, r.salud);
  return NextResponse.json({
    ok: true,
    revisados: r.revisados,
    bajas: r.bajas,
    bloqueadas: r.bloqueadas,
    fallidas: r.fallidas,
    alertas: r.salud.alertas,
    avisados,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
