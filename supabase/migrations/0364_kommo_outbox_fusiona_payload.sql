-- CRM · la cola deja de PISAR el payload y pasa a FUSIONARLO.
--
-- El bug: `enqueue_kommo_writeback` usa la clave `<leadId>:<op>` y al re-encolar
-- hace `payload = excluded.payload` — **reemplaza**. El comentario de la 0136 lo
-- llamaba "gana el último valor" sin ver la trampa: eso sólo es correcto cuando
-- las dos llamadas hablan del MISMO campo.
--
-- Escenario que rompe (el que planteó el founder): el ERP encola el Shipping Mark
--   → payload {custom_fields_values:[{field_id:1570535, …}]}
-- y DESPUÉS, antes de que el cron drene, encola el nombre
--   → payload {name:"Juan Pérez"}
-- El segundo pisa al primero y **el Shipping Mark nunca se escribe**. La fila sale
-- `sent`, sin error, sin rastro. Hoy no se manifiesta porque `patch_lead` sólo
-- lleva el Shipping Mark; explota apenas se agregue el nombre.
--
-- ⭐ La regla del founder que ordena esto: **el ERP da la orden**, así que el
-- payload describe CÓMO TIENE QUE QUEDAR el trato, no qué campo tocar. Fusionar
-- es lo que hace que esa regla se sostenga aunque las órdenes lleguen en dos
-- llamadas separadas.
--
-- Un `||` de jsonb solo no alcanza: es superficial, así que dos payloads que
-- traigan `custom_fields_values` se pisarían el ARRAY entero — el mismo bug con
-- otro disfraz, y más difícil de ver. Por eso ese campo se fusiona por `field_id`.
--
-- ⚠️ CUALQUIER clave de tipo ARRAY que se agregue después necesita el mismo trato.
-- La Fase 4 va a traer `tags_to_add` / `tags_to_delete`: si se encolan dos veces,
-- el `||` se queda con el último y se pierden etiquetas. No está resuelto acá a
-- propósito (esas ops todavía no existen), pero está avisado.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_writeback_outbox') is null then
    raise exception '0364 requiere public.kommo_writeback_outbox (migración 0136)';
  end if;
end;
$preflight$;

-- ── Fusión de custom_fields_values por campo ────────────────────────────────
--
-- Gana el valor NUEVO para el mismo campo; los campos que sólo están en el viejo
-- sobreviven. La clave es `field_id`, con `field_code` de respaldo (Kommo acepta
-- cualquiera de los dos). Una entrada sin ninguno de los dos no se puede
-- deduplicar: se conserva tal cual en vez de descartarla en silencio.
create or replace function public.kommo_merge_custom_fields(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with entradas as (
    select e as elem, 1 as prio, ord,
           coalesce(e->>'field_id', e->>'field_code', 'sinclave:1:' || ord) as clave
      from jsonb_array_elements(
             case when jsonb_typeof(p_old) = 'array' then p_old else '[]'::jsonb end
           ) with ordinality t(e, ord)
    union all
    select e, 2, ord,
           coalesce(e->>'field_id', e->>'field_code', 'sinclave:2:' || ord)
      from jsonb_array_elements(
             case when jsonb_typeof(p_new) = 'array' then p_new else '[]'::jsonb end
           ) with ordinality t(e, ord)
  ),
  ganadores as (
    select distinct on (clave) elem, prio, ord
      from entradas
     order by clave, prio desc, ord desc
  )
  select coalesce(jsonb_agg(elem order by prio, ord), '[]'::jsonb) from ganadores;
$$;

comment on function public.kommo_merge_custom_fields(jsonb, jsonb) is
  'CRM: fusiona dos arrays custom_fields_values por field_id (field_code de respaldo). '
  'Gana el NUEVO para el mismo campo; los que solo estan en el viejo sobreviven. '
  'Sin esto, dos encolados con custom_fields se pisan el array entero.';

-- ── Los dos enqueue pasan a fusionar ────────────────────────────────────────
create or replace function public.enqueue_kommo_writeback(
  p_tenant_id         uuid,
  p_kommo_lead_id     bigint,
  p_op                text,
  p_payload           jsonb,
  p_kommo_updated_at  timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_key text := p_kommo_lead_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key, kommo_updated_at_at_enqueue)
  values
    (p_tenant_id, p_kommo_lead_id, p_op, p_payload, v_key, p_kommo_updated_at)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set
    -- Fusión superficial (gana el nuevo por clave) + fusión PROFUNDA del array
    -- de custom fields cuando los dos lados lo traen.
    payload = (public.kommo_writeback_outbox.payload || excluded.payload)
              || case
                   when (public.kommo_writeback_outbox.payload ? 'custom_fields_values')
                    and (excluded.payload ? 'custom_fields_values')
                   then jsonb_build_object(
                          'custom_fields_values',
                          public.kommo_merge_custom_fields(
                            public.kommo_writeback_outbox.payload->'custom_fields_values',
                            excluded.payload->'custom_fields_values'))
                   else '{}'::jsonb
                 end,
    kommo_updated_at_at_enqueue = excluded.kommo_updated_at_at_enqueue,
    attempts = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.enqueue_kommo_contact_writeback(
  p_tenant_id        uuid,
  p_kommo_contact_id bigint,
  p_op               text,
  p_payload          jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_key text := 'c:' || p_kommo_contact_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_contact_id, op, payload, idempotency_key)
  values
    (p_tenant_id, p_kommo_contact_id, p_op, p_payload, v_key)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set
    payload = (public.kommo_writeback_outbox.payload || excluded.payload)
              || case
                   when (public.kommo_writeback_outbox.payload ? 'custom_fields_values')
                    and (excluded.payload ? 'custom_fields_values')
                   then jsonb_build_object(
                          'custom_fields_values',
                          public.kommo_merge_custom_fields(
                            public.kommo_writeback_outbox.payload->'custom_fields_values',
                            excluded.payload->'custom_fields_values'))
                   else '{}'::jsonb
                 end,
    attempts   = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Permisos: idénticos a los de la 0136 / 0344 (sólo el backend encola).
revoke execute on function public.kommo_merge_custom_fields(jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.kommo_merge_custom_fields(jsonb, jsonb) to service_role;
revoke execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) from public, anon, authenticated;
grant  execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) to service_role;
revoke execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb) from public, anon, authenticated;
grant  execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb) to service_role;
