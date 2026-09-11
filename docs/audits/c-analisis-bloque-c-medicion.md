# Bloque C: método y recibos de reconstrucción

Dueño: Worker `c-analisis-bloque-c-worker-20260910`. Fecha: 2026-09-10. Estado: finalizado. Clasificación: interno.

El SQL de la PR se lee con `git show` en memoria y se envía por stdin a `psql`; no se materializa ningún archivo de la PR. Este instrumento documental conserva el mismo PostgreSQL 17, stubs de plataforma, lista LEDGER_ONLY, orden lexicográfico C y una sesión/transacción por migración del check `scripts/check-schema-rebuild.mjs` en la base asignada. Conserva las excepciones del check; no cambia cutoff ni pendingBelowCutoff. Las variantes no equivalen a una lectura del esquema real de producción: reproducen únicamente el orden comunicado por Sam sobre una base vacía.

## Resultado definitivo v4

**PASÓ: reconstrucción numérica de las 428 migraciones de esquema y 22 reconstrucciones independientes de los lotes.** Se registran 54 resultados de aplicación/aislamiento, todos PASO; 24 corresponden a aislamiento (base, conjunto completo y 22 lotes). Las 18 LEDGER_ONLY conservan íntegro el dump de esquema. Contenedor v4 eliminado por su ID al terminar, exit 0. Ningún contenedor ajeno fue intervenido.

| Esquema sintético | SHA-256 del dump de esquema normalizado |
|---|---|
|Base numérica sin C|`81c5e6d9777fcd249cd56a51d40495d504cd664dc0e0fba35bd587dc49b3216d`|
|Base+C numérica; también base numérica seguida de C|`828b603bacf44cbd12bf1b6f60017dc87fcb94f9d146cf7f9013c610810685ac`|
|Orden comunicado sin C, 0017 última|`62a2b9f95119dd6426c446e8c9756d0e9ea4ac0b3253a7b55bc789e50319a76e`|
|Orden comunicado seguido de C|`dce3319b7e6ea769681538e3b35d4cbf7d9f47baba9b776ecb57d440f5f0e2bd`|

Las únicas líneas exclusivas detectadas con 0017 última son cuatro GRANT service_role y un encabezado ACL; son las mismas antes y después de C. El comparador de diferencias usa conjuntos de líneas, no un diff estructural de objetos; no detectaría por sí solo reordenamiento de líneas repetidas. La igualdad numérico/tardío, en cambio, sí se verifica con SHA-256 del dump completo normalizado. El SQL de C cambia el catálogo sin C: 124 líneas únicas anteriores y 942 nuevas, como indicador de diferencia, no conteo de objetos. No se infiere una diferencia de datos reales de esas líneas.

Escaneo estático equivalente al check, rehecho sobre los 446 textos: `created=416`, `referenced=319`, `orphans=[]`; paths ASCII, por lo que el sort utilizado coincide con LC_ALL=C. El check canónico sin adaptación también se ejecutó sobre la rama base a través de `corepack pnpm verify`: 396 migraciones, 18 LEDGER_ONLY y aislamiento PASÓ.

El veredicto de C procede del núcleo real de ejecución del check reproducido mediante transporte por stdin, no de haber ejecutado el archivo canónico sobre un checkout que contenga C. Esta distinción permite cumplir la prohibición de extraer los archivos. No se sustituyó SQL por fixtures focales: se ejecutó el historial completo con los stubs mínimos del propio check.

Para reproducir la corrida definitiva se ejecuta **el segundo bloque javascript** de este documento; éste reutiliza y adapta en memoria el primero, que se conserva como instrumento exploratorio. No ejecutar sólo el primero para evaluar el orden de producción. Se usó el tag `postgres:17`, resuelto a `postgres@sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675` según `docker image inspect`. Para comparar los mismos hashes en otra fecha, sustituir en memoria ese tag por este digest; un tag actualizado reproduce el procedimiento, no necesariamente esos bytes.

