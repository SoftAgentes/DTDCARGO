-- 0501 · SDD-0569 · auditoría R3 del nuevo job BCV/VES.
-- Ejecutar íntegra en UNA transacción; no aplicar sobre DB real desde Worker.
-- Sin DML/backfill ni modificación de0495/0267/0294. Motivos/manual/CNY intactos.
-- Contexto role/claims dentro del definer exige gate HTTP PG17.11/PostgREST14.17.
-- GET capability no es lease ni barrera frente a DDL posterior: jobOFF + quiescencia.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $install$
declare
  v_before jsonb;
  v_after jsonb;
  v_append_before jsonb;
  v_table_before jsonb;
  v_trigger_before jsonb;
  v_signature text;
  v_expected_md5 text;
  v_service_execute boolean;
begin
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='bcv_rates_write_capability') then
    raise exception '0501: capability ya existe; no reaplicar ni sobrescribir instalación parcial';
  end if;
  select pg_catalog.to_jsonb(p) into v_before from pg_catalog.pg_proc p
  where p.oid=pg_catalog.to_regprocedure('public.audit_fx_rate_change()')
    and p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='v'
    and p.proconfig=array['search_path=""'] and pg_catalog.pg_get_function_result(p.oid)='trigger'
    and pg_catalog.md5(p.prosrc)='b08dabd9181839c55d879e27a1e35608';
  if v_before is null or (select count(*) from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='audit_fx_rate_change') <> 1 then
    raise exception '0501: auditoría previa distinta de0495; revisar preimagen/catálogo';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      where p.oid='public.audit_fx_rate_change()'::regprocedure and a.privilege_type='EXECUTE' and a.grantee=0)
     or pg_catalog.has_function_privilege('anon','public.audit_fx_rate_change()','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.audit_fx_rate_change()','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.audit_fx_rate_change()','EXECUTE') then
    raise exception '0501: ACL previa de trigger incompatible';
  end if;
  for v_signature,v_expected_md5,v_service_execute in select * from (values
    ('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
     'cd315c0780a4faac4e3d6e48c8415832',true),
    ('public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
     '4b123fd01f9b6c78b040bedb090df4bf',false)
  ) expected(signature,body_md5,service_execute) loop
    if not exists (select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(v_signature)
      and p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='v'
      and p.proconfig=array['search_path=""'] and pg_catalog.pg_get_function_result(p.oid)='uuid'
      and pg_catalog.md5(p.prosrc)=v_expected_md5
      and pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')=v_service_execute
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                     where a.grantee=0 and a.privilege_type='EXECUTE')) then
      raise exception '0501: cadena append0267/0294 incompatible';
    end if;
  end loop;
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.oid) into v_append_before
  from pg_catalog.pg_proc p where p.oid in (
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure,
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure);
  select pg_catalog.to_jsonb(c) into v_table_before from pg_catalog.pg_class c
  where c.oid=pg_catalog.to_regclass('public.fx_rates') and c.relkind='r'
    and c.relowner='postgres'::regrole and c.relrowsecurity;
  select pg_catalog.to_jsonb(t) into v_trigger_before from pg_catalog.pg_trigger t
  where t.tgrelid=pg_catalog.to_regclass('public.fx_rates') and t.tgname='audit_fx_rates'
    and t.tgfoid='public.audit_fx_rate_change()'::regprocedure and t.tgtype=29
    and t.tgenabled='O' and not t.tgisinternal;
  if v_table_before is null or v_trigger_before is null then
    raise exception '0501: tabla/trigger0495 incompatibles';
  end if;

  -- CREATE OR REPLACE conserva OID/owner/ACL. Solo cambia el cuerpo del trigger.
  execute $definition$
create or replace function public.audit_fx_rate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $audit$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else pg_catalog.to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor_id uuid := (select auth.uid());
  v_campos text[] := array['currency', 'rate', 'valid_on', 'source'];
  v_before jsonb;
  v_after jsonb;
  v_event_type text;
  v_reason text;
  v_source text := 'rpc';
  v_claims jsonb;
  v_system_job boolean := false;
