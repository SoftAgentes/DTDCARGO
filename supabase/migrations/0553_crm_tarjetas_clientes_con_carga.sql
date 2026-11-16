-- ─────────────────────────────────────────────────────────────────────────────
-- 0553 · SDD-0647 — Todos los clientes con carga tienen tarjeta en el CRM.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO
--    autoriza aplicarla. REQUIERE la 0506 (CRM propio).
--    El tablero funciona con o sin ella: sin la 0553, la pestaña Clientes
--    muestra solo a quien ya tiene tarjeta (escribió por Chatwoot o se
--    registró en la web).
--
-- POR QUÉ: Sam (2026-11-16) decidió que al pulsar «Clientes» salgan TODOS los
-- clientes con prueba de carga, aunque nunca hayan escrito. Hasta hoy una
-- tarjeta solo nacía por Chatwoot (0513) o por /registro.
--
-- QUÉ HACE:
-- 1. `crm_tarjetas.fuente` admite 'carga_erp' («cliente con carga en el ERP»).
--    Reemplaza el CHECK de la 0506 con la misma lista más ese valor.
-- 2. `crm_asegurar_tarjetas_clientes()`: crea la tarjeta que falta a cada ficha
--    viva y no fusionada del tenant de quien llama cuyo segmento es 'cliente'
--    según `crm_segmento_clientes` (0506: envío no borrado salvo borrador o
--    cancelado, o recibo de China no borrado y no huérfano, con cualquiera de
--    sus códigos). Solo inserta (tenant, ficha, fuente): sin nombre ni teléfono
--    (D6: esos datos viven en la ficha). Etapas por defecto: Clientes › Activo.
--    No toca tarjetas existentes. Idempotente: dos llamadas a la vez no
--    duplican (índice único crm_tarjetas_client_uq + on conflict do nothing).
--    La llama el tablero al cargar, con la sesión de quien mira; exige el
--    módulo CRM (`crm_puede_usar`). SECURITY DEFINER: crear la tarjeta no es
--    una edición de quien mira, es materializar la regla.
--
-- CASOS BORDE:
--   · Carga anulada (envío cancelado o borrado, recibo borrado o huérfano) o
--     solo cotización: no es cliente → no se crea tarjeta.
--   · Ficha fusionada en otra: la tarjeta se crea para la ficha que queda; la
--     carga con los códigos de la fusionada ya cuenta para ella (0506).
--   · Ficha borrada en suave: no se crea.
--   · Una persona con tarjeta SIN ficha (escribió y su teléfono no cruzó con
--     una única ficha) y una ficha con carga: quedan dos tarjetas hasta que
--     alguien ligue la tarjeta a la ficha. No se adivina.
--   · Un cliente que pierde su carga (se cancela su único envío) conserva la
--     tarjeta; el tablero lo pasa solo a Leads con código (segmento en vivo).
--
-- ⚠️ El ALTER TABLE toma ACCESS EXCLUSIVE breve sobre crm_tarjetas (valida el
--    CHECK nuevo sobre filas existentes; tabla pequeña); lock_timeout 5 s.
-- Desarme: supabase/desarmes/0553_desarme.sql.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.crm_tarjetas') is null
     or pg_catalog.to_regprocedure('public.crm_segmento_clientes(uuid,uuid[])') is null
     or pg_catalog.to_regprocedure('public.crm_puede_usar()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0553 requiere la 0506 (crm_tarjetas, crm_segmento_clientes, crm_puede_usar) y get_user_tenant_id()';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_tarjetas'::regclass
      and conname = 'crm_tarjetas_fuente_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%''manual''%'
  ) then
    raise exception '0553 requiere el CHECK crm_tarjetas_fuente_check de la 0506';
  end if;
  if pg_catalog.to_regprocedure('public.crm_asegurar_tarjetas_clientes()') is not null then
    raise exception '0553: crm_asegurar_tarjetas_clientes ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Fuente nueva ─────────────────────────────────────────────────────────
alter table public.crm_tarjetas drop constraint crm_tarjetas_fuente_check;
alter table public.crm_tarjetas add constraint crm_tarjetas_fuente_check check (fuente in (
  'whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo',
  'web_registro', 'portal', 'cotizador', 'kommo', 'manual', 'carga_erp'));

-- ─── 2. Tarjetas de los clientes con carga ───────────────────────────────────
create function public.crm_asegurar_tarjetas_clientes()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_tenant uuid := (select public.get_user_tenant_id());
  v_creadas integer;
begin
  if v_tenant is null or not coalesce((select public.crm_puede_usar()), false) then
    raise exception 'crm_asegurar_tarjetas_clientes: sin acceso al CRM' using errcode = '42501';
  end if;

  insert into public.crm_tarjetas (tenant_id, client_id, fuente)
  select v_tenant, s.client_id, 'carga_erp'
  from public.crm_segmento_clientes(
    v_tenant,
    array(
      select c.id
      from public.clients c
      where c.tenant_id = v_tenant
        and c.deleted_at is null
        and c.merged_into_client_id is null
        and not exists (
          select 1 from public.crm_tarjetas t
          where t.tenant_id = v_tenant and t.client_id = c.id
        )
    )
  ) s
  where s.segmento = 'cliente'
  on conflict (tenant_id, client_id) where client_id is not null do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$fn$;

comment on function public.crm_asegurar_tarjetas_clientes() is
  'SDD-0647: crea la tarjeta que falta a cada ficha viva y no fusionada del tenant de quien llama con segmento cliente (prueba de carga, 0506). Solo tenant, ficha y fuente carga_erp; idempotente. Exige el módulo CRM. Devuelve cuántas creó.';

revoke all on function public.crm_asegurar_tarjetas_clientes() from public;
revoke all on function public.crm_asegurar_tarjetas_clientes() from anon;
grant execute on function public.crm_asegurar_tarjetas_clientes() to authenticated;
