/**
 * scripts/check-migrations-applied.mjs — ¿hay migraciones NUEVAS en el repo que
 * nunca llegaron a prod?
 *
 * SIN SHEBANG a propósito: este módulo se importa desde su test (para probar la
 * lógica pura) y el `#!` de la línea 1 rompe el parser de Vite —inyecta el require
 * transformado antes del shebang→ "Invalid or unexpected token". No hace falta:
 * verify.mjs lo invoca siempre como `node <entry>`, nunca como ejecutable.
 *
 * POR QUÉ EXISTE
 * La 0228 estuvo DOS rondas /GOLD perdida: el archivo vivía en el repo, nunca se
 * aplicó, y la ronda siguiente construyó el scorecard encima. Reventó sola, tarde
 * y con un error que no explicaba nada (`column s.industry does not exist`). El
 * ledger de prod saltaba de 0227 a 0229 y nadie lo miraba. Este check lo mira.
 * (La 0169 cayó en la misma trampa y estuvo una ronda perdida; se aplicó el
 * 2026-07-16. Ambas están cerradas.)
 *
 * PUNTO CIEGO CERRADO (2026-08-05) — SE MIDE `origin/main` ∪ EL CHECKOUT: antes la
 * lista salía sólo de `supabase/migrations/` del árbol donde corre, así que en un
 * checkout atrasado los archivos nuevos no existían en disco, no se comparaban
 * contra nada y el paso salía VERDE POR OMISIÓN. Así pasaron las 0317-0324:
 * estaban en `main` (y su código desplegado en prod) pero no en la DB, y acá se
 * veía verde. Ya no hay que acordarse de sincronizar antes de creerle.
 *
 * La unión es a propósito, y cada mitad cubre un caso distinto:
 *   · `origin/main` → lo que YA está publicado y quizá no está en tu disco.
 *   · el checkout    → lo que estás escribiendo y todavía no pusheaste.
 * Si git no se puede consultar (sin remoto, clone shallow, sin red) NO se cae al
 * verde silencioso: avisa en pantalla que está midiendo sólo el checkout.
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
 * excepciones conocidas por debajo del corte (hoy: 0017 y 0257).
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
import { execFileSync } from "node:child_process";

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

/** Los .sql de supabase/migrations EN DISCO, sin extensión. */
function diskMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""));
}

/**
 * Los .sql de supabase/migrations EN `origin/main`, sin extensión.
 *
 * Devuelve `null` —no `[]`— cuando git no se puede consultar. La diferencia
 * importa: `[]` diría "main no tiene migraciones", que es falso y volvería al
 * verde por omisión que este check existe para evitar. `null` significa "no sé",
 * y el caller lo reporta en pantalla.
 *
 * El `fetch` es best-effort: sin red se sigue con la ref local, que igual suele
 * estar más adelantada que un worktree viejo.
 */
function mainMigrations() {
  try {
    try {
      execFileSync("git", ["fetch", "origin", "main", "--quiet"], {
        stdio: "ignore",
        timeout: 20_000,
      });
    } catch {
      // Sin red / sin remoto: seguimos con la ref local de origin/main.
    }

    const out = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", "origin/main", "--", "supabase/migrations"],
      { encoding: "utf8", timeout: 20_000 },
    );

    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.endsWith(".sql"))
      // git siempre devuelve rutas con "/", también en Windows.
      .map((l) => l.slice(l.lastIndexOf("/") + 1).replace(/\.sql$/, ""));
  } catch {
    return null;
  }
}

/**
 * La lista contra la que se mide: `origin/main` ∪ disco.
 *
 * @returns {{files: string[], sawMain: boolean}}
 */
export function collectMigrationFiles(fromMain, fromDisk) {
  const all = new Set(fromDisk);
  for (const f of fromMain ?? []) all.add(f);
  return { files: [...all].sort(), sawMain: fromMain !== null };
}

