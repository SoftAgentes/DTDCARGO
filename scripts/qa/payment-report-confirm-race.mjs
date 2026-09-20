// SDD-0484 · Carrera real de dos confirmaciones sobre la MISMA factura.
//
// PGlite tiene una sola conexión: no puede probar que la regla del saldo de
// 0464 aguante dos confirmaciones simultáneas. Este script usa un postgres:17
// desechable propio (nunca una base de red), carga la fixture sintética del
// contrato 0421 y aplica 0464. Factura con saldo 980 y dos reportes de 980.
//
// Sin sleeps arbitrarios: la sesión O retiene un advisory lock; S1 confirma y
// espera ese lock con la factura bloqueada FOR UPDATE; S2 confirma y se
// comprueba en pg_stat_activity que espera un lock de fila. Recién entonces se
// termina O, S1 hace COMMIT y S2 continúa.
//
//   node scripts/qa/payment-report-confirm-race.mjs              → exige una sola
//     confirmación, S2 rechazada con PAYMENT_INVOICE_PAID y pagado 1000.
//   node scripts/qa/payment-report-confirm-race.mjs --sin-0464   → control: sin
//     0464 la carrera acredita dos veces (1980); falla si NO lo reproduce.
//   node scripts/qa/payment-report-confirm-race.mjs --migracion <archivo>
//     → aplica otro archivo en lugar de 0464 (p. ej. un mutante sin el
//     FOR UPDATE de la factura) y exige lo mismo que el modo normal.
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const control = args.includes("--sin-0464");
const altIndex = args.indexOf("--migracion");
const alternative = altIndex >= 0 ? resolve(args[altIndex + 1] ?? "") : null;
const SUPABASE = resolve(process.cwd(), "supabase");
const C = `dtd_race0464_${process.pid}`;

