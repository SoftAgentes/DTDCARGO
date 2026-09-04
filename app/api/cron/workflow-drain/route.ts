/**
 * /api/cron/workflow-drain — worker drain del motor de flujo (SDD-0091 Slice 2).
 *
 * Drena las corridas `pending` de workflow_step_runs y ejecuta el camino seguro
 * (nota de timeline para pasos internos; difiere el resto a la bandeja humana).
 * Espejo de /api/cron/push-drain.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (Vercel Cron + curl). Solo por
 * header, nunca por query-param. Idempotente: cada corrida transiciona de `pending` a
 * done/awaiting_human/failed, así una segunda pasada no la re-procesa.
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { drainWorkflowRuns } from "@/lib/studio/workflow/workflow-drain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.workflow-drain");
  if (!cron.authorized) return cron.deny();

  try {
    const admin = createAdminClient();
    const result = await drainWorkflowRuns(admin, 100, cron.logger);
    return cron.complete(
      { ok: true, ...result },
      {
        fields: {
          processed: result.processed,
          noted: result.noted,
          deferred: result.deferred,
          failed: result.failed,
        },
      },
    );
  } catch (error) {
    return cron.fail("No se pudo drenar el motor de flujo.", error, {
      event: "cron.drain_failed",
      fields: { stage: "drain" },
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