```powershell
@'
const fs=require('node:fs');
const doc=fs.readFileSync('docs/audits/c-analisis-bloque-c-medicion.md','utf8');
const blocks=[...doc.matchAll(/```javascript\r?\n([\s\S]*?)\r?\n```/g)];
eval(blocks[1][1]);
'@ | node
```

## Instrumento original de esta auditoría

Se ejecuta desde la raíz del worktree mediante Node leyendo el bloque `javascript` de este documento. Sólo crea bases en un contenedor propio, sin puertos publicados ni red. No extrae SQL al host ni al contenedor. `pg_dump --schema-only` se usa exclusivamente sobre ese Postgres sintético.

```javascript
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');
const BASE='e325cb4deb7d11375aa2dbca348496177d1e4350';
const PR='ea9952a47f4adf14c48c91e6d0147597beb94aa7';
const sh=(bin,args,input)=>spawnSync(bin,args,{encoding:'utf8',input,maxBuffer:64*1024*1024});
const must=(r)=>{if(r.status!==0)throw new Error(r.stderr||r.stdout||String(r.error));return r.stdout;};
const git=(args)=>must(sh('git',args));
const list=(ref)=>git(['ls-tree','-r','--name-only',ref,'--','supabase/migrations']).trim().split('\n').filter(x=>x.endsWith('.sql'));
const baseFiles=list(BASE), prFiles=list(PR);
const newFiles=prFiles.filter(x=>!baseFiles.includes(x)&&/^supabase\/migrations\/04(?:0[1-9]|[12][0-9]|3[0-4])_/.test(x));
if(newFiles.length!==32)throw new Error('Inventario inesperado: '+newFiles.length);
const source=git(['show',BASE+':scripts/check-schema-rebuild.mjs']);
const skips=new Set([...source.match(/const LEDGER_ONLY = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([^"]+\.sql)"/g)].map(x=>x[1]));
const sql=new Map();
for(const f of [...baseFiles,...newFiles]) sql.set(f,git(['show',(newFiles.includes(f)?PR:BASE)+':'+f]));
const stubs=git(['show',BASE+':supabase/tests/_supabase-platform-stubs.sql']);
const iso=git(['show',BASE+':supabase/tests/_tenant-isolation.assert.sql']);
const name='dtd_c_analysis_'+crypto.randomBytes(6).toString('hex');
let cid;
const docker=(args,input)=>sh('docker',args,input);
const query=(db,input)=>docker(['exec','-i','-e','PGOPTIONS=-c search_path=public,extensions',cid,'psql','-X','-U','postgres','-d',db,'-q','--single-transaction','-v','ON_ERROR_STOP=1'],input);
const control=(text)=>must(docker(['exec',cid,'psql','-X','-U','postgres','-d','postgres','-q','-v','ON_ERROR_STOP=1','-c',text]));
const report={base:BASE,pr:PR,newFiles,skips:[...skips],runs:[]};
function apply(db,files,label){
  let ok=0;
  for(const f of files){
    if(skips.has(f.split('/').pop()))continue;
    const r=query(db,sql.get(f));
    if(r.status!==0){
      const result={label,status:'FALLO',file:f,applied:ok,exit:r.status,raw:r.stdout+r.stderr};
      report.runs.push(result);console.log('FALLA_EN|'+label+'|'+f+'|'+ok+'\n'+result.raw);return result;
    }
    ok++;
  }
  const result={label,status:'PASO',applied:ok};report.runs.push(result);console.log('OK|'+label+'|'+ok);return result;
}
function isolation(db,label){const r=docker(['exec','-i','-e','PGOPTIONS=-c search_path=public,extensions',cid,'psql','-X','-U','postgres','-d',db,'-q','-v','ON_ERROR_STOP=1'],iso);report.runs.push({label:'isolation_'+label,status:r.status===0?'PASO':'FALLO',exit:r.status});console.log('ISOLATION|'+label+'|'+r.status+'\n'+(r.status?r.stdout+r.stderr:''));return r.status;}
try{
  cid=must(docker(['run','--rm','-d','--name',name,'--label','dtd.owner=c-analisis-bloque-c-worker-20260910','--network','none','-e','POSTGRES_PASSWORD=postgres','postgres:17','-c','fsync=off','-c','full_page_writes=off'])).trim();
  console.log('CONTAINER|'+cid+'|'+name);
  let ready=false;
  for(let i=0;i<90;i++){
    if(docker(['exec',cid,'psql','-U','postgres','-q','-c','select 1']).status===0){ready=true;break;}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,600);
  }
  if(!ready)throw new Error('Postgres no ready');
  console.log('VERSION|'+must(docker(['exec',cid,'psql','-U','postgres','-Atc','select version()'])).trim());
  console.log('IMAGE|'+must(docker(['inspect','--format','{{.Image}}',cid])).trim());
  must(docker(['exec',cid,'sh','-c',"for e in supabase_vault pg_net pgsodium pg_cron http; do d=$(pg_config --sharedir)/extension; printf \"default_version = '1.0'\\ncomment = 'stub'\\nrelocatable = true\\n\" > $d/$e.control; printf -- '-- stub\\n' > $d/$e--1.0.sql; done"]));
  control('CREATE DATABASE prefix');must(query('prefix',stubs));
  const prefix=baseFiles.filter(f=>Number(f.split('/').pop().slice(0,4))<=400).sort();
  console.log('INVENTORY|base='+baseFiles.length+'|new='+newFiles.length+'|union='+(baseFiles.length+newFiles.length)+'|ledger_only='+skips.size);
  const pre=apply('prefix',prefix,'prefix_through_0400');if(pre.status!=='PASO')throw new Error('Base prefix failed');
  const tail=baseFiles.filter(f=>!prefix.includes(f)).sort();
  control('CREATE DATABASE numerical TEMPLATE prefix');
  const numeric=apply('numerical',[...tail,...newFiles].sort(),'numerical_base_plus_32');
  if(numeric.status==='PASO')isolation('numerical','numerical');
  control('CREATE DATABASE baseline TEMPLATE prefix');
  const baseline=apply('baseline',tail,'baseline_tail');
  if(baseline.status==='PASO'){
    isolation('baseline','baseline');
    control('CREATE DATABASE late TEMPLATE baseline');
    apply('late',newFiles.sort(),'append_32_after_baseline');
  }
  const productionTail=[445,448,447,446,449,428,416,435,436,437,438,439,440,441,442,443,444];
  control('CREATE DATABASE production_order TEMPLATE prefix');
  const ordered=productionTail.map(n=>tail.find(f=>Number(f.split('/').pop().slice(0,4))===n));
  if(ordered.some(f=>!f))throw new Error('Missing production tail filename');
  const prod=apply('production_order',ordered,'supplied_production_order_tail');
  if(prod.status==='PASO'){
    // 0017 was also present in the canonical prefix; its reapplication models the final ledger item.
    apply('production_order',baseFiles.filter(f=>f.endsWith('/0017_no_olvidar.sql')),'production_order_0017_again');
    apply('production_order',newFiles.sort(),'append_32_after_supplied_production_order');
  }
  console.log('REPORT_JSON|'+JSON.stringify(report));
}finally{
  if(cid){const r=docker(['rm','-f',cid]);console.log('CLEANUP|'+cid+'|'+r.status);}
}
```

