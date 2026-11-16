-- ─────────────────────────────────────────────────────────────────────────────
-- 0546 · SDD-0611 §11.4.1 — Purga de actor_id de noticias a los 12 meses.
--
-- ⚠️ NO APLICADA A NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General (migrate-first). Fusionar la PR NO autoriza aplicarla.
--    ORDEN: ANTES de encender la publicación automática (§11.4.1, punto 2). Sin
--    ella la web corre igual: la ruta /api/cron/noticias-purga-actor responde
--    «sin_migracion» y nace apagada.
--
-- ── La decisión (Sam, 2026-11-14, §11.4.1) ───────────────────────────────────
-- Plazo 12 meses · las 4 columnas · al vencer, vaciar solo el uuid (se conserva
-- qué pasó y cuándo, sin quién) · la purga va en la PR del cron de noticias.
--
-- ── Qué hace ─────────────────────────────────────────────────────────────────
-- 1. news_publication_audit.actor_purged_at (timestamptz, nula): la marca de
--    purga. El CHECK news_audit_manual_con_persona se reescribe para que una fila
--    manual sin uuid exista SOLO con la marca. Una fila nueva sigue exigiendo
--    persona: no se afloja. Un disparador BEFORE INSERT
--    (news_purga_marca_solo_por_purga) rechaza una marca no nula al insertar: una fila
--    nueva no puede entrar ya «purgada»; la marca solo la pone la purga con UPDATE.
-- 2. news_autopublish_settings_log.changed_by deja de ser NOT NULL y gana
--    changed_by_purged_at con el mismo CHECK (changed_by o su marca).
-- 3. news_purgar_actor_id(): SECURITY DEFINER, search_path vacío, lock_timeout.
--    Solo service_role. Pone en NULL el uuid de las filas con MÁS de 12 meses
--    (frontera estricta: una fila de exactamente 12 meses no se toca todavía) y
--    deja intacto todo lo demás; no borra filas. Devuelve cuántas vació por tabla.
--    Idempotente: la segunda corrida no encuentra nada.
--
--    Edad de la fila, por tabla:
--      news_post_exits.actor_id                   → created_at
--      news_publication_audit.actor_id            → evaluated_at
--      news_autopublish_settings_log.changed_by   → changed_at
--      news_autopublish_settings.updated_by       → updated_at (la edad del último
--                                                   cambio: mientras alguien cambie
--                                                   el interruptor, el uuid se queda)
--
-- Disparadores de solo agregar: ninguna de las cuatro tablas los tiene (la 0518
-- no los creó), así que no hay nada que excepcionar.
--
-- ── Qué NO toca ──────────────────────────────────────────────────────────────
-- Ninguna fila se borra ni cambia fuera de actor_id/updated_by/changed_by y sus
-- marcas. Ninguna policy, grant de tabla ni función existente. authenticated y
-- service_role siguen igual sobre las tablas.
--
-- ── Locks ────────────────────────────────────────────────────────────────────
-- news_publication_audit y news_autopublish_settings_log quedan con ACCESS EXCLUSIVE
-- desde su primer ALTER (el ADD COLUMN) hasta el COMMIT de la migración: ese candado
-- no se suelta antes, y NOT VALID/VALIDATE no lo acorta. Son tablas pequeñas y la
-- migración dura milisegundos, pero escribir o leer en ellas espera hasta el COMMIT.
-- lock_timeout de 5 s es solo para ADQUIRIRLO: con tráfico encima, falla y se
-- reintenta. Aplicarla en una ventana tranquila.
--
-- ── Deshacer ─────────────────────────────────────────────────────────────────
-- supabase/desarmes/0546_desarme.sql (sin número; usarlo exige OK nominal de Sam).
-- Lo ya vaciado NO se recupera: el uuid purgado no vuelve.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.news_post_exits') is null
     or pg_catalog.to_regclass('public.news_publication_audit') is null
     or pg_catalog.to_regclass('public.news_autopublish_settings') is null
     or pg_catalog.to_regclass('public.news_autopublish_settings_log') is null then
    raise exception '0546 requiere las tablas de la 0518 (news_post_exits, news_publication_audit, news_autopublish_settings y su log)';
  end if;
  if pg_catalog.to_regprocedure('public.news_purgar_actor_id()') is not null
     or pg_catalog.to_regprocedure('public.news_purga_marca_solo_por_purga()') is not null then
    raise exception '0546 ya aplicada: existe public.news_purgar_actor_id() o su disparador';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'news_publication_audit'
                and column_name = 'actor_purged_at') then
    raise exception '0546 ya aplicada: news_publication_audit.actor_purged_at existe';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conrelid = 'public.news_publication_audit'::pg_catalog.regclass
                    and conname = 'news_audit_manual_con_persona') then
    raise exception '0546 requiere el CHECK news_audit_manual_con_persona de la 0518';
  end if;
