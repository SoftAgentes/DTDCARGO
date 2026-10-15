-- ─────────────────────────────────────────────────────────────────────────────
-- 0490 · SDD-0537 — El tarifario de transportistas queda auditado (AUD-01).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Fusionar la PR
--    NO autoriza aplicarla.
--    ORDEN: migrate-first compatible. El trigger audita igual las escrituras
--    del código desplegado hoy (saveTariffAction / deleteTariffAction de
--    SDD-0236, que la pantalla no llamaba) y las de la pantalla nueva de
--    SDD-0537. Ninguna de las dos lee nada que esta migración cree.
--
-- ── Por qué ─────────────────────────────────────────────────
-- AUD-01 §2 (docs/governance/policies/aud-01.md:27) exige evento para los
-- «cambios de permisos, roles, acceso, configuración sensible y credenciales»;
-- §1 (:15) exige que la mutación y su evento sean una sola operación, y §7
-- (:115-116) que cada flujo nuevo o modificado vuelva a pasar el contrato.
-- carrier_tariffs fija el precio de venta que cotiza la web pública
-- (public_carrier_tariffs, 0330) y el costo que DTD le paga al transportista.
-- Sus vecinas de la misma pantalla —calculator_settings y calculator_cities—
-- se auditan desde 0293 (0293:48-49 y :509-512) como dominio
-- `configuration`. carrier_tariffs nació después (0330) sin trigger: hasta hoy
-- la pantalla era de solo lectura y el hueco no se veía. SDD-0537 abre la
-- edición desde el Studio.
--
-- ── Qué hace ────────────────────────────────────────────────
-- 1. Registra el tipo de entidad `carrier_tariff` (dominio configuration).
-- 2. Crea audit_carrier_tariff_change(): trigger AFTER INSERT/UPDATE/DELETE
--    sobre carrier_tariffs que llama al writer AUD-01 real
--    (append_audit_event, 0294 → 0267) en la MISMA transacción. Si el writer
--    falla, la escritura del tarifario se revierte (AUD-01 §1 y §4).
--    · actor: auth.uid() del JWT (nunca del formulario); sin JWT, `system`.
--    · antes/después: costo, venta, ft³, mínimo, frecuencia, salidas,
--      tránsito, condiciones, vigencia, ciudad, transportista y si está viva.
--    · eventos: carrier_tariff_created / _updated / _deleted / _restored.
--      Quitar y restaurar llevan motivo fijo, como calculator_city_deleted.
--    · un UPDATE que no cambia nada de eso (p. ej. sólo updated_at) no escribe
--      evento.
-- No toca filas, no cambia la RLS de 0330 ni modifica
-- audit_d5_residual_change (0293): es una función propia, sin preflight de
-- cuerpo vivo.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE TRIGGER toma ShareRowExclusiveLock sobre carrier_tariffs hasta el
-- COMMIT: bloquea escrituras al tarifario, no lecturas (la web sigue
-- cotizando). El INSERT del catálogo toca una fila de audit_entity_types.
-- lock_timeout 5 s y statement_timeout 30 s de sesión, restaurados al final.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_col text;
  v_writer regprocedure := to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  );
begin
  if v_writer is null then
    raise exception '0490 requiere append_audit_event (0267/0294)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0490 requiere append_audit_event SECURITY DEFINER con search_path vacío';
  end if;

  if to_regclass('public.carrier_tariffs') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.tenants') is null then
    raise exception '0490 requiere carrier_tariffs (0330), audit_entity_types y tenants';
  end if;

  foreach v_col in array array[
    'id', 'tenant_id', 'carrier_id', 'city_slug', 'cost_usd_cbm',
    'price_usd_cbm', 'price_usd_ft3', 'min_charge_usd',
    'dispatch_frequency_days', 'departure_frequency', 'transit_days',
    'conditions', 'valid_from', 'valid_to', 'deleted_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'carrier_tariffs'
        and column_name = v_col
    ) then
      raise exception '0490 requiere public.carrier_tariffs.%', v_col;
    end if;
  end loop;

  if to_regprocedure('public.audit_carrier_tariff_change()') is not null then
    raise exception '0490 abortado: audit_carrier_tariff_change ya existe';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.carrier_tariffs'::regclass
      and tgname = 'audit_carrier_tariffs'
  ) then
    raise exception '0490 abortado: el trigger audit_carrier_tariffs ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values ('carrier_tariff', 'active', 'configuration', 1, 'migration:0490')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create function public.audit_carrier_tariff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else pg_catalog.to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_tenant_id uuid := (v_row->>'tenant_id')::uuid;
  v_entity_id uuid := (v_row->>'id')::uuid;
  v_actor_id uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_event_type text;
  v_reason text;
