-- SDD-0226 · anulación gobernada de finiquito de Nómina.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.nomina_settlements') is null
     or to_regclass('public.nomina_settlement_lines') is null
     or to_regclass('public.journal_entries') is null
     or to_regclass('public.user_tenants') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null
     or to_regprocedure('public.audit_d2_financial_change()') is null then
    raise exception '0316 requiere Nómina, D2 y el writer AUD-01';
  end if;

  if to_regprocedure('public.void_payroll_settlement_governed(uuid,text,text)') is not null
     or to_regprocedure('public.guard_payroll_settlement_void()') is not null
     or to_regprocedure('public.guard_payroll_settlement_lines()') is not null then
    raise exception '0316 abortado: contrato de anulación ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('payroll_settlement', 'active', 'finance', 1, 'migration:0316')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create function public.guard_payroll_settlement_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(pg_catalog.current_setting('dtd.payroll_settlement_void', true)),
    ''
  );
begin
  if old.status = 'confirmado' and new.status = 'anulado' then
    if v_request_ref is null then
      raise exception 'payroll: la anulación requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array['status','updated_at'])
       is distinct from
       (to_jsonb(new) - array['status','updated_at']) then
      raise exception 'payroll: la anulación no puede alterar el finiquito sellado'
        using errcode = '22023';
    end if;
  elsif old.status = 'confirmado' and new.status = 'confirmado' then
    -- Compatibilidad con el enlace del asiento creado por el flujo de
    -- confirmación existente. Ninguna cifra o snapshot puede cambiar.
    if (to_jsonb(old) - array['journal_entry_id','updated_at'])
       is distinct from
       (to_jsonb(new) - array['journal_entry_id','updated_at']) then
      raise exception 'payroll: el finiquito confirmado es inmutable'
        using errcode = '42501';
    end if;
  elsif old.status = 'anulado' then
    -- El soft-delete existente sigue permitido; la evidencia sustantiva no.
    if (to_jsonb(old) - array['deleted_at','updated_at'])
       is distinct from
       (to_jsonb(new) - array['deleted_at','updated_at']) then
      raise exception 'payroll: el finiquito anulado es inmutable'
        using errcode = '42501';
    end if;
  elsif old.status = 'borrador' and new.status = 'anulado'
        and v_request_ref is null then
    raise exception 'payroll: la anulación requiere el RPC gobernado'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

alter function public.guard_payroll_settlement_void() owner to postgres;
revoke all on function public.guard_payroll_settlement_void()
  from public, anon, authenticated, service_role;

create trigger guard_payroll_settlement_void_trg
before update on public.nomina_settlements
for each row execute function public.guard_payroll_settlement_void();

create function public.guard_payroll_settlement_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settlement_id uuid := case when tg_op = 'DELETE'
    then old.settlement_id else new.settlement_id end;
  v_status text;
begin
  select s.status into v_status
  from public.nomina_settlements s
  where s.id = v_settlement_id;

  if v_status is distinct from 'borrador' then
    raise exception 'payroll: los renglones de un finiquito sellado son inmutables'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.guard_payroll_settlement_lines() owner to postgres;
revoke all on function public.guard_payroll_settlement_lines()
  from public, anon, authenticated, service_role;

create trigger guard_payroll_settlement_lines_trg
before insert or update or delete on public.nomina_settlement_lines
for each row execute function public.guard_payroll_settlement_lines();

