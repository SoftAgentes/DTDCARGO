\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0377 (SDD-0256 · Fase 5 · B2 + B3).
--
-- Valida con MUTACIÓN en el sentido fuerte, igual que el de la 0366: primero
-- REPRODUCE el colapso de dos notas distintas en una sola fila con la clave
-- anterior —y falla si NO se reproduce— y recién después aplica la 0377.
--
-- Carga las migraciones REALES con `\i`. Lo único inline es la tabla, que es el
-- fixture.

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

-- ── Fixture: la tabla como la dejaron la 0136 y la 0344 ─────────────────────
create table public.kommo_writeback_outbox (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id    bigint,
  kommo_contact_id bigint,
  op               text not null,
  payload          jsonb not null,
  idempotency_key  text not null,
  status           text not null default 'pending',
  attempts         int not null default 0,
  last_error       text,
  kommo_updated_at_at_enqueue timestamptz,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create unique index kommo_writeback_outbox_pending_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where status = 'pending';

create function public.mark_kommo_writeback_skipped(p_id uuid, p_reason text default null)
returns void language sql as $$
  update public.kommo_writeback_outbox
     set status = 'skipped', last_error = p_reason, sent_at = now() where id = p_id;
$$;

-- ── Estado PREVIO: las migraciones que ya están en producción ───────────────
\i /sb/migrations/0364_kommo_outbox_fusiona_payload.sql
\i /sb/migrations/0365_kommo_outbox_claim.sql
\i /sb/migrations/0366_kommo_outbox_fusiona_arrays.sql
\i /sb/migrations/0376_kommo_writeback_chequeo_optimista.sql

-- ── 1) ⭐ EL BUG EXISTE: dos notas DISTINTAS colapsan en una sola fila ───────
--
-- La op `add_note` todavía no está en el CHECK, así que se abre a mano para
-- reproducir exactamente lo que pasaría el día que se encolara la primera nota
-- sin este arreglo.
alter table public.kommo_writeback_outbox drop constraint kommo_writeback_outbox_op_check;
alter table public.kommo_writeback_outbox add constraint kommo_writeback_outbox_op_check
  check (op in ('patch_price','patch_stage','patch_lead','patch_contact',
                'patch_owner','patch_tags','add_note'));

do $bug$
declare n int; v text;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 900, 'add_note',
    '{"note_type":"common","params":{"text":"Llame, no contesto"}}'::jsonb);
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 900, 'add_note',
    '{"note_type":"common","params":{"text":"Pidio cotizacion de 3 CBM"}}'::jsonb);

  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 900;
  if n <> 1 then
    raise exception
      'el bug NO se reprodujo: dos notas distintas dejaron % filas. Si ya no colapsaban, esta migracion no hace falta y el test no discrimina', n;
  end if;
  select payload->'params'->>'text' into v
    from public.kommo_writeback_outbox where kommo_lead_id = 900;
  if v <> 'Pidio cotizacion de 3 CBM' then
    raise exception 'reproduccion inesperada: sobrevivio "%"', v;
  end if;
end;
$bug$;

delete from public.kommo_writeback_outbox;

-- ── La migración bajo prueba ────────────────────────────────────────────────
\i /sb/migrations/0377_kommo_outbox_post_idempotente.sql

-- ── 2) Las ops nuevas se aceptan; una inventada NO ─────────────────────────
do $ops$
begin
  insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
  values ('11111111-1111-1111-1111-111111111111', 1, 'add_note', '{}', '1:add_note:x'),
         ('11111111-1111-1111-1111-111111111111', 2, 'add_task', '{}', '2:add_task:x');
  begin
    insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 3, 'add_lo_que_sea', '{}', '3:x');
    raise exception 'MUTACION: el CHECK acepto una op inventada';
  exception when check_violation then null;
  end;
end;
$ops$;

delete from public.kommo_writeback_outbox;

