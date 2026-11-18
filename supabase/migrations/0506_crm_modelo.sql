-- 0506 · SDD-0587 (E6 del programa SDD-0582, paso 6.2) · Modelo de datos del CRM propio.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--    Requiere la 0505 (E10) aplicada antes: reemplaza el cuerpo de
--    chatwoot_segmento_contacto para que delegue en el núcleo de abajo.
--
-- Contrato aprobado (SDD-0587, Sam 2026-10-30, D1–D10 según la recomendación):
-- una tarjeta por persona; el tablero (Leads o Clientes) NO se guarda: sale del
-- segmento calculado en el momento. Studio no guarda texto de mensajes.
--
-- 1. Núcleo de la regla de segmentos por ficha (§4.2.1): una sola definición.
--    `crm_segmento_clientes(tenant, client_ids[])` la calcula en conjunto;
--    `crm_segmento_cliente` es su versión escalar y `chatwoot_segmento_contacto`
--    (0505) pasa a resolver el teléfono y delegar. `crm_segmento_tarjetas` es la
--    puerta para el tablero (authenticated, por tenant y rol).
-- 2. `crm_etapas`: las 7 de Leads (D1) y las 4 de Clientes (D2) por tenant,
--    sembradas y protegidas (`sistema`). El admin cambia nombre, orden y si una
--    etapa propia está activa; las claves no cambian.
-- 3. `crm_tarjetas`: llaves únicas por tenant (ficha, contacto de Chatwoot,
--    BSUID), las dos etapas, asesor, fuente y atribución (fijas al crear) y, solo
--    para el lead sin ficha, nombre visible y últimos 10 dígitos (D6).
-- 4. `crm_historial_etapas`, `crm_tareas`, `crm_notas` y `crm_ids_externos`
--    (mapeo de Kommo para 6.5; se exporta y se borra en 8.11).
-- 5. RPC: `crm_mover_etapa` (manual) y `crm_mover_etapa_auto` (idempotente; un
--    movimiento manual más reciente gana) y `crm_anonimizar_leads_perdidos`
--    (D6: lead sin ficha, perdido y 12 meses sin actividad).
--
-- Acceso: lee y escribe quien tiene el módulo CRM (admin y commercial, como
-- `kommo: ["commercial"]` de lib/studio/rbac.ts); las etapas solo el admin.
-- Las etapas de una tarjeta cambian solo por RPC (sin GRANT de UPDATE).
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.client_markbox_history') is null
     or pg_catalog.to_regclass('public.shipments') is null
     or pg_catalog.to_regclass('public.warehouse_receipts_cn') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regclass('auth.users') is null then
    raise exception '0506 requiere tenants, clients, client_markbox_history, shipments, warehouse_receipts_cn, user_tenants y auth.users';
  end if;
  if pg_catalog.to_regprocedure('public.chatwoot_segmento_contacto(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null then
    raise exception '0506 requiere la 0505 (chatwoot_segmento_contacto), get_user_tenant_id(), current_studio_role() e is_tenant_admin()';
  end if;
  if pg_catalog.to_regclass('public.crm_tarjetas') is not null
     or pg_catalog.to_regclass('public.crm_etapas') is not null
     or pg_catalog.to_regprocedure('public.crm_segmento_clientes(uuid,uuid[])') is not null then
    raise exception '0506: el modelo del CRM ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Núcleo de la regla de segmentos ──────────────────────────────────────
-- Regla de Sam (0.8): cliente = algún envío vivo (no borrado, ni draft ni
-- cancelled) o recibo vivo en China (no borrado, no huérfano; incidencia cuenta)
-- con alguno de sus códigos: el vigente, su historial y los de toda ficha cuya
-- cadena merged_into_client_id llega a ella (hasta 10 saltos), comparados con
-- upper(btrim()). Con ficha y sin eso: lead_registrado. Una ficha borrada o de
-- otro tenant no sale en el resultado.
create function public.crm_segmento_clientes(p_tenant_id uuid, p_client_ids uuid[])
returns table (client_id uuid, segmento text)
language sql
stable
security definer
set search_path = ''
as $fn$
  with recursive entrada as (
    select distinct c.id as raiz
    from public.clients c
    where c.tenant_id = p_tenant_id
      and c.id = any (p_client_ids)
      and c.deleted_at is null
  ), familia as (
    select e.raiz, e.raiz as miembro, 0 as nivel
    from entrada e
    union all
    select f.raiz, m.id, f.nivel + 1
    from familia f
    join public.clients m
      on m.merged_into_client_id = f.miembro and m.tenant_id = p_tenant_id
    where f.nivel < 10
  ), crudos as (
    select f.raiz, m.markbox as codigo
    from familia f join public.clients m on m.id = f.miembro
    union all
    select f.raiz, h.markbox
    from familia f
    join public.client_markbox_history h
      on h.client_id = f.miembro and h.tenant_id = p_tenant_id
  ), codigos as (
    select distinct x.raiz, pg_catalog.upper(pg_catalog.btrim(x.codigo)) as codigo
    from crudos x
    where pg_catalog.btrim(coalesce(x.codigo, '')) <> ''
  )
  select e.raiz,
         case when exists (
                select 1 from codigos k
                join public.shipments s
                  on pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = k.codigo
                where k.raiz = e.raiz
                  and s.tenant_id = p_tenant_id
                  and s.deleted_at is null
                  and s.status::text not in ('draft', 'cancelled')
              ) or exists (
                select 1 from codigos k
                join public.warehouse_receipts_cn r
                  on pg_catalog.upper(pg_catalog.btrim(r.client_markbox)) = k.codigo
                where k.raiz = e.raiz
                  and r.tenant_id = p_tenant_id
                  and r.deleted_at is null
                  and not r.is_orphan
              )
              then 'cliente' else 'lead_registrado' end
  from entrada e;
$fn$;

comment on function public.crm_segmento_clientes(uuid, uuid[]) is
  'SDD-0587 (6.2): núcleo único de la regla de segmentos de Sam (0.8) por ficha y en conjunto: cliente o lead_registrado. Una ficha borrada o de otro tenant no sale. Sin datos personales. Solo service_role.';

create function public.crm_segmento_cliente(p_tenant_id uuid, p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select s.segmento from public.crm_segmento_clientes(p_tenant_id, array[p_client_id]) s),
    'lead_nuevo');
