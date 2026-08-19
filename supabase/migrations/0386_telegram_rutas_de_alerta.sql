-- ─────────────────────────────────────────────────────────────
-- 0386 · SDD-0271 — Rutas de alerta de Telegram.
--
-- QUÉ RESUELVE
--
-- 1. EL AVISO DE REGISTRO LLEGA DOS VECES. No hay doble disparo:
--    `notifyNewClientToAdmin` se llama una sola vez. Lo que hay es un abanico —
--    el aviso recorre los admins del tenant y manda un Telegram por cada uno.
--    Y en producción DOS cuentas admin tienen el MISMO `telegram_chat_id`.
--    Dos admins, un chat, dos mensajes. El correo no se duplica porque los
--    emails sí difieren, que es exactamente lo que se reportó.
--
--    El mismo bucle lo comparten otros nueve módulos (cotizaciones, reportes de
--    pago, packing lists, leads de contacto, estimados, salud del correo,
--    consolidaciones, change requests, salud del alta): todos duplicaban.
--
-- 2. TODO CAE EN EL MISMO CHAT. El ruteo es por USUARIO
--    (`user_profiles.telegram_chat_id`): no existe "esta categoría va a ESTE
--    chat". Un bug crítico, un alta de cliente y el brief diario de operaciones
--    entran al mismo hilo, sin forma de mandar una categoría a otro teléfono.
--
-- CÓMO
--
-- Un chat pasa a ser un DESTINO con nombre propio (`telegram_destinations`), y
-- cada categoría de aviso se dirige a uno o más destinos
-- (`telegram_alert_routes`). El envío deja de ser "uno por destinatario" y pasa
-- a ser "uno por CHAT ÚNICO" — que es lo que arregla (1) de raíz para los diez
-- módulos a la vez, no sólo para el registro.
--
-- ⚠️ UN chat_id NO SE DERIVA DE UN NÚMERO DE TELÉFONO
-- El bot sólo aprende el chat cuando esa cuenta le escribe. Por eso un destino
-- nace PENDIENTE (chat_id null) con un link_code, y se enlaza mandándole
-- `/start <código>` al bot — el mismo flujo que ya enlaza una cuenta de usuario
-- (SDD-0036 Fase 5). Un destino pendiente no recibe nada.
--
-- ⚠️ UNA CATEGORÍA SIN CHAT NO PIERDE EL AVISO
-- Si una categoría no resuelve ningún chat —sin rutas, o con el destino todavía
-- sin enlazar— el aviso cae al comportamiento de HOY: broadcast a los admins del
-- tenant, deduplicado. La configuración a medias nunca silencia una alerta.
--
-- LA SIEMBRA NO HARDCODEA NINGÚN chat_id
-- El destino ya enlazado se siembra LEYENDO el telegram_chat_id que hoy tienen
-- los admins del tenant. Meter el número en el archivo lo dejaría en git para
-- siempre y desincronizado el día que cambie.
--
-- Ref: SDD-0271. Aditiva: no toca user_profiles ni user_notification_prefs, y
-- sin filas de ruta el sistema se comporta igual que antes (menos el duplicado).
-- ─────────────────────────────────────────────────────────────

-- ─── 0. ¿El caller es admin de su tenant? ────────────────────────────────────
-- Helper general. `bitacora_is_tenant_admin()` (migr 0214) hace lo mismo pero su
-- comentario la declara de uso exclusivo de las policies de bitácora, y
-- reescribir una función VIVA de la que cuelgan policies es justo el movimiento
-- que ya borró un candado en silencio. Se crea una nueva y no se toca aquella.

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;

comment on function public.is_tenant_admin is
  'SDD-0271: ¿el caller es admin de su propio tenant? Helper general de policies. '
  'bitacora_is_tenant_admin() (0214) es equivalente pero está declarada de uso exclusivo de bitácora.';

revoke all on function public.is_tenant_admin() from public;
revoke execute on function public.is_tenant_admin() from anon;
grant execute on function public.is_tenant_admin() to authenticated;

