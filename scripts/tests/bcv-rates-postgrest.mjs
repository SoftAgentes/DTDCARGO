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
import { createServer } from 'node:http';
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
    result: 'RUNNING', resources: { network, pg, rest }, versions: {}, checks: [], commands: [], http: [], gatewayHttp: [], cleanup: [] };
  const attempted = []; let networkAttempted = false;
  let gateway;
  const gatewaySockets = new Set(), gatewayTasks = new Set(), gatewayRequests = new Set();
  const save = (name, value) => writeFile(resolve(evidence, name), typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n');
  const check = (name, detail = {}) => { receipt.checks.push({ name, ...detail }); process.stdout.write('PASÓ: ' + name + '\n'); };
  const run = (step, argv, { input = '', timeout = 30_000, allowFailure = false } = {}) => new Promise((done, fail) => {
    const child = spawn('docker', argv, { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    const execution={number:receipt.commands.length+1,step,pid:child.pid??null,startedAt:new Date().toISOString()};
    receipt.commands.push(execution);
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 4_194_304) child.kill(); });
    child.stderr.on('data', data => { stderr += data; if (stderr.length > 4_194_304) child.kill(); });
    child.on('error', () => { clearTimeout(timer); fail(new Error(step + ': DOCKER_UNAVAILABLE')); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const result = { code, signal, timedOut, stdout, stderr };
      Object.assign(execution,{code,signal,timedOut,finishedAt:new Date().toISOString()});
      if (!allowFailure && (code !== 0 || signal || timedOut)) {
        const error=Object.assign(new Error(step + ': PREPARATION_FAILED'),{safeStep:step,result});
        // Solo stdout/stderr de recursos sintéticos; nunca argv/env/JWT. Redactar
        // credenciales efímeras por si el motor las incluye en un error de setup.
        const diagnostic=(stdout+stderr).replaceAll(password,'[fixture-password]').replaceAll(secret,'[fixture-secret]');
        save('command-'+execution.number+'-'+step+'-failure.log',diagnostic).then(()=>fail(error),()=>fail(error));
      } else done(result);
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
    networkAttempted = true;
    await run('network-create',['network','create','--label','dtd.task=0569-bcv-carga-diaria','--label','dtd.owner='+nonce,network]);
    attempted.push(pg);
    await run('postgres-start',['run','-d','--name',pg,'--label','dtd.task=0569-bcv-carga-diaria','--label','dtd.owner='+nonce,
      '--network',network,'--network-alias','db','-e','POSTGRES_PASSWORD='+password,
      '-v',resolve(ROOT,'supabase')+':/sb:ro','postgres:17.11'], { timeout: 300_000 });
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
    attempted.push(rest);
    await run('rest-start',['run','-d','--name',rest,'--label','dtd.task=0569-bcv-carga-diaria','--label','dtd.owner='+nonce,
      '--network',network,'-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgres://authenticator:'+password+'@db:5432/postgres',
      '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_PRE_REQUEST=bcv_fixture.http_context',
      '-e','PGRST_JWT_SECRET='+secret,'postgrest/postgrest:v14.17'],{ timeout:300_000 });
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
    // SupabaseSDK agrega /rest/v1. El servicio PostgREST local expone /rpc y
    // tablas en raíz: este gateway propio monta el prefijo, sin parchear SDK/app.
    gateway=createServer((req,res) => {
      const operation=(async () => {
        const path=new URL(req.url,'http://127.0.0.1');
        if (!path.pathname.startsWith('/rest/v1/')) { res.writeHead(404); res.end(); return; }
        const upstream=new URL(base); upstream.pathname=path.pathname.slice('/rest/v1'.length); upstream.search=path.search;
        assert.equal(upstream.origin,base);
        const controller=new AbortController(); gatewayRequests.add(controller);
        req.once('aborted',()=>controller.abort());
        res.once('close',()=>{ if (!res.writableEnded) controller.abort(); });
        try {
          const chunks=[]; let size=0;
          for await (const chunk of req) {
            size+=chunk.byteLength; if (size>1_048_576) throw new Error('FIXTURE_REQUEST_LIMIT'); chunks.push(chunk);
          }
          const headers=new Headers();
          for (const name of ['authorization','apikey','content-type','accept','accept-profile','content-profile','prefer','range','range-unit','x-bcv-fixture-claims']) {
            const value=req.headers[name]; if (typeof value==='string') headers.set(name,value);
          }
          const method=req.method??'GET';
          const response=await fetch(upstream,{method,headers,redirect:'manual',
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10_000)]),
            ...(method==='GET'||method==='HEAD'?{}:{body:Buffer.concat(chunks)})});
          const body=new Uint8Array(await response.arrayBuffer());
          if (body.byteLength>1_048_576) throw new Error('FIXTURE_RESPONSE_LIMIT');
          for (const name of ['content-type','content-range','preference-applied']) {
            const value=response.headers.get(name); if (value!==null) res.setHeader(name,value);
          }
          receipt.gatewayHttp.push({method,path:path.pathname,mappedPath:upstream.pathname,status:response.status,
            requestedCountExact:headers.get('prefer')?.split(',').some(value=>value.trim()==='count=exact')??false,
            contentRange:response.headers.get('content-range')});
          res.writeHead(response.status); res.end(body);
        } finally { gatewayRequests.delete(controller); }
      })().catch(() => { if (!res.destroyed) { if (!res.headersSent) res.writeHead(502); res.end(); } });
      gatewayTasks.add(operation); operation.finally(()=>gatewayTasks.delete(operation));
    });
    gateway.on('connection',socket=>{ gatewaySockets.add(socket); socket.once('close',()=>gatewaySockets.delete(socket)); });
    gateway.requestTimeout=10_000; gateway.headersTimeout=5_000;
    await new Promise((done,fail)=>{ gateway.once('error',fail); gateway.listen(0,'127.0.0.1',done); });
    const address=gateway.address(); assert(address && typeof address==='object' && address.address==='127.0.0.1');
    const supabaseBase='http://127.0.0.1:'+address.port;
    receipt.resources.gateway={owner:nonce,pid:process.pid,host:address.address,port:address.port,base:supabaseBase,
      mount:'/rest/v1',upstream:base};
    check('versiones efectivas PG17.11/PostgREST14.17 y setup COMMIT');
    receipt.phase = 'HTTP_CONTEXT';
    const client = (role, sub, extraHeaders = {}) => createBcvServiceClient({ url: supabaseBase, serviceKey: token(role,sub),
      signal: AbortSignal.timeout(50_000), fetch: (input,init) => {
        const url = new URL(typeof input==='string' ? input : input instanceof URL ? input.href : input.url);
        assert.equal(url.origin,supabaseBase,'solo gateway loopback propio');
        assert(url.pathname.startsWith('/rest/v1/'),'prefijo SDK nativo esperado');
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

    // GET readiness y trigger son guards distintos: cada negativo intenta INSERT
    // y PATCH por HTTP y después mide la misma DB, sin deducir rollback del status.
    const outcome = async id => JSON.parse(await scalar(`select jsonb_build_object(
      'rows',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'tenant_id',f.tenant_id,
        'currency',f.currency,'valid_on',f.valid_on,'source',f.source,'rate',f.rate::text,
        'set_at',f.set_at::text,'set_by',f.set_by) order by f.id) from public.fx_rates f where f.id='${id}'::uuid),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'actor_type',a.actor_type,
        'actor_id',a.actor_id,'source',a.source,'event_type',a.event_type,'reason',a.reason) order by a.id)
        from public.entity_audit_log a where a.entity_type='exchange_rate' and a.entity_id='${id}'::uuid),'[]'::jsonb),
      'contexts',coalesce((select jsonb_agg(to_jsonb(c) order by c.operation,c.native_role,c.effective_user)
        from bcv_fixture.context_log c where c.entity_id='${id}'::uuid),'[]'::jsonb));`));
    const negatives = [
      {label:'sub-null',role:'service_role',sub:null},
      {label:'sub-empty',role:'service_role',sub:''},
      {label:'sub-malformed',role:'service_role',sub:'not-a-uuid'},
      {label:'sub-human-legacy',role:'service_role',sub:uuid('accounting-A'),legacy:true},
      {label:'anon',role:'anon'},
      {label:'authenticated',role:'authenticated',sub:uuid('accounting-A')},
      {label:'claim-service-without-native-role',role:'authenticated',sub:uuid('accounting-A'),claims:'{"role":"service_role"}'},
      {label:'claims-missing',role:'service_role',claims:''},
      {label:'claims-empty-object',role:'service_role',claims:'{}'},
      {label:'claims-array',role:'service_role',claims:'[]'},
      {label:'claims-null',role:'service_role',claims:'null'},
      {label:'claims-malformed',role:'service_role',claims:'{'},
      {label:'claim-role-incoherent',role:'service_role',claims:'{"role":"authenticated"}'},
    ];
    receipt.dmlNegatives=[];
    for (const [index,negative] of negatives.entries()) {
      const c=client(negative.role,negative.sub,negative.claims===undefined?{}:{'x-bcv-fixture-claims':negative.claims});
      const readiness=await cap(c); assert.notEqual(readiness.data?.ready,true,negative.label+' capability');
      for (const method of ['INSERT','PATCH']) {
        const id=method==='INSERT'?uuid('negative-'+negative.label):old.id;
        const before=await outcome(id);
        if (method==='INSERT') assert.deepEqual(before,{rows:[],events:[],contexts:[]});
        const rate='884.'+String(index+1).padStart(8,'0');
        const body=method==='INSERT'?{id,tenant_id:uuid('tenant-A'),currency:'VES',source:'bcv',
          valid_on:'2026-11-'+String(index+1).padStart(2,'0'),rate,set_by:null,
          set_at:'2026-10-21T07:00:00.345678Z'}:{rate,set_at:'2026-10-21T07:00:00.456789Z'};
        const query=method==='INSERT'?c.from('fx_rates').insert(body):c.from('fx_rates').update(body).eq('id',id);
        const reply=await query.select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
        const after=await outcome(id);
        const beforeJobs=before.events.filter(event=>event.source==='job').length;
        assert.equal(after.events.filter(event=>event.source==='job').length,beforeJobs,negative.label+' nunca job');
        if (negative.legacy && reply.status>=200 && reply.status<300) {
          assert.equal(reply.error,null); assert.equal(reply.data.length,1);
          assert.equal(after.rows.length,1); assert.equal(after.rows[0].rate,rate);
          const added=after.events.filter(event=>!before.events.some(prior=>prior.id===event.id));
          assert.equal(added.length,1); assert.equal(added[0].actor_type,'user');
          assert.equal(added[0].actor_id,uuid('accounting-A')); assert.equal(added[0].source,'rpc');
          assert.equal(after.contexts.length,before.contexts.length+1);
        } else {
          assert(reply.status>=400,negative.label+' '+method+' rechazada');
          assert.deepEqual(after,before,negative.label+' '+method+' sin efecto/evento/contexto confirmado');
        }
        receipt.dmlNegatives.push({label:negative.label,method,status:reply.status,
          errorCode:reply.error?.code??null,legacyAllowed:Boolean(negative.legacy),
          before,after});
      }
    }
    await save('negative-dml-effects.json',receipt.dmlNegatives);
    check('negativos HTTP INSERT/PATCH: efectos/eventos medidos; humano legado user/rpc o rechazo, nunca job');
    // Preparación posterior al gate aceptado: obtener muestras nativas para S01.
    // No se considera ejecutado hasta su nuevo recibo bajo turno autorizado.
    const nativeEmpty=await service.from('fx_rates').select(columns,{count:'exact'})
      .eq('tenant_id',uuid('tenant-B')).retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(nativeEmpty.status,200); assert.equal(nativeEmpty.error,null);
    assert.equal(nativeEmpty.count,0); assert.deepEqual(nativeEmpty.data,[]);
    const emptyHeader=receipt.gatewayHttp.at(-1);
    assert.equal(emptyHeader.requestedCountExact,true); assert.equal(typeof emptyHeader.contentRange,'string');
    const total=Number(await scalar('select count(*) from public.fx_rates;'));
    assert(total>1);
    const nativePage=await service.from('fx_rates').select(columns,{count:'exact'}).range(0,0)
      .retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(nativePage.error,null); assert.equal(nativePage.count,total); assert.equal(nativePage.data.length,1);
    const pageHeader=receipt.gatewayHttp.at(-1);
    assert.equal(pageHeader.requestedCountExact,true); assert.equal(typeof pageHeader.contentRange,'string');
    await save('native-content-range-samples.json',{empty:emptyHeader,page:pageHeader,total});
    check('S01 positivo nativo: ausencia y página conservan count y Content-Range originales');
    receipt.result = 'PASÓ';
    receipt.scope = 'gate pequeño de contexto/GET/precisión; B1–B19/R1–R14 completos todavía pendientes';
  } catch (error) {
    receipt.result='FALLÓ'; receipt.failure={phase:receipt.phase, code:error.safeStep??error.code??error.name??'ERROR'};
    // Sin argv/env/JWT/SQL/body externo. Logs de setup sintético se conservan aparte.
    process.stderr.write('FALLÓ: '+receipt.phase+'; revisar recibo externo\n'); process.exitCode=1;
  } finally {
    if (gateway) {
      try {
        const closed=new Promise(done=>gateway.close(done));
        // destroy() solicita cierre; close se emite después. Esperar cada evento
        // propio antes de exigir Set vacío, además del callback del servidor.
        const socketsClosed=[...gatewaySockets].map(socket=>new Promise(done=>socket.once('close',done)));
        for (const request of gatewayRequests) request.abort();
        gateway.closeIdleConnections(); gateway.closeAllConnections();
        for (const socket of gatewaySockets) socket.destroy();
        await Promise.allSettled([...gatewayTasks]); await Promise.all([closed,...socketsClosed]);
        receipt.cleanup.push({kind:'gateway',owner:nonce,pid:process.pid,port:receipt.resources.gateway?.port,
          exit:gateway.listening||gatewaySockets.size||gatewayTasks.size?null:0,
          listening:gateway.listening,sockets:gatewaySockets.size,pending:gatewayTasks.size});
      } catch { receipt.cleanup.push({kind:'gateway',owner:nonce,exit:null}); }
    }
    for (const name of attempted.reverse()) {
      try {
        const inspected=await run('cleanup-inspect',['inspect','--format','{{.Id}} {{ index .Config.Labels "dtd.owner" }}',name],{allowFailure:true});
        if (inspected.code!==0) {
          const absent=/No such (?:object|container)/i.test(inspected.stderr);
          receipt.cleanup.push({kind:'container',name,exit:absent?0:null,absent}); continue;
        }
        const identity=/^([0-9a-f]{64}) ([0-9a-f]{12})$/.exec(inspected.stdout.trim());
        if (!identity || identity[2]!==nonce) { receipt.cleanup.push({kind:'container',name,exit:null,ownerMismatch:true}); continue; }
        const result=await run('cleanup-container',['rm','-f',identity[1]],{allowFailure:true});
        receipt.cleanup.push({kind:'container',name,id:identity[1],exit:result.code});
      } catch { receipt.cleanup.push({kind:'container',name,exit:null}); }
    }
    if (networkAttempted) {
      try {
        const inspected=await run('cleanup-network-inspect',['network','inspect','--format','{{.Id}} {{ index .Labels "dtd.owner" }}',network],{allowFailure:true});
        const identity=/^([0-9a-f]{64}) ([0-9a-f]{12})$/.exec(inspected.stdout.trim());
        if (inspected.code===0 && identity?.[2]===nonce) {
          const result=await run('cleanup-network',['network','rm',identity[1]],{allowFailure:true});
          receipt.cleanup.push({kind:'network',name:network,id:identity[1],exit:result.code});
        } else {
          const absent=inspected.code!==0 && /No such network|not found/i.test(inspected.stderr);
          receipt.cleanup.push({kind:'network',name:network,exit:absent?0:null,absent});
        }
      } catch { receipt.cleanup.push({kind:'network',name:network,exit:null}); }
    }
    if (receipt.cleanup.some(item=>item.exit!==0)) {
      receipt.result='FALLÓ'; receipt.cleanupPending=true; process.exitCode=1;
    }
    receipt.finishedAt=new Date().toISOString(); await save('receipt.json',receipt);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) await main();
