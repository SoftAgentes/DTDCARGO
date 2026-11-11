#!/usr/bin/env node
// C1: PostgreSQL17 + PostgREST14.17 desechables y JWT sintéticos, solo loopback.
// Uso: node scripts/tests/fechas-caracas-postgrest.mjs --evidence C:/tmp/...
// Nunca lee .env ni contacta servicios alojados. Cada fase y respuesta HTTP
// queda en evidencia externa; limpia únicamente recursos que esta corrida creó.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const contractPath = resolve(root, 'supabase/tests/0533_fechas_caracas_operaciones.test.sql');
export function inlineContract(vars = {}, replacements = {}) {
  const state = { ...vars }, out = [];
  function run(file) {
    const key = Object.keys(replacements).find(name => file.endsWith(name));
    const source = key ? replacements[key] : readFileSync(file, 'utf8');
    const stack = [], active = () => stack.every(frame => frame.active);
    for (const line of source.split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) { if (active()) out.push(line); continue; }
      const [, command, rest] = meta;
      if (command === 'if') {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const value = defined ? String(defined[1] in state) : rest.startsWith(':') ? String(state[rest.slice(1)]) : rest;
          if (!/^(true|false|on|off|t|f|yes|no|1|0)$/i.test(value)) throw Error('if no booleano: ' + rest);
          taken = /^(true|on|t|yes|1)$/i.test(value);
        }
        stack.push({ active: taken, taken });
      } else if (command === 'else') { const frame=stack.at(-1); if (!frame) throw Error('else sin if'); frame.active=!frame.taken; }
      else if (command === 'endif') { if (!stack.pop()) throw Error('endif sin if'); }
      else if (!active()) continue;
      else if (command === 'set') { const [name,value] = rest.split(/\s+/); if(name!=='ON_ERROR_STOP') state[name] = value.startsWith(':') ? state[value.slice(1)] : value; }
      else if (command === 'ir') run(resolve(dirname(file), rest));
      else throw Error('metaorden no soportada: ' + command);
    }
    if(stack.length) throw Error('if sin cerrar: '+file);
  }
  run(contractPath);
  return out.join('\n');
}
export function embeddedSql(sql) {
  return sql.replace(/pg_read_file\('\/sb\/migrations\/([^']+)'\)/g, (_, name) => "'" + readFileSync(resolve(root,'supabase/migrations',name),'utf8').replaceAll("'", "''") + "'");
}

export function clockFixtureSql() {
  const source=readFileSync(contractPath,'utf8');
  const start=source.indexOf('-- Reloj exclusivo de fixture.');
  const end=source.indexOf("set local timezone='UTC';",start);
  assert(start>=0 && end>start,'anclas de instrumentación del contrato');
  return source.slice(start,end);
}