begin
  v_before := case when v_old is null then null else pg_catalog.jsonb_build_object(
    'currency', v_old->'currency', 'rate', v_old->'rate', 'valid_on', v_old->'valid_on', 'source', v_old->'source') end;
  v_after := case when v_new is null then null else pg_catalog.jsonb_build_object(
    'currency', v_new->'currency', 'rate', v_new->'rate', 'valid_on', v_new->'valid_on', 'source', v_new->'source') end;
  if tg_op = 'UPDATE' and v_before is not distinct from v_after then
    return new;
  end if;
  v_event_type := case tg_op when 'INSERT' then 'exchange_rate_recorded'
    when 'UPDATE' then 'exchange_rate_corrected' else 'exchange_rate_deleted' end;
  v_reason := case tg_op when 'UPDATE' then 'Tasa del mismo día y fuente reemplazada.'
    when 'DELETE' then 'Tasa de cambio eliminada de la base, fuera del Studio.' end;

  -- role es contexto nativo del request; current_user aquí es el definer.
  if tg_op in ('INSERT','UPDATE') and v_row->>'source'='bcv' and v_row->>'currency'='VES'
     and v_row->>'set_by' is null and session_user='authenticator'
     and pg_catalog.current_setting('role',true)='service_role' then
    begin
      v_claims := nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb;
    exception when invalid_text_representation then
      raise exception 'BCV: contexto HTTP inválido' using errcode='42501',hint='dtd-bcv';
    end;
    if v_claims is null or pg_catalog.jsonb_typeof(v_claims)<>'object'
       or pg_catalog.jsonb_typeof(v_claims->'role') is distinct from 'string'
       or v_claims->>'role' is distinct from 'service_role' then
      raise exception 'BCV: contexto HTTP inválido' using errcode='42501',hint='dtd-bcv';
    end if;
    if v_claims ? 'sub' then
      -- Un sub humano válido conserva la rama anterior, nunca SYSTEM/job.
      if pg_catalog.jsonb_typeof(v_claims->'sub') is distinct from 'string'
         or nullif(pg_catalog.btrim(v_claims->>'sub'),'') is null or v_actor_id is null then
        raise exception 'BCV: sub ambiguo' using errcode='42501',hint='dtd-bcv';
      end if;
    else
      if v_actor_id is not null then
        raise exception 'BCV: identidad contradictoria' using errcode='42501',hint='dtd-bcv';
      end if;
      v_system_job := true;
    end if;
  end if;
  if v_system_job then
    if tg_op='UPDATE' and (
      (old.id,old.tenant_id,old.currency,old.valid_on,old.source) is distinct from
      (new.id,new.tenant_id,new.currency,new.valid_on,new.source) or old.set_by is not null
    ) then
      raise exception 'BCV: clave de corrección incompatible' using errcode='23514',hint='dtd-bcv';
    end if;
    if nullif(pg_catalog.btrim(pg_catalog.current_setting('dtd.audit_reason',true)),'') is not null then
      raise exception 'BCV: motivo transaccional ajeno' using errcode='42501',hint='dtd-bcv';
    end if;
    v_source := 'job';
    v_reason := case tg_op
      when 'INSERT' then 'Carga automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor '
      else 'Actualización automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor '
      end || pg_catalog.to_char(new.valid_on,'YYYY-MM-DD') || '.';
  end if;
  perform public.append_audit_event(
    (v_row->>'tenant_id')::uuid, 'exchange_rate', (v_row->>'id')::uuid,
    case when v_actor_id is null then 'system' else 'user' end, v_actor_id,
    v_event_type, v_source, 'succeeded', v_reason, v_before, v_after,
    pg_catalog.jsonb_build_object('fields', pg_catalog.to_jsonb(v_campos)),
    pg_catalog.concat('fx-rate:', v_row->>'id', ':', pg_catalog.txid_current()::text, ':', tg_op),
    1, 'restricted');
  return case when tg_op='DELETE' then old else new end;
end;
$audit$;
$definition$;

  execute $capability_definition$
create function public.bcv_rates_write_capability()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $capability$
declare
  v_claims jsonb;
  v_ready boolean := false;