$fn$;

comment on function public.crm_segmento_cliente(uuid, uuid) is
  'SDD-0587 (6.2): segmento de una ficha con el núcleo crm_segmento_clientes; sin ficha viva en el tenant, lead_nuevo. Solo service_role.';

-- La 0505 resolvía el teléfono y repetía la regla; ahora solo resuelve el
-- teléfono (exactamente una ficha viva) y delega. Misma firma y mismos grants.
create or replace function public.chatwoot_segmento_contacto(p_tenant_id uuid, p_phone_last10 text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_cliente uuid;
  v_cruces  integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_segmento_contacto: el tenant es obligatorio' using errcode = '22023';
  end if;
  if p_phone_last10 is null or p_phone_last10 !~ '^[0-9]{10}$' then
    return 'lead_nuevo';
  end if;

  select (pg_catalog.array_agg(c.id))[1], pg_catalog.count(*)
    into v_cliente, v_cruces
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.phone_last10 = p_phone_last10
    and c.deleted_at is null;
  if v_cruces <> 1 then
    return 'lead_nuevo';
  end if;
  return public.crm_segmento_cliente(p_tenant_id, v_cliente);
end;
$fn$;

comment on function public.chatwoot_segmento_contacto(uuid, text) is
  'SDD-0586 (10.1) y SDD-0587 (6.2): segmento del contacto de WhatsApp. Resuelve el teléfono a exactamente una ficha viva y delega la regla en crm_segmento_cliente. No devuelve datos personales. Solo service_role.';

revoke all on function public.crm_segmento_clientes(uuid, uuid[]) from public;
revoke all on function public.crm_segmento_clientes(uuid, uuid[]) from anon, authenticated;
grant execute on function public.crm_segmento_clientes(uuid, uuid[]) to service_role;
revoke all on function public.crm_segmento_cliente(uuid, uuid) from public;
revoke all on function public.crm_segmento_cliente(uuid, uuid) from anon, authenticated;
grant execute on function public.crm_segmento_cliente(uuid, uuid) to service_role;

-- Quién usa el CRM desde la API: admin o commercial del tenant, activo.
create function public.crm_puede_usar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce((select public.current_studio_role()) in ('admin', 'commercial'), false)
     and (select public.get_user_tenant_id()) is not null;
$fn$;

comment on function public.crm_puede_usar() is
  'SDD-0587 (6.2): el usuario tiene el módulo CRM (admin o commercial, como kommo en lib/studio/rbac.ts) y un tenant activo.';

revoke all on function public.crm_puede_usar() from public;
revoke all on function public.crm_puede_usar() from anon;
grant execute on function public.crm_puede_usar() to authenticated, service_role;

-- ─── 2. Etapas ───────────────────────────────────────────────────────────────
create table public.crm_etapas (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  tablero    text not null check (tablero in ('leads', 'clientes')),
  clave      text not null check (clave ~ '^[a-z][a-z0-9_]{1,39}$'),
  nombre     text not null check (pg_catalog.length(pg_catalog.btrim(nombre)) between 1 and 60),
  orden      smallint not null check (orden between 0 and 999),
  terminal   boolean not null default false,
  sistema    boolean not null default false,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, tablero, clave),
  -- Las etapas aprobadas (D1, D2) no se apagan: las mueve el sistema.
  check (activa or not sistema)
);

