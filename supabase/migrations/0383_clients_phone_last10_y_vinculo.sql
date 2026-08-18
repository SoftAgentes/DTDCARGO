-- SDD-0270 · El vínculo cliente ↔ contacto de Kommo deja de depender del azar.
--
-- QUÉ PASA HOY. El vínculo (`clients.kommo_contact_id`) sólo se establece de
-- forma REACTIVA: el webhook cruza por teléfono cuando entra un lead nuevo y
-- auto-sana ESE cliente. Los 447 clientes y los 3.161 contactos que ya estaban
-- nunca se cruzaron entre sí. Medido 2026-08-14: 32 vinculados (7,2%), y de los
-- 2 clientes con saldo y 6 con carga navegando, CERO están vinculados. O sea que
-- el job de estado comercial (SDD-0256 B4) hoy no le escribe nada a nadie.
--
-- Esta migración trae dos piezas:
--
--   1. `clients.phone_last10` GENERADA — el gemelo exacto de la de
--      `kommo_contacts` (0363). Hoy `clients` sólo tiene un ÍNDICE sobre la
--      expresión, y un índice no se puede filtrar desde PostgREST: por eso el
--      enrutador se traía la tabla entera y comparaba en memoria.
--
--   2. `kommo_vincular_clientes_por_telefono()` — el barrido que aplica UNA VEZ
--      el mismo criterio que ya aplica el enrutador en vivo.
--
-- ⚠️ POR QUÉ LA COLUMNA NO ES COSMÉTICA. `loadPhoneUniverse`
-- (kommo-webhook/index.ts) pedía `.limit(10000)` y PostgREST corta en 1.000. Con
-- 447 clientes hoy no trunca, pero al llegar a 1.001 el truncamiento se INVIERTE
-- de la peor forma: el segundo candidato —el que vuelve el cruce AMBIGUO— puede
-- ser justo el que se cayó, y entonces hits.length = 1 da match único. El
-- enrutador estamparía el Shipping Mark del cliente equivocado, que es
-- exactamente lo que ese código dice estar evitando. Con la columna, el
-- enrutador filtra por clave exacta y el universo deja de existir.
--
-- La regla del cruce, idéntica a phoneKey() (_shared/kommo-router.ts): últimos
-- 10 dígitos, y NULL si hay menos de 10. Un número incompleto NO se cruza —
-- preferimos no vincular antes que vincular mal.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $preflight$
begin
  if to_regclass('public.clients') is null then
    raise exception '0383 requiere public.clients';
  end if;
  if to_regclass('public.kommo_contacts') is null then
    raise exception '0383 requiere public.kommo_contacts (migracion 0363)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kommo_contacts'
      and column_name = 'phone_last10'
  ) then
    raise exception '0383 requiere kommo_contacts.phone_last10 (migracion 0363)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'kommo_contact_id'
  ) then
    raise exception '0383 requiere clients.kommo_contact_id (migracion 0342)';
  end if;
end;
$preflight$;

-- ── 1. La clave de cruce, del lado del ERP ───────────────────────────────────
-- GENERADA, no escrita: no puede driftear respecto de phoneKey(). Las funciones
-- van calificadas por esquema porque se evalúan con el search_path del escritor.
alter table public.clients
  add column if not exists phone_last10 text
  generated always as (
    case
      when pg_catalog.length(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')
           ) >= 10
      then pg_catalog."right"(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'),
             10
           )
    end
  ) stored;

comment on column public.clients.phone_last10 is
  'SDD-0270: ultimos 10 digitos de phone, o NULL si hay menos de 10. GENERADA: no '
  'puede driftear. Gemela exacta de kommo_contacts.phone_last10 (0363) y de '
  'phoneKey() en _shared/kommo-router.ts. Permite filtrar por clave exacta desde '
  'PostgREST en vez de traerse la tabla entera y comparar en memoria.';

create index if not exists clients_phone_last10_col_idx
  on public.clients (tenant_id, phone_last10)
  where phone_last10 is not null;

