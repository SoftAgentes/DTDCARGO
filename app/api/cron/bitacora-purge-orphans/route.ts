/**
 * /api/cron/bitacora-purge-orphans — GC de audios huérfanos del bucket
 * `bitacora` (SDD-0146 · Fase 6).
 *
 * Origen del huérfano: la ingesta sube el audio a Storage ANTES de crear el
 * borrador (`bitacora_meetings`). Si el usuario abandona entre ambos pasos, el
 * objeto queda sin fila que lo apunte. El spec §"Riesgos aceptados" lo lista.
 *
 * SEGURIDAD (el bucket es MULTI-USO):
 *  - Limpia SOLO objetos bajo `{tenant}/bitacora_meeting/...` (audios). Los
 *    ADJUNTOS de tarea (`{tenant}/bitacora_task/...`) NUNCA se tocan: viven en
 *    `documents`, no en `audio_path` → sin el scoping parecerían huérfanos y se
 *    borrarían. `pickMeetingAudioOrphans` acota los candidatos.
 *  - Cruza contra `bitacora_meetings.audio_path` (todos los tenants, con
 *    service-role). Un audio referenciado por un borrador NUNCA se borra.
 *  - Solo borra objetos más viejos que ORPHAN_MIN_AGE_DAYS (no mata uploads en
 *    vuelo: el flujo sube → inserta el borrador en 2 pasos).
 *  - Techo de borrado por corrida (DELETE_CAP) · backstop anti-runaway.
 *  - GATE: dry-run por defecto. Solo borra si BITACORA_PURGE_ORPHANS_ENABLED
 *    === "true" (el founder revisa los conteos en logs antes de activar).
 *    `?dryRun=1` fuerza dry-run aunque esté activo.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (mismo patrón que
 * purge-receipt-orphans · solo header, fail-closed).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { createRequestLogger } from "@/lib/observability/structured-logger";
import type { StoredObject } from "@/lib/studio/storage/receipt-orphans";
import { pickMeetingAudioOrphans } from "@/lib/studio/bitacora/meeting-orphans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "bitacora";
const ORPHAN_MIN_AGE_DAYS = 7;
const DELETE_CAP = 500;
const LIST_PAGE = 100;
const MAX_SCAN = 50_000;
const DB_PAGE = 1000;
const REMOVE_BATCH = 100;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

type Admin = ReturnType<typeof createAdminClient>;

/** Lista recursiva del bucket (storage.list no es recursivo). */
async function listAllObjects(admin: Admin): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  async function walk(prefix: string): Promise<void> {
    if (out.length >= MAX_SCAN) return;
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
        limit: LIST_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const full = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Heurística Supabase: las "carpetas" vienen con id null.
        if (entry.id === null || entry.id === undefined) {
          await walk(full);
        } else {
          out.push({ name: full, createdAt: entry.created_at ?? null });
          if (out.length >= MAX_SCAN) return;
        }
      }
      if (data.length < LIST_PAGE) break;
      offset += LIST_PAGE;
    }
  }
  await walk("");
  return out;
}

/** Paths de audio referenciados por un borrador/acta (bitacora_meetings). */
async function collectKnownAudioPaths(admin: Admin): Promise<Set<string>> {
  const known = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await admin
      .from("bitacora_meetings")
      .select("audio_path")
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const p = (r as { audio_path: string | null }).audio_path;
      if (p) known.add(p);
    }
    if (data.length < DB_PAGE) break;
  }
  return known;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const logger = createRequestLogger(req, "cron.bitacora-purge-orphans");
  const auth = authorize(req);
  if (!auth.ok) {
    logger.warn("cron.authorization_denied", {
      status: 403,
      authState:
        auth.reason === "CRON_SECRET no configurado"
          ? "not_configured"
          : "invalid",
    });
    return logger.withResponse(
      NextResponse.json({ error: auth.reason }, { status: 403 }),
    );
  }

  const url = new URL(req.url);
  const forcedDryRun = url.searchParams.get("dryRun") === "1";
  const enabled = process.env.BITACORA_PURGE_ORPHANS_ENABLED === "true";
  const live = enabled && !forcedDryRun;

  const admin = createAdminClient();

  let known: Set<string>;
  let objects: StoredObject[];
  try {
    known = await collectKnownAudioPaths(admin);
    objects = await listAllObjects(admin);
  } catch (err) {
    return logger.withResponse(
      apiError(
        "No se pudo escanear el bucket de Bitácora.",
        err,
        500,
        "bitacora-purge-orphans",
        {
          logger,
          event: "cron.scan_failed",
          fields: { mode: live ? "live" : "dry-run", stage: "scan" },
        },
      ),
    );
  }

  const pick = pickMeetingAudioOrphans({
    objects,
    known,
    minAgeMs: ORPHAN_MIN_AGE_DAYS * 24 * 60 * 60 * 1000,
    nowMs: Date.now(),
    cap: DELETE_CAP,
  });

  let deleted = 0;
  if (live && pick.orphans.length > 0) {
    for (let i = 0; i < pick.orphans.length; i += REMOVE_BATCH) {
      const batch = pick.orphans.slice(i, i + REMOVE_BATCH);
      const { error } = await admin.storage.from(BUCKET).remove(batch);
      if (error) {
        return logger.withResponse(
          apiError(
            `No se pudo borrar un lote de huérfanos (borrados antes: ${deleted}).`,
            error,
            500,
            "bitacora-purge-orphans",
            {
              logger,
              event: "cron.delete_failed",
              fields: {
                mode: "live",
                stage: "storage_remove",
                deletedBeforeFailure: deleted,
                batchSize: batch.length,
              },
            },
          ),
        );
      }
      deleted += batch.length;
    }
  }

  const summary = {
    ok: true,
    mode: live ? "live" : "dry-run",
    scanned: pick.scanned,
    referenced: pick.referenced,
    orphans: pick.orphans.length,
    deleted,
    skippedTooNew: pick.skippedTooNew,
    skippedNoDate: pick.skippedNoDate,
    cappedAt: pick.cappedAt,
    minAgeDays: ORPHAN_MIN_AGE_DAYS,
  };
  logger.info("cron.completed", {
    ...summary,
    durationMs: Date.now() - startedAt,
  });
  return logger.withResponse(NextResponse.json(summary));
}

export async function POST(req: NextRequest) {
  return GET(req);
}
