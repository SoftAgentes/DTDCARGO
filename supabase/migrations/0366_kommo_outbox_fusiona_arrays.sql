-- 0366_kommo_outbox_fusiona_arrays.sql
--
-- CRM · SDD-0256 — la cola deja de PISAR las etiquetas, y deja de poder pisar
-- en silencio cualquier array que se agregue mañana.
--
-- ── El aviso que se cumplió ──────────────────────────────────────────────────
-- La 0364 (líneas 25-28) lo dejó escrito textual:
--
--   «⚠️ CUALQUIER clave de tipo ARRAY que se agregue después necesita el mismo
--    trato. La Fase 4 va a traer `tags_to_add` / `tags_to_delete`: si se encolan
--    dos veces, el `||` se queda con el último y se pierden etiquetas. No está
--    resuelto acá a propósito (esas ops todavía no existen), pero está avisado.»
--
-- Ya existen: la 0365 (línea 57) metió `patch_tags` en el CHECK. La condición
-- que activaba el aviso se cumplió y nadie volvió a la 0364. Esta migración es
-- esa vuelta, y se aplica ANTES de cablear la UI de etiquetas — al revés, dos
-- clics seguidos sobre el mismo lead descartarían el primer set, la fila saldría
-- `sent`, sin error y sin rastro.
--
-- ── Qué se arregla ───────────────────────────────────────────────────────────
-- 1. `tags_to_add` / `tags_to_delete` se fusionan de verdad. Son INSTRUCCIONES
--    incrementales, no estado: dos encolados tienen que sumar, no reemplazar.
-- 2. Y el hueco de fondo: en vez de dejar otro comentario para el próximo array,
--    la fusión ahora **falla ruidosamente** ante una clave array que los dos
--    payloads traigan y que no tenga estrategia declarada. Perder datos en
--    silencio es peor que no encolar: el encolador es best-effort y el error
--    llega a la pantalla como "no se pudo encolar", que es visible y reversible.
--
-- ── La regla de fusión de etiquetas ─────────────────────────────────────────
-- Gana el encolado NUEVO para la etiqueta que menciona; la que sólo aparece en
-- el viejo sobrevive en su lista original. Es la misma semántica que ya usa
-- `kommo_merge_custom_fields` para los campos ("gana el nuevo por clave, el
-- viejo-solo sobrevive"), aplicada a un par de listas:
--
--   add_final = (add_viejo − del_nuevo) ∪ add_nuevo
--   del_final = (del_viejo − add_nuevo) ∪ del_nuevo
--
-- Ejemplo que muestra por qué NO se puede usar "quitar siempre gana": encolar
-- quitar "VIP" y después agregar "VIP" tiene que terminar agregando — la orden
-- más nueva es la que vale. "Quitar gana" sólo aplica DENTRO de un mismo
-- payload, donde no hay orden temporal; ahí se replica la regla que ya aplica
-- `buildTagsPatchPayload` en lib/studio/kommo-writeback.ts ("la intención más
-- destructiva es la explícita").
--
-- Deduplicación: por `id` si la etiqueta lo trae, si no por `name` normalizado
-- (sin espacios de borde, sin distinguir mayúsculas) — el mismo criterio del
-- helper de TypeScript. Una entrada sin `id` ni `name` no se puede deduplicar:
-- se conserva tal cual en vez de descartarla en silencio (igual que hace la
-- 0364 con las entradas sin `field_id`).

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_writeback_outbox') is null then
    raise exception '0366 requiere public.kommo_writeback_outbox (migración 0136)';
  end if;
  if to_regprocedure('public.kommo_merge_custom_fields(jsonb, jsonb)') is null then
    raise exception '0366 requiere public.kommo_merge_custom_fields (migración 0364)';
  end if;
end;
$preflight$;

-- ── Fusión del par de listas de etiquetas ───────────────────────────────────
--
-- Devuelve un objeto con `tags_to_add` / `tags_to_delete`; omite la lista que
-- quede vacía, para no mandarle a Kommo un array vacío que no significa nada.
create or replace function public.kommo_merge_tag_lists(
  p_old_add jsonb,
  p_old_del jsonb,
  p_new_add jsonb,
  p_new_del jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with entradas as (
    select 'add'::text as lista, 1 as prio, ord, e as elem,
           coalesce(
             nullif(lower(btrim(e->>'name')), ''),
             'id:' || (e->>'id'),
             'sinclave:1:add:' || ord
           ) as clave
      from jsonb_array_elements(
             case when jsonb_typeof(p_old_add) = 'array' then p_old_add else '[]'::jsonb end
           ) with ordinality t(e, ord)
    union all
    select 'del', 1, ord, e,
           coalesce(
             nullif(lower(btrim(e->>'name')), ''),
             'id:' || (e->>'id'),
             'sinclave:1:del:' || ord
           )
      from jsonb_array_elements(
             case when jsonb_typeof(p_old_del) = 'array' then p_old_del else '[]'::jsonb end
           ) with ordinality t(e, ord)
    union all
    select 'add', 2, ord, e,
           coalesce(
             nullif(lower(btrim(e->>'name')), ''),
             'id:' || (e->>'id'),
             'sinclave:2:add:' || ord
           )
      from jsonb_array_elements(
             case when jsonb_typeof(p_new_add) = 'array' then p_new_add else '[]'::jsonb end
           ) with ordinality t(e, ord)
    union all
    select 'del', 2, ord, e,
           coalesce(
             nullif(lower(btrim(e->>'name')), ''),
             'id:' || (e->>'id'),
             'sinclave:2:del:' || ord
           )
      from jsonb_array_elements(
             case when jsonb_typeof(p_new_del) = 'array' then p_new_del else '[]'::jsonb end
           ) with ordinality t(e, ord)
  ),
  -- Una etiqueta cae en UNA sola lista: gana la generación más nueva y, dentro
  -- de la misma generación, gana quitar (no hay orden temporal que desempate).
  ganadores as (
    select distinct on (clave) lista, elem, prio, ord
      from entradas
     order by clave, prio desc, (lista = 'del') desc, ord desc
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'tags_to_add',
      (select jsonb_agg(elem order by prio, ord) from ganadores where lista = 'add'),
    'tags_to_delete',
      (select jsonb_agg(elem order by prio, ord) from ganadores where lista = 'del')
  ));
$$;

comment on function public.kommo_merge_tag_lists(jsonb, jsonb, jsonb, jsonb) is
  'CRM: fusiona dos ordenes de etiquetado. tags_to_add/tags_to_delete son '
  'INSTRUCCIONES incrementales: dos encolados suman. Gana el encolado nuevo para '
  'la etiqueta que menciona; dentro del mismo payload gana quitar. Dedup por id, '
  'si no por name normalizado.';

-- ── Fusión del payload completo, con guarda para lo desconocido ─────────────
create or replace function public.kommo_merge_payload(p_old jsonb, p_new jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_out          jsonb;
  v_clave        text;
  v_sin_estrategia text[] := '{}';
begin
  -- Sin dos objetos que fusionar no hay nada que decidir.
  if p_old is null or jsonb_typeof(p_old) <> 'object' then return p_new; end if;
  if p_new is null or jsonb_typeof(p_new) <> 'object' then return p_old; end if;

  -- LA GUARDA. Una clave de tipo array presente en los DOS lados y sin
  -- estrategia declarada se pisaría entera con `||`. En vez de dejar otro
  -- comentario que el próximo no va a leer, se corta acá.
  for v_clave in select k from jsonb_object_keys(p_new) k loop
    if jsonb_typeof(p_new -> v_clave) = 'array'
       and (p_old ? v_clave)
       and jsonb_typeof(p_old -> v_clave) = 'array'
       and v_clave not in ('custom_fields_values', 'tags_to_add', 'tags_to_delete')
    then
      v_sin_estrategia := v_sin_estrategia || v_clave;
    end if;
  end loop;

  if array_length(v_sin_estrategia, 1) is not null then
    raise exception
      'kommo_merge_payload: clave(s) de tipo array sin estrategia de fusion: %',
      array_to_string(v_sin_estrategia, ', ')
      using hint =
        'Declara como se fusiona esa clave dentro de kommo_merge_payload antes de '
        'encolarla dos veces. Con `||` el contenido del primer encolado se pierde '
        'en silencio y la fila sale sent, sin error.';
  end if;

  -- Superficial: gana el nuevo por clave.
  v_out := p_old || p_new;

  -- Profunda: los campos propios, por field_id (la 0364).
  if (p_old ? 'custom_fields_values') and (p_new ? 'custom_fields_values') then
    v_out := v_out || jsonb_build_object(
      'custom_fields_values',
      public.kommo_merge_custom_fields(
        p_old->'custom_fields_values',
        p_new->'custom_fields_values'));
  end if;

  -- Profunda: el PAR de listas de etiquetas, junto. Se quitan las dos primero
  -- porque la fusión puede legítimamente dejar una sin contenido: encolar
  -- agregar "VIP" y después quitar "VIP" tiene que terminar SOLO con la lista
  -- de quitar, sin un `tags_to_add` residual del `||` superficial.
  if (p_old ? 'tags_to_add' or p_old ? 'tags_to_delete')
     and (p_new ? 'tags_to_add' or p_new ? 'tags_to_delete') then
    v_out := (v_out - 'tags_to_add' - 'tags_to_delete')
             || public.kommo_merge_tag_lists(
                  p_old->'tags_to_add', p_old->'tags_to_delete',
                  p_new->'tags_to_add', p_new->'tags_to_delete');
  end if;

  return v_out;
end;
$$;

comment on function public.kommo_merge_payload(jsonb, jsonb) is
  'CRM: fusiona el payload viejo con el nuevo de la outbox. Escalares: gana el '
  'nuevo. custom_fields_values: por field_id. tags_to_add/tags_to_delete: por '
  'etiqueta. Cualquier OTRA clave array en los dos lados TIRA excepcion en vez '
  'de pisarse en silencio.';

-- ── Los dos enqueue pasan a delegar la fusión ───────────────────────────────
--
-- Único cambio respecto de la 0364: el `case` inline se reemplaza por la
-- llamada a `kommo_merge_payload`. El resto (clave de idempotencia, reset de
-- attempts, created_at) queda idéntico.
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
    payload = public.kommo_merge_payload(
                public.kommo_writeback_outbox.payload, excluded.payload),
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
    payload = public.kommo_merge_payload(
                public.kommo_writeback_outbox.payload, excluded.payload),
    attempts   = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Permisos: idénticos a los de la 0136 / 0344 / 0364 ──────────────────────
revoke execute on function public.kommo_merge_tag_lists(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.kommo_merge_tag_lists(jsonb, jsonb, jsonb, jsonb) to service_role;
revoke execute on function public.kommo_merge_payload(jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.kommo_merge_payload(jsonb, jsonb) to service_role;
revoke execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) from public, anon, authenticated;
grant  execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) to service_role;
revoke execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb) from public, anon, authenticated;
grant  execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb) to service_role;
