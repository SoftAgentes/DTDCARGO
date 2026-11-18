/**
 * /api/cron/oficina-filtro — el filtro nivel 1 de la bandeja del cable (SDD-0626 §3.3).
 *
 * Cada minuto llama a `office_filtrar_bandeja()` (0544): pasa a «triaje» hasta 20 eventos por hora,
 * primero dinero, luego cliente, luego interno; lo que no cabe se queda en «nuevo» (no descarta
 * nada). 0 tokens, sin modelo. Con `office_esta_pausada()` en verdadero la función no mueve nada.
 *
 * Nace APAGADO: con `OFICINA_WEBHOOK_ACTIVO` vacío o falso no llama a la base. Sin la 0541 o la 0544
 * responde 200 `sin_migracion` y lo anota una vez en el log: no rompe.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera, como push-drain.
 * Solo en el servidor (infra/dtd-cargo/cron/crontab, no en vercel.json).
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { correrFiltroDeLaBandeja } from "@/lib/studio/oficina/bandeja-store";
import { configWebhookOficina } from "@/lib/studio/oficina/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matchesBearerSecret(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: secret ? "Forbidden" : "CRON_SECRET no configurado" }, { status: 403 });
  }
  const config = configWebhookOficina();
  // Apagado: ni siquiera se crea el cliente de la base.
  if (!config.activo) return NextResponse.json({ ok: true, estado: "apagado" });
  try {
    const r = await correrFiltroDeLaBandeja(createAdminClient(), config);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error(`[oficina-filtro] no corrió (${e instanceof Error ? e.name : "error"})`);
    return NextResponse.json({ ok: false, error: "filtro" }, { status: 500 });
  }
}