-- ─── 1. Las categorías de aviso ──────────────────────────────────────────────

do $seed$
begin
  if not exists (select 1 from pg_type where typname = 'telegram_alert_category') then
    create type public.telegram_alert_category as enum (
      'registro',        -- alta de cliente self-service
      'conversaciones',  -- mensaje entrante del portal del cliente
      'bugs',            -- bug reportado con severidad alta o crítica
      'reportes',        -- brief diario de operaciones y movimientos
      'equipo'           -- el resto de avisos internos al equipo
    );
  end if;
end
$seed$;

-- ─── 2. Los destinos ─────────────────────────────────────────────────────────

create table if not exists public.telegram_destinations (
  id                uuid primary key default extensions.gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  -- Cómo lo llama el equipo en pantalla: "Operaciones", "Comercial", "Sam móvil".
  label             text not null,
  -- NULL = pendiente de enlace. Un destino pendiente no recibe nada.
  chat_id           text,
  -- El código de `/start <código>`. Se limpia al enlazar.
  link_code         text,
  telegram_username text,
  linked_at         timestamptz,
  active            boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint telegram_destinations_label_no_vacio check (btrim(label) <> ''),
  -- Enlazado = tiene chat y sabe cuándo. Las dos o ninguna.
  constraint telegram_destinations_enlace_coherente
    check ((chat_id is null) = (linked_at is null))
);

-- Un chat no puede ser dos destinos del mismo tenant: si lo fuera, una categoría
-- ruteada a los dos volvería a duplicar — el bug que esta migración cierra.
create unique index if not exists telegram_destinations_chat_uq
  on public.telegram_destinations (tenant_id, chat_id)
  where chat_id is not null;

-- El código de enlace es global: el webhook lo busca sin saber de qué tenant es.
create unique index if not exists telegram_destinations_link_code_uq
  on public.telegram_destinations (link_code)
  where link_code is not null;

create index if not exists telegram_destinations_tenant_idx
  on public.telegram_destinations (tenant_id);

comment on table public.telegram_destinations is
  'SDD-0271: un chat de Telegram como destino con nombre propio, desacoplado del usuario. '
  'chat_id NULL = pendiente de enlace (/start <link_code> al bot). Un destino pendiente no recibe nada.';

comment on column public.telegram_destinations.chat_id is
  'chat_id de Telegram. NO se deriva de un número de teléfono: el bot sólo lo aprende cuando esa cuenta le escribe.';

drop trigger if exists telegram_destinations_touch on public.telegram_destinations;
create trigger telegram_destinations_touch
  before update on public.telegram_destinations
  for each row execute function public.touch_updated_at();

-- ─── 3. Las rutas ────────────────────────────────────────────────────────────

create table if not exists public.telegram_alert_routes (
  id             uuid primary key default extensions.gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  category       public.telegram_alert_category not null,
  destination_id uuid not null references public.telegram_destinations(id) on delete cascade,
  created_at     timestamptz not null default now(),

  constraint telegram_alert_routes_uq unique (tenant_id, category, destination_id)
);

create index if not exists telegram_alert_routes_lookup_idx
  on public.telegram_alert_routes (tenant_id, category);

comment on table public.telegram_alert_routes is
  'SDD-0271: qué categorías de aviso van a qué destino. Una categoría puede tener N destinos (el brief '
  'diario va a dos). Una categoría sin rutas —o cuyos destinos están sin enlazar— cae al broadcast de '
  'admins deduplicado: una configuración a medias nunca silencia una alerta.';

-- El destino y la ruta tienen que ser del mismo tenant. Sin esto, un admin podría
-- rutear sus avisos al chat de otro tenant escribiendo un destination_id ajeno.
create or replace function public.telegram_alert_routes_guard_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid;
begin
  select d.tenant_id into v_tenant
    from public.telegram_destinations d
   where d.id = new.destination_id;

  if v_tenant is null then
    raise exception 'El destino de Telegram no existe' using errcode = '23503';
  end if;

  if v_tenant <> new.tenant_id then
    raise exception 'La ruta y el destino de Telegram son de tenants distintos' using errcode = '23514';
  end if;

  return new;