comment on table public.crm_etapas is
  'SDD-0587 (6.2): etapas de los tableros Leads y Clientes por tenant. Las de sistema son las aprobadas por Sam (D1, D2) y no se apagan ni se borran; el admin cambia nombre y orden y puede sumar etapas propias.';

create function public.crm_sembrar_etapas(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = ''
as $fn$
  insert into public.crm_etapas (tenant_id, tablero, clave, nombre, orden, terminal, sistema)
  values
    (p_tenant_id, 'leads', 'nuevo', 'Nuevo', 10, false, true),
    (p_tenant_id, 'leads', 'contactado', 'Contactado', 20, false, true),
    (p_tenant_id, 'leads', 'registrado_recontacto', 'Registrado / recontacto', 30, false, true),
    (p_tenant_id, 'leads', 'estimado_enviado', 'Estimado enviado', 40, false, true),
    (p_tenant_id, 'leads', 'negociacion', 'Negociación', 50, false, true),
    (p_tenant_id, 'leads', 'aceptado_esperando_carga', 'Aceptado, esperando carga', 60, false, true),
    (p_tenant_id, 'leads', 'perdido', 'Perdido', 90, true, true),
    (p_tenant_id, 'clientes', 'activo', 'Activo', 10, false, true),
    (p_tenant_id, 'clientes', 'postventa', 'Postventa', 20, false, true),
    (p_tenant_id, 'clientes', 'recompra_pendiente', 'Recompra pendiente', 30, false, true),
    (p_tenant_id, 'clientes', 'recompra_en_curso', 'Recompra en curso', 40, false, true)
  on conflict (tenant_id, tablero, clave) do nothing;
$fn$;

comment on function public.crm_sembrar_etapas(uuid) is
  'SDD-0587 (6.2): siembra las 11 etapas aprobadas (D1, D2) en un tenant. Idempotente.';

revoke all on function public.crm_sembrar_etapas(uuid) from public;
revoke all on function public.crm_sembrar_etapas(uuid) from anon, authenticated;
grant execute on function public.crm_sembrar_etapas(uuid) to service_role;

select public.crm_sembrar_etapas(t.id) from public.tenants t;

create function public.crm_sembrar_etapas_tenant_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  perform public.crm_sembrar_etapas(new.id);
  return new;
end;
$fn$;

revoke all on function public.crm_sembrar_etapas_tenant_nuevo() from public;
revoke all on function public.crm_sembrar_etapas_tenant_nuevo() from anon, authenticated;

create trigger crm_sembrar_etapas_tenant_nuevo
  after insert on public.tenants
  for each row execute function public.crm_sembrar_etapas_tenant_nuevo();

alter table public.crm_etapas enable row level security;
create policy crm_etapas_select on public.crm_etapas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_etapas_insert_admin on public.crm_etapas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()) and not sistema);
create policy crm_etapas_update_admin on public.crm_etapas
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy crm_etapas_delete_admin on public.crm_etapas
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()) and not sistema);
create policy crm_etapas_service_role_all on public.crm_etapas
  for all to service_role using (true) with check (true);
revoke all on public.crm_etapas from public, anon, authenticated;
grant select, delete on public.crm_etapas to authenticated;
grant insert (tenant_id, tablero, clave, nombre, orden, terminal) on public.crm_etapas to authenticated;
grant update (nombre, orden, activa) on public.crm_etapas to authenticated;
grant all on public.crm_etapas to service_role;

