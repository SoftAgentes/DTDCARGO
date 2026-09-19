// SDD-0488 · Carreras reales de cobros sobre facturas, con dos sesiones.
//
// PGlite tiene una sola conexión: no puede probar que dos cobros simultáneos,
// un cobro y una confirmación de reporte, o una anulación y cualquiera de los
// dos, no se pisen. Este script levanta un postgres:17 desechable propio (nunca
// una base de red), reconstruye el esquema COMPLETO desde supabase/migrations
// como check-schema-rebuild.mjs (con los stubs de plataforma), siembra un
// tenant sintético y corre cada escenario con dos sesiones psql reales.
//
// Sin sleeps: la sesión O retiene un advisory lock. S1 hace su primera parte y
// espera ese lock: las operaciones de la app vieja, entre la lectura y la
// escritura; las atómicas, dentro de su transacción, con los locks tomados. S2
// corre hasta terminar o hasta quedar esperando un lock, según
// pg_stat_activity. Recién entonces se termina O y S1 sigue.
//
// ANTES (esquema sin 0467): S1 y S2 repiten, request por request, lo que hacía
// lib/studio/collections-actions.ts por PostgREST. Cada request va en su propia
// transacción y el saldo se lee al principio. Tiene que reproducir la pérdida;
// si no la reproduce, la prueba no es sensible y el script falla.
// DESPUÉS (con 0467): las mismas carreras con las RPC. El invariante
//   paid_amount = recibos vigentes de la factura + reportes confirmados
// se cumple en toda factura, S2 esperó un lock y sale el rechazo esperado.
// Los escenarios 12 y 13 prueban que la regla de saldo del cobro y la de la
// confirmación de reportes (0464, SDD-0484) son la misma y se serializan:
// necesitan la 0464 en el esquema reconstruido.
//
//   node scripts/qa/cobro-factura-race.mjs              → ANTES + DESPUÉS.
//   node scripts/qa/cobro-factura-race.mjs --mutantes   → además, cinco mutantes
//     de 0467, cada uno sin uno de sus FOR UPDATE; cada mutante tiene que caer
//     en sus escenarios.
//   node scripts/qa/cobro-factura-race.mjs --migracion <archivo>
//     → DESPUÉS con otro archivo en lugar de 0467 y exige lo mismo.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const withMutants = args.includes("--mutantes");
const altIndex = args.indexOf("--migracion");
const alternative = altIndex >= 0 ? resolve(args[altIndex + 1] ?? "") : null;
const ROOT = process.cwd();
const SUPABASE = resolve(ROOT, "supabase");
const MIGRATION = "0467_cobro_factura_atomico.sql";
const C = `dtd_race0488_${process.pid}`;
const IMAGE = process.env.SQL_TEST_PG_IMAGE || "postgres:17";

