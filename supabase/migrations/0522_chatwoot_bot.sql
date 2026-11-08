-- 0522 · SDD-0618 (E7, paso 7.6 b) · dtd-bot: la cola durable del bot propio, apagada.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Migrate-first: se aplica ANTES
--    de fusionar, desde la cabeza aprobada de la PR, primero en prueba y después en
--    producción, cada una con el OK nominal de Sam y el runbook aplicar-migraciones-prod.
--
-- Nace apagada: sin filas en `chatwoot_bot_bandejas` el bot no encola nada, y ninguna
-- bandeja puede quedar en «contesta_solo» sin una excepción IA-01 vigente (7.2).
--
-- 1. `chatwoot_bot_bandejas`: el modo del bot por bandeja (apagado por defecto), horario y
--    opciones. Un trigger rechaza «contesta_solo» sin excepción vigente que nombre la
--    bandeja, y cualquier modo en una bandeja excluida.
-- 2. `chatwoot_bot_excepciones`: la excepción IA-01 acotada (7.2). Vacía al nacer.
-- 3. `chatwoot_bot_bandejas_excluidas`: bandejas donde el bot nunca habla (el Archivo Kommo
--    de SDD-0590 vive en el entorno, no en una tabla: la llena un admin). La bandeja del
--    portal no hace falta ponerla: el corte del portal es por conversación (punto 5).
-- 4. `chatwoot_bot_turnos`: la cola. Un turno abierto (pendiente o tomado) por conversación.
--    Solo ids, fechas y estado: ni texto, ni nombres, ni teléfonos.
-- 5. RPC solo para service_role. `chatwoot_bot_encolar` NO crea turno en una conversación
--    del portal (`chatwoot_portal_hilos`, 0519), en una bandeja excluida, sin bandeja o con
--    la bandeja en apagado. `chatwoot_bot_tomar` reparte con `skip locked` y lease;
--    `chatwoot_bot_cerrar` solo cierra con el lease propio y vigente; `chatwoot_bot_vigilar`
--    pasa a humano lo vencido (watchdog del cron de reintentos).
-- 6. `chatwoot_bot_llamadas`: el costo de cada llamada al motor, sin prompt ni respuesta, y
--    `chatwoot_bot_gasto_mes` (mes de Caracas) para el corte duro de gasto.
-- 7. `chatwoot_bot_latidos`: el latido del trabajador `dtd-bot`.
-- 8. `chatwoot_bot_purgar`: turnos cerrados y llamadas de más de 90 días.
--
-- Datos personales: ninguno. El texto de los mensajes lo lee el trabajador de Chatwoot al
-- generar y no se guarda aquí (SDD-0618 §2 y §10).
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regclass('public.chatwoot_webhook_events') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_hilos') is null then
    raise exception '0522 requiere tenants, get_user_tenant_id(), is_tenant_admin(), 0504 (chatwoot_webhook_events) y 0519 (chatwoot_portal_hilos)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_portal_hilos'::regclass and attname = 'chatwoot_conversation_id' and not attisdropped
  ) then
    raise exception '0522 requiere chatwoot_portal_hilos.chatwoot_conversation_id (0519)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_bot_bandejas') is not null
     or pg_catalog.to_regclass('public.chatwoot_bot_excepciones') is not null
     or pg_catalog.to_regclass('public.chatwoot_bot_bandejas_excluidas') is not null
     or pg_catalog.to_regclass('public.chatwoot_bot_turnos') is not null
     or pg_catalog.to_regclass('public.chatwoot_bot_llamadas') is not null
     or pg_catalog.to_regclass('public.chatwoot_bot_latidos') is not null then
    raise exception '0522: las tablas del bot ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1 a 3. Configuración ────────────────────────────────────────────────────

create table public.chatwoot_bot_excepciones (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- Las bandejas que cubre la excepción (7.2: bandejas, tipos, herramientas, datos, tope…).
  inbox_ids    bigint[] not null check (pg_catalog.cardinality(inbox_ids) between 1 and 50),
  alcance      jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(alcance) = 'object'),
  aprobada_por uuid not null,
  aprobada_at  timestamptz not null default now(),
  revocada_at  timestamptz,
  check (revocada_at is null or revocada_at >= aprobada_at)
);