create function public.void_payroll_settlement_governed(
  p_settlement_id uuid,
  p_reason text,
  p_request_ref text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_settlement public.nomina_settlements%rowtype;
  v_journal public.journal_entries%rowtype;
  v_event_correlation text;
begin
  if v_actor is null then
    raise exception 'payroll: autenticación requerida' using errcode = '42501';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'payroll: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'payroll: referencia inválida' using errcode = '22023';
  end if;

  select ut.tenant_id into v_tenant
  from public.user_tenants ut
  where ut.user_id = v_actor
    and ut.role = 'admin'
    and ut.disabled_at is null
  limit 1;

  if v_tenant is null then
    raise exception 'payroll: permiso insuficiente' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('payroll-settlement-void:' || v_request_ref, 226)
  );

  select * into v_settlement
  from public.nomina_settlements s
  where s.id = p_settlement_id
    and s.tenant_id = v_tenant
    and s.deleted_at is null
  for update;

  if not found then
    raise exception 'payroll: finiquito no disponible' using errcode = 'P0002';
  end if;

  if v_settlement.status = 'anulado' then
    if exists (
      select 1
      from public.entity_audit_log l
      where l.tenant_id = v_tenant
        and l.entity_type = 'payroll_settlement'
        and l.entity_id = p_settlement_id
        and l.event_type = 'payroll_settlement_voided'
        and l.payload ->> 'request_ref' = v_request_ref
    ) then
      return 'replayed';
    end if;
    raise exception 'payroll: el finiquito ya fue anulado'
      using errcode = '40001';
  end if;

  if v_settlement.status not in ('borrador', 'confirmado') then
    raise exception 'payroll: transición inválida' using errcode = '22023';
  end if;

  if v_settlement.status = 'confirmado' and v_settlement.journal_entry_id is null then
    raise exception 'payroll: finiquito confirmado sin asiento vinculado'
      using errcode = '40001';
  end if;

  if v_settlement.journal_entry_id is not null then
    select * into v_journal
    from public.journal_entries j
    where j.id = v_settlement.journal_entry_id
      and j.tenant_id = v_tenant
      and j.deleted_at is null
    for update;

    if not found or v_journal.status <> 'asentado' then
      raise exception 'payroll: asiento no disponible para anulación'
        using errcode = '40001';
    end if;

    v_event_correlation := pg_catalog.concat(
      'd2:journal_entries:', v_journal.id::text, ':',
      pg_catalog.txid_current()::text
    );
  else
    v_event_correlation := pg_catalog.concat(
      'payroll_settlement:', v_settlement.id::text, ':',
      pg_catalog.txid_current()::text
    );
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.payroll_settlement_void', v_request_ref, true);

  if v_settlement.journal_entry_id is not null then
    update public.journal_entries
    set status = 'anulado'
    where id = v_settlement.journal_entry_id
      and tenant_id = v_tenant
      and status = 'asentado'
      and deleted_at is null;
    if not found then
      raise exception 'payroll: conflicto al anular el asiento'
        using errcode = '40001';
    end if;
  end if;

  update public.nomina_settlements
  set status = 'anulado'
  where id = v_settlement.id
    and tenant_id = v_tenant
    and status = v_settlement.status;
  if not found then
    raise exception 'payroll: conflicto al anular el finiquito'
      using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_tenant,
    'payroll_settlement',
    v_settlement.id,
    'user',
    v_actor,
    'payroll_settlement_voided',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_settlement.status,
      'journal_entry_id', v_settlement.journal_entry_id
    ),
    pg_catalog.jsonb_build_object(
      'status', 'anulado',
      'journal_entry_id', v_settlement.journal_entry_id
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'permanence', 'P3'
    ),
    v_event_correlation,
    1,
    'restricted'
  );

  return 'voided';
end;
$function$;

alter function public.void_payroll_settlement_governed(uuid,text,text)
  owner to postgres;
revoke all on function public.void_payroll_settlement_governed(uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.void_payroll_settlement_governed(uuid,text,text)
  to authenticated;

comment on function public.void_payroll_settlement_governed(uuid,text,text) is
  'SDD-0226: anula finiquito y asiento atómicamente; admin-only, motivo, actor, replay y auditoría obligatoria.';

do $postcondition$
begin
  if not pg_catalog.has_function_privilege(
    'authenticated',
    'public.void_payroll_settlement_governed(uuid,text,text)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.void_payroll_settlement_governed(uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception '0316: ACL inválida';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'void_payroll_settlement_governed',
        'guard_payroll_settlement_void',
        'guard_payroll_settlement_lines'
      )
      and p.proconfig @> array['search_path=""']
  ) <> 3 then
    raise exception '0316: funciones sin search_path vacío';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