const docker = (list, input) => spawnSync("docker", list, { input, encoding: "utf8" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function psql(sql) {
  const r = docker(["exec", "-i", C, "psql", "-U", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], sql);
  if (r.status !== 0) throw new Error("psql: " + r.stdout + r.stderr);
  return r.stdout.trim();
}
const finished = new Map();
function session(name, sql) {
  const child = spawn("docker", ["exec", "-i", C, "psql", "-U", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"]);
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  child.stdin.end(sql);
  return new Promise((done) => child.on("close", (code) => {
    const result = { code, error: (out.match(/ERROR:\s+(.*)$/m) ?? [])[1] ?? null };
    finished.set(name, { ...result, out });
    done(result);
  }));
}
// Si una sesión termina antes de llegar a la espera, se informa su salida en
// vez de agotar el tiempo.
async function until(label, sql, watching = []) {
  for (let t0 = Date.now(); Date.now() - t0 < 30_000; await sleep(150)) {
    if (psql(sql) === "t") return;
    const early = watching.find((name) => finished.has(name));
    if (early) throw new Error(`${early} terminó antes de ${label}: ${finished.get(early).out}`);
  }
  throw new Error("timeout esperando: " + label);
}
const id = (label) => `md5('0421-synthetic-${label}')::uuid`;
const confirm = (n) => `begin;
select set_config('request.jwt.claim.sub', ${id("accounting-A")}::text, true);
set local role authenticated;
select public.resolve_payment_report(${id("race-req-" + n)}, ${id("race-" + n)}, 'confirmado', 'Carrera sesión ${n}');
reset role;
${n === 1 ? "select pg_advisory_lock(4242);" : ""}
commit;`;

let failed = false;
try {
  const up = docker(["run", "--rm", "-d", "--name", C, "-e", "POSTGRES_PASSWORD=postgres",
    "-e", "POSTGRES_INITDB_ARGS=--nosync", "-v", `${SUPABASE}:/sb:ro`,
    "postgres:17", "-c", "fsync=off", "-c", "full_page_writes=off"]);
  if (up.status !== 0) throw new Error("no se pudo levantar postgres:17: " + up.stderr);
  for (let i = 0; i < 80 && docker(["exec", C, "pg_isready", "-U", "postgres"]).status !== 0; i++) await sleep(500);
  await sleep(1000);
  const fixture = docker(["exec", C, "psql", "-U", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1",
    "-v", "fixture_only=true", "-f", "/sb/tests/0421_payment_report_commands.test.sql"]);
  if (fixture.status !== 0) throw new Error("fixture 0421: " + fixture.stdout + fixture.stderr);
  if (!control) {
    let target = "/sb/migrations/0464_reporte_pago_factura_pagada.sql";
    if (alternative) {
      if (docker(["cp", alternative, `${C}:/tmp/alternativa.sql`]).status !== 0) throw new Error("no se copió " + alternative);
      target = "/tmp/alternativa.sql";
    }
    const migration = docker(["exec", C, "psql", "-U", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", target]);
    if (migration.status !== 0) throw new Error("migración: " + migration.stdout + migration.stderr);
  }
  psql(`insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
    values (${id("race-invoice")}, ${id("tenant-A")}, 'F-CARRERA', 'DUP', 'synthetic', 1000, 1000, 20, 'emitida', 'USD');
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
    select md5('0421-synthetic-' || r)::uuid, ${id("tenant-A")}, ${id("race-invoice")}, 'F-CARRERA', 'DUP', 980, 'USD',
      'transferencia', current_date - 1, 'Nota sintética', 'carrera/' || r || '.pdf'
    from unnest(array['race-1', 'race-2']) r;`);

  const holder = session("O", "select pg_advisory_lock(4242); select pg_sleep(120);");
  await until("O retiene el advisory lock",
    "select exists(select 1 from pg_locks where locktype = 'advisory' and objid = 4242 and granted)", ["O"]);
  const s1 = session("S1", confirm(1));
  // psql manda sentencia por sentencia: S1 ya confirmó cuando su consulta en
  // curso es el advisory lock. O, en cambio, duerme en pg_sleep.
  await until("S1 confirmó y espera con la factura bloqueada",
    "select exists(select 1 from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory' and query like '%pg_advisory_lock(4242)%' and query not like '%pg_sleep%')", ["O", "S1"]);
  const s2 = session("S2", confirm(2));
  await until("S2 espera un lock de fila",
    "select exists(select 1 from pg_stat_activity where wait_event_type = 'Lock' and wait_event <> 'advisory' and query like '%Carrera sesión 2%')", ["O", "S1", "S2"]);
  psql("select pg_terminate_backend(pid) from pg_stat_activity where query like '%pg_sleep(120)%' and pid <> pg_backend_pid()");
  const [r1, r2] = await Promise.all([s1, s2]);
  await holder;
  const state = JSON.parse(psql(`select json_build_object(
    'pagado', (select paid_amount from public.invoices where id = ${id("race-invoice")}),
    'confirmados', (select count(*) from public.payment_reports where invoice_id = ${id("race-invoice")} and status = 'confirmado'),
    'recibos', (select count(*) from payment_private.report_commands where request_id in (${id("race-req-1")}, ${id("race-req-2")})))`));
  const summary = { modo: control ? "sin 0464" : alternative ?? "0464", s1: r1, s2: r2, ...state };
  console.log(JSON.stringify(summary));
  if (control) {
    failed = !(r1.code === 0 && r2.code === 0 && Number(state.pagado) === 1980 && state.confirmados === 2);
    console.log(failed ? "FAIL: el control no reprodujo la doble acreditación; la prueba no es sensible."
      : "PASS (control): sin 0464 las dos confirmaciones se acreditan y la factura queda en 1980/1000.");
  } else {
    failed = !(r1.code === 0 && r2.code !== 0 && r2.error === "PAYMENT_INVOICE_PAID"
      && Number(state.pagado) === 1000 && state.confirmados === 1 && state.recibos === 1);
    console.log(failed ? "FAIL: dos confirmaciones concurrentes no respetaron el saldo."
      : "PASS: la segunda confirmación esperó la factura y se rechazó con PAYMENT_INVOICE_PAID; pagado 1000/1000.");
  }
} catch (error) {
  failed = true;
  console.log("FAIL: " + (error instanceof Error ? error.message : String(error)));
} finally {
  docker(["rm", "-f", C]);
}
process.exit(failed ? 1 : 0);
