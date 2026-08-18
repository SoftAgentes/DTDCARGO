#!/usr/bin/env node
/**
 * ¿El schema del ERP se puede reconstruir DESDE CERO con lo que hay en el repo?
 *
 * Aplica las 267 migraciones en orden sobre un PostgreSQL limpio (más los stubs
 * de la plataforma Supabase, ver `supabase/tests/_supabase-platform-stubs.sql`).
 *
 * POR QUÉ IMPORTA: el gate `migrations-applied` compara NOMBRES contra el ledger
 * de prod — no que el archivo sea ejecutable ni que el repo sea completo. Esta
 * verificación caza lo que aquél no puede:
 *
 *   · Migraciones que nunca se podrían aplicar. La 0030 llevaba meses con
 *     `COMMENT ON ... IS 'a' || 'b'` (error de sintaxis) sin que nadie lo
 *     notara, porque en prod el objeto ya tenía su comentario.
 *   · Objetos que viven SOLO en prod, creados fuera de banda. `rls_auto_enable()`
 *     recibe grant/revoke en 0209 y 0211 pero ninguna migración la crea: su
 *     código no está versionado, nadie lo puede revisar, y una reconstrucción
 *     lo perdería. Está declarado abajo en ORPHAN_ALLOWLIST — el gate se pone
 *     rojo si aparece una función huérfana NUEVA.
 *
 * Cada migración se aplica con `--single-transaction`, igual que Supabase: sin
 * eso, un `create temporary table ... on commit drop` (0263) muere antes de que
 * la use el statement siguiente.
 *
 * DEGRADA CON GRACIA: sin Docker (o con `VERIFY_SKIP_SQL=1`) → SKIP, nunca rojo.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import crypto from "node:crypto";

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  nc: "\x1b[0m",
};

/**
 * Funciones que reciben grant/revoke en alguna migración pero que NINGUNA
 * migración crea → existen sólo en prod. Cada entrada es deuda declarada: el
 * código real hay que recuperarlo de prod y meterlo en una migración.
 * Que algo esté acá NO lo bendice; lo hace visible.
 */
const ORPHAN_ALLOWLIST = {
  // (vacía) — `rls_auto_enable` estuvo acá hasta que la 0277 la versionó.
};

/**
 * Migraciones que NO construyen schema: reparan el ledger de prod
 * (`supabase_migrations.schema_migrations`). Sus preflights exigen filas con md5
 * exactos de producción, así que sobre una base limpia no tienen nada que
 * reparar — por definición quedan fuera de una reconstrucción.
 *
 * No es un permiso para saltarse el gate: más abajo se verifica EMPÍRICAMENTE
 * que ninguna cambie el schema del producto.
 */
const LEDGER_ONLY = new Set([
  "0271_repair_branch_replay_history.sql",
  "0272_skip_superseded_invite_history.sql",
  "0273_skip_platform_admin_bootstrap_history.sql",
  "0274_restore_calculator_settings_history.sql",
  "0275_restore_pin_search_path_history.sql",
  "0276_restore_revoke_anon_rpc_sweep_history.sql",
  "0278_restore_rls_auto_enable_history.sql",
  "0279_restore_tenant_lifecycle_acl_history.sql",
  "0280_repair_sdd0118_split_history.sql",
  "0281_repair_invite_skip_split_history.sql",
  "0282_repair_platform_admin_skip_split_history.sql",
  "0283_repair_calculator_settings_split_history.sql",
  "0284_repair_pin_search_path_split_history.sql",
  "0285_repair_revoke_anon_split_history.sql",
  "0286_repair_tenant_acl_split_history.sql",
  "0287_repair_replay_gate_split_history.sql",
  "0288_finalize_replay_gate_split_history.sql",
]);
// ⚠️ MANTENIMIENTO: SDD-0118 sigue publicando migraciones de este tipo. Cuando el
// gate muera en una `*_history.sql` con un error "drift en <version> <name>", es
// una nueva sólo-ledger: agregala acá. La verificación empírica de más abajo se
// encarga de que no puedas colar DDL de negocio con esa excusa.

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const STUBS = resolve(process.cwd(), "supabase/tests/_supabase-platform-stubs.sql");
const SUPABASE_DIR = resolve(process.cwd(), "supabase");
const IMAGE = process.env.SQL_TEST_PG_IMAGE || "postgres:17";