comment on table public.chatwoot_bot_excepciones is
  'SDD-0618 §4 / IA-01 7.2: la excepción acotada que permite «contesta_solo» en las bandejas que nombra. Vacía al nacer. Revocar = poner revocada_at; el trigger de chatwoot_bot_excepciones_revocar apaga a «sugerir» las bandejas que se quedan sin excepción.';

create table public.chatwoot_bot_bandejas_excluidas (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  inbox_id   bigint not null check (inbox_id > 0),
  motivo     text not null check (motivo ~ '^[a-z0-9_]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, inbox_id)
);

comment on table public.chatwoot_bot_bandejas_excluidas is
  'SDD-0618 §2: bandejas donde el bot nunca habla, por ejemplo el Archivo Kommo (SDD-0590). El portal se corta por conversación (chatwoot_portal_hilos) en chatwoot_bot_encolar.';

create table public.chatwoot_bot_bandejas (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  inbox_id            bigint not null check (inbox_id > 0),
  modo                text not null default 'apagado' check (modo in ('apagado', 'sugerir', 'contesta_solo')),
  -- {"zona":"America/Caracas","dias":[1,2,3,4,5],"desde":"08:00","hasta":"20:00"}; null = todo el día.
  horario             jsonb check (horario is null or pg_catalog.jsonb_typeof(horario) = 'object'),
  solo_primer_mensaje boolean not null default false,
  resolver_calla      boolean not null default true,
  updated_by          uuid,
  updated_at          timestamptz not null default now(),
  primary key (tenant_id, inbox_id)
);

comment on table public.chatwoot_bot_bandejas is
  'SDD-0618 §4 (7.7): el modo del bot por bandeja. Sin fila = apagado. «contesta_solo» exige una excepción IA-01 vigente que nombre la bandeja (trigger).';

create function public.chatwoot_bot_bandejas_guardar() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if new.modo <> 'apagado' and exists (
    select 1 from public.chatwoot_bot_bandejas_excluidas x
    where x.tenant_id = new.tenant_id and x.inbox_id = new.inbox_id
  ) then
    raise exception 'chatwoot_bot: la bandeja % está excluida', new.inbox_id using errcode = 'check_violation';
  end if;
  if new.modo = 'contesta_solo' and not exists (
    select 1 from public.chatwoot_bot_excepciones e
    where e.tenant_id = new.tenant_id and e.revocada_at is null and new.inbox_id = any (e.inbox_ids)
  ) then
    raise exception 'chatwoot_bot: contesta_solo sin excepción IA-01 vigente' using errcode = 'check_violation';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$fn$;

create trigger chatwoot_bot_bandejas_guardar
  before insert or update on public.chatwoot_bot_bandejas
  for each row execute function public.chatwoot_bot_bandejas_guardar();

-- Cualquier cambio en las excepciones (revocar, borrar, sacar una bandeja de `inbox_ids` o
-- cambiar el tenant) recalcula: las bandejas en «contesta_solo» que se quedan sin ninguna
-- excepción vigente bajan a «sugerir». Se recalcula el tenant viejo y el nuevo.
create function public.chatwoot_bot_excepciones_revocar() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenants uuid[] := case tg_op
    when 'DELETE' then array[old.tenant_id]
    when 'INSERT' then array[new.tenant_id]
    else array[old.tenant_id, new.tenant_id]
  end;
begin
  update public.chatwoot_bot_bandejas b
  set modo = 'sugerir'
  where b.tenant_id = any (v_tenants)
    and b.modo = 'contesta_solo'
    and not exists (
      select 1 from public.chatwoot_bot_excepciones e
      where e.tenant_id = b.tenant_id and e.revocada_at is null and b.inbox_id = any (e.inbox_ids)
    );
  return null;
end;
$fn$;

create trigger chatwoot_bot_excepciones_revocar
  after update or delete on public.chatwoot_bot_excepciones
  for each row execute function public.chatwoot_bot_excepciones_revocar();

-- Una bandeja que pasa a excluida queda apagada: al insertar la exclusión y también al
-- moverla a otra bandeja o a otro tenant con un UPDATE.
create function public.chatwoot_bot_excluir() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  update public.chatwoot_bot_bandejas b set modo = 'apagado'
  where b.tenant_id = new.tenant_id and b.inbox_id = new.inbox_id and b.modo <> 'apagado';
  return null;
end;
$fn$;

create trigger chatwoot_bot_excluir
  after insert or update on public.chatwoot_bot_bandejas_excluidas
  for each row execute function public.chatwoot_bot_excluir();

-- ─── 4. La cola ──────────────────────────────────────────────────────────────

create table public.chatwoot_bot_turnos (
  id                bigint generated always as identity primary key,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  conversation_id   bigint not null check (conversation_id > 0),
  inbox_id          bigint not null check (inbox_id > 0),
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'tomado', 'sugerido', 'enviado', 'humano', 'cancelado')),
  motivo            text check (motivo ~ '^[a-z0-9_]{1,40}$'),
  primer_mensaje_at timestamptz not null,
  listo_desde       timestamptz not null,
  limite_at         timestamptz not null,
  ultimo_mensaje_id bigint not null check (ultimo_mensaje_id > 0),
  trabajador        text check (trabajador ~ '^[A-Za-z0-9._:-]{1,64}$'),
  lease_hasta       timestamptz,
  intentos          integer not null default 0 check (intentos >= 0),
  created_at        timestamptz not null default now(),
  cerrado_at        timestamptz,
  check (limite_at >= primer_mensaje_at),
  check (listo_desde <= limite_at),
  check ((estado = 'tomado') = (lease_hasta is not null and trabajador is not null)),
  check ((estado in ('pendiente', 'tomado')) = (cerrado_at is null)),
  check (estado not in ('humano', 'cancelado') or motivo is not null)
);

