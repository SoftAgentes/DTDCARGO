-- ─────────────────────────────────────────────────────────────────────────────
-- 0479 · SDD-0526 — Bandeja de avisos del Portal: el cliente lee dentro de su
-- Portal los avisos que ya se le enviaron sobre su mercancía, y la campana sabe
-- cuáles todavía no ha visto.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md), de a una y con el name exacto
--    `0479_portal_bandeja_avisos`. MIGRATE-FIRST: el código de la SDD-0526 llama
--    a las dos RPC nuevas; desplegado sin esta migración, la bandeja queda vacía
--    y la campana sin contador (degrada, no rompe: ver
--    supabase/pending-migration-symbol-declarations.json).
--
-- ── Pedido de Sam (literal) ─────────────────────────────────
-- «al correo y la notificación push a su portal, que le avisen en su portal el
-- estatus de la mercancía» · «sí, prepara la bandeja de avisos en el Portal».
--
-- ── Por qué hace falta una migración ────────────────────────
-- La cola `client_notification_schedule` (0247, 0389) es sólo de service_role:
-- no tiene policy para la API y el cliente no la puede leer con su sesión. El
-- historial del envío que existe hoy la lee con el cliente admin, acotado a un
-- envío ya verificado. Una bandeja que junta los avisos de TODAS las compras y
-- envíos del cliente no puede apoyarse en el cliente admin: necesita una
-- frontera de tenant y Shipping Mark en la base, como la 0402 y la 0416. Y el
-- «visto» tiene que vivir en algún lado por usuario del Portal.
--
-- ── Qué agrega ──────────────────────────────────────────────
-- 1. `portal_notification_seen`: UNA fila por vínculo del Portal
--    (`client_users.id`) con `last_seen_at`, la fecha del aviso más reciente
--    que el cliente vio al abrir la bandeja. No guarda historial, ni qué aviso
--    abrió, ni desde dónde. RLS encendida, cero policies y cero privilegios de
--    API: sólo la leen y escriben las dos RPC.
-- 2. Trigger `client_users_forget_portal_notification_seen`: cuando un vínculo
--    cambia de estado (revocado por el Studio, por la fusión o por el borrado
--    del cliente; reactivado) o de persona, su fila se borra. Un vínculo
--    revocado no conserva la fecha, y el que se reactiva empieza de cero: nunca
--    hereda el «visto» de otra persona.
-- 3. Índice parcial `client_notif_sched_portal_inbox_idx` sobre la cola
--    (tenant, Shipping Mark, sent_at desc) donde status = 'sent'.
-- 4. RPC `portal_list_my_notifications(p_prealerta_id, p_limit)`: los avisos
--    ENVIADOS del cliente, del más nuevo al más viejo. No recibe tenant ni
--    cliente: los deriva de auth.uid() con la misma frontera que 0453 (un
--    único vínculo activo, cliente vivo y del mismo tenant; con cero o más de
--    uno, nada). Una fila entra sólo si:
--      · status = 'sent' (nunca scheduled, failed, skipped ni canceled);
--      · es del tenant y del Shipping Mark del cliente;
--      · su ancla (envío o compra) vive, es del mismo tenant y del mismo
--        Shipping Mark (un envío eliminado no aparece, SDD-0511; tampoco una
--        compra eliminada);
--      · la regla vigente de su evento NO tiene «Visible en el portal» apagado.
--        Precedencia de 0402: el override del cliente gana al default del
--        tenant; sin regla, visible.
--    `p_prealerta_id` sólo acota a una compra (el detalle de compra); no amplía
--    nada. `p_limit` va de 1 a 50 (default 20). Devuelve título y texto del
--    aviso, canal, fecha, código del ancla y `unread`; nunca el payload entero,
--    el nombre del cliente, el tenant ni la regla.
-- 5. RPC `portal_mark_my_notifications_seen(p_hasta)`: guarda como visto hasta
--    `p_hasta`, la fecha del aviso más reciente que la bandeja MOSTRÓ (no
--    now(): un aviso que llegó mientras el panel estaba abierto sigue sin
--    leer). Recorta a now() y nunca retrocede. Sin vínculo activo → 42501.
--
-- ── Qué NO cambia ───────────────────────────────────────────
-- La cola sigue sin policy para la API, ningún dato existente se toca y no hay
-- backfill: un cliente sin fila ve todos sus avisos como no leídos la primera
-- vez. No cambia lo que programa ni lo que envía avisos (SDD-0524).
--
-- ── Locks (medidos en PGlite 0.5.8, PostgreSQL 17 embebido) ──
-- `pg_locks` de la propia transacción antes del COMMIT, sobre las tablas que
-- ya existen (lo fija la prueba lib/portal/__tests__/
-- portal-bandeja-avisos.migration.test.ts):
--   · ShareRowExclusiveLock sobre `client_users` (FK y CREATE TRIGGER): espera
--     a las escrituras de vínculos en curso y bloquea las nuevas (invitar,
--     vincular, revocar) hasta el COMMIT. Las lecturas no esperan.
--   · ShareLock sobre `client_notification_schedule` (CREATE INDEX): bloquea
--     las escrituras de la cola (programar y despachar avisos) hasta el
--     COMMIT. La cola es chica; el cron reintenta en la corrida siguiente.
--   · AccessShareLock sobre `client_users`, `clients`,
--     `client_notification_schedule`, `client_notification_rules`,
--     `shipments` y `prealertas` (el smoke del postflight). No hace esperar a
--     nadie; sólo choca con un DDL concurrente sobre esas tablas.
--   · La tabla nueva nace con AccessExclusiveLock: nadie más la ve hasta el
--     COMMIT.
-- PGlite tiene una sola conexión: estos son los modos tomados, no tiempos de
-- espera medidos contra otra sesión.
-- Aplicar en baja actividad, fuera de una corrida del cron de avisos.
-- `lock_timeout` 5 s y `statement_timeout` 30 s de sesión (rigen también en
-- autocommit); se restauran al final.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_table text;
  v_column record;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('service_role') is null
     or pg_catalog.to_regrole('postgres') is null then
    raise exception '0479 requiere auth.uid() y los roles anon, authenticated, service_role y postgres';
  end if;

  -- Las RPC son SECURITY DEFINER de postgres: si postgres no se salta la RLS de
  -- estas tablas, leerían cero filas sin error y la bandeja saldría vacía.
  foreach v_table in array array[
    'public.client_users', 'public.clients', 'public.client_notification_schedule',
    'public.client_notification_rules', 'public.shipments', 'public.prealertas'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class as c
      where c.oid = pg_catalog.to_regclass(v_table)
        and c.relkind in ('r', 'p') and c.relrowsecurity and not c.relforcerowsecurity
    ) then
      raise exception '0479 requiere tabla con RLS y sin FORCE: %', v_table;
    end if;
    if not exists (
      select 1
      from pg_catalog.pg_class as c
      join pg_catalog.pg_roles as owner on owner.oid = c.relowner
      cross join pg_catalog.pg_roles as definer
      where c.oid = pg_catalog.to_regclass(v_table)
        and definer.rolname = 'postgres'
        and (owner.rolname = 'postgres' or definer.rolsuper or definer.rolbypassrls)
    ) then
      raise exception '0479: postgres no se salta la RLS de %; revisar antes de aplicar', v_table;
    end if;
  end loop;

  for v_column in select * from (values
    ('public.client_users', 'id'), ('public.client_users', 'auth_user_id'),
    ('public.client_users', 'client_id'), ('public.client_users', 'tenant_id'),
    ('public.client_users', 'status'),
    ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'markbox'),
    ('public.clients', 'deleted_at'),
    ('public.client_notification_schedule', 'id'),
    ('public.client_notification_schedule', 'tenant_id'),
    ('public.client_notification_schedule', 'shipment_id'),
    ('public.client_notification_schedule', 'prealerta_id'),
    ('public.client_notification_schedule', 'client_markbox'),
    ('public.client_notification_schedule', 'trigger_event'),
    ('public.client_notification_schedule', 'channel'),
    ('public.client_notification_schedule', 'payload'),
    ('public.client_notification_schedule', 'status'),
    ('public.client_notification_schedule', 'sent_at'),
    ('public.client_notification_rules', 'tenant_id'),
    ('public.client_notification_rules', 'client_id'),
    ('public.client_notification_rules', 'trigger_event'),
    ('public.client_notification_rules', 'visible_in_portal'),
    ('public.shipments', 'id'), ('public.shipments', 'tenant_id'), ('public.shipments', 'code'),
    ('public.shipments', 'client_markbox'), ('public.shipments', 'deleted_at'),
    ('public.prealertas', 'id'), ('public.prealertas', 'tenant_id'), ('public.prealertas', 'code'),
    ('public.prealertas', 'client_markbox'), ('public.prealertas', 'deleted_at')
  ) as t(relation, attname) loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_column.relation)
        and attname = v_column.attname and attnum > 0 and not attisdropped
    ) then
      raise exception '0479 requiere la columna %.%', v_column.relation, v_column.attname;
    end if;
  end loop;

  -- 0389: cada aviso cuelga de exactamente un ancla. La RPC lo da por hecho.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'client_notif_sched_una_ancla'
      and conrelid = 'public.client_notification_schedule'::pg_catalog.regclass
      and contype = 'c' and convalidated
  ) then
    raise exception '0479 requiere el CHECK client_notif_sched_una_ancla de 0389, validado';
  end if;

  -- La cola sigue siendo de service_role: ninguna policy para la API. Si
  -- alguien abrió una, la frontera ya no es sólo la de estas RPC.
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'client_notification_schedule'
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception '0479 abortada: la cola de avisos tiene una policy para la API; revisar antes de aplicar';
  end if;

  if pg_catalog.to_regclass('public.portal_notification_seen') is not null
     or pg_catalog.to_regclass('public.client_notif_sched_portal_inbox_idx') is not null
     or exists (
       select 1 from pg_catalog.pg_proc as p
       join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
           'portal_list_my_notifications', 'portal_mark_my_notifications_seen',
           'portal_notification_seen_forget'
         )
     )
     or exists (
       select 1 from pg_catalog.pg_trigger
       where tgname = 'client_users_forget_portal_notification_seen'
     ) then
    raise exception '0479 ya aplicada o a medias: existe alguno de sus objetos; revisar antes de reaplicar';
  end if;
