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

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { drainWorkflowRuns } from "@/lib/studio/workflow/workflow-drain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await drainWorkflowRuns(admin);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
