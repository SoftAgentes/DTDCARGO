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

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import {
  runBitacoraDigestForTenant,
  type DigestTenantResult,
} from "@/lib/studio/bitacora/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby tier max

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

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
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }
  const url = new URL(req.url);
  const targetTenantId = url.searchParams.get("tenant_id") ?? undefined;
  const result = await runForAllTenants(targetTenantId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
