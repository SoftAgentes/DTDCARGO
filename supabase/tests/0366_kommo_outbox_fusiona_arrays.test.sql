\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0366. Fixtures ficticios + rollback.
--
-- Valida con MUTACIÓN en el sentido fuerte, igual que el de la 0364: primero
-- REPRODUCE la pérdida de etiquetas con la migración anterior (y falla si NO se
-- reproduce), y recién después aplica la 0366 y comprueba que la arregla.
--
-- Y carga las DOS migraciones reales con `\i` en vez de copiar su cuerpo acá:
-- un contrato que reimplementa el DDL deja de medir el archivo que se aplica.
-- Lo único inline es la tabla, que es el fixture.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');

-- ── Fixture: la tabla tal como la dejó la 0136 ──────────────────────────────
create table public.kommo_writeback_outbox (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id    bigint,
  kommo_contact_id bigint,
  op               text not null,
  payload          jsonb not null,
  idempotency_key  text not null,
  status           text not null default 'pending' check (status in ('pending','processing','sent','skipped','error')),
  attempts         int not null default 0,
  last_error       text,
  kommo_updated_at_at_enqueue timestamptz,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create unique index kommo_writeback_outbox_pending_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where status = 'pending';

-- ── Estado PREVIO: la migración 0364, tal cual se aplicó a producción ───────
\i /sb/migrations/0364_kommo_outbox_fusiona_payload.sql

-- ── 1) El BUG existe: con la 0364, el primer set de etiquetas se pierde ─────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 777, 'patch_tags',
  '{"tags_to_add":[{"name":"Mayorista"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 777, 'patch_tags',
  '{"tags_to_add":[{"name":"Recompra"}]}'::jsonb);

do $bug$
declare v jsonb;
begin
  select payload->'tags_to_add' into v
    from public.kommo_writeback_outbox where kommo_lead_id = 777;
  if v @> '[{"name":"Mayorista"}]'::jsonb then
    raise exception
      'el bug de la 0364 NO se reprodujo: si el array ya se fusionaba, esta migracion no hace falta y el test no discrimina (payload=%)', v;
  end if;
  if not (v @> '[{"name":"Recompra"}]'::jsonb) then
    raise exception 'reproduccion inesperada: el segundo encolado tampoco quedo (payload=%)', v;
  end if;
end;
$bug$;

delete from public.kommo_writeback_outbox;

-- ── La migración bajo prueba ────────────────────────────────────────────────
\i /sb/migrations/0366_kommo_outbox_fusiona_arrays.sql

-- ── 2) Ahora los dos sets sobreviven ────────────────────────────────────────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 777, 'patch_tags',
  '{"tags_to_add":[{"name":"Mayorista"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 777, 'patch_tags',
  '{"tags_to_add":[{"name":"Recompra"}]}'::jsonb);

do $fusion$
declare v jsonb;
begin
  select payload->'tags_to_add' into v
    from public.kommo_writeback_outbox where kommo_lead_id = 777;
  if not (v @> '[{"name":"Mayorista"}]'::jsonb and v @> '[{"name":"Recompra"}]'::jsonb) then
    raise exception 'las dos etiquetas debian sobrevivir (%)', v;
  end if;
  if jsonb_array_length(v) <> 2 then
    raise exception 'se esperaban exactamente 2 etiquetas (%)', v;
  end if;
end;
$fusion$;

delete from public.kommo_writeback_outbox;

-- ── 3) La orden NUEVA manda: quitar y despues agregar termina AGREGANDO ─────
--     (si "quitar siempre gana", este caso queda al reves)
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 778, 'patch_tags',
  '{"tags_to_delete":[{"name":"VIP"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 778, 'patch_tags',
  '{"tags_to_add":[{"name":"VIP"}]}'::jsonb);

do $nuevo_manda$
declare p jsonb;
begin
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 778;
  if not (p->'tags_to_add' @> '[{"name":"VIP"}]'::jsonb) then
    raise exception 'la orden nueva (agregar) debia ganar (%)', p;
  end if;
  if p ? 'tags_to_delete' then
    raise exception 'VIP no podia quedar tambien en tags_to_delete (%)', p;
  end if;
