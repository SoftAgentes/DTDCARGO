/**
 * /api/cron/rate-expiry-alert — SDD-0164, pendiente ⭐1.
 *
 * Vigila las tarifas PÚBLICAS (`rates.is_public` + `status='published'` +
 * `deleted_at is null` + `valid_until` no nulo) que alimentan
 * `public_cbm_rate()` / `public_fcl_rates()`, y avisa por Telegram + email
 * al founder (`role=admin`) y a comercial (`role=commercial`) cuando están
 * por vencer (<=7 días) o ya vencidas. Sin este aviso, una tarifa que vence
 * cae en silencio al precio de respaldo hardcodeado de `lib/calculadora.ts`.
 *
 * Schedule: diario, `vercel.json` (`0 13 * * *` = 9am Caracas, UTC-4).
 * Auth: CRON_SECRET en header `Authorization: Bearer <secret>` — nunca
 * por query-param (los query params terminan en logs de acceso).
 *
 * Dedup: self-healing, ver `classifyRateExpiry` (lib/studio/rate-types.ts).
 * Re-correr el mismo día no reenvía — es idempotente.
 *
 * Manual trigger (testing):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *     "https://.../api/cron/rate-expiry-alert?tenant_id=<uuid>"
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { classifyRateExpiry, type RateExpiryLevel } from "@/lib/studio/rate-types";
import {
  listPublicRatesForExpiryAlert,
  markRateExpiryAlertSent,
} from "@/lib/studio/rate-queries";
import { notifyRateExpiry } from "@/lib/studio/rate-expiry-notify";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby tier max

type RateAlertResult = {
  rate_id: string;
  level: RateExpiryLevel;
  telegramSent: number;
  emailSent: number;
  error?: string;
};

async function runForAllTenants(targetTenantId?: string) {
  const admin = createAdminClient();

  let tenantsQuery = admin.from("tenants").select("id, slug");
  if (targetTenantId) {
    tenantsQuery = tenantsQuery.eq("id", targetTenantId);
  }
  const { data: tenants, error } = await tenantsQuery;
  if (error) {
    return {
      ok: false,
      error: `Listar tenants: ${error.message}`,
      results: [] as RateAlertResult[],
    };
  }

  const results: RateAlertResult[] = [];
  for (const t of (tenants ?? []) as { id: string; slug: string }[]) {
    const rates = await listPublicRatesForExpiryAlert(admin, t.id);
    for (const rate of rates) {
      const level = classifyRateExpiry(rate);
      if (!level) continue;

      try {
        const sent = await notifyRateExpiry(admin, t.id, rate, level);
        await markRateExpiryAlertSent(admin, rate.id, level, new Date().toISOString());
        results.push({ rate_id: rate.id, level, ...sent });
      } catch (err) {
        results.push({
          rate_id: rate.id,
          level,
          telegramSent: 0,
          emailSent: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { ok: true, results };
}

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, reason: "CRON_SECRET no configurado" };
  }

  const auth = req.headers.get("authorization");
  if (matchesBearerSecret(auth, secret)) return { ok: true };

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
