/**
 * scripts/sync-servicios-detalle.ts — sincroniza la prosa RICA de los servicios
 * desde el código (fuente de verdad) a la DB del ERP, sin transcripción a mano.
 *
 * Por qué existe (SDD-0076): la migración 0130 sembró `public.service_configs`
 * con el contenido de los servicios, pero quedó con descripciones ACORTADAS
 * (el seed SQL no transcribió las ~470 líneas de `lib/servicios-detalle.ts`).
 * La prosa completa y curada vive en `lib/servicios-detalle.ts` (SDD-0063). Este
 * script la proyecta a la DB vía supabase-js — mismo patrón "fuente en código,
 * proyección a DB" de `seed.ts`/`seed-mail-templates.ts`, pero acotado a las
 * columnas de CONTENIDO público.
 *
 * Mapeo (NO es trivial): la clave de la DB (`service_key`) es el `id` del
 * catálogo canónico (`lib/shared/service-catalog.ts`), NO el `slug` del estático.
 * El puente es `legacySlug` del catálogo — igual que hace `mergeServiciosPublicados`
 * en lib/public/servicios-queries.ts, pero acá invertido (estático → DB).
 *
 * Qué toca y qué NO:
 *   ✓ Capa PÚBLICA de contenido: title_public, description_public, includes_public,
 *     excludes_public, price_text, price_table, how_to_request, timelines_public,
 *     note_public, service_state.
 *   ✗ NUNCA toca: is_public (lo decide el founder en el Studio), shipment_service
 *     (ya correcto desde el seed), charge_moment, payment_methods, condiciones,
 *     ni la capa interna (notes_internal/internal_price_ref/mapeo_contable).
 *
 * Seguridad / idempotencia / reversibilidad:
 *   - Usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS) → SIEMPRE filtra por tenant.
 *   - dry-run por default: NO escribe, solo muestra el diff contra la DB destino.
 *   - --apply: solo actualiza filas que difieren (idempotente — 2ª corrida = no-op),
 *     y antes guarda un BACKUP JSON de los valores previos (reversible).
 *   - --restore <file>: re-aplica un backup → revierte.
 *
 * Uso (esquiva el preflight de pnpm — ver feedback_pnpm_preflight_workaround):
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/sync-servicios-detalle.ts            # dry-run (default)
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/sync-servicios-detalle.ts --apply    # escribe (con backup)
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/sync-servicios-detalle.ts --restore "<ruta-del-backup.json>"
 *
 * Flags: --tenant <slug> (default "dtd") · --backup <ruta> (override del backup) · --help
 *
 * NOTA ventana secundaria: este script NO se corre desde la rama (lee/escribe prod).
 * Lo ejecuta la ventana de coordinación, dry-run primero. La lógica pura va cubierta
 * por scripts/__tests__/sync-servicios-detalle.test.ts (corre sin red).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  SERVICE_CATALOG,
  type ServiceCatalogEntry,
} from "@/lib/shared/service-catalog";
import {
  SERVICIOS_DETALLE_BY_SLUG,
  type ServicioDetalle,
} from "@/lib/servicios-detalle";

// ────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────

export type PriceTable = {
  columnas: string[];
  filas: string[][];
  nota?: string;
};

/** Las columnas de CONTENIDO público que el script proyecta (y solo esas). */
export type SyncColumns = {
  title_public: string;
  description_public: string;
  includes_public: string[];
  excludes_public: string[];
  price_text: string;
  price_table: PriceTable | null;
  how_to_request: string;
  timelines_public: string;
  note_public: string | null;
  service_state: string;
};

/** Las claves de SyncColumns, en orden estable (para reportes y backups). */
export const SYNC_COLUMN_KEYS: (keyof SyncColumns)[] = [
  "title_public",
  "description_public",
  "includes_public",
  "excludes_public",
  "price_text",
  "price_table",
  "how_to_request",
  "timelines_public",
  "note_public",
  "service_state",
];

