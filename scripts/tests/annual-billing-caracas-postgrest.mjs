#!/usr/bin/env node
/**
 * 0576 C2: PostgreSQL 17 + PostgREST 14.17, datos/JWT sintéticos, solo loopback.
 * Uso: node scripts/tests/annual-billing-caracas-postgrest.mjs --evidence C:/tmp/...
 * Requiere Docker activo. No arranca Desktop, no env/productivo ni recursos ajenos.
 * Ejecuta contrato SQL con rollback; fixture HTTP confirmado antes de arrancar
 * Tres RPC existentes -> PostgREST -> 0500 real/COMMIT -> NOTIFY en caliente -> HTTP posterior.
 * auth.uid es adaptador sintético; get_user_tenant_id procede de 0453 REAL.
 * current_studio_role procede de0200 REAL; otras dependencias son fixtures declaradas.
 * No demuestra Auth de Supabase ni conexiones/sesiones productivas.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const option = process.argv.indexOf("--evidence");
assert(option >= 0 && process.argv[option + 1], "Falta --evidence con directorio externo");
const evidence = resolve(process.argv[option + 1]);
assert(isAbsolute(evidence) && !evidence.startsWith(root), "La evidencia debe quedar fuera del worktree");
await mkdir(evidence, { recursive: true });
const suffix = process.pid + "-" + Date.now().toString(36);
const network = "dtd-0576c2-" + suffix;
const pg = network + "-pg";
const rest = network + "-rest";
const imagePg = "postgres:17";
const imageRest = "postgrest/postgrest:v14.17";
const syntheticPassword = randomBytes(24).toString("hex");
const syntheticJwtSecret = randomBytes(32).toString("hex");
const receipt = { startedAt: new Date().toISOString(), root, head: null, migrationSha256: null, images: {}, checks: [], resources: { network, pg, rest }, cleanup: [], result: "RUNNING" };
const httpOnly = process.argv.includes("--http-only");
receipt.httpNegatives = [];
const negative = (name, response) => receipt.httpNegatives.push({ name, ...response });
const created = [];
let hasNetwork = false;

function run(command, args, { input, timeout = 120000, allowFailure = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill(), allowFailure ? timeout : Math.min(timeout, Math.max(1, 20*60_000-(Date.now()-started))));
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if ((code !== 0 || signal) && !allowFailure) reject(new Error(command + " terminó " + code + "/" + signal + "\n" + stderr + "\n" + stdout));
      else resolveRun({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
const docker = (args, options) => run("docker", args, options);
const save = (name, data) => writeFile(resolve(evidence, name), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, details = {}) => { receipt.checks.push({ name, at: new Date().toISOString(), ...details }); console.log("PASÓ: " + name); };
const id = (label) => {
  const hex = createHash("md5").update("0498-synthetic-" + label).digest("hex");
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
};
const token = (actor, role = "authenticated") => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, sub: id(actor), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const unsigned = header + "." + payload;
  return unsigned + "." + createHmac("sha256", syntheticJwtSecret).update(unsigned).digest("base64url");
};
async function port() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const value = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return value;
}
const httpPort = await port();
const base = "http://127.0.0.1:" + httpPort;
receipt.resources.httpPort = httpPort;
const psql = (sql) => docker(["exec", "-i", pg, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-At"], { input: sql });
async function rpc(name, actor, body = {}, options = {}) {
  ensureBudget();
  const headers = { "Content-Type": "application/json", ...(actor ? { Authorization: "Bearer " + token(actor, options.role) } : {}), ...(options.headers ?? {}) };
  const query = new URLSearchParams(options.query ?? {}).toString();
  const response = await fetch(base + "/rpc/" + name + (query ? "?" + query : ""), { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, range: response.headers.get("content-range") };
}
async function eventually(operation, predicate, ms = 30000) {
  const until = Date.now() + ms;
  let last;
  do { try { last = await operation(); if (predicate(last)) return last; } catch (error) { last = String(error); } await delay(300); } while (Date.now() < until);
  throw new Error("Espera local agotada: " + JSON.stringify(last));
}
// Recursos propios: hasta 20 min, cada comando <=120s (arranque <=300s),
// HTTP15s, espera30/60s. PG2CPU/1GiB/128pids; REST1CPU/512MiB/128pids.
// No lee .env, no conecta cuentas; el SQL de negocio de este fixture es sintético.
const migrationPath = resolve(root,'supabase/migrations/0500_annual_billing_caracas.sql');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const started = Date.now();
const ensureBudget = () => assert(Date.now()-started < 20*60*1000,'presupuesto de20min agotado');
const signatures = ['public.studio_client_annual_billing(date)','public.studio_client_annual_billing_v2(date)','public.get_portal_referral_program()'];
async function catalog() {
  const result = await psql(`select jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'bodyMd5',md5(prosrc),'owner',proowner::regrole::text,'acl',proacl,'definer',prosecdef,'volatility',provolatile,'config',proconfig,'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'effectiveAcl',(select jsonb_object_agg(r,has_function_privilege(r,p.oid,'EXECUTE')) from unnest(array['anon','authenticated','service_role']) r)) order by p.oid) from pg_proc p where p.oid in (${signatures.map(s=>"'"+s+"'::regprocedure").join(',')});`);
  return JSON.parse(result.stdout.trim());
}
const functionName = (signature) => signature.slice(0,signature.indexOf('(')).split('.').at(-1);
async function readAll(asOf) {
  const responses = {};
  for (const signature of signatures) {
    const name = functionName(signature);
    const response = await rpc(name,name==='get_portal_referral_program'?'portal':'commercial',name==='get_portal_referral_program'?{}:{p_as_of:asOf});
    assert.equal(response.status,200,signature); responses[name]=response;
  }
  return responses;
}
let realDefinitions;
async function freeze(instant) {
  assert(realDefinitions,'DDL real y catálogo requeridos antes de instrumentar');
  const anchors=[];
  const definitions=realDefinitions.map(row=>{
    const anchor='pg_catalog.transaction_timestamp()';
    const count=row.definition.split(anchor).length-1;
    assert.equal(count,2,'ancla de reloj '+row.signature);
    assert(!row.definition.includes('current_date'),'ningún current_date residual');
    const fixed="'"+instant+"'::timestamptz";
    const definition=row.definition.replaceAll(anchor,fixed);
    anchors.push({signature:row.signature,count,originalSha256:sha(row.definition),copySha256:sha(definition),anchor,replacement:fixed});
    return definition;
  });
  const ddl=await psql('begin;\n'+definitions.map(d=>d+';').join('\n')+'\ncommit; notify pgrst, \'reload schema\';');
  await save('clock-'+instant.replaceAll(/[^0-9]/g,'')+'.json',{phase:'instrumentada DESPUÉS de DDL real',instant,anchors,ddlExit:ddl.code});
}
try {
  receipt.head=(await run('git',['rev-parse','HEAD'])).stdout.trim();
  receipt.gitStatus=(await run('git',['status','--porcelain'])).stdout.trim();
  const originalMigration=await readFile(migrationPath,'utf8');
  receipt.migrationSha256=sha(originalMigration);
  receipt.sourceFiles={};
  for(const file of ['0411_client_annual_billing_facade.sql','0498_annual_billing_fx_v2.sql','0500_annual_billing_caracas.sql']) receipt.sourceFiles[file]=sha(await readFile(resolve(root,'supabase/migrations',file),'utf8'));
  for(const file of ['supabase/tests/0500_annual_billing_caracas.test.sql','scripts/tests/annual-billing-caracas-postgrest.mjs']) receipt.sourceFiles[file]=sha(await readFile(resolve(root,file),'utf8'));
  receipt.dockerVersion=(await docker(['version','--format','{{.Server.Version}}'])).stdout.trim();
  await docker(['network','create','--label','dtd.task=0576c2',network]);hasNetwork=true;
  await docker(['run','-d','--name',pg,'--label','dtd.task=0576c2','--network',network,'--network-alias','db','--cpus','2','--memory','1g','--pids-limit','128','--mount','type=bind,source='+resolve(root,'supabase')+',target=/sb,readonly','-e','POSTGRES_PASSWORD='+syntheticPassword,imagePg],{timeout:300000});created.push(pg);
  await eventually(()=>docker(['exec',pg,'pg_isready','-U','postgres'],{allowFailure:true}),r=>r.code===0,60000);
  receipt.images.postgres=(await docker(['inspect','--format','{{.Image}}',pg])).stdout.trim();
  receipt.postgresVersion=(await psql('select version();')).stdout.trim();assert.match(receipt.postgresVersion,/PostgreSQL 17\./);
  if(!httpOnly){
    const result=await docker(['exec',pg,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/sb/tests/0500_annual_billing_caracas.test.sql']);
    await save('postgres-contract.log',result.stdout+'\n'+result.stderr);
    assert.match(result.stdout,/TEST 0500 GREEN: \d+ aserciones/);
    check('PG17 contrato SQL íntegro y rollback',{marker:result.stdout.match(/TEST 0500 GREEN: \d+ aserciones/)[0]});
  } else receipt.sqlContract='NO EJECUTADO en --http-only';
  ensureBudget();
  const fixture=await docker(['exec',pg,'psql','-X','-v','ON_ERROR_STOP=1','-v','fixture_only=true','-U','postgres','-d','postgres','-f','/sb/tests/0500_annual_billing_caracas.test.sql']);
  await save('http-fixture.log',fixture.stdout+'\n'+fixture.stderr);
  // 0033, 0404, 0411, 0414, 0498 y dependencias reales anuales ya están cargados.
  // Un documento fallback exactamente en el lower UTC cambia solo por fecha.
  const asOf=(await psql("select (transaction_timestamp() at time zone 'America/Caracas')::date::text;")).stdout.trim();
  const oldDay=(await psql('select current_date::text;')).stdout.trim();
  const sameCivilDay = asOf === oldDay;
  await psql(`insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,total_amount,status,issued_at,created_at) values
   (md5('c2-real-edge')::uuid,'${id('A')}','c2-real-edge','DTD-BASE','Sintético','USD',17,17,'emitida',null,((date '${asOf}'-interval '1 year')::date::text||'T03:59:59.999Z')::timestamptz),
   (md5('c2-real-issued-lower')::uuid,'${id('A')}','c2-real-issued-lower','DTD-BASE','Sintético','USD',19,19,'emitida',(date '${asOf}'-interval '1 year')::date,'2000-01-01T00:00:00Z'),
   (md5('c2-real-interior')::uuid,'${id('A')}','c2-real-interior','DTD-INSIDE','Sintético','USD',100.01,100.01,'emitida',date '${asOf}'-7,'${asOf}T02:30:00Z');
   create role authenticator login noinherit password '${syntheticPassword}'; grant anon,authenticated,service_role to authenticator;`);
  const catalogBefore=await catalog();
  assert.deepEqual(catalogBefore.map(r=>r.bodyMd5).sort(),['7c2b0441e1de89bbf4f23054813acc5b','6cf40c5a38865b2bba9b1bb5017cc620','faa932bd5dac31bc560ed2085670432d'].sort());
  const privateBefore=(await psql("select jsonb_agg(jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) order by p.oid) from pg_proc p where p.oid in ('annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)'::regprocedure,'public.to_usd(numeric,text,numeric)'::regprocedure,'public.get_user_tenant_id()'::regprocedure,'public.current_studio_role()'::regprocedure);")).stdout.trim();
  const stateSql="select jsonb_build_object('invoices',(select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i),'audit',(select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.entity_audit_log a),'policies',(select md5(jsonb_agg(to_jsonb(p) order by tablename,policyname)::text) from pg_policies p where schemaname='public'));";
  const stateBefore=(await psql(stateSql)).stdout.trim();
  await docker(['run','-d','--name',rest,'--label','dtd.task=0576c2','--network',network,'--cpus','1','--memory','512m','--pids-limit','128','-p','127.0.0.1:'+httpPort+':3000','-e','PGRST_DB_URI=postgres://authenticator:'+syntheticPassword+'@db:5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_MAX_ROWS=500','-e','PGRST_JWT_SECRET='+syntheticJwtSecret,imageRest],{timeout:300000});created.push(rest);
  receipt.images.postgrest=(await docker(['inspect','--format','{{.Image}}',rest])).stdout.trim();
  receipt.postgrestVersion=(await docker(['exec',rest,'/bin/postgrest','--version'])).stdout.trim();assert.match(receipt.postgrestVersion,/14\.17/);
  await eventually(()=>rpc('get_portal_referral_program','portal'),r=>r.status===200);
  const before=await readAll(asOf);await save('http-before.json',before);
  assert.equal(before.studio_client_annual_billing_v2.data.find(r=>r.client_markbox==='DTD-BASE').subtotal_usd,'246.00');
  assert.equal(before.get_portal_referral_program.data.billing_v2.subtotal_usd,sameCivilDay?'251.00':'215.00');
  check('HTTP ANTES: las tres RPC existen y responden200, semántica anterior medida');
  receipt.postgrestStartedAtBeforeDdl=(await docker(['inspect','--format','{{.State.StartedAt}}',rest])).stdout.trim();
  receipt.postgrestPidBeforeDdl=(await docker(['inspect','--format','{{.State.Pid}}',rest])).stdout.trim();
  const reloadLog=async()=>{const r=await docker(['logs',rest]);const text=r.stdout+r.stderr;return {text,messages:(text.match(/Received a schema cache reload message/g)??[]).length,loads:(text.match(/Schema cache loaded in /g)??[]).length};};
  const reloadBefore=await reloadLog();
  receipt.ddlStartedAt=new Date().toISOString();
  const ddl=await docker(['exec',pg,'psql','-X','-1','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/sb/migrations/0500_annual_billing_caracas.sql']);
  await save('http-migration-0500.log',ddl.stdout+'\n'+ddl.stderr);receipt.ddlCommittedAt=new Date().toISOString();
  const reloadAfter=await eventually(reloadLog,r=>r.messages>reloadBefore.messages&&r.loads>reloadBefore.loads);
  receipt.schemaReload={messagesBefore:reloadBefore.messages,messagesAfter:reloadAfter.messages,loadsBefore:reloadBefore.loads,loadsAfter:reloadAfter.loads,observedAt:new Date().toISOString()};
  await save('real-schema-reload.log',reloadAfter.text);
  const after=await readAll(asOf);await save('http-after.json',after);
  receipt.postgrestStartedAtAfterDdl=(await docker(['inspect','--format','{{.State.StartedAt}}',rest])).stdout.trim();
  receipt.postgrestPidAfterDdl=(await docker(['inspect','--format','{{.State.Pid}}',rest])).stdout.trim();
  assert.equal(receipt.postgrestStartedAtAfterDdl,receipt.postgrestStartedAtBeforeDdl);assert.equal(receipt.postgrestPidAfterDdl,receipt.postgrestPidBeforeDdl);
  const catalogAfter=await catalog();await save('catalog-real.json',{before:catalogBefore,after:catalogAfter});
  const omit=(row,fields)=>Object.fromEntries(Object.entries(row).filter(([key])=>!fields.includes(key)));
  const withoutBody=rows=>rows.map(row=>omit(row,['definition','bodyMd5']));
  assert.deepEqual(withoutBody(catalogAfter),withoutBody(catalogBefore));
  assert.equal(catalogAfter.find(r=>r.signature.startsWith('studio_client_annual_billing(')||r.signature.startsWith('public.studio_client_annual_billing(')).effectiveAcl.service_role,true);
  assert(catalogAfter.filter(r=>!/^public\.?studio_client_annual_billing\(/.test(r.signature)&&!/^studio_client_annual_billing\(/.test(r.signature)).every(r=>!r.effectiveAcl.service_role));
  const privateAfter=(await psql("select jsonb_agg(jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) order by p.oid) from pg_proc p where p.oid in ('annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)'::regprocedure,'public.to_usd(numeric,text,numeric)'::regprocedure,'public.get_user_tenant_id()'::regprocedure,'public.current_studio_role()'::regprocedure);")).stdout.trim();
  assert.equal(privateAfter,privateBefore);assert.equal((await psql(stateSql)).stdout.trim(),stateBefore);
  await save('catalog-untouched.json',{helpersBefore:JSON.parse(privateBefore),helpersAfter:JSON.parse(privateAfter),stateBefore:JSON.parse(stateBefore),stateAfter:JSON.parse((await psql(stateSql)).stdout.trim())});
  assert.equal(after.studio_client_annual_billing_v2.data.find(r=>r.client_markbox==='DTD-BASE').subtotal_usd,'229.00');
  assert.equal(after.studio_client_annual_billing.data.find(r=>r.client_markbox==='DTD-BASE').billed_usd,129);
  assert.equal(after.get_portal_referral_program.data.billing_v2.subtotal_usd,'234.00');
  assert.equal(after.get_portal_referral_program.data.billed_usd,134);
  for(const name of ['studio_client_annual_billing','studio_client_annual_billing_v2']) assert.deepEqual(after[name].data.find(r=>r.client_markbox==='DTD-INSIDE'),before[name].data.find(r=>r.client_markbox==='DTD-INSIDE'));
  const nonAnnual=row=>omit(row,['billed_usd','billing_v2']);
  assert.deepEqual(nonAnnual(after.get_portal_referral_program.data),nonAnnual(before.get_portal_referral_program.data));
  check('DDL0500 REAL/COMMIT/recarga mismo proceso; borde fallback cambia17 y Portal según reloj civil, interior/campos/ACL/helpers/RLS/filas intactos');
  realDefinitions=catalogAfter;
  // SOLO AHORA se permite congelar copias de reloj para bordes reproducibles.
  await psql(`update public.clients set markbox='TIME-HTTP' where id='${id('client-A')}';
   insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,total_amount,status,issued_at,created_at)
   select md5('c2-http-'||label)::uuid,'${id('A')}',label,'TIME-HTTP','Sintético','USD',amount,amount,'emitida',issued::date,created::timestamptz from (values
    ('h-lower',11,'2025-10-20','2026-10-30T12:00:00Z'),('h-before',13,'2025-10-19','2026-10-21T02:30:00Z'),('h-priority',17,'2025-10-20','2000-01-01T12:00:00Z'),
    ('h-fallback-lower',19,null,'2025-10-21T02:30:00Z'),('h-fallback-before',23,null,'2025-10-20T02:30:00Z'),('h-upper',29,'2026-10-20','2026-10-21T02:30:00Z'),
    ('h-future',31,'2026-10-21','2026-10-21T02:30:00Z'),('h-fallback-upper',37,null,'2026-10-21T03:59:59.999Z'),('h-fallback-future',41,null,'2026-10-21T04:00:00Z')) v(label,amount,issued,created);`);
  for(const [instant,day,studio,portal] of [['2026-10-21T02:30:00Z','2026-10-20','113.00','185.00'],['2026-10-21T03:59:59.999Z','2026-10-20','113.00','185.00'],['2026-10-21T04:00:00Z','2026-10-21','138.00','138.00']]){
    await freeze(instant);
    const responses=await readAll(day);
    assert.equal(responses.studio_client_annual_billing_v2.data.find(r=>r.client_markbox==='TIME-HTTP').subtotal_usd,studio);
    assert.equal(responses.studio_client_annual_billing.data.find(r=>r.client_markbox==='TIME-HTTP').billed_usd,Number(studio));
    assert.equal(responses.get_portal_referral_program.data.billing_v2.subtotal_usd,portal);assert.equal(responses.get_portal_referral_program.data.billed_usd,Number(portal));
    await save('http-fixed-'+instant.replaceAll(/[^0-9]/g,'')+'.json',{instant,day,responses});
  }
  check('HTTP copias instrumentadas02:30/03:59:59.999/04:00; ambos consumidores y fórmulas con oráculos propios');
  await psql('begin;\n'+realDefinitions.map(r=>r.definition+';').join('\n')+'\ncommit; notify pgrst, \'reload schema\';');
  assert.deepEqual(await catalog(),catalogAfter);check('restauración íntegra de las tres definiciones reales');
  for(const name of ['studio_client_annual_billing','studio_client_annual_billing_v2']){
    for(const actor of ['disabled','ambiguous','operations','portal']){const response=await rpc(name,actor,{p_as_of:asOf});negative(name+' '+actor,response);assert.equal(response.status,403);assert.equal(response.data.code,'42501');}
    const other=await rpc(name,'other',{p_as_of:asOf});assert.equal(other.status,200);assert.equal(other.data.length,1);assert.equal(Number(other.data[0].subtotal_usd??other.data[0].billed_usd),999);
    const anon=await rpc(name,'commercial',{p_as_of:asOf},{role:'anon'});negative(name+' anon',anon);assert([401,403,404].includes(anon.status));
    for(const value of [null,'1900-01-01','9999-12-31']){const response=await rpc(name,'commercial',{p_as_of:value});negative(name+' fecha '+value,response);assert.equal(response.data.code,'22023');}
    const invalid=await rpc(name,'commercial',{p_as_of:'fecha-invalida'});negative(name+' shape fecha',invalid);assert.equal(invalid.status,400);assert.equal(invalid.data.code,'22007');
    await psql(`insert into public.studio_role_module_overrides values('${id('A')}','commercial','fidelizacion',false);`);assert.equal((await rpc(name,'commercial',{p_as_of:asOf})).status,200);
    await psql(`insert into public.studio_role_module_overrides values('${id('A')}','commercial','kommo',false);`);const denied=await rpc(name,'commercial',{p_as_of:asOf});negative(name+' ambosfalse',denied);assert.equal(denied.status,403);await psql('delete from public.studio_role_module_overrides;');
  }
  const serviceV1=await rpc('studio_client_annual_billing','commercial',{p_as_of:asOf},{role:'service_role'});assert.equal(serviceV1.status,200);negative('service_role v1 permitido con autorización interna',serviceV1);
  const serviceV2=await rpc('studio_client_annual_billing_v2','commercial',{p_as_of:asOf},{role:'service_role'});negative('service_role v2',serviceV2);assert([401,403,404].includes(serviceV2.status));
  for(const role of ['anon','service_role']){const response=await rpc('get_portal_referral_program','portal',{}, {role});negative('Portal ACL '+role,response);assert([401,403,404].includes(response.status));}
  for(const actor of ['revoked','incoherent']){const response=await rpc('get_portal_referral_program',actor);negative('Portal '+actor,response);assert.equal(response.status,200);assert.equal(response.data,null);}
  const noAuth=await rpc('studio_client_annual_billing_v2',null,{p_as_of:asOf});negative('sin JWT',noAuth);assert([401,403,404].includes(noAuth.status));
  const privateFn=await rpc('convertir_factura_anual_usd','admin',{p_amount:1,p_currency:'USD',p_rate:null});negative('helper privado sin ruta',privateFn);assert.equal(privateFn.status,404);
  check('HTTP JWT/ACL diferenciada, tenant ajeno, ambigüedad, revocado, overridefalse, rol no habilitado, errores reales y helper privado');
  ensureBudget();
  await psql(`insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at)
   select md5('c2-http-page-'||g)::uuid,'${id('B')}','page-'||g,'Z-'||lpad(g::text,5,'0'),'Sintético','CNY',case when g>=1000 then null else 7 end,g,g,'emitida',date '${asOf}' from generate_series(1,1201)g;`);
  const rows=[],pages=[];let offset=0;
  for(let page=0;page<10;page++){
    const response=await rpc('studio_client_annual_billing_v2','other',{p_as_of:asOf},{query:{offset:String(offset),limit:'1000',order:'client_markbox.asc'}});
    assert([200,206].includes(response.status));assert(Array.isArray(response.data));assert(response.data.length<=500);
    pages.push({offset,limit:1000,p_as_of:asOf,length:response.data.length,range:response.range,last:response.data.at(-1),allExcluded:response.data.length>0&&response.data.every(r=>r.subtotal_usd==='0.00'&&r.sin_tasa_count===1&&r.conversion_state==='sin_tasa')});
    if(response.data.length===0)break;rows.push(...response.data);offset+=response.data.length;
  }
  assert.deepEqual(pages.map(p=>p.length),[500,500,202,0]);assert.deepEqual(pages.map(p=>p.offset),[0,500,1000,1202]);assert(pages[2].allExcluded);assert.equal(new Set(pages.map(p=>p.p_as_of)).size,1);assert.equal(rows.length,1202);assert.equal(new Set(rows.map(r=>r.client_markbox)).size,1202);
  assert.deepEqual(rows.at(-1),{client_markbox:'Z-01201',subtotal_usd:'0.00',sin_tasa_count:1,conversion_state:'sin_tasa'});
  await save('http-pagination.json',{asOf,pages,count:rows.length,last:rows.at(-1)});check('HTTP1202 grupos/cap500/500/202/0; última página completa solo excluidas, p_as_of único',{pages});
  assert.equal(sha(await readFile(migrationPath,'utf8')),receipt.migrationSha256);assert.deepEqual(await catalog(),catalogAfter);receipt.result='PASÓ';
} catch(error){receipt.result='FALLÓ';receipt.error=String(error);console.error(receipt.error);process.exitCode=1;
} finally {
  for(const name of [...created].reverse()){
    try{if(name===rest){const logs=await docker(['logs',name],{allowFailure:true});await save('postgrest.log',logs.stdout+logs.stderr);}
      const result=await docker(['rm','-f','-v',name],{allowFailure:true});const remaining=await docker(['inspect',name],{allowFailure:true});receipt.cleanup.push({name,exit:result.code,absent:remaining.code!==0});if(result.code!==0||remaining.code===0){receipt.result='FALLÓ';process.exitCode=1;}
    }catch(error){receipt.cleanup.push({name,error:String(error)});receipt.result='FALLÓ';process.exitCode=1;}
  }
  if(hasNetwork){const cleanup=await docker(['network','rm',network],{allowFailure:true});receipt.cleanup.push({name:network,exit:cleanup.code});if(cleanup.code!==0){receipt.result='FALLÓ';process.exitCode=1;}}
  receipt.finishedAt=new Date().toISOString();await save('receipt.json',receipt);console.log('Recibo: '+resolve(evidence,'receipt.json'));
}
