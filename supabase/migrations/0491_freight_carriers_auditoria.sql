-- ─────────────────────────────────────────────────────────────────────────────
-- 0491 · SDD-0539 — El registro de transportistas queda auditado (AUD-01).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Fusionar la PR
--    NO autoriza aplicarla.
--    ORDEN: migrate-first compatible. El trigger audita igual las escrituras
--    del código desplegado hoy (setDefaultCarrierAction desde la tarjeta de
--    Transportistas) y las del código de SDD-0539. Ninguno de los dos lee
--    nada que esta migración cree.
--
-- ── Por qué ─────────────────────────────────────────────────
-- freight_carriers.is_default decide qué transportista cotiza la web pública:
-- public_carrier_tariffs (0330:300) sólo devuelve las tarifas del
-- predeterminado. Cambiarlo es «configuración sensible» según AUD-01 §2
-- (docs/governance/policies/aud-01.md:27), y quitar o restaurar un
-- transportista son eventos obligatorios del mismo §2 (:25). §1 (:15) exige
-- que la mutación y su evento sean una sola operación, y §7 (:115-116) que
-- cada flujo nuevo o modificado vuelva a pasar el contrato. La 0490 auditó
-- carrier_tariffs; freight_carriers quedó sin trigger (handoff de SDD-0537,
-- FUERA DE ALCANCE 2).
--
-- ── Qué hace ────────────────────────────────────────────────
-- 1. Registra el tipo de entidad `freight_carrier` (dominio configuration).
-- 2. Crea audit_freight_carrier_change(): trigger AFTER INSERT/UPDATE/DELETE
--    sobre freight_carriers que llama al writer AUD-01 real
--    (append_audit_event, 0294 → 0267) en la MISMA transacción. Si el writer
--    falla, la escritura del registro se revierte (AUD-01 §1 y §4).
--    · actor: auth.uid() del JWT (nunca del formulario); sin JWT, `system`.
--    · antes/después: is_default, active, si está borrado y si tiene razón
--      social, RIF, contacto y notas. NO sus valores ni el nombre (AUD-01 §5:
--      el contacto de un proveedor es dato personal de alguien que no es
--      usuario, y la bitácora es de solo agregar desde 0267: una copia ahí no
--      se podría borrar). El entity_id identifica al transportista.
--    · payload.changed_fields: qué columnas cambiaron, sin valores.
--    · eventos: freight_carrier_created / _updated / _default_changed /
--      _deleted / _restored. Cambiar cuál cotiza la web, quitar y restaurar
--      llevan motivo fijo, como carrier_tariff_deleted en la 0490.
--    · un UPDATE que no cambia nada de eso (p. ej. sólo updated_at) no escribe
--      evento.
-- No toca filas, no cambia la RLS de 0330 ni modifica funciones existentes:
-- es una función propia, sin preflight de cuerpo vivo.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE TRIGGER toma ShareRowExclusiveLock sobre freight_carriers hasta el
-- COMMIT: bloquea escrituras al registro, no lecturas (la web sigue
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
    raise exception '0491 requiere append_audit_event (0267/0294)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0491 requiere append_audit_event SECURITY DEFINER con search_path vacío';
  end if;

  if to_regclass('public.freight_carriers') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.tenants') is null then
    raise exception '0491 requiere freight_carriers (0330), audit_entity_types y tenants';
  end if;

  foreach v_col in array array[
    'id', 'tenant_id', 'name', 'legal_name', 'tax_id', 'contact', 'notes',
    'is_default', 'active', 'deleted_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'freight_carriers'
        and column_name = v_col
    ) then
      raise exception '0491 requiere public.freight_carriers.%', v_col;
    end if;
  end loop;

  if to_regprocedure('public.audit_freight_carrier_change()') is not null then
    raise exception '0491 abortado: audit_freight_carrier_change ya existe';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.freight_carriers'::regclass
      and tgname = 'audit_freight_carriers'
  ) then
    raise exception '0491 abortado: el trigger audit_freight_carriers ya existe';
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
values ('freight_carrier', 'active', 'configuration', 1, 'migration:0491')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create function public.audit_freight_carrier_change()
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
  v_changed jsonb := '[]'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_event_type text;
  v_reason text;
