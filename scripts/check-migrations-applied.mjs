#!/usr/bin/env node
/**
 * scripts/check-migrations-applied.mjs — ¿hay migraciones NUEVAS en el repo que
 * nunca llegaron a prod?
 *
 * POR QUÉ EXISTE
 * La 0228 estuvo DOS rondas /GOLD perdida: el archivo vivía en el repo, nunca se
 * aplicó, y la ronda siguiente construyó el scorecard encima. Reventó sola, tarde
 * y con un error que no explicaba nada (`column s.industry does not exist`). El
 * ledger de prod saltaba de 0227 a 0229 y nadie lo miraba. Este check lo mira.
 * (La 0169 sigue perdida hoy por lo mismo — ver el baseline.)
 *
 * QUÉ **NO** HACE: buscar huecos en la numeración. Faltan 0061-0065, 0089, 0099,
 * 0111, 0112 en disco y está bien — números que nunca se usaron. El hueco de la
 * 0228 no estaba en disco, estaba en PROD.
 *
 * CÓMO DECIDE (línea de corte — ver supabase/migrations-baseline.json)
 * El `name` del ledger es texto libre y en 233 migraciones históricas divergió de
 * mil formas del basename del archivo. Reconciliarlas 1:1 son 62 casos de ruido, y
 * un gate ruidoso se ignora (así se perdió la 0228). En vez de eso: todo lo
 * histórico ya está en prod → se congela con un `cutoff`. El check solo exige lo
 * NUEVO (número > cutoff), donde rige la regla hacia adelante: una migración se
 * aplica con su basename EXACTO como `name`. `pendingBelowCutoff` cubre las
 * excepciones conocidas por debajo del corte (0017, 0169).
 *
 * DEGRADA, NO ROMPE (mismo criterio que el paso e2e de verify.mjs): sin
 * credenciales, sin red, o sin la RPC 0239 aplicada → SKIP, nunca rojo. El gate no
 * se cae por algo ajeno al cambio. La contra: en un worktree sin `.env.local` este
 * check no corre — es el mismo pitfall conocido del e2e.
 *
 * Lee el ledger vía la RPC `applied_migration_names()` (migr 0239). No usa la CLI de
 * Supabase ni DATABASE_URL a propósito: la CLI exige un PAT, y guardar un PAT en el
 * árbol del proyecto está PROHIBIDO (AGENTS.md).
 *
 * Uso:  node scripts/check-migrations-applied.mjs
 * Exit: 0 = al día (o skip) · 1 = hay migraciones nuevas sin aplicar · 2 = bug del check
 */
import fs from "node:fs";
import path from "node:path";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const BASELINE_FILE = path.join(process.cwd(), "supabase", "migrations-baseline.json");

// Señal de salida controlada. NO se usa process.exit() en medio de la lógica: con
// un socket de `fetch` (undici) a medio cerrar, process.exit() sincrónico revienta
// libuv en Windows ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)", exit
// 127) → el gate lo vería como FALLO en vez de SKIP. En su lugar se lanza esta señal;
// el único exit real vive al final, tras cerrar el dispatcher de undici.
class Exit {
  constructor(code) {
    this.code = code;
  }
}

/** Salida limpia con SKIP: algo del entorno falta, no es culpa del cambio. */
function skip(reason) {
  console.log(`${C.yellow}[SKIP]${C.nc} migrations-applied: ${reason}`);
  throw new Exit(0);
}

/**
 * `.env.local` a mano: cero deps, y verify.mjs invoca cada paso con `node <entry>`
 * pelado (sin --env-file). Parser deliberadamente tonto — KEY=VALUE, ignora
 * comentarios y vacías, saca comillas envolventes. Alcanza para lo que se lee acá.
 * utf-8 con BOM: PowerShell le mete BOM a los archivos del repo y rompe la 1ª clave
 * (pitfall conocido, ver AGENTS.md) → se corta explícitamente.
 */
