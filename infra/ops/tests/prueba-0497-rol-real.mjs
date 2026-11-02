#!/usr/bin/env node
/**
 * SDD-0573 · la 0496 y la 0497 con el rol de producción (`postgres` sin superusuario).
 *
 * CORRIDA PESADA: pide turno al Director. Docker, un contenedor efímero sin red y unos
 * minutos. Nada de esto toca el servidor ni una base real, y todos los datos son sintéticos.
 *
 *   node infra/ops/tests/prueba-0497-rol-real.mjs --paquetes <carpeta de preparar.mjs>
 *
 * PGlite y `postgres:17` corren como superusuario, y el contrato de la 0497 carga un
 * subconjunto de migraciones. Esta prueba cubre lo que ellos no ven:
 *
 *   1. Imagen `supabase/postgres:17.6.1.136` y el esquema COMPLETO hasta la 0495, como
 *      `postgres`, con el mismo método de `pnpm schema:rebuild:supabase`.
 *   2. Control en rojo: un parámetro propio en una cabecera falla con este rol.
 *   3. Filas de legado sembradas antes de la 0497, y scripts/qa/0497-legado-por-clase.sql.
 *   4. Los paquetes reales de 0496 y 0497: previa, apply y verificación, con los flags de
 *      aplicar.sh y el cuerpo vivo de next_entry_code. Antes, cada aplicar.sql con el ledger
 *      bloqueado: aborta dentro del límite y suelta los locks. La 0497 lleva su control en
 *      rojo: con los límites soltados antes de la fila del ledger, espera con los locks tomados.
 *   5. Las RPC como `authenticated` y `service_role` sobre el esquema completo. Conviven
 *      con invoices_seal_billing_titular, invoices_referral_sale_voided, referrals_candado_trg
 *      e invoices_write_version. Incluye cobro, crédito, renombre y salidas con excepción.
 *      Las filas de legado pasan por cada camino que escribe una factura: cobro, renombre, lote
 *      de renombre, anular un recibo, revertir un crédito y anular el asiento del crédito. Sin
 *      filtro, todos fallan al confirmar con su error y la factura queda como estaba.
 *      También el tercer emisor: la factura de Almacén CN, que nace emitida en la RPC de la 0128,
 *      con su asiento, su cobro y su anulación.
 *   6. El desarme, supabase/desarmes/0497_desarme.sql, sobre ese mismo esquema con la 0497: el cobro
 *      que la guarda frenaba pasa, anular y asentar funcionan, y se mide lo que se pierde.
 *   7. Los contratos de 0496 y 0497 en una base nueva, como `postgres`.
 *
 * Límites: tablas casi vacías, sin concurrencia, Auth y Storage son los stubs del repo, sin
 * PostgREST. Las carreras no corren aquí: su guarda exige que los roles no existan.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const IMG = "supabase/postgres:17.6.1.136";
const NOMBRE = "dtd_0497_rol_real";
const M0496 = "0496_tarifa_congelada_por_embarque";
const M0497 = "0497_reverso_al_anular_factura";
const i = process.argv.indexOf("--paquetes");
const PAQUETES = i > 0 ? process.argv[i + 1] : null;
if (!PAQUETES) {
  console.error("uso: node infra/ops/tests/prueba-0497-rol-real.mjs --paquetes <carpeta de preparar.mjs>");
  process.exit(2);
}

const docker = (args, opts = {}) => spawnSync("docker", args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
// El paquete tiene que ser del blob de este checkout: si no, esta prueba no diría nada de él.
for (const m of [M0496, M0497]) {
  const identidad = readFileSync(join(PAQUETES, m, "IDENTIDAD.txt"), "utf8");
  const campo = (nombre) => identidad.match(new RegExp(`^${nombre}=(.*)$`, "m"))?.[1];
  const archivo = readFileSync(resolve(ROOT, `supabase/migrations/${m}.sql`));
  const md5 = createHash("md5").update(archivo).digest("hex");
  if (campo("blob_md5") !== md5 || campo("blob_bytes") !== String(archivo.length) || campo("nombre") !== m) {
    console.log(`RECHAZADO · el paquete de ${m} es de otro blob: el paquete dice ${campo("blob_md5")}, ${campo("blob_bytes")} bytes; el checkout, ${md5}, ${archivo.length} bytes`);
    process.exit(3);
  }
}
if (docker(["info", "--format", "{{.ServerVersion}}"]).status !== 0) {
  console.log("NO DISPONIBLE · Docker no responde");
  process.exit(2);
}

const FLAGS = ["-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=terse", "-v", "SHOW_CONTEXT=never"];
const T = mkdtempSync(join(tmpdir(), "p0497-"));
let pasaron = 0;
let fallaron = 0;
const ok = (texto) => { pasaron += 1; console.log(`PASÓ  · ${texto}`); };
const ko = (texto, detalle = "") => {
  fallaron += 1;
  console.log(`FALLÓ · ${texto}`);
  if (detalle) console.log(detalle.split("\n").slice(0, 14).map((l) => "        " + l.slice(0, 220)).join("\n"));
};
const primerError = (t) => (t.split("\n").find((l) => /ERROR|FATAL/.test(l)) || "").slice(0, 240);

function copiar(nombre, texto) {
  const local = join(T, nombre);
  writeFileSync(local, texto);
  const cp = docker(["cp", local, `${NOMBRE}:/tmp/${nombre}`]);
  if (cp.status !== 0) throw new Error(`docker cp ${nombre}: ${cp.stderr}`);
  return `/tmp/${nombre}`;
}
function archivo(ruta, { rol = "postgres", db = "postgres", extra = [] } = {}) {
  const t0 = Date.now();
  const r = docker(["exec", NOMBRE, "psql", "-U", rol, "-d", db, ...FLAGS, ...extra, "-f", ruta]);
  return { status: r.status, ms: Date.now() - t0, out: r.stdout || "", err: r.stderr || "" };
}
function sql(texto, { rol = "postgres", db = "postgres" } = {}) {
  const r = docker(["exec", NOMBRE, "psql", "-U", rol, "-d", db, "-X", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", texto]);
  return { status: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// ── El ledger bloqueado ────────────────────────────────────────────────────────────
// aplicar.sql agrega la fila del ledger después del archivo: esa espera tiene que tener límite.
// SHARE deja leer el ledger, que es lo que hace el preflight, y frena solo el INSERT.
const APP_BLOQUEO = "bloqueo_ledger_0497";
const APP_CONTROL = "control_ledger_0497";
const pausa = (ms) => spawnSync(process.execPath, ["-e", `setTimeout(()=>{},${ms})`]);
const LOCKS_FUERTES = `select count(*) from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and l.pid <> pg_backend_pid() and l.mode in ('AccessExclusiveLock','ExclusiveLock','ShareRowExclusiveLock')`;
function bloquearLedger() {
  const r = docker(["exec", "-d", "-e", `PGAPPNAME=${APP_BLOQUEO}`, NOMBRE, "psql", "-U", "postgres", "-d", "postgres", "-X", "-c",
    "begin; lock table supabase_migrations.schema_migrations in share mode; select pg_sleep(300); rollback;"]);
  if (r.status !== 0) throw new Error(`no bloqueó el ledger: ${r.stderr}`);
  for (let n = 0; n < 40; n += 1) {
    const v = sql(`select count(*) from pg_locks l join pg_stat_activity a using (pid)
      where a.application_name = '${APP_BLOQUEO}' and l.granted and l.mode = 'ShareLock'
        and l.relation = 'supabase_migrations.schema_migrations'::regclass`);
    if (v.out === "1") return;
    pausa(250);
  }
  throw new Error("el ledger no quedó bloqueado");
}
function soltar(app) {
  sql(`select pg_terminate_backend(pid) from pg_stat_activity where application_name = '${app}'`);
  for (let n = 0; n < 40; n += 1) {
    if (sql(`select count(*) from pg_stat_activity where application_name = '${app}'`).out === "0") return;
    pausa(250);
  }
  throw new Error(`${app} no terminó`);
}
// La marca de lo que deja cada migración si confirmara.
const NO_QUEDO = {
  [M0496]: "to_regclass('public.shipment_rate_snapshots') is null",
  [M0497]: "to_regprocedure('public.i3_assert_invoice_final(uuid)') is null",
};
function nadaQuedo(m) {
  return sql(`select ${NO_QUEDO[m]} and not exists (select 1 from supabase_migrations.schema_migrations where name = '${m}')`).out === "t";
}
const MARCA_LEDGER = "\ninsert into supabase_migrations.schema_migrations (";
function conLedgerBloqueado(m) {
  const texto = readFileSync(join(PAQUETES, m, "aplicar.sql"), "utf8");
  const lineaLedger = texto.slice(0, texto.indexOf(MARCA_LEDGER)).split("\n").length + 1;
  bloquearLedger();
  try {
    const r = archivo(`/paq/${m}/aplicar.sql`);
    const salida = r.err + r.out;
    const cayo = salida.match(/aplicar\.sql:(\d+): ERROR:\s+canceling statement due to lock timeout/);
    if (r.status !== 0 && cayo && Number(cayo[1]) >= lineaLedger) ok(`${m.slice(0, 4)} con el ledger bloqueado: cae en la fila del ledger, línea ${cayo[1]} de aplicar.sql, en ${r.ms} ms`);
    else ko(`${m.slice(0, 4)} con el ledger bloqueado: no cayó por el límite en la fila del ledger (línea ${lineaLedger}), ${r.ms} ms`, salida);
    if (r.ms >= 5000 && r.ms < 25000) ok(`${m.slice(0, 4)} con el ledger bloqueado: esperó el límite y no más`);
    else ko(`${m.slice(0, 4)} con el ledger bloqueado: tardó ${r.ms} ms`);
    const locks = sql(LOCKS_FUERTES).out;
    if (locks === "0") ok(`${m.slice(0, 4)} con el ledger bloqueado: soltó los locks con el ledger todavía bloqueado`);
    else ko(`${m.slice(0, 4)} con el ledger bloqueado: quedan ${locks} locks fuertes`);
    if (nadaQuedo(m)) ok(`${m.slice(0, 4)} con el ledger bloqueado: no quedó nada de la migración`);
    else ko(`${m.slice(0, 4)} con el ledger bloqueado: quedó algo aplicado`);
  } finally {
    soltar(APP_BLOQUEO);
  }
}
// El control: los límites soltados justo antes de la fila, como estaba la 0497. Se mata antes de
// soltar el ledger, para que no confirme.
function controlSinLimites(m) {
  const texto = readFileSync(join(PAQUETES, m, "aplicar.sql"), "utf8");
  const i = texto.indexOf(MARCA_LEDGER);
  const ruta = copiar("control-ledger.sql", texto.slice(0, i) + "\nreset statement_timeout;\nreset lock_timeout;" + texto.slice(i));
  bloquearLedger();
  try {
    const r = docker(["exec", "-d", "-e", `PGAPPNAME=${APP_CONTROL}`, NOMBRE, "psql", "-U", "postgres", "-d", "postgres", ...FLAGS, "-f", ruta]);
    if (r.status !== 0) throw new Error(`no arrancó el control: ${r.stderr}`);
    const esperando = `select count(*) from pg_stat_activity where application_name = '${APP_CONTROL}' and wait_event_type = 'Lock' and query like 'insert into supabase_migrations%'`;
    let llego = false;
    for (let n = 0; n < 120 && !llego; n += 1) {
      llego = sql(esperando).out === "1";
      if (!llego) pausa(250);
    }
    if (!llego) { ko("control de los límites: nunca llegó a la fila del ledger"); return; }
    pausa(8000); // Más que los 5 s del límite.
    const sigue = sql(esperando).out;
    const retiene = sql(`select count(*) from pg_locks l join pg_stat_activity a using (pid) join pg_class c on c.oid = l.relation
      where a.application_name = '${APP_CONTROL}' and l.granted and l.mode = 'AccessExclusiveLock' and c.relname in ('journal_entries','journal_lines')`).out;
    if (sigue === "1" && retiene === "2") ok("control en rojo: con los límites soltados antes del ledger, sigue esperando pasado el límite y con journal_entries y journal_lines tomadas");
    else ko(`el control no reprodujo el defecto: esta prueba no lo detecta (sigue ${sigue}, locks ${retiene})`);
  } finally {
    soltar(APP_CONTROL);
    soltar(APP_BLOQUEO);
  }
  if (nadaQuedo(m)) ok("control de los límites: terminado sin confirmar");
  else ko("control de los límites: quedó algo aplicado");
}

// ── Filas sembradas ANTES de la 0497 ───────────────────────────────────────────────
const ID_CONTABLE = "05730000-0000-4000-8000-000000000001";
const ID_COMERCIAL = "05730000-0000-4000-8000-000000000002";
const ID_ADMIN = "05730000-0000-4000-8000-000000000003";
const SEMBRAR_AUTH = `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('${ID_CONTABLE}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contabilidad@prueba.example.test','{}','{}'),
  ('${ID_COMERCIAL}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comercial@prueba.example.test','{}','{}'),
  ('${ID_ADMIN}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@prueba.example.test','{}','{}');`;
const TENANT = "(select id from public.tenants where slug = 'dtd')";
const CUENTA = (code) => `(select id from public.accounts where tenant_id = ${TENANT} and code = '${code}')`;
const FACTURA = (label, markbox, status, total = 100, iva = 0) => `insert into public.invoices
  (id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
  values (md5('m1-${label}')::uuid,${TENANT},'F-M1-${label}','${markbox}','Cliente PRUEBA','USD',${total - iva},${iva},${total},0,'${status}',current_date);`;
const VENTA = (label, entry, status = "asentado") => `insert into public.journal_entries
  (id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
  values (md5('m1-e-${entry}')::uuid,${TENANT},'M1-${entry}',current_date,'Venta sintética','${status}','invoice',md5('m1-${label}')::uuid,${status === "asentado" ? "now()" : "null"});
insert into public.journal_lines (entry_id,account_id,debit,credit,line_memo) values
  (md5('m1-e-${entry}')::uuid,${CUENTA("1.1.2")},100,0,'Sintética'),
  (md5('m1-e-${entry}')::uuid,${CUENTA("4.5")},0,100,'Sintética');`;
const CLIENTE = (label) => `insert into public.clients (id,tenant_id,markbox,name)
  values (md5('m1-c-${label}')::uuid,${TENANT},'M1-${label}','Cliente PRUEBA ${label}');`;
const COMO_CONTABLE = `set local role authenticated; select set_config('request.jwt.claim.sub','${ID_CONTABLE}',true);`;
const COMO_COMERCIAL = `set local role authenticated; select set_config('request.jwt.claim.sub','${ID_COMERCIAL}',true);`;
const COMO_ADMIN = `set local role authenticated; select set_config('request.jwt.claim.sub','${ID_ADMIN}',true);`;
const SEMBRAR = `begin;
insert into public.user_profiles (user_id,first_name,last_name) values
  ('${ID_CONTABLE}','Contabilidad','PRUEBA'), ('${ID_COMERCIAL}','Comercial','PRUEBA'), ('${ID_ADMIN}','Admin','PRUEBA')
  on conflict (user_id) do nothing;
insert into public.user_tenants (user_id,tenant_id,role) values
  ('${ID_CONTABLE}',${TENANT},'accounting'), ('${ID_COMERCIAL}',${TENANT},'commercial'), ('${ID_ADMIN}',${TENANT},'admin');
${["A", "B", "C", "D", "E", "F", "G", "L"].map(CLIENTE).join("\n")}
insert into public.clients (id,tenant_id,markbox,name) values (md5('m1-c-Z')::uuid,${TENANT},'DTD-Z1','Cliente PRUEBA legado');
${FACTURA("l1", "M1-L", "emitida")}
${VENTA("l1", "l1", "anulado")}
${FACTURA("l2", "M1-L", "anulada")}
${VENTA("l2", "l2")}
${FACTURA("l3", "M1-L", "emitida")}
${VENTA("l3", "l3-1")}
${VENTA("l3", "l3-2")}
${FACTURA("lz", "DTD-Z1", "anulada")}
${VENTA("lz", "lz", "anulado")}
commit;
-- venta_anulada|anulada, armada como se armó en producción: con cobro y con crédito vivos,
-- anulada con la RPC de la 0294 y con su venta anulada a mano desde el Libro diario.
insert into public.referrals (id,tenant_id,referral_code,referrer_client_id,referrer_markbox,referred_name,referred_client_id,status)
  values (md5('m1-r3')::uuid,${TENANT},'M1-R3',md5('m1-c-F')::uuid,'M1-F','Referido PRUEBA 3',md5('m1-c-G')::uuid,'registrado');
${FACTURA("lgv", "M1-G", "emitida")}
${FACTURA("la", "M1-F", "emitida", 200)}
insert into public.journal_entries (id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
  values (md5('m1-e-la')::uuid,${TENANT},'M1-la',current_date,'Venta sintética','asentado','invoice',md5('m1-la')::uuid,now());
insert into public.journal_lines (entry_id,account_id,debit,credit,line_memo) values
  (md5('m1-e-la')::uuid,${CUENTA("1.1.2")},200,0,'Sintética'), (md5('m1-e-la')::uuid,${CUENTA("4.5")},0,200,'Sintética');
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-la')::uuid,40,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1-LA',null,'cliente',null,null,true);
select public.apply_referral_credit(md5('m1-r3')::uuid,md5('m1-la')::uuid);
commit;
insert into public.journal_entries (id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,referral_id,posted_at)
  values (md5('m1-e-la-cr')::uuid,${TENANT},'M1-la-cr',current_date,'Crédito sintético','asentado','referral_credit',md5('m1-la')::uuid,md5('m1-r3')::uuid,now());
insert into public.journal_lines (entry_id,account_id,debit,credit,line_memo) values
  (md5('m1-e-la-cr')::uuid,${CUENTA("4.5")},80,0,'Sintética'), (md5('m1-e-la-cr')::uuid,${CUENTA("1.1.2")},0,80,'Sintética');
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-la')::uuid,'Motivo M1 de legado');
commit;
begin;
select set_config('dtd.audit_reason','Motivo M1 del Libro diario',true);
update public.journal_entries set status = 'anulado' where id = md5('m1-e-la')::uuid;
commit;`;

// ── Después de la 0497. Cada sección se abre con su marca y se compara abajo ───────
const POST = (label) => `begin; set local role service_role;
select public.post_invoice_journal_entry_atomic(${TENANT},md5('m1-${label}')::uuid);
commit;`;
const VOID = (label, como = COMO_CONTABLE, motivo = "Motivo M1 exacto") => `begin; ${como}
select public.void_invoice_with_audit_reason(md5('m1-${label}')::uuid,'${motivo}');
commit;`;
const ESCENARIOS = `
\\echo @@n1_emitir
${FACTURA("n1", "M1-A", "emitida", 116, 16)}
select status, write_version from public.invoices where id = md5('m1-n1')::uuid;
\\echo @@n1_post
${POST("n1")}
\\echo @@n1_lineas
select count(*), sum(l.debit), sum(l.credit) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id where e.invoice_id = md5('m1-n1')::uuid;
\\echo @@n1_post_otra_vez
${POST("n1")}
\\echo @@n1_void
${VOID("n1")}
\\echo @@n1_estado
select i.status, i.write_version,
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice_reversal'),
  (select count(*) from public.entity_audit_log a where a.entity_id = i.id and a.event_type = 'invoice_voided' and a.reason = 'Motivo M1 exacto'),
  (select count(*) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id where e.invoice_id = i.id and e.source = 'invoice_reversal')
from public.invoices i where i.id = md5('m1-n1')::uuid;
\\echo @@n1_titular_sigue_congelado
update public.invoices set client_name = 'Otro' where id = md5('m1-n1')::uuid;

\\echo @@n2_referido_acredita
insert into public.referrals (id,tenant_id,referral_code,referrer_client_id,referrer_markbox,referred_name,referred_client_id,status)
  values (md5('m1-r1')::uuid,${TENANT},'M1-R1',md5('m1-c-B')::uuid,'M1-B','Referido PRUEBA',md5('m1-c-C')::uuid,'registrado');
${FACTURA("n2", "M1-C", "emitida")}
select status, accredited_invoice_id = md5('m1-n2')::uuid from public.referrals where id = md5('m1-r1')::uuid;
\\echo @@n2_post
${POST("n2")}
\\echo @@n2_void
${VOID("n2")}
\\echo @@n2_referido_vuelve
select status, accredited_invoice_id is null from public.referrals where id = md5('m1-r1')::uuid;

\\echo @@n3_acreditar
insert into public.referrals (id,tenant_id,referral_code,referrer_client_id,referrer_markbox,referred_name,referred_client_id,status)
  values (md5('m1-r2')::uuid,${TENANT},'M1-R2',md5('m1-c-B')::uuid,'M1-B','Referido PRUEBA 2',md5('m1-c-D')::uuid,'registrado');
${FACTURA("n3d", "M1-D", "emitida")}
select status from public.referrals where id = md5('m1-r2')::uuid;
\\echo @@n3_factura
${FACTURA("n3", "M1-B", "emitida")}
${POST("n3")}
\\echo @@n3_aplicar_credito
begin; ${COMO_CONTABLE}
select public.apply_referral_credit(md5('m1-r2')::uuid,md5('m1-n3')::uuid);
commit;
select paid_amount from public.invoices where id = md5('m1-n3')::uuid;
\\echo @@n3_void_con_credito
${VOID("n3")}
\\echo @@n3_revertir_credito
begin; ${COMO_CONTABLE}
select public.revert_referral_credits(md5('m1-n3')::uuid,md5('m1-r2')::uuid);
commit;
\\echo @@n3_void_sin_credito
${VOID("n3")}

\\echo @@n4_factura
${FACTURA("n4", "M1-A", "emitida")}
${POST("n4")}
\\echo @@n4_cobro
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-n4')::uuid,40,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select status, paid_amount from public.invoices where id = md5('m1-n4')::uuid;
\\echo @@n4_void_con_cobro
${VOID("n4")}
\\echo @@n4_anular_cobro
select id as recibo from public.payment_receipts where invoice_id = md5('m1-n4')::uuid and deleted_at is null \\gset
begin; ${COMO_CONTABLE}
select public.void_collection_receipt(:'recibo'::uuid,'Motivo M1 del recibo');
commit;
select status, paid_amount from public.invoices where id = md5('m1-n4')::uuid;
\\echo @@n4_void
${VOID("n4")}

\\echo @@n5_factura
${FACTURA("n5", "M1-E", "emitida")}
${POST("n5")}
\\echo @@n5_renombrar
begin; ${COMO_COMERCIAL}
select public.rename_client_markbox(md5('m1-c-E')::uuid,'M1-E2','Motivo M1 del renombre');
commit;
select client_markbox from public.invoices where id = md5('m1-n5')::uuid;

\\echo @@n6_comercial_no_anula
${VOID("n5", COMO_COMERCIAL)}
\\echo @@n6_authenticated_no_asienta
begin; ${COMO_CONTABLE}
select public.post_invoice_journal_entry_atomic(${TENANT},md5('m1-n5')::uuid);
rollback;

-- El tercer emisor: consolidar una recepción con OV llama a la RPC de la 0128 y, fuera de su
-- transacción, al asiento. Con IVA, para que la venta tenga sus tres líneas.
update public.tenants set iva_enabled = true where id = ${TENANT};
insert into public.warehouses_cn (id,code,hub_code,hub_name_es,hub_name_cn) values (md5('m1-w')::uuid,'M1-W','M1','Prueba','Prueba');
insert into public.sales_orders (id,tenant_id,sales_order_code,client_markbox,client_name,total_usd) values
  (md5('m1-ov1')::uuid,${TENANT},'OV-M1-1','M1-A','Cliente PRUEBA',116), (md5('m1-ov2')::uuid,${TENANT},'OV-M1-2','M1-A','Cliente PRUEBA',116);
insert into public.prealertas (id,tenant_id,client_markbox,code,description,boxes,sales_order_id) values
  (md5('m1-pre1')::uuid,${TENANT},'M1-A','M1-PRE-1','Caja sintética',1,md5('m1-ov1')::uuid),
  (md5('m1-pre2')::uuid,${TENANT},'M1-A','M1-PRE-2','Caja sintética',1,md5('m1-ov2')::uuid);
insert into public.warehouse_receipts_cn (id,tenant_id,receipt_code,warehouse_id,client_markbox,client_name,boxes,total_cbm,total_weight_kg,prealerta_id) values
  (md5('m1-wr1')::uuid,${TENANT},'WR-M1-1',md5('m1-w')::uuid,'M1-A','Cliente PRUEBA',1,1,1,md5('m1-pre1')::uuid),
  (md5('m1-wr2')::uuid,${TENANT},'WR-M1-2',md5('m1-w')::uuid,'M1-A','Cliente PRUEBA',1,1,1,md5('m1-pre2')::uuid);
\\echo @@n7_emitir_desde_cn
begin; set local role service_role;
select (public.sales_order_claim_and_invoice(${TENANT},md5('m1-wr1')::uuid))->>'invoice_id' as inv_cn \\gset
commit;
select status, base_amount, iva_amount, total_amount, sales_order_id = md5('m1-ov1')::uuid,
  (select count(*) from public.journal_entries e where e.invoice_id = i.id) from public.invoices i where i.id = :'inv_cn'::uuid;
\\echo @@n7_post
begin; set local role service_role;
select public.post_invoice_journal_entry_atomic(${TENANT},:'inv_cn'::uuid);
commit;
\\echo @@n7_lineas
select count(*), sum(l.debit), sum(l.credit), bool_and(e.entry_date = i.issued_at) from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id join public.invoices i on i.id = e.invoice_id where e.invoice_id = :'inv_cn'::uuid;
\\echo @@n7_post_otra_vez
begin; set local role service_role;
select public.post_invoice_journal_entry_atomic(${TENANT},:'inv_cn'::uuid);
commit;
\\echo @@n7_cobro
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(:'inv_cn'::uuid,40,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select status, paid_amount from public.invoices where id = :'inv_cn'::uuid;
\\echo @@n7_void_con_cobro
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(:'inv_cn'::uuid,'Motivo M1 de Almacén');
commit;
\\echo @@n7_anular_cobro
select id as recibo_cn from public.payment_receipts where invoice_id = :'inv_cn'::uuid and deleted_at is null \\gset
begin; ${COMO_CONTABLE}
select public.void_collection_receipt(:'recibo_cn'::uuid,'Motivo M1 del recibo');
commit;
select status, paid_amount from public.invoices where id = :'inv_cn'::uuid;
\\echo @@n7_void
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(:'inv_cn'::uuid,'Motivo M1 de Almacén');
commit;
\\echo @@n7_estado
select i.status,
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice_reversal'),
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice' and e.status = 'asentado'),
  (select count(*) from (select l.account_id from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
     where e.invoice_id = i.id and e.source in ('invoice','invoice_reversal') group by l.account_id having sum(l.debit - l.credit) <> 0) x),
  (select p.invoice_id = i.id from public.prealertas p where p.id = md5('m1-pre1')::uuid)
from public.invoices i where i.id = :'inv_cn'::uuid;
\\echo @@n7_sin_asiento
begin; set local role service_role;
select (public.sales_order_claim_and_invoice(${TENANT},md5('m1-wr2')::uuid))->>'invoice_id' as inv_cn2 \\gset
commit;
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(:'inv_cn2'::uuid,'Motivo M1 de Almacén');
commit;
select status, (select count(*) from public.journal_entries e where e.invoice_id = i.id) from public.invoices i where i.id = :'inv_cn2'::uuid;
update public.tenants set iva_enabled = false where id = ${TENANT};

-- Salidas con excepción: un testigo fuerza el error ya puesto el motivo.
create function public.m1_falla() returns trigger language plpgsql security definer set search_path = public as $t$
begin
  if pg_catalog.current_setting('m1.falla', true) = 'si' then raise exception 'M1 falla forzada'; end if;
  return new;
end;
$t$;
create trigger m1_falla before update on public.invoices for each row execute function public.m1_falla();
${FACTURA("e1", "M1-A", "emitida")}
${POST("e1")}
${FACTURA("e2", "M1-A", "emitida")}

\\echo @@e_savepoint_con_asiento
begin;
select set_config('dtd.audit_reason','M1 exterior',true);
savepoint s;
set local m1.falla = 'si';
${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-e1')::uuid,'Motivo M1');
rollback to savepoint s;
select current_user, current_setting('dtd.audit_reason',true), (select status from public.invoices where id = md5('m1-e1')::uuid),
  (select count(*) from public.journal_entries where invoice_id = md5('m1-e1')::uuid and source = 'invoice_reversal');
rollback;
\\echo @@e_savepoint_sin_asiento
begin;
select set_config('dtd.audit_reason','M1 exterior',true);
savepoint s;
set local m1.falla = 'si';
${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-e2')::uuid,'Motivo M1');
rollback to savepoint s;
select current_user, current_setting('dtd.audit_reason',true), (select status from public.invoices where id = md5('m1-e2')::uuid);
rollback;

set dtd.audit_reason = 'M1 sesion';
set m1.falla = 'si';
\\echo @@e_sin_capturar_en_transaccion
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-e1')::uuid,'Motivo M1');
rollback;
select current_user, current_setting('dtd.audit_reason',true);
\\echo @@e_sin_capturar_autocommit
select set_config('request.jwt.claim.sub','${ID_CONTABLE}',false);
set role authenticated;
select public.void_invoice_with_audit_reason(md5('m1-e1')::uuid,'Motivo M1');
reset role;
select current_user, current_setting('dtd.audit_reason',true);
\\echo @@e_sin_valor_previo
reset dtd.audit_reason;
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-e1')::uuid,'Motivo M1');
rollback;
select coalesce(current_setting('dtd.audit_reason',true),'')='';
set m1.falla = 'no';
\\echo @@e_exito_conserva_sesion
set dtd.audit_reason = 'M1 sesion';
${VOID("e1")}
select current_setting('dtd.audit_reason',true),
  (select count(*) from public.entity_audit_log where reason = 'M1 sesion');
reset dtd.audit_reason;

\\echo @@l_void_venta_anulada
${VOID("l1")}
\\echo @@l_post_venta_anulada
${POST("l1")}
\\echo @@l_cobro_legado
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-l1')::uuid,10,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select status, paid_amount, (select count(*) from public.payment_receipts where invoice_id = md5('m1-l1')::uuid and deleted_at is null) from public.invoices where id = md5('m1-l1')::uuid;
\\echo @@l_renombre_legado
begin; ${COMO_COMERCIAL}
select public.rename_client_markbox(md5('m1-c-L')::uuid,'M1-L2','Motivo M1 del renombre');
commit;
select client_markbox from public.invoices where id = md5('m1-l1')::uuid;
select client_markbox from public.invoices where id = md5('m1-l2')::uuid;
\\echo @@l_dos_ventas_otra_columna
update public.invoices set notes = 'M1' where id = md5('m1-l3')::uuid;
select notes from public.invoices where id = md5('m1-l3')::uuid;
\\echo @@l_cobro_dos_ventas
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-l3')::uuid,100,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select status, paid_amount, (select count(*) from public.journal_entries where invoice_id = md5('m1-l3')::uuid and source = 'invoice') from public.invoices where id = md5('m1-l3')::uuid;
\\echo @@l_anulada_sin_reverso_void
${VOID("l2")}
\\echo @@l_anulada_sin_reverso_otra_columna
update public.invoices set notes = 'M1' where id = md5('m1-l2')::uuid;
select notes from public.invoices where id = md5('m1-l2')::uuid;

\\echo @@la_clase
select i.status, e.status from public.invoices i join public.journal_entries e on e.invoice_id = i.id and e.source = 'invoice' where i.id = md5('m1-la')::uuid;
select status, paid_amount from public.invoices where id = md5('m1-la')::uuid;
\\echo @@la_renombrar
begin; ${COMO_COMERCIAL}
select public.rename_client_markbox(md5('m1-c-F')::uuid,'M1-F2','Motivo M1 del renombre');
commit;
select client_markbox, status from public.invoices where id = md5('m1-la')::uuid;
\\echo @@la_anular_recibo
select id as recibo_la from public.payment_receipts where invoice_id = md5('m1-la')::uuid and deleted_at is null \\gset
begin; ${COMO_CONTABLE}
select public.void_collection_receipt(:'recibo_la'::uuid,'Motivo M1 del recibo');
commit;
select status, paid_amount from public.invoices where id = md5('m1-la')::uuid;
\\echo @@la_revertir_credito
begin; ${COMO_CONTABLE}
select public.revert_referral_credits(md5('m1-la')::uuid,md5('m1-r3')::uuid);
commit;
select status, paid_amount from public.invoices where id = md5('m1-la')::uuid;
select status from public.referrals where id = md5('m1-r3')::uuid;
\\echo @@la_anular_asiento_credito
begin; set local role service_role;
update public.journal_entries set status = 'anulado' where id = md5('m1-e-la-cr')::uuid;
commit;
select status from public.journal_entries where id = md5('m1-e-la-cr')::uuid;
\\echo @@lz_lote_legado
begin; ${COMO_ADMIN}
select public.rename_legacy_markboxes(10,false,'Motivo M1 del lote');
commit;
select client_markbox from public.invoices where id = md5('m1-lz')::uuid;
select markbox from public.clients where id = md5('m1-c-Z')::uuid;

-- Lo que la guarda sigue frenando, sobre el esquema completo y con el rol real.
${FACTURA("g1", "M1-A", "emitida")}
${POST("g1")}
\\echo @@g_sana_a_anulada_sin_reverso
begin;
update public.invoices set status = 'anulada' where id = md5('m1-g1')::uuid;
commit;
\\echo @@g_sana_a_borrador
begin;
update public.invoices set status = 'borrador' where id = md5('m1-g1')::uuid;
commit;
\\echo @@g_legado_a_anulada
begin;
update public.invoices set status = 'anulada' where id = md5('m1-l3')::uuid;
commit;
\\echo @@g_anulada_reabrir
update public.invoices set status = 'emitida' where id = md5('m1-la')::uuid;
\\echo @@g_borrar
update public.invoices set deleted_at = now() where id = md5('m1-g1')::uuid;
\\echo @@g_delete
delete from public.invoices where id = md5('m1-g1')::uuid;
\\echo @@g_tenant
update public.invoices set tenant_id = gen_random_uuid() where id = md5('m1-g1')::uuid;
\\echo @@g_asiento_inmutable
update public.journal_entries set memo = 'Otro' where id = (select id from public.journal_entries where invoice_id = md5('m1-g1')::uuid and source = 'invoice');
\\echo @@g_sigue_sana
select status, deleted_at is null, paid_amount from public.invoices where id = md5('m1-g1')::uuid;
\\echo @@fin
`;

// Regex por sección, sobre su salida completa. Etiqueta · qué debe aparecer · qué no debe.
const ESPERADO = [
  ["n1_emitir", /emitida\|0/, null, "factura emitida con el sello del titular"],
  ["n1_post", /"outcome": "posted"[\s\S]*COMMIT/, /ERROR/, "post como service_role"],
  ["n1_lineas", /3\|116\.00\|116\.00/, null, "la venta tiene sus tres líneas y cuadra"],
  ["n1_post_otra_vez", /"outcome": "already_posted"/, /ERROR/, "post repetido no duplica"],
  ["n1_void", /\nt\n[\s\S]*COMMIT/, /ERROR/, "void como authenticated"],
  ["n1_estado", /anulada\|1\|1\|1\|3/, null, "anulada, write_version sube, un reverso, motivo exacto, tres líneas"],
  ["n1_titular_sigue_congelado", /invoice_titular_frozen/, null, "el sello del titular sigue vigente"],
  ["n2_referido_acredita", /acreditado\|t/, /ERROR/, "la venta acredita al referido"],
  ["n2_post", /"outcome": "posted"/, /ERROR/, "post de la venta del referido"],
  ["n2_void", /\nt\n[\s\S]*COMMIT/, /ERROR/, "void con invoices_referral_sale_voided y referrals_candado_trg"],
  ["n2_referido_vuelve", /registrado\|t/, null, "el referido vuelve a registrado"],
  ["n3_acreditar", /acreditado/, /ERROR/, "segundo referido acreditado"],
  ["n3_factura", /"outcome": "posted"/, /ERROR/, "factura del referidor asentada"],
  ["n3_aplicar_credito", /COMMIT[\s\S]*80\.00/, /ERROR/, "crédito aplicado"],
  ["n3_void_con_credito", /aplicado sin recibo/, null, "void rechaza una factura con crédito aplicado"],
  ["n3_revertir_credito", /COMMIT/, /ERROR/, "crédito revertido"],
  ["n3_void_sin_credito", /\nt\n[\s\S]*COMMIT/, /ERROR/, "void después de revertir"],
  ["n4_factura", /"outcome": "posted"/, /ERROR/, "factura para cobro asentada"],
  ["n4_cobro", /COMMIT[\s\S]*parcial\|40\.00/, /ERROR/, "cobro registrado, factura parcial"],
  ["n4_void_con_cobro", /cobro\(s\) vivo\(s\)/, null, "void rechaza con cobro vivo"],
  ["n4_anular_cobro", /COMMIT[\s\S]*emitida\|0\.00/, /ERROR/, "cobro anulado, factura emitida"],
  ["n4_void", /\nt\n[\s\S]*COMMIT/, /ERROR/, "void después de anular el cobro"],
  ["n5_factura", /"outcome": "posted"/, /ERROR/, "factura para renombre asentada"],
  ["n5_renombrar", /COMMIT[\s\S]*M1-E2/, /ERROR/, "renombrar la marca pasa con una factura sana"],
  ["n6_comercial_no_anula", /Solo admin o contabilidad anulan/, null, "el rol comercial no anula"],
  ["n6_authenticated_no_asienta", /permission denied for function post_invoice_journal_entry_atomic/, null, "authenticated no asienta"],
  ["n7_emitir_desde_cn", /emitida\|100\.00\|16\.00\|116\.00\|t\|0/, /ERROR/, "Almacén CN: la RPC de la 0128 emite, sin asiento todavía"],
  ["n7_post", /"outcome": "posted"[\s\S]*COMMIT/, /ERROR/, "Almacén CN: post de la factura emitida por la 0128"],
  ["n7_lineas", /3\|116\.00\|116\.00\|t/, null, "Almacén CN: la venta tiene sus tres líneas, cuadra y lleva la fecha de la factura"],
  ["n7_post_otra_vez", /"outcome": "already_posted"/, /ERROR/, "Almacén CN: post repetido no duplica"],
  ["n7_cobro", /COMMIT[\s\S]*parcial\|40\.00/, /ERROR/, "Almacén CN: cobro registrado, factura parcial"],
  ["n7_void_con_cobro", /cobro\(s\) vivo\(s\)/, null, "Almacén CN: void rechaza con cobro vivo"],
  ["n7_anular_cobro", /COMMIT[\s\S]*emitida\|0\.00/, /ERROR/, "Almacén CN: cobro anulado, factura emitida"],
  ["n7_void", /\nt\n[\s\S]*COMMIT/, /ERROR/, "Almacén CN: void como authenticated"],
  ["n7_estado", /anulada\|1\|1\|0\|t/, null, "Almacén CN: anulada, con su venta y un reverso que la cancela, y la caja sigue ligada"],
  ["n7_sin_asiento", /\nt\n[\s\S]*COMMIT[\s\S]*anulada\|0/, /ERROR/, "Almacén CN: si el asiento falló al emitir, void anula sin reverso"],
  ["e_savepoint_con_asiento", /M1 falla forzada[\s\S]*postgres\|M1 exterior\|emitida\|0/, null, "excepción con savepoint, con asiento: nada cambia"],
  ["e_savepoint_sin_asiento", /M1 falla forzada[\s\S]*postgres\|M1 exterior\|emitida/, null, "excepción con savepoint, sin asiento: nada cambia"],
  ["e_sin_capturar_en_transaccion", /M1 falla forzada[\s\S]*postgres\|M1 sesion/, null, "excepción sin capturar en transacción: queda el valor de la sesión"],
  ["e_sin_capturar_autocommit", /M1 falla forzada[\s\S]*postgres\|M1 sesion/, null, "excepción sin capturar sin transacción: queda el valor de la sesión"],
  ["e_sin_valor_previo", /M1 falla forzada[\s\S]*\nt\n/, null, "excepción sin valor previo: no queda motivo"],
  ["e_exito_conserva_sesion", /COMMIT[\s\S]*M1 sesion\|0/, /ERROR/, "éxito: queda el valor de la sesión y no entra a ningún evento"],
  ["l_void_venta_anulada", /Los antecedentes de venta requieren revisión/, null, "legado, venta anulada: void lo rechaza"],
  ["l_post_venta_anulada", /"reason": "existing_sale_requires_review"/, /ERROR/, "legado, venta anulada: post pide revisión"],
  ["l_cobro_legado", /La venta original requiere revisión[\s\S]*emitida\|0\.00\|0/, null, "legado: una emitida con la venta anulada no se cobra, y queda como estaba"],
  ["l_renombre_legado", /requiere[\s\S]*M1-L\nM1-L\n/, null, "legado: renombrar a su cliente falla, y la marca queda igual"],
  ["l_dos_ventas_otra_columna", /La relación contable de la factura requiere revisión/, /UPDATE 1/, "legado con dos ventas: otra columna falla"],
  ["l_cobro_dos_ventas", /La relación contable de la factura requiere revisión[\s\S]*emitida\|0\.00\|2/, null, "legado: una factura con dos ventas no se cobra"],
  ["l_anulada_sin_reverso_void", /\nf\n/, /ERROR/, "legado, anulada sin reverso: void devuelve false"],
  ["l_anulada_sin_reverso_otra_columna", /Una factura anulada con venta requiere su reverso íntegro/, /UPDATE 1/, "legado, anulada sin reverso: otra columna falla"],
  ["la_clase", /anulada\|anulado[\s\S]*anulada\|120\.00/, null, "la fila venta_anulada|anulada, con cobro y crédito vivos"],
  ["la_renombrar", /La venta original requiere revisión[\s\S]*M1-F\|anulada/, null, "venta_anulada|anulada: rename_client_markbox falla"],
  ["la_anular_recibo", /La venta original requiere revisión[\s\S]*anulada\|120\.00/, null, "venta_anulada|anulada: void_collection_receipt falla, y el pagado no cambia"],
  ["la_revertir_credito", /La venta original requiere revisión[\s\S]*anulada\|120\.00[\s\S]*aplicado/, null, "venta_anulada|anulada: revert_referral_credits falla"],
  ["la_anular_asiento_credito", /La venta original requiere revisión[\s\S]*asentado/, null, "venta_anulada|anulada: anular el asiento referral_credit falla"],
  ["lz_lote_legado", /requiere revisión[\s\S]*DTD-Z1\nDTD-Z1/, null, "venta_anulada|anulada: rename_legacy_markboxes falla, y la marca queda igual"],
  ["g_sana_a_anulada_sin_reverso", /ERROR:\s+Una factura anulada con venta requiere su reverso íntegro/, null, "sigue frenando: anular sin reverso"],
  ["g_sana_a_borrador", /ERROR:\s+Estado de factura y par contable incompatibles/, null, "sigue frenando: volver a borrador con venta"],
  ["g_legado_a_anulada", /ERROR:\s+La relación contable de la factura requiere revisión/, null, "sigue frenando: legado con dos ventas hacia anulada"],
  ["g_anulada_reabrir", /No se desvincula ni reabre/, null, "sigue frenando: reabrir una anulada"],
  ["g_borrar", /No se desvincula ni reabre/, null, "sigue frenando: borrar con deleted_at"],
  ["g_delete", /No se desvincula ni reabre/, null, "sigue frenando: DELETE"],
  ["g_tenant", /No se desvincula ni reabre/, null, "sigue frenando: cambiar de tenant"],
  ["g_asiento_inmutable", /El asiento automático es inmutable/, null, "sigue frenando: tocar el asiento de venta"],
  ["g_sigue_sana", /emitida\|t\|0\.00/, null, "ningún intento frenado dejó rastro en la factura"],
];

// ── El desarme. Antes, con la 0497 armada; después, sin los triggers y con void de la 0294 ──
const COBRO = (label, monto) => `begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-${label}')::uuid,${monto},${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select status, paid_amount from public.invoices where id = md5('m1-${label}')::uuid;`;
const CUENTA_VENTA = (postable) => `update public.accounts set is_postable = ${postable} where tenant_id = ${TENANT} and code = '4.5';`;
const DESARME_ANTES = `
${FACTURA("d1", "M1-A", "emitida")}
${POST("d1")}
${FACTURA("d2", "M1-A", "emitida")}
${POST("d2")}
${FACTURA("d3", "M1-A", "emitida")}
${POST("d3")}
${COBRO("d3", 40)}
${FACTURA("d4", "M1-A", "emitida")}
${POST("d4")}
\\echo @@a_cobro_frenado
${CUENTA_VENTA(false)}
${COBRO("d1", 10)}
\\echo @@a_cobro_dos_ventas_frenado
${COBRO("l3", 100)}
\\echo @@a_fin
`;
const DESARME_DESPUES = `
\\echo @@d_cobro_vuelve
${COBRO("d1", 10)}
${CUENTA_VENTA(true)}
\\echo @@d_cobro_dos_ventas_vuelve
${COBRO("l3", 100)}
\\echo @@d_void
${VOID("d2", COMO_CONTABLE, "Motivo M1 del desarme")}
\\echo @@d_void_estado
select i.status,
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice_reversal'),
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice' and e.status = 'asentado'),
  (select count(*) from public.entity_audit_log a where a.entity_id = i.id and a.event_type = 'invoice_voided' and a.reason = 'Motivo M1 del desarme')
from public.invoices i where i.id = md5('m1-d2')::uuid;
\\echo @@d_post_web_nueva
${FACTURA("d5", "M1-A", "emitida", 116, 16)}
${POST("d5")}
\\echo @@d_post_lineas
select count(*), sum(l.debit), sum(l.credit) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id where e.invoice_id = md5('m1-d5')::uuid;
\\echo @@d_post_otra_vez
${POST("d5")}
\\echo @@d_post_almacen_cn
${FACTURA("d7", "M1-A", "emitida")}
${POST("d7")}
\\echo @@d_web_vieja
${FACTURA("d6", "M1-A", "emitida")}
begin; set local role service_role;
insert into public.journal_entries (id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
  values (md5('m1-e-d6')::uuid,${TENANT},'M1-d6',current_date,'Factura','asentado','invoice',md5('m1-d6')::uuid,now());
insert into public.journal_lines (entry_id,account_id,debit,credit,line_memo) values
  (md5('m1-e-d6')::uuid,${CUENTA("1.1.2")},100,0,'Sintética'), (md5('m1-e-d6')::uuid,${CUENTA("4.5")},0,100,'Sintética');
commit;
\\echo @@d_el_par_de_antes_sigue
select i.status,
  (select count(*) from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice_reversal' and e.reverses_entry_id is not null and e.status = 'asentado')
from public.invoices i where i.id = md5('m1-n1')::uuid;
\\echo @@p_void_con_cobro
begin; ${COMO_CONTABLE}
select public.void_invoice_with_audit_reason(md5('m1-d3')::uuid,'Motivo M1 del desarme');
select status, paid_amount, (select count(*) from public.payment_receipts r where r.invoice_id = i.id and r.deleted_at is null) from public.invoices i where i.id = md5('m1-d3')::uuid;
rollback;
\\echo @@p_comercial_anula
begin; ${COMO_COMERCIAL}
select public.void_invoice_with_audit_reason(md5('m1-d4')::uuid,'Motivo M1 del desarme');
select status from public.invoices where id = md5('m1-d4')::uuid;
rollback;
\\echo @@p_asiento_editable
begin;
update public.journal_entries set memo = 'Otro' where id = (select id from public.journal_entries where invoice_id = md5('m1-d4')::uuid and source = 'invoice');
rollback;
\\echo @@p_anular_venta_a_mano
begin;
update public.journal_entries set status = 'anulado' where id = (select id from public.journal_entries where invoice_id = md5('m1-d4')::uuid and source = 'invoice');
rollback;
\\echo @@fin
`;
const ESPERADO_ANTES = [
  ["a_cobro_frenado", /La venta original requiere revisión[\s\S]*emitida\|0\.00/, null, "antes del desarme: con la cuenta de venta cambiada, el cobro se frena"],
  ["a_cobro_dos_ventas_frenado", /La relación contable de la factura requiere revisión/, null, "antes del desarme: una factura con dos ventas no se cobra"],
];
const ESPERADO_DESPUES = [
  ["d_cobro_vuelve", /COMMIT[\s\S]*parcial\|10\.00/, /ERROR/, "desarme: el cobro frenado pasa"],
  ["d_cobro_dos_ventas_vuelve", /COMMIT[\s\S]*pagada\|100\.00/, /ERROR/, "desarme: la factura con dos ventas se cobra"],
  ["d_void", /\nt\n[\s\S]*COMMIT/, /ERROR/, "desarme: anular funciona como authenticated"],
  ["d_void_estado", /anulada\|0\|1\|1/, null, "desarme: anulada con su motivo, sin reverso y con la venta asentada. Esto es lo que se pierde"],
  ["d_post_web_nueva", /"outcome": "posted"/, /ERROR/, "desarme: la web nueva sigue asentando"],
  ["d_post_lineas", /3\|116\.00\|116\.00/, null, "desarme: la venta de la web nueva tiene sus tres líneas"],
  ["d_post_otra_vez", /"outcome": "already_posted"/, /ERROR/, "desarme: post repetido no duplica"],
  ["d_post_almacen_cn", /"outcome": "posted"/, /ERROR/, "desarme: una factura sana sigue asentando"],
  ["d_web_vieja", /COMMIT/, /ERROR/, "desarme: la web vieja vuelve a asentar con cabecera y líneas"],
  ["d_el_par_de_antes_sigue", /anulada\|1/, null, "desarme: el par anulado antes sigue con su reverso"],
  ["p_void_con_cobro", /\nt\n[\s\S]*anulada\|40\.00\|1/, /ERROR/, "lo que se pierde: la base deja anular con un cobro vivo"],
  ["p_asiento_editable", /UPDATE 1/, /ERROR/, "lo que se pierde: un asiento automático se puede cambiar"],
  ["p_anular_venta_a_mano", /UPDATE 1/, /ERROR/, "lo que se pierde: una venta se puede anular a mano y su factura sigue viva"],
];
const CONTEO_FILAS = "select (select count(*) from public.invoices), (select count(*) from public.journal_entries), (select count(*) from public.journal_lines), (select count(*) from public.payment_receipts), (select count(*) from public.journal_entries where reverses_entry_id is not null)";
const CATALOGO_VOID = "select proacl::text, prosecdef, proconfig::text, md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid = to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)')";

function secciones(texto) {
  const salida = {};
  let actual = null;
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^@@(\w+)$/);
    if (m) { actual = m[1]; salida[actual] = "\n"; continue; }
    if (actual) salida[actual] += linea + "\n";
  }
  return salida;
}

const reb = readFileSync(resolve(ROOT, "scripts/check-schema-rebuild.mjs"), "utf8");
const LEDGER_ONLY = [...reb.match(/const LEDGER_ONLY = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+\.sql)"/g)].map((m) => m[1]);
const pendientes = Object.keys(JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")).pendingBelowCutoff);
const saltar = new Set(pendientes.filter((p) => !p.startsWith("0495")).map((p) => p + ".sql"));
const hasta0495 = readdirSync(resolve(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
  .filter((f) => f.slice(0, 4) <= "0495" && !LEDGER_ONLY.includes(f) && !saltar.has(f));

docker(["rm", "-f", "-v", NOMBRE], { stdio: "ignore" });
const up = docker(["run", "--rm", "-d", "--name", NOMBRE, "--network", "none", "--memory", "1g", "-e", "POSTGRES_PASSWORD=postgres",
  "-v", `${resolve(ROOT, "supabase")}:/sb:ro`, "-v", `${resolve(PAQUETES)}:/paq:ro`, IMG,
  "postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "fsync=off", "-c", "full_page_writes=off"]);
if (up.status !== 0) { console.log(`NO DISPONIBLE · no levantó ${IMG}: ${up.stderr}`); process.exit(2); }

try {
  let racha = 0;
  for (let n = 0; n < 200 && racha < 5; n += 1) {
    const p = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-q", "-t", "-A", "-c", "select 1 from pg_roles where rolname = 'supabase_admin'"]);
    racha = p.status === 0 && (p.stdout || "").trim() === "1" ? racha + 1 : 0;
    if (racha < 5) spawnSync(process.execPath, ["-e", "setTimeout(()=>{},700)"]);
  }
  if (racha < 5) throw new Error("la base no quedó estable");
  const rol = sql("select rolsuper, has_parameter_privilege('postgres','dtd.audit_reason','SET') from pg_roles where rolname = 'postgres'");
  if (rol.out === "f|f") ok("rol postgres sin superusuario y sin SET sobre el parámetro"); else ko(`rol postgres: ${rol.out}`);

  const st = archivo("/sb/tests/_supabase-platform-stubs.supabase.sql");
  if (st.status !== 0) throw new Error(`stubs: ${primerError(st.out + st.err)}`);
  const t0 = Date.now();
  const run = docker(["exec", NOMBRE, "sh", "-c",
    `ok=0; for b in ${hasta0495.join(" ")}; do if psql -U postgres -q --single-transaction -v ON_ERROR_STOP=1 -f "/sb/migrations/$b" >/tmp/o.txt 2>&1; then ok=$((ok+1)); else echo "FALLA_EN|$b|$ok"; grep -m3 "ERROR:" /tmp/o.txt; exit 1; fi; done; echo "OK|$ok"`]);
  if (run.status !== 0) { ko("reconstrucción como postgres", run.stdout + run.stderr); throw new Error("reconstrucción"); }
  ok(`${hasta0495.length} migraciones hasta la 0495 como postgres, en ${Math.round((Date.now() - t0) / 1000)} s`);
  // El ledger de los stubs es mínimo. Producción tiene estas columnas (runbook §0).
  sql("alter table supabase_migrations.schema_migrations add column if not exists created_by text, add column if not exists idempotency_key text, add column if not exists rollback text[]");

  const archivo0497 = readFileSync(resolve(ROOT, `supabase/migrations/${M0497}.sql`), "utf8");
  const cabecera = "returns jsonb language plpgsql volatile security definer\nset search_path = ''\n";
  if (archivo0497.split(cabecera).length !== 2) throw new Error("no encontré la cabecera para el control en rojo");
  const ctl = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-d", "postgres", ...FLAGS, "--single-transaction", "-f",
    copiar("control.sql", archivo0497.split(cabecera).join("returns jsonb language plpgsql volatile security definer\nset search_path = '' set dtd.audit_reason = ''\n"))]);
  if (/permission denied to set parameter "dtd\.audit_reason"/.test((ctl.stdout || "") + (ctl.stderr || ""))) ok("control en rojo: un parámetro propio en la cabecera se niega");
  else ko("el control no dio el error esperado: esta prueba no detecta la clase de fallo", (ctl.stdout || "") + (ctl.stderr || ""));

  const auth = archivo(copiar("auth.sql", SEMBRAR_AUTH), { rol: "supabase_admin" });
  if (auth.status !== 0) throw new Error(`usuarios: ${primerError(auth.err)}`);
  const sem = archivo(copiar("sembrar.sql", SEMBRAR));
  if (sem.status !== 0) throw new Error(`sembrar: ${primerError(sem.err + sem.out)}`);
  ok("filas de legado sembradas antes de la 0497");

  const conteo = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-F", "|", "-f",
    copiar("conteo.sql", readFileSync(resolve(ROOT, "scripts/qa/0497-legado-por-clase.sql"), "utf8"))]);
  const filasConteo = (conteo.stdout || "").split("\n").filter((l) => /^[a-z_0-9]+\|[a-z]+\|\d+\|(pasa|FRENA)$/.test(l)).sort();
  const conteoEsperado = ["anulada_sin_reverso|anulada|1|FRENA", "dos_o_mas_ventas|emitida|1|FRENA", "sin_venta|emitida|1|pasa", "venta_anulada|anulada|2|FRENA", "venta_anulada|emitida|1|FRENA"];
  if (conteo.status === 0 && JSON.stringify(filasConteo) === JSON.stringify(conteoEsperado)) ok("el conteo por clase ve las filas de legado");
  else ko("conteo por clase", `${filasConteo.join("\n")}\n${conteo.stderr || ""}`);

  // Cómo está void antes de la 0497: es a lo que el desarme tiene que volver.
  const voidAntes = sql(CATALOGO_VOID).out;
  for (const m of [M0496, M0497]) {
    if (m === M0497) {
      // El cuerpo VIVO de producción, medido el 2026-11-01: la 0078 con otro formato.
      const f = readFileSync(resolve(ROOT, "supabase/migrations/0078_contabilidad.sql"), "utf8").replace(/\r\n/g, "\n");
      const p = f.indexOf("function public.next_entry_code(p_tenant_id uuid)");
      const cuerpo = f.slice(f.indexOf("$$", p) + 2, f.indexOf("$$;", p))
        .split("  where tenant_id = p_tenant_id\n    and entry_code like 'A-' || v_year || '-%';\n\n")
        .join("  where tenant_id = p_tenant_id and entry_code like 'A-' || v_year || '-%';\n");
      const v = archivo(copiar("vivo.sql", "create or replace function public.next_entry_code(p_tenant_id uuid) returns text language plpgsql security definer set search_path = public as $vivo$" + cuerpo + "$vivo$;\n"));
      const md5 = sql("select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid = to_regprocedure('public.next_entry_code(uuid)')").out;
      if (v.status === 0 && md5 === "06b5756a18361fc4d85cec6f6dc4b3bc") ok("next_entry_code con el cuerpo vivo de producción");
      else ko(`next_entry_code vivo: md5 ${md5}`, v.err);
    }
    conLedgerBloqueado(m);
    if (m === M0497) controlSinLimites(m);
    for (const paso of ["previa", "aplicar", "verificar"]) {
      const r = archivo(`/paq/${m}/${paso}.sql`);
      if (r.status === 0) ok(`${m.slice(0, 4)} ${paso}${paso === "aplicar" ? ` en ${r.ms} ms` : ""}`);
      else { ko(`${m.slice(0, 4)} ${paso}: ${primerError(r.err + r.out)}`); throw new Error(`${m} ${paso}`); }
    }
  }
  const cuantas = sql("select count(*) from pg_proc p, unnest(p.proconfig) c where c ~ '^[a-z_]+[.]'");
  if (cuantas.out === "0") ok("ninguna función con parámetro propio en la cabecera"); else ko(`funciones con parámetro propio: ${cuantas.out}`);

  const ruta = copiar("escenarios.sql", ESCENARIOS);
  const esc = docker(["exec", NOMBRE, "sh", "-c", `psql -U postgres -d postgres -X -At -F '|' -v VERBOSITY=terse -v SHOW_CONTEXT=never -f ${ruta} 2>&1`]);
  const secc = secciones(esc.stdout || "");
  writeFileSync(join(T, "escenarios.out"), esc.stdout || "");
  if (!("fin" in secc)) ko("los escenarios no llegaron al final", (esc.stdout || "").split("\n").slice(-12).join("\n"));
  for (const [etiqueta, debe, noDebe, texto] of ESPERADO) {
    const s = secc[etiqueta];
    if (s === undefined) ko(`${etiqueta}: la sección no corrió`);
    else if (debe.test(s) && !(noDebe && noDebe.test(s))) ok(texto);
    else ko(`${texto} (${etiqueta})`, s);
  }

  // El control posterior: con el esquema completo, cada clase da el mensaje real de la aserción,
  // y cada fila su diagnóstico. El cruce con la función real va en esta prueba
  // porque esa función usa `for update` y no corre en el archivo de solo lectura.
  const MENSAJE = {
    sana: "ok", sana_anulada_con_reverso: "ok", sin_venta: "ok",
    factura_borrada_con_venta: "La relación contable de la factura requiere revisión.",
    reverso_sin_venta: "La relación contable de la factura requiere revisión.",
    dos_o_mas_ventas: "La relación contable de la factura requiere revisión.",
    otros_asientos_en_el_par: "La relación contable de la factura requiere revisión.",
    anulada_sin_reverso: "Una factura anulada con venta requiere su reverso íntegro.",
    par_de_anulacion_invalido: "El par de anulación requiere revisión.",
    estado_sin_venta_posible: "Estado de factura y par contable incompatibles.",
  };
  // Emitida ahora, sin asiento, como la deja la web vieja.
  spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1100)"]);
  sql(FACTURA("ventana", "M1-A", "emitida"));
  const ctrl = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-F", "|", "-f",
    copiar("control.sql", readFileSync(resolve(ROOT, "scripts/qa/0497-control-posterior.sql"), "utf8"))]);
  const filasControl = (ctrl.stdout || "").split("\n").filter((l) => /^[a-z_0-9]+\|[a-z]+\|[a-z_]+\|\d+$/.test(l));
  const fila = (clase, estado, diagnostico) => filasControl.some((l) => l.startsWith(`${clase}|${estado}|${diagnostico}|`));
  const totalPorMensaje = {};
  for (const l of filasControl) {
    const [clase, , , n] = l.split("|");
    const mensaje = MENSAJE[clase] ?? "La venta original requiere revisión.";
    totalPorMensaje[mensaje] = (totalPorMensaje[mensaje] ?? 0) + Number(n);
  }
  const real = sql(`do $real$
declare f record; v_mensaje text;
begin
  create temporary table a2_real(mensaje text not null);
  for f in select id from public.invoices loop
    begin
      perform public.i3_assert_invoice_final(f.id);
      insert into a2_real values ('ok');
    exception when check_violation then
      get stacked diagnostics v_mensaje = message_text;
      insert into a2_real values (v_mensaje);
    end;
  end loop;
end;
$real$; select mensaje, count(*) from a2_real group by mensaje;`);
  const totalReal = Object.fromEntries(real.out.split("\n").filter((l) => l.includes("|")).map((l) => { const [m, n] = l.split("|"); return [m, Number(n)]; }));
  const orden = (o) => JSON.stringify(Object.entries(o).sort());
  if (ctrl.status === 0 && filasControl.length > 0 && orden(totalPorMensaje) === orden(totalReal)) ok(`el control posterior coincide con la aserción real, por mensaje, en ${filasControl.length} filas`);
  else ko("el control posterior no coincide con la aserción real", `control: ${orden(totalPorMensaje)}\nreal: ${orden(totalReal)}\n${ctrl.stderr || ""}\n${real.err}`);
  if (fila("sin_venta", "emitida", "sin_venta_fechas_recientes")) ok("el control posterior ve la factura viva sin venta con fechas recientes");
  else ko("el control posterior no ve la factura sin venta con fechas recientes", filasControl.join("\n"));
  if (fila("venta_anulada", "emitida", "viva_no_cuadra") && fila("dos_o_mas_ventas", "emitida", "viva_no_cuadra")) ok("el control posterior separa las vivas que no cuadran, con venta anulada y con dos ventas");
  else ko("el control posterior no ve las vivas que no cuadran", filasControl.join("\n"));
  if (fila("venta_anulada", "anulada", "no_viva_no_cuadra")) ok("el control posterior no confunde la anulada con su venta anulada con una viva");
  else ko("el control posterior confunde la anulada con su venta anulada", filasControl.join("\n"));
  if (!filasControl.some((l) => l.startsWith("venta_invalida_sin_clasificar|"))) ok("el control posterior clasifica todas las ventas inválidas");
  else ko("el control posterior tiene ventas sin clasificar", filasControl.join("\n"));

  // La alarma de una factura viva con la venta anulada: el B3 de la radiografía tiene que verla. Se corre
  // con la venta anulada y otra vez con la venta viva: la diferencia es esa fila y nada más.
  const rutaRadiografia = copiar("radiografia.sql", readFileSync(resolve(ROOT, "scripts/qa/radiografia-integridad.sql"), "utf8"));
  const facturasB3 = () => {
    const r = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-F", "|", "-P", "footer=off",
      "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=terse", "-v", "SHOW_CONTEXT=never", "-f", rutaRadiografia]);
    const fila = (r.stdout || "").split("\n").find((l) => l.startsWith("50|"));
    return { status: r.status, n: fila ? Number(fila.split("|")[3]) : null, err: r.stderr || "" };
  };
  const conVentaAnulada = facturasB3();
  sql("alter table public.journal_entries disable trigger i3_journal_entry_guard");
  const revivir = sql("update public.journal_entries set status = 'asentado', posted_at = now() where id = md5('m1-e-l1')::uuid");
  sql("alter table public.journal_entries enable trigger i3_journal_entry_guard");
  const conVentaViva = facturasB3();
  if (conVentaAnulada.status === 0 && conVentaViva.status === 0 && revivir.status === 0
      && conVentaAnulada.n !== null && conVentaAnulada.n - conVentaViva.n === 1) {
    ok(`la radiografía corre con la 0497 y su B3 ve la factura viva con la venta anulada (${conVentaAnulada.n} con ella, ${conVentaViva.n} sin ella)`);
  } else {
    ko("la radiografía no ve la factura viva con la venta anulada: no hay alarma", `con la venta anulada: ${conVentaAnulada.n} ${conVentaAnulada.err}\ncon la venta viva: ${conVentaViva.n} ${conVentaViva.err}\n${revivir.err}`);
  }

  // El desarme, sobre este mismo esquema con la 0497 y sus filas.
  const correr = (nombre, texto) => {
    const salida = docker(["exec", NOMBRE, "sh", "-c", `psql -U postgres -d postgres -X -At -F '|' -v VERBOSITY=terse -v SHOW_CONTEXT=never -f ${copiar(nombre, texto)} 2>&1`]);
    return secciones(salida.stdout || "");
  };
  const comparar = (seccionesCorridas, esperado) => {
    for (const [etiqueta, debe, noDebe, texto] of esperado) {
      const s = seccionesCorridas[etiqueta];
      if (s === undefined) ko(`${etiqueta}: la sección no corrió`);
      else if (debe.test(s) && !(noDebe && noDebe.test(s))) ok(texto);
      else ko(`${texto} (${etiqueta})`, s);
    }
  };
  const antesDesarme = correr("desarme-antes.sql", DESARME_ANTES);
  if (!("a_fin" in antesDesarme)) ko("el control de antes del desarme no llegó al final");
  comparar(antesDesarme, ESPERADO_ANTES);
  const filasAntes = sql(CONTEO_FILAS).out;
  const desarme = archivo("/sb/desarmes/0497_desarme.sql", { extra: ["--single-transaction"] });
  if (desarme.status === 0) ok(`desarme aplicado como postgres, en ${desarme.ms} ms`);
  else { ko(`desarme: ${primerError(desarme.err + desarme.out)}`); throw new Error("desarme"); }
  const filasDespues = sql(CONTEO_FILAS).out;
  if (filasAntes && filasAntes === filasDespues) ok(`desarme: no cambia ni borra ninguna fila (${filasDespues})`);
  else ko("desarme: cambiaron las filas", `${filasAntes}\n${filasDespues}`);
  const triggers = sql("select count(*) from pg_trigger where not tgisinternal and tgname like 'i3\\_%'").out;
  if (triggers === "0") ok("desarme: no queda ningún trigger de la 0497"); else ko(`desarme: quedan ${triggers} triggers`);
  const voidDespues = sql(CATALOGO_VOID).out;
  if (voidAntes && voidDespues === voidAntes) ok("desarme: void vuelve al cuerpo, al modo y a los permisos de antes de la 0497");
  else ko("desarme: void no es el de antes de la 0497", `antes:   ${voidAntes}\ndespués: ${voidDespues}`);
  const conserva = sql("select exists (select 1 from pg_attribute where attrelid = 'public.journal_entries'::regclass and attname = 'reverses_entry_id' and not attisdropped), to_regclass('public.journal_entries_un_reverso') is not null, (select condeferrable from pg_constraint where conname = 'journal_lines_entry_id_fkey'), (select count(*) from pg_proc where proname like 'i3\\_%')").out;
  if (conserva === "t|t|t|12") ok("desarme: conserva la columna, el índice, la FK diferible y las doce funciones sin uso");
  else ko(`desarme: no conservó lo esperado: ${conserva}`);
  const otraVez = archivo("/sb/desarmes/0497_desarme.sql", { extra: ["--single-transaction"] });
  if (otraVez.status !== 0 && /Desarme abortado/.test(otraVez.err + otraVez.out)) ok("desarme: correrlo otra vez aborta en su preflight");
  else ko("desarme: correrlo otra vez no abortó", otraVez.err + otraVez.out);
  const despuesDesarme = correr("desarme-despues.sql", DESARME_DESPUES);
  if (!("fin" in despuesDesarme)) ko("los escenarios del desarme no llegaron al final");
  comparar(despuesDesarme, ESPERADO_DESPUES);
  console.log(`MEDIDO · comercial, con void de la 0294, sobre una factura emitida:${despuesDesarme.p_comercial_anula.replace(/\s+/g, " ").slice(0, 160)}`);
  const ctrlDesarme = docker(["exec", NOMBRE, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-F", "|", "-f",
    copiar("control-desarme.sql", readFileSync(resolve(ROOT, "scripts/qa/0497-control-posterior.sql"), "utf8"))]);
  if ((ctrlDesarme.stdout || "").split("\n").some((l) => l.startsWith("anulada_sin_reverso|anulada|"))) ok("desarme: el control posterior lista lo anulado sin reverso, que hay que reparar antes de volver a armar");
  else ko("desarme: el control posterior no ve lo anulado sin reverso", ctrlDesarme.stdout || ctrlDesarme.stderr || "");

  for (const test of [`${M0496}.test.sql`, `${M0497}.test.sql`]) {
    const base = `contrato_${test.slice(0, 4)}`;
    sql(`create database ${base} owner postgres`);
    const r = archivo(`/sb/tests/${test}`, { db: base });
    const verde = r.out.split("\n").filter((l) => /GREEN/.test(l)).slice(-1)[0] || "";
    if (r.status === 0 && verde) ok(`contrato ${test.slice(0, 4)} como postgres:${verde}`);
    else ko(`contrato ${test.slice(0, 4)}: ${primerError(r.err + r.out)}`);
  }
} catch (error) {
  ko(`corte: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  docker(["rm", "-f", "-v", NOMBRE], { stdio: "ignore" });
  rmSync(T, { recursive: true, force: true });
}
console.log(`RESULTADO: ${pasaron} PASÓ · ${fallaron} FALLÓ`);
process.exit(fallaron === 0 ? 0 : 1);