begin
  -- Sólo banderas: los textos del proveedor no se copian a la bitácora.
  v_before := case when v_old is null then null else pg_catalog.jsonb_build_object(
    'is_default', v_old->'is_default',
    'active', v_old->'active',
    'deleted', pg_catalog.to_jsonb((v_old->>'deleted_at') is not null),
    'legal_name_present', pg_catalog.to_jsonb(nullif(v_old->>'legal_name', '') is not null),
    'tax_id_present', pg_catalog.to_jsonb(nullif(v_old->>'tax_id', '') is not null),
    'contact_present', pg_catalog.to_jsonb(nullif(v_old->>'contact', '') is not null),
    'notes_present', pg_catalog.to_jsonb(nullif(v_old->>'notes', '') is not null)
  ) end;
  v_after := case when v_new is null then null else pg_catalog.jsonb_build_object(
    'is_default', v_new->'is_default',
    'active', v_new->'active',
    'deleted', pg_catalog.to_jsonb((v_new->>'deleted_at') is not null),
    'legal_name_present', pg_catalog.to_jsonb(nullif(v_new->>'legal_name', '') is not null),
    'tax_id_present', pg_catalog.to_jsonb(nullif(v_new->>'tax_id', '') is not null),
    'contact_present', pg_catalog.to_jsonb(nullif(v_new->>'contact', '') is not null),
    'notes_present', pg_catalog.to_jsonb(nullif(v_new->>'notes', '') is not null)
  ) end;

  if tg_op = 'UPDATE' then
    select coalesce(pg_catalog.jsonb_agg(c.col order by c.col), '[]'::jsonb)
      into v_changed
      from pg_catalog.unnest(array[
        'name', 'legal_name', 'tax_id', 'contact', 'notes',
        'is_default', 'active', 'deleted_at'
      ]) as c(col)
     where v_old->c.col is distinct from v_new->c.col;
    -- Nada de negocio cambió (p. ej. sólo updated_at): no hay evento.
    if v_changed = '[]'::jsonb then
      return new;
    end if;
    v_payload := pg_catalog.jsonb_build_object('changed_fields', v_changed);
  end if;

  if tg_op = 'INSERT' then
    v_event_type := 'freight_carrier_created';
  elsif tg_op = 'DELETE' then
    v_event_type := 'freight_carrier_deleted';
    v_reason := 'Transportista eliminado de la base, fuera del Studio.';
  elsif not (v_before->>'deleted')::boolean and (v_after->>'deleted')::boolean then
    v_event_type := 'freight_carrier_deleted';
    v_reason := case when (v_before->>'is_default')::boolean
      then 'Transportista quitado del registro: deja de cotizar la web pública.'
      else 'Transportista quitado del registro.' end;
  elsif (v_before->>'deleted')::boolean and not (v_after->>'deleted')::boolean then
    v_event_type := 'freight_carrier_restored';
    v_reason := 'Transportista restaurado en el registro.';
  elsif v_before->'is_default' is distinct from v_after->'is_default' then
    v_event_type := 'freight_carrier_default_changed';
    v_reason := case when (v_after->>'is_default')::boolean
      then 'Pasa a ser el transportista que cotiza la web pública.'
      else 'Deja de ser el transportista que cotiza la web pública.' end;
  else
    v_event_type := 'freight_carrier_updated';
  end if;

  perform public.append_audit_event(
    v_tenant_id,
    'freight_carrier',
    v_entity_id,
    case when v_actor_id is null then 'system' else 'user' end,
    v_actor_id,
    v_event_type,
    'rpc',
    'succeeded',
    v_reason,
    v_before,
    v_after,
    v_payload,
    pg_catalog.concat(
      'freight-carrier:', v_entity_id::text, ':', pg_catalog.txid_current()::text
    ),
    1,
    'restricted'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.audit_freight_carrier_change() owner to postgres;
revoke all on function public.audit_freight_carrier_change() from public, anon, authenticated;

comment on function public.audit_freight_carrier_change() is
  'SDD-0539 · AUD-01: evento freight_carrier_* con banderas de antes/después, columnas cambiadas y actor en la misma transacción que la escritura del registro de transportistas. No copia nombre, razón social, RIF, contacto ni notas. Si el writer falla, la escritura se revierte.';

create trigger audit_freight_carriers
  after insert or update or delete on public.freight_carriers
  for each row execute function public.audit_freight_carrier_change();

do $postflight$
begin
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'freight_carrier' and status = 'active'
  ) then
    raise exception '0491: falta el tipo de entidad freight_carrier activo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.audit_freight_carrier_change()')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0491: audit_freight_carrier_change sin SECURITY DEFINER o sin search_path vacío';
  end if;
  if (
    select pg_catalog.count(*) from pg_catalog.pg_trigger
    where tgrelid = 'public.freight_carriers'::regclass
      and tgname = 'audit_freight_carriers'
      and not tgisinternal
      and tgenabled = 'O'
  ) <> 1 then
    raise exception '0491: falta el trigger audit_freight_carriers habilitado';
  end if;
  if has_function_privilege('authenticated', 'public.audit_freight_carrier_change()', 'EXECUTE')
     or has_function_privilege('anon', 'public.audit_freight_carrier_change()', 'EXECUTE') then
    raise exception '0491: audit_freight_carrier_change quedó ejecutable por la API';
  end if;
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
