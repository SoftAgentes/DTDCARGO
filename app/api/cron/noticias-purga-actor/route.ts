/**
 * /api/cron/noticias-purga-actor — la purga diaria de actor_id de noticias (SDD-0611 §11.4.1).
 *
 * Llama a `news_purgar_actor_id()` (0546): vacía el uuid de las cuatro columnas de persona
 * (`news_post_exits.actor_id`, `news_publication_audit.actor_id`, `news_autopublish_settings_log.changed_by`,
 * `news_autopublish_settings.updated_by`) en filas de MÁS de 12 meses. No borra filas. Decisión de Sam
 * del 2026-11-14. Es privacidad, no publicación: no depende del interruptor `news_autopublish`.
 *
 * Nace APAGADO: con `NOTICIAS_PURGA_ACTOR_ACTIVO` distinto de `1`/`true` no llama a la base. Sin la 0546
 * responde 200 `sin_migracion`: no rompe. Idempotente. La respuesta lleva solo conteos, nunca uuid.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera, como oficina-vaciado.
 * Solo en el servidor (infra/dtd-cargo/cron/crontab, no en vercel.json).
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function purgaActiva(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const v = env.NOTICIAS_PURGA_ACTOR_ACTIVO?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** 42883 (función inexistente) o PGRST202 (PostgREST no la ve): la 0546 no está aplicada. */
function faltaLaMigracion(error: { code?: string }): boolean {
  return error.code === "42883" || error.code === "PGRST202";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matchesBearerSecret(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: secret ? "Forbidden" : "CRON_SECRET no configurado" }, { status: 403 });
  }
  // Apagado: ni siquiera se crea el cliente de la base.
  if (!purgaActiva()) return NextResponse.json({ ok: true, estado: "apagado" });
  try {
    const { data, error } = await createAdminClient().rpc("news_purgar_actor_id");
    if (error) {
      if (faltaLaMigracion(error)) {
        console.warn("[noticias-purga-actor] no hace nada: falta la 0546 en esta base (SDD-0611 §11.4.1)");
        return NextResponse.json({ ok: true, estado: "sin_migracion" });
      }
      console.error(`[noticias-purga-actor] no corrió (${error.code ?? "error"})`);
      return NextResponse.json({ ok: false, error: "purga" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, estado: "ok", vaciadas: data ?? {} });
  } catch (e) {
    console.error(`[noticias-purga-actor] no corrió (${e instanceof Error ? e.name : "error"})`);
    return NextResponse.json({ ok: false, error: "purga" }, { status: 500 });
  }
}