create unique index chatwoot_bot_turnos_abierto_idx
  on public.chatwoot_bot_turnos (tenant_id, conversation_id)
  where estado in ('pendiente', 'tomado');
create index chatwoot_bot_turnos_listo_idx
  on public.chatwoot_bot_turnos (listo_desde)
  where estado = 'pendiente';
create index chatwoot_bot_turnos_conversacion_idx
  on public.chatwoot_bot_turnos (tenant_id, conversation_id, created_at);
create index chatwoot_bot_turnos_cerrado_idx
  on public.chatwoot_bot_turnos (cerrado_at)
  where cerrado_at is not null;

comment on table public.chatwoot_bot_turnos is
  'SDD-0618 §3: la cola durable de dtd-bot, escrita antes del 2xx del webhook. Un turno abierto por conversación. Sin texto ni datos de la persona.';

-- ─── 6 y 7. Costo y latido ───────────────────────────────────────────────────

create table public.chatwoot_bot_llamadas (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  turno_id       bigint references public.chatwoot_bot_turnos(id) on delete set null,
  proveedor      text not null check (proveedor ~ '^[a-z0-9._-]{1,40}$'),
  modelo         text not null check (modelo ~ '^[A-Za-z0-9._:/-]{1,64}$'),
  tokens_entrada integer not null check (tokens_entrada >= 0),
  tokens_salida  integer not null check (tokens_salida >= 0),
  costo_usd      numeric(12, 6) not null check (costo_usd >= 0),
  costo_estimado boolean not null,
  resultado      text not null check (resultado in ('ok', 'timeout', 'error', 'respuesta_invalida')),
  duracion_ms    integer not null check (duracion_ms >= 0),
  created_at     timestamptz not null default now()
);

create index chatwoot_bot_llamadas_mes_idx on public.chatwoot_bot_llamadas (tenant_id, created_at);

comment on table public.chatwoot_bot_llamadas is
  'SDD-0618 §3.3: una fila por llamada al motor, también las fallidas (con el peor caso). Sin prompt ni respuesta.';

create table public.chatwoot_bot_latidos (
  trabajador text primary key check (trabajador ~ '^[A-Za-z0-9._:-]{1,64}$'),
  ultimo_at  timestamptz not null default now()
);

