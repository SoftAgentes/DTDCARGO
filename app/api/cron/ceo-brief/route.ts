/**
 * /api/cron/ceo-brief — Sprint C del plan v2.
 *
 * Endpoint llamado por Vercel Cron (configurado en `vercel.json` con
 * schedule `0 11 * * *` = 7am Caracas, ya que Vercel Cron usa UTC y
 * Caracas es UTC-4).
 *
 * Para cada tenant activo:
 *  1. fetchCeoBriefKpis() · agregado del día anterior.
 *  2. generateBriefText() · claude-sonnet-4-6 lo resume en 3-5 líneas.
 *  3. sendCeoBriefToTenant() · Telegram al admin con telegram_chat_id.
 *
 * Auth: CRON_SECRET en header `Authorization: Bearer <secret>` (Vercel
 * Cron pasa el header con la value de `CRON_SECRET` del project env).
 *
 * Manual trigger (testing):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *     "https://.../api/cron/ceo-brief?tenant_id=<uuid>"
 * El secret SOLO se acepta por header — nunca por query-param (los query
 * params terminan en logs de acceso, historial y referrers).
 *
 * Devuelve JSON con resultado por tenant. Idempotente · puedes re-correrlo
 * el mismo día y manda otro brief (no hay dedup en V1).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  fetchCeoBriefKpis,
  generateBriefText,
  sendCeoBriefToTenant,
} from "@/lib/news/ceo-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby tier max

interface TenantResult {
  tenant_id: string;
  tenant_slug: string;
  ok: boolean;
  sentTo?: string;
  error?: string;
  briefPreview?: string;
}

async function runForAllTenants(targetTenantId?: string) {
  const admin = createAdminClient();

  // Listar tenants activos. Si se pasó target_tenant_id (testing manual),
  // solo ese.
  let tenantsQuery = admin.from("tenants").select("id, slug");
  if (targetTenantId) {
    tenantsQuery = tenantsQuery.eq("id", targetTenantId);
  }
  const { data: tenants, error } = await tenantsQuery;
  if (error) {
    return {
      ok: false,
      error: `Listar tenants: ${error.message}`,
      results: [] as TenantResult[],
    };
  }

  const results: TenantResult[] = [];
  for (const t of (tenants ?? []) as { id: string; slug: string }[]) {
    try {
      const kpis = await fetchCeoBriefKpis(admin, t.id);
      const brief = await generateBriefText(kpis);
      const sendResult = await sendCeoBriefToTenant(admin, t.id, brief);
      results.push({
        tenant_id: t.id,
        tenant_slug: t.slug,
        ok: sendResult.ok,
        sentTo: sendResult.sentTo,
        error: sendResult.error,
        briefPreview: brief.slice(0, 200),
      });
    } catch (err) {
      results.push({
        tenant_id: t.id,
        tenant_slug: t.slug,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ok: true, results };
}

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, reason: "CRON_SECRET no configurado" };
  }

  // Solo por header: Vercel Cron pasa "Authorization: Bearer <CRON_SECRET>".
  // El secret nunca se acepta por query-param (terminaría en logs/referrers).
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };

  return { ok: false, reason: "Forbidden" };
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
  // Mismo handler que GET (Vercel Cron usa GET, pero por si acaso)
  return GET(req);
}