-- ─── 3. Tarjetas ─────────────────────────────────────────────────────────────
create table public.crm_tarjetas (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  -- Si se purga la ficha, se va su tarjeta (borrado de datos personales).
  client_id                uuid references public.clients(id) on delete cascade,
  chatwoot_contact_id      bigint check (chatwoot_contact_id > 0),
  -- Mismo formato que chatwoot_contactos_bsuid (0505): nunca solo dígitos.
  bsuid                    text check (bsuid ~ '^[A-Za-z0-9._:-]{1,128}$' and bsuid !~ '^[0-9]+$'),
  -- D6: solo para el lead sin ficha; con ficha, esos datos viven en clients.
  nombre_visible           text check (pg_catalog.length(pg_catalog.btrim(nombre_visible)) between 1 and 120),
  phone_last10             text check (phone_last10 ~ '^[0-9]{10}$'),
  tablero_leads            text not null generated always as ('leads') stored,
  etapa_leads              text not null default 'nuevo',
  etapa_leads_at           timestamptz not null default now(),
  etapa_leads_manual_at    timestamptz,
  tablero_clientes         text not null generated always as ('clientes') stored,
  etapa_clientes           text not null default 'activo',
  etapa_clientes_at        timestamptz not null default now(),
  etapa_clientes_manual_at timestamptz,
  motivo_perdida           text check (pg_catalog.length(pg_catalog.btrim(motivo_perdida)) between 1 and 200),
  asesor_id                uuid references auth.users(id) on delete set null,
  fuente                   text not null check (fuente in (
                             'whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo',
                             'web_registro', 'portal', 'cotizador', 'kommo', 'manual')),
  fuente_detalle           text check (pg_catalog.length(fuente_detalle) between 1 and 120),
  utm_source               text check (pg_catalog.length(utm_source) between 1 and 120),
  utm_medium               text check (pg_catalog.length(utm_medium) between 1 and 120),
  utm_campaign             text check (pg_catalog.length(utm_campaign) between 1 and 120),
  utm_content              text check (pg_catalog.length(utm_content) between 1 and 120),
  utm_term                 text check (pg_catalog.length(utm_term) between 1 and 120),
  ultima_actividad_at      timestamptz not null default now(),
  anonimizada_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (tenant_id, tablero_leads, etapa_leads)
    references public.crm_etapas (tenant_id, tablero, clave),
  foreign key (tenant_id, tablero_clientes, etapa_clientes)
    references public.crm_etapas (tenant_id, tablero, clave),
  -- Toda tarjeta viva se puede ubicar: ficha, contacto de Chatwoot, BSUID o, si
  -- la cargaron a mano sin nada de eso, los últimos 10 dígitos (SDD-0587 §4.1).
  check (anonimizada_at is not null or client_id is not null or chatwoot_contact_id is not null
         or bsuid is not null or phone_last10 is not null),
  check (client_id is null or (nombre_visible is null and phone_last10 is null)),
  check (anonimizada_at is null
         or (nombre_visible is null and phone_last10 is null and chatwoot_contact_id is null
             and bsuid is null and motivo_perdida is null))
);

comment on table public.crm_tarjetas is
  'SDD-0587 (6.2): una tarjeta comercial por persona. El tablero sale del segmento en el momento (crm_segmento_tarjetas); aquí solo las dos etapas. Nombre y últimos 10 solo del lead sin ficha (D6), anonimizados a los 12 meses si está perdido. Sin texto de mensajes.';

create unique index crm_tarjetas_client_uq on public.crm_tarjetas (tenant_id, client_id) where client_id is not null;
create unique index crm_tarjetas_contacto_uq on public.crm_tarjetas (tenant_id, chatwoot_contact_id) where chatwoot_contact_id is not null;
create unique index crm_tarjetas_bsuid_uq on public.crm_tarjetas (tenant_id, bsuid) where bsuid is not null;
create index crm_tarjetas_etapa_leads_idx on public.crm_tarjetas (tenant_id, etapa_leads);
create index crm_tarjetas_etapa_clientes_idx on public.crm_tarjetas (tenant_id, etapa_clientes);
create index crm_tarjetas_asesor_idx on public.crm_tarjetas (tenant_id, asesor_id) where asesor_id is not null;
create index crm_tarjetas_phone_idx on public.crm_tarjetas (tenant_id, phone_last10) where phone_last10 is not null;
create index crm_tarjetas_perdidas_idx on public.crm_tarjetas (tenant_id, ultima_actividad_at)
  where etapa_leads = 'perdido' and client_id is null and anonimizada_at is null;

-- Ficha y asesor del mismo tenant; fuente y atribución fijas desde el alta.
create function public.crm_tarjetas_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'crm_tarjetas: la ficha es de otro tenant' using errcode = '23514';
  end if;
  if new.asesor_id is not null
     and (tg_op = 'INSERT' or new.asesor_id is distinct from old.asesor_id)
     and not exists (
       select 1 from public.user_tenants ut
       where ut.user_id = new.asesor_id and ut.tenant_id = new.tenant_id and ut.disabled_at is null
     ) then
    raise exception 'crm_tarjetas: el asesor no es del tenant' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'crm_tarjetas: el tenant no cambia' using errcode = '23514';
    end if;
    if (new.fuente, new.fuente_detalle, new.utm_source, new.utm_medium, new.utm_campaign, new.utm_content, new.utm_term)
       is distinct from
       (old.fuente, old.fuente_detalle, old.utm_source, old.utm_medium, old.utm_campaign, old.utm_content, old.utm_term) then
      raise exception 'crm_tarjetas: la fuente y la atribución se fijan al crear' using errcode = '23514';
    end if;
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$fn$;

