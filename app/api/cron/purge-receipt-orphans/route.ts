/**
 * /api/cron/purge-receipt-orphans — GC de objetos huérfanos en el bucket
 * `receipt-photos`.
 *
 * Origen de los huérfanos: el caso "phantom-success" de las colas offline
 * (CN foto · POD camionero) sube el archivo a Storage pero la fila no se
 * crea (la respuesta se perdió por red) → el objeto queda sin fila. Las
 * migraciones 0183/0184 documentan ese huérfano. Este cron lo limpia.
 *
 * SEGURIDAD (el bucket es multi-uso · contiene pruebas de entrega legales):
 *  - Cruza contra TODAS las columnas que apuntan a receipt-photos:
 *    warehouse_receipt_photos.storage_path (foto recepción CN) +
 *    dispatch_pods.photo_path + dispatch_pods.signature_path (POD legal) +
 *    bug_attachments.storage_path (Bug Reporter, prefijo bug/). Un objeto
 *    referenciado NUNCA se borra. ⚠️ Si nace un 4º consumidor del bucket,
 *    SUMAR su columna acá antes de que el cron corra en live.
 *  - Solo borra objetos más viejos que ORPHAN_MIN_AGE_DAYS (evita matar un
 *    upload en vuelo: los flujos suben → linkean en 2 pasos).
 *  - Techo de borrado por corrida (DELETE_CAP) · backstop anti-runaway.
 *  - GATE: dry-run por defecto. Solo borra si PURGE_RECEIPT_ORPHANS_ENABLED
 *    === "true". Así el Director revisa los conteos en logs antes de activar
 *    el borrado real (patrón gated, como SDD-0083). `?dryRun=1` fuerza
 *    dry-run aunque esté activo.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (mismo patrón que
 * purge-throttle · solo header, nunca query-param).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { pickOrphans, type StoredObject } from "@/lib/studio/storage/receipt-orphans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "receipt-photos";
const ORPHAN_MIN_AGE_DAYS = 7;
const DELETE_CAP = 500; // máximo de objetos a borrar por corrida
const LIST_PAGE = 100;
const MAX_SCAN = 50_000; // backstop: nunca escanear más que esto
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

/** Junta los paths referenciados por TODAS las columnas que usan el bucket. */
async function collectKnownPaths(admin: Admin): Promise<Set<string>> {
  const known = new Set<string>();

  // warehouse_receipt_photos.storage_path (fotos de recepción CN)
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await admin
      .from("warehouse_receipt_photos")
      .select("storage_path")
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const p = (r as { storage_path: string | null }).storage_path;
      if (p) known.add(p);
    }
    if (data.length < DB_PAGE) break;
  }

  // dispatch_pods.photo_path + signature_path (pruebas de entrega · legales)
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await admin
      .from("dispatch_pods")
      .select("photo_path, signature_path")
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const row = r as { photo_path: string | null; signature_path: string | null };
      if (row.photo_path) known.add(row.photo_path);
      if (row.signature_path) known.add(row.signature_path);
    }
    if (data.length < DB_PAGE) break;
  }

  // bug_attachments.storage_path (Bug Reporter SDD-0036 · prefijo bug/) ·
  // TERCER consumidor del bucket receipt-photos (migr 0028).
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await admin
      .from("bug_attachments")
      .select("storage_path")
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const p = (r as { storage_path: string | null }).storage_path;
      if (p) known.add(p);
    }
    if (data.length < DB_PAGE) break;
  }

  return known;
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const url = new URL(req.url);
  const forcedDryRun = url.searchParams.get("dryRun") === "1";
  const enabled = process.env.PURGE_RECEIPT_ORPHANS_ENABLED === "true";
  const live = enabled && !forcedDryRun;

  const admin = createAdminClient();

  let known: Set<string>;
  let objects: StoredObject[];
  try {
    known = await collectKnownPaths(admin);
    objects = await listAllObjects(admin);
  } catch (err) {
    return apiError(
      "No se pudo escanear el bucket de recibos.",
      err,
      500,
      "purge-receipt-orphans",
    );
  }

  const pick = pickOrphans({
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
        return apiError(
          `No se pudo borrar un lote de huérfanos (borrados antes: ${deleted}).`,
          error,
          500,
          "purge-receipt-orphans",
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
  console.log("[purge-receipt-orphans]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