comment on table public.chatwoot_bot_latidos is
  'SDD-0618 §2: el latido del trabajador dtd-bot; el watchdog del cron de reintentos lo lee.';

-- ─── Permisos: escribe service_role; el admin del tenant lee ────────────────

alter table public.chatwoot_bot_bandejas enable row level security;
alter table public.chatwoot_bot_excepciones enable row level security;
alter table public.chatwoot_bot_bandejas_excluidas enable row level security;
alter table public.chatwoot_bot_turnos enable row level security;
alter table public.chatwoot_bot_llamadas enable row level security;
alter table public.chatwoot_bot_latidos enable row level security;

create policy chatwoot_bot_bandejas_service_role on public.chatwoot_bot_bandejas
  for all to service_role using (true) with check (true);
create policy chatwoot_bot_excepciones_service_role on public.chatwoot_bot_excepciones
  for all to service_role using (true) with check (true);
create policy chatwoot_bot_bandejas_excluidas_service_role on public.chatwoot_bot_bandejas_excluidas
  for all to service_role using (true) with check (true);
create policy chatwoot_bot_turnos_service_role on public.chatwoot_bot_turnos
  for all to service_role using (true) with check (true);
create policy chatwoot_bot_llamadas_service_role on public.chatwoot_bot_llamadas
  for all to service_role using (true) with check (true);
create policy chatwoot_bot_latidos_service_role on public.chatwoot_bot_latidos
  for all to service_role using (true) with check (true);

create policy chatwoot_bot_bandejas_admin_lee on public.chatwoot_bot_bandejas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy chatwoot_bot_excepciones_admin_lee on public.chatwoot_bot_excepciones
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy chatwoot_bot_bandejas_excluidas_admin_lee on public.chatwoot_bot_bandejas_excluidas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy chatwoot_bot_turnos_admin_lee on public.chatwoot_bot_turnos
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy chatwoot_bot_llamadas_admin_lee on public.chatwoot_bot_llamadas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));

revoke all on public.chatwoot_bot_bandejas from public, anon, authenticated;
revoke all on public.chatwoot_bot_excepciones from public, anon, authenticated;
revoke all on public.chatwoot_bot_bandejas_excluidas from public, anon, authenticated;
revoke all on public.chatwoot_bot_turnos from public, anon, authenticated;
revoke all on public.chatwoot_bot_llamadas from public, anon, authenticated;
revoke all on public.chatwoot_bot_latidos from public, anon, authenticated;
grant select on public.chatwoot_bot_bandejas to authenticated;
grant select on public.chatwoot_bot_excepciones to authenticated;
grant select on public.chatwoot_bot_bandejas_excluidas to authenticated;
grant select on public.chatwoot_bot_turnos to authenticated;
grant select on public.chatwoot_bot_llamadas to authenticated;
grant all on public.chatwoot_bot_bandejas to service_role;
grant all on public.chatwoot_bot_excepciones to service_role;
grant all on public.chatwoot_bot_bandejas_excluidas to service_role;
grant all on public.chatwoot_bot_turnos to service_role;
grant all on public.chatwoot_bot_llamadas to service_role;
grant all on public.chatwoot_bot_latidos to service_role;

-- ─── 5. RPC de la cola (solo service_role) ───────────────────────────────────

-- Abre o extiende el turno de la conversación. Devuelve el turno, si es nuevo y, cuando no
-- encola, por qué: portal | excluida | sin_bandeja | apagado | duplicado.
-- Idempotente por mensaje: los ids de mensaje de Chatwoot crecen, así que uno que no es mayor
-- que el último visto en la conversación ya se encoló (o es un reintento del webhook).
create function public.chatwoot_bot_encolar(
  p_tenant_id       uuid,
  p_conversation_id bigint,
  p_inbox_id        bigint,
  p_mensaje_id      bigint,
  p_llegada         timestamptz,
  p_inactividad_ms  integer default 8000,
  p_maximo_ms       integer default 24000
) returns table (turno_id bigint, nuevo boolean, motivo text)
language plpgsql security definer set search_path = '' as $fn$
declare
  v_modo   text;
  v_turno  public.chatwoot_bot_turnos%rowtype;
  v_visto  bigint;
  v_listo  timestamptz;
  v_id     bigint;
