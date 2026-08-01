-- SDD-0235 · PIN móvil ligado a tenant/región y throttle sin IP cruda.
set lock_timeout = '5s';
set statement_timeout = '30s';

create table if not exists public.operario_pin_attempts (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region public.operario_region not null,
  attempt_key text not null check (attempt_key ~ '^[0-9a-f]{64}$'),
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists operario_pin_attempts_window_idx
  on public.operario_pin_attempts (tenant_id, region, attempt_key, created_at desc)
  where succeeded = false;

alter table public.operario_pin_attempts enable row level security;
revoke all on table public.operario_pin_attempts from public, anon, authenticated;
grant select, insert, delete on table public.operario_pin_attempts to service_role;
grant usage, select on sequence public.operario_pin_attempts_id_seq to service_role;

drop function if exists public.verify_operario_pin(text);
drop function if exists public.verify_operario_pin(text, uuid, public.operario_region, text);

create function public.verify_operario_pin(
  p_pin text,
  p_tenant_id uuid,
  p_region public.operario_region,
  p_attempt_key text
)
returns table (
  operario_id uuid,
  tenant_id uuid,
  warehouse_id uuid,
  display_name text,
  display_name_cn text,
  role text,
  roles text[],
  region public.operario_region,
  tms_driver_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_matches integer;
  v_recent_failures integer;
begin
  if p_tenant_id is null
     or p_region is null
     or p_attempt_key is null
     or p_attempt_key !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select count(*) into v_recent_failures
  from public.operario_pin_attempts a
  where a.tenant_id = p_tenant_id
    and a.region = p_region
    and a.attempt_key = p_attempt_key
    and a.succeeded = false
    and a.created_at >= now() - interval '15 minutes';
  if v_recent_failures >= 10 then return; end if;

  if p_pin is null or p_pin !~ '^\d{4}$' then
    insert into public.operario_pin_attempts(tenant_id, region, attempt_key, succeeded)
    values (p_tenant_id, p_region, p_attempt_key, false);
    return;
  end if;

  select count(*) into v_matches
  from public.operario_pins op
  where op.tenant_id = p_tenant_id
    and op.region = p_region
    and op.active = true
    and op.pin_hash = extensions.crypt(p_pin, op.pin_hash);

  insert into public.operario_pin_attempts(tenant_id, region, attempt_key, succeeded)
  values (p_tenant_id, p_region, p_attempt_key, v_matches = 1);
  if v_matches <> 1 then return; end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.tenant_id = p_tenant_id
     and op.region = p_region
     and op.active = true
     and op.pin_hash = extensions.crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id, op.display_name,
            op.display_name_cn, op.role, op.roles, op.region, op.tms_driver_id;
end;
$function$;

revoke all on function public.verify_operario_pin(text, uuid, public.operario_region, text)
  from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text, uuid, public.operario_region, text)
  to service_role;

comment on function public.verify_operario_pin(text, uuid, public.operario_region, text) is
  'SDD-0235: PIN server-only ligado a tenant y región, con throttle por huella SHA-256 del origen.';
