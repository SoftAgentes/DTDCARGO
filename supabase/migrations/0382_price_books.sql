-- ─────────────────────────────────────────────────────────────
-- 0382 · SDD-0269 — La tarifa del aliado: listas de precios.
--
-- QUÉ RESUELVE
-- Desde la migr 0362 el aliado EXISTE (insignia, jerarquía, correlativo propio)
-- y su ficha muestra «Cobro: Tarifa fija por CBM · El monto se define aparte».
-- Ese «aparte» no existía en ningún lado: `rates` no tiene dimensión de cliente
-- ni de aliado, así que la tarifa pactada con Dynasty Cargo era PROSA en un
-- textarea. Esta migración le da dónde vivir.
--
-- POR QUÉ UNA LISTA Y NO UNA COLUMNA `rates.aliado_id`
-- Una tarifa de aliado ES una tarifa: mismas columnas, mismo vencimiento, mismo
-- importador CSV, mismo cron de aviso. Colgar `aliado_id` de cada fila obliga a
-- filtrar por aliado en los ~6 lugares que hoy leen `rates` y deja la puerta
-- abierta a la fila huérfana (aliado borrado, tarifa viva). La lista es una
-- indirección barata: `rates` gana UNA columna, y quién la usa se decide en un
-- solo punto — `resolve_price_book()`.
--
-- LAS DOS FORMAS DE PACTAR (las dos que pidió el founder)
--   · TARIFA PROPIA   → filas de `rates` dentro de la lista del aliado.
--   · DESCUENTO       → `discount_pct` sobre la tarifa vigente de la casa, sin
--                       tener que copiar una sola fila.
-- Conviven: la tarifa propia manda donde exista; donde no, se aplica el
-- descuento sobre la de la casa. Y `min_charge` NO se descuenta — el piso es un
-- término comercial aparte, no el precio. Eso se DICE en pantalla; una regla
-- que no se ve es una trampa.
--
-- ⚠️ `price_book_id` NACE NULLABLE Y SE RELLENA SOLO
-- `not null` de una haría fallar todo `insert` de código ya desplegado que no
-- conoce la columna — el mismo orden código↔migración que ya rompió producción
-- y que documenta lib/studio/rate-queries.ts:19-28. En su lugar: nullable +
-- backfill + un trigger que rellena con la lista de la casa. NULL nunca queda
-- guardado, y el Studio de hoy sigue insertando tarifas sin enterarse.
--
-- ⚠️ LA PÚBLICA ES SÓLO DE LA CASA
-- Sin candado, el día que alguien marque `is_public` en una tarifa de la lista
-- de Dynasty Cargo, DTD publica el precio negociado de su aliado en su propia
-- calculadora. El índice `rates_one_public_cbm_per_tenant_modo` (migr 0255) hoy
-- lo frena de rebote —una pública por tenant y modalidad—, pero de rebote no es
-- un candado: el día que se borre la fila pública de la casa, la del aliado
-- pasa a ser la del sitio en silencio. El trigger lo dice explícito.
--
-- LA TARIFA SE PACTA CON EL ALIADO RAÍZ (decisión del founder)
-- FA no factura con DTD — a FA le factura Dynasty Cargo. Por eso una lista sólo
-- cuelga de un aliado RAÍZ, y `resolve_price_book()` sube por la jerarquía
-- hasta la raíz antes de buscar. Un cliente de FA cotiza con la tarifa de DC.
--
-- `resolve_price_book()` va con derechos del INVOCANTE, no `security definer`:
-- lee tres tablas que ya tienen RLS por tenant, así que un id de otro tenant
-- devuelve NULL solo. Un definer acá sería regalar un oráculo sin necesidad.
--
-- Ref: SDD-0269. Aditiva. No cambia el precio de ninguna tarifa existente.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. La lista de precios ──────────────────────────────────────────────────

create table if not exists public.price_books (
  id           uuid primary key default extensions.gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- NULL = lista sin dueño: la de la casa, o una futura de mayoristas.
  -- No NULL = la lista de ese aliado, que SIEMPRE es un aliado raíz.
  aliado_id    uuid references public.aliados(id) on delete restrict,
  name         text not null,
  -- La de la casa: la que ve el cliente directo y la única que publica al sitio.
  is_house     boolean not null default false,
  -- Descuento sobre la tarifa de la casa, en porcentaje. NULL = sin descuento.
  discount_pct numeric(5, 2),
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint price_books_name_no_vacio check (btrim(name) <> ''),
  -- La casa no es de nadie. Una lista de aliado nunca es la de la casa.
  constraint price_books_casa_sin_aliado check (not (is_house and aliado_id is not null)),
  -- 0 % no es un descuento (es NULL) y 100 % sería regalar la carga.
  constraint price_books_descuento_rango
    check (discount_pct is null or (discount_pct > 0 and discount_pct < 100))
);

-- UNA sola lista de la casa por tenant: es el fallback de todo el sistema, y dos
-- harían que `resolve_price_book()` eligiera al azar.
create unique index if not exists price_books_casa_uq
  on public.price_books (tenant_id)
  where is_house and deleted_at is null;

-- UNA lista por aliado. Si necesita dos vigencias, son dos filas de `rates`
-- dentro de la misma lista, que para eso tienen valid_from / valid_until.
create unique index if not exists price_books_aliado_uq
  on public.price_books (aliado_id)
  where aliado_id is not null and deleted_at is null;

create index if not exists price_books_tenant_idx
  on public.price_books (tenant_id)
  where deleted_at is null;

comment on table public.price_books is
  'SDD-0269: listas de precios. La de la casa (is_house) es el default de todo cliente directo y la única '
  'que puede publicar al sitio. Una por aliado RAÍZ; los sub-aliados heredan la de su raíz. '
  'Una lista puede tener tarifas propias en `rates`, un `discount_pct` sobre la casa, o las dos: '
  'la tarifa propia manda donde exista, el descuento cubre el resto.';

comment on column public.price_books.discount_pct is
  'Descuento en % sobre la tarifa VIGENTE de la casa, para los tramos donde esta lista no tiene tarifa propia. '
  'Se aplica a per_cbm y flat_rate. NO se aplica a min_charge: el piso es un término comercial aparte.';

drop trigger if exists price_books_touch on public.price_books;
create trigger price_books_touch
  before update on public.price_books
  for each row execute function public.touch_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.price_books enable row level security;

drop policy if exists "price_books by tenant" on public.price_books;
create policy "price_books by tenant" on public.price_books
  for all to authenticated
  using      (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "price_books service_role all" on public.price_books;
create policy "price_books service_role all" on public.price_books
  for all to service_role using (true) with check (true);

grant select, insert, update on public.price_books to authenticated;

-- ─── 3. Una lista sólo cuelga de un aliado RAÍZ, y del mismo tenant ──────────

create or replace function public.price_books_guard_aliado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_parent uuid;
begin
  if new.aliado_id is null then
    return new;
  end if;

  select a.tenant_id, a.parent_aliado_id into v_tenant, v_parent
    from public.aliados a
   where a.id = new.aliado_id and a.deleted_at is null;

  if v_tenant is null then
    raise exception 'El aliado de la lista de precios no existe' using errcode = '23503';
  end if;

  if v_tenant <> new.tenant_id then
    raise exception 'La lista de precios y el aliado son de tenants distintos' using errcode = '23514';
  end if;

  if v_parent is not null then
    raise exception 'La tarifa se pacta con el aliado raíz; un sub-aliado hereda la de su raíz'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists price_books_guard_aliado_t on public.price_books;
create trigger price_books_guard_aliado_t
  before insert or update of aliado_id, tenant_id on public.price_books
  for each row execute function public.price_books_guard_aliado();

-- Y por el otro lado: un aliado con lista propia no puede pasar a colgar de
-- otro. Trigger aparte a propósito — `aliados_guard_sin_ciclo` (migr 0362) es
-- una función viva y reescribirla para meterle esto es justo el movimiento que
-- ya borró un candado en silencio (ver la cabecera de la 0361).

create or replace function public.aliados_guard_raiz_con_lista()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_aliado_id is null
     or new.parent_aliado_id is not distinct from old.parent_aliado_id then
    return new;
  end if;

  if exists (
    select 1 from public.price_books pb
     where pb.aliado_id = new.id and pb.deleted_at is null
  ) then
    raise exception 'Este aliado tiene lista de precios propia: no puede pasar a colgar de otro sin cerrarla antes'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists aliados_guard_raiz_con_lista_t on public.aliados;
create trigger aliados_guard_raiz_con_lista_t
  before update of parent_aliado_id on public.aliados
  for each row execute function public.aliados_guard_raiz_con_lista();

-- ─── 4. La casa, y la columna en `rates` ─────────────────────────────────────

insert into public.price_books (tenant_id, name, is_house, notes)
select t.id, 'Tarifa DTD Cargo', true,
       'La lista de la casa: la que cotiza a todo cliente directo y la única que alimenta la calculadora del sitio.'
  from public.tenants t
 where not exists (
   select 1 from public.price_books pb
    where pb.tenant_id = t.id and pb.is_house and pb.deleted_at is null
 );

alter table public.rates
  add column if not exists price_book_id uuid references public.price_books(id) on delete restrict;

-- Backfill: todo lo que existe hoy es de la casa.
update public.rates r
   set price_book_id = pb.id
  from public.price_books pb
 where pb.tenant_id = r.tenant_id
   and pb.is_house
   and pb.deleted_at is null
   and r.price_book_id is null;

create index if not exists rates_price_book_idx
  on public.rates (tenant_id, price_book_id, service)
  where deleted_at is null;

comment on column public.rates.price_book_id is
  'Lista de precios a la que pertenece esta tarifa. Nunca queda NULL: el trigger rates_guard_price_book_t '
  'la rellena con la de la casa. Nullable en el DDL sólo para que el código ya desplegado, que inserta sin '
  'esta columna, siga funcionando el día del despliegue.';

-- ─── 5. El candado de `rates`: rellenar + no publicar lo ajeno ───────────────

create or replace function public.rates_guard_price_book()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_es_casa boolean;
  v_tenant  uuid;
begin
  -- Toda tarifa vive en una lista. Sin lista explícita → la de la casa.
  if new.price_book_id is null then
    select pb.id into new.price_book_id
      from public.price_books pb
     where pb.tenant_id = new.tenant_id and pb.is_house and pb.deleted_at is null;

    if new.price_book_id is null then
      raise exception 'El tenant no tiene lista de precios de la casa' using errcode = '23502';
    end if;
  end if;

  select pb.is_house, pb.tenant_id into v_es_casa, v_tenant
    from public.price_books pb
   where pb.id = new.price_book_id and pb.deleted_at is null;

  if v_tenant is null then
    raise exception 'La lista de precios de esta tarifa no existe o está cerrada' using errcode = '23503';
  end if;

  if v_tenant <> new.tenant_id then
    raise exception 'La tarifa y su lista de precios son de tenants distintos' using errcode = '23514';
  end if;

  -- Sólo la casa alimenta la calculadora pública. Sin esto, DTD publicaría el
  -- precio negociado de su aliado en su propio sitio.
  if new.is_public and not v_es_casa then
    raise exception 'Sólo una tarifa de la lista de la casa puede ser la pública del sitio'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rates_guard_price_book_t on public.rates;
create trigger rates_guard_price_book_t
  before insert or update of price_book_id, is_public, tenant_id on public.rates
  for each row execute function public.rates_guard_price_book();

-- ─── 6. Qué lista le toca a un cliente ───────────────────────────────────────
-- Sube desde el aliado del cliente hasta la RAÍZ y devuelve su lista; si no hay
-- aliado, o el raíz no tiene lista, devuelve la de la casa.

create or replace function public.resolve_price_book(p_client_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  with recursive cliente as (
    select c.tenant_id, c.aliado_id
      from public.clients c
     where c.id = p_client_id
  ),
  cadena as (
    select a.id, a.parent_aliado_id, 1 as nivel
      from public.aliados a
      join cliente cl on cl.aliado_id = a.id
     where a.deleted_at is null
    union all
    select p.id, p.parent_aliado_id, c.nivel + 1
      from public.aliados p
      join cadena c on p.id = c.parent_aliado_id
     where p.deleted_at is null
       -- Tope de seguridad: el trigger anti-ciclo de la 0362 lo impide, pero una
       -- recursión sin freno en una función `stable` cuelga la sesión entera.
       and c.nivel < 10
  )
  select coalesce(
    (select pb.id
       from public.price_books pb
      where pb.deleted_at is null
        and pb.aliado_id in (select id from cadena where parent_aliado_id is null)
      limit 1),
    (select pb.id
       from public.price_books pb, cliente cl
      where pb.tenant_id = cl.tenant_id
        and pb.is_house
        and pb.deleted_at is null
      limit 1)
  );
$$;

revoke all on function public.resolve_price_book(uuid) from public, anon;
grant execute on function public.resolve_price_book(uuid) to authenticated;

comment on function public.resolve_price_book(uuid) is
  'SDD-0269: la lista de precios que le toca a un cliente. Sube por parent_aliado_id hasta el aliado RAÍZ '
  '(la tarifa se pacta con el raíz; los sub-aliados heredan) y devuelve su lista. Sin aliado, o si el raíz '
  'no tiene lista propia, devuelve la de la casa. Derechos del invocante: un client_id de otro tenant devuelve NULL.';