begin
  if p_tenant_id is null or p_conversation_id is null or p_conversation_id <= 0
     or p_inbox_id is null or p_inbox_id <= 0 or p_mensaje_id is null or p_mensaje_id <= 0
     or p_llegada is null
     or p_inactividad_ms is null or p_inactividad_ms not between 1000 and 60000
     or p_maximo_ms is null or p_maximo_ms not between p_inactividad_ms and 120000 then
    raise exception 'chatwoot_bot_encolar: argumentos inválidos' using errcode = 'invalid_parameter_value';
  end if;

  -- El portal nunca: la conversación es un hilo del portal (0519).
  if exists (
    select 1 from public.chatwoot_portal_hilos h
    where h.tenant_id = p_tenant_id and h.chatwoot_conversation_id = p_conversation_id
  ) then
    return query select null::bigint, false, 'portal'::text;
    return;
  end if;
  if exists (
    select 1 from public.chatwoot_bot_bandejas_excluidas x
    where x.tenant_id = p_tenant_id and x.inbox_id = p_inbox_id
  ) then
    return query select null::bigint, false, 'excluida'::text;
    return;
  end if;
  select b.modo into v_modo from public.chatwoot_bot_bandejas b
  where b.tenant_id = p_tenant_id and b.inbox_id = p_inbox_id;
  if v_modo is null then
    return query select null::bigint, false, 'sin_bandeja'::text;
    return;
  end if;
  if v_modo = 'apagado' then
    return query select null::bigint, false, 'apagado'::text;
    return;
  end if;

  -- Serializa por conversación (dos entregas del mismo mensaje, o dos mensajes seguidos).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_conversation_id::text, 22));

  select pg_catalog.max(t.ultimo_mensaje_id) into v_visto
  from public.chatwoot_bot_turnos t
  where t.tenant_id = p_tenant_id and t.conversation_id = p_conversation_id;
  if v_visto is not null and p_mensaje_id <= v_visto then
    return query select null::bigint, false, 'duplicado'::text;
    return;
  end if;

  select * into v_turno from public.chatwoot_bot_turnos t
  where t.tenant_id = p_tenant_id and t.conversation_id = p_conversation_id and t.estado in ('pendiente', 'tomado')
  for update;

  if found then
    -- Otro mensaje del cliente: corre la espera sin pasar del límite; nunca la adelanta.
    v_listo := least(p_llegada + pg_catalog.make_interval(secs => p_inactividad_ms / 1000.0), v_turno.limite_at);
    update public.chatwoot_bot_turnos t
    set ultimo_mensaje_id = p_mensaje_id,
        listo_desde = greatest(t.listo_desde, v_listo)
    where t.id = v_turno.id;
    return query select v_turno.id, false, null::text;
    return;
  end if;

  insert into public.chatwoot_bot_turnos (tenant_id, conversation_id, inbox_id, primer_mensaje_at, listo_desde, limite_at, ultimo_mensaje_id)
  values (
    p_tenant_id, p_conversation_id, p_inbox_id, p_llegada,
    p_llegada + pg_catalog.make_interval(secs => p_inactividad_ms / 1000.0),
    p_llegada + pg_catalog.make_interval(secs => p_maximo_ms / 1000.0),
    p_mensaje_id
  )
  returning id into v_id;
  return query select v_id, true, null::text;
end;
$fn$;