const container = `dtd_rebuild_${crypto
  .createHash("sha1")
  .update(process.cwd())
  .digest("hex")
  .slice(0, 8)}`;

const docker = (args, opts = {}) =>
  spawnSync("docker", args, { encoding: "utf8", ...opts });

/**
 * Codigo de salida del SALTO — no es 0 a proposito.
 *
 * Antes este `skip` salia 0, asi que `verify.mjs` lo veia identico a un verde e
 * imprimia `[OK]`. Un cierre podia declarar "TODO VERDE" con este paso apagado,
 * y paso: cinco cierres publicaron con `migrations-applied` omitido, y el
 * 2026-08-15 el gate salio "verde" con `sql-tests` y `schema-rebuild` apagados
 * por no tener Docker levantado.
 *
 * Un paso que se omite en silencio es peor que uno que falla: el que falla se
 * arregla, el que se omite se cree.
 */
const EXIT_SKIPPED = 3;

function skip(reason) {
  console.log(`${C.yellow}[SKIP]${C.nc} schema-rebuild: ${reason}`);
  process.exit(EXIT_SKIPPED);
}

if (process.env.VERIFY_SKIP_SQL === "1") skip("VERIFY_SKIP_SQL=1 (omitido a pedido)");
if (!existsSync(MIGRATIONS_DIR) || !existsSync(STUBS)) skip("faltan migraciones o stubs");

// ── Chequeo estático: funciones referenciadas que nadie crea ──
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const created = new Set();
const referenced = new Map();
for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
  for (const m of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi,
  )) {
    created.add(m[1].toLowerCase());
  }
  for (const m of sql.matchAll(
    /(?:revoke|grant)\s+execute\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi,
  )) {
    const n = m[1].toLowerCase();
    if (!referenced.has(n)) referenced.set(n, new Set());
    referenced.get(n).add(f);
  }
}
const orphans = [...referenced.keys()].filter((n) => !created.has(n));
const nuevas = orphans.filter((n) => !(n in ORPHAN_ALLOWLIST));
const declaradas = orphans.filter((n) => n in ORPHAN_ALLOWLIST);

for (const n of declaradas) {
  console.log(`${C.yellow}   ⏸ ${n}()${C.nc} — sólo en prod, deuda declarada:`);
  console.log(`${C.dim}      ${ORPHAN_ALLOWLIST[n]}${C.nc}`);
}

if (nuevas.length > 0) {
  console.log(
    `${C.red}[FAIL]${C.nc} función(es) con grant/revoke que NINGUNA migración crea: ${nuevas.join(", ")}`,
  );
  console.log(
    `${C.dim}   O falta versionar su CREATE, o sobra el grant. Si de verdad vive sólo en prod,\n   declarala en ORPHAN_ALLOWLIST de este script con el motivo y quién la destraba.${C.nc}`,
  );
  process.exit(1);
}

// Las entradas obsoletas de la allowlist también son ruido: avisar.
for (const n of Object.keys(ORPHAN_ALLOWLIST)) {
  if (!orphans.includes(n)) {
    console.log(
      `${C.yellow}   ⚠${C.nc} ${n}() ya no es huérfana → sacala de ORPHAN_ALLOWLIST`,
    );
  }
}

// ── Reconstrucción real ──
const info = docker(["info", "--format", "{{.ServerVersion}}"]);
if (info.error || info.status !== 0) {
  skip("Docker no disponible → no se verifica la reconstrucción (no bloquea el gate)");
}