function readEnvLocal() {
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return out;
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

/** Los .sql de supabase/migrations, sin extensión. */
function localMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

/** Prefijo numérico del basename (0006b → 6, 0239_foo → 239). null si no arranca con NNNN. */
function migrationNumber(name) {
  const m = name.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function readBaseline() {
  let b;
  try {
    b = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  } catch (e) {
    // El baseline es parte del contrato del check: sin él no distingue señal de
    // ruido. Rojo, no skip — esto SÍ es del repo.
    console.log(`${C.red}[FAIL]${C.nc} migrations-applied: no pude leer ${BASELINE_FILE} → ${e.message}`);
    throw new Exit(1);
  }
  if (typeof b.cutoff !== "number") {
    console.log(`${C.red}[FAIL]${C.nc} migrations-applied: el baseline no tiene un 'cutoff' numérico`);
    throw new Exit(1);
  }
  return { cutoff: b.cutoff, pending: b.pendingBelowCutoff ?? {} };
}

async function fetchLedger(url, key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/applied_migration_names`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // PGRST202 = la función no existe → la 0239 todavía no se aplicó.
    if (res.status === 404 || body.includes("PGRST202")) {
      skip("falta la RPC applied_migration_names en prod → aplicá la migración 0239 (este check queda inerte hasta entonces)");
    }
    skip(`el ledger no respondió (HTTP ${res.status}) → ${body.slice(0, 160)}`);
  }
  return res.json();
}

async function main() {
  const env = { ...readEnvLocal(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    skip("sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (¿worktree sin .env.local?)");
  }

  const { cutoff, pending } = readBaseline();
  const files = localMigrations();

  let ledger;
  try {
    ledger = await fetchLedger(url, key);
  } catch (e) {
    if (e instanceof Exit) throw e; // un skip/fail ya decidido adentro; no re-envolver
    skip(`no se pudo consultar el ledger (¿sin red?) → ${e.message}`);
  }
  const appliedNames = new Set((ledger ?? []).map((r) => r.name).filter(Boolean));

  // Vigilamos SOLO lo nuevo: archivos con número > cutoff que no estén declarados
  // como espera conocida. Cada uno debe estar en el ledger con su basename EXACTO
  // (la regla hacia adelante). Lo ≤ cutoff se da por reconciliado (ver baseline).
  const missing = files.filter((f) => {
    const n = migrationNumber(f);
    if (n === null || n <= cutoff) return false; // histórico / sin prefijo → reconciliado
    if (f in pending) return false; // espera conocida por encima del corte (raro pero válido)
    return !appliedNames.has(f);
  });

  // Entradas de pending que ya no corresponden a ningún archivo: baseline envejecido.
  // No es rojo, pero se avisa — un baseline con basura vuelve a ser ruido.
  const stalePending = Object.keys(pending).filter((n) => !files.includes(n));

  console.log(
    `${C.dim}   ${files.length} archivos · ${appliedNames.size} en el ledger de prod · ` +
      `corte en ${String(cutoff).padStart(4, "0")} (solo se vigila lo posterior)${C.nc}`,
  );

  for (const [name, reason] of Object.entries(pending)) {
    if (!files.includes(name)) continue;
    console.log(`${C.yellow}   ⏸ ${name}${C.nc} — sin aplicar A PROPÓSITO:`);
    console.log(`${C.dim}      ${reason}${C.nc}`);
  }
  for (const n of stalePending) {
    console.log(`${C.yellow}   ⚠ baseline vencido: '${n}' no existe como archivo → sacalo de pendingBelowCutoff${C.nc}`);
  }

  if (missing.length > 0) {
    console.log(`${C.red}[FAIL]${C.nc} ${missing.length} migración(es) NUEVA(s) en el repo que NO están en prod:`);
    for (const m of missing) console.log(`${C.red}   🔴 ${m}${C.nc}`);
    console.log(
      `${C.dim}\n   Qué hacer, en este orden:\n` +
        `   1. Si hay que aplicarla → OK explícito del founder NOMBRANDO la migración, y de a UNA\n` +
        `      (no en bundle: si una falla, querés saber CUÁL y por qué — así se cazó la 0228).\n` +
        `      Aplicala con su basename EXACTO como 'name' (es lo que este check espera).\n` +
        `   2. Si NO se debe aplicar todavía → agregala a 'pendingBelowCutoff' en\n` +
        `      supabase/migrations-baseline.json con el motivo y quién lo destraba.\n` +
        `   3. Tras aplicar una tanda → subí 'cutoff' al número más alto ya aplicado.${C.nc}`,
    );
    throw new Exit(1);
  }

  console.log(`${C.green}[OK]${C.nc}   migrations-applied: no hay migraciones nuevas sin aplicar`);
  throw new Exit(0);
}

// Único punto de salida. Toda ruta termina lanzando `Exit`; un error inesperado
// (bug del check) sale 2 para distinguirlo de "hay migraciones sin aplicar" (1).
//
// No se llama process.exit(): con un socket keep-alive de undici (fetch) vivo,
// process.exit() sincrónico revienta libuv en Windows (exit 127) y el gate lo
// leería como fallo. En su lugar se cierra el dispatcher global de undici — eso
// cierra sus sockets, el event loop drena y el proceso sale SOLO con exitCode
// puesto. Cerrar el dispatcher es best-effort: si el símbolo interno cambia de
// versión, el fallback es dejar que el keep-alive expire (unos segundos más).
async function closeUndici() {
  try {
    const d = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (d?.close) await d.close();
  } catch {
    /* best-effort: sin cierre explícito, el loop drena cuando el keep-alive vence */
  }
}

main()
  .catch((e) => {
    if (e instanceof Exit) return e.code;
    console.log(`${C.red}[FAIL]${C.nc} migrations-applied: error inesperado → ${e?.stack ?? e}`);
    return 2;
  })
  .then(async (code) => {
    await closeUndici();
    process.exitCode = code;
  });
