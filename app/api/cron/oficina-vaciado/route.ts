/**
 * /api/cron/oficina-vaciado — el vaciado diario del resumen de la bitácora (SDD-0626 §3.1).
 *
 * Una vez al día llama a `office_vaciar_resumenes_viejos()` (0541): pone `task_events.resumen = null`
 * en las filas de más de 90 días; la fila queda (tipo, actor, costo, modelo y hora). Decisión A de Sam
 * del 15/11/2026 (docs/specs/0626-oficina-runtime/privacidad.md). Es privacidad, no trabajo de agentes:
 * CORRE AUNQUE LA OFICINA ESTÉ PAUSADA.
 *
 * Nace APAGADO: con `OFICINA_VACIADO_ACTIVO` vacío o falso no llama a la base. Sin la 0541 responde
 * 200 `sin_migracion` y lo anota una vez en el log: no rompe. Idempotente: correrlo dos veces da lo
 * mismo (la segunda no encuentra nada que vaciar).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera, como push-drain.
 * Solo en el servidor (infra/dtd-cargo/cron/crontab, no en vercel.json).
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { correrVaciadoDeResumenes } from "@/lib/studio/oficina/bandeja-store";
import { vaciadoActivo } from "@/lib/studio/oficina/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matchesBearerSecret(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: secret ? "Forbidden" : "CRON_SECRET no configurado" }, { status: 403 });
  }
  // Apagado: ni siquiera se crea el cliente de la base.
  if (!vaciadoActivo()) return NextResponse.json({ ok: true, estado: "apagado" });
  try {
    const r = await correrVaciadoDeResumenes(createAdminClient());
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error(`[oficina-vaciado] no corrió (${e instanceof Error ? e.name : "error"})`);
    return NextResponse.json({ ok: false, error: "vaciado" }, { status: 500 });
  }
}
