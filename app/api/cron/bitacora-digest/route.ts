/**
 * /api/cron/bitacora-digest — recordatorio diario de tareas (SDD-0146 · Fase 5).
 *
 * Vercel Cron `0 12 * * *` (UTC) = 8am Caracas (UTC-4). Para cada tenant, arma UN
 * push por persona con sus tareas abiertas con due_date <= hoy (incluye
 * atrasadas), escribe la campanita y encola el push (durable, outbox 0066). Sin
 * tareas = sin push. Idempotente por (user, tag=recordatorio-bitacora-{fecha}).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` fail-closed (mismo patrón
 * que ceo-brief / push-drain). El secret SOLO por header (nunca query-param).
 *
 * Manual (testing):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *     "https://.../api/cron/bitacora-digest?tenant_id=<uuid>"
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import {
  runBitacoraDigestForTenant,
  type DigestTenantResult,
} from "@/lib/studio/bitacora/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby tier max

async function runForAllTenants(targetTenantId?: string) {
  const admin = createAdminClient();
  const hoyISO = todayCaracasISO();

  let tenantsQuery = admin.from("tenants").select("id");
  if (targetTenantId) tenantsQuery = tenantsQuery.eq("id", targetTenantId);
  const { data: tenants, error } = await tenantsQuery;
  if (error) {
    return {
      ok: false,
      error: `Listar tenants: ${error.message}`,
      hoyISO,
      results: [] as DigestTenantResult[],
    };
  }

  const results: DigestTenantResult[] = [];
  for (const t of (tenants ?? []) as { id: string }[]) {
    results.push(await runBitacoraDigestForTenant(admin, t.id, hoyISO));
  }
  return { ok: true, hoyISO, results };
}

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.bitacora-digest");
  if (!cron.authorized) return cron.deny();

  const url = new URL(req.url);
  const targetTenantId = url.searchParams.get("tenant_id") ?? undefined;
  const result = await runForAllTenants(targetTenantId);
  if (!result.ok) {
    return cron.fail("No se pudo leer los tenants para el digest.", result.error, {
      event: "cron.read_failed",
      fields: { stage: "read" },
    });
  }

  const metrics = result.results.reduce(
    (total, item) => ({
      persons: total.persons + item.persons,
      pushed: total.pushed + item.pushed,
      skipped: total.skipped + item.skipped,
      failed: total.failed + (item.error ? 1 : 0),
    }),
    { persons: 0, pushed: 0, skipped: 0, failed: 0 },
  );
  return cron.complete(result, {
    fields: { tenantCount: result.results.length, ...metrics },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