export type SyncRow = {
  /** = SERVICE_CATALOG[].id = service_configs.service_key */
  serviceKey: string;
  /** = SERVICE_CATALOG[].legacySlug = slug del estático */
  legacySlug: string;
  columns: SyncColumns;
};

export type SyncPlan = {
  rows: SyncRow[];
  /** Catálogo sin ficha estática (legacySlug null), ej. cursos-importacion. */
  skippedNoLegacy: string[];
  /** legacySlug declarado pero sin ficha en el estático (drift a corregir). */
  missingFicha: { id: string; legacySlug: string }[];
};

/** Fila de la DB tal como la leemos (subset de columnas que tocamos). */
export type CurrentRow = { service_key: string } & Partial<SyncColumns>;

export type FieldDiff = { column: keyof SyncColumns; from: unknown; to: unknown };

// ────────────────────────────────────────────────
// Núcleo PURO (exportado para test, sin red ni side effects)
// ────────────────────────────────────────────────

/** Proyecta una ficha del estático a las columnas de contenido de la DB. */
export function fichaToColumns(f: ServicioDetalle): SyncColumns {
  return {
    title_public: f.titulo,
    description_public: f.resumen,
    includes_public: f.incluye,
    excludes_public: f.noIncluye,
    price_text: f.precio,
    price_table: f.precioTabla ?? null,
    how_to_request: f.comoSolicitar,
    timelines_public: f.tiempos,
    note_public: f.nota ?? null,
    // mismos estados que el CHECK de service_configs; default del estático.
    service_state: f.estado ?? "activo",
  };
}

/**
 * Arma el plan de sincronización: una fila por cada entrada del catálogo que
 * tiene `legacySlug` Y una ficha estática que le corresponda. Reporta aparte las
 * entradas sin legacySlug (esperado) y los legacySlug huérfanos (drift).
 */
export function buildSyncPlan(
  catalog: readonly ServiceCatalogEntry[],
  fichasBySlug: Record<string, ServicioDetalle>,
): SyncPlan {
  const rows: SyncRow[] = [];
  const skippedNoLegacy: string[] = [];
  const missingFicha: { id: string; legacySlug: string }[] = [];

  for (const entry of catalog) {
    if (!entry.legacySlug) {
      skippedNoLegacy.push(entry.id);
      continue;
    }
    const ficha = fichasBySlug[entry.legacySlug];
    if (!ficha) {
      missingFicha.push({ id: entry.id, legacySlug: entry.legacySlug });
      continue;
    }
    rows.push({
      serviceKey: entry.id,
      legacySlug: entry.legacySlug,
      columns: fichaToColumns(ficha),
    });
  }

  return { rows, skippedNoLegacy, missingFicha };
}

/**
 * Ordena recursivamente las claves de los objetos (preserva el orden de los
 * arrays, que sí es significativo en includes/excludes/filas). Necesario porque
 * Postgres `jsonb` normaliza el orden de claves por longitud: `price_table` vuelve
 * de la DB como {nota,filas,columnas} aunque el estático la define como
 * {columnas,filas,nota}. Sin canonicalizar, esa fila marcaría diff en cada corrida.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = canonicalize(obj[key]);
    return out;
  }
  return value;
}

/** Igualdad estructural tolerante: trata undefined≡null y orden de claves jsonb. */
function valuesEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(canonicalize(a ?? null)) ===
    JSON.stringify(canonicalize(b ?? null))
  );
}

/** Columnas que cambian entre la fila actual de la DB y la deseada (estático). */
export function diffColumns(
  current: Partial<SyncColumns>,
  desired: SyncColumns,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const column of SYNC_COLUMN_KEYS) {
    if (!valuesEqual(current[column], desired[column])) {
      diffs.push({ column, from: current[column], to: desired[column] });
    }
  }
  return diffs;
}

/** Extrae solo las columnas que tocamos, de una fila (para snapshot/backup). */
export function pickSyncColumns(row: Partial<SyncColumns>): Partial<SyncColumns> {
  const out: Partial<SyncColumns> = {};
  for (const column of SYNC_COLUMN_KEYS) {
    // null es un valor válido (note_public/price_table); lo conservamos.
    out[column] = (row[column] ?? null) as never;
  }
  return out;
}