-- Reparte turnos listos: pendientes cuya espera o límite ya pasó. `skip locked`: dos
-- trabajadores no toman el mismo. Cada uno sale con su lease.
create function public.chatwoot_bot_tomar(
  p_trabajador text,
  p_limite     integer default 5,
  p_lease_s    integer default 60
) returns setof public.chatwoot_bot_turnos
language plpgsql security definer set search_path = '' as $fn$
begin
  if p_trabajador is null or p_trabajador !~ '^[A-Za-z0-9._:-]{1,64}$'
     or p_limite is null or p_limite not between 1 and 50
     or p_lease_s is null or p_lease_s not between 10 and 600 then
    raise exception 'chatwoot_bot_tomar: argumentos inválidos' using errcode = 'invalid_parameter_value';
  end if;
  return query
  with listos as (
    select t.id from public.chatwoot_bot_turnos t
    where t.estado = 'pendiente'
      and (t.listo_desde <= pg_catalog.now() or t.limite_at <= pg_catalog.now())
    order by t.listo_desde, t.id
    limit p_limite
    for update skip locked
  )
  update public.chatwoot_bot_turnos t
  set estado = 'tomado',
      trabajador = p_trabajador,
      lease_hasta = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_s),
      intentos = t.intentos + 1
  from listos
  where t.id = listos.id
  returning t.*;
end;
$fn$;

-- Cierra un turno tomado, solo con el lease propio y vigente. `pendiente` lo suelta (el
-- cliente sigue escribiendo: decisión «esperar»). Devuelve si cerró.
create function public.chatwoot_bot_cerrar(
  p_turno_id   bigint,
  p_trabajador text,
  p_estado     text,
  p_motivo     text default null
) returns boolean
language plpgsql security definer set search_path = '' as $fn$
begin
  if p_estado is null or p_estado not in ('pendiente', 'sugerido', 'enviado', 'humano', 'cancelado') then
    raise exception 'chatwoot_bot_cerrar: estado inválido' using errcode = 'invalid_parameter_value';
  end if;
  update public.chatwoot_bot_turnos t
  set estado = p_estado,
      motivo = p_motivo,
      trabajador = case when p_estado = 'pendiente' then null else t.trabajador end,
      lease_hasta = null,
      cerrado_at = case when p_estado = 'pendiente' then null else pg_catalog.now() end
  where t.id = p_turno_id
    and t.estado = 'tomado'
    and t.trabajador = p_trabajador
    and t.lease_hasta > pg_catalog.now();
  return found;
end;
$fn$;

-- Cancela el turno abierto de la conversación: escribió una persona, se resolvió o se
-- apagó. Devuelve cuántos canceló (0 o 1). Un turno tomado también se cancela: el trabajador
-- lo nota en su comprobación previa (su `cerrar` ya no encuentra el turno tomado).
create function public.chatwoot_bot_invalidar(
  p_tenant_id       uuid,
  p_conversation_id bigint,
  p_motivo          text
) returns integer
language plpgsql security definer set search_path = '' as $fn$
declare v integer;
begin
  if p_motivo is null or p_motivo !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'chatwoot_bot_invalidar: motivo inválido' using errcode = 'invalid_parameter_value';
  end if;
  update public.chatwoot_bot_turnos t
  set estado = 'cancelado', motivo = p_motivo, trabajador = null, lease_hasta = null, cerrado_at = pg_catalog.now()
  where t.tenant_id = p_tenant_id and t.conversation_id = p_conversation_id and t.estado in ('pendiente', 'tomado');
  get diagnostics v = row_count;
  return v;
end;
$fn$;

-- Watchdog: pasa a humano lo tomado con lease vencido y lo pendiente que pasó su límite
-- hace más de `p_gracia_s` sin que nadie lo tomara (trabajador caído). Nunca se envía tarde.
create function public.chatwoot_bot_vigilar(p_gracia_s integer default 60)
returns table (lease_vencido integer, sin_trabajador integer)
language plpgsql security definer set search_path = '' as $fn$
declare
  v_lease integer;
  v_sin   integer;
begin
  if p_gracia_s is null or p_gracia_s not between 0 and 3600 then
    raise exception 'chatwoot_bot_vigilar: gracia inválida' using errcode = 'invalid_parameter_value';
  end if;
  update public.chatwoot_bot_turnos t
  set estado = 'humano', motivo = 'lease_vencido', trabajador = null, lease_hasta = null, cerrado_at = pg_catalog.now()
  where t.estado = 'tomado' and t.lease_hasta <= pg_catalog.now();
  get diagnostics v_lease = row_count;
  update public.chatwoot_bot_turnos t
  set estado = 'humano', motivo = 'sin_trabajador', cerrado_at = pg_catalog.now()
  where t.estado = 'pendiente' and t.limite_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_gracia_s);
  get diagnostics v_sin = row_count;
  return query select v_lease, v_sin;