// Las migraciones que sólo reparan el ledger de producción no construyen
// esquema: la lista vive en check-schema-rebuild.mjs y se lee de ahí.
const rebuildSource = readFileSync(resolve(ROOT, "scripts/check-schema-rebuild.mjs"), "utf8");
const LEDGER_ONLY = new Set([
  ...(rebuildSource.match(/const LEDGER_ONLY = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "").matchAll(/"([^"]+\.sql)"/g),
].map((match) => match[1]));
if (LEDGER_ONLY.size === 0) throw new Error("no se pudo leer LEDGER_ONLY de check-schema-rebuild.mjs");
const BEFORE_0467 = readdirSync(resolve(SUPABASE, "migrations"))
  .filter((name) => name.endsWith(".sql") && name < "0467_" && !LEDGER_ONLY.has(name))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const docker = (list, input) =>
  spawnSync("docker", list, { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function psql(db, sql) {
  const r = docker(["exec", "-i", C, "psql", "-U", "postgres", "-d", db, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], sql);
  if (r.status !== 0) throw new Error(`psql ${db}: ${r.stdout}${r.stderr}`);
  return r.stdout.trim();
}

// ── Identidades sintéticas ───────────────────────────────────
const TENANT = "0488aaaa-0000-4000-8000-000000000001";
const USER = "0488aaaa-0000-4000-8000-000000000002";
const CASH = "0488aaaa-0000-4000-8000-000000000003";
const MARKBOX = "DTD-0488";
let serial = 0;
const uuid = () => `0488bbbb-0000-4000-8000-${String(++serial).padStart(12, "0")}`;

// Variables psql: la semilla usa :'tenant', :'user', :'cash' y :'markbox'.
const SEED = `\\set tenant '${TENANT}'\n\\set user '${USER}'\n\\set cash '${CASH}'\n\\set markbox '${MARKBOX}'\n`
  + readFileSync(resolve(ROOT, "scripts/qa/cobro-factura-race.seed.sql"), "utf8");

// ── SQL de cada operación ────────────────────────────────────
// Cada «request» de la app vieja es una transacción con el rol y el usuario de
// la sesión, igual que PostgREST.
const AS_USER = `select set_config('test.uid', '${USER}', true) \\g /dev/null
set local role authenticated;`;
const request = (sql) => `begin;\n${AS_USER}\n${sql}\ncommit;\n`;
const PAUSE = (key) => `select pg_advisory_lock(${key}) \\g /dev/null\n`;

/** Seed por escenario: facturas, recibos y reportes con estado exacto. */
function invoiceSql(id, { total = 1000, paid = 0, status = "emitida", code } = {}) {
  return `insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name,
    base_amount, total_amount, paid_amount, status, currency, fx_rate, issued_at, due_date)
  values ('${id}', '${TENANT}', '${code ?? "F-" + id.slice(-6)}', '${MARKBOX}', 'Cliente sintético 0488',
    ${total}, ${total}, ${paid}, '${status}', 'USD', null, current_date, current_date + 30);\n`;
}
function receiptSql(id, invoiceId, amount, { sinRef = false } = {}) {
  return `insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name,
    amount, currency, method, cash_account_id, received_at, application_status, fund_class)
  values ('${id}', '${TENANT}', 'R-SEED-${id.slice(-6)}', ${sinRef ? "null" : `'${invoiceId}'`},
    ${sinRef ? "null" : `'${MARKBOX}'`}, ${sinRef ? "null" : "'Cliente sintético 0488'"},
    ${amount}, 'USD', 'transferencia', '${CASH}', current_date - 3,
    '${sinRef ? "recibido_sin_ref" : "aplicado"}', 'third_party');\n`;
}
function reportSql(id, invoiceId, amount) {
  return `insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount,
    currency, method, paid_at, note, proof_path)
  select '${id}', '${TENANT}', i.id, i.invoice_code, i.client_markbox, ${amount}, 'USD', 'transferencia',
    current_date - 1, 'Reporte sintético 0488',
    '${TENANT}/${invoiceId}/${id}/comprobante.pdf'
  from public.invoices i where i.id = '${invoiceId}';\n`;
}

// App vieja (collections-actions.ts antes de 0488), request por request.
const legacy = {
  cobro(invoiceId, amount, { pause, pauseAt = "lectura", v = "c" } = {}) {
    const read = request(`select paid_amount as ${v}_paid, total_amount as ${v}_total, tenant_id as ${v}_tenant,
      client_markbox as ${v}_markbox, client_name as ${v}_name from public.invoices where id = '${invoiceId}' \\gset`);
    const code = request(`select public.next_receipt_code(:'${v}_tenant') as ${v}_code \\gset`);
    const write = request(`insert into public.payment_receipts (tenant_id, receipt_code, invoice_id, client_markbox,
        client_name, amount, currency, method, cash_account_id, received_at, application_status, fund_class)
      values (:'${v}_tenant', :'${v}_code', '${invoiceId}', :'${v}_markbox', :'${v}_name', ${amount}, 'USD',
        'transferencia', '${CASH}', current_date, 'aplicado', 'third_party');`)
      + request(`update public.invoices set paid_amount = round(:${v}_paid + ${amount}, 2),
        status = (case when round(:${v}_paid + ${amount}, 2) >= :${v}_total then 'pagada' else 'parcial' end)::public.invoice_status,
        last_payment_at = now() where id = '${invoiceId}';`);
    const hold = pause ? PAUSE(pause) : "";
    return pauseAt === "codigo" ? read + code + hold + write : read + hold + code + write;
  },
  // Sin factura (un sin-ref) la app sólo anulaba el recibo.
  anulacion(receiptId, { pause, v = "a" } = {}) {
    const hold = pause ? PAUSE(pause) : "";
    return request(`select invoice_id is not null as ${v}_con_factura, coalesce(invoice_id::text, '') as ${v}_invoice,
        amount as ${v}_amount from public.payment_receipts where id = '${receiptId}' \\gset`)
      + request(`select public.void_payment_receipt_with_audit_reason('${receiptId}', 'Anulación de la carrera 0488') \\g /dev/null`)
      + `\\if :${v}_con_factura\n`
      + request(`select paid_amount as ${v}_paid from public.invoices where id = :'${v}_invoice' \\gset`)
      + hold
      + request(`update public.invoices set paid_amount = greatest(0, round(:${v}_paid - :${v}_amount, 2)),
        status = (case when greatest(0, round(:${v}_paid - :${v}_amount, 2)) <= 0 then 'emitida' else 'parcial' end)::public.invoice_status
        where id = :'${v}_invoice';`)
      + `\\else\n${hold}\\endif\n`;
  },
  identificacion(receiptId, invoiceId, { pause, v = "i" } = {}) {
    return request(`select amount as ${v}_amount from public.payment_receipts
        where id = '${receiptId}' and application_status = 'recibido_sin_ref' and deleted_at is null \\gset`)
      + request(`select paid_amount as ${v}_paid, total_amount as ${v}_total, client_markbox as ${v}_markbox,
        client_name as ${v}_name from public.invoices where id = '${invoiceId}' \\gset`)
      + (pause ? PAUSE(pause) : "")
      + request(`update public.payment_receipts set invoice_id = '${invoiceId}', client_markbox = :'${v}_markbox',
        client_name = :'${v}_name', application_status = 'aplicado', identified_at = now(), fund_class = 'third_party'
        where id = '${receiptId}';`)
      + request(`update public.invoices set paid_amount = round(:${v}_paid + :${v}_amount, 2),
        status = (case when round(:${v}_paid + :${v}_amount, 2) >= :${v}_total then 'pagada' else 'parcial' end)::public.invoice_status,
        last_payment_at = now() where id = '${invoiceId}';`);
  },
};

// Operaciones atómicas: con pausa, la transacción queda abierta con sus locks.
const atomic = (call, pause) =>
  `begin;\n${AS_USER}\n${call}\n${pause ? PAUSE(pause) : ""}commit;\n`;
const rpc = {
  cobro: (invoiceId, amount, { pause } = {}) => atomic(`select public.register_collection_receipt('${invoiceId}', ${amount},
    '${CASH}', 'transferencia', current_date, null, null, 'cliente', null, null, false) \\g /dev/null`, pause),
  anulacion: (receiptId, { pause } = {}) =>
    atomic(`select public.void_collection_receipt('${receiptId}', 'Anulación de la carrera 0488') \\g /dev/null`, pause),
  identificacion: (receiptId, invoiceId, { pause } = {}) =>
    atomic(`select public.identify_collection_receipt('${receiptId}', '${invoiceId}') \\g /dev/null`, pause),
};
const reporte = (reportId, { pause } = {}) => atomic(`select public.resolve_payment_report('${uuid()}'::uuid,
  '${reportId}'::uuid, 'confirmado', 'Confirmación de la carrera 0488') \\g /dev/null`, pause);

// ── Escenarios ───────────────────────────────────────────────
// s1/s2 reciben (fase, ids, clave de pausa). En ANTES la operación de la app
// es la vieja; en DESPUÉS, la RPC. La confirmación de reporte es 0421 en las dos.
const op = (phase) => (phase === "antes" ? legacy : rpc);
const SCENARIOS = [
  {
    id: 1, name: "cobro → cobro, misma factura",
    setup: (x) => invoiceSql(x.inv),
    s1: (p, x, k) => op(p).cobro(x.inv, 300, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).cobro(x.inv, 200, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  {
    id: 2, name: "cobro → cobro, entre los dos superan el saldo",
    setup: (x) => invoiceSql(x.inv),
    s1: (p, x, k) => op(p).cobro(x.inv, 600, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).cobro(x.inv, 600, { v: "s2" }),
    invoices: (x) => [x.inv],
    rejected: "PAYMENT_EXCEEDS_BALANCE",
  },
  {
    id: 3, name: "cobro → confirmación de reporte",
    setup: (x) => invoiceSql(x.inv) + reportSql(x.rep, x.inv, 200),
    s1: (p, x, k) => op(p).cobro(x.inv, 300, { pause: k, v: "s1" }),
    s2: (p, x) => reporte(x.rep),
    invoices: (x) => [x.inv],
  },
  {
    id: 4, name: "confirmación de reporte → cobro",
    setup: (x) => invoiceSql(x.inv) + reportSql(x.rep, x.inv, 200),
    s1: (p, x, k) => reporte(x.rep, { pause: k }),
    s2: (p, x) => op(p).cobro(x.inv, 300, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  {
    id: 5, name: "anulación → cobro",
    setup: (x) => invoiceSql(x.inv, { paid: 400, status: "parcial" }) + receiptSql(x.rec, x.inv, 400),
    s1: (p, x, k) => op(p).anulacion(x.rec, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).cobro(x.inv, 300, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  {
    id: 6, name: "anulación → confirmación de reporte",
    setup: (x) => invoiceSql(x.inv, { paid: 400, status: "parcial" }) + receiptSql(x.rec, x.inv, 400)
      + reportSql(x.rep, x.inv, 200),
    s1: (p, x, k) => op(p).anulacion(x.rec, { pause: k, v: "s1" }),
    s2: (p, x) => reporte(x.rep),
    invoices: (x) => [x.inv],
  },
  {
    id: 7, name: "identificación → identificación del mismo pago en otra factura",
    setup: (x) => invoiceSql(x.inv) + invoiceSql(x.inv2) + receiptSql(x.rec, null, 800, { sinRef: true }),
    s1: (p, x, k) => op(p).identificacion(x.rec, x.inv, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).identificacion(x.rec, x.inv2, { v: "s2" }),
    invoices: (x) => [x.inv, x.inv2],
    rejected: "PAYMENT_RECEIPT_APPLIED",
  },
  {
    id: 8, name: "cobro → cobro en otra factura del mismo tenant (código R-)",
    setup: (x) => invoiceSql(x.inv) + invoiceSql(x.inv2),
    s1: (p, x, k) => op(p).cobro(x.inv, 300, { pause: k, pauseAt: "codigo", v: "s1" }),
    s2: (p, x) => op(p).cobro(x.inv2, 200, { v: "s2" }),
    invoices: (x) => [x.inv, x.inv2],
  },
  {
    id: 9, name: "cobro → identificación en la misma factura",
    setup: (x) => invoiceSql(x.inv, { total: 2000 }) + receiptSql(x.rec, null, 800, { sinRef: true }),
    s1: (p, x, k) => op(p).cobro(x.inv, 300, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).identificacion(x.rec, x.inv, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  {
    id: 10, name: "identificación → anulación del mismo pago",
    setup: (x) => invoiceSql(x.inv) + receiptSql(x.rec, null, 800, { sinRef: true }),
    s1: (p, x, k) => op(p).identificacion(x.rec, x.inv, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).anulacion(x.rec, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  {
    id: 11, name: "cobro → anulación en la misma factura",
    setup: (x) => invoiceSql(x.inv, { paid: 400, status: "parcial" }) + receiptSql(x.rec, x.inv, 400),
    s1: (p, x, k) => op(p).cobro(x.inv, 300, { pause: k, v: "s1" }),
    s2: (p, x) => op(p).anulacion(x.rec, { v: "s2" }),
    invoices: (x) => [x.inv],
  },
  // Coherencia con la 0464 (SDD-0484): las dos reglas de saldo son la misma y
  // se serializan en la factura. Gana el que confirma primero; el otro recibe
  // PAYMENT_EXCEEDS_BALANCE, venga del cobro o de la confirmación.
  {
    id: 12, name: "cobro → confirmación que ya no cabe en el saldo (0464)",
    setup: (x) => invoiceSql(x.inv) + reportSql(x.rep, x.inv, 200),
    s1: (p, x, k) => op(p).cobro(x.inv, 900, { pause: k, v: "s1" }),
    s2: (p, x) => reporte(x.rep),
    invoices: (x) => [x.inv],
    rejected: "PAYMENT_EXCEEDS_BALANCE",
  },
  {
    id: 13, name: "confirmación → cobro que ya no cabe en el saldo (0464)",
    setup: (x) => invoiceSql(x.inv) + reportSql(x.rep, x.inv, 200),
    s1: (p, x, k) => reporte(x.rep, { pause: k }),
    s2: (p, x) => op(p).cobro(x.inv, 900, { v: "s2" }),
    invoices: (x) => [x.inv],
    rejected: "PAYMENT_EXCEEDS_BALANCE",
  },
];

// Cada mutante quita un FOR UPDATE de 0467 y tiene que caer en estos escenarios.
const MUTANTS = [
  { id: "M1", fn: "register_collection_receipt", nth: 1, kills: [1, 2, 4, 13] },
  { id: "M2", fn: "identify_collection_receipt", nth: 1, kills: [7] },
  { id: "M3", fn: "identify_collection_receipt", nth: 2, kills: [9] },
  { id: "M4", fn: "void_collection_receipt", nth: 1, kills: [10] },
  { id: "M5", fn: "void_collection_receipt", nth: 2, kills: [11] },
];

/** 0467 sin el FOR UPDATE nº `nth` de `fn`; el resto del texto, intacto. */
function mutant(text, fn, nth) {
  const start = text.indexOf(`create function public.${fn}(`);
  const end = text.indexOf("$function$;", start);
  if (start < 0 || end < 0) throw new Error("mutante: no encontré " + fn);
  const site = [...text.slice(start, end).matchAll(/\n\s*for update;/g)][nth - 1];
  if (!site) throw new Error(`mutante: ${fn} no tiene ${nth} FOR UPDATE`);
  const at = start + site.index;
  return text.slice(0, at) + ";" + text.slice(at + site[0].length);
}

// ── Sesiones ─────────────────────────────────────────────────
let finished = new Map();
function session(db, name, sql) {
  const child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=race_${name}`, C, "psql", "-U", "postgres",
    "-d", db, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]);
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  child.stdin.end(sql);
  return new Promise((done) => child.on("close", (code) => {
    const result = { code, error: (out.match(/ERROR:\s+(.*)$/m) ?? [])[1] ?? null, out };
    finished.set(name, result);
    done(result);
  }));
}
async function until(label, sql, watching = []) {
  for (let t0 = Date.now(); Date.now() - t0 < 30_000; await sleep(100)) {
    if (psql("postgres", sql) === "t") return;
    const early = watching.find((name) => finished.has(name));
    if (early) throw new Error(`${early} terminó antes de ${label}: ${finished.get(early).out}`);
  }
  throw new Error("timeout esperando: " + label);
}
const activity = (name, extra) =>
  `select exists(select 1 from pg_stat_activity where application_name = 'race_${name}' and ${extra})`;

async function runScenario(db, phase, scenario, key) {
  finished = new Map();
  const x = { inv: uuid(), inv2: uuid(), rec: uuid(), rep: uuid() };
  psql(db, scenario.setup(x));
  const started = [];
  let r1;
  let r2;
  let s2Blocked = false;
  try {
    started.push(session(db, "O", `select pg_advisory_lock(${key}); select pg_sleep(300);`));
    await until("O retiene el lock", activity("O", "wait_event = 'PgSleep'"), ["O"]);
    const s1 = session(db, "S1", scenario.s1(phase, x, key));
    started.push(s1);
    await until("S1 en pausa", activity("S1", `wait_event_type = 'Lock' and wait_event = 'advisory'`), ["O", "S1"]);
    const s2 = session(db, "S2", scenario.s2(phase, x));
    started.push(s2);
    // S2 termina o queda esperando un lock: cualquiera de las dos, sin sleeps.
    for (let t0 = Date.now(); ; await sleep(100)) {
      if (finished.has("S2")) break;
      if (psql("postgres", activity("S2", "wait_event_type = 'Lock'")) === "t") { s2Blocked = true; break; }
      if (finished.has("S1")) throw new Error("S1 terminó antes de soltar la pausa: " + finished.get("S1").out);
      if (Date.now() - t0 > 30_000) throw new Error("timeout: S2 ni terminó ni quedó esperando");
    }
    psql("postgres", `select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'race_O'`);
    [r1, r2] = await Promise.all([s1, s2]);
  } finally {
    // Ninguna sesión sobrevive al escenario, aunque haya fallado a mitad.
    psql("postgres", `select pg_terminate_backend(pid) from pg_stat_activity where application_name like 'race\\_%'`);
    await Promise.all(started);
  }
  const ids = scenario.invoices(x).map((id) => `'${id}'`).join(",");
  const invoices = JSON.parse(psql(db, `select coalesce(json_agg(json_build_object(
      'pagado', i.paid_amount, 'total', i.total_amount, 'estado', i.status,
      'recibos', (select coalesce(sum(r.amount), 0) from public.payment_receipts r where r.invoice_id = i.id and r.deleted_at is null),
      'codigos', (select coalesce(json_agg(r.receipt_code order by r.receipt_code), '[]') from public.payment_receipts r
                   where r.invoice_id = i.id and r.deleted_at is null and r.receipt_code not like 'R-SEED-%'),
      'reportes', (select coalesce(sum(p.amount), 0) from public.payment_reports p where p.invoice_id = i.id and p.status = 'confirmado'))
    order by i.invoice_code), '[]') from public.invoices i where i.id in (${ids})`));
  const broken = invoices.filter((i) => Number(i.pagado) !== Number(i.recibos) + Number(i.reportes)
    || Number(i.pagado) > Number(i.total));
  return { r1: { code: r1.code, error: r1.error }, r2: { code: r2.code, error: r2.error }, s2Blocked, invoices, broken };
}

// ANTES: el invariante se rompe o S1 muere por el código repetido (escenario 8).
function reproduced(scenario, run) {
  if (scenario.id === 8) return run.r1.code !== 0 && /duplicate key|receipt_code/.test(run.r1.error ?? "");
  return run.broken.length > 0;
}
// DESPUÉS: invariante, espera de S2 y rechazo esperado; ninguna otra falla.
function correct(scenario, run) {
  if (run.broken.length > 0 || !run.s2Blocked || run.r1.code !== 0) return false;
  if (scenario.rejected) return run.r2.code !== 0 && run.r2.error === scenario.rejected;
  if (run.r2.code !== 0) return false;
  if (scenario.id === 8) {
    const codes = run.invoices.flatMap((i) => i.codigos);
    return codes.length === 2 && new Set(codes).size === 2;
  }
  return true;
}

// ── Base ─────────────────────────────────────────────────────
function copyDatabase(name) {
  psql("template1", `create database ${name} template postgres`);
  psql(name, `alter database ${name} set search_path = public, extensions`);
}
function applyFile(db, label, text) {
  const target = `/tmp/${label}.sql`;
  const cp = docker(["exec", "-i", C, "sh", "-c", `cat > ${target}`], text);
  if (cp.status !== 0) throw new Error("no se copió " + label);
  const r = docker(["exec", C, "psql", "-U", "postgres", "-d", db, "-X", "-q", "--single-transaction",
    "-v", "ON_ERROR_STOP=1", "-f", target]);
  if (r.status !== 0) throw new Error(`${label}: ${r.stdout}${r.stderr}`);
}

// --imprimir: el SQL de cada sesión, sin Docker, para revisarlo a mano.
if (args.includes("--imprimir")) {
  for (const scenario of SCENARIOS) {
    const x = { inv: "<inv>", inv2: "<inv2>", rec: "<rec>", rep: "<rep>" };
    for (const phase of ["antes", "despues"]) {
      console.log(`-- ═══ ${scenario.id}. ${scenario.name} · ${phase}`);
      console.log(`-- setup\n${scenario.setup(x)}-- S1\n${scenario.s1(phase, x, 4880)}-- S2\n${scenario.s2(phase, x)}`);
    }
  }
  process.exit(0);
}

let failed = false;
const report = [];
try {
  const up = docker(["run", "--rm", "-d", "--name", C, "-e", "POSTGRES_PASSWORD=postgres",
    "-v", `${SUPABASE}:/sb:ro`, IMAGE, "-c", "fsync=off", "-c", "full_page_writes=off", "-c", "max_connections=50"]);
  if (up.status !== 0) throw new Error(`no se pudo levantar ${IMAGE}: ${up.stderr}`);
  let ready = false;
  for (let i = 0; i < 90 && !ready; i++) {
    ready = docker(["exec", C, "psql", "-U", "postgres", "-q", "-c", "select 1"]).status === 0;
    if (!ready) await sleep(600);
  }
  if (!ready) throw new Error("postgres no aceptó conexiones a tiempo");
  docker(["exec", C, "sh", "-c",
    'for e in supabase_vault pg_net pgsodium pg_cron http; do d=$(pg_config --sharedir)/extension; ' +
    'printf "default_version = \'1.0\'\\ncomment = \'stub\'\\nrelocatable = true\\n" > $d/$e.control; ' +
    'printf -- "-- stub\\n" > $d/$e--1.0.sql; done']);
  const stubs = docker(["exec", C, "psql", "-U", "postgres", "-q", "--single-transaction", "-v", "ON_ERROR_STOP=1",
    "-f", "/sb/tests/_supabase-platform-stubs.sql"]);
  if (stubs.status !== 0) throw new Error("stubs: " + stubs.stdout + stubs.stderr);
  const t0 = Date.now();
  const rebuild = docker(["exec", C, "sh", "-c",
    `ok=0; for b in ${BEFORE_0467.join(" ")}; do ` +
    'if psql -U postgres -q --single-transaction -v ON_ERROR_STOP=1 -f "/sb/migrations/$b" >/tmp/o.txt 2>&1; ' +
    'then ok=$((ok+1)); else echo "FALLA_EN|$b|$ok"; grep -m1 "ERROR:" /tmp/o.txt; exit 1; fi; done; echo "OK|$ok"']);
  const rebuilt = `${rebuild.stdout}${rebuild.stderr}`;
  if (!/^OK\|/m.test(rebuilt)) throw new Error("reconstrucción: " + rebuilt);
  console.log(`esquema: ${rebuilt.match(/^OK\|(\d+)/m)[1]} migraciones hasta la 0466 en ${Math.round((Date.now() - t0) / 1000)} s`);
  psql("postgres", SEED);

  copyDatabase("race_antes");
  copyDatabase("race_despues");
  const file0467 = readFileSync(alternative ?? resolve(SUPABASE, "migrations", MIGRATION), "utf8");
  applyFile("race_despues", "m0467", file0467);

  // Un escenario que no llega a correr (seed, sesión caída) cuenta como falla
  // y el resto sigue: nunca como carrera reproducida ni como mutante muerto.
  let key = 4880;
  async function attempt(db, phase, scenario, fase, judge, labels) {
    let run;
    let ok = false;
    try {
      run = await runScenario(db, phase, scenario, ++key);
      ok = judge(scenario, run);
    } catch (error) {
      run = { error: error instanceof Error ? error.message : String(error) };
    }
    failed ||= !ok;
    report.push({ fase, escenario: scenario.id, ok, ...run });
    console.log(`${run.error ? "ERROR" : ok ? labels[0] : labels[1]} · ${fase} · ${scenario.id}. ${scenario.name}`
      + (run.error ? ` — ${run.error.split("\n")[0]}` : ""));
  }
  for (const scenario of SCENARIOS) {
    await attempt("race_antes", "antes", scenario, "antes", reproduced, ["REPRODUCIDO", "NO REPRODUCIDO"]);
  }
  for (const scenario of SCENARIOS) {
    await attempt("race_despues", "despues", scenario, "después", correct, ["CORRECTO", "FALLA"]);
  }
  if (withMutants) {
    for (const m of MUTANTS) {
      const db = `race_${m.id.toLowerCase()}`;
      copyDatabase(db);
      applyFile(db, m.id, mutant(file0467, m.fn, m.nth));
      for (const id of m.kills) {
        await attempt(db, "despues", SCENARIOS.find((s) => s.id === id), `${m.id} sin FOR UPDATE nº ${m.nth} de ${m.fn}`,
          (scenario, run) => !correct(scenario, run), ["MUERE", "SOBREVIVE"]);
      }
    }
  }
} catch (error) {
  failed = true;
  console.log("FAIL: " + (error instanceof Error ? error.message : String(error)));
} finally {
  docker(["rm", "-f", C]);
}
console.log(JSON.stringify(report, null, 1));
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