end
$preflight$;

-- ─── 1. Marca de purga y CHECK de la auditoría ───────────────────────────────
alter table public.news_publication_audit
  add column actor_purged_at timestamptz;

comment on column public.news_publication_audit.actor_purged_at is
  'SDD-0611 §11.4.1: cuándo news_purgar_actor_id() vació actor_id (retención de 12 meses). Solo esa función la escribe.';

alter table public.news_publication_audit
  drop constraint news_audit_manual_con_persona;

-- Una fila manual lleva persona; sin ella solo si la purga la vació (y entonces
-- la marca existe). Una fila con uuid no puede traer marca.
alter table public.news_publication_audit
  add constraint news_audit_manual_con_persona check (
    via = 'automatica' or actor_id is not null or actor_purged_at is not null) not valid;
alter table public.news_publication_audit
  add constraint news_audit_purga_sin_uuid check (
    actor_purged_at is null or actor_id is null) not valid;
alter table public.news_publication_audit validate constraint news_audit_manual_con_persona;
alter table public.news_publication_audit validate constraint news_audit_purga_sin_uuid;

-- ─── 2. El log de cambios del interruptor ────────────────────────────────────
alter table public.news_autopublish_settings_log
  add column changed_by_purged_at timestamptz;

comment on column public.news_autopublish_settings_log.changed_by_purged_at is
  'SDD-0611 §11.4.1: cuándo news_purgar_actor_id() vació changed_by (retención de 12 meses).';

alter table public.news_autopublish_settings_log
  alter column changed_by drop not null;

-- Para una fila nueva sigue siendo obligatorio: sin uuid solo con la marca.
alter table public.news_autopublish_settings_log
  add constraint news_autopublish_log_con_persona check (
    changed_by is not null or changed_by_purged_at is not null) not valid;
alter table public.news_autopublish_settings_log
  add constraint news_autopublish_log_purga_sin_uuid check (
    changed_by_purged_at is null or changed_by is null) not valid;
alter table public.news_autopublish_settings_log validate constraint news_autopublish_log_con_persona;
alter table public.news_autopublish_settings_log validate constraint news_autopublish_log_purga_sin_uuid;

-- ─── 2b. Una fila nueva no entra ya «purgada» ────────────────────────────────
-- Las marcas solo las escribe la purga con UPDATE. Sin esto, un INSERT con la marca
-- y sin uuid saltaría el CHECK de persona. Disparador común (ENABLE ORIGIN: una
-- restauración con session_replication_role = replica puede recargar filas ya purgadas).
create or replace function public.news_purga_marca_solo_por_purga()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_name = 'news_publication_audit' and (pg_catalog.to_jsonb(new) ->> 'actor_purged_at') is not null then
    raise exception 'news_publication_audit: actor_purged_at solo lo escribe la purga (UPDATE), no un INSERT'
      using errcode = 'check_violation';
  elsif tg_table_name = 'news_autopublish_settings_log' and (pg_catalog.to_jsonb(new) ->> 'changed_by_purged_at') is not null then
    raise exception 'news_autopublish_settings_log: changed_by_purged_at solo lo escribe la purga (UPDATE), no un INSERT'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

alter function public.news_purga_marca_solo_por_purga() owner to postgres;
revoke all on function public.news_purga_marca_solo_por_purga() from public, anon, authenticated, service_role;

create trigger news_audit_marca_purga_ins
  before insert on public.news_publication_audit
  for each row execute function public.news_purga_marca_solo_por_purga();
create trigger news_autopublish_log_marca_purga_ins
  before insert on public.news_autopublish_settings_log
  for each row execute function public.news_purga_marca_solo_por_purga();