end;
$nuevo_manda$;

delete from public.kommo_writeback_outbox;

-- ── 4) Y al reves: agregar y despues quitar termina QUITANDO, sin residuo ───
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 779, 'patch_tags',
  '{"tags_to_add":[{"name":"VIP"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 779, 'patch_tags',
  '{"tags_to_delete":[{"name":"VIP"}]}'::jsonb);

do $quitar$
declare p jsonb;
begin
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 779;
  if not (p->'tags_to_delete' @> '[{"name":"VIP"}]'::jsonb) then
    raise exception 'la orden nueva (quitar) debia ganar (%)', p;
  end if;
  -- El residuo que dejaria un `||` superficial sin borrar las dos listas antes.
  if p ? 'tags_to_add' then
    raise exception 'quedo un tags_to_add residual: el || superficial no se limpio (%)', p;
  end if;
end;
$quitar$;

delete from public.kommo_writeback_outbox;

-- ── 5) Dentro de UN mismo payload gana quitar; lo viejo-solo sobrevive ──────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 780, 'patch_tags',
  '{"tags_to_add":[{"name":"Antiguo"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 780, 'patch_tags',
  '{"tags_to_add":[{"name":"X"}],"tags_to_delete":[{"name":"X"}]}'::jsonb);

do $mismo_payload$
declare p jsonb;
begin
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 780;
  if not (p->'tags_to_delete' @> '[{"name":"X"}]'::jsonb) then
    raise exception 'dentro del mismo payload debia ganar quitar (%)', p;
  end if;
  if p->'tags_to_add' @> '[{"name":"X"}]'::jsonb then
    raise exception 'X no podia quedar en las dos listas (%)', p;
  end if;
  if not (p->'tags_to_add' @> '[{"name":"Antiguo"}]'::jsonb) then
    raise exception 'la etiqueta que solo estaba en el viejo debia sobrevivir (%)', p;
  end if;
end;
$mismo_payload$;

delete from public.kommo_writeback_outbox;

-- ── 6) Dedup sin distinguir mayusculas; gana la forma NUEVA ────────────────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 781, 'patch_tags',
  '{"tags_to_add":[{"name":"vip"}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 781, 'patch_tags',
  '{"tags_to_add":[{"name":"  VIP  "}]}'::jsonb);

do $dedup$
declare v jsonb;
begin
  select payload->'tags_to_add' into v
    from public.kommo_writeback_outbox where kommo_lead_id = 781;
  if jsonb_array_length(v) <> 1 then
    raise exception '"vip" y "  VIP  " son la misma etiqueta: debia quedar 1 (%)', v;
  end if;
  if not (v @> '[{"name":"  VIP  "}]'::jsonb) then
    raise exception 'debia ganar la forma del encolado nuevo (%)', v;
  end if;
end;
$dedup$;

delete from public.kommo_writeback_outbox;

-- ── 7) LA GUARDA: un array desconocido en los DOS lados TIRA, no se pisa ────
do $guarda$
declare v_ok boolean := false;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 782, 'patch_lead',
    '{"inventado":[{"a":1}]}'::jsonb);
  begin
    perform public.enqueue_kommo_writeback(
      '11111111-1111-1111-1111-111111111111', 782, 'patch_lead',
      '{"inventado":[{"b":2}]}'::jsonb);
  exception when others then
    v_ok := true;
    if position('inventado' in sqlerrm) = 0 then
      raise exception 'la excepcion debia NOMBRAR la clave culpable (%)', sqlerrm;
    end if;
  end;
  if not v_ok then
    raise exception 'un array desconocido en los dos lados debia tirar excepcion, no pisarse';
  end if;
end;
$guarda$;

delete from public.kommo_writeback_outbox;

-- ── 8) La guarda NO se dispara si el array esta de UN solo lado ─────────────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 783, 'patch_lead',
  '{"name":"Juan"}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 783, 'patch_lead',
  '{"inventado":[{"a":1}]}'::jsonb);