begin
  v_before := case when v_old is null then null else pg_catalog.jsonb_build_object(
    'carrier_id', v_old->'carrier_id',
    'city_slug', v_old->'city_slug',
    'cost_usd_cbm', v_old->'cost_usd_cbm',
    'price_usd_cbm', v_old->'price_usd_cbm',
    'price_usd_ft3', v_old->'price_usd_ft3',
    'min_charge_usd', v_old->'min_charge_usd',
    'dispatch_frequency_days', v_old->'dispatch_frequency_days',
    'departure_frequency', v_old->'departure_frequency',
    'transit_days', v_old->'transit_days',
    'conditions', v_old->'conditions',
    'valid_from', v_old->'valid_from',
    'valid_to', v_old->'valid_to',
    'active', pg_catalog.to_jsonb((v_old->>'deleted_at') is null)
  ) end;
  v_after := case when v_new is null then null else pg_catalog.jsonb_build_object(
    'carrier_id', v_new->'carrier_id',
    'city_slug', v_new->'city_slug',
    'cost_usd_cbm', v_new->'cost_usd_cbm',
    'price_usd_cbm', v_new->'price_usd_cbm',
    'price_usd_ft3', v_new->'price_usd_ft3',
    'min_charge_usd', v_new->'min_charge_usd',
    'dispatch_frequency_days', v_new->'dispatch_frequency_days',
    'departure_frequency', v_new->'departure_frequency',
    'transit_days', v_new->'transit_days',
    'conditions', v_new->'conditions',
    'valid_from', v_new->'valid_from',
    'valid_to', v_new->'valid_to',
    'active', pg_catalog.to_jsonb((v_new->>'deleted_at') is null)
  ) end;

  if tg_op = 'INSERT' then
    v_event_type := 'carrier_tariff_created';
  elsif tg_op = 'DELETE' then
    v_event_type := 'carrier_tariff_deleted';
    v_reason := 'Tarifa eliminada de la base, fuera del Studio.';
  elsif v_before = v_after then
    -- Nada de negocio cambió (p. ej. sólo updated_at): no hay evento.
    return new;
  elsif (v_before->>'active')::boolean and not (v_after->>'active')::boolean then
    v_event_type := 'carrier_tariff_deleted';
    v_reason := 'Ruta quitada del tarifario del transportista.';
  elsif not (v_before->>'active')::boolean and (v_after->>'active')::boolean then
    v_event_type := 'carrier_tariff_restored';
    v_reason := 'Ruta restaurada en el tarifario del transportista.';
  else
    v_event_type := 'carrier_tariff_updated';
  end if;

  perform public.append_audit_event(
    v_tenant_id,
    'carrier_tariff',
    v_entity_id,
    case when v_actor_id is null then 'system' else 'user' end,
    v_actor_id,
    v_event_type,
    'rpc',
    'succeeded',
    v_reason,
    v_before,
    v_after,
    '{}'::jsonb,
    pg_catalog.concat(
      'carrier-tariff:', v_entity_id::text, ':', pg_catalog.txid_current()::text
    ),
    1,
    'restricted'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.audit_carrier_tariff_change() owner to postgres;
revoke all on function public.audit_carrier_tariff_change() from public, anon, authenticated;

comment on function public.audit_carrier_tariff_change() is
  'SDD-0537 · AUD-01: evento carrier_tariff_* con antes/después y actor en la misma transacción que la escritura del tarifario. Si el writer falla, la escritura se revierte.';

create trigger audit_carrier_tariffs
  after insert or update or delete on public.carrier_tariffs
  for each row execute function public.audit_carrier_tariff_change();

do $postflight$
begin
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'carrier_tariff' and status = 'active'
  ) then
    raise exception '0490: falta el tipo de entidad carrier_tariff activo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.audit_carrier_tariff_change()')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0490: audit_carrier_tariff_change sin SECURITY DEFINER o sin search_path vacío';
  end if;
  if (
    select pg_catalog.count(*) from pg_catalog.pg_trigger
    where tgrelid = 'public.carrier_tariffs'::regclass
      and tgname = 'audit_carrier_tariffs'
      and not tgisinternal
      and tgenabled = 'O'
  ) <> 1 then
    raise exception '0490: falta el trigger audit_carrier_tariffs habilitado';
  end if;
  if has_function_privilege('authenticated', 'public.audit_carrier_tariff_change()', 'EXECUTE')
     or has_function_privilege('anon', 'public.audit_carrier_tariff_change()', 'EXECUTE') then
    raise exception '0490: audit_carrier_tariff_change quedó ejecutable por la API';
  end if;
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
