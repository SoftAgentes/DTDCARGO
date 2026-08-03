-- ─────────────────────────────────────────────────────────────
-- 0337 · Feature flags: catálogo único + siembra por tenant nuevo
--
-- PROBLEMA (dos, del mismo origen)
--
-- 1. `marketing_news` nunca se sembró. Se agregó al catálogo del CÓDIGO
--    (lib/studio/feature-flags-types.ts) sin migración que lo insertara.
--    La RPC de toggle (0289, rama 'feature_flag.toggle') hace UPDATE
--    sobre una fila que TIENE que existir: si no está, levanta
--    invalid_state (P0002). Resultado: el interruptor de Noticias Web
--    fallaba siempre, y como el UI descartaba el mensaje de error, fallaba
--    EN SILENCIO. El módulo /studio/marketing/noticias-web quedó
--    inalcanzable — su page.tsx exige el flag encendido y no había forma
--    de encenderlo desde la app.
--
-- 2. Nadie siembra los flags de un tenant NUEVO. Tanto 0042 como 0066
--    siembran con un bloque DO de una sola pasada sobre los tenants que
--    existían ese día. No hay trigger. Un tenant creado después nace con
--    CERO filas en feature_flags: el sidebar sobrevive porque
--    listFeatureFlags() cae a FEATURE_FLAG_DEFAULTS, pero TODOS los
--    toggles del panel de admin levantan invalid_state. El panel entero
--    está muerto para cualquier tenant creado después del 2026-05-27 —
--    justo el caso de los aliados white-label.
--
-- SOLUCIÓN
--
-- Una función-catálogo (`feature_flag_catalog()`) como fuente única, un
-- seed idempotente que rellena lo faltante en los tenants existentes, y un
-- trigger AFTER INSERT ON tenants para que el problema 2 no vuelva.
--
-- El catálogo vive en SQL a propósito: el de TypeScript no puede sembrar
-- filas. `feature-flags-catalog.test.ts` compara los dos y se pone rojo si
-- divergen, que es exactamente como nació el bug de `marketing_news`.
--
-- NO CAMBIA NINGÚN VALOR YA ELEGIDO: el insert es ON CONFLICT DO NOTHING.
-- Un flag que el admin apagó a mano sigue apagado.
-- ─────────────────────────────────────────────────────────────

-- ─── Catálogo (fuente única para seed + trigger) ──────────────
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
    -- El que faltaba. Default OFF: prende cuando las migraciones de
    -- noticias (seo_drafts, news_writers, news_posts) estén en prod.
    ('marketing_news',        false, 'Marketing · Generador de Noticias Web'),
    -- Sembrado por 0066 para los tenants de entonces; va al catálogo para
    -- que los nuevos también lo tengan y el panel pueda tocarlo.
    ('dispatch.show_warehouse_location', false,
     'Mostrar pasillo/zona/estante del paquete en bodeguero PWA. Activar solo cuando la bodega esté zoneada y los paquetes tengan warehouse_location populado.')
  ) as t(key, enabled, description);
$$;

comment on function public.feature_flag_catalog() is
  'SDD-0240: catálogo canónico de feature flags (key, default, descripción). Fuente única del seed inicial y del trigger de tenant nuevo. Espejo en TS: lib/studio/feature-flags-types.ts (FEATURE_FLAG_DEFAULTS), verificado por feature-flags-catalog.test.ts.';

revoke all on function public.feature_flag_catalog() from public;
revoke all on function public.feature_flag_catalog() from anon;
grant execute on function public.feature_flag_catalog() to service_role;

-- ─── Siembra: rellena lo que falte en los tenants existentes ──
-- Idempotente y no destructivo: sólo INSERT de las keys ausentes.
insert into public.feature_flags (tenant_id, key, enabled, description)
select t.id, c.key, c.enabled, c.description
from public.tenants t
cross join public.feature_flag_catalog() c
on conflict (tenant_id, key) do nothing;

-- ─── Trigger: todo tenant nuevo nace con su juego completo ────
create or replace function public.seed_feature_flags_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.feature_flags (tenant_id, key, enabled, description)
  select new.id, c.key, c.enabled, c.description
  from public.feature_flag_catalog() c
  on conflict (tenant_id, key) do nothing;
  return new;
end;
$$;

comment on function public.seed_feature_flags_for_tenant() is
  'SDD-0240: siembra el catálogo completo de feature flags al crear un tenant. Sin esto el tenant nace sin filas y TODOS los toggles del panel de admin levantan invalid_state (la RPC 0289 hace UPDATE, no UPSERT).';

revoke all on function public.seed_feature_flags_for_tenant() from public;
revoke all on function public.seed_feature_flags_for_tenant() from anon;
revoke all on function public.seed_feature_flags_for_tenant() from authenticated;

drop trigger if exists trg_seed_feature_flags_for_tenant on public.tenants;
create trigger trg_seed_feature_flags_for_tenant
  after insert on public.tenants
  for each row
  execute function public.seed_feature_flags_for_tenant();