-- ── 2. El barrido ────────────────────────────────────────────────────────────
-- ⛔ NACE EN SECO: p_aplicar es false por default. Correrla sin argumentos
-- informa y no escribe nada. Es deliberado — esto toca datos de clientes reales.
--
-- La guarda es BIDIRECCIONAL y ahí está todo el asunto. decideRoute() exige un
-- único CLIENTE por teléfono; un barrido necesita además un único CONTACTO por
-- teléfono. Guardar una sola dirección deja el bug vivo por la otra: dos
-- contactos de Kommo con el mismo número harían que se elija uno al azar.
--
-- Tercera guarda: un contacto ya vinculado a OTRO cliente no se reutiliza.
create or replace function public.kommo_vincular_clientes_por_telefono(
  p_tenant_id uuid,
  p_aplicar boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $fn$
declare
  v_candidatos    int := 0;
  v_vinculables   int := 0;
  v_aplicados     int := 0;
  v_amb_contactos int := 0;
  v_amb_clientes  int := 0;
  v_sin_clave     int := 0;
begin
  if p_tenant_id is null then
    raise exception 'kommo_vincular_clientes_por_telefono: p_tenant_id es obligatorio';
  end if;

  -- `on commit drop` sólo dispara al COMMIT: dos llamadas dentro de la MISMA
  -- transacción chocarían con la tabla de la anterior. En producción cada RPC
  -- va en su propia transacción y no se vería nunca — pero un contrato que
  -- corre los 9 casos en una sola transacción sí, y ahí se destapó.
  drop table if exists _vinc_pares;
  create temporary table _vinc_pares on commit drop as
  with cli_todos as (
    -- TODOS los clientes vivos con clave: el conteo de ambiguedad tiene que ver
    -- tambien a los ya vinculados, igual que loadPhoneUniverse.
    select c.id, c.phone_last10 as k, c.kommo_contact_id
    from public.clients c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and c.phone_last10 is not null
  ),
  con_todos as (
    select k.id as contact_id, k.phone_last10 as k
    from public.kommo_contacts k
    where k.tenant_id = p_tenant_id
      and k.phone_last10 is not null
  ),
  cli_por_clave as (
    -- (array_agg(...))[1] y no min(): no hay min(uuid), y sobre todo el valor
    -- sólo se usa cuando n = 1, o sea "el unico", no "el menor".
    select k, count(*) as n, (array_agg(id))[1] as id
    from cli_todos group by k
  ),
  con_por_clave as (
    select k, count(*) as n, (array_agg(contact_id))[1] as contact_id
    from con_todos group by k
  ),
  ya_usados as (
    -- Contactos que ya son de alguien: no se reutilizan.
    select distinct kommo_contact_id as contact_id
    from cli_todos where kommo_contact_id is not null
  )
  select
    cl.id                    as client_id,
    cn.contact_id            as contact_id,
    cl.k                     as clave,
    (cl.n = 1)               as cliente_unico,
    (cn.n = 1)               as contacto_unico,
    (yu.contact_id is null)  as contacto_libre
  from cli_por_clave cl
  join con_por_clave cn on cn.k = cl.k
  left join ya_usados yu on yu.contact_id = cn.contact_id;

  -- Candidatos = clientes vivos, sin vinculo, con clave utilizable.
  select count(*) into v_candidatos
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.kommo_contact_id is null
    and c.phone_last10 is not null;

  select count(*) into v_sin_clave
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.kommo_contact_id is null
    and c.phone_last10 is null;

  select
    count(*) filter (where not cliente_unico),
    count(*) filter (where cliente_unico and not contacto_unico)
  into v_amb_clientes, v_amb_contactos
  from _vinc_pares;

  select count(*) into v_vinculables
  from _vinc_pares p
  join public.clients c on c.id = p.client_id
  where p.cliente_unico and p.contacto_unico and p.contacto_libre
    and c.kommo_contact_id is null;

  if p_aplicar then
    with aplicables as (
      select p.client_id, p.contact_id
      from _vinc_pares p
      where p.cliente_unico and p.contacto_unico and p.contacto_libre
    )
    update public.clients c
       set kommo_contact_id = a.contact_id
      from aplicables a
     where c.id = a.client_id
       and c.tenant_id = p_tenant_id
       and c.deleted_at is null
       and c.kommo_contact_id is null;   -- nunca pisa un vinculo existente
    get diagnostics v_aplicados = row_count;
  end if;

  return jsonb_build_object(
    'aplicado',                 p_aplicar,
    'candidatos',               v_candidatos,
    'sin_clave_telefono',       v_sin_clave,
    'vinculables',              v_vinculables,
    'vinculados',               v_aplicados,
    'ambiguo_varios_clientes',  v_amb_clientes,
    'ambiguo_varios_contactos', v_amb_contactos
  );
end;
$fn$;

comment on function public.kommo_vincular_clientes_por_telefono(uuid, boolean) is
  'SDD-0270: cruza clientes con contactos de Kommo por los ultimos 10 digitos del '
  'telefono y llena clients.kommo_contact_id. EN SECO por default (p_aplicar=false): '
  'devuelve el informe sin escribir. Guarda BIDIRECCIONAL: exige un unico cliente Y '
  'un unico contacto por clave, y nunca reutiliza un contacto ya vinculado ni pisa '
  'un vinculo existente. Mismo criterio que decideRoute() en _shared/kommo-router.ts.';

revoke all on function public.kommo_vincular_clientes_por_telefono(uuid, boolean) from public;