## Salida cruda

Recibo definitivo v4. Texto crudo transcrito de UTF-16LE a UTF-8.

```text
CONTAINER|d7f6e0a6781c8e781845697f6c3d42b2237b1707dec95e526d6a04e627afd41d|dtd_c_analysis_cb94ff3a985a
VERSION|PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
IMAGE|sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675
INVENTORY|base=414|new=32|union=446|ledger_only=18
OK|prefix_through_0400|379
OK|numerical_base_plus_32|49
ISOLATION|numerical|0

OK|baseline_tail|17
ISOLATION|baseline|0

OK|append_32_after_baseline|32
OK|production_prefix_without_0017|378
OK|supplied_production_order_tail|17
OK|production_0017_last|1
OK|append_32_after_supplied_production_order|32
SCHEMA_COMPARE|{"a":"baseline","b":"numerical","shaA":"81c5e6d9777fcd249cd56a51d40495d504cd664dc0e0fba35bd587dc49b3216d","shaB":"828b603bacf44cbd12bf1b6f60017dc87fcb94f9d146cf7f9013c610810685ac","equal":false,"onlyALines":124,"onlyBLines":942,"examplesA":["    CONSTRAINT payment_reports_amount_check CHECK ((amount > (0)::numeric))","COMMENT ON TABLE public.payment_reports IS 'SDD-0134: reportes de pago del cliente sobre una factura (monto/método/fecha/comprobante). client_markbox denormalizado para la RLS del portal. Parciales permitidos (varios por factura). reportado → confirmado|rechazado; al confirmar se suma a invoices.paid_amount (RPC confirm_payment_report). Soft delete via deleted_at.';","  where c.id = public.get_portal_client_id()","COMMENT ON FUNCTION public.get_portal_person_id() IS 'Portal (SDD-0116 Slice E): persons.id del cliente del portal vía clients.person_id (SDD-0106). NULL si no aplica → cierra los predicados de portal. NO tocar get_user_tenant_id().';","COMMENT ON FUNCTION public.mail_check_blacklist(p_tenant_id uuid, p_email text) IS 'Devuelve true si el email está en blacklist del tenant. Caso-insensitive. Usar pre-envío en send-email.ts.';","  select invoice_code into v_code","    and status <> 'borrador'      -- no se reporta pago de un borrador","  new.invoice_code := v_code;    -- sella el snapshot desde la fuente","COMMENT ON FUNCTION public.payment_reports_validate_invoice() IS 'SDD-0134: valida que payment_reports.invoice_id exista, sea del mismo tenant+markbox y no-borrador; sella invoice_code. Defiende contra un cliente que forje invoice_id/tenant_id vía PostgREST directo.';","  v_tenant    uuid;","  v_name      text;","  v_conv_id   uuid;"],"examplesB":["-- Name: payment_private; Type: SCHEMA; Schema: -; Owner: postgres","CREATE SCHEMA payment_private;","ALTER SCHEMA payment_private OWNER TO postgres;","-- Name: portal_address_private; Type: SCHEMA; Schema: -; Owner: postgres","CREATE SCHEMA portal_address_private;","ALTER SCHEMA portal_address_private OWNER TO postgres;","-- Name: SCHEMA portal_address_private; Type: COMMENT; Schema: -; Owner: postgres","COMMENT ON SCHEMA portal_address_private IS 'SDD-0377: no exponer en PostgREST; comandos privados sellados, sin CREATE para roles API.';","-- Name: guard_report_command_fields(); Type: FUNCTION; Schema: payment_private; Owner: postgres","CREATE FUNCTION payment_private.guard_report_command_fields() RETURNS trigger","  if tg_op = 'UPDATE' and old.cancelled_at is not null","     and (new.cancelled_at, new.cancelled_by) is distinct from (old.cancelled_at, old.cancelled_by) then"]}
SCHEMA_COMPARE|{"a":"numerical","b":"late","shaA":"828b603bacf44cbd12bf1b6f60017dc87fcb94f9d146cf7f9013c610810685ac","shaB":"828b603bacf44cbd12bf1b6f60017dc87fcb94f9d146cf7f9013c610810685ac","equal":true,"onlyALines":0,"onlyBLines":0,"examplesA":[],"examplesB":[]}
SCHEMA_COMPARE|{"a":"numerical","b":"production_order","shaA":"828b603bacf44cbd12bf1b6f60017dc87fcb94f9d146cf7f9013c610810685ac","shaB":"dce3319b7e6ea769681538e3b35d4cbf7d9f47baba9b776ecb57d440f5f0e2bd","equal":false,"onlyALines":0,"onlyBLines":5,"examplesA":[],"examplesB":["GRANT ALL ON FUNCTION public.no_olvidar_check_admin(p_user_id uuid) TO service_role;","GRANT ALL ON FUNCTION public.no_olvidar_get_active_kek_version() TO service_role;","-- Name: FUNCTION no_olvidar_handle_new_user(); Type: ACL; Schema: public; Owner: postgres","GRANT ALL ON FUNCTION public.no_olvidar_handle_new_user() TO service_role;","GRANT ALL ON FUNCTION public.no_olvidar_rotate_kek(p_new_secret_name text, p_actor uuid) TO service_role;"]}
SCHEMA_COMPARE|{"a":"baseline","b":"production_before_c","shaA":"81c5e6d9777fcd249cd56a51d40495d504cd664dc0e0fba35bd587dc49b3216d","shaB":"62a2b9f95119dd6426c446e8c9756d0e9ea4ac0b3253a7b55bc789e50319a76e","equal":false,"onlyALines":0,"onlyBLines":5,"examplesA":[],"examplesB":["GRANT ALL ON FUNCTION public.no_olvidar_check_admin(p_user_id uuid) TO service_role;","GRANT ALL ON FUNCTION public.no_olvidar_get_active_kek_version() TO service_role;","-- Name: FUNCTION no_olvidar_handle_new_user(); Type: ACL; Schema: public; Owner: postgres","GRANT ALL ON FUNCTION public.no_olvidar_handle_new_user() TO service_role;","GRANT ALL ON FUNCTION public.no_olvidar_rotate_kek(p_new_secret_name text, p_actor uuid) TO service_role;"]}
LEDGER_ONLY_SCHEMA_UNCHANGED|true|18
OK|lot_401|18
ISOLATION|lot_1|0

OK|lot_402|18
ISOLATION|lot_2|0

OK|lot_403|18
ISOLATION|lot_3|0

OK|lot_404|18
ISOLATION|lot_4|0

OK|lot_405|18
ISOLATION|lot_5|0

OK|lot_406|18
ISOLATION|lot_6|0

OK|lot_407_411_412_413_414|22
ISOLATION|lot_7|0

OK|lot_408|18
ISOLATION|lot_8|0

OK|lot_409|18
ISOLATION|lot_9|0

OK|lot_410_415|19
ISOLATION|lot_10|0

OK|lot_417_429|19
ISOLATION|lot_11|0

OK|lot_418|18
ISOLATION|lot_12|0

OK|lot_419|18
ISOLATION|lot_13|0

OK|lot_420_421_422_423|21
ISOLATION|lot_14|0

OK|lot_424|18
ISOLATION|lot_15|0

OK|lot_425_427|19
ISOLATION|lot_16|0

OK|lot_426|18
ISOLATION|lot_17|0

OK|lot_430|18
ISOLATION|lot_18|0

OK|lot_431|18
ISOLATION|lot_19|0

OK|lot_432|18
ISOLATION|lot_20|0

OK|lot_433|18
ISOLATION|lot_21|0

OK|lot_434|18
ISOLATION|lot_22|0

REPORT_JSON|{"base":"e325cb4deb7d11375aa2dbca348496177d1e4350","pr":"ea9952a47f4adf14c48c91e6d0147597beb94aa7","newFiles":["supabase/migrations/0401_portal_brand_por_principal.sql","supabase/migrations/0402_portal_hidden_statuses_por_principal.sql","supabase/migrations/0403_portal_advisor_por_principal.sql","supabase/migrations/0404_portal_referidos_por_principal.sql","supabase/migrations/0405_portal_perfil_privado_por_principal.sql","supabase/migrations/0406_portal_packing_lists_por_principal.sql","supabase/migrations/0407_invoices_write_rbac.sql","supabase/migrations/0408_mailing_admin_rbac.sql","supabase/migrations/0409_bank_reconciliation_rbac.sql","supabase/migrations/0410_collections_mail_context.sql","supabase/migrations/0411_client_annual_billing_facade.sql","supabase/migrations/0412_conversation_outstanding_facade.sql","supabase/migrations/0413_sales_order_invoice_facade.sql","supabase/migrations/0414_invoices_read_rbac.sql","supabase/migrations/0415_mail_logs_read_rbac.sql","supabase/migrations/0417_portal_prealertas_tenant_boundary.sql","supabase/migrations/0418_portal_academia_tenant_boundary.sql","supabase/migrations/0419_portal_reclamos_tenant_boundary.sql","supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql","supabase/migrations/0421_payment_report_commands.sql","supabase/migrations/0422_payment_report_command_boundary.sql","supabase/migrations/0423_payment_report_historical_identity.sql","supabase/migrations/0424_portal_club_principal_tenant.sql","supabase/migrations/0425_portal_delivery_addresses_tenant_boundary.sql","supabase/migrations/0426_public_verify_atomic_reservation.sql","supabase/migrations/0427_portal_delete_delivery_address_command.sql","supabase/migrations/0429_portal_service_requests_principal_tenant.sql","supabase/migrations/0430_portal_profile_change_requests_principal_tenant.sql","supabase/migrations/0431_portal_post_message_principal_tenant.sql","supabase/migrations/0432_portal_warehouse_boxes_tenant_boundary.sql","supabase/migrations/0433_portal_conversation_realtime_principal_tenant.sql","supabase/migrations/0434_portal_prealerta_addons_principal_tenant.sql"],"skips":["0271_repair_branch_replay_history.sql","0272_skip_superseded_invite_history.sql","0273_skip_platform_admin_bootstrap_history.sql","0274_restore_calculator_settings_history.sql","0275_restore_pin_search_path_history.sql","0276_restore_revoke_anon_rpc_sweep_history.sql","0278_restore_rls_auto_enable_history.sql","0279_restore_tenant_lifecycle_acl_history.sql","0280_repair_sdd0118_split_history.sql","0281_repair_invite_skip_split_history.sql","0282_repair_platform_admin_skip_split_history.sql","0283_repair_calculator_settings_split_history.sql","0284_repair_pin_search_path_split_history.sql","0285_repair_revoke_anon_split_history.sql","0286_repair_tenant_acl_split_history.sql","0287_repair_replay_gate_split_history.sql","0288_finalize_replay_gate_split_history.sql","0388_replay_gate_platform_admins_history.sql"],"runs":[{"label":"prefix_through_0400","status":"PASO","applied":379,"expected":379,"exit":0},{"label":"numerical_base_plus_32","status":"PASO","applied":49,"expected":49,"exit":0},{"label":"isolation_numerical","status":"PASO","exit":0},{"label":"baseline_tail","status":"PASO","applied":17,"expected":17,"exit":0},{"label":"isolation_baseline","status":"PASO","exit":0},{"label":"append_32_after_baseline","status":"PASO","applied":32,"expected":32,"exit":0},{"label":"production_prefix_without_0017","status":"PASO","applied":378,"expected":378,"exit":0},{"label":"supplied_production_order_tail","status":"PASO","applied":17,"expected":17,"exit":0},{"label":"production_0017_last","status":"PASO","applied":1,"expected":1,"exit":0},{"label":"append_32_after_supplied_production_order","status":"PASO","applied":32,"expected":32,"exit":0},{"label":"lot_401","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_1","status":"PASO","exit":0},{"label":"lot_402","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_2","status":"PASO","exit":0},{"label":"lot_403","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_3","status":"PASO","exit":0},{"label":"lot_404","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_4","status":"PASO","exit":0},{"label":"lot_405","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_5","status":"PASO","exit":0},{"label":"lot_406","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_6","status":"PASO","exit":0},{"label":"lot_407_411_412_413_414","status":"PASO","applied":22,"expected":22,"exit":0},{"label":"isolation_lot_7","status":"PASO","exit":0},{"label":"lot_408","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_8","status":"PASO","exit":0},{"label":"lot_409","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_9","status":"PASO","exit":0},{"label":"lot_410_415","status":"PASO","applied":19,"expected":19,"exit":0},{"label":"isolation_lot_10","status":"PASO","exit":0},{"label":"lot_417_429","status":"PASO","applied":19,"expected":19,"exit":0},{"label":"isolation_lot_11","status":"PASO","exit":0},{"label":"lot_418","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_12","status":"PASO","exit":0},{"label":"lot_419","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_13","status":"PASO","exit":0},{"label":"lot_420_421_422_423","status":"PASO","applied":21,"expected":21,"exit":0},{"label":"isolation_lot_14","status":"PASO","exit":0},{"label":"lot_424","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_15","status":"PASO","exit":0},{"label":"lot_425_427","status":"PASO","applied":19,"expected":19,"exit":0},{"label":"isolation_lot_16","status":"PASO","exit":0},{"label":"lot_426","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_17","status":"PASO","exit":0},{"label":"lot_430","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_18","status":"PASO","exit":0},{"label":"lot_431","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_19","status":"PASO","exit":0},{"label":"lot_432","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_20","status":"PASO","exit":0},{"label":"lot_433","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_21","status":"PASO","exit":0},{"label":"lot_434","status":"PASO","applied":18,"expected":18,"exit":0},{"label":"isolation_lot_22","status":"PASO","exit":0}]}
CLEANUP|d7f6e0a6781c8e781845697f6c3d42b2237b1707dec95e526d6a04e627afd41d|0
MEASUREMENT_EXIT=0
```