end;
$fn$;

create function public.chatwoot_bot_latir(p_trabajador text) returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if p_trabajador is null or p_trabajador !~ '^[A-Za-z0-9._:-]{1,64}$' then
    raise exception 'chatwoot_bot_latir: trabajador inválido' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.chatwoot_bot_latidos (trabajador, ultimo_at) values (p_trabajador, pg_catalog.now())
  on conflict (trabajador) do update set ultimo_at = excluded.ultimo_at;
end;
$fn$;

create function public.chatwoot_bot_anotar_llamada(
  p_tenant_id      uuid,
  p_turno_id       bigint,
  p_proveedor      text,
  p_modelo         text,
  p_tokens_entrada integer,
  p_tokens_salida  integer,
  p_costo_usd      numeric,
  p_costo_estimado boolean,
  p_resultado      text,
  p_duracion_ms    integer
) returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id bigint;
begin
  -- El turno, si viene, tiene que ser del mismo tenant: el costo cuenta en el gasto de ese tenant.
  if p_turno_id is not null and not exists (
    select 1 from public.chatwoot_bot_turnos t where t.id = p_turno_id and t.tenant_id = p_tenant_id
  ) then
    raise exception 'chatwoot_bot_anotar_llamada: el turno no es de ese tenant' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.chatwoot_bot_llamadas (tenant_id, turno_id, proveedor, modelo, tokens_entrada, tokens_salida,
    costo_usd, costo_estimado, resultado, duracion_ms)
  values (p_tenant_id, p_turno_id, p_proveedor, p_modelo, p_tokens_entrada, p_tokens_salida,
    p_costo_usd, p_costo_estimado, p_resultado, p_duracion_ms)
  returning id into v_id;
  return v_id;
end;
$fn$;