console.log(`${C.dim}   reconstruyendo ${files.length} migraciones sobre ${IMAGE}…${C.nc}`);

try {
  docker(["rm", "-f", container], { stdio: "ignore" });
  const up = docker([
    "run", "--rm", "-d",
    "--name", container,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-v", `${SUPABASE_DIR}:/sb:ro`,
    IMAGE,
    "-c", "fsync=off",
    "-c", "full_page_writes=off",
  ]);
  if (up.status !== 0) {
    skip(`no se pudo levantar ${IMAGE}: ${(up.stderr || "").trim().split("\n")[0]}`);
  }

  let ready = false;
  for (let i = 0; i < 90; i++) {
    // `select 1` y no `pg_isready`: el contenedor reinicia durante el initdb y
    // pg_isready da OK antes de que la base acepte consultas de verdad.
    if (docker(["exec", container, "psql", "-U", "postgres", "-q", "-c", "select 1"]).status === 0) {
      ready = true;
      break;
    }
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},600)"]);
  }
  if (!ready) skip("el contenedor de Postgres no aceptó conexiones a tiempo");

  // Extensiones que sólo existen en la imagen de Supabase: control-file vacío
  // para que `create extension` no reviente (el contenido lo dan los stubs).
  docker([
    "exec", container, "sh", "-c",
    'for e in supabase_vault pg_net pgsodium pg_cron http; do d=$(pg_config --sharedir)/extension; ' +
      'printf "default_version = \'1.0\'\\ncomment = \'stub\'\\nrelocatable = true\\n" > $d/$e.control; ' +
      'printf -- "-- stub\\n" > $d/$e--1.0.sql; done',
  ]);

  const stubs = docker([
    "exec", container,
    "psql", "-U", "postgres", "-q", "--single-transaction",
    "-v", "ON_ERROR_STOP=1",
    "-f", "/sb/tests/_supabase-platform-stubs.sql",
  ]);
  if (stubs.status !== 0) {
    console.log(`${C.red}[FAIL]${C.nc} los stubs de plataforma no aplican:`);
    console.log(`${C.dim}   ${(stubs.stdout + stubs.stderr).split("\n").filter((l) => l.includes("ERROR:")).slice(0, 2).join("\n   ")}${C.nc}`);
    process.exit(1);
  }

  // LC_ALL=C: con locale UTF-8 el sort ignora el `_` y pone 0124b ANTES de
  // 0124_, que es justo el orden inverso al real.
  const run = docker([
    "exec", container, "sh", "-c",
    `SKIP="${[...LEDGER_ONLY].join(" ")}"; ` +
    'ok=0; for f in $(ls /sb/migrations/*.sql | LC_ALL=C sort); do ' +
      'b=$(basename $f); case " $SKIP " in *" $b "*) continue;; esac; ' +
      'if psql -U postgres -q --single-transaction -v ON_ERROR_STOP=1 -f "$f" >/tmp/o.txt 2>&1; then ok=$((ok+1)); ' +
      'else echo "FALLA_EN|$(basename $f)|$ok"; grep -m1 "ERROR:" /tmp/o.txt; exit 1; fi; done; echo "OK|$ok"',
  ]);

  const out = `${run.stdout || ""}${run.stderr || ""}`;
  const failLine = out.split("\n").find((l) => l.startsWith("FALLA_EN|"));
  if (failLine) {
    const [, file, count] = failLine.split("|");
    const err = out.split("\n").find((l) => l.includes("ERROR:")) || "";
    console.log(`${C.red}[FAIL]${C.nc} el schema NO se reconstruye: murió en ${file} (tras ${count} migraciones)`);
    console.log(`${C.dim}   ${err.trim()}${C.nc}`);
    console.log(`${C.dim}   Si la migración ya está en prod, el archivo del repo igual tiene que ser aplicable:\n   una base que no se puede reconstruir no se puede auditar ni restaurar.${C.nc}`);
    if (/drift en |supabase_migrations/.test(err)) {
      console.log(
        `${C.yellow}   → Ese error es de un preflight de LEDGER (SDD-0118): la migración repara\n     supabase_migrations y no tiene nada que reparar en una base limpia.\n     Agregá "${file}" a LEDGER_ONLY en este script. El chequeo empírico de\n     abajo verifica igual que no toque tablas, funciones ni policies.${C.nc}`,
      );
    }
    process.exit(1);
  }

  const okLine = out.split("\n").find((l) => l.startsWith("OK|"));
  const n = okLine ? okLine.split("|")[1] : "?";
  console.log(`${C.dim}   ${n} migraciones aplicadas desde cero · schema reconstruible${C.nc}`);

  // ── Las LEDGER_ONLY no pueden esconder DDL de negocio ──
  // Verificación EMPÍRICA, no por texto: esos archivos guardan SQL histórico
  // dentro de literales, así que buscar "create table" en el fuente da falsos
  // positivos. Se corren sobre el schema ya construido (su preflight las aborta,
  // que es lo esperado) y se compara la huella del schema antes y después. Si
  // alguna lograra ejecutar DDL del producto, la huella cambia.
  const HUELLA = `select md5(string_agg(x, '|' order by x)) from (
      select 'T:'||c.relname||':'||c.relrowsecurity::text as x
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('r','v')
      union all
      select 'F:'||p.proname||':'||pg_get_function_identity_arguments(p.oid)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      union all
      select 'P:'||pol.polname||':'||pol.polrelid::regclass::text from pg_policy pol
    ) s`;
  const huella = () =>
    (docker(["exec", container, "psql", "-U", "postgres", "-q", "-t", "-A", "-c", HUELLA]).stdout || "").trim();

  const antes = huella();
  for (const f of LEDGER_ONLY) {
    docker([
      "exec", container, "psql", "-U", "postgres", "-q",
      "--single-transaction", "-v", "ON_ERROR_STOP=1",
      "-f", `/sb/migrations/${f}`,
    ]); // se espera que aborte por preflight; el status no importa acá
  }
  if (!antes || antes !== huella()) {
    console.log(`${C.red}[FAIL]${C.nc} una migración de LEDGER_ONLY cambió el schema del producto.`);
    console.log(
      `${C.dim}   Están exentas de la reconstrucción porque sólo reparan supabase_migrations.\n   Si tocan tablas, funciones o policies, no merecen la exención.${C.nc}`,
    );
    process.exit(1);
  }
  console.log(
    `${C.dim}   ${LEDGER_ONLY.size} migraciones sólo-ledger verificadas: no tocan el schema${C.nc}`,
  );

  // Sobre ese schema completo (219 tablas reales, no un fixture recortado)
  // corremos el contrato de aislamiento multi-tenant. Reusa la base ya
  // construida: cuesta ~1s más, no otros 18.
  const iso = docker([
    "exec", container,
    "psql", "-U", "postgres", "-q",
    "-v", "ON_ERROR_STOP=1",
    "-f", "/sb/tests/_tenant-isolation.assert.sql",
  ]);
  if (iso.status !== 0) {
    const err = `${iso.stdout || ""}${iso.stderr || ""}`
      .split("\n")
      .filter((l) => l.includes("ERROR:"))
      .slice(0, 2)
      .join("\n   ");
    console.log(`${C.red}[FAIL]${C.nc} contrato de aislamiento multi-tenant roto:`);
    console.log(`${C.dim}   ${err}${C.nc}`);
    console.log(
      `${C.dim}   Es LA propiedad de la que cuelga todo el ERP: que un tenant no vea los datos de otro.${C.nc}`,
    );
    process.exit(1);
  }
  console.log(`${C.dim}   aislamiento multi-tenant verificado (barrido de 219 tablas + 2 tenants reales)${C.nc}`);
} finally {
  docker(["rm", "-f", container], { stdio: "ignore" });
}

process.exit(0);