Primer intento del instrumento: descartado como evidencia del bloque C. Falló en 0020 con `function gen_salt(unknown) does not exist`, tras 19 migraciones, porque los stubs establecen `ALTER DATABASE postgres SET search_path=public,extensions` y las bases separadas del instrumento no heredaban ese ajuste. Se corrigió sólo el instrumento con `PGOPTIONS=-c search_path=public,extensions`, equivalente al search_path del check; ningún SQL del repositorio cambió. El contenedor de ese intento fue eliminado por su ID.

## Comparación de catálogos y cierres de dependencias

Este segundo instrumento reutiliza el anterior en memoria. Acelera el transporte enviando un stream a psql con `\connect` entre migraciones (sesión nueva), `BEGIN`/`COMMIT` por archivo y `ON_ERROR_STOP=1`. Ningún archivo SQL se materializa. La variante de producción excluye realmente `0017_no_olvidar` del prefijo y la aplica al final; es más fiel que la exploración inicial que la reaplicó. No reconstruye datos, ledger ni configuración real de producción.

```javascript
const fs2=require('node:fs');
let code=fs2.readFileSync('docs/audits/c-analisis-bloque-c-medicion.md','utf8').match(/```javascript\r?\n([\s\S]*?)\r?\n```/)[1];
function apply(db,files,label){
  const selected=files.filter(f=>!skips.has(f.split('/').pop()));
  const input=selected.map(f=>'\\connect '+db+' postgres\n\\echo APPLY|'+f+'\nBEGIN;\n'+sql.get(f)+'\nCOMMIT;\n\\echo APPLIED|'+f+'\n').join('\n');
  const r=docker(['exec','-i','-e','PGOPTIONS=-c search_path=public,extensions',cid,'psql','-X','-U','postgres','-d',db,'-q','-v','ON_ERROR_STOP=1'],input);
  const applied=[...r.stdout.matchAll(/^APPLIED\|(.+)$/gm)].length;
  const attempted=[...r.stdout.matchAll(/^APPLY\|(.+)$/gm)].map(x=>x[1]);
  const result={label,status:r.status===0&&applied===selected.length?'PASO':'FALLO',applied,expected:selected.length,exit:r.status};
  if(result.status==='FALLO'){result.file=attempted.at(-1);result.raw=r.stderr;console.log('FALLA_EN|'+label+'|'+result.file+'|'+applied+'\n'+r.stderr);}
  else console.log('OK|'+label+'|'+applied);
  report.runs.push(result);return result;
}
code=code.slice(0,code.indexOf('function apply('))+apply.toString()+'\n'+code.slice(code.indexOf('function isolation('));
code=code.replace("control('CREATE DATABASE production_order TEMPLATE prefix');","control('CREATE DATABASE production_order');must(query('production_order',stubs));if(apply('production_order',prefix.filter(f=>!f.endsWith('/0017_no_olvidar.sql')),'production_prefix_without_0017').status!=='PASO')throw new Error('Production prefix failed');");
code=code.replace("const prod=apply('production_order',ordered,'supplied_production_order_tail');","const prod=apply('production_order',ordered,'supplied_production_order_tail');\n  if(prod.status==='PASO'){if(apply('production_order',baseFiles.filter(f=>f.endsWith('/0017_no_olvidar.sql')),'production_0017_last').status!=='PASO')throw new Error('Production 0017 failed');control('CREATE DATABASE production_before_c TEMPLATE production_order');}");
code=code.replace("    apply('production_order',baseFiles.filter(f=>f.endsWith('/0017_no_olvidar.sql')),'production_order_0017_again');",'');
const extra=String.raw`
  function dump(db){
    return must(docker(['exec',cid,'pg_dump','-U','postgres','-d',db,'--schema-only'])).replace(/^\\(?:un)?restrict .*\r?\n/gm,'');
  }
  function compare(a,b){
    const da=dump(a),db=dump(b),ha=crypto.createHash('sha256').update(da).digest('hex'),hb=crypto.createHash('sha256').update(db).digest('hex');
    const sa=new Set(da.split('\n')),sb=new Set(db.split('\n'));
    const onlyA=[...sa].filter(x=>!sb.has(x)),onlyB=[...sb].filter(x=>!sa.has(x));
    console.log('SCHEMA_COMPARE|'+JSON.stringify({a,b,shaA:ha,shaB:hb,equal:ha===hb,onlyALines:onlyA.length,onlyBLines:onlyB.length,examplesA:onlyA.slice(0,12),examplesB:onlyB.slice(0,12)}));
  }
  compare('baseline','numerical');compare('numerical','late');compare('numerical','production_order');compare('baseline','production_before_c');
  const beforeLedger=dump('numerical');
  for(const f of skips){query('numerical',sql.get('supabase/migrations/'+f));}
  const ledgerUnchanged=beforeLedger===dump('numerical');
  console.log('LEDGER_ONLY_SCHEMA_UNCHANGED|'+ledgerUnchanged+'|'+skips.size);
  if(!ledgerUnchanged)throw new Error('Ledger-only changed schema');
  const groups=[[401],[402],[403],[404],[405],[406],[407,411,412,413,414],[408],[409],[410,415],[417,429],[418],[419],[420,421,422,423],[424],[425,427],[426],[430],[431],[432],[433],[434]];
  for(let i=0;i<groups.length;i++){
    const db='lot_'+(i+1);control('CREATE DATABASE '+db+' TEMPLATE prefix');
    const selected=newFiles.filter(f=>groups[i].includes(Number(f.split('/').pop().slice(0,4))));
    const r=apply(db,[...tail,...selected].sort(),'lot_'+groups[i].join('_'));
    if(r.status==='PASO')isolation(db,db);
  }
`;
code=code.replace("  console.log('REPORT_JSON|'",extra+"\n  console.log('REPORT_JSON|'");
eval(code);
```
