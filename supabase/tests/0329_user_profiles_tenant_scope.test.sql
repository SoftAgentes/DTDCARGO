\set ON_ERROR_STOP on
begin;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.user_profiles(user_id uuid primary key, display_name text);
create table public.user_tenants(user_id uuid, tenant_id uuid, disabled_at timestamptz);
alter table public.user_profiles enable row level security;
grant select on public.user_profiles to authenticated;
grant select on public.user_tenants to authenticated;
create policy "user_profiles_all_select" on public.user_profiles for select to authenticated using(true);
\ir ../migrations/0329_user_profiles_tenant_scope.sql

insert into public.user_profiles values
 ('11111111-1111-4111-8111-111111111111','caller'),
 ('22222222-2222-4222-8222-222222222222','same'),
 ('33333333-3333-4333-8333-333333333333','other');
insert into public.user_tenants values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
select set_config('test.uid','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ declare n integer; begin
  select count(*) into n from public.user_profiles;
  if n <> 2 then raise exception '0329: esperaba propia + tenant compartido, obtuvo %',n; end if;
end $$;
reset role;
rollback;