end;
$preflight$;

-- ── 1. Visto por vínculo del Portal ─────────────────────────
create table public.portal_notification_seen (
  client_user_id uuid primary key
    references public.client_users(id) on delete cascade,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.portal_notification_seen is
  'SDD-0526: hasta qué aviso vio el cliente en la bandeja del Portal, una fila por vínculo (client_users.id). Sin historial. Sin policies ni privilegios de API: sólo portal_list_my_notifications y portal_mark_my_notifications_seen. Se borra al revocar el vínculo.';

alter table public.portal_notification_seen enable row level security;
revoke all on table public.portal_notification_seen
  from public, anon, authenticated, service_role;

-- ── 2. El visto no sobrevive al vínculo ─────────────────────
create function public.portal_notification_seen_forget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.portal_notification_seen where client_user_id = old.id;
  return null;
end;
$function$;

create trigger client_users_forget_portal_notification_seen
  after update of status, auth_user_id on public.client_users
  for each row
  when (
    new.status is distinct from old.status
    or new.auth_user_id is distinct from old.auth_user_id
  )
  execute function public.portal_notification_seen_forget();

-- ── 3. Índice de la bandeja ─────────────────────────────────
create index client_notif_sched_portal_inbox_idx
  on public.client_notification_schedule (tenant_id, client_markbox, sent_at desc)
  where status = 'sent';

-- ── 4. Lectura de la bandeja ────────────────────────────────
create function public.portal_list_my_notifications(
  p_prealerta_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  trigger_event text,
  anchor_kind text,
  anchor_code text,
  title text,
  body text,
  channel text,
  sent_at timestamptz,
  unread boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  with links as (
    select cu.id as client_user_id, c.id as client_id, c.tenant_id, c.markbox
    from public.client_users as cu
    join public.clients as c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
  ),
  principal as (
    select l.client_user_id, l.client_id, l.tenant_id, l.markbox
    from links as l
    where (select pg_catalog.count(*) from links) = 1
  ),
  ranked_rules as (
    select
      r.trigger_event,
      r.visible_in_portal,
      pg_catalog.row_number() over (
        partition by r.trigger_event
        order by (r.client_id is not null) desc
      ) as precedence
    from principal as p
    join public.client_notification_rules as r
      on r.tenant_id = p.tenant_id
     and (r.client_id is null or r.client_id = p.client_id)
  ),
  hidden as (
    select rr.trigger_event
    from ranked_rules as rr
    where rr.precedence = 1 and not rr.visible_in_portal
  )
  select
    n.id,
    n.trigger_event,
    case when n.shipment_id is not null then 'envio' else 'compra' end,
    coalesce(s.code, pa.code),
    nullif(pg_catalog.btrim(n.payload ->> 'title'), ''),
    nullif(pg_catalog.btrim(n.payload ->> 'body'), ''),
    n.channel,
    n.sent_at,
    n.sent_at > coalesce(
      (select seen.last_seen_at
       from public.portal_notification_seen as seen
       where seen.client_user_id = p.client_user_id),
      '-infinity'::timestamptz
    )
  from principal as p
  join public.client_notification_schedule as n
    on n.tenant_id = p.tenant_id
   and n.client_markbox = p.markbox
   and n.status = 'sent'
   and n.sent_at is not null
  left join public.shipments as s
    on s.id = n.shipment_id
   and s.tenant_id = p.tenant_id
   and s.client_markbox = p.markbox
   and s.deleted_at is null
  left join public.prealertas as pa
    on pa.id = n.prealerta_id
   and pa.tenant_id = p.tenant_id
   and pa.client_markbox = p.markbox
   and pa.deleted_at is null
  where (s.id is not null or pa.id is not null)
    and (p_prealerta_id is null or n.prealerta_id = p_prealerta_id)
    and not exists (select 1 from hidden as h where h.trigger_event = n.trigger_event)
  order by n.sent_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$function$;

-- ── 5. Marcar como visto ────────────────────────────────────
create function public.portal_mark_my_notifications_seen(p_hasta timestamptz)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_links uuid[];
  v_seen timestamptz;
begin
  if p_hasta is null then
    raise exception 'falta la fecha del aviso más reciente' using errcode = '22004';
  end if;

  -- FOR SHARE: una revocación concurrente espera a este COMMIT y su trigger
  -- borra la fila recién escrita; sin el lock, la fila sobreviviría al vínculo.
  select pg_catalog.array_agg(l.id) into v_links
  from (
    select cu.id
    from public.client_users as cu
    join public.clients as c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
    for share of cu
  ) as l;

  if coalesce(pg_catalog.array_length(v_links, 1), 0) <> 1 then
    raise exception 'sin vínculo activo del Portal' using errcode = '42501';
  end if;

  insert into public.portal_notification_seen as seen (client_user_id, last_seen_at, updated_at)
  values (v_links[1], least(p_hasta, pg_catalog.now()), pg_catalog.now())
  on conflict (client_user_id) do update
    set last_seen_at = greatest(seen.last_seen_at, excluded.last_seen_at),
        updated_at = pg_catalog.now()
  returning seen.last_seen_at into v_seen;

  return v_seen;
end;
$function$;

alter function public.portal_notification_seen_forget() owner to postgres;
alter function public.portal_list_my_notifications(uuid, integer) owner to postgres;
alter function public.portal_mark_my_notifications_seen(timestamptz) owner to postgres;

revoke all on function public.portal_notification_seen_forget()
  from public, anon, authenticated, service_role;
revoke all on function public.portal_list_my_notifications(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_mark_my_notifications_seen(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.portal_list_my_notifications(uuid, integer) to authenticated;
grant execute on function public.portal_mark_my_notifications_seen(timestamptz) to authenticated;

comment on function public.portal_list_my_notifications(uuid, integer) is
  'SDD-0526: avisos ENVIADOS del cliente Portal autenticado, del más nuevo al más viejo. Identidad derivada de auth.uid(); tenant y Shipping Mark del cliente; ancla viva; respeta Visible en el portal (override del cliente sobre el default). p_prealerta_id sólo acota.';
comment on function public.portal_mark_my_notifications_seen(timestamptz) is
  'SDD-0526: marca como vistos los avisos hasta p_hasta (recortado a now(), nunca retrocede). Sin vínculo activo del Portal: 42501.';

do $postflight$
declare
  v_fn record;
  v_oid oid;
  v_denied boolean := false;
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.portal_notification_seen') and relrowsecurity
  ) then
    raise exception '0479 postflight: portal_notification_seen sin RLS';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'portal_notification_seen'
  ) then
    raise exception '0479 postflight: portal_notification_seen no debe tener policies';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.portal_notification_seen',
       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or pg_catalog.has_table_privilege('authenticated', 'public.portal_notification_seen',
       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or pg_catalog.has_table_privilege('service_role', 'public.portal_notification_seen',
       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') then
    raise exception '0479 postflight: portal_notification_seen quedó con privilegios de API';
  end if;

  for v_fn in select * from (values
    ('public.portal_list_my_notifications(uuid,integer)', true),
    ('public.portal_mark_my_notifications_seen(timestamptz)', true),
    ('public.portal_notification_seen_forget()', false)
  ) as f(signature, api_execute) loop
    v_oid := pg_catalog.to_regprocedure(v_fn.signature);
    if v_oid is null or not exists (
      select 1
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_roles as r on r.oid = p.proowner
      where p.oid = v_oid
        and p.prosecdef
        and r.rolname = 'postgres'
        and exists (
          select 1 from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
          where config ~ '^search_path=("")?$'
        )
    ) then
      raise exception '0479 postflight: % no es SECURITY DEFINER de postgres con search_path vacío', v_fn.signature;
    end if;
    if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') <> v_fn.api_execute then
      raise exception '0479 postflight: ACL inesperada en %', v_fn.signature;
    end if;
  end loop;

  if pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('public.portal_list_my_notifications(uuid,integer)')
     ) ~* '(payload|client_markbox|tenant_id|client_id|rule_id|client_name)' then
    raise exception '0479 postflight: la bandeja expone columnas internas';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.client_users'::pg_catalog.regclass
      and t.tgname = 'client_users_forget_portal_notification_seen'
      and t.tgfoid = pg_catalog.to_regprocedure('public.portal_notification_seen_forget()')
      and t.tgenabled <> 'D' and not t.tgisinternal
      and (t.tgtype & 1) = 1      -- FOR EACH ROW
      and (t.tgtype & 2) = 0      -- AFTER
      and (t.tgtype & 16) = 16    -- UPDATE
  ) then
    raise exception '0479 postflight: el trigger del visto no quedó vivo en client_users';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_index as i
    where i.indexrelid = pg_catalog.to_regclass('public.client_notif_sched_portal_inbox_idx')
      and i.indrelid = 'public.client_notification_schedule'::pg_catalog.regclass
      and i.indpred is not null
  ) then
    raise exception '0479 postflight: falta el índice parcial de la bandeja';
  end if;

  -- Smoke sin sesión: nadie, nada.
  if exists (select 1 from public.portal_list_my_notifications()) then
    raise exception '0479 postflight: sin principal la bandeja devolvió filas';
  end if;
  begin
    perform public.portal_mark_my_notifications_seen(pg_catalog.now());
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception '0479 postflight: sin principal se pudo marcar como visto';
  end if;
end;
$postflight$;

reset lock_timeout;
reset statement_timeout;