const hash = value => createHash('sha256').update(value).digest('hex');
function uuid(label,prefix='0533-synthetic-') {
  const hex=createHash('md5').update(prefix+label).digest('hex');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const oldId = label => uuid(label,'0421-synthetic-');
const quote = value => "'"+String(value).replaceAll("'","''")+"'";

async function main() {
  const option=process.argv.indexOf('--evidence');
  assert(option>=0 && process.argv[option+1],'Falta --evidence externo');
  const evidence=resolve(process.argv[option+1]);
  assert(!evidence.startsWith(root),'Evidencia fuera del worktree');
  await mkdir(evidence,{recursive:false});
  const suffix=process.pid+'-'+Date.now().toString(36), network='dtd-c1-'+suffix, pg=network+'-pg', rest=network+'-rest';
  const password=randomBytes(24).toString('hex'), secret=randomBytes(32).toString('hex');
  const receipt={startedAt:new Date().toISOString(),pid:process.pid,root,result:'RUNNING',resources:{network,pg,rest},checks:[],responses:[],cleanup:[]};
  const created=[]; let networkCreated=false;
  const save=(name,value)=>writeFile(resolve(evidence,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  const check=(name,details={})=>{receipt.checks.push({name,at:new Date().toISOString(),...details});console.log('PASÓ: '+name);};
  const run=(command,args,{input,allowFailure=false,timeout=120_000}={})=>new Promise((res,rej)=>{
    const child=spawn(command,args,{cwd:root,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
    child.stdout.on('data',data=>{stdout+=data;});child.stderr.on('data',data=>{stderr+=data;});
    child.on('error',error=>{clearTimeout(timer);rej(error);});
    child.on('close',(code,signal)=>{clearTimeout(timer);const result={code,signal,timedOut,stdout,stderr};
      if(!allowFailure&&(code!==0||signal||timedOut))rej(Object.assign(Error(command+' falló '+code+'/'+signal+'\n'+stderr+'\n'+stdout),{result}));else res(result);});
    child.stdin.end(input);
  });
  const docker=(args,options)=>run('docker',args,options);
  const psql=sql=>docker(['exec','-i',pg,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:sql});
  const scalar=async sql=>(await psql(sql)).stdout.trim();
  const delay=ms=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms));
  const eventually=async (operation,predicate,ms=30_000)=>{
    const until=Date.now()+ms;let last;
    do {try{last=await operation();if(predicate(last))return last;}catch(error){last=String(error);}await delay(250);}while(Date.now()<until);
    throw Error('Espera local agotada: '+JSON.stringify(last));
  };
  let port;
  const server=createServer();await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
  port=server.address().port;await new Promise(res=>server.close(res));receipt.resources.port=port;
  const base='http://127.0.0.1:'+port;
  const token=(actor,role)=>{
    const unsigned=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:oldId(actor),role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
    return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
  };
  const rpc=async (name,actor,body,role='authenticated')=>{
    const response=await fetch(base+'/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+token(actor,role)}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15_000)});
    const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
    const result={status:response.status,data};receipt.responses.push({name,actor,role,body,at:new Date().toISOString(),...result});await save('http-responses.json',receipt.responses);return result;
  };
  const snapshot=()=>scalar('select md5(c1_fixture.state()::text);');
  const denied=async (label,name,actor,body,code,role='authenticated')=>{
    const before=await snapshot(),response=await rpc(name,actor,body,role);
    assert(response.status>=400,label+' debe fallar');if(code)assert.equal(response.data.code,code,label);
    assert.equal(await snapshot(),before,label+' cero mutaciones');check(label,{status:response.status,code:response.data.code});return response;
  };
  const collection=(date=null)=>({p_invoice_id:oldId('invoice-A'),p_amount:10.25,p_cash_account_id:uuid('cash'),p_method:'transferencia',p_received_at:date,p_reference:null,p_notes:null,p_payer_kind:'cliente',p_payer_name:null,p_payer_relation:null,p_licit_declared:false});
  const supplier=(date=null)=>({p_bill_id:uuid('bill'),p_amount:10.25,p_cash_account_id:uuid('cash'),p_method:'transferencia',p_paid_at:date,p_reference:null,p_notes:null});
  const seedOrder=async label=>{
    await psql(`insert into public.sales_orders(id,tenant_id,sales_order_code,client_markbox,client_name,total_usd) values('${uuid('order-'+label)}','${oldId('tenant-A')}',${quote('OV-'+label)},'DUP','Sintético',10.25);
insert into public.prealertas(id,tenant_id,sales_order_id,boxes) values('${uuid('box-'+label)}','${oldId('tenant-A')}','${uuid('order-'+label)}',1);
insert into public.warehouse_receipts_cn(id,tenant_id,receipt_code,client_markbox,total_cbm,total_weight_kg,prealerta_id) values('${uuid('warehouse-'+label)}','${oldId('tenant-A')}',${quote('WR-'+label)},'DUP',1,10,'${uuid('box-'+label)}');`);
    return {p_tenant_id:oldId('tenant-A'),p_receipt_id:uuid('warehouse-'+label)};
  };
  try {
    receipt.head=(await run('git',['rev-parse','HEAD'])).stdout.trim();
    receipt.migrationSha256=hash(readFileSync(resolve(root,'supabase/migrations/0533_fechas_caracas_operaciones.sql')));
    receipt.dockerVersion=(await docker(['version','--format','{{.Server.Version}}'])).stdout.trim();
    receipt.existingResources=(await docker(['ps','--format','{{.Names}}|{{.Status}}'])).stdout.trim();
    receipt.resourceLoad=(await docker(['stats','--no-stream','--format','{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}'])).stdout.trim();
    await docker(['network','create','--label','dtd.task=0576c1',network]);networkCreated=true;
    await docker(['run','-d','--name',pg,'--label','dtd.task=0576c1','--network',network,'--network-alias','db','--mount','type=bind,source='+resolve(root,'supabase')+',target=/sb,readonly','-e','POSTGRES_PASSWORD='+password,'postgres:17'],{timeout:300_000});created.push(pg);
    await eventually(()=>docker(['exec',pg,'pg_isready','-U','postgres'],{allowFailure:true}),r=>r.code===0,60_000);
    receipt.postgresVersion=await scalar('select version();');assert.match(receipt.postgresVersion,/PostgreSQL 17\./);
    receipt.pgImage=(await docker(['inspect','--format','{{.Image}}',pg])).stdout.trim();
    if(!process.argv.includes('--http-only')){
      const closingOnly=process.argv.includes('--closing-only');
      const selection=closingOnly?['-v','run_defaults=false','-v','run_operations=false','-v','run_auto_invoice=false','-v','run_portal=false']:[];
      const contract=await docker(['exec',pg,'psql','-X','-v','ON_ERROR_STOP=1',...selection,'-U','postgres','-d','postgres','-f','/sb/tests/0533_fechas_caracas_operaciones.test.sql']);
      await save('postgres-contract.log',contract.stdout+'\n'+contract.stderr);
      assert.match(contract.stdout,/TEST0533 GREEN: \d+ aserciones/);assert.match(contract.stdout,/ROLLBACK/);
      check(closingOnly?'PostgreSQL17: composición0493 + guardas gasto C1 y ROLLBACK':'PostgreSQL17: contrato real completo y ROLLBACK',{marker:contract.stdout.match(/TEST0533 GREEN: \d+ aserciones/)[0]});
      if(closingOnly){receipt.http='NO EJECUTADO: suplemento0493 sin cambio0533/API';receipt.result='PASÓ';return;}
    }else receipt.sqlContract='NO EJECUTADO: --http-only';
    const fixture=await docker(['exec',pg,'psql','-X','-v','ON_ERROR_STOP=1','-v','fixture_only=true','-v','apply_fix=false','-U','postgres','-d','postgres','-f','/sb/tests/0533_fechas_caracas_operaciones.test.sql']);
    await save('http-fixture.log',fixture.stdout+'\n'+fixture.stderr);
    // Adaptador explícito de PostgREST14: claims JSON, no Supabase Auth real.
    await psql(`create or replace function auth.uid() returns uuid language sql stable set search_path='' as $$
select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create role authenticator login noinherit password '${password}';grant anon,authenticated,service_role to authenticator;
create function c1_fixture.http_context() returns void language plpgsql security definer set search_path='' as $$
begin if to_regclass('c1_fixture.http_clock') is not null then
 perform set_config('c1.instant',(select instant::text from c1_fixture.http_clock),true);
 perform set_config('c1.clock_sequence',(select case when sequenced then 'on' else 'off' end from c1_fixture.http_clock),true);
 perform setval('c1_fixture.clock_reads',1,false);
end if;end;$$;
grant usage on schema c1_fixture to anon,authenticated,service_role;
grant execute on function c1_fixture.http_context() to anon,authenticated,service_role;`);
    await docker(['run','-d','--name',rest,'--label','dtd.task=0576c1','--network',network,'-p','127.0.0.1:'+port+':3000','-e','PGRST_DB_URI=postgres://authenticator:'+password+'@db:5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_PRE_REQUEST=c1_fixture.http_context','-e','PGRST_JWT_SECRET='+secret,'postgrest/postgrest:v14.17'],{timeout:300_000});created.push(rest);
    receipt.restImage=(await docker(['inspect','--format','{{.Image}}',rest])).stdout.trim();
    receipt.postgrestVersion=(await docker(['exec',rest,'/bin/postgrest','--version'])).stdout.trim();assert.match(receipt.postgrestVersion,/14\.17/);
    await eventually(async()=>{const response=await fetch(base,{signal:AbortSignal.timeout(2000)});return response.status;},s=>s===200);
    const before=await rpc('sales_order_claim_and_invoice','accounting-A',await seedOrder('before'),'service_role');
    assert.equal(before.status,200);assert.equal(before.data.outcome,'invoiced');assert(!('issued_at' in before.data));
    check('HTTP antes del DDL:0128 legado sin issued_at',{response:before});
    receipt.restStartedBeforeDdl=(await docker(['inspect','--format','{{.State.StartedAt}}',rest])).stdout.trim();
    const beforeDdl=await snapshot();receipt.ddlStartedAt=new Date().toISOString();
    const ddl=await docker(['exec',pg,'psql','-X','-1','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/sb/migrations/0533_fechas_caracas_operaciones.sql']);
    await save('http-ddl-0533.log',ddl.stdout+'\n'+ddl.stderr);receipt.ddlCommittedAt=new Date().toISOString();assert.equal(await snapshot(),beforeDdl,'DDL sin DML');
    const after=await rpc('sales_order_claim_and_invoice','accounting-A',await seedOrder('after'),'service_role');
    assert.equal(after.status,200);assert.equal(after.data.outcome,'invoiced');assert.match(after.data.issued_at,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(after.data.issued_at,await scalar(`select issued_at from public.invoices where id=${quote(after.data.invoice_id)};`));
    receipt.restStartedAfterDdl=(await docker(['inspect','--format','{{.State.StartedAt}}',rest])).stdout.trim();assert.equal(receipt.restStartedAfterDdl,receipt.restStartedBeforeDdl);
    await psql(`update c1_fixture.real_definitions set definition=pg_get_functiondef(signature::regprocedure);
update c1_fixture.real_defaults r set expression=pg_get_expr(d.adbin,d.adrelid) from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=('public.'||r.relname)::regclass and a.attname=r.attname;`);
    await save('http-real-catalog.json',JSON.parse(await scalar("select jsonb_build_object('functions',(select jsonb_agg(to_jsonb(t)) from c1_fixture.real_definitions t),'defaults',(select jsonb_agg(to_jsonb(t)) from c1_fixture.real_defaults t))::text;")));
    check('DDL0533 real/COMMIT/NOTIFY y HTTP nuevo en mismo PostgREST',{startedAt:receipt.restStartedAfterDdl,issuedAt:after.data.issued_at,migrationSha256:receipt.migrationSha256});
    await psql('begin;\n'+clockFixtureSql()+"\ncreate table c1_fixture.http_clock(instant timestamptz not null,sequenced boolean not null);insert into c1_fixture.http_clock values('2026-10-21T02:30Z',true);commit;");
    check('Inicio fase separada con reloj de fixture; fuente0533 intacta');
    const collect=await rpc('register_collection_receipt','accounting-A',collection());assert.equal(collect.status,200);
    assert.equal(await scalar(`select received_at from public.payment_receipts where id=${quote(collect.data.receipt_id)};`),'2026-10-20');assert.equal(await scalar('select last_value from c1_fixture.clock_reads;'),'1');
    assert.equal(collect.data.amount,10.25);
    const pay=await rpc('register_supplier_payment_order','accounting-A',supplier());assert.equal(pay.status,200);
    assert.equal(await scalar(`select paid_at from public.supplier_payments where id=${quote(pay.data.payment_id)};`),'2026-10-20');assert.equal(await scalar('select last_value from c1_fixture.clock_reads;'),'1');assert.equal(pay.data.amount,10.25);
    const auto=await rpc('sales_order_claim_and_invoice','accounting-A',await seedOrder('clock'),'service_role');assert.equal(auto.status,200);assert.equal(auto.data.issued_at,'2026-10-20');assert.equal(await scalar('select last_value from c1_fixture.clock_reads;'),'1');
    assert.equal(await scalar(`select (due_date=issued_at+30)::text from public.invoices where id=${quote(auto.data.invoice_id)};`),'true');
    check('HTTP cobro/pago/0128: día persistido, reloj único y centavos');
    const explicit=await rpc('register_collection_receipt','accounting-A',collection('2024-02-29'));assert.equal(explicit.status,200);assert.equal(await scalar(`select received_at from public.payment_receipts where id=${quote(explicit.data.receipt_id)};`),'2024-02-29');
    const explicitPay=await rpc('register_supplier_payment_order','accounting-A',supplier('2024-02-29'));assert.equal(explicitPay.status,200);assert.equal(await scalar(`select paid_at from public.supplier_payments where id=${quote(explicitPay.data.payment_id)};`),'2024-02-29');
    check('HTTP fechas explícitas conservadas');
    for(const actor of ['marketing-A','disabled-A','accounting-B']){
      await denied('cobro '+actor,'register_collection_receipt',actor,collection(),actor==='accounting-B'?'P0002':'42501');
      await denied('pago '+actor,'register_supplier_payment_order',actor,supplier(),actor==='accounting-B'?'P0002':'42501');
    }
    await psql(`insert into public.user_tenants values('${oldId('accounting-A')}','${oldId('tenant-B')}','accounting',null);`);
    await denied('cobro tenant ambiguo0453','register_collection_receipt','accounting-A',collection(),'42501');
    await denied('pago tenant ambiguo0453','register_supplier_payment_order','accounting-A',supplier(),'42501');
    await psql(`delete from public.user_tenants where user_id='${oldId('accounting-A')}' and tenant_id='${oldId('tenant-B')}';`);
    for(const role of ['anon','service_role']){
      await denied('cobro ACL '+role,'register_collection_receipt','accounting-A',collection(),'42501',role);
      await denied('pago ACL '+role,'register_supplier_payment_order','accounting-A',supplier(),'42501',role);
    }
    await denied('0128 authenticated no ejecuta','sales_order_claim_and_invoice','accounting-A',{p_tenant_id:oldId('tenant-A'),p_receipt_id:uuid('warehouse-clock')},'42501');
    await denied('motor privado no expuesto','run_report_command','portal-A',{},'PGRST202');
    await psql("update c1_fixture.http_clock set sequenced=false;");
    const proof=oldId('tenant-A')+'/'+oldId('invoice-A')+'/'+uuid('http-report')+'/'+uuid('http-object')+'.pdf';
    const body={p_request_id:uuid('http-request'),p_report_id:uuid('http-report'),p_invoice_code:'F-CMD-SHARED',p_amount:10.25,p_method:'transferencia',p_paid_at:'2026-10-21',p_proof_path:proof,p_note:'Sintético'};
    await denied('Portal futura nueva antes de Storage','create_portal_payment_report','portal-A',body,'22023');
    await psql(`insert into storage.objects(bucket_id,name) values('payment-proofs',${quote(proof)});`);
    await denied('Portal futura nueva con objeto presente','create_portal_payment_report','portal-A',body,'22023');
    await psql("update c1_fixture.http_clock set instant='2026-10-22T04:00Z';");body.p_paid_at='2026-10-22';
    const nonFinancialBefore=await scalar("select md5(jsonb_build_object('invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.payment_receipts r))::text);");
    const accepted=await rpc('create_portal_payment_report','portal-A',body);assert.equal(accepted.status,200);assert.equal(accepted.data.replayed,false);
    assert.equal(await scalar("select md5(jsonb_build_object('invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.payment_receipts r))::text);"),nonFinancialBefore);
    await psql("update c1_fixture.http_clock set instant='2026-10-21T02:30Z';");
    let previous=await snapshot();const replay=await rpc('create_portal_payment_report','portal-A',body);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.equal(await snapshot(),previous);
    await psql(`delete from storage.objects where bucket_id='payment-proofs' and name=${quote(proof)};`);
    previous=await snapshot();const absent=await rpc('create_portal_payment_report','portal-A',body);assert.equal(absent.status,200);assert.equal(absent.data.replayed,true);assert.equal(await snapshot(),previous);
    check('HTTP replay idéntico futuro: cero efectos; recibo SQL histórico incluso sin objeto actual');
    for(const change of [{p_amount:11},{p_method:'otro'},{p_paid_at:'2026-10-20'},{p_note:'Nota diferente'},{p_invoice_code:'F-LIMIT'},{p_report_id:uuid('another')},{p_proof_path:proof+'.png'}]){
      await denied('Portal replay campo '+Object.keys(change)[0],'create_portal_payment_report','portal-A',{...body,...change},'23505');
    }
    await denied('Portal request nuevo no recupera','create_portal_payment_report','portal-A',{...body,p_request_id:uuid('new-request')},'22023');
    await denied('Portal tenant/actor ajeno','create_portal_payment_report','portal-B',body,'23505');
    await psql(`insert into auth.users(id,email) values('${oldId('http-second')}','http-second@example.invalid');update public.client_users set auth_user_id='${oldId('http-second')}' where auth_user_id='${oldId('portal-A')}';`);
    await denied('Portal actor reasignado mismo cliente','create_portal_payment_report','http-second',body,'23505');
    await psql(`update public.client_users set auth_user_id='${oldId('portal-A')}' where auth_user_id='${oldId('http-second')}';update public.client_users set status='revoked' where auth_user_id='${oldId('portal-A')}';`);
    await denied('Portal principal revocado','create_portal_payment_report','portal-A',body,'42501');
    await psql(`update public.client_users set status='active' where auth_user_id='${oldId('portal-A')}';`);
    await denied('Portal verb distinto','cancel_portal_payment_report','portal-A',{p_request_id:body.p_request_id,p_report_id:body.p_report_id,p_invoice_code:body.p_invoice_code,p_reason:'Motivo sintético'},'23505');
    for(const role of ['anon','service_role'])await denied('Portal ACL '+role,'create_portal_payment_report','portal-A',body,'42501',role);
    await denied('Portal sin JWT','create_portal_payment_report',null,body,'42501');
    check('SQL/HTTP completos; Auth alojado y bytes actuales de Storage NO probados por SQL');
    receipt.result='PASÓ';
  }catch(error){receipt.result='FALLÓ';receipt.error=error.stack??String(error);if(error.result)await save('failed-command.log',error.result.stdout+'\n'+error.result.stderr);console.error(receipt.error);process.exitCode=1;}
  finally{
    for(const name of created.toReversed()){
      const logs=await docker(['logs',name],{allowFailure:true});await save(name.endsWith('-pg')?'postgres-server.log':'postgrest-server.log',logs.stdout+'\n'+logs.stderr);
      const removed=await docker(['rm','-f',name],{allowFailure:true});receipt.cleanup.push({name,...removed});
    }
    if(networkCreated)receipt.cleanup.push({name:network,...await docker(['network','rm',network],{allowFailure:true})});
    receipt.remainingOwn=(await docker(['ps','-a','--filter','label=dtd.task=0576c1','--format','{{.Names}}'],{allowFailure:true})).stdout.trim();
    if(receipt.cleanup.some(r=>r.code!==0)||receipt.remainingOwn){receipt.result='FALLÓ';process.exitCode=1;}
    receipt.endedAt=new Date().toISOString();await save('receipt.json',receipt);console.log(JSON.stringify({result:receipt.result,checks:receipt.checks.length,evidence,remainingOwn:receipt.remainingOwn}));
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