-- ── 3) ⭐ Dos notas distintas (dos drawers, dos tokens) = DOS filas ─────────
do $dos_notas$
declare n int;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 900, 'add_note',
    '{"note_type":"common","params":{"text":"Llame, no contesto"}}'::jsonb,
    null, 'tok-aaa');
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 900, 'add_note',
    '{"note_type":"common","params":{"text":"Pidio cotizacion de 3 CBM"}}'::jsonb,
    null, 'tok-bbb');

  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 900;
  if n <> 2 then
    raise exception 'dos notas distintas debian dejar 2 filas, dejaron %', n;
  end if;
  if not exists (select 1 from public.kommo_writeback_outbox
                  where kommo_lead_id = 900
                    and payload->'params'->>'text' = 'Llame, no contesto') then
    raise exception 'la PRIMERA nota se perdio: es exactamente el bug que esto cierra';
  end if;
end;
$dos_notas$;

delete from public.kommo_writeback_outbox;

-- ── 4) ⭐ Doble submit del MISMO drawer = UNA fila, y devuelve la que hay ───
do $doble_submit$
declare a uuid; b uuid; n int;
begin
  select public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 901, 'add_note',
    '{"note_type":"common","params":{"text":"Una sola vez"}}'::jsonb,
    null, 'tok-ccc') into a;
  select public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 901, 'add_note',
    '{"note_type":"common","params":{"text":"Una sola vez"}}'::jsonb,
    null, 'tok-ccc') into b;

  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 901;
  if n <> 1 then raise exception 'el doble submit creo % filas', n; end if;
  if a is null or b is null then
    raise exception 'el encolado devolvio null: el caller lo lee como "no se pudo encolar"';
  end if;
  if a <> b then
    raise exception 'el segundo submit devolvio otra fila (% vs %)', a, b;
  end if;
end;
$doble_submit$;

-- ── 5) ⭐ El token vale para SIEMPRE, no sólo mientras esté pendiente ───────
--
-- Éste es el motivo por el que el índice del token NO filtra por status: si
-- filtrara, un re-submit llegado después de que la nota ya salió crearía una
-- SEGUNDA nota en Kommo — justo lo que se viene a evitar.
do $para_siempre$
declare n int;
begin
  update public.kommo_writeback_outbox set status = 'sent' where kommo_lead_id = 901;
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 901, 'add_note',
    '{"note_type":"common","params":{"text":"Una sola vez"}}'::jsonb,
    null, 'tok-ccc');

  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 901;
  if n <> 1 then
    raise exception
      'con la nota YA ENVIADA, el mismo token creo otra fila (filas=%): se mandaria la nota dos veces', n;
  end if;
end;
$para_siempre$;

delete from public.kommo_writeback_outbox;

-- ── 6) Sin regresión: los PATCH siguen fusionando (0364 + 0366) ────────────
do $sin_regresion$
declare n int; p jsonb;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 902, 'patch_tags',
    '{"tags_to_add":[{"name":"Mayorista"}]}'::jsonb);
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 902, 'patch_tags',
    '{"tags_to_add":[{"name":"Recompra"}]}'::jsonb);

  select count(*) into n from public.kommo_writeback_outbox where kommo_lead_id = 902;
  if n <> 1 then raise exception 'los PATCH debian seguir fusionando en 1 fila, hay %', n; end if;
  select payload into p from public.kommo_writeback_outbox where kommo_lead_id = 902;
  if jsonb_array_length(p->'tags_to_add') <> 2 then
    raise exception 'se perdio la fusion de etiquetas de la 0366 (%)', p;
  end if;
  if exists (select 1 from public.kommo_writeback_outbox
              where kommo_lead_id = 902 and dedupe_token is not null) then
    raise exception 'un PATCH no debe llevar token';
  end if;
end;
$sin_regresion$;

delete from public.kommo_writeback_outbox;

-- ── 7) ⭐ Un POST fallido va a ERROR, nunca vuelve a pending ────────────────
do $post_una_vez$
declare v record;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 903, 'add_note',
    '{"note_type":"common","params":{"text":"x"}}'::jsonb, null, 'tok-ddd');
  update public.kommo_writeback_outbox
     set status = 'processing', attempts = 1, claimed_at = now() where kommo_lead_id = 903;

  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 903;
  perform public.record_kommo_writeback_error(v.id, 'Kommo 500');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 903;

  if v.status <> 'error' then
    raise exception
      'un POST fallido quedo en % con 1 intento: se reintentaria y Kommo terminaria con DOS notas', v.status;
  end if;
end;
$post_una_vez$;

