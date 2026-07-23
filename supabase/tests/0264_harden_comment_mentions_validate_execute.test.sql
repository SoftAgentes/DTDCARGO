\set ON_ERROR_STOP on

begin;

do $fixture_guard$
begin
  if to_regclass('public.comment_mentions') is not null
     or to_regclass('public.user_tenants') is not null
     or to_regprocedure('public.comment_mentions_validate()') is not null then
    raise exception 'Fixture 0264 rechazada: los objetos reales ya existen';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$fixture_guard$;

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.comment_mentions (
  id uuid primary key,
  tenant_id uuid not null,
  mentioned_user_id uuid not null
);

create or replace function public.comment_mentions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = new.mentioned_user_id
      and ut.tenant_id = new.tenant_id
      and ut.disabled_at is null
  ) then
    raise exception 'no se puede mencionar a un usuario fuera del tenant: %',
      new.mentioned_user_id
      using errcode = 'check_violation';
  end if;
  return new;
end
$function$;

create trigger comment_mentions_validate_trg
  before insert on public.comment_mentions
  for each row execute function public.comment_mentions_validate();

revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate()
  to authenticated, service_role;

grant insert on table public.comment_mentions to authenticated;

\ir ../migrations/0264_harden_comment_mentions_validate_execute.sql

insert into public.user_tenants (user_id, tenant_id)
values (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid
);

set local role authenticated;

insert into public.comment_mentions (id, tenant_id, mentioned_user_id)
values (
  '30000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid
);

reset role;

do $assertions$
begin
  if not exists (
    select 1
    from public.comment_mentions
    where id = '30000000-0000-0000-0000-000000000001'::uuid
  ) then
    raise exception
      'TEST 0264: el trigger no permitió el INSERT válido de authenticated';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.comment_mentions_validate()',
       'EXECUTE'
     ) then
    raise exception 'TEST 0264: permanece EXECUTE directo sobre el trigger function';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.comment_mentions'::regclass
      and tgname = 'comment_mentions_validate_trg'
      and tgfoid = 'public.comment_mentions_validate()'::regprocedure
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception 'TEST 0264: el trigger quedó ausente o desactivado';
  end if;
end
$assertions$;

rollback;

select
  to_regclass('public.comment_mentions') is null
  and to_regclass('public.user_tenants') is null
  and to_regprocedure('public.comment_mentions_validate()') is null
  as comment_mentions_validate_fixture_rolled_back;