revoke all on function public.crm_tarjetas_validar() from public;
revoke all on function public.crm_tarjetas_validar() from anon, authenticated;

create trigger crm_tarjetas_validar
  before insert or update on public.crm_tarjetas
  for each row execute function public.crm_tarjetas_validar();

alter table public.crm_tarjetas enable row level security;
create policy crm_tarjetas_select on public.crm_tarjetas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
-- Desde Studio solo se crean a mano; las demás fuentes las pone service_role (6.4).
create policy crm_tarjetas_insert on public.crm_tarjetas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()) and fuente = 'manual');
create policy crm_tarjetas_update on public.crm_tarjetas
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_tarjetas_service_role_all on public.crm_tarjetas
  for all to service_role using (true) with check (true);
revoke all on public.crm_tarjetas from public, anon, authenticated;
grant select on public.crm_tarjetas to authenticated;
grant insert (tenant_id, client_id, nombre_visible, phone_last10, asesor_id, fuente) on public.crm_tarjetas to authenticated;
grant update (client_id, nombre_visible, phone_last10, asesor_id) on public.crm_tarjetas to authenticated;
grant all on public.crm_tarjetas to service_role;

-- Segmento de varias tarjetas para el tablero: sin ficha viva = lead_nuevo.
-- Solo devuelve el segmento de tarjetas del tenant de quien llama.
create function public.crm_segmento_tarjetas(p_tarjeta_ids uuid[])
returns table (tarjeta_id uuid, segmento text)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_tenant uuid := (select public.get_user_tenant_id());
begin
  if not (select public.crm_puede_usar()) then
    raise exception 'crm_segmento_tarjetas: sin acceso al CRM' using errcode = '42501';
  end if;
  return query
    select t.id, coalesce(s.segmento, 'lead_nuevo')
    from public.crm_tarjetas t
    left join public.crm_segmento_clientes(
      v_tenant,
      array(select t2.client_id from public.crm_tarjetas t2
            where t2.tenant_id = v_tenant and t2.id = any (p_tarjeta_ids) and t2.client_id is not null)
    ) s on s.client_id = t.client_id
    where t.tenant_id = v_tenant and t.id = any (p_tarjeta_ids);
end;
$fn$;

comment on function public.crm_segmento_tarjetas(uuid[]) is
  'SDD-0587 (6.2): segmento de las tarjetas del tenant de quien llama (cliente → tablero Clientes; lead_registrado o lead_nuevo → tablero Leads). Exige el módulo CRM.';

revoke all on function public.crm_segmento_tarjetas(uuid[]) from public;
revoke all on function public.crm_segmento_tarjetas(uuid[]) from anon;
grant execute on function public.crm_segmento_tarjetas(uuid[]) to authenticated;

-- ─── 4. Historial, tareas, notas y mapeo de Kommo ────────────────────────────
create table public.crm_historial_etapas (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  tarjeta_id   uuid not null references public.crm_tarjetas(id) on delete cascade,
  tablero      text not null check (tablero in ('leads', 'clientes')),
  de           text,
  a            text not null,
  origen       text not null check (origen in ('manual', 'automatico', 'migracion')),
  clave_evento text check (pg_catalog.length(clave_evento) between 1 and 200),
  actor_id     uuid references auth.users(id) on delete set null,
  motivo       text check (pg_catalog.length(pg_catalog.btrim(motivo)) between 1 and 200),
  ocurrio_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  check ((origen = 'automatico') = (clave_evento is not null))
);

comment on table public.crm_historial_etapas is
  'SDD-0587 (6.2): cada cambio de etapa (quién, cuándo, de, a, origen). Los automáticos llevan clave de evento única: un evento repetido no mueve dos veces. Solo lo escriben las RPC.';

create unique index crm_historial_clave_uq on public.crm_historial_etapas (tenant_id, clave_evento) where clave_evento is not null;
create index crm_historial_tarjeta_idx on public.crm_historial_etapas (tarjeta_id, id);

alter table public.crm_historial_etapas enable row level security;
create policy crm_historial_select on public.crm_historial_etapas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_historial_service_role_all on public.crm_historial_etapas
  for all to service_role using (true) with check (true);
