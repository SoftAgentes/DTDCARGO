-- SDD-0534 · writer AUD-01 REAL para los contratos que lo necesitan.
--
-- No es un contrato: los `*.test.sql` lo incluyen con `\ir _audit-writer-real.sql`
-- dentro de su transacción. Monta la plataforma mínima que el preflight de 0267
-- exige (el preludio del contrato 0482 de la SDD-0532) y después las
-- migraciones reales 0267 y 0294: `append_audit_event` es el wrapper de 0294 y
-- `append_audit_event_v1` el cuerpo de 0267, con su regex de correlation_id de
-- 128 caracteres y el CHECK entity_audit_log_correlation_id_check.
--
-- Los contratos de 0317–0324 simulan el writer sin validar el correlation_id;
-- por eso no vieron que la referencia de cada pantalla lo pasa de 128. Quien
-- incluya este archivo NO define su propio append_audit_event, tenants,
-- audit_entity_types ni entity_audit_log.

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.audit_entity_types') is not null
     or to_regclass('public.tenants') is not null then
    raise exception 'Writer real rechazado: los objetos reales ya existen';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- ── Plataforma previa a 0267: lo que su preflight exige ─────────────────────
create table public.tenants (id uuid primary key);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type) references public.audit_entity_types(entity_type)
    on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system'))
);

alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log
  for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log
  for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql
