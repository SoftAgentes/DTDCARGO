-- ─────────────────────────────────────────────────────────────
-- 0362 · SDD-0255 — Aliados white-label: entidad, insignia propia y correlativo.
--
-- QUÉ ES UN ALIADO
-- Otra empresa de puerta a puerta que revende el servicio de DTD bajo SU marca y
-- atiende ELLA a sus propios clientes. DTD le trae la carga al aliado, no al
-- cliente final. Hoy: HR (Herneka) y DC (Dynasty Cargo). El founder los marca a
-- mano desde el Studio; no hay detección automática.
--
-- ⚠️ LOS 361 `DTD-<letra>NNN` NO SON ALIADOS.
-- Eran códigos de VENDEDOR (A=Darilis, J=José, D=Darín, Y=Yeglenis, P=Pedro), de
-- una época sin gobernanza de códigos. El concepto ya no existe. Quedan como
-- clientes directos de DTD, con `aliado_id` NULL, y esta migración NO los toca:
-- `add column` nullable sin default no reescribe la tabla.
--
-- LA INSIGNIA ES JERÁRQUICA
-- Un aliado puede tener sub-aliados: Dynasty Cargo (DC) le revende a otro puerta
-- a puerta (FA) que ella captó. El cliente de FA queda `DC-FA-1232`.
--   · forma GUARDADA / en pantalla → `DC-FA-1232` (cadena completa: DTD sabe que
--     ese cliente cuelga de Alexandra)
--   · forma IMPRESA / en documentos → `FA-1232` (sin el segmento raíz: el cliente
--     de FA no debe ver DC)
-- Por eso el prefijo es único GLOBAL por tenant y no por padre: si `FA` existiera
-- bajo DC y bajo HR, `FA-1232` sería ambiguo en el papel. La composición de las
-- dos formas vive en `lib/shared/markbox-chain.ts`.
--
-- POR QUÉ NO SE TOCA `next_markbox`
-- Medido: `'HR-0001' ~ '^DTD-\d+$'` es false. El regex del generador vivo ya
-- excluye cualquier prefijo ajeno, igual que excluye a los 361. Los namespaces
-- son disjuntos POR CONSTRUCCIÓN, así que `next_markbox`,
-- `next_markbox_service` y `ensure_client_markbox` quedan byte-idénticas y el
-- correlativo de los 73 clientes directos sigue en `DTD-9059`.
-- En esas funciones `DTD` aparece DOS veces y hace cosas distintas —en el regex
-- decide qué filas cuentan, en el `return` decide qué se emite—, así que
-- parametrizarlas es justo el cambio que rompe el correlativo. No se hace.
--
-- POR QUÉ EL PARCHE AL DETECTOR VA EN ESTE MISMO ARCHIVO
-- `client_duplicate_candidates` (migr 0341, ampliada por la 0349) marca
-- `es_legado` a todo lo que no matchea `^DTD-\d+$`. `HR-0001` cae ahí, y desde la
-- 0349 el detector además compara legado↔legado: cada cliente de aliado saldría
-- propuesto para fusión contra los 361. `merge_clients` es irreversible. El
-- parche referencia `c.aliado_id`, así que si viajara en otro archivo y se
-- aplicara primero dejaría el detector roto para el legado, que es el caso que
-- hoy sí se usa. Va junto, y ANTES del primer `HR-`.
-- Verificado contra prod el 2026-08-11: el cuerpo vivo es el de la 0349
-- (orientación `case when v.es_legado <> n.es_legado ...` idéntica) y no hay
-- ninguna migración de número mayor que lo redefina.
--
-- EL CANDADO DE FUSIÓN ES UN TRIGGER, NO UN `create or replace`
-- Poner el guard dentro de `merge_clients` obligaría a copiar sus ~200 líneas, y
-- la historia de esta función dice que eso sale mal: la 0345 se escribió con el
-- cuerpo viejo y habría borrado en silencio el candado de rol de la 0358 (ver
-- cabecera de la 0361). Un trigger sobre `clients` es un invariante de datos:
-- sobrevive a cualquier reescritura futura de la función y cubre también a quien
-- llame por otro camino.
--
-- Ref: SDD-0255. Aditiva. No modifica ninguna fila existente.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. La entidad ───────────────────────────────────────────────────────────

create table if not exists public.aliados (
  id               uuid primary key default extensions.gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  -- El cliente-padre: el founder marca un cliente existente como aliado.
  client_id        uuid not null references public.clients(id) on delete restrict,
  -- NULL = aliado raíz, el que tiene la relación comercial con DTD.
  -- No NULL = sub-aliado; hereda la tarifa del raíz y no factura con DTD.
  parent_aliado_id uuid references public.aliados(id) on delete restrict,

  prefix           text not null,   -- 'HR', 'DC', 'FA' — el segmento de la insignia
  trade_name       text not null,   -- 'Herneka', 'Dynasty Cargo'
  status           text not null default 'activo'
                   check (status in ('activo', 'suspendido', 'cerrado')),

  -- Marca white-label. Las columnas nacen acá para no re-migrar cuando llegue la
  -- fase que las consume; hoy nadie las lee todavía.
  brand_name       text,
  brand_primary    text,
  brand_secondary  text,
  brand_logo_path  text,            -- Supabase Storage, nunca git
  support_email    text,
  support_whatsapp text,
  support_website  text,
  hide_dtd_brand   boolean not null default true,

  -- Modelo de cobro. El default es lo que el founder ya decidió en julio
  -- (tarifa fija por CBM, no % de margen). El monto se define aparte.
  billing_model    text not null default 'tarifa_fija'
                   check (billing_model in ('tarifa_fija', 'comision_pct', 'spread')),
  billing_value    numeric(10, 4),

  agreement_notes  text,            -- la descripción del acuerdo, texto libre
  marked_by        uuid references auth.users(id),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  -- 2 a 4 letras mayúsculas. Deja fuera 'H' (ambiguo) y 'HERNEKA' (no es insignia).
  constraint aliados_prefix_fmt check (prefix ~ '^[A-Z]{2,4}$'),
  -- Prefijos reservados: 'DTD' es la casa; 'ITS', 'AD' y 'LEG' ya existen sueltos
  -- en las 10 fichas sin serie del legado y no pueden reclamarse.
  constraint aliados_prefix_reservado check (prefix not in ('DTD', 'ITS', 'AD', 'LEG')),
  -- Un cliente es aliado una sola vez.
  constraint aliados_client_uq unique (client_id)
);

-- Único GLOBAL por tenant: la forma impresa omite la raíz, así que dos aliados
-- con el mismo prefijo harían ambiguo el código en el papel.
create unique index if not exists aliados_prefix_uq
  on public.aliados (tenant_id, upper(prefix))
  where deleted_at is null;

create index if not exists aliados_parent_idx
  on public.aliados (tenant_id, parent_aliado_id)
  where parent_aliado_id is not null and deleted_at is null;

comment on table public.aliados is
  'SDD-0255: empresas que revenden el servicio de DTD bajo su marca y atienden a sus propios clientes. '
  'parent_aliado_id NULL = aliado raíz (el que factura con DTD); no NULL = sub-aliado que cuelga de otro. '
  'El prefijo es único global por tenant porque la forma impresa del Shipping Mark omite el segmento raíz.';

comment on column public.aliados.parent_aliado_id is
  'Aliado del que cuelga éste. NULL = raíz. La tarifa se pacta SIEMPRE con el raíz; los sub-aliados heredan.';

-- ─── 2. La pertenencia del cliente ───────────────────────────────────────────

alter table public.clients
  add column if not exists aliado_id uuid references public.aliados(id) on delete restrict;

create index if not exists clients_aliado_idx
  on public.clients (tenant_id, aliado_id)
  where aliado_id is not null and deleted_at is null;

comment on column public.clients.aliado_id is
  'Aliado MÁS PROFUNDO dueño del cliente (para DC-FA-1232 apunta a FA); la cadena hasta la raíz se '
  'reconstruye por parent_aliado_id. NULL = cliente directo de DTD, incluidas las 361 fichas del '
  'Excel histórico DTD-<letra>NNN, que eran códigos de VENDEDOR y NO son aliados.';

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

alter table public.aliados enable row level security;

drop policy if exists "aliados by tenant" on public.aliados;
create policy "aliados by tenant" on public.aliados
  for all to authenticated
  using      (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "aliados service_role all" on public.aliados;
create policy "aliados service_role all" on public.aliados
  for all to service_role using (true) with check (true);

grant select, insert, update on public.aliados to authenticated;

-- ─── 4. La cadena de prefijos ────────────────────────────────────────────────

create or replace function public.aliado_prefix_chain(p_aliado_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive subida as (
    select a.id, a.parent_aliado_id, a.prefix, 1 as nivel
      from public.aliados a
     where a.id = p_aliado_id
    union all
    select p.id, p.parent_aliado_id, p.prefix, s.nivel + 1
      from public.aliados p
      join subida s on p.id = s.parent_aliado_id
     -- Tope de seguridad: el trigger anti-ciclo lo impide, pero una recursión
     -- sin freno en una función `stable` cuelga la sesión entera.
     where s.nivel < 10
  )
  select string_agg(upper(prefix), '-' order by nivel desc) from subida;
$$;

revoke all on function public.aliado_prefix_chain(uuid) from public, anon, service_role;
grant execute on function public.aliado_prefix_chain(uuid) to authenticated;

comment on function public.aliado_prefix_chain(uuid) is
  'SDD-0255: cadena de prefijos desde la raíz hasta el aliado dado. FA bajo DC devuelve ''DC-FA''. '
  'Es la forma GUARDADA del Shipping Mark; la forma IMPRESA (sólo el último segmento) la compone lib/shared/markbox-chain.ts.';

-- ─── 5. Anti-ciclo ───────────────────────────────────────────────────────────

create or replace function public.aliados_guard_sin_ciclo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cursor uuid := new.parent_aliado_id;
  v_saltos int := 0;
begin
  if new.parent_aliado_id is null then
    return new;
  end if;
  if new.parent_aliado_id = new.id then
    raise exception 'Un aliado no puede colgar de sí mismo' using errcode = '23514';
  end if;

  while v_cursor is not null loop
    v_saltos := v_saltos + 1;
    if v_cursor = new.id then
      raise exception 'La jerarquía de aliados haría un ciclo' using errcode = '23514';
    end if;
    if v_saltos > 10 then
      raise exception 'La jerarquía de aliados es demasiado profunda (máx. 10)' using errcode = '23514';
    end if;
    select parent_aliado_id into v_cursor from public.aliados where id = v_cursor;
  end loop;

  return new;
end;
$$;

drop trigger if exists aliados_guard_sin_ciclo_t on public.aliados;
create trigger aliados_guard_sin_ciclo_t
  before insert or update of parent_aliado_id on public.aliados
  for each row execute function public.aliados_guard_sin_ciclo();

-- ─── 6. El correlativo del aliado ────────────────────────────────────────────

create or replace function public.next_markbox_aliado(p_aliado_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_status text;
  v_chain  text;
  v_max    int;
begin
  select tenant_id, status into v_tenant, v_status
    from public.aliados
   where id = p_aliado_id and deleted_at is null;

  if v_tenant is null then
    raise exception 'Aliado no encontrado' using errcode = '22023';
  end if;

  -- Mismo guard que `next_markbox`: el llamante tiene que ser del tenant.
  perform public.assert_tenant_match(v_tenant);

  if v_status <> 'activo' then
    raise exception 'El aliado no está activo' using errcode = '23514';
  end if;

  v_chain := public.aliado_prefix_chain(p_aliado_id);
  if v_chain is null then
    raise exception 'No se pudo componer la cadena de prefijos del aliado' using errcode = '22023';
  end if;

  -- Cuenta SÓLO las filas de esta cadena exacta. `DC-FA-0007` no empuja el
  -- contador de `DC-`, y ninguna cadena de aliado ve las 73 `DTD-NNNN`.
  select coalesce(max((regexp_match(markbox, '^' || v_chain || '-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.clients
   where tenant_id = v_tenant;

  return v_chain || '-' || lpad(v_max::text, 4, '0');
end;
$$;

-- El registro público anónimo NO puede pedir un código de aliado: la fase de
-- auto-registro traerá una función hermana propia que resuelve el aliado por
-- slug del lado servidor, nunca aceptando un prefijo como texto del cliente.
revoke all on function public.next_markbox_aliado(uuid) from public, anon, service_role;
grant execute on function public.next_markbox_aliado(uuid) to authenticated;

comment on function public.next_markbox_aliado(uuid) is
  'SDD-0255: siguiente Shipping Mark bajo un aliado, en forma guardada (DC-FA-0008). '
  'Correlativo por cadena exacta. NO toca ni lee el correlativo DTD-NNNN. Sin acceso para anon ni service_role.';

-- ─── 7. Coherencia markbox ↔ aliado ──────────────────────────────────────────

create or replace function public.clients_guard_markbox_aliado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain text;
begin
  if new.markbox is null then
    return new;
  end if;

  if new.aliado_id is not null then
    v_chain := public.aliado_prefix_chain(new.aliado_id);
    -- Se permite que un cliente YA EXISTENTE conserve su código al ser adoptado
    -- por un aliado: renumerar es imposible (33 columnas guardan el markbox como
    -- texto y no hay una sola FK por markbox — ver migr 0341). La adopción sólo
    -- se bloquea en filas nuevas.
    if tg_op = 'INSERT' and new.markbox !~ ('^' || v_chain || '-\d+$') then
      raise exception 'Un cliente nuevo de % debe llevar Shipping Mark %-NNNN, no %',
        v_chain, v_chain, new.markbox using errcode = '23514';
    end if;
  else
    -- Sin aliado no se puede llevar la insignia de uno.
    if exists (
      select 1 from public.aliados a
       where a.tenant_id = new.tenant_id
         and a.deleted_at is null
         and new.markbox ~ ('^' || upper(a.prefix) || '-')
    ) then
      raise exception 'El Shipping Mark % usa la insignia de un aliado pero el cliente no tiene aliado asignado',
        new.markbox using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_guard_markbox_aliado_t on public.clients;
create trigger clients_guard_markbox_aliado_t
  before insert or update of markbox, aliado_id on public.clients
  for each row execute function public.clients_guard_markbox_aliado();

-- ─── 8. El detector de duplicados no ve a los aliados ────────────────────────
-- Cuerpo TEXTUAL de la migr 0349 (verificado contra prod el 2026-08-11) con UN
-- solo cambio: `and c.aliado_id is null` en el CTE `vivos`. Un cliente de aliado
-- ni propone ni es propuesto. El diff es de una línea, a propósito.

create or replace function public.client_duplicate_candidates()
returns table(
  legacy_id uuid, legacy_markbox text, legacy_name text,
  new_id uuid, new_markbox text, new_name text,
  match_email boolean, match_phone boolean, match_name boolean,
  match_document boolean, score integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with vivos as (
    select
      c.id, c.markbox, c.name, c.created_at,
      lower(btrim(c.email))                                               as em,
      public.phone_match_key(c.phone)                                     as tel7,
      nullif(upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      lower(btrim(c.name))                                                as nom,
      (c.markbox !~ '^DTD-\d+$')                                          as es_legado
    from public.clients c
    where c.tenant_id = public.get_user_tenant_id()
      and c.deleted_at is null
      and c.merged_into_client_id is null
      -- SDD-0255: los clientes de aliado quedan fuera del detector. Sin esto
      -- `HR-0001` cae en `es_legado` y sale propuesto para fusión contra los 361.
      and c.aliado_id is null
  )
  select
    v.id, v.markbox, v.name,
    n.id, n.markbox, n.name,
    (n.em = v.em and coalesce(n.em, '') <> '')       as match_email,
    (n.tel7 is not null and n.tel7 = v.tel7)          as match_phone,
    (n.nom = v.nom and coalesce(n.nom, '') <> '')    as match_name,
    (n.doc is not null and n.doc = v.doc)             as match_document,
    (case when n.em = v.em and coalesce(n.em, '') <> '' then 2 else 0 end)
      + (case when n.tel7 is not null and n.tel7 = v.tel7 then 2 else 0 end)
      + (case when n.doc is not null and n.doc = v.doc then 3 else 0 end)
      + (case when n.nom = v.nom and coalesce(n.nom, '') <> '' then 1 else 0 end) as score
  from vivos v
  join vivos n
    -- Orientación: UNA fila por par. Ver el encabezado de la migr 0349.
    on (case
          when v.es_legado <> n.es_legado then v.es_legado
          else (v.created_at, v.markbox) < (n.created_at, n.markbox)
        end)
   and (
        (n.em = v.em and coalesce(n.em, '') <> '')
     or (n.tel7 is not null and n.tel7 = v.tel7)
     or (n.doc is not null and n.doc = v.doc)
     or (n.nom = v.nom and coalesce(n.nom, '') <> '')
   )
  order by score desc, v.markbox;
$function$;

comment on function public.client_duplicate_candidates() is
  'SDD-0246 + migr 0349 + SDD-0255: pares de clientes posiblemente duplicados, UNA fila por par. '
  'Compara legado↔nuevo, legado↔legado y nuevo↔nuevo. EXCLUYE a los clientes de aliado. '
  'legacy_*/new_* son superviviente/absorbido PROPUESTOS: entre dos de la misma clase el orden es '
  'estable pero arbitrario. Quién sobrevive lo decide la persona al fusionar.';

-- ─── 9. Ningún cliente de aliado se fusiona ──────────────────────────────────
-- Invariante de datos, no guard dentro de `merge_clients`: la función se
-- reescribe seguido y ya se perdió un candado así (ver cabecera de la 0361).

create or replace function public.clients_guard_no_merge_aliado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.merged_into_client_id is null
     or new.merged_into_client_id is not distinct from old.merged_into_client_id then
    return new;
  end if;

  if new.aliado_id is not null
     or exists (select 1 from public.aliados a where a.client_id = new.id and a.deleted_at is null) then
    raise exception 'Un aliado o un cliente de aliado no se puede fusionar' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.clients c
     where c.id = new.merged_into_client_id
       and (c.aliado_id is not null
            or exists (select 1 from public.aliados a where a.client_id = c.id and a.deleted_at is null))
  ) then
    raise exception 'No se puede fusionar contra un aliado ni contra un cliente de aliado' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists clients_guard_no_merge_aliado_t on public.clients;
create trigger clients_guard_no_merge_aliado_t
  before update of merged_into_client_id on public.clients
  for each row execute function public.clients_guard_no_merge_aliado();
