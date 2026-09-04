/**
 * /api/cron/conversation-digests — resumen mensual de conversaciones con IA (SDD-0149).
 *
 * Vercel Cron `0 5 1 * *` = día 1 de cada mes, 05:00 UTC (01:00 Caracas). Resume el
 * MES ANTERIOR: por tenant, cada conversación con actividad ese mes → un resumen con
 * IA guardado en conversation_monthly_digests (idempotente). Sin actividad → nada.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` fail-closed (mismo patrón que
 * bitacora-digest / ceo-brief). Manual/backfill:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *     "https://.../api/cron/conversation-digests?month=2026-06&tenant_id=<uuid>"
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import type { StructuredLogger } from "@/lib/observability/structured-logger";
import {
  runConversationDigestsForTenant,
  type DigestRunResult,
} from "@/lib/studio/conversaciones/monthly-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rango del mes a resumir. Sin `?month`: el mes ANTERIOR a hoy (UTC). Con
 * `?month=YYYY-MM`: ese mes (backfill). Devuelve start/endExcl (YYYY-MM-DD) + label.
 */
function resolveMonth(monthParam: string | null): {
  monthStart: string;
  monthEndExcl: string;
  periodLabel: string;
} {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0-11 · mes ACTUAL
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [yy, mm] = monthParam.split("-").map(Number);
    y = yy;
    m = mm; // el resumen es de este mes → start = (y, m-1)
  }
  // Sin param: resumir el mes anterior (m-1). Con param: el mes dado (m-1 tras el +1).
  const start = new Date(Date.UTC(y, m - 1, 1));
  const endExcl = new Date(Date.UTC(y, m, 1));
  const periodLabel = start.toLocaleString("es-VE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    monthStart: start.toISOString().slice(0, 10),
    monthEndExcl: endExcl.toISOString().slice(0, 10),
    periodLabel,
  };
}

async function run(
  monthParam: string | null,
  logger: StructuredLogger,
  targetTenantId?: string,
) {
  const admin = createAdminClient();
  const { monthStart, monthEndExcl, periodLabel } = resolveMonth(monthParam);

  let tenantsQuery = admin.from("tenants").select("id");
  if (targetTenantId) tenantsQuery = tenantsQuery.eq("id", targetTenantId);
  const { data: tenants, error } = await tenantsQuery;
  if (error) {
    return {
      ok: false,
      error: `Listar tenants: ${error.message}`,
      period: monthStart,
      results: [] as DigestRunResult[],
    };
  }

  const results: DigestRunResult[] = [];
  for (const t of (tenants ?? []) as { id: string }[]) {
    results.push(
      await runConversationDigestsForTenant(
        admin,
        t.id,
        monthStart,
        monthEndExcl,
        periodLabel,
        logger,
      ),
    );
  }
  return { ok: true, period: monthStart, periodLabel, results };
}

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.conversation-digests");
  if (!cron.authorized) return cron.deny();

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const tenantId = url.searchParams.get("tenant_id") ?? undefined;
  const result = await run(month, cron.logger, tenantId);
  if (!result.ok) {
    return cron.fail(
      "No se pudo leer los tenants para los resúmenes.",
      result.error,
      { event: "cron.read_failed", fields: { stage: "read" } },
    );
  }

  const metrics = result.results.reduce(
    (total, item) => ({
      processed: total.processed + item.processed,
      generated: total.generated + item.generated,
      skipped: total.skipped + item.skipped,
    }),
    { processed: 0, generated: 0, skipped: 0 },
  );
  return cron.complete(result, {
    fields: { tenantCount: result.results.length, ...metrics },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
