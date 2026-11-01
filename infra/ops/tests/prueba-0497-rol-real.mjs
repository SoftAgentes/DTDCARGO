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
 *      aplicar.sh y el cuerpo vivo de next_entry_code.
 *   5. Las RPC como `authenticated` y `service_role` sobre el esquema completo. Conviven
 *      con invoices_seal_billing_titular, invoices_referral_sale_voided, referrals_candado_trg
 *      e invoices_write_version. Incluye cobro, crédito, renombre, salidas con excepción
 *      y las filas de legado.
 *   6. Los contratos de 0496 y 0497 en una base nueva, como `postgres`.
 *
 * Límites: tablas casi vacías, sin concurrencia, Auth y Storage son los stubs del repo, sin
 * PostgREST. Las carreras no corren aquí: su guarda exige que los roles no existan.
 */
import { spawnSync } from "node:child_process";
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

// ── Filas sembradas ANTES de la 0497 ───────────────────────────────────────────────
const ID_CONTABLE = "05730000-0000-4000-8000-000000000001";
const ID_COMERCIAL = "05730000-0000-4000-8000-000000000002";
const SEMBRAR_AUTH = `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('${ID_CONTABLE}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contabilidad@prueba.example.test','{}','{}'),
  ('${ID_COMERCIAL}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comercial@prueba.example.test','{}','{}');`;
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
const SEMBRAR = `begin;
insert into public.user_profiles (user_id,first_name,last_name) values
  ('${ID_CONTABLE}','Contabilidad','PRUEBA'), ('${ID_COMERCIAL}','Comercial','PRUEBA')
  on conflict (user_id) do nothing;
insert into public.user_tenants (user_id,tenant_id,role) values
  ('${ID_CONTABLE}',${TENANT},'accounting'), ('${ID_COMERCIAL}',${TENANT},'commercial');
${["A", "B", "C", "D", "E", "L"].map(CLIENTE).join("\n")}
${FACTURA("l1", "M1-L", "emitida")}
${VENTA("l1", "l1", "anulado")}
${FACTURA("l2", "M1-L", "anulada")}
${VENTA("l2", "l2")}
${FACTURA("l3", "M1-L", "emitida")}
${VENTA("l3", "l3-1")}
${VENTA("l3", "l3-2")}
commit;`;

// ── Después de la 0497. Cada sección se abre con su marca y se compara abajo ───────
const COMO_CONTABLE = `set local role authenticated; select set_config('request.jwt.claim.sub','${ID_CONTABLE}',true);`;
const COMO_COMERCIAL = `set local role authenticated; select set_config('request.jwt.claim.sub','${ID_COMERCIAL}',true);`;
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
\\echo @@l_cobro_congelado
begin; ${COMO_CONTABLE}
select public.register_collection_receipt(md5('m1-l1')::uuid,10,${CUENTA("1.1.1.1")},'transferencia',current_date,'M1',null,'cliente',null,null,true);
commit;
select paid_amount, (select count(*) from public.payment_receipts where invoice_id = md5('m1-l1')::uuid) from public.invoices where id = md5('m1-l1')::uuid;
\\echo @@l_renombre_congelado
begin; ${COMO_COMERCIAL}
select public.rename_client_markbox(md5('m1-c-L')::uuid,'M1-L2','Motivo M1 del renombre');
commit;
select client_markbox from public.invoices where id = md5('m1-l1')::uuid;
\\echo @@l_dos_ventas_congelada
update public.invoices set notes = 'M1' where id = md5('m1-l3')::uuid;
\\echo @@l_anulada_sin_reverso_void
${VOID("l2")}
\\echo @@l_anulada_sin_reverso_update
update public.invoices set notes = 'M1' where id = md5('m1-l2')::uuid;
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
  ["e_savepoint_con_asiento", /M1 falla forzada[\s\S]*postgres\|M1 exterior\|emitida\|0/, null, "excepción con savepoint, con asiento: nada cambia"],
  ["e_savepoint_sin_asiento", /M1 falla forzada[\s\S]*postgres\|M1 exterior\|emitida/, null, "excepción con savepoint, sin asiento: nada cambia"],
  ["e_sin_capturar_en_transaccion", /M1 falla forzada[\s\S]*postgres\|M1 sesion/, null, "excepción sin capturar en transacción: queda el valor de la sesión"],
  ["e_sin_capturar_autocommit", /M1 falla forzada[\s\S]*postgres\|M1 sesion/, null, "excepción sin capturar sin transacción: queda el valor de la sesión"],
  ["e_sin_valor_previo", /M1 falla forzada[\s\S]*\nt\n/, null, "excepción sin valor previo: no queda motivo"],
  ["e_exito_conserva_sesion", /COMMIT[\s\S]*M1 sesion\|0/, /ERROR/, "éxito: queda el valor de la sesión y no entra a ningún evento"],
  ["l_void_venta_anulada", /Los antecedentes de venta requieren revisión/, null, "legado, venta anulada: void lo rechaza"],
  ["l_post_venta_anulada", /"reason": "existing_sale_requires_review"/, /ERROR/, "legado, venta anulada: post pide revisión"],
  ["l_cobro_congelado", /ERROR:\s+La venta original requiere revisión[\s\S]*0\.00\|0/, null, "A2: un cobro sobre esa factura falla al confirmar y no deja nada"],
  ["l_renombre_congelado", /ERROR:\s+La (venta original|relación contable)[\s\S]*M1-L\b/, null, "A2: renombrar al cliente falla al confirmar y no deja nada"],
  ["l_dos_ventas_congelada", /La relación contable de la factura requiere revisión/, null, "A2: factura con dos ventas congelada"],
  ["l_anulada_sin_reverso_void", /\nf\n/, /ERROR/, "legado, anulada sin reverso: void devuelve false"],
  ["l_anulada_sin_reverso_update", /Una factura anulada con venta requiere su reverso íntegro/, null, "A2: anulada sin reverso congelada"],
];

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
const up = docker(["run", "--rm", "-d", "--name", NOMBRE, "--network", "none", "-e", "POSTGRES_PASSWORD=postgres",
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
  const filasConteo = (conteo.stdout || "").split("\n").filter((l) => /^[a-z_0-9]+\|[a-z]+\|\d+$/.test(l)).sort();
  const conteoEsperado = ["anulada_sin_reverso|anulada|1", "dos_o_mas_ventas|emitida|1", "venta_anulada|emitida|1"];
  if (conteo.status === 0 && JSON.stringify(filasConteo) === JSON.stringify(conteoEsperado)) ok("el conteo por clase ve las tres filas de legado");
  else ko("conteo por clase", `${filasConteo.join("\n")}\n${conteo.stderr || ""}`);

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
