#!/usr/bin/env node
// SDD-0569 · gate pequeño inicial. PREPARADO; ejecutar solo con turno pesado.
// Uso: node scripts/tests/bcv-rates-postgrest.mjs --context-only --evidence <directorio-nuevo-externo>
// PG17.11/PostgREST14.17 propios y SDK/TS reales; JWT sintéticos, solo loopback.
// No .env, Supabase real, BCV remoto, Compose, recursos o credenciales de otro WT.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const SHA = value => createHash('sha256').update(value).digest('hex');
function uuid(label) {
  const hex = createHash('md5').update('0495-synthetic-' + label).digest('hex');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function packageVersion(name) {
  let dir = dirname(realpathSync(require.resolve(name)));
  for (let n = 0; n < 7; n++, dir = dirname(dir)) {
    try { const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')); if (pkg.name === name) return pkg.version; }
    catch { /* Buscar solo ancestros del módulo resuelto, no otros árboles. */ }
  }
  throw new Error('DEPENDENCY_METADATA_UNAVAILABLE');
}
const delay = ms => new Promise(done => setTimeout(done, ms));

async function main() {
  assert.equal(realpathSync(process.cwd()).toLowerCase(), realpathSync(ROOT).toLowerCase(), 'ejecutar desde raíz propia');
  const args = process.argv.slice(2);
  assert(args.includes('--context-only'), 'esta fase exige --context-only; cobertura ampliada todavía pendiente');
  const at = args.indexOf('--evidence');
  assert(at >= 0 && args[at+1] && !args[at+1].startsWith('--'), 'falta directorio externo nuevo de evidencia');
  assert(args.length === 3, 'opciones desconocidas');
  const evidence = resolve(args[at+1]);
  const rel = relative(ROOT, evidence);
  assert(rel.startsWith('..') || isAbsolute(rel), 'evidencia fuera del worktree');
  await mkdir(evidence, { recursive: false });
  const nonce = randomBytes(6).toString('hex');
  const network = 'dtd-bcv-' + nonce, pg = network + '-pg', rest = network + '-rest';
  const password = randomBytes(24).toString('hex'), secret = randomBytes(32).toString('hex');
  const receipt = { startedAt: new Date().toISOString(), pid: process.pid, root: ROOT, phase: 'PREPARACION',
    result: 'RUNNING', resources: { network, pg, rest }, versions: {}, checks: [], http: [], cleanup: [] };
  const created = []; let networkCreated = false;
  const save = (name, value) => writeFile(resolve(evidence, name), typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n');
  const check = (name, detail = {}) => { receipt.checks.push({ name, ...detail }); process.stdout.write('PASÓ: ' + name + '\n'); };
  const run = (step, argv, { input = '', timeout = 30_000, allowFailure = false } = {}) => new Promise((done, fail) => {
    const child = spawn('docker', argv, { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 4_194_304) child.kill(); });
    child.stderr.on('data', data => { stderr += data; if (stderr.length > 4_194_304) child.kill(); });
    child.on('error', () => { clearTimeout(timer); fail(new Error(step + ': DOCKER_UNAVAILABLE')); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const result = { code, signal, timedOut, stdout, stderr };
      if (!allowFailure && (code !== 0 || signal || timedOut)) fail(Object.assign(new Error(step + ': PREPARATION_FAILED'), { safeStep: step, result }));
      else done(result);
    });
    child.stdin.end(input);
  });
  const psql = sql => run('psql', ['exec','-i',pg,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'], { input: sql });
  const scalar = async sql => (await psql(sql)).stdout.trim();
  const eventually = async fn => {
    const until = Date.now() + 30_000;
    do { try { if (await fn()) return; } catch { /* Solo readiness local, no retry de operación de negocio. */ } await delay(250); } while (Date.now() < until);
    throw new Error('LOCAL_READINESS_TIMEOUT');
  };
  const token = (role, sub, includeSub = sub !== undefined) => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = { role, exp: Math.floor(Date.now()/1000)+600, ...(includeSub ? { sub } : {}) };
    const value = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode(claims);
    return value + '.' + createHmac('sha256',secret).update(value).digest('base64url');
  };
  try {
    receipt.versions.sdk = packageVersion('@supabase/supabase-js'); assert.equal(receipt.versions.sdk, '2.106.1');
    receipt.sourceHashes = Object.fromEntries(['supabase/migrations/0495_fx_rates_conversor_usd.sql',
      'supabase/migrations/0501_bcv_rates_system_audit.sql','supabase/tests/bcv_rates_system_audit.test.sql',
      'lib/studio/fx/bcv-sync.ts'].map(name => [name, SHA(readFileSync(resolve(ROOT,name)))]));
    const { createBcvServiceClient } = await tsImport(pathToFileURL(resolve(ROOT,'lib/studio/fx/bcv-sync.ts')).href, import.meta.url);
    check('SDK2.106.1 e import TS real preparados');
    await run('network-create',['network','create','--label','dtd.task=0569-bcv-carga-diaria',network]); networkCreated = true;
    await run('postgres-start',['run','-d','--name',pg,'--label','dtd.task=0569-bcv-carga-diaria','--label','dtd.owner='+nonce,
      '--network',network,'--network-alias','db','-e','POSTGRES_PASSWORD='+password,
      '-v',resolve(ROOT,'supabase')+':/sb:ro','postgres:17.11'], { timeout: 300_000 }); created.push(pg);
    await eventually(async () => (await run('postgres-ready',['exec',pg,'pg_isready','-U','postgres'], { allowFailure: true })).code === 0);
    receipt.versions.postgres = await scalar("select current_setting('server_version');");
    assert.match(receipt.versions.postgres,/^17\.11(?:\s|$)/);
    receipt.resources.pgImage = (await run('postgres-image',['inspect','--format','{{.Image}}',pg])).stdout.trim();
    await psql('create extension if not exists pgcrypto;');
    const setup = await run('fixture-commit',['exec',pg,'psql','-X','-v','ON_ERROR_STOP=1','-v','fixture_only=true',
      '-v','apply_fix=false','-U','postgres','-d','postgres','-f','/sb/tests/bcv_rates_system_audit.test.sql']);
    await save('fixture-commit.log',setup.stdout+setup.stderr);
    assert.match(setup.stdout,/COMMIT/);
    await psql("alter role authenticator login password '"+password+"';");
    await psql('begin;\n'+readFileSync(resolve(ROOT,'supabase/migrations/0501_bcv_rates_system_audit.sql'),'utf8')+'\ncommit;');
    await run('rest-start',['run','-d','--name',rest,'--label','dtd.task=0569-bcv-carga-diaria','--label','dtd.owner='+nonce,
      '--network',network,'-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgres://authenticator:'+password+'@db:5432/postgres',
      '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_PRE_REQUEST=bcv_fixture.http_context',
      '-e','PGRST_JWT_SECRET='+secret,'postgrest/postgrest:v14.17'],{ timeout:300_000 }); created.push(rest);
    receipt.versions.postgrest = (await run('rest-version',['exec',rest,'/bin/postgrest','--version'])).stdout.trim();
    assert.match(receipt.versions.postgrest,/\b14\.17\b/);
    receipt.resources.restImage = (await run('rest-image',['inspect','--format','{{.Image}}',rest])).stdout.trim();
    const port = (await run('rest-port',['port',rest,'3000/tcp'])).stdout.trim();
    assert.match(port,/^127\.0\.0\.1:[0-9]+$/); const base = 'http://' + port;
    receipt.resources.base = base;
    await eventually(async () => {
      const response=await fetch(base,{signal:AbortSignal.timeout(2000)});
      const ready=response.status===200; await response.body?.cancel(); return ready;
    });
    check('versiones efectivas PG17.11/PostgREST14.17 y setup COMMIT');
    receipt.phase = 'HTTP_CONTEXT';
    const client = (role, sub, extraHeaders = {}) => createBcvServiceClient({ url: base, serviceKey: token(role,sub),
      signal: AbortSignal.timeout(50_000), fetch: (input,init) => {
        const url = new URL(typeof input==='string' ? input : input instanceof URL ? input.href : input.url);
        assert.equal(url.origin,base,'solo destino loopback creado');
        receipt.http.push({ method:init?.method??'GET',path:url.pathname });
        return fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),...extraHeaders}});
      } });
    const cap = async c => c.rpc('bcv_rates_write_capability',{}, {get:true}).retry(false).abortSignal(AbortSignal.timeout(5000));
    const service = client('service_role');
    const ready = await cap(service); assert.equal(ready.status,200); assert.deepEqual(ready.data,{version:1,ready:true});
    assert.equal(receipt.http.at(-1).method,'GET');
    for (const sub of [null,'','not-a-uuid',uuid('accounting-A')]) {
      const reply = await cap(client('service_role',sub)); assert.notEqual(reply.data?.ready,true);
    }
    for (const role of ['anon','authenticated']) {
      const reply = await cap(client(role,role==='authenticated'?uuid('accounting-A'):undefined));
      assert(reply.status>=400); assert.notEqual(reply.data?.ready,true);
    }
    const forged = await cap(client('authenticated',uuid('accounting-A'), {'x-bcv-fixture-claims':'{"role":"service_role"}'}));
    assert(forged.status>=400); assert.notEqual(forged.data?.ready,true);
    const ambiguous = await cap(client('service_role',undefined,{'x-bcv-fixture-claims':'[]'}));
    assert.notEqual(ambiguous.data?.ready,true);
    check('GET capability service-only; sub/claims ambiguos y rol falso no habilitan');

    const columns = 'id,tenant_id,currency,source,valid_on,rate::text,set_at,set_by';
    const insert = await service.from('fx_rates').insert({tenant_id:uuid('tenant-A'),currency:'VES',source:'bcv',
      valid_on:'2026-10-21',rate:'883.39630000',set_by:null,set_at:'2026-10-21T07:00:00.123456Z',note:'fixture mínima BCV'})
      .select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(insert.status,201); assert.equal(insert.error,null); assert.equal(insert.data.length,1);
    assert.equal(insert.data[0].rate,'883.39630000'); assert.match(insert.data[0].set_at,/\.123456/);
    const context = JSON.parse(await scalar('select row_to_json(c) from bcv_fixture.context_log c limit 1;'));
    assert.equal(context.native_role,'service_role'); assert.equal(context.effective_user,'postgres');
    assert.equal(context.login_user,'authenticator'); assert.equal(context.actor_id,null); assert(!('sub' in context.claims));
    await save('context-inside-definer.json',context);
    const audit = JSON.parse(await scalar("select row_to_json(a) from (select actor_type,actor_id,source,event_type,reason,before_data,after_data,payload from entity_audit_log where entity_type='exchange_rate' order by occurred_at limit 1) a;"));
    assert.equal(audit.actor_type,'system'); assert.equal(audit.actor_id,null); assert.equal(audit.source,'job');
    assert.match(audit.reason,/^Carga automática del catálogo BCV:/); assert.equal(audit.before_data,null);
    assert.deepEqual(Object.keys(audit.after_data).sort(),['currency','rate','source','valid_on']);
    assert(!JSON.stringify(audit).includes('fixture mínima')); await save('audit-system-job.json',audit);
    check('trigger definer real: rol/claims/login observados y auditoría SYSTEM/job con motivo');

    const old = insert.data[0];
    const patch = await service.from('fx_rates').update({rate:'883.39630001',set_at:'2026-10-21T07:00:00.234567Z'})
      .eq('id',old.id).eq('tenant_id',old.tenant_id).eq('currency','VES').eq('source','bcv')
      .eq('valid_on','2026-10-21').eq('rate',old.rate).eq('set_at',old.set_at).select(columns)
      .retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(patch.status,200); assert.equal(patch.error,null); assert.equal(patch.data.length,1);
    assert.equal(patch.data[0].rate,'883.39630001'); assert.match(patch.data[0].set_at,/\.234567/);
    check('JSON string/rate::text/CAS y microsegundos reales');

    const humanDay = await scalar("select (now() at time zone 'America/Caracas')::date::text;");
    const human = await client('authenticated',uuid('accounting-A')).rpc('registrar_tasa_de_cambio',{
      p_currency:'VES',p_rate:'880.12345678',p_valid_on:humanDay,p_note:'control humano sintético',
    }).retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(human.status,200); assert.equal(human.error,null);
    const actor = await scalar("select actor_id::text from entity_audit_log where source='rpc' and actor_type='user' order by occurred_at desc limit 1;");
    assert.equal(actor,uuid('accounting-A')); check('humano positivo: auth.uid real, manual/rpc conserva actor');
    receipt.result = 'PASÓ';
    receipt.scope = 'gate pequeño de contexto/GET/precisión; B1–B19/R1–R14 completos todavía pendientes';
  } catch (error) {
    receipt.result='FALLÓ'; receipt.failure={phase:receipt.phase, code:error.safeStep??error.code??error.name??'ERROR'};
    // Sin argv/env/JWT/SQL/body externo. Logs de setup sintético se conservan aparte.
    process.stderr.write('FALLÓ: '+receipt.phase+'; revisar recibo externo\n'); process.exitCode=1;
  } finally {
    for (const name of created.reverse()) {
      try {
        const result=await run('cleanup-container',['rm','-f',name],{allowFailure:true});
        receipt.cleanup.push({kind:'container',name,exit:result.code});
      } catch { receipt.cleanup.push({kind:'container',name,exit:null}); }
    }
    if (networkCreated) {
      try {
        const result=await run('cleanup-network',['network','rm',network],{allowFailure:true});
        receipt.cleanup.push({kind:'network',name:network,exit:result.code});
      } catch { receipt.cleanup.push({kind:'network',name:network,exit:null}); }
    }
    if (receipt.cleanup.some(item=>item.exit!==0)) {
      receipt.result='FALLÓ'; receipt.cleanupPending=true; process.exitCode=1;
    }
    receipt.finishedAt=new Date().toISOString(); await save('receipt.json',receipt);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) await main();
