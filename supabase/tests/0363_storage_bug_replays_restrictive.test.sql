\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0363. Fixture ficticio y rollback: no toca prod.
--
-- Mide la SEMÁNTICA DE COMBINACIÓN de políticas, que es donde estaba el bug:
-- las permisivas se combinan con OR (una sola que diga que sí, concede) y las
-- restrictivas con AND (todas tienen que decir que sí).
--
-- Las políticas por bucket del fixture se copian de prod con su expresión exacta
-- (`pg_policies`, 2026-08-11) para que el escenario sea el real y no uno cómodo.
--
-- Lo que defiende:
--   1. ⭐ un usuario del PORTAL (authenticated, fuera de user_tenants) NO lee
--      client-docs — es la fuga: 33 fotos de cédula,
--   2. un miembro del tenant SÍ sigue leyendo su client-docs — no-regresión, que
--      es la mitad que se olvida al cerrar un hueco,
--   3. nadie authenticated lee bug-replays, que era la intención original,
--   4. nadie authenticated escribe en bug-replays,
--   5. un miembro del tenant sigue escribiendo en documents,
--   6. los buckets sin política propia (brand-assets) quedan cerrados para
--      authenticated — es el cambio de comportamiento buscado, y está acá para
--      que se vea explícito y no sorprenda.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

-- Modelo mínimo de Storage. `foldername` devuelve los segmentos de la ruta: la
-- convención del repo es `{tenant_id}/{entidad}/{id}/archivo`, así que el primer
-- segmento es el tenant.
create schema storage;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);
create function storage.foldername(p text) returns text[]
language sql immutable set search_path = '' as $$ select string_to_array(p, '/') $$;

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select, insert on storage.objects to authenticated;
grant all on storage.objects to service_role;

-- ── Políticas por bucket, copiadas de prod ──────────────────────────────────
create policy "client-docs tenant read" on storage.objects
  for select to authenticated
  using ((bucket_id = 'client-docs') and ((storage.foldername(name))[1] = (public.get_user_tenant_id())::text));

create policy "documents tenant insert" on storage.objects
  for insert to authenticated
  with check ((bucket_id = 'documents') and ((storage.foldername(name))[1] = (public.get_user_tenant_id())::text));

create policy "client-docs service_role all" on storage.objects
  for all to service_role using (bucket_id = 'client-docs') with check (bucket_id = 'client-docs');

-- ── El par con el bug, tal cual estaba en prod ──────────────────────────────
-- PERMISSIVE: se combinan con OR, así que conceden todo lo que no sea bug-replays.
create policy bug_replays_no_select_authenticated on storage.objects
  for select to authenticated using (bucket_id <> 'bug-replays');
create policy bug_replays_no_write_authenticated on storage.objects
  for insert to authenticated with check (bucket_id <> 'bug-replays');

-- La migración real los reemplaza por su versión RESTRICTIVE.
\ir ../migrations/0363_storage_bug_replays_restrictive.sql

-- ── Fixture ─────────────────────────────────────────────────────────────────
-- Dos actores authenticated: un EMPLEADO (está en user_tenants) y un CLIENTE DEL
-- PORTAL (no está — por eso get_user_tenant_id() le da NULL).
insert into public.user_tenants (user_id, tenant_id, role)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin');

insert into storage.objects (bucket_id, name) values
  ('client-docs',  'aaaaaaaa-0000-0000-0000-000000000001/clients/x/cedula.jpg'),
  ('brand-assets', 'catalogo/logo.png'),
  ('bug-replays',  'sesion-123.json');

-- ── 1. ⭐ El cliente del portal no lee las cédulas ──────────────────────────
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'client-docs';
  reset role;
  if n <> 0 then
    raise exception 'FUGA: un usuario del portal lee % objeto(s) de client-docs (fotos de cédula)', n;
  end if;
end;
$$;

-- ── 2. No-regresión: el empleado del tenant sí los lee ─────────────────────
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'client-docs';
  reset role;
  if n <> 1 then
    raise exception 'REGRESIÓN: el miembro del tenant dejó de ver su client-docs (ve %)', n;
  end if;
end;
$$;

-- ── 3. bug-replays cerrado para todo authenticated ─────────────────────────
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'bug-replays';
  reset role;
  if n <> 0 then raise exception 'HUECO: authenticated lee bug-replays (% filas)', n; end if;
end;
$$;

-- ── 4. Ni escribe en bug-replays ───────────────────────────────────────────
do $$
declare ok boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('bug-replays', 'colado.json');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'HUECO: authenticated escribió en bug-replays'; end if;
end;
$$;

-- ── 4b. ⭐ Y no escribe en los buckets que no le tocan ─────────────────────
-- Ésta es la que de verdad mide la política de INSERT. La permisiva original NO
-- abría bug-replays (su propio `with check` lo negaba): abría **todo lo demás**.
-- Sin esta prueba, devolver el INSERT a PERMISSIVE dejaba el contrato en verde
-- — verificado con mutación el 2026-08-11.
-- `client-docs` no tiene política de inserción para authenticated en prod: nadie
-- de la app sube ahí con la sesión del usuario, y plantar una cédula falsa es un
-- ataque más interesante que leerla.
do $$
declare ok boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name)
    values ('client-docs', 'aaaaaaaa-0000-0000-0000-000000000001/clients/x/cedula-falsa.jpg');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'HUECO: authenticated escribió en client-docs, que no tiene política de inserción'; end if;

  ok := false;
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('brand-assets', 'catalogo/colado.png');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'HUECO: authenticated escribió en brand-assets'; end if;
end;
$$;

-- ── 5. No-regresión de escritura: documents sigue aceptando al tenant ──────
do $$
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name)
  values ('documents', 'aaaaaaaa-0000-0000-0000-000000000001/docs/1/contrato.pdf');
  reset role;
end;
$$;

-- ── 6. Los buckets sin política propia quedan cerrados ─────────────────────
-- Cambio de comportamiento BUSCADO: brand-assets sólo se sirve por service_role
-- (todas sus rutas usan createAdminClient). Explícito para que no sorprenda.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'brand-assets';
  reset role;
  if n <> 0 then
    raise exception 'brand-assets sigue abierto a authenticated (% filas) — el par restrictivo no cerró el rebote', n;
  end if;
end;
$$;

-- ── 7. service_role no se ve afectado ──────────────────────────────────────
do $$
declare n int;
begin
  set local role service_role;
  select count(*) into n from storage.objects where bucket_id = 'client-docs';
  reset role;
  if n <> 1 then raise exception 'REGRESIÓN: service_role dejó de ver client-docs (ve %)', n; end if;
end;
$$;

rollback;
