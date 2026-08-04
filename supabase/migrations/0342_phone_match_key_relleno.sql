-- ─────────────────────────────────────────────────────────────
-- SDD-0244 · corrección sobre 0341 — los teléfonos de relleno no son llave.
--
-- Salió en la prueba funcional contra prod, no en los tests: un cliente
-- GENUINAMENTE NUEVO con teléfono '+58 4120000000' dio match por teléfono. Sus
-- últimos 7 dígitos son '0000000', y en el legado hay fichas con teléfonos de
-- relleno.
--
-- Medido en prod el 2026-08-03:
--   '0000000' · '8888888' · '9999999' → 1 ficha cada uno
--   '1234567'                          → 2 fichas
--
-- Esos números no identifican a nadie. Usarlos como llave de dedup le bloquea el
-- registro a un cliente nuevo real — el error más caro de los dos, porque el
-- duplicado se arregla fusionando y el bloqueo se traduce en un cliente que se
-- va sin poder registrarse.
--
-- Esta migración es ADITIVA sobre 0341 (que ya está aplicada y NO se toca).
-- ─────────────────────────────────────────────────────────────

-- ── La llave de teléfono, en un solo lugar ───────────────────
--
-- IMMUTABLE para poder usarla también en el índice, así el planner sigue
-- pudiendo aprovecharlo (si la expresión del índice y la de la query divergen,
-- el índice deja de servir).
--
-- Devuelve NULL —o sea, "no compares por teléfono"— cuando el número es
-- demasiado corto o es de relleno.

create or replace function public.phone_match_key(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  with d as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as dig
  )
  select case
    when length(d.dig) >= 7
     -- Todos los dígitos iguales: 0000000, 1111111, …, 9999999.
     and right(d.dig, 7) !~ '^(.)\1{6}$'
     -- Secuencias que la gente teclea cuando no quiere dar su número.
     and right(d.dig, 7) not in ('1234567', '0123456', '7654321', '9876543')
    then right(d.dig, 7)
  end
  from d;
$$;

comment on function public.phone_match_key is
  'SDD-0244: últimos 7 dígitos del teléfono como llave de dedup, o NULL si el número es corto o de relleno (0000000, 1234567…). Los de relleno no identifican a nadie: usarlos como llave bloquea el registro de un cliente nuevo real.';

revoke all on function public.phone_match_key(text) from public, anon;
grant execute on function public.phone_match_key(text) to authenticated, service_role;

-- ── El índice usa la misma expresión que las queries ─────────
drop index if exists public.clients_tenant_phone_norm_idx;
create index clients_tenant_phone_norm_idx
  on public.clients (tenant_id, public.phone_match_key(phone))
  where phone is not null and deleted_at is null;

-- ── Dedup del registro: pasa a usar la llave saneada ─────────
create or replace function public.find_duplicate_client_service(
  p_tenant_id uuid,
  p_document text default null,
  p_email text default null,
  p_phone text default null
)
returns table (client_id uuid, matched_by text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      nullif(upper(regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      nullif(lower(btrim(coalesce(p_email, ''))), '') as em,
      public.phone_match_key(p_phone) as tel
  )
  select
    c.id,
    case
      when q.doc is not null
        and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc
        then 'documento'
      when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em
        then 'correo'
      else 'telefono'
    end
  from public.clients c, q
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and (
         (q.doc is not null
           and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc)
      or (q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em)
      or (q.tel is not null and public.phone_match_key(c.phone) = q.tel)
    )
  order by case
    when q.doc is not null
      and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc then 0
    when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em then 1
    else 2 end
  limit 1;
$$;

revoke all on function public.find_duplicate_client_service(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.find_duplicate_client_service(uuid, text, text, text)
  to service_role;

-- ── Detector de duplicados: misma llave ──────────────────────
create or replace function public.client_duplicate_candidates()
returns table (
  legacy_id uuid,
  legacy_markbox text,
  legacy_name text,
  new_id uuid,
  new_markbox text,
  new_name text,
  match_email boolean,
  match_phone boolean,
  match_name boolean,
  match_document boolean,
  score int
)
language sql
stable
security definer
set search_path = public
as $$
  with vivos as (
    select
      c.id, c.markbox, c.name,
      lower(btrim(c.email))                                               as em,
      public.phone_match_key(c.phone)                                     as tel7,
      nullif(upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      lower(btrim(c.name))                                                as nom,
      (c.markbox !~ '^DTD-\d+$')                                          as es_legado
    from public.clients c
    where c.tenant_id = public.get_user_tenant_id()
      and c.deleted_at is null
      and c.merged_into_client_id is null
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
    on v.es_legado and not n.es_legado
   and (
        (n.em = v.em and coalesce(n.em, '') <> '')
     or (n.tel7 is not null and n.tel7 = v.tel7)
     or (n.doc is not null and n.doc = v.doc)
     or (n.nom = v.nom and coalesce(n.nom, '') <> '')
   )
  order by score desc, v.markbox;
$$;

revoke all on function public.client_duplicate_candidates() from public, anon;
grant execute on function public.client_duplicate_candidates() to authenticated;