-- ─── 3. La purga ─────────────────────────────────────────────────────────────
-- Una sola marca de tiempo para toda la corrida: now() es el de la transacción.
-- Frontera estricta (<): una fila de exactamente 12 meses no se toca todavía.
create or replace function public.news_purgar_actor_id()
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '120s'
as $function$
declare
  v_ahora  timestamptz := pg_catalog.now();
  v_corte  timestamptz := pg_catalog.now() - interval '12 months';
  v_exits  integer;
  v_audit  integer;
  v_log    integer;
  v_config integer;
begin
  update public.news_post_exits
     set actor_id = null
   where actor_id is not null and created_at < v_corte;
  get diagnostics v_exits = row_count;

  update public.news_publication_audit
     set actor_id = null, actor_purged_at = v_ahora
   where actor_id is not null and evaluated_at < v_corte;
  get diagnostics v_audit = row_count;

  update public.news_autopublish_settings_log
     set changed_by = null, changed_by_purged_at = v_ahora
   where changed_by is not null and changed_at < v_corte;
  get diagnostics v_log = row_count;

  update public.news_autopublish_settings
     set updated_by = null
   where updated_by is not null and updated_at < v_corte;
  get diagnostics v_config = row_count;

  return pg_catalog.jsonb_build_object(
    'news_post_exits', v_exits,
    'news_publication_audit', v_audit,
    'news_autopublish_settings_log', v_log,
    'news_autopublish_settings', v_config);
end;
$function$;

alter function public.news_purgar_actor_id() owner to postgres;
revoke all on function public.news_purgar_actor_id() from public, anon, authenticated, service_role;
grant execute on function public.news_purgar_actor_id() to service_role;

comment on function public.news_purgar_actor_id() is
  'SDD-0611 §11.4.1 (Sam, 2026-11-14): vacía el uuid de las 4 columnas actor_id de noticias en filas de más de 12 '
  'meses (frontera estricta). No borra filas ni toca otra columna. Devuelve las filas vaciadas por tabla. Solo service_role.';

-- ─── 4. Postflight ───────────────────────────────────────────────────────────
do $postflight$
begin
  if pg_catalog.has_function_privilege('anon', 'public.news_purgar_actor_id()', 'execute')
     or pg_catalog.has_function_privilege('authenticated', 'public.news_purgar_actor_id()', 'execute') then
    raise exception '0546 postflight: anon o authenticated pueden ejecutar la purga';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.news_purgar_actor_id()', 'execute') then
    raise exception '0546 postflight: service_role no puede ejecutar la purga';
  end if;
  if not (select p.prosecdef from pg_catalog.pg_proc p
           where p.oid = 'public.news_purgar_actor_id()'::pg_catalog.regprocedure) then
    raise exception '0546 postflight: la purga no es SECURITY DEFINER';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'public.news_purgar_actor_id()'::pg_catalog.regprocedure
                    and p.proconfig @> array['search_path=""']
                    and exists (select 1 from pg_catalog.unnest(p.proconfig) c where c like 'lock_timeout=%')) then
    raise exception '0546 postflight: la purga necesita search_path vacío y lock_timeout';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_constraint k
       where k.convalidated and k.contype = 'c'
         and k.conname in ('news_audit_manual_con_persona', 'news_audit_purga_sin_uuid',
                           'news_autopublish_log_con_persona', 'news_autopublish_log_purga_sin_uuid')) <> 4 then
    raise exception '0546 postflight: faltan los CHECK de persona/purga (o no están validados)';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger t
       where not t.tgisinternal and t.tgenabled = 'O'
         and t.tgfoid = 'public.news_purga_marca_solo_por_purga()'::pg_catalog.regprocedure
         and t.tgname in ('news_audit_marca_purga_ins', 'news_autopublish_log_marca_purga_ins')) <> 2 then
    raise exception '0546 postflight: faltan los disparadores BEFORE INSERT de la marca de purga';
  end if;
  if (select a.attnotnull from pg_catalog.pg_attribute a
       where a.attrelid = 'public.news_autopublish_settings_log'::pg_catalog.regclass
         and a.attname = 'changed_by') then
    raise exception '0546 postflight: changed_by sigue NOT NULL';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
