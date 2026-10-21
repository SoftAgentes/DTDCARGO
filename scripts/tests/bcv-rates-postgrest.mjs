#!/usr/bin/env node
// SDD-0569 · contexto y aceptación HTTP sintética; ejecutar solo con turno pesado.
// Uso: node scripts/tests/bcv-rates-postgrest.mjs --context-only --evidence <directorio-nuevo-externo>
//      node scripts/tests/bcv-rates-postgrest.mjs --full --evidence <directorio-nuevo-externo>
//      node scripts/tests/bcv-rates-postgrest.mjs --supplemental --evidence <directorio-nuevo-externo>
//      node scripts/tests/bcv-rates-postgrest.mjs --withdrawal-only --evidence <directorio-nuevo-externo>
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
  const full=args.includes('--full'), supplemental=args.includes('--supplemental'), withdrawalOnly=args.includes('--withdrawal-only');
  assert.equal(['--full','--context-only','--supplemental','--withdrawal-only'].filter(mode=>args.includes(mode)).length,1,
    'elegir --context-only, --full, --supplemental o --withdrawal-only');
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
    result: 'RUNNING', mode:withdrawalOnly?'withdrawal-only':supplemental?'supplemental':full?'full':'context-only', resources: { network, pg, rest }, versions: {}, checks: [], commands: [], http: [], gatewayHttp: [], sourceHttp:[], cleanup: [] };
  const attempted = []; let networkAttempted = false;
  let gateway;
  let fixtureFault;
  const fixtureSources=new Map();
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
    const { createBcvServiceClient,syncBcvRates } = await tsImport(pathToFileURL(resolve(ROOT,'lib/studio/fx/bcv-sync.ts')).href, import.meta.url);
    const { fetchBcvObservation } = await tsImport(pathToFileURL(resolve(ROOT,'lib/studio/fx/bcv-source.ts')).href, import.meta.url);
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
    const migration=readFileSync(resolve(ROOT,'supabase/migrations/0501_bcv_rates_system_audit.sql'),'utf8');
    const installation=supplemental?await measureInstall({pg,nonce,run,scalar,psql,migration,receipt,save,check,eventually}):withdrawalOnly?{
      before:JSON.parse(await scalar(INSTALL_CATALOG)),
      oldDefinition:await scalar("select pg_get_functiondef('public.audit_fx_rate_change()'::regprocedure);")}:undefined;
    if (!supplemental) await psql('begin;\n'+migration+'\ncommit;');
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
        const source=fixtureSources.get(path.pathname);
        if (source) {
          assert.equal(req.method,'GET'); assert.equal(req.headers.authorization,undefined); assert.equal(req.headers.cookie,undefined);
          receipt.sourceHttp.push({label:source.label,method:req.method,status:200,bytes:Buffer.byteLength(source.html)});
          res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(source.html); return;
        }
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
          const wire={method,path:path.pathname,query:Object.fromEntries(path.searchParams),
            flow:req.headers['x-bcv-fixture-flow']??null,body:chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):undefined};
          const injected=await fixtureFault?.('before',wire);
          if (injected) {
            receipt.gatewayHttp.push({...wire,body:undefined,status:injected.status,injected:true});
            res.writeHead(injected.status,{'content-type':'application/json',...injected.headers}); res.end(injected.body??''); return;
          }
          const response=await fetch(upstream,{method,headers,redirect:'manual',
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10_000)]),
            ...(method==='GET'||method==='HEAD'?{}:{body:Buffer.concat(chunks)})});
          const body=new Uint8Array(await response.arrayBuffer());
          if (body.byteLength>1_048_576) throw new Error('FIXTURE_RESPONSE_LIMIT');
          for (const name of ['content-type','content-range','preference-applied']) {
            const value=response.headers.get(name); if (value!==null) res.setHeader(name,value);
          }
          const changed=await fixtureFault?.('after',{...wire,status:response.status,bytes:body});
          for (const [name,value] of Object.entries(changed?.headers??{})) {
            if (value===null) res.removeHeader(name); else res.setHeader(name,value);
          }
          receipt.gatewayHttp.push({method,path:path.pathname,mappedPath:upstream.pathname,status:response.status,
            query:wire.query,flow:wire.flow,dropped:Boolean(changed?.drop),
            requestedCountExact:headers.get('prefer')?.split(',').some(value=>value.trim()==='count=exact')??false,
            contentRange:response.headers.get('content-range'),deliveredContentRange:res.getHeader('content-range')??null});
          if (changed?.drop) { res.destroy(); return; }
          res.writeHead(changed?.status??response.status); res.end(changed?.body??body);
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
    const client = (role, sub, extraHeaders = {}, signal=AbortSignal.timeout(50_000)) => createBcvServiceClient({ url: supabaseBase, serviceKey: token(role,sub),
      signal, fetch: (input,init) => {
        const url = new URL(typeof input==='string' ? input : input instanceof URL ? input.href : input.url);
        assert.equal(url.origin,supabaseBase,'solo gateway loopback propio');
        assert(url.pathname.startsWith('/rest/v1/'),'prefijo SDK nativo esperado');
        receipt.http.push({ method:init?.method??'GET',path:url.pathname });
        return fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),...extraHeaders}});
      } });
    const cap = async c => c.rpc('bcv_rates_write_capability',{}, {get:true}).retry(false).abortSignal(AbortSignal.timeout(5000));
    const service = client('service_role');
    if (!supplemental&&!withdrawalOnly) {
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
    if (full) await runFunctional({syncBcvRates,fetchBcvObservation,client,service,scalar,psql,receipt,check,save,
      fixtureSources,supabaseBase,nonce,columns,setFault:value=>{fixtureFault=value;}});
    }
    if (supplemental||withdrawalOnly) await runSupplemental({withdrawalOnly,syncBcvRates,fetchBcvObservation,client,service,scalar,psql,receipt,check,save,
      fixtureSources,supabaseBase,nonce,installation,setFault:value=>{fixtureFault=value;},
      gatewayState:()=>({requests:gatewayRequests.size,tasks:gatewayTasks.size}),eventually});
    receipt.result = 'PASÓ';
    receipt.scope = withdrawalOnly?'R14 retirada SQL aislada con eventos ya comprometidos y app que falla cerrada; no repite B5/B12/locks de instalación':supplemental?'suplemento B5/B12/R14: reloj controlado con COMMIT real, PATCH/append y locks/retirada SQL; sin garantía frente a DDL concurrente':full?'aceptación HTTP sintética del importador, contexto y auditoría; B1–B19/R1–R14 completos todavía pendientes':'gate pequeño de contexto/GET/precisión; B1–B19/R1–R14 completos todavía pendientes';
  } catch (error) {
    receipt.result='FALLÓ'; receipt.failure={phase:receipt.phase, code:error.safeStep??error.code??error.name??'ERROR'};
    const diagnostic=String(error.stack??error).slice(0,16_384).replaceAll(password,'[fixture-password]')
      .replaceAll(secret,'[fixture-secret]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[fixture-jwt]');
    await save('failure-native.log',diagnostic);
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

async function runFunctional({syncBcvRates,fetchBcvObservation,client,service,scalar,psql,receipt,check,save,
  fixtureSources,supabaseBase,nonce,columns,setFault}) {
  const A=uuid('tenant-A'), B=uuid('tenant-B');
  let sequence=0,sourceSequence=0;
  // Noviembre contiene las altas humanas legítimas del bloque de negativos.
  // Diciembre es un namespace de reloj ficticio separado, sin borrar ese legado.
  const nextDay=()=>new Date(Date.UTC(2026,11,++sequence)).toISOString().slice(0,10);
  const sourceTemplate=readFileSync(resolve(ROOT,'lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html'),'utf8');
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayState=async day=>JSON.parse(await scalar(`select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'tenant',f.tenant_id,'currency',f.currency,
      'source',f.source,'rate',f.rate::text,'day',f.valid_on,'set_at',f.set_at::text,'set_by',f.set_by,'note',f.note)
      order by f.id) from public.fx_rates f where f.valid_on='${day}'::date),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'tenant',a.tenant_id,'actor',a.actor_type,
      'source',a.source,'reason',a.reason,'before',a.before_data,'after',a.after_data,
      'afterRateText',a.after_data->>'rate') order by a.id) from public.entity_audit_log a
      where a.entity_type='exchange_rate' and (a.after_data->>'valid_on'='${day}' or a.before_data->>'valid_on'='${day}')),'[]'::jsonb));`));
  const writes=(calls,flow)=>calls.filter(call=>['POST','PATCH'].includes(call.method)&&(!flow||call.flow===flow));
  const seed=async(day,rate='880.00000000',tenant=A)=>{
    const reply=await service.from('fx_rates').insert({tenant_id:tenant,currency:'VES',source:'bcv',valid_on:day,
      rate,set_at:day+'T06:00:00.123456Z',set_by:null,note:'seed sintética HTTP'}).select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(reply.error,null); assert.equal(reply.status,201); assert.equal(reply.data.length,1); return reply.data[0];
  };
  const run=async(label,{day=nextDay(),rate='883.39630000',scope=[A],enabled=true,dryRun=false,beforeSource,afterSource,signal}={})=>{
    receipt.phase='HTTP_FUNCTIONAL/'+label;
    const date=new Date(day+'T12:00:00Z');
    const visible=`${days[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    const path='/__bcv-fixture/'+nonce+'/'+(++sourceSequence);
    const html=sourceTemplate.replace('883,39630000',rate.replace('.',','))
      .replaceAll('2026-10-21T00:00:00-04:00',day+'T00:00:00-04:00').replace('Miércoles, 21 Octubre  2026',visible);
    fixtureSources.set(path,{label,html});
    const from=receipt.gatewayHttp.length,sourceFrom=receipt.sourceHttp.length;
    let factories=0;
    const summary=await syncBcvRates({enabled,dryRun,scope:scope.join(','),signal,
      now:()=>new Date(day+'T07:00:00.123Z'),
      createClient:shared=>{factories++;return client('service_role',undefined,{'x-bcv-fixture-flow':label},shared);},
      obtain:async options=>{
        await beforeSource?.(options.signal);
        const observation=await fetchBcvObservation({...options,fetch:(input,init)=>{
          assert.equal(String(input),'https://www.bcv.org.ve/');
          assert.equal(new Headers(init?.headers).has('authorization'),false);
          return fetch(supabaseBase+path,init);
        }});
        await afterSource?.(); return observation;
      }});
    const counts=summary.counts;
    assert.equal(counts.scope,['inserted','corrected','unchanged','reconciled','conflicts','failed','unknown','notAttempted']
      .reduce((sum,key)=>sum+counts[key],0));
    assert(counts.deferred<=counts.notAttempted);
    assert(!JSON.stringify(summary).includes(A)&&!JSON.stringify(summary).includes(B));
    const evidence={label,summary,factories,http:receipt.gatewayHttp.slice(from),sourceHttp:receipt.sourceHttp.slice(sourceFrom)};
    receipt.functional.push(evidence); return evidence;
  };
  const barrier=()=>{
    let arrivals=0,release;
    const ready=new Promise(done=>{release=done;});
    return {release,arrive:async signal=>{
      if(++arrivals===2) release();
      let abort;
      try {await Promise.race([ready,new Promise(done=>{abort=done;signal.addEventListener('abort',abort,{once:true});})]);}
      finally {signal.removeEventListener('abort',abort);}
      signal.throwIfAborted();
    }};
  };
  receipt.functional=[];

  for(const rate of ['0.00000001','999999999999.99999999']){
    const day=nextDay(); assert.deepEqual(await dayState(day),{rows:[],events:[]});
    const result=await run('precision-'+rate,{day,rate});
    assert.equal(result.summary.counts.inserted,1);
    const state=await dayState(day); assert.equal(state.rows.length,1); assert.equal(state.rows[0].rate,rate);
    assert.equal(state.events.length,1); assert.equal(state.events[0].afterRateText,rate);
    assert.equal(state.events[0].actor,'system'); assert.equal(state.events[0].source,'job');
    result.effects=state;
  }
  check('B13/R5: strings extremos sobreviven fuente/parser/SDK/SQL/auditoría sin Number');

  const correctionDay=nextDay(),old=await seed(correctionDay);
  const corrected=await run('correction-cas',{day:correctionDay});
  assert.equal(corrected.summary.counts.corrected,1);
  const patch=writes(corrected.http,'correction-cas'); assert.equal(patch.length,1); assert.equal(patch[0].method,'PATCH');
  assert.deepEqual(Object.fromEntries(['id','tenant_id','currency','source','valid_on','rate','set_at'].map(key=>[key,patch[0].query[key]])),{
    id:'eq.'+old.id,tenant_id:'eq.'+A,currency:'eq.VES',source:'eq.bcv',valid_on:'eq.'+correctionDay,rate:'eq.'+old.rate,set_at:'eq.'+old.set_at});
  const beforeUnchanged=await dayState(correctionDay);
  const unchanged=await run('unchanged-reread',{day:correctionDay,rate:'883.3963'});
  assert.equal(unchanged.summary.counts.unchanged,1); assert.equal(writes(unchanged.http).length,0);
  assert.equal(unchanged.http.filter(call=>call.path.endsWith('/fx_rates')&&call.method==='GET').length,2);
  assert.deepEqual(await dayState(correctionDay),beforeUnchanged);
  check('B9/B11: CAS de siete predicados y UNCHANGED releído sin churn de nota/token/evento');

  for(const kind of ['insert','cas']){
    const day=nextDay(); assert.deepEqual(await dayState(day),{rows:[],events:[]});
    if(kind==='cas') await seed(day);
    await psql(`begin;
      create function bcv_fixture.pause_write() returns trigger language plpgsql set search_path='' as $$
        begin perform pg_catalog.pg_sleep(1); return new; end; $$;
      create trigger bcv_fixture_pause_write before insert or update on public.fx_rates for each row
        when(new.valid_on='${day}'::date) execute function bcv_fixture.pause_write(); commit;`);
    const gate=barrier(); let results,sessions=[];
    const competing=Promise.all([
      run(kind+'-race-a',{day,rate:kind==='cas'?'883.39630001':'883.39630000',beforeSource:gate.arrive}),
      run(kind+'-race-b',{day,rate:kind==='cas'?'883.39630002':'883.39630000',beforeSource:gate.arrive}),
    ]);
    try {
      const until=Date.now()+5000;
      do {
        sessions=JSON.parse(await scalar(`select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'backend_start',backend_start,
          'transaction_start',xact_start,'state',state,'wait_type',wait_event_type,'wait_event',wait_event)),'[]'::jsonb)
          from pg_stat_activity where usename='authenticator' and state='active' and query ilike '%fx_rates%'
          and (query ilike '%insert into%' or query ilike '%update%');`));
        if(new Set(sessions.map(session=>session.pid)).size>=2) break;
        await delay(25);
      } while(Date.now()<until);
      results=await competing;
    } finally {
      gate.release(); await competing;
      await psql('begin; drop trigger bcv_fixture_pause_write on public.fx_rates; drop function bcv_fixture.pause_write(); commit;');
    }
    assert(new Set(sessions.map(session=>session.pid)).size>=2,'dos sesiones DML observadas para '+kind);
    const sum=key=>results.reduce((value,item)=>value+item.summary.counts[key],0);
    assert.equal(sum(kind==='cas'?'corrected':'inserted'),1);
    assert.equal(sum(kind==='cas'?'conflicts':'reconciled'),1);
    for(const result of results) assert.equal(writes(result.http,result.label).length,1);
    const state=await dayState(day); assert.equal(state.rows.length,1); assert.equal(state.events.length,kind==='cas'?2:1);
    assert(['883.39630000','883.39630001','883.39630002'].includes(state.rows[0].rate));
    await save(kind+'-two-session-race.json',{sessions,results,effects:state});
  }
  check('B11/B13: dos requests/sesiones compiten por INSERT y CAS, un ganador y sin reescritura automática');

  const changedDay=nextDay(),observed=await seed(changedDay,'883.39630000');
  const competitor=client('service_role',undefined,{'x-bcv-fixture-flow':'competitor'});
  const changed=await run('unchanged-interleaved',{day:changedDay,afterSource:async()=>{
    const reply=await competitor.from('fx_rates').update({rate:'884.00000000',set_at:changedDay+'T06:30:00.654321Z'})
      .eq('id',observed.id).select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
    assert.equal(reply.error,null); assert.equal(reply.data.length,1);
  }});
  assert.equal(changed.summary.counts.conflicts,1); assert.equal(writes(changed.http,changed.label).length,0);
  assert.equal((await dayState(changedDay)).rows[0].rate,'884.00000000');
  check('B11: intercalación tras fuente impide UNCHANGED falso; competidor se conserva');

  for(const [label,status,body] of [['404-array',404,'[]'],['404-empty',404,''],['404-object',404,'{"code":"PGRST205"}'],
    ['503-read',503,'unavailable'],['200-truncated',200,'[truncated']]){
    const day=nextDay(),before=await dayState(day);
    setFault((phase,wire)=>phase==='before'&&wire.method==='GET'&&wire.path.endsWith('/fx_rates')
      ?{status,body,headers:{'content-range':'*/0'}}:undefined);
    let result; try {result=await run(label,{day});} finally {setFault(undefined);}
    assert.equal(result.summary.reason,'SNAPSHOT_UNAVAILABLE'); assert.equal(result.sourceHttp.length,0);
    assert.equal(writes(result.http).length,0); assert.deepEqual(await dayState(day),before);
  }
  for(const header of ['*/0basura','*/0.5','*/0/9','no-es-rango/0']){
    const day=nextDay(),before=await dayState(day);
    setFault((phase,wire)=>phase==='after'&&wire.method==='GET'&&wire.path.endsWith('/fx_rates')
      ?{headers:{'content-range':header}}:undefined);
    let result; try {result=await run('range-'+header,{day});} finally {setFault(undefined);}
    assert.equal(result.summary.reason,'SNAPSHOT_UNAVAILABLE'); assert.equal(result.sourceHttp.length,0);
    assert.equal(writes(result.http).length,0); assert.deepEqual(await dayState(day),before);
  }
  check('B8/S01: HTTP404/503/truncado y Content-Range malformado cierran antes de fuente/DML; efectos SQL iguales');

  for(const unknown of [false,true]){
    const day=nextDay(); let committed=false;
    setFault((phase,wire)=>{
      if(phase==='after'&&wire.method==='POST'&&wire.path.endsWith('/fx_rates')) {committed=true;return {drop:true};}
      if(unknown&&committed&&phase==='before'&&wire.method==='GET'&&wire.path.endsWith('/fx_rates'))
        return {status:503,body:'fixture reconciliation unavailable'};
    });
    let result; try {result=await run(unknown?'lost-ack-unknown':'lost-ack-reconciled',{day,scope:unknown?[A,B]:[A]});}
    finally {setFault(undefined);}
    assert.equal(committed,true); assert.equal(writes(result.http,result.label).length,1);
    assert.equal(result.summary.counts.inserted,0);
    assert.equal(result.summary.counts[unknown?'unknown':'reconciled'],1);
    if(unknown){assert.equal(result.summary.reason,'WRITE_UNKNOWN');assert.equal(result.summary.counts.notAttempted,1);assert.equal(result.summary.counts.deferred,1);}
    const state=await dayState(day); assert.equal(state.rows.length,1); assert.equal(state.rows[0].tenant,A); assert.equal(state.events.length,1);
    result.effects=state;
  }
  check('B12/B15: ACK perdido tras COMMIT medido reconcilia o UNKNOWN; nunca segundo write ni rollback supuesto');

  const capDay=nextDay(); let firstCommitted=false;
  setFault((phase,wire)=>{
    if(phase==='after'&&wire.method==='POST') firstCommitted=true;
    if(firstCommitted&&phase==='before'&&wire.path.endsWith('/rpc/bcv_rates_write_capability'))
      return {status:200,body:'{"version":1,"ready":false}'};
  });
  let capCut;try {capCut=await run('capability-between-tenants',{day:capDay,scope:[A,B]});} finally {setFault(undefined);}
  assert.equal(capCut.summary.reason,'SQL_CONTRACT_UNAVAILABLE'); assert.equal(capCut.summary.counts.inserted,1);
  assert.equal(capCut.summary.counts.notAttempted,1); assert.equal(capCut.summary.counts.deferred,1);
  assert.equal(writes(capCut.http).length,1); assert.equal((await dayState(capDay)).rows.length,1);
  check('R13: fallo de capability entre tenants corta pendientes y conserva el confirmado; GET no es lease DDL');

  const dryDay=nextDay(),dryBefore=await dayState(dryDay);
  for(const enabled of [false,true]){
    const result=await run('dry-'+enabled,{day:dryDay,enabled,dryRun:true});
    assert.equal(result.summary.status,'CANDIDATE'); assert.equal(result.sourceHttp.length,1);
    assert(result.http.every(call=>call.method==='GET')); assert.deepEqual(await dayState(dryDay),dryBefore);
  }
  const off=await run('normal-off',{day:dryDay,enabled:false});
  assert.equal(off.summary.status,'DISABLED'); assert.equal(off.factories,0); assert.equal(off.http.length,0);assert.equal(off.sourceHttp.length,0);
  check('B7/B16: ensayo on/off usa GET/fuente sin filas/eventos; OFF normal cero fábrica/IO');

  const failDay=nextDay(),beforeFailure=await dayState(failDay);
  await psql(`begin;
    create function bcv_fixture.reject_job() returns trigger language plpgsql set search_path='' as $$
      begin if new.source='job' then raise exception 'synthetic audit failure' using errcode='23514'; end if; return new; end; $$;
    create trigger bcv_fixture_reject_job before insert on public.entity_audit_log for each row execute function bcv_fixture.reject_job();
    commit;`);
  let rejected;
  try {rejected=await run('audit-rollback',{day:failDay});}
  finally {await psql('begin; drop trigger bcv_fixture_reject_job on public.entity_audit_log; drop function bcv_fixture.reject_job(); commit;');}
  assert.equal(rejected.summary.counts.failed,1); assert.equal(rejected.summary.counts.unknown,0);
  assert.deepEqual(await dayState(failDay),beforeFailure);
  check('R4: fallo real de append/auditoría por HTTP revierte tasa y evento, verificado en la misma DB');

  const today=await scalar("select (now() at time zone 'America/Caracas')::date::text;");
  const human=client('authenticated',uuid('accounting-A'));
  const cny=await human.rpc('registrar_tasa_de_cambio',{p_currency:'CNY',p_rate:'7.12345678',p_valid_on:today,p_note:'fixture CNY manual'})
    .retry(false).abortSignal(AbortSignal.timeout(5000));
  assert.equal(cny.error,null);
  const legacy=await client('service_role',uuid('accounting-A')).from('fx_rates').insert({tenant_id:A,currency:'VES',source:'operacion',
    valid_on:today,rate:'881.12345678',set_by:uuid('accounting-A')}).select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
  assert.equal(legacy.error,null);
  await psql(`begin;
    insert into public.accounts(id,tenant_id,code,name,type) values('${uuid('frozen-account')}','${A}','G-BCV','Cuenta sintética','G');
    insert into public.suppliers(id,tenant_id,supplier_code,name) values('${uuid('frozen-supplier')}','${A}','PRV-BCV','Proveedor sintético');
    insert into public.invoices(tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,fx_rate_source,fx_rate_valid_on,base_amount,total_amount,status)
      values('${A}','F-BCV','DTD-SYNTHETIC','Cliente sintético','VES',36.12345678,'bcv','${today}',100,100,'emitida');
    insert into public.supplier_bills(tenant_id,bill_code,supplier_id,supplier_name,expense_account_id,currency,fx_rate,fx_rate_source,fx_rate_valid_on,total_amount,due_date)
      values('${A}','CXP-BCV','${uuid('frozen-supplier')}','Proveedor sintético','${uuid('frozen-account')}','CNY',7.12345678,'manual','${today}',100,'${today}'::date+30);
    commit;`);
  const protectedState=async()=>scalar(`select jsonb_build_object(
    'manual_operacion_cny',(select jsonb_agg(to_jsonb(f) order by f.id) from public.fx_rates f where f.source<>'bcv' or f.currency<>'VES'),
    'invoices',(select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i),
    'bills',(select jsonb_agg(to_jsonb(b) order by b.id) from public.supplier_bills b))::text;`);
  const protectedBefore=await protectedState();
  const isolationDay=nextDay(); const foreign=await seed(isolationDay,'900.12345678',B);
  const foreignBefore=await scalar(`select to_jsonb(f)::text from public.fx_rates f where id='${foreign.id}';`);
  const isolated=await run('isolation-frozen',{day:isolationDay,scope:[A]});
  assert.equal(isolated.summary.counts.inserted,1);
  assert.equal(await scalar(`select to_jsonb(f)::text from public.fx_rates f where id='${foreign.id}';`),foreignBefore);
  await run('correct-today-only-bcv',{day:today,scope:[A],rate:'885.12345678'});
  assert.equal(await protectedState(),protectedBefore);
  const foreignRead=await human.from('fx_rates').select(columns,{count:'exact'}).eq('tenant_id',B).retry(false).abortSignal(AbortSignal.timeout(5000));
  assert.equal(foreignRead.error,null); assert.deepEqual(foreignRead.data,[]); assert.equal(foreignRead.count,0);
  const chosen=await human.rpc('fx_rate_on',{p_tenant_id:A,p_currency:'VES',p_on:today}).retry(false).abortSignal(AbortSignal.timeout(5000));
  assert.equal(chosen.error,null); assert.equal((Array.isArray(chosen.data)?chosen.data[0]:chosen.data).source,'bcv');
  await save('isolation-frozen.json',{protectedBefore,protectedAfter:await protectedState(),foreignBefore,
    foreignAfter:await scalar(`select to_jsonb(f)::text from public.fx_rates f where id='${foreign.id}';`),foreignReadCount:foreignRead.count});
  check('B14/R14: tenant ajeno, manual/operacion/CNY y factura/CxP congeladas intactos; humano no lee tenant B');
  await save('functional-http.json',receipt.functional);
}

// Catálogo completo de los objetos protegidos; no basta comparar solo prosrc.
const INSTALL_CATALOG=`select jsonb_build_object(
  'audit',(select to_jsonb(p) from pg_proc p where p.oid=to_regprocedure('public.audit_fx_rate_change()')),
  'append',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p where p.oid in (
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure,
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure)),
  'table',(select to_jsonb(c) from pg_class c where c.oid='public.fx_rates'::regclass),
  'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t where t.tgrelid='public.fx_rates'::regclass),
  'capability',to_regprocedure('public.bcv_rates_write_capability()')::text);`;

const lockSnapshot=name=>`select coalesce(jsonb_agg(jsonb_build_object(
  'pid',a.pid,'backend_start',a.backend_start,'xact_start',a.xact_start,'state',a.state,
  'application_name',a.application_name,'wait_type',a.wait_event_type,'wait_event',a.wait_event,
  'blocking_pids',pg_blocking_pids(a.pid),'locks',(select jsonb_agg(jsonb_build_object(
    'locktype',l.locktype,'mode',l.mode,'granted',l.granted,'relation',c.relname,
    'relation_oid',l.relation,'classid',l.classid,'objid',l.objid,'objsubid',l.objsubid,
    'page',l.page,'tuple',l.tuple,'transactionid',l.transactionid,'virtualxid',l.virtualxid)
    order by l.locktype,l.relation,l.classid,l.objid,l.mode,l.granted) from pg_locks l
    left join pg_class c on c.oid=l.relation where l.pid=a.pid))) ,'[]'::jsonb)
  from pg_stat_activity a where a.application_name='${name}';`;

async function observeDdl({name,sql,psql,scalar,eventually}) {
  const startedAt=new Date().toISOString(), start=performance.now();
  const executing=psql(`begin; set local application_name='${name}';\n${sql}\nselect pg_sleep(3); commit;`);
  // Registrar un handler inmediatamente y esperar siempre la conexión, incluso
  // si la observación de locks falla. No dejar el productor SQL sin observar.
  const settled=executing.then(value=>({value}),error=>({error}));
  let observed;
  try {
    await eventually(async()=>{
      observed=JSON.parse(await scalar(lockSnapshot(name)));
      return observed.length===1 && observed[0].wait_event==='PgSleep';
    });
    assert(observed[0].locks.some(lock=>lock.granted),'locks nativos de transacción DDL observados');
  } finally { await settled; }
  const result=await settled; if (result.error) throw result.error;
  assert.match(result.value.stdout,/COMMIT/);
  assert.deepEqual(JSON.parse(await scalar(lockSnapshot(name))),[],'backend propio DDL terminó');
  return {startedAt,finishedAt:new Date().toISOString(),durationMs:performance.now()-start,
    observed,stdout:result.value.stdout,stderr:result.value.stderr};
}

async function measureInstall({pg,nonce,run,scalar,psql,migration,receipt,save,check,eventually}) {
  receipt.phase='R14_INSTALL_LOCKS';
  const before=JSON.parse(await scalar(INSTALL_CATALOG)); assert.equal(before.capability,null);
  const oldDefinition=await scalar("select pg_get_functiondef('public.audit_fx_rate_change()'::regprocedure);");
  const holder='bcv-'+nonce+'-hold', installer='bcv-'+nonce+'-timeout';
  const held=psql(`begin; set local application_name='${holder}';
    alter function public.audit_fx_rate_change() security invoker; select pg_sleep(10); rollback;`)
    .then(value=>({value}),error=>({error}));
  let timed,holderLocks,installerLocks;
  try {
    await eventually(async()=>{
      holderLocks=JSON.parse(await scalar(lockSnapshot(holder)));
      return holderLocks.length===1 && holderLocks[0].wait_event==='PgSleep';
    });
    // El lector ve la preimagen0495 comprometida; el cambio sintético de otra
    // sesión sigue sin commit y bloqueará CREATE OR REPLACE sobre la misma fila.
    const startedAt=new Date().toISOString(),start=performance.now();
    timed=run('expected-install-lock-timeout',['exec','-i',pg,'psql','-X','-v','ON_ERROR_STOP=0',
      '-v','VERBOSITY=verbose','-U','postgres','-d','postgres','-At'],
    {input:`begin; set local application_name='${installer}';\n${migration}\nrollback;`})
      .then(value=>({value,startedAt,finishedAt:new Date().toISOString(),durationMs:performance.now()-start}),error=>({error}));
    await eventually(async()=>{
      installerLocks=JSON.parse(await scalar(lockSnapshot(installer)));
      return installerLocks.length===1 && installerLocks[0].blocking_pids.includes(holderLocks[0].pid);
    });
    assert(installerLocks[0].locks.some(lock=>!lock.granted),'espera real, no solo timeout configurado');
  } finally { await Promise.all([held,...(timed?[timed]:[])]); }
  const holderResult=await held,timeoutResult=await timed;
  if(holderResult.error) throw holderResult.error;
  if(timeoutResult.error) throw timeoutResult.error;
  assert.match(holderResult.value.stdout,/ROLLBACK/);
  assert.match(timeoutResult.value.stderr,/55P03/,'SQLSTATE lock_timeout real');
  assert.match(timeoutResult.value.stdout,/ROLLBACK/,'rollback explícito después del error');
  assert.deepEqual(JSON.parse(await scalar(lockSnapshot(holder))),[]);
  assert.deepEqual(JSON.parse(await scalar(lockSnapshot(installer))),[]);
  const afterTimeout=JSON.parse(await scalar(INSTALL_CATALOG)); assert.deepEqual(afterTimeout,before);
  await save('r14-install-timeout.json',{before,afterTimeout,holderLocks,installerLocks,
    holderResult:holderResult.value,timeoutResult,limit:'psql esperado exit0 con ON_ERROR_STOP=0: se exige error55P03 y ROLLBACK, no se interpreta exit0 como instalación'});
  check('R14 PG real: bloqueo observado, lock_timeout55P03, ROLLBACK y catálogo exacto sin capability');
  const installed=await observeDdl({name:'bcv-'+nonce+'-install',sql:migration,psql,scalar,eventually});
  const afterInstall=JSON.parse(await scalar(INSTALL_CATALOG));
  assert.equal(afterInstall.audit.oid,before.audit.oid); assert.equal(afterInstall.audit.proowner,before.audit.proowner);
  assert.deepEqual(afterInstall.audit.proacl,before.audit.proacl);
  for(const field of ['append','table','triggers']) assert.deepEqual(afterInstall[field],before[field]);
  assert.equal(afterInstall.capability,'bcv_rates_write_capability()');
  await save('r14-install-positive.json',{before,afterInstall,...installed});
  check('R14 PG real: locks de instalación abierta medidos y COMMIT conserva OID/owner/ACL/cadena/tabla/trigger');
  return {before,oldDefinition};
}

async function runSupplemental({withdrawalOnly=false,syncBcvRates,fetchBcvObservation,client,service,scalar,psql,receipt,check,save,
  fixtureSources,supabaseBase,nonce,installation,setFault,gatewayState,eventually}) {
  const A=uuid('tenant-A'), B=uuid('tenant-B');
  const columns='id,tenant_id,currency,source,valid_on,rate::text,set_at,set_by';
  const template=readFileSync(resolve(ROOT,'lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html'),'utf8');
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const state=async(day)=>JSON.parse(await scalar(`select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('rate_text',f.rate::text) order by f.id)
      from public.fx_rates f where f.valid_on='${day}'::date),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a
      where a.entity_id in(select id from public.fx_rates where valid_on='${day}'::date)),'[]'::jsonb),
    'contexts',coalesce((select jsonb_agg(to_jsonb(c) order by c.entity_id,c.operation,c.native_role)
      from bcv_fixture.context_log c where c.entity_id in(select id from public.fx_rates where valid_on='${day}'::date)),'[]'::jsonb));`));
  const allState=()=>scalar(`select jsonb_build_object(
    'rows',(select jsonb_agg(to_jsonb(f) order by f.id) from public.fx_rates f),
    'events',(select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a),
    'contexts',(select jsonb_agg(to_jsonb(c) order by c.entity_id,c.operation,c.native_role) from bcv_fixture.context_log c))::text;`);
  receipt.supplemental=[];
  const execute=async(label,day,{clock=()=>new Date(day+'T07:00:00.123Z'),scope=[A],rate='885.12345678'}={})=>{
    receipt.phase='HTTP_SUPPLEMENTAL/'+label;
    const date=new Date(day+'T12:00:00Z');
    const visible=`${days[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    const path='/__bcv-fixture/'+nonce+'/'+label;
    const html=template.replace('883,39630000',rate.replace('.',','))
      .replaceAll('2026-10-21T00:00:00-04:00',day+'T00:00:00-04:00').replace('Miércoles, 21 Octubre  2026',visible);
    fixtureSources.set(path,{label,html});
    const from=receipt.gatewayHttp.length,sourceFrom=receipt.sourceHttp.length;
    const clockReads=[];
    const summary=await syncBcvRates({enabled:true,dryRun:false,scope:scope.join(','),
      now:()=>{const value=clock();clockReads.push(value.toISOString());return value;},
      createClient:signal=>client('service_role',undefined,{'x-bcv-fixture-flow':label},signal),
      obtain:options=>fetchBcvObservation({...options,fetch:(input,init)=>{
        assert.equal(String(input),'https://www.bcv.org.ve/'); return fetch(supabaseBase+path,init);
      }})});
    const item={label,day,summary,clockReads,http:receipt.gatewayHttp.slice(from),sourceHttp:receipt.sourceHttp.slice(sourceFrom)};
    receipt.supplemental.push(item);
    assert.equal(summary.counts.scope,['inserted','corrected','unchanged','reconciled','conflicts','failed','unknown','notAttempted']
      .reduce((sum,key)=>sum+summary.counts[key],0));
    assert(summary.counts.deferred<=summary.counts.notAttempted);
    return item;
  };
  const writes=item=>item.http.filter(wire=>wire.flow===item.label&&['POST','PATCH'].includes(wire.method));
  if(!withdrawalOnly) {
  const failDay='2027-01-01'; assert.deepEqual(await state(failDay),{rows:[],events:[],contexts:[]});
  const seeded=await service.from('fx_rates').insert({tenant_id:A,currency:'VES',source:'bcv',valid_on:failDay,
    rate:'880.00000000',set_at:failDay+'T06:00:00.123456Z',set_by:null,note:'preimagen sintética B12 PATCH'})
    .select(columns).retry(false).abortSignal(AbortSignal.timeout(5000));
  assert.equal(seeded.status,201); assert.equal(seeded.error,null); assert.equal(seeded.data.length,1);
  const old=seeded.data[0],beforeFailure=await state(failDay);
  await psql(`begin; create function bcv_fixture.reject_correction() returns trigger language plpgsql set search_path='' as $$
    begin if new.source='job' and new.event_type='exchange_rate_corrected' then
      raise exception 'synthetic correction append failure' using errcode='23514'; end if; return new; end; $$;
    create trigger bcv_fixture_reject_correction before insert on public.entity_audit_log
      for each row execute function bcv_fixture.reject_correction(); commit;`);
  let rejected,patchRequest,patchError;
  setFault((phase,wire)=>{
    if(wire.flow!=='append-patch-rollback'||wire.method!=='PATCH') return;
    if(phase==='before') patchRequest=wire;
    if(phase==='after') patchError=JSON.parse(Buffer.from(wire.bytes).toString('utf8'));
  });
  try {rejected=await execute('append-patch-rollback',failDay);}
  finally {
    setFault(undefined);
    await psql('begin; drop trigger bcv_fixture_reject_correction on public.entity_audit_log; drop function bcv_fixture.reject_correction(); commit;');
  }
  assert.equal(rejected.summary.counts.failed,1); assert.equal(rejected.summary.counts.unknown,0);
  assert.equal(rejected.summary.reason,'WRITE_FAILED');
  assert.equal(writes(rejected).length,1); assert.equal(writes(rejected)[0].method,'PATCH');
  assert.equal(writes(rejected)[0].status,400);
  assert.equal(patchError.code,'23514','append fallido observado, no solo status HTTP');
  assert.equal(patchRequest.body.rate,'885.12345678'); assert.notEqual(patchRequest.body.set_at,old.set_at);
  assert.deepEqual(Object.fromEntries(['id','tenant_id','currency','source','valid_on','rate','set_at'].map(key=>[key,patchRequest.query[key]])),{
    id:'eq.'+old.id,tenant_id:'eq.'+A,currency:'eq.VES',source:'eq.bcv',valid_on:'eq.'+failDay,rate:'eq.'+old.rate,set_at:'eq.'+old.set_at});
  const afterFailure=await state(failDay); assert.deepEqual(afterFailure,beforeFailure);
  await save('b12-patch-append-rollback.json',{request:patchRequest,error:patchError,result:rejected,before:beforeFailure,after:afterFailure});
  check('B12/R9: PATCH efectivo alcanza append real fallido; fila/eventos/contexto íntegros iguales, una sola mutación');

  for(const [index,mode] of ['between-tenants','committed-ack','committed-lost-ack'].entries()) {
    const day='2027-01-0'+(index+2),next='2027-01-0'+(index+3);
    assert.deepEqual(await state(day),{rows:[],events:[],contexts:[]});
    // Instante UTC del día siguiente, aún día Caracas original.
    let instant=next+'T03:59:59.900Z';
    let committed=false,crossed=false,committedEffects;
    const transitions=[];
    setFault(async(phase,wire)=>{
      if(wire.flow!==mode) return;
      if(phase==='after'&&wire.method==='POST'&&wire.path.endsWith('/fx_rates')) {
        assert.equal(wire.status,201); committedEffects=await state(day);
        assert.equal(committedEffects.rows.length,1); assert.equal(committedEffects.events.length,1);
        committed=true; transitions.push({phase:'POSTGRES_COMMIT_OBSERVED_BEFORE_ACK',instant,status:wire.status});
        if(mode!=='between-tenants') {
          instant=next+'T04:00:00.000Z'; crossed=true; transitions.push({phase:'CLOCK_CROSSED_BEFORE_ACK',instant});
          if(mode==='committed-lost-ack') return {drop:true};
        }
      }
      if(mode==='between-tenants'&&committed&&!crossed&&phase==='before'&&wire.path.endsWith('/rpc/bcv_rates_write_capability')) {
        instant=next+'T04:00:00.000Z'; crossed=true; transitions.push({phase:'NEXT_TENANT_CAPABILITY_AFTER_CONFIRMED_ACK',instant});
      }
    });
    let result;
    try {result=await execute(mode,day,{scope:[A,B],clock:()=>new Date(instant)});}
    finally {setFault(undefined);}
    assert(committed&&crossed); assert.equal(writes(result).length,1);
    assert.equal(result.summary.reason,mode==='committed-lost-ack'?'WRITE_UNKNOWN':'DAY_CHANGED');
    assert.equal(result.summary.counts[mode==='committed-lost-ack'?'unknown':'inserted'],1);
    assert.equal(result.summary.counts.notAttempted,1); assert.equal(result.summary.counts.deferred,1);
    const effects=await state(day); assert.deepEqual(effects,committedEffects);
    assert.equal(effects.rows[0].tenant_id,A); assert.equal(effects.rows[0].valid_on,day);
    assert.match(effects.rows[0].note,new RegExp('valid_on='+day));
    assert.equal(effects.events[0].after_data.valid_on,day); assert.equal(effects.events[0].source,'job');
    assert.deepEqual(await state(next),{rows:[],events:[],contexts:[]},'sin refecha en nueva medianoche');
    await save('b5-'+mode+'.json',{result,transitions,committedEffects,effects,
      limit:'Reloj de aplicación controlado que cruza medianoche IANA; PostgreSQL/HTTP/COMMIT reales. No es una espera de medianoche física ni promesa de cancelar COMMIT.'});
  }
  check('B5: corte entre tenants y ACK/ACK perdido tras COMMIT cruzan medianoche, conservan día original y difieren B');
  } else {
    const seeded=await execute('withdrawal-committed-seed','2027-01-01');
    assert.equal(seeded.summary.counts.inserted,1); assert.equal(writes(seeded).length,1);
    check('R14 precondición nueva: tasa y evento job ya comprometidos por importador HTTP real');
  }

  receipt.phase='R14_WITHDRAWAL';
  await eventually(async()=>gatewayState().requests===0&&gatewayState().tasks===0);
  const active=JSON.parse(await scalar(`select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'usename',usename,'state',state)), '[]'::jsonb)
    from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and xact_start is not null;`));
  assert.deepEqual(active,[],'quiescencia observada de transacciones propias antes de retirar SQL');
  const durableBefore=await allState();
  assert(JSON.parse(durableBefore).events.some(event=>event.source==='job'),'eventos job ya comprometidos, no fixture vacía');
  const withdrew=await observeDdl({name:'bcv-'+nonce+'-withdraw',sql:`set local lock_timeout='5s'; set local statement_timeout='60s';
    ${installation.oldDefinition};
    drop function public.bcv_rates_write_capability(); notify pgrst,'reload schema';`,psql,scalar,eventually});
  const after=JSON.parse(await scalar(INSTALL_CATALOG)); assert.deepEqual(after,installation.before);
  assert.equal(await allState(),durableBefore,'retirada conserva cada fila/evento/contexto comprometido');
  const unavailable=await execute('after-successful-sql-withdrawal','2027-01-08');
  assert.equal(unavailable.summary.reason,'SQL_CONTRACT_UNAVAILABLE');
  assert.equal(unavailable.sourceHttp.length,0); assert.equal(writes(unavailable).length,0);
  assert.equal(await allState(),durableBefore);
  await save('r14-successful-withdrawal.json',{activeTransactionsBefore:active,gatewayBefore:{requests:0,tasks:0},
    catalogBefore:installation.before,catalogAfter:after,durableBefore:JSON.parse(durableBefore),durableAfter:JSON.parse(await allState()),
    ...withdrew,unavailable,limit:'Solo fixture propia y quiescente. GET capability no autoriza ni inmoviliza DDL concurrente; sin garantía de disponibilidad/bloqueo cero/rollback de datos ya comprometidos.'});
  check('R14: retirada SQL confirmada conserva eventos job; app nueva falla cerrada antes de fuente/DML sin capability');
  await save('supplemental-http.json',receipt.supplemental);
}

if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) await main();