revoke all on public.crm_historial_etapas from public, anon, authenticated;
grant select on public.crm_historial_etapas to authenticated;
grant all on public.crm_historial_etapas to service_role;

create table public.crm_tareas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  tarjeta_id     uuid not null references public.crm_tarjetas(id) on delete cascade,
  texto          text not null check (pg_catalog.length(pg_catalog.btrim(texto)) between 1 and 1000),
  vence_at       timestamptz,
  asignado_a     uuid references auth.users(id) on delete set null,
  completada_at  timestamptz,
  origen         text not null default 'manual' check (origen in ('manual', 'automatico', 'migracion')),
  clave_evento   text check (pg_catalog.length(clave_evento) between 1 and 200),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.crm_tareas is
  'SDD-0587 (6.2): tareas de una tarjeta. Las automáticas (alerta de ventana de 24 h, D8) llevan clave de evento única por tenant.';

create unique index crm_tareas_clave_uq on public.crm_tareas (tenant_id, clave_evento) where clave_evento is not null;
create index crm_tareas_abiertas_idx on public.crm_tareas (tenant_id, vence_at) where completada_at is null;
create index crm_tareas_tarjeta_idx on public.crm_tareas (tarjeta_id);

create table public.crm_notas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  tarjeta_id uuid not null references public.crm_tarjetas(id) on delete cascade,
  texto      text not null check (pg_catalog.length(pg_catalog.btrim(texto)) between 1 and 4000),
  autor_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.crm_notas is
  'SDD-0587 (6.2): notas de la tarjeta (no del chat, que viven en Chatwoot). Solo se agregan; se borran al anonimizar (D6). Las de Kommo no se migran (D5 b).';

create index crm_notas_tarjeta_idx on public.crm_notas (tarjeta_id, created_at);

-- Tarea y nota: la tarjeta tiene que ser del mismo tenant.
create function public.crm_hijo_mismo_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.crm_tarjetas t where t.id = new.tarjeta_id and t.tenant_id = new.tenant_id
  ) then
    raise exception '%: la tarjeta es de otro tenant', tg_table_name using errcode = '23514';
  end if;
  if tg_table_name = 'crm_tareas' and tg_op = 'UPDATE' then
    if (new.tenant_id, new.tarjeta_id) is distinct from (old.tenant_id, old.tarjeta_id) then
      raise exception 'crm_tareas: la tarea no cambia de tarjeta' using errcode = '23514';
    end if;
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$fn$;

revoke all on function public.crm_hijo_mismo_tenant() from public;
revoke all on function public.crm_hijo_mismo_tenant() from anon, authenticated;

create trigger crm_tareas_mismo_tenant
  before insert or update on public.crm_tareas
  for each row execute function public.crm_hijo_mismo_tenant();
create trigger crm_notas_mismo_tenant
  before insert on public.crm_notas
  for each row execute function public.crm_hijo_mismo_tenant();

alter table public.crm_tareas enable row level security;
create policy crm_tareas_select on public.crm_tareas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_tareas_insert on public.crm_tareas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar())
              and origen = 'manual' and created_by = (select auth.uid()));
create policy crm_tareas_update on public.crm_tareas
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_tareas_service_role_all on public.crm_tareas
  for all to service_role using (true) with check (true);
revoke all on public.crm_tareas from public, anon, authenticated;
grant select on public.crm_tareas to authenticated;
grant insert (tenant_id, tarjeta_id, texto, vence_at, asignado_a, created_by) on public.crm_tareas to authenticated;
grant update (texto, vence_at, asignado_a, completada_at) on public.crm_tareas to authenticated;
grant all on public.crm_tareas to service_role;

alter table public.crm_notas enable row level security;
create policy crm_notas_select on public.crm_notas
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));
create policy crm_notas_insert on public.crm_notas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar())
              and autor_id = (select auth.uid()));
create policy crm_notas_service_role_all on public.crm_notas
  for all to service_role using (true) with check (true);
revoke all on public.crm_notas from public, anon, authenticated;
grant select on public.crm_notas to authenticated;
grant insert (tenant_id, tarjeta_id, texto, autor_id) on public.crm_notas to authenticated;
grant all on public.crm_notas to service_role;

