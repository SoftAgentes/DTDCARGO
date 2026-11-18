/**
 * POST /api/oficina/webhook-chatwoot — eventos de Chatwoot → bandeja del cable (SDD-0626 §3.2).
 *
 * Es OTRO webhook que `/api/chatwoot/webhook` (el de la Bandeja del Studio, SDD-0585): tiene su
 * propio secreto (`OFICINA_WEBHOOK_SECRET`) y su propio interruptor (`OFICINA_WEBHOOK_ACTIVO`, apagado
 * por defecto). Toda la lógica está en `lib/studio/oficina/webhook-chatwoot.ts`; esta ruta solo la
 * conecta. Runbook: docs/runbooks/oficina-cable.md §8.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { configWebhookOficina } from "@/lib/studio/oficina/config";
import { crearAlmacenSupabase } from "@/lib/studio/oficina/bandeja-store";
import { procesarWebhookOficina } from "@/lib/studio/oficina/webhook-chatwoot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = await procesarWebhookOficina(req, {
    config: configWebhookOficina(),
    crearAlmacen: () => crearAlmacenSupabase(createAdminClient()),
  });
  return NextResponse.json(r.cuerpo, { status: r.status });
}
