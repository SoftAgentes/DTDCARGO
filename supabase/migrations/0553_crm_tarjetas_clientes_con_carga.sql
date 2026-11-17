-- ─────────────────────────────────────────────────────────────────────────────
-- 0553 · SDD-0647 — Todos los clientes con carga tienen tarjeta en el CRM.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO
--    autoriza aplicarla. REQUIERE la 0506 (CRM propio) y clients.advisor_id (0151).
--    ESCRIBE FILAS al aplicarse: el alta inicial (§3) crea tarjetas.
--
-- POR QUÉ: Sam (2026-11-16) decidió que al pulsar «Clientes» salgan TODOS los
-- clientes con prueba de carga, aunque nunca hayan escrito. Hasta hoy una
-- tarjeta solo nacía por Chatwoot (0513) o por /registro. La vista del
-- tablero NO escribe: las tarjetas se crean aquí, una vez, al aplicar
-- (revisión del DG, 2026-11-16).
--
-- QUÉ HACE:
-- 1. `crm_tarjetas.fuente` admite 'carga_erp' («cliente con carga en el ERP»).
--    Reemplaza el CHECK de la 0506 con la misma lista más ese valor.
-- 2. `crm_alta_tarjetas_clientes(tenant)`: interna, solo service_role. Crea la
--    tarjeta que falta a cada ficha viva y no fusionada del tenant cuyo
--    segmento es 'cliente' según `crm_segmento_clientes` (0506: envío no
--    borrado salvo borrador o cancelado, o recibo de China no borrado y no
--    huérfano, con cualquiera de sus códigos). Inserta tenant, ficha, fuente,
--    el asesor de la ficha (solo si sigue activo en el tenant, como la 0513) y
--    `ultima_actividad_at` = 2000-01-01: la tarjeta no aparenta actividad
--    reciente ni le quita lugar a un lead real en el tope del tablero (2000
--    tarjetas por actividad). Sin nombre ni teléfono (D6). Etapa por defecto:
--    Clientes › Activo. No toca tarjetas existentes. Idempotente (índice único
--    crm_tarjetas_client_uq + on conflict do nothing). Devuelve cuántas creó.
-- 3. Alta inicial: corre la función UNA vez por cada tenant, aquí mismo.
--
-- Las fichas que ganen carga DESPUÉS de aplicar no reciben tarjeta sola: si
-- hace falta, se llama a la función desde una acción con crm_puede_editar() o
-- un proceso de servicio, nunca al pintar el tablero (SDD-0647 §7).
--
-- CASOS BORDE:
--   · Carga anulada (envío cancelado o borrado, recibo borrado o huérfano) o
--     solo cotización: no es cliente → no se crea tarjeta.
--   · Ficha fusionada en otra (merged_into_client_id no nulo), viva o borrada:
--     no recibe tarjeta; su carga cuenta para la ficha que queda (0506).
--   · Ficha borrada en suave: no se crea.
--   · Asesor desactivado o de otro tenant: la tarjeta nace sin asesor.
--   · Una persona con tarjeta SIN ficha (escribió y su teléfono no cruzó con
--     una única ficha) y una ficha con carga: quedan dos tarjetas hasta que
--     alguien ligue la tarjeta a la ficha. No se adivina.
--   · Un cliente que pierde su carga conserva la tarjeta; el tablero lo pasa
--     solo a Leads con código (segmento en vivo).
--
-- ⚠️ El ALTER TABLE toma ACCESS EXCLUSIVE breve sobre crm_tarjetas (valida el
--    CHECK nuevo sobre filas existentes; tabla pequeña) y el alta inserta en la
--    misma transacción; lock_timeout 5 s, statement_timeout 60 s.
-- Desarme: supabase/desarmes/0553_desarme.sql.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.crm_tarjetas') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regprocedure('public.crm_segmento_clientes(uuid,uuid[])') is null then
    raise exception '0553 requiere la 0506 (crm_tarjetas, crm_segmento_clientes) y user_tenants';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.clients'::regclass and attname = 'advisor_id' and not attisdropped
  ) then
    raise exception '0553 requiere clients.advisor_id (0151)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_tarjetas'::regclass
      and conname = 'crm_tarjetas_fuente_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%''manual''%'
  ) then
    raise exception '0553 requiere el CHECK crm_tarjetas_fuente_check de la 0506';
  end if;
  if pg_catalog.to_regprocedure('public.crm_alta_tarjetas_clientes(uuid)') is not null then
    raise exception '0553: crm_alta_tarjetas_clientes ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Fuente nueva ─────────────────────────────────────────────────────────
alter table public.crm_tarjetas drop constraint crm_tarjetas_fuente_check;
alter table public.crm_tarjetas add constraint crm_tarjetas_fuente_check check (fuente in (
  'whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo',
  'web_registro', 'portal', 'cotizador', 'kommo', 'manual', 'carga_erp'));

-- ─── 2. Tarjetas de los clientes con carga ───────────────────────────────────
create function public.crm_alta_tarjetas_clientes(p_tenant_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_creadas integer;
begin
  if p_tenant_id is null then
    raise exception 'crm_alta_tarjetas_clientes: el tenant es obligatorio' using errcode = '22023';
  end if;

  insert into public.crm_tarjetas (tenant_id, client_id, fuente, asesor_id, ultima_actividad_at)
  select p_tenant_id, s.client_id, 'carga_erp', ut.user_id, timestamptz '2000-01-01 00:00:00+00'
  from public.crm_segmento_clientes(
    p_tenant_id,
    array(
      select c.id
      from public.clients c
      where c.tenant_id = p_tenant_id
        and c.deleted_at is null
        and c.merged_into_client_id is null
        and not exists (
          select 1 from public.crm_tarjetas t
          where t.tenant_id = p_tenant_id and t.client_id = c.id
        )
    )
  ) s
  join public.clients c on c.id = s.client_id
  left join public.user_tenants ut
    on ut.user_id = c.advisor_id
   and ut.tenant_id = p_tenant_id
   and ut.disabled_at is null
  where s.segmento = 'cliente'
  on conflict (tenant_id, client_id) where client_id is not null do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$fn$;

comment on function public.crm_alta_tarjetas_clientes(uuid) is
  'SDD-0647: crea la tarjeta que falta a cada ficha viva y no fusionada del tenant con segmento cliente (prueba de carga, 0506). Tenant, ficha, fuente carga_erp, asesor activo de la ficha y actividad 2000-01-01; idempotente. Solo service_role. Devuelve cuántas creó.';

revoke all on function public.crm_alta_tarjetas_clientes(uuid) from public;
revoke all on function public.crm_alta_tarjetas_clientes(uuid) from anon, authenticated;
grant execute on function public.crm_alta_tarjetas_clientes(uuid) to service_role;

-- ─── 3. Alta inicial (una vez, al aplicar) ───────────────────────────────────
do $alta$
declare
  v_tenant uuid;
  v_total integer := 0;
begin
  for v_tenant in select t.id from public.tenants t order by t.id loop
    v_total := v_total + public.crm_alta_tarjetas_clientes(v_tenant);
  end loop;
  raise notice '0553: alta inicial, % tarjeta(s) creada(s)', v_total;
end;
$alta$;
