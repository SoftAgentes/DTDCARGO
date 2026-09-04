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

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { classifyRateExpiry, type RateExpiryLevel } from "@/lib/studio/rate-types";
import {
  listPublicRatesForExpiryAlert,
  markRateExpiryAlertSent,
} from "@/lib/studio/rate-queries";
import { notifyRateExpiry } from "@/lib/studio/rate-expiry-notify";

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

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.rate-expiry-alert");
  if (!cron.authorized) return cron.deny();

  try {
    const url = new URL(req.url);
    const targetTenantId = url.searchParams.get("tenant_id") ?? undefined;
    const result = await runForAllTenants(targetTenantId);
    if (!result.ok) {
      return cron.fail(
        "No se pudo leer los tenants para alertas de tarifas.",
        result.error,
        { event: "cron.read_failed", fields: { stage: "read" } },
      );
    }
    return cron.complete(result, {
      fields: {
        processed: result.results.length,
        sent: result.results.filter(
          (item) => item.telegramSent > 0 || item.emailSent > 0,
        ).length,
        failed: result.results.filter((item) => Boolean(item.error)).length,
      },
    });
  } catch (error) {
    return cron.fail("No se pudo ejecutar la alerta de tarifas.", error, {
      event: "cron.run_failed",
      fields: { stage: "run" },
    });
  }
}

export async function POST(req: NextRequest) {
  // Mismo handler que GET (Vercel Cron usa GET, pero por si acaso)
  return GET(req);
}