create table public.crm_ids_externos (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  sistema     text not null check (sistema = 'kommo'),
  tipo        text not null check (tipo in ('lead', 'contacto', 'tarea', 'usuario')),
  id_externo  bigint not null check (id_externo > 0),
  tarjeta_id  uuid references public.crm_tarjetas(id) on delete cascade,
  tarea_id    uuid references public.crm_tareas(id) on delete cascade,
  usuario_id  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, sistema, tipo, id_externo),
  check (
    (tipo in ('lead', 'contacto') and tarjeta_id is not null and tarea_id is null and usuario_id is null)
    or (tipo = 'tarea' and tarea_id is not null and tarjeta_id is null and usuario_id is null)
    or (tipo = 'usuario' and usuario_id is not null and tarjeta_id is null and tarea_id is null)
  )
);

comment on table public.crm_ids_externos is
  'SDD-0587 (6.2/6.5): mapeo de IDs de Kommo para que la carga de 6.5 sea idempotente. Por «sin rastro» se exporta cifrado y se borra en 8.11 con las tablas kommo_*. Solo service_role.';

create index crm_ids_externos_tarjeta_idx on public.crm_ids_externos (tarjeta_id) where tarjeta_id is not null;

alter table public.crm_ids_externos enable row level security;
create policy crm_ids_externos_service_role_all on public.crm_ids_externos
  for all to service_role using (true) with check (true);
revoke all on public.crm_ids_externos from public, anon, authenticated;
grant all on public.crm_ids_externos to service_role;

-- ─── 5. Movimientos de etapa y retención ─────────────────────────────────────
-- Movimiento manual desde Studio. «Perdido» (o cualquier etapa terminal) pide
-- motivo. Devuelve true si movió y false si ya estaba ahí.
create function public.crm_mover_etapa(p_tarjeta_id uuid, p_tablero text, p_etapa text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant   uuid := (select public.get_user_tenant_id());
  v_actual   text;
  v_terminal boolean;
  v_motivo   text := nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '');
begin
  if not (select public.crm_puede_usar()) then
    raise exception 'crm_mover_etapa: sin acceso al CRM' using errcode = '42501';
  end if;
  if p_tablero not in ('leads', 'clientes') then
    raise exception 'crm_mover_etapa: tablero desconocido' using errcode = '22023';
  end if;
  select e.terminal into v_terminal
  from public.crm_etapas e
  where e.tenant_id = v_tenant and e.tablero = p_tablero and e.clave = p_etapa and e.activa;
  if not found then
    raise exception 'crm_mover_etapa: etapa inexistente o apagada' using errcode = '22023';
  end if;
  if v_terminal and v_motivo is null then
    raise exception 'crm_mover_etapa: una etapa de cierre pide motivo' using errcode = '22023';
  end if;

  select case when p_tablero = 'leads' then t.etapa_leads else t.etapa_clientes end
    into v_actual
  from public.crm_tarjetas t
  where t.id = p_tarjeta_id and t.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'crm_mover_etapa: tarjeta inexistente' using errcode = '22023';
  end if;
  if v_actual = p_etapa then
    return false;
  end if;

  if p_tablero = 'leads' then
    update public.crm_tarjetas t
    set etapa_leads = p_etapa, etapa_leads_at = pg_catalog.now(), etapa_leads_manual_at = pg_catalog.now(),
        motivo_perdida = case when v_terminal then v_motivo end,
        ultima_actividad_at = pg_catalog.now()
    where t.id = p_tarjeta_id;
  else
    update public.crm_tarjetas t
    set etapa_clientes = p_etapa, etapa_clientes_at = pg_catalog.now(), etapa_clientes_manual_at = pg_catalog.now(),
        ultima_actividad_at = pg_catalog.now()
    where t.id = p_tarjeta_id;
  end if;

  insert into public.crm_historial_etapas (tenant_id, tarjeta_id, tablero, de, a, origen, actor_id, motivo, ocurrio_at)
  values (v_tenant, p_tarjeta_id, p_tablero, v_actual, p_etapa, 'manual', (select auth.uid()), v_motivo, pg_catalog.now());
  return true;
end;
$fn$;

comment on function public.crm_mover_etapa(uuid, text, text, text) is
  'SDD-0587 (6.2): movimiento manual de etapa desde Studio (módulo CRM). Una etapa de cierre pide motivo. Deja historial.';

