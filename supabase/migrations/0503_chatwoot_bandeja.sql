-- 0503 · SDD-0585 (E2, paso 2.2) · Bandeja de Chatwoot en Studio.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--
-- 1. Flag `chatwoot_inbox` (apagado): se agrega a `feature_flag_catalog()`
--    redefiniéndola desde su ÚLTIMA definición (0337) con una fila más, y se
--    siembra en los tenants existentes con ON CONFLICT DO NOTHING. El trigger de
--    tenant nuevo (0337) ya lee el catálogo: los nuevos nacen con la fila. Sin
--    fila, el interruptor del panel levanta invalid_state (la RPC 0289 hace UPDATE).
-- 2. `public.chatwoot_agent_links`: usuario de Studio ↔ agente de Chatwoot, uno a
--    uno dentro del tenant (E2-D10). Cada usuario lee su fila; el admin del tenant
--    lee, crea y borra las del tenant. No hay UPDATE: un vínculo se cambia
--    borrándolo y creándolo otra vez. El candado del correo (agente y usuario con
--    el mismo correo) lo hace la server action contra la Platform API; acá quedan
--    el tenant, el rol y `created_by = auth.uid()`.
--
-- Datos personales: solo ids (uuid de Studio, entero de Chatwoot). Sin correos,
-- nombres ni tokens.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.feature_flag_catalog()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regclass('public.feature_flags') is null
     or pg_catalog.to_regclass('public.tenants') is null then
    raise exception '0503 requiere feature_flag_catalog(), get_user_tenant_id(), is_tenant_admin(), auth.uid(), feature_flags y tenants';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_agent_links') is not null then
    raise exception '0503: public.chatwoot_agent_links ya existe; no se reaplica';
  end if;
  if exists (select 1 from public.feature_flag_catalog() c where c.key = 'chatwoot_inbox') then
    raise exception '0503: el catálogo ya tiene chatwoot_inbox; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Catálogo de flags: la definición de 0337 más chatwoot_inbox ──────────
create or replace function public.feature_flag_catalog()
returns table (key text, enabled boolean, description text)
language sql
immutable
set search_path = public, pg_catalog
as $$
  select *
  from (values
    ('customs_seniat',        false, 'Aduana SENIAT workflow'),
    ('cargo_insurance',       false, 'Seguro de carga'),
    ('hs_autodetect',         true,  'Auto-detección HS code'),
    ('cn_translation',        true,  'Traductor CN'),
    ('ai_copilot',            false, 'AI Copilot conversacional'),
    ('whatsapp',              true,  'Integración WhatsApp Business'),
    ('email_sequences',       false, 'Email sequences automáticas'),
    ('branding_xcliente',     true,  'Branding personalizado por cliente'),
    ('multi_currency',        true,  'Multi-moneda USD/VES/CNY'),
    ('vault',                 true,  'No-Olvidar (caja fuerte)'),
    ('audit_log',             true,  'Audit log con drill-down'),
    ('api_public',            false, 'API pública para terceros'),
    ('webhooks',              true,  'Webhooks salientes'),
    ('comments',              true,  'Comments con @menciones'),
    ('consolidation_partial', true,  'Consolidación parcial'),
    ('portal_cliente',        true,  'Portal del cliente externo'),
    ('mobile_operator',       false, 'App móvil operario CN/VE'),
    ('sustainability',        false, 'Reportes de sustentabilidad'),
    ('backup_auto',           true,  'Backup automático'),
    ('sso',                   false, 'Single Sign-On'),
    ('marketing_news',        false, 'Marketing · Generador de Noticias Web'),
    ('dispatch.show_warehouse_location', false,
     'Mostrar pasillo/zona/estante del paquete en bodeguero PWA. Activar solo cuando la bodega esté zoneada y los paquetes tengan warehouse_location populado.'),
    -- SDD-0585: la Bandeja de Chatwoot dentro de Studio. Apagada hasta que el
    -- token de la Platform App esté en el servidor y los agentes vinculados.
    ('chatwoot_inbox',        false, 'Bandeja de Chatwoot dentro de Studio')
  ) as t(key, enabled, description);
$$;

comment on function public.feature_flag_catalog() is
  'SDD-0240: catálogo canónico de feature flags (key, default, descripción). Fuente única del seed inicial y del trigger de tenant nuevo. Espejo en TS: lib/studio/feature-flags-types.ts (FEATURE_FLAG_DEFAULTS), verificado por feature-flags-catalog.test.ts. Última definición: 0503 (SDD-0585, chatwoot_inbox).';

revoke all on function public.feature_flag_catalog() from public;
revoke all on function public.feature_flag_catalog() from anon;
grant execute on function public.feature_flag_catalog() to service_role;

insert into public.feature_flags (tenant_id, key, enabled, description)
select t.id, c.key, c.enabled, c.description
from public.tenants t
cross join public.feature_flag_catalog() c
where c.key = 'chatwoot_inbox'
on conflict (tenant_id, key) do nothing;

-- ─── 2. Vínculo usuario de Studio ↔ agente de Chatwoot ───────────────────────
create table public.chatwoot_agent_links (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  chatwoot_user_id bigint not null check (chatwoot_user_id > 0 and chatwoot_user_id <= 2147483647),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (tenant_id, user_id),
  unique (tenant_id, chatwoot_user_id)
);

comment on table public.chatwoot_agent_links is
  'SDD-0585 E2-D10: usuario de Studio ↔ agente de Chatwoot (uno a uno por tenant). Lo crea un admin tras verificar por la Platform API que el agente tiene el mismo correo. El SSO de la Bandeja entra a Chatwoot como chatwoot_user_id: un vínculo equivocado es entrar como otra persona.';

alter table public.chatwoot_agent_links enable row level security;

create policy chatwoot_agent_links_select on public.chatwoot_agent_links
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (user_id = (select auth.uid()) or (select public.is_tenant_admin()))
  );

create policy chatwoot_agent_links_insert_admin on public.chatwoot_agent_links
  for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
    and created_by = (select auth.uid())
  );

create policy chatwoot_agent_links_delete_admin on public.chatwoot_agent_links
  for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
  );

create policy chatwoot_agent_links_service_role_all on public.chatwoot_agent_links
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_agent_links from public, anon, authenticated;
grant select, insert, delete on public.chatwoot_agent_links to authenticated;
grant all on public.chatwoot_agent_links to service_role;
