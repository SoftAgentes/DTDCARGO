/**
 * /api/cron/oficina-envio — el envío del cable (SDD-0626 Paso 3b, C).
 *
 * SOLO el ERP envía, SOLO lo que Sam aprobó, SOLO a la bandeja de prueba. El cron del servidor lo llama cada
 * minuto; cada llamada manda como mucho 5 mensajes. Antes de cada uno mira otra vez la pausa y que el borrador
 * no cambió desde la aprobación; un borrador se envía como mucho una vez (detalle: `lib/studio/oficina/envio.ts`).
 *
 * Nace APAGADO: con `OFICINA_ENVIO_ACTIVO` vacío o falso no crea el cliente de la base ni llama a Chatwoot. Sin
 * el token de escritura, la cuenta o la bandeja responde `sin_config`. Sin la 0549 responde 200 `sin_migracion`.
 * Respuesta: solo conteos y estados, nunca el texto.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera. Solo en el servidor
 * (infra/dtd-cargo/cron/crontab, no en vercel.json).
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { configEnvio, crearAlmacenEnvio, crearChatwootEnvio, procesarEnvios } from "@/lib/studio/oficina/envio";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matchesBearerSecret(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: secret ? "Forbidden" : "CRON_SECRET no configurado" }, { status: 403 });
  }
  const config = configEnvio();
  // Apagado: ni siquiera se crea el cliente de la base.
  if (!config.activo) return NextResponse.json({ ok: true, estado: "apagado" });
  if (!config.chatwoot) return NextResponse.json({ ok: true, estado: "sin_config" });
  try {
    const r = await procesarEnvios({
      config,
      almacen: crearAlmacenEnvio(createAdminClient()),
      chatwoot: crearChatwootEnvio(config.chatwoot),
    });
    const cuenta: Record<string, number> = {};
    for (const x of r.resultados) cuenta[x] = (cuenta[x] ?? 0) + 1;
    return NextResponse.json({ ok: true, estado: r.estado, resultados: cuenta });
  } catch (e) {
    console.error(`[oficina-envio] la tanda no corrió (${e instanceof Error ? e.name : "error"})`);
    return NextResponse.json({ ok: false, error: "envio" }, { status: 500 });
  }
}
