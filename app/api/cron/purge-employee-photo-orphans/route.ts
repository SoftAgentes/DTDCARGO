/**
 * /api/cron/purge-employee-photo-orphans — reconciliación del bucket privado
 * `employee-photos` (SDD-0652 fase 2, MP-01: el P0 técnico de la foto).
 *
 * De dónde salen los huérfanos:
 *  - al **cambiar** la foto, la ficha apunta al archivo nuevo y el anterior
 *    queda sin referencia (no se borra en el momento);
 *  - al **quitar** la foto, `photo_path` queda en null;
 *  - una subida cuya RPC falló y cuya limpieza inmediata tampoco pudo;
 *  - una ficha **borrada** (`deleted_at`): su foto deja de contar como referida.
 *
 * SEGURIDAD:
 *  - «Referido» es solo `nomina_employees.photo_path` de fichas vivas. Un objeto
 *    referido NUNCA se borra. ⚠️ Si otra tabla empieza a apuntar a este bucket,
 *    hay que sumar su columna aquí antes de encender el borrado.
 *  - Si la lectura de las referencias falla (por ejemplo, la migración 0555
 *    todavía no está aplicada y la columna no existe), **no se borra nada**:
 *    sin saber qué está referido, todo parecería huérfano.
 *  - Solo borra objetos con más de ORPHAN_MIN_AGE_DAYS: una subida en curso
 *    (sube → enlaza, en dos pasos) no se toca.
 *  - Techo por corrida (DELETE_CAP).
 *  - Nace APAGADO: solo cuenta (dry-run) salvo que
 *    PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED === "true". `?dryRun=1` fuerza el
 *    conteo aunque esté encendido.
 *
 * Los logs llevan conteos, nunca rutas: la ruta trae el id de la ficha.
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (solo header).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { pickOrphans, type StoredObject } from "@/lib/studio/storage/receipt-orphans";
import { EMPLOYEE_PHOTO_BUCKET } from "@/lib/studio/nomina/employee-photo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORPHAN_MIN_AGE_DAYS = 1;
const DELETE_CAP = 500;
const LIST_PAGE = 100;
const MAX_SCAN = 20_000;
const DB_PAGE = 1000;
const REMOVE_BATCH = 100;
const NOMBRE = "purge-employee-photo-orphans";

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  if (matchesBearerSecret(req.headers.get("authorization"), secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

type Admin = ReturnType<typeof createAdminClient>;

/** Lista recursiva del bucket (`storage.list` no es recursivo): tenant / ficha / archivo. */
async function listAllObjects(admin: Admin): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  async function walk(prefix: string): Promise<void> {
    if (out.length >= MAX_SCAN) return;
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(EMPLOYEE_PHOTO_BUCKET).list(prefix, {
        limit: LIST_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const full = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Las «carpetas» vienen con id null.
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

/** Las fotos que una ficha viva referencia. Si esto falla, quien llama no borra nada. */
async function collectKnownPaths(admin: Admin): Promise<Set<string>> {
  const known = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await admin
      .from("nomina_employees")
      .select("photo_path")
      .is("deleted_at", null)
      .not("photo_path", "is", null)
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const p = (r as { photo_path: string | null }).photo_path;
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

  const forcedDryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const enabled = process.env.PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED === "true";
  const live = enabled && !forcedDryRun;

  const admin = createAdminClient();

  let known: Set<string>;
  let objects: StoredObject[];
  try {
    known = await collectKnownPaths(admin);
    objects = await listAllObjects(admin);
  } catch (err) {
    return apiError("No se pudo revisar el bucket de fotos de empleados.", err, 500, NOMBRE);
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
      const { error } = await admin.storage.from(EMPLOYEE_PHOTO_BUCKET).remove(batch);
      if (error) {
        return apiError(`No se pudo borrar un lote de fotos huérfanas (borradas antes: ${deleted}).`, error, 500, NOMBRE);
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
  console.log(`[${NOMBRE}]`, JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