end;
$fn$;

drop trigger if exists telegram_alert_routes_guard_tenant_t on public.telegram_alert_routes;
create trigger telegram_alert_routes_guard_tenant_t
  before insert or update of destination_id, tenant_id on public.telegram_alert_routes
  for each row execute function public.telegram_alert_routes_guard_tenant();

-- ─── 4. RLS · sólo admin del tenant ──────────────────────────────────────────
-- Un chat_id no es una credencial (para usarlo hace falta el token del bot), pero
-- sí es a dónde le suena el teléfono al founder: no tiene por qué verlo el resto
-- del equipo. Configuración de admin.

alter table public.telegram_destinations enable row level security;
alter table public.telegram_alert_routes  enable row level security;

drop policy if exists "telegram_destinations admin del tenant" on public.telegram_destinations;
create policy "telegram_destinations admin del tenant" on public.telegram_destinations
  for all to authenticated
  using      (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));

drop policy if exists "telegram_destinations service_role all" on public.telegram_destinations;
create policy "telegram_destinations service_role all" on public.telegram_destinations
  for all to service_role using (true) with check (true);

drop policy if exists "telegram_alert_routes admin del tenant" on public.telegram_alert_routes;
create policy "telegram_alert_routes admin del tenant" on public.telegram_alert_routes
  for all to authenticated
  using      (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));

drop policy if exists "telegram_alert_routes service_role all" on public.telegram_alert_routes;
create policy "telegram_alert_routes service_role all" on public.telegram_alert_routes
  for all to service_role using (true) with check (true);

-- GRANT antes que policy: sin el GRANT la policy no llega a evaluarse y la tabla
-- se lee como "RLS que niega todo".
grant select, insert, update, delete on public.telegram_destinations to authenticated;
grant select, insert, delete        on public.telegram_alert_routes  to authenticated;

-- ─── 5. Siembra ──────────────────────────────────────────────────────────────
-- Por tenant: un destino YA ENLAZADO con el chat que hoy usan sus admins, y uno
-- PENDIENTE para el segundo teléfono. Idempotente por label.

insert into public.telegram_destinations (tenant_id, label, chat_id, linked_at, telegram_username)
select distinct on (ut.tenant_id)
       ut.tenant_id,
       'Operaciones y bugs',
       up.telegram_chat_id,
       now(),
       up.telegram_username
  from public.user_tenants ut
  join public.user_profiles up on up.user_id = ut.user_id
 where ut.role = 'admin'
   and ut.disabled_at is null
   and up.telegram_chat_id is not null
   and not exists (
     select 1 from public.telegram_destinations d
      where d.tenant_id = ut.tenant_id and d.label = 'Operaciones y bugs'
   )
 -- DISTINCT ON: dos admins pueden compartir chat (es justo el bug que cerramos).
 order by ut.tenant_id, up.telegram_chat_id, ut.user_id;

insert into public.telegram_destinations (tenant_id, label)
select t.id, 'Comercial y clientes'
  from public.tenants t
 where not exists (
   select 1 from public.telegram_destinations d
    where d.tenant_id = t.id and d.label = 'Comercial y clientes'
 );

-- Las rutas del reparto que definió el founder (2026-08-19).
insert into public.telegram_alert_routes (tenant_id, category, destination_id)
select d.tenant_id, c.category, d.id
  from public.telegram_destinations d
  cross join lateral (
    select unnest(
      case d.label
        when 'Operaciones y bugs'   then array['bugs', 'reportes']::public.telegram_alert_category[]
        when 'Comercial y clientes' then array['registro', 'conversaciones', 'equipo', 'reportes']::public.telegram_alert_category[]
        else array[]::public.telegram_alert_category[]
      end
    ) as category
  ) c
 on conflict (tenant_id, category, destination_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0386_telegram_rutas_de_alerta.sql
-- ─────────────────────────────────────────────────────────────