-- Movimiento automático (cotizador, webhook, cambio de segmento). Devuelve:
--   'movida'         cambió la etapa y dejó historial;
--   'duplicado'      la clave de evento ya se aplicó;
--   'omitido_manual' alguien movió la tarjeta a mano después del evento (gana el manual);
--   'sin_cambio'     ya estaba en esa etapa.
create function public.crm_mover_etapa_auto(
  p_tenant_id uuid, p_tarjeta_id uuid, p_tablero text, p_etapa text,
  p_clave_evento text, p_ocurrio_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actual text;
  v_manual timestamptz;
begin
  if p_tablero not in ('leads', 'clientes') or p_clave_evento is null or p_ocurrio_at is null then
    raise exception 'crm_mover_etapa_auto: tablero, clave y fecha son obligatorios' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.crm_etapas e
    where e.tenant_id = p_tenant_id and e.tablero = p_tablero and e.clave = p_etapa and e.activa
  ) then
    raise exception 'crm_mover_etapa_auto: etapa inexistente o apagada' using errcode = '22023';
  end if;

  select case when p_tablero = 'leads' then t.etapa_leads else t.etapa_clientes end,
         case when p_tablero = 'leads' then t.etapa_leads_manual_at else t.etapa_clientes_manual_at end
    into v_actual, v_manual
  from public.crm_tarjetas t
  where t.id = p_tarjeta_id and t.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'crm_mover_etapa_auto: tarjeta inexistente' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.crm_historial_etapas h
    where h.tenant_id = p_tenant_id and h.clave_evento = p_clave_evento
  ) then
    return 'duplicado';
  end if;
  if v_manual is not null and v_manual > p_ocurrio_at then
    return 'omitido_manual';
  end if;
  if v_actual = p_etapa then
    return 'sin_cambio';
  end if;

  if p_tablero = 'leads' then
    update public.crm_tarjetas t
    set etapa_leads = p_etapa, etapa_leads_at = pg_catalog.now(),
        ultima_actividad_at = greatest(t.ultima_actividad_at, p_ocurrio_at)
    where t.id = p_tarjeta_id;
  else
    update public.crm_tarjetas t
    set etapa_clientes = p_etapa, etapa_clientes_at = pg_catalog.now(),
        ultima_actividad_at = greatest(t.ultima_actividad_at, p_ocurrio_at)
    where t.id = p_tarjeta_id;
  end if;

  insert into public.crm_historial_etapas (tenant_id, tarjeta_id, tablero, de, a, origen, clave_evento, ocurrio_at)
  values (p_tenant_id, p_tarjeta_id, p_tablero, v_actual, p_etapa, 'automatico', p_clave_evento, p_ocurrio_at);
  return 'movida';
end;
$fn$;

comment on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) is
  'SDD-0587 (6.2): movimiento automático e idempotente por clave de evento; si la tarjeta se movió a mano después del evento, gana el manual. Solo service_role.';

-- D6: un lead SIN ficha, perdido y sin actividad en 12 meses se anonimiza: se
-- quitan nombre, teléfono, contacto, BSUID y motivos, y se borran sus notas,
-- tareas y mapeos. La tarjeta queda para los conteos. Devuelve cuántas tocó.
create function public.crm_anonimizar_leads_perdidos(p_tenant_id uuid, p_ahora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ids uuid[];
begin
  select pg_catalog.array_agg(t.id) into v_ids
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id
    and t.client_id is null
    and t.anonimizada_at is null
    and t.etapa_leads = 'perdido'
    and t.ultima_actividad_at < p_ahora - interval '12 months';
  if v_ids is null then
    return 0;
  end if;

  delete from public.crm_notas n where n.tarjeta_id = any (v_ids);
  delete from public.crm_tareas k where k.tarjeta_id = any (v_ids);
  delete from public.crm_ids_externos x where x.tarjeta_id = any (v_ids);
  update public.crm_historial_etapas h set motivo = null where h.tarjeta_id = any (v_ids);
  update public.crm_tarjetas t
  set nombre_visible = null, phone_last10 = null, chatwoot_contact_id = null, bsuid = null,
      motivo_perdida = null, anonimizada_at = p_ahora
  where t.id = any (v_ids);
  return pg_catalog.cardinality(v_ids);
end;
$fn$;

comment on function public.crm_anonimizar_leads_perdidos(uuid, timestamptz) is
  'SDD-0587 (6.2, D6): anonimiza los leads sin ficha perdidos hace más de 12 meses sin actividad. Solo service_role; el cron lo agenda 6.6.';

revoke all on function public.crm_mover_etapa(uuid, text, text, text) from public;
revoke all on function public.crm_mover_etapa(uuid, text, text, text) from anon;
grant execute on function public.crm_mover_etapa(uuid, text, text, text) to authenticated;
revoke all on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) from public;
revoke all on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) from anon, authenticated;
grant execute on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) to service_role;
revoke all on function public.crm_anonimizar_leads_perdidos(uuid, timestamptz) from public;
revoke all on function public.crm_anonimizar_leads_perdidos(uuid, timestamptz) from anon, authenticated;
grant execute on function public.crm_anonimizar_leads_perdidos(uuid, timestamptz) to service_role;