/** Prefijo numérico del basename (0006b → 6, 0239_foo → 239). null si no arranca con NNNN. */
export function migrationNumber(name) {
  const m = name.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * LA DECISIÓN DEL CHECK, pura y testeable: ¿qué archivos del repo deberían estar
 * en prod y no están?
 *
 * Vigila SOLO lo nuevo: archivos con número > cutoff que no estén declarados como
 * espera conocida. Cada uno debe estar en el ledger con su basename EXACTO (la
 * regla hacia adelante). Lo ≤ cutoff se da por reconciliado (ver el baseline: el
 * `name` histórico es texto libre y reconciliarlo 1:1 son 62 casos de ruido).
 *
 * @param {string[]} files        basenames de supabase/migrations (sin .sql)
 * @param {Set<string>} applied   `name`s presentes en el ledger de prod
 * @param {number} cutoff         último número histórico dado por reconciliado
 * @param {Record<string,string>} pending  esperas declaradas (archivo → motivo)
 * @returns {string[]} basenames que faltan aplicar
 */
export function findMissing(files, applied, cutoff, pending = {}) {
  return files.filter((f) => {
    const n = migrationNumber(f);
    if (n === null || n <= cutoff) return false; // histórico / sin prefijo → reconciliado
    if (f in pending) return false; // espera conocida por encima del corte (raro pero válido)
    return !applied.has(f);
  });
}

/**
 * `20260802225220` → epoch ms (UTC). `null` si no tiene la forma esperada.
 * El `version` del ledger de Supabase es siempre YYYYMMDDHHMMSS en UTC.
 */
export function parseLedgerVersion(version) {
  const m = String(version ?? "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/**
 * LA OTRA DIRECCIÓN: ¿qué hay APLICADO en prod que el repo no registra?
 *
 * `findMissing` compara repo → prod y caza el caso 0228 (archivo que nunca se
 * aplicó). Este compara prod → repo y caza el inverso, que es **peor**: el
 * archivo vive sólo en el worktree de quien la aplicó y si esa carpeta se borra
 * el schema deja de reconstruirse desde cero. No revienta nunca; simplemente un
 * día no se puede rehacer la base.
 *
 * Pasó el 2026-08-05 con 0336_pod_closes_shipment, 0337_feature_flags_seed_and_trigger
 * y 0338_ve_locality_catalog_read_policy: aplicadas el 2 y 3 de agosto, archivos
 * colgando de una rama sin pushear, gate en verde todo el tiempo.
 *
 * ── Por qué se parte en dos ────────────────────────────────────────────────
 * Con ~38 worktrees en paralelo, aplicar una migración y pushear su archivo
 * minutos después es el flujo NORMAL. Marcar rojo en esa ventana pondría en rojo
 * el gate de todas las demás ventanas por algo ajeno y transitorio — el camino
 * más corto a que el rojo se ignore, que es exactamente cómo se perdió la 0228.
 *
 * Así que se usa la edad, que el ledger ya trae en `version`:
 *   · recién aplicada (< gracia) → **en vuelo**, aviso amarillo
 *   · más vieja que la gracia    → **olvidada**, rojo
 *
 * Debajo del `cutoff` no se mira: ahí el `name` del ledger diverge del basename
 * por mil motivos históricos y sería puro ruido (es la razón de ser del baseline).
 *
 * @param {{version?: string, name?: string}[]} ledger
 * @param {string[]} files      basenames del repo (origin/main ∪ checkout)
 * @param {number} cutoff
 * @param {number} nowMs
 * @param {number} graceHours   ventana de "todavía puede estar pusheándose"
 * @returns {{enVuelo: {name: string, horas: number}[], olvidadas: {name: string, horas: number}[]}}
 */
export function findOrphans(ledger, files, cutoff, nowMs, graceHours = 24) {
  const fileSet = new Set(files);
  const enVuelo = [];
  const olvidadas = [];

  for (const row of ledger ?? []) {
    const name = row?.name;
    if (!name) continue;
    const n = migrationNumber(name);
    if (n === null || n <= cutoff) continue;
    if (fileSet.has(name)) continue;

    const appliedMs = parseLedgerVersion(row.version);
    // Sin fecha legible no se puede saber si está en vuelo → se trata como
    // olvidada. Ante la duda, que grite: el silencio es el modo de falla que
    // este check vino a eliminar.
    const horas = appliedMs === null ? Infinity : (nowMs - appliedMs) / 3_600_000;
    (horas >= graceHours ? olvidadas : enVuelo).push({ name, horas });
  }

  return { enVuelo, olvidadas };
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
  const { files, sawMain } = collectMigrationFiles(mainMigrations(), diskMigrations());
  if (!sawMain) {
    // No es un SKIP: el check sigue y mide lo que hay. Pero se dice en voz alta,
    // porque este verde vale menos que el otro — es el punto ciego histórico.
    console.log(
      `${C.yellow}[AVISO]${C.nc} migrations-applied: no pude leer origin/main → mido SÓLO el checkout (punto ciego: un árbol atrasado sale verde por omisión)`,
    );
  }

  let ledger;
  try {
    ledger = await fetchLedger(url, key);
  } catch (e) {
    if (e instanceof Exit) throw e; // un skip/fail ya decidido adentro; no re-envolver
    skip(`no se pudo consultar el ledger (¿sin red?) → ${e.message}`);
  }
  const appliedNames = new Set((ledger ?? []).map((r) => r.name).filter(Boolean));

  const missing = findMissing(files, appliedNames, cutoff, pending);
  const { enVuelo, olvidadas } = findOrphans(ledger, files, cutoff, Date.now());

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

  for (const o of enVuelo) {
    console.log(
      `${C.yellow}   ⏳ '${o.name}' está en prod y su archivo no está en el repo — aplicada hace ${o.horas.toFixed(1)} h, probablemente todavía sin pushear${C.nc}`,
    );
  }

  if (olvidadas.length > 0) {
    console.log(
      `${C.red}[FAIL]${C.nc} ${olvidadas.length} migración(es) APLICADA(s) en prod cuyo archivo NO está en el repo:`,
    );
    for (const o of olvidadas) {
      const edad = Number.isFinite(o.horas) ? `${(o.horas / 24).toFixed(1)} días` : "fecha ilegible";
      console.log(`${C.red}   🔴 ${o.name}${C.nc}${C.dim}  (aplicada hace ${edad})${C.nc}`);
    }
    console.log(
      `${C.dim}\n   La DB cambió y el repo no lo registra. Esto NO revienta solo: revienta\n` +
        `   el día que haya que reconstruir el schema desde cero, y para entonces el\n` +
        `   archivo puede no existir en ningún lado.\n\n` +
        `   Qué hacer:\n` +
        `   1. Buscá el worktree que tiene el .sql — suele ser el de quien la aplicó:\n` +
        `      git worktree list, y en cada uno: ls supabase/migrations/<nombre>.sql\n` +
        `   2. Llevá ESE archivo a main, tal cual (no lo reescribas: tiene que ser el\n` +
        `      que corrió). Si su código todavía no está listo, el .sql igual va —\n` +
        `      el repo debe poder rehacer la DB aunque la feature no esté publicada.\n` +
        `   3. Si el número choca con otro ya aplicado, NO renumeres: declaralo en\n` +
        `      CHOQUES_HISTORICOS de scripts/check-numbering.mjs.${C.nc}`,
    );
    throw new Exit(1);
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

// Solo corre el check cuando este archivo ES el entry point. Sin el guard, el test
// que importa findMissing/migrationNumber dispararía main() (red incluida) al
// importar. Mismo espíritu que el `if __name__ == '__main__'` de Python.
//
// Se compara con `import.meta.filename` en vez de pathToFileURL(): importar
// `node:url` acá rompe el test — Vite inyecta el require transformado ANTES del
// shebang de la línea 1 y el parser revienta con "Invalid Character `!`".
const isEntryPoint =
  process.argv[1] && import.meta.filename === path.resolve(process.argv[1]);

if (isEntryPoint) {
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
}