do $un_lado$
declare p jsonb;
begin
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 783;
  if not (p ? 'inventado' and p->>'name' = 'Juan') then
    raise exception 'sin colision de arrays la fusion normal debia funcionar (%)', p;
  end if;
end;
$un_lado$;

delete from public.kommo_writeback_outbox;

-- ── 9) No hay regresion de la 0364: escalares y custom fields ──────────────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 784, 'patch_lead',
  '{"name":"Viejo","custom_fields_values":[{"field_id":1570535,"values":[{"value":"DTD-0412"}]}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 784, 'patch_lead',
  '{"name":"Nuevo","custom_fields_values":[{"field_id":999,"values":[{"value":"otro"}]}]}'::jsonb);

do $sin_regresion$
declare p jsonb;
begin
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 784;
  if p->>'name' <> 'Nuevo' then
    raise exception 'un escalar debe seguir ganando el ultimo (%)', p;
  end if;
  if jsonb_array_length(p->'custom_fields_values') <> 2 then
    raise exception 'los dos custom fields debian sobrevivir, como en la 0364 (%)', p;
  end if;
end;
$sin_regresion$;

delete from public.kommo_writeback_outbox;

-- ── 10) La fila ya ENVIADA no se fusiona: abre una nueva (indice parcial) ───
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 785, 'patch_tags',
  '{"tags_to_add":[{"name":"Uno"}]}'::jsonb);
update public.kommo_writeback_outbox set status = 'sent' where kommo_lead_id = 785;
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 785, 'patch_tags',
  '{"tags_to_add":[{"name":"Dos"}]}'::jsonb);

do $enviada$
declare n int;
begin
  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 785;
  if n <> 2 then
    raise exception 'la fila enviada se fusiono en vez de abrir una nueva (filas=%)', n;
  end if;
end;
$enviada$;

delete from public.kommo_writeback_outbox;

-- ── 11) El camino del CONTACTO fusiona igual ────────────────────────────────
select public.enqueue_kommo_contact_writeback(
  '11111111-1111-1111-1111-111111111111', 4242, 'patch_contact',
  '{"tags_to_add":[{"name":"Cliente"}]}'::jsonb);
select public.enqueue_kommo_contact_writeback(
  '11111111-1111-1111-1111-111111111111', 4242, 'patch_contact',
  '{"tags_to_add":[{"name":"Aliado"}]}'::jsonb);

do $contacto$
declare v jsonb;
begin
  select payload->'tags_to_add' into v
    from public.kommo_writeback_outbox where kommo_contact_id = 4242;
  if jsonb_array_length(v) <> 2 then
    raise exception 'el camino del contacto tambien debia fusionar (%)', v;
  end if;
end;
$contacto$;

-- ── 12) Permisos: nadie mas que service_role ejecuta las funciones nuevas ───
do $permisos$
declare r record;
begin
  for r in
    select unnest(array['kommo_merge_tag_lists','kommo_merge_payload']) as fn
  loop
    if has_function_privilege('anon', 'public.' || r.fn ||
         case r.fn when 'kommo_merge_payload' then '(jsonb,jsonb)'
                   else '(jsonb,jsonb,jsonb,jsonb)' end, 'EXECUTE')
    then
      raise exception 'anon no puede ejecutar %', r.fn;
    end if;
    if has_function_privilege('authenticated', 'public.' || r.fn ||
         case r.fn when 'kommo_merge_payload' then '(jsonb,jsonb)'
                   else '(jsonb,jsonb,jsonb,jsonb)' end, 'EXECUTE')
    then
      raise exception 'authenticated no puede ejecutar %', r.fn;
    end if;
    if not has_function_privilege('service_role', 'public.' || r.fn ||
         case r.fn when 'kommo_merge_payload' then '(jsonb,jsonb)'
                   else '(jsonb,jsonb,jsonb,jsonb)' end, 'EXECUTE')
    then
      raise exception 'service_role SI debe poder ejecutar %', r.fn;
    end if;
  end loop;
end;
$permisos$;

rollback;