// ────────────────────────────────────────────────
// CLI (side effects: red, fs, env)
// ────────────────────────────────────────────────

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", n: "\x1b[0m" };
const ok = (m: string) => console.log(`${C.g}✓${C.n} ${m}`);
const warn = (m: string) => console.log(`${C.y}⚠${C.n} ${m}`);
const info = (m: string) => console.log(m);
function die(m: string): never {
  console.error(`${C.r}✗ ${m}${C.n}`);
  process.exit(1);
}

type ParsedArgs = {
  mode: "dry-run" | "apply" | "restore";
  tenant: string;
  backupPath: string | null;
  restoreFile: string | null;
  help: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    mode: "dry-run",
    tenant: "dtd",
    backupPath: null,
    restoreFile: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.mode = "apply";
    else if (a === "--restore") {
      out.mode = "restore";
      out.restoreFile = argv[++i] ?? null;
    } else if (a === "--tenant") out.tenant = argv[++i] ?? "dtd";
    else if (a === "--backup") out.backupPath = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage(): void {
  info(`sync-servicios-detalle — proyecta lib/servicios-detalle.ts → service_configs

  node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/sync-servicios-detalle.ts [flags]

  (sin flags)          dry-run: muestra el diff contra la DB, NO escribe
  --apply              escribe las filas que difieren (guarda backup antes)
  --restore <file>     revierte usando un backup JSON
  --tenant <slug>      tenant a sincronizar (default: dtd)
  --backup <file>      override de la ruta del backup (default: temp del SO)
  --help               esta ayuda

  Requiere NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (en .env.local).`);
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) die("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno (.env.local).");
  if (!serviceKey)
    die("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local). Se necesita service_role para escribir bajo RLS.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveTenantId(
  supabase: SupabaseClient,
  slug: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) die(`No pude resolver el tenant "${slug}": ${error.message}`);
  if (!data) die(`No existe el tenant con slug "${slug}".`);
  return (data as { id: string }).id;
}

async function fetchCurrentRows(
  supabase: SupabaseClient,
  tenantId: string,
  serviceKeys: string[],
): Promise<Map<string, CurrentRow>> {
  const cols = ["service_key", ...SYNC_COLUMN_KEYS].join(", ");
  const { data, error } = await supabase
    .from("service_configs")
    .select(cols)
    .eq("tenant_id", tenantId)
    .in("service_key", serviceKeys);
  if (error) die(`No pude leer service_configs: ${error.message}`);
  const rows = (data ?? []) as unknown as CurrentRow[];
  return new Map(rows.map((row) => [row.service_key, row]));
}

/** Formatea un valor para el diff legible (recorta prosa larga). */
function fmt(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (Array.isArray(v)) return `[${v.length} item(s)]`;
  if (typeof v === "object") return "{tabla}";
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

async function updateRow(
  supabase: SupabaseClient,
  tenantId: string,
  serviceKey: string,
  columns: Partial<SyncColumns>,
): Promise<void> {
  const { error } = await supabase
    .from("service_configs")
    .update(columns)
    .eq("tenant_id", tenantId)
    .eq("service_key", serviceKey);
  if (error) die(`UPDATE falló para "${serviceKey}": ${error.message}`);
}

function defaultBackupPath(tenant: string, stampIso: string): string {
  const safeStamp = stampIso.replace(/[:.]/g, "-");
  const dir = path.join(tmpdir(), "dtd-sync-servicios-detalle");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `${tenant}-${safeStamp}.json`);
}

type BackupRow = { service_key: string; columns: Partial<SyncColumns> };

// ────────────────────────────────────────────────
// Comandos
// ────────────────────────────────────────────────

async function runSync(args: ParsedArgs): Promise<void> {
  const supabase = getClient();
  const tenantId = await resolveTenantId(supabase, args.tenant);
  const plan = buildSyncPlan(SERVICE_CATALOG, SERVICIOS_DETALLE_BY_SLUG);

  info(`${C.d}── sync servicios-detalle · tenant ${args.tenant} · modo ${args.mode} ──${C.n}`);
  if (plan.skippedNoLegacy.length)
    info(`${C.d}  sin ficha estática (esperado): ${plan.skippedNoLegacy.join(", ")}${C.n}`);
  if (plan.missingFicha.length)
    warn(`legacySlug sin ficha (drift, revisar): ${plan.missingFicha.map((m) => `${m.id}→${m.legacySlug}`).join(", ")}`);

  const current = await fetchCurrentRows(
    supabase,
    tenantId,
    plan.rows.map((r) => r.serviceKey),
  );

  const toChange: { row: SyncRow; diffs: FieldDiff[]; before: Partial<SyncColumns> }[] = [];
  const missingInDb: string[] = [];

  for (const row of plan.rows) {
    const cur = current.get(row.serviceKey);
    if (!cur) {
      missingInDb.push(row.serviceKey);
      continue;
    }
    const diffs = diffColumns(cur, row.columns);
    if (diffs.length) toChange.push({ row, diffs, before: pickSyncColumns(cur) });
  }

  if (missingInDb.length)
    warn(`No existen en la DB (¿migración 0130 aplicada?): ${missingInDb.join(", ")}`);

  if (!toChange.length) {
    ok("Nada que sincronizar: la DB ya coincide con el estático (no-op).");
    return;
  }

  info(`\n${toChange.length} servicio(s) con diferencias:`);
  for (const { row, diffs } of toChange) {
    info(`\n  ${C.d}${row.serviceKey}${C.n} (${row.legacySlug}) — ${diffs.length} columna(s):`);
    for (const d of diffs) {
      info(`    · ${String(d.column)}`);
      info(`        DB:  ${fmt(d.from)}`);
      info(`        new: ${fmt(d.to)}`);
    }
  }

  if (args.mode === "dry-run") {
    info(`\n${C.y}dry-run: no escribí nada.${C.n} Corré con --apply para aplicar.`);
    return;
  }

  // --apply: backup primero (reversible), luego UPDATE solo de lo que cambia.
  const stamp = new Date().toISOString();
  const backupPath = args.backupPath ?? defaultBackupPath(args.tenant, stamp);
  const backup: BackupRow[] = toChange.map(({ row, before }) => ({
    service_key: row.serviceKey,
    columns: before,
  }));
  writeFileSync(backupPath, JSON.stringify({ tenant: args.tenant, stamp, rows: backup }, null, 2), "utf8");
  ok(`Backup de los valores previos: ${backupPath}`);

  for (const { row } of toChange) {
    await updateRow(supabase, tenantId, row.serviceKey, row.columns);
    info(`  ${C.g}↑${C.n} ${row.serviceKey}`);
  }
  ok(`${toChange.length} servicio(s) sincronizado(s). Revertir: --restore "${backupPath}"`);
}

async function runRestore(args: ParsedArgs): Promise<void> {
  if (!args.restoreFile) die("Falta la ruta del backup: --restore <file>.");
  const raw = readFileSync(args.restoreFile, "utf8");
  const parsed = JSON.parse(raw) as { tenant?: string; rows?: BackupRow[] };
  const rows = parsed.rows ?? [];
  if (!rows.length) die("El backup no tiene filas.");

  const supabase = getClient();
  const tenant = parsed.tenant ?? args.tenant;
  const tenantId = await resolveTenantId(supabase, tenant);

  info(`${C.d}── restore · tenant ${tenant} · ${rows.length} fila(s) ──${C.n}`);
  for (const r of rows) {
    await updateRow(supabase, tenantId, r.service_key, r.columns);
    info(`  ${C.g}↺${C.n} ${r.service_key}`);
  }
  ok(`Restaurado ${rows.length} servicio(s) desde el backup.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (args.mode === "restore") await runRestore(args);
  else await runSync(args);
}

// CLI guard: solo corre si se invoca directo (importable en tests sin side effects).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(`${C.r}✗ ${err instanceof Error ? err.message : String(err)}${C.n}`);
    process.exit(1);
  });
}