-- ── 8) …y un PATCH fallido SÍ vuelve a pending (no se rompió la 0365) ──────
do $patch_reintenta$
declare v record;
begin
  perform public.enqueue_kommo_writeback(
    '11111111-1111-1111-1111-111111111111', 904, 'patch_stage', '{"status_id":9}'::jsonb);
  update public.kommo_writeback_outbox
     set status = 'processing', attempts = 1, claimed_at = now() where kommo_lead_id = 904;

  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 904;
  perform public.record_kommo_writeback_error(v.id, 'Kommo 500');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 904;

  if v.status <> 'pending' then
    raise exception 'un PATCH es idempotente y debia reintentarse, quedo en %', v.status;
  end if;
  if v.attempts <> 1 then
    raise exception 'attempts quedo en %: el error volvio a contar el intento', v.attempts;
  end if;

  -- Y a los 5 se rinde igual que antes.
  update public.kommo_writeback_outbox set attempts = 5, status = 'processing' where kommo_lead_id = 904;
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 904;
  perform public.record_kommo_writeback_error(v.id, 'y van 5');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 904;
  if v.status <> 'error' then
    raise exception 'con 5 intentos debia rendirse, quedo en %', v.status;
  end if;
end;
$patch_reintenta$;

delete from public.kommo_writeback_outbox;

-- ── 9) ⭐ El reaper falla cerrado con la op REAL, no con una simulada ───────
--
-- El contrato de la 0365 lo probaba abriendo el CHECK a mano porque `add_note`
-- no existía. Ahora existe: se mide contra la op de verdad. (Ésta es la
-- confirmación que pedía la Fase 5 en vez de asumir que el reaper ya estaba.)
do $reaper$
declare n int; st text;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key, dedupe_token,
     status, claimed_at, attempts)
  values ('11111111-1111-1111-1111-111111111111', 905, 'add_note',
          '{"note_type":"common","params":{"text":"colgada"}}', '905:add_note:t', 't',
          'processing', now() - interval '1 hour', 1),
         ('11111111-1111-1111-1111-111111111111', 906, 'add_task',
          '{"text":"colgada"}', '906:add_task:t', 't',
          'processing', now() - interval '1 hour', 1),
         ('11111111-1111-1111-1111-111111111111', 907, 'patch_stage',
          '{"status_id":3}', '907:patch_stage', null,
          'processing', now() - interval '1 hour', 1);

  select public.reap_kommo_writeback_stale(
    '11111111-1111-1111-1111-111111111111', '10 minutes') into n;
  if n <> 3 then raise exception 'el reaper solto % de 3', n; end if;

  for st in select status from public.kommo_writeback_outbox where kommo_lead_id in (905, 906) loop
    if st <> 'error' then
      raise exception 'una op POST colgada volvio a %: se enviaria dos veces y duplicaria', st;
    end if;
  end loop;

  select status into st from public.kommo_writeback_outbox where kommo_lead_id = 907;
  if st <> 'pending' then
    raise exception 'un PATCH colgado debia volver a pending, quedo en %', st;
  end if;
end;
$reaper$;

-- ── 10) Una sola versión de enqueue_kommo_writeback ────────────────────────
do $una_sola$
declare n int;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'enqueue_kommo_writeback';
  if n <> 1 then
    raise exception
      'quedaron % versiones de enqueue_kommo_writeback: las llamadas de 5 args serian ambiguas', n;
  end if;
end;
$una_sola$;

-- ── 11) Permisos: sólo el backend encola ───────────────────────────────────
do $permisos$
begin
  if has_function_privilege('anon', 'public.enqueue_kommo_writeback(uuid,bigint,text,jsonb,timestamptz,text)', 'execute')
  or has_function_privilege('authenticated', 'public.enqueue_kommo_writeback(uuid,bigint,text,jsonb,timestamptz,text)', 'execute') then
    raise exception 'anon/authenticated pueden encolar: el revoke no quedo';
  end if;
  if not has_function_privilege('service_role', 'public.enqueue_kommo_writeback(uuid,bigint,text,jsonb,timestamptz,text)', 'execute') then
    raise exception 'service_role SI debe poder encolar';
  end if;
end;
$permisos$;

rollback;