begin
  if current_user<>'service_role' or session_user<>'authenticator'
     or pg_catalog.current_setting('role',true) is distinct from 'service_role'
     or auth.uid() is not null
     or nullif(pg_catalog.btrim(pg_catalog.current_setting('dtd.audit_reason',true)),'') is not null then
    return pg_catalog.jsonb_build_object('version',1,'ready',false);
  end if;
  v_claims := nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb;
  if v_claims is null or pg_catalog.jsonb_typeof(v_claims)<>'object'
     or pg_catalog.jsonb_typeof(v_claims->'role') is distinct from 'string'
     or v_claims->>'role' is distinct from 'service_role' or v_claims ? 'sub' then
    return pg_catalog.jsonb_build_object('version',1,'ready',false);
  end if;
  select exists (
    select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.audit_fx_rate_change()')
      and p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='v'
      and p.proconfig=array['search_path=""'] and pg_catalog.pg_get_function_result(p.oid)='trigger'
      and pg_catalog.md5(p.prosrc)='1526ee264a46bb9a4dfc5562d4685bc7'
      and not exists (select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                      where a.grantee=0 and a.privilege_type='EXECUTE')
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
  ) and exists (
    select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
    where c.oid=pg_catalog.to_regclass('public.fx_rates') and c.relkind='r' and c.relrowsecurity
      and c.relowner='postgres'::regrole and t.tgname='audit_fx_rates' and t.tgtype=29
      and t.tgfoid=pg_catalog.to_regprocedure('public.audit_fx_rate_change()')
      and t.tgenabled='O' and not t.tgisinternal
      and pg_catalog.has_table_privilege('service_role',c.oid,'SELECT')
      and pg_catalog.has_table_privilege('service_role',c.oid,'INSERT')
      and pg_catalog.has_table_privilege('service_role',c.oid,'UPDATE')
  ) and (
    select count(*)=2 from pg_catalog.pg_proc p join (values
      ('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
       'cd315c0780a4faac4e3d6e48c8415832',true),
      ('public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
       '4b123fd01f9b6c78b040bedb090df4bf',false)
    ) e(signature,body_md5,service_execute) on p.oid=pg_catalog.to_regprocedure(e.signature)
    where p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='v'
      and p.proconfig=array['search_path=""'] and pg_catalog.pg_get_function_result(p.oid)='uuid'
      and pg_catalog.md5(p.prosrc)=e.body_md5
      and pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')=e.service_execute
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                     where a.grantee=0 and a.privilege_type='EXECUTE')
  ) into v_ready;
  return pg_catalog.jsonb_build_object('version',1,'ready',coalesce(v_ready,false));
exception when others then
  return pg_catalog.jsonb_build_object('version',1,'ready',false);
end;
$capability$;
$capability_definition$;
  alter function public.bcv_rates_write_capability() owner to postgres;
  revoke all on function public.bcv_rates_write_capability() from public,anon,authenticated,service_role;
  grant execute on function public.bcv_rates_write_capability() to service_role;

  select pg_catalog.to_jsonb(p) into v_after from pg_catalog.pg_proc p
  where p.oid='public.audit_fx_rate_change()'::regprocedure
    and pg_catalog.md5(p.prosrc)='1526ee264a46bb9a4dfc5562d4685bc7';
  if v_after is null or (v_before-'prosrc') is distinct from (v_after-'prosrc') then
    raise exception '0501: cambió identidad/seguridad/ACL del trigger o cuerpo inesperado';
  end if;
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.oid) into v_after
  from pg_catalog.pg_proc p where p.oid in (
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure,
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure);
  if v_append_before is distinct from v_after then raise exception '0501: cadena append global alterada'; end if;
  if v_table_before is distinct from (select pg_catalog.to_jsonb(c) from pg_catalog.pg_class c where c.oid='public.fx_rates'::regclass)
     or v_trigger_before is distinct from (select pg_catalog.to_jsonb(t) from pg_catalog.pg_trigger t
       where t.tgrelid='public.fx_rates'::regclass and t.tgname='audit_fx_rates') then
    raise exception '0501: tabla/RLS/grants/trigger alterados';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid='public.bcv_rates_write_capability()'::regprocedure and p.proowner='postgres'::regrole
        and not p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=""']
        and pg_catalog.pg_get_function_result(p.oid)='jsonb'
        and pg_catalog.md5(p.prosrc)='f6c418c8d7c5e55ed3941f5e825990ba'
        and pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
        and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                        where a.grantee=0 and a.privilege_type='EXECUTE')) then
    raise exception '0501: capability/ACL postflight incompatible';
  end if;
end;
$install$;
notify pgrst, 'reload schema';