-- Gasto del mes en curso, con el mes de Caracas (el corte duro de SDD-0618 §3.3).
create function public.chatwoot_bot_gasto_mes(p_tenant_id uuid) returns numeric
language sql stable security definer set search_path = '' as $fn$
  select coalesce(pg_catalog.sum(l.costo_usd), 0)::numeric
  from public.chatwoot_bot_llamadas l
  where l.tenant_id = p_tenant_id
    and l.created_at >= (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Caracas') at time zone 'America/Caracas');
$fn$;

-- Purga por plazo: turnos cerrados y llamadas de más de 90 días.
create function public.chatwoot_bot_purgar() returns integer
language plpgsql security definer set search_path = '' as $fn$
declare
  v_turnos   integer;
  v_llamadas integer;
begin
  delete from public.chatwoot_bot_llamadas l where l.created_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_llamadas = row_count;
  delete from public.chatwoot_bot_turnos t where t.cerrado_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_turnos = row_count;
  return v_turnos + v_llamadas;
end;
$fn$;

revoke all on function public.chatwoot_bot_bandejas_guardar() from public, anon, authenticated;
revoke all on function public.chatwoot_bot_excepciones_revocar() from public, anon, authenticated;
revoke all on function public.chatwoot_bot_excluir() from public, anon, authenticated;
revoke all on function public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_tomar(text, integer, integer) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_cerrar(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_invalidar(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_vigilar(integer) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_latir(text) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_anotar_llamada(uuid, bigint, text, text, integer, integer, numeric, boolean, text, integer) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_gasto_mes(uuid) from public, anon, authenticated;
revoke all on function public.chatwoot_bot_purgar() from public, anon, authenticated;
grant execute on function public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer) to service_role;
grant execute on function public.chatwoot_bot_tomar(text, integer, integer) to service_role;
grant execute on function public.chatwoot_bot_cerrar(bigint, text, text, text) to service_role;
grant execute on function public.chatwoot_bot_invalidar(uuid, bigint, text) to service_role;
grant execute on function public.chatwoot_bot_vigilar(integer) to service_role;
grant execute on function public.chatwoot_bot_latir(text) to service_role;
grant execute on function public.chatwoot_bot_anotar_llamada(uuid, bigint, text, text, integer, integer, numeric, boolean, text, integer) to service_role;
grant execute on function public.chatwoot_bot_gasto_mes(uuid) to service_role;
grant execute on function public.chatwoot_bot_purgar() to service_role;

-- ─── Postflight: lo que la migración promete, comprobado en el catálogo ─────
do $postflight$
declare
  v_firma text;
  v_tabla text;
begin
  -- Las 9 RPC y las 3 funciones de trigger: security definer con search_path vacío y sin
  -- EXECUTE para anon ni authenticated. Las RPC, además, sí para service_role.
  foreach v_firma in array array[
    'public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer)',
    'public.chatwoot_bot_tomar(text, integer, integer)',
    'public.chatwoot_bot_cerrar(bigint, text, text, text)',
    'public.chatwoot_bot_invalidar(uuid, bigint, text)',
    'public.chatwoot_bot_vigilar(integer)',
    'public.chatwoot_bot_latir(text)',
    'public.chatwoot_bot_anotar_llamada(uuid, bigint, text, text, integer, integer, numeric, boolean, text, integer)',
    'public.chatwoot_bot_gasto_mes(uuid)',
    'public.chatwoot_bot_purgar()',
    'public.chatwoot_bot_bandejas_guardar()',
    'public.chatwoot_bot_excepciones_revocar()',
    'public.chatwoot_bot_excluir()'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_firma)
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0522: % no quedó security definer con search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_firma, 'EXECUTE') then
      raise exception '0522: % no puede ser de anon ni de authenticated', v_firma;
    end if;
    if v_firma not like '%()' or v_firma = 'public.chatwoot_bot_purgar()' then
      if not pg_catalog.has_function_privilege('service_role', v_firma, 'EXECUTE') then
        raise exception '0522: % tiene que ser de service_role', v_firma;
      end if;
    end if;
  end loop;

  -- Los 3 triggers, activos, en sus tablas.
  if (
    select pg_catalog.count(*) from pg_catalog.pg_trigger t
    where not t.tgisinternal and t.tgenabled = 'O'
      and (t.tgfoid, t.tgrelid) in (
        (pg_catalog.to_regprocedure('public.chatwoot_bot_bandejas_guardar()'), pg_catalog.to_regclass('public.chatwoot_bot_bandejas')),
        (pg_catalog.to_regprocedure('public.chatwoot_bot_excepciones_revocar()'), pg_catalog.to_regclass('public.chatwoot_bot_excepciones')),
        (pg_catalog.to_regprocedure('public.chatwoot_bot_excluir()'), pg_catalog.to_regclass('public.chatwoot_bot_bandejas_excluidas'))
      )
  ) <> 3 then
    raise exception '0522: faltan los 3 triggers del bot, activos';
  end if;

  -- RLS en las 6 tablas; anon sin nada; authenticated solo SELECT en las 5 que lee el admin.
  foreach v_tabla in array array[
    'public.chatwoot_bot_bandejas', 'public.chatwoot_bot_excepciones', 'public.chatwoot_bot_bandejas_excluidas',
    'public.chatwoot_bot_turnos', 'public.chatwoot_bot_llamadas', 'public.chatwoot_bot_latidos'
  ] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass(v_tabla)) then
      raise exception '0522: % sin RLS', v_tabla;
    end if;
    if pg_catalog.has_table_privilege('anon', v_tabla, 'SELECT, INSERT, UPDATE, DELETE')
       or pg_catalog.has_table_privilege('authenticated', v_tabla, 'INSERT, UPDATE, DELETE') then
      raise exception '0522: % tiene escritura o lectura de más', v_tabla;
    end if;
    if pg_catalog.has_table_privilege('authenticated', v_tabla, 'SELECT') <> (v_tabla <> 'public.chatwoot_bot_latidos') then
      raise exception '0522: el SELECT de authenticated en % no es el esperado', v_tabla;
    end if;
  end loop;
end;
$postflight$;
