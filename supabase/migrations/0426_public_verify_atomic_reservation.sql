-- SDD-0375: expansión local. Aplicar/verificar nominalmente antes del consumidor.
-- No modifica filas, ACL de tabla, índices, RLS ni retención de 0169.
-- INVOKER: service_role necesita sus permisos SELECT/INSERT previos.
do $migration$
declare
  v_body text := $body$
declare
  v_address inet;
  v_now timestamptz;
  v_count bigint;
begin
  -- Un snapshot fijo no ve necesariamente la reserva del anterior dueño del lock.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25000',
      message = 'public verify reservation requires read committed';
  end if;
  if p_ip is null or pg_catalog.length(p_ip) = 0 or pg_catalog.length(p_ip) > 64 then
    return false;
  end if;
  if p_ip <> 'unknown' then
    if p_ip !~ '^[0-9A-Fa-f:.]+$' then return false; end if;
    begin
      v_address := p_ip::pg_catalog.inet;
    exception when invalid_text_representation then
      return false;
    end;
    if pg_catalog.masklen(v_address) <>
       (case pg_catalog.family(v_address) when 4 then 32 else 128 end) then
      return false;
    end if;
  end if;

  -- El texto se conserva para no omitir intentos históricos por normalización.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public_verify_throttle:' || p_ip, 0)
  );
  v_now := pg_catalog.clock_timestamp();
  select count(*) into v_count
  from (
    select 1 from public.public_verify_throttle
    where ip = p_ip and created_at >= v_now - interval '30 minutes'
    limit 40
  ) as recent;
  if v_count >= 40 then return false; end if;
  insert into public.public_verify_throttle (ip, created_at) values (p_ip, v_now);
  if not found then
    raise exception using errcode = 'P0001',
      message = 'public verify reservation was not inserted';
  end if;
  return true;
end;
$body$;
  v_relation oid := pg_catalog.to_regclass('public.public_verify_throttle');
  v_existing record;
  v_columns text[];
begin
  perform pg_catalog.set_config('lock_timeout', '2s', true);
  if v_relation is null or not exists (
    select 1 from pg_catalog.pg_class
    where oid = v_relation and relkind = 'r' and relrowsecurity
  ) then
    raise exception '0426: missing table or RLS';
  end if;
  select array_agg(attname || ':' || pg_catalog.format_type(atttypid, atttypmod)
                   || ':' || attnotnull::text order by attnum)
  into v_columns from pg_catalog.pg_attribute
  where attrelid = v_relation and attnum > 0 and not attisdropped;
  if v_columns is distinct from array[
    'id:uuid:true', 'ip:text:true', 'created_at:timestamp with time zone:true'
  ] or exists (select 1 from pg_catalog.pg_policy where polrelid = v_relation)
    or exists (select 1 from pg_catalog.pg_trigger
               where tgrelid = v_relation and not tgisinternal)
    or not exists (select 1 from pg_catalog.pg_roles
                   where rolname = 'service_role' and rolbypassrls)
    or not exists (select 1 from pg_catalog.pg_constraint
                   where conrelid = v_relation and contype = 'p' and conkey = array[1]::smallint[])
    or not exists (
      select 1 from pg_catalog.pg_index
      where indrelid = v_relation and indisvalid and indisready
        and pg_catalog.pg_get_indexdef(indexrelid) =
          'CREATE INDEX public_verify_throttle_ip_created_idx ON public.public_verify_throttle USING btree (ip, created_at)'
    ) then
    raise exception '0426: incompatible throttle schema, policies, triggers or service role';
  end if;
  -- Sólo puede reemplazar su propia definición idéntica; no sobrescribe overloads.
  for v_existing in
    select * from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'reserve_public_verify_attempt'
  loop
    if v_existing.proargtypes <> '25'::oidvector or v_existing.prorettype <> 'boolean'::regtype
      or v_existing.proargnames is distinct from array['p_ip']::text[]
      or v_existing.prosrc is distinct from v_body or v_existing.prosecdef
      or v_existing.provolatile <> 'v' or v_existing.proisstrict or v_existing.proretset
      or v_existing.prokind <> 'f' or v_existing.proparallel <> 'u'
      or v_existing.proowner <> current_user::regrole
      or v_existing.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
      or v_existing.proconfig is distinct from array['search_path=""', 'lock_timeout=2s']::text[]
    then
      raise exception '0426: existing reservation function drift';
    end if;
  end loop;
  execute pg_catalog.format($ddl$
    create or replace function public.reserve_public_verify_attempt(p_ip text)
    returns boolean language plpgsql volatile security invoker
    set search_path = '' set lock_timeout = '2s'
    as %L
  $ddl$, v_body);
  revoke all on function public.reserve_public_verify_attempt(text) from public, anon, authenticated;
  grant execute on function public.reserve_public_verify_attempt(text) to service_role;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) as a
    where p.oid = 'public.reserve_public_verify_attempt(text)'::regprocedure
      and (a.grantee not in (p.proowner, 'service_role'::regrole) or a.is_grantable)
  ) then
    raise exception '0426: unexpected reservation privileges';
  end if;
  comment on function public.reserve_public_verify_attempt(text) is
    'SDD-0375: reserva 40/30min por clave IP textual; service_role INVOKER, READ COMMITTED. true sólo tras INSERT; sin purga ni normalización.';
end;
$migration$;
notify pgrst, 'reload schema';
