-- Contrato de 0334 (SDD-0238): catálogo de marca + acceso público con código.
--
-- Lo que se prueba acá es lo que NO se puede verificar mirando el .sql:
--   · el bloqueo escalonado cuenta y escala como pidió el founder (3 → 5 min →
--     3 → 1 h) y el acierto lo resetea;
--   · un código errado NO distingue de "no hay código puesto" (sin oráculo);
--   · anon/authenticated no pueden ejecutar la RPC ni leer los intentos;
--   · un asset no puede colgar de una sección de OTRO tenant;
--   · el bucket nace privado.
\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create schema storage;

create table public.tenants(id uuid primary key);
create table auth.users(id uuid primary key);
create table public.user_tenants(
  user_id uuid not null, tenant_id uuid not null,
  role text not null, disabled_at timestamptz
);
create table storage.buckets(
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text);

-- Stubs de las helpers que la migración da por existentes.
create function auth.uid() returns uuid language sql stable
  as $$ select '99999999-9999-4999-8999-999999999999'::uuid $$;
create function public.get_user_tenant_id() returns uuid language sql stable
  as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
create function public.touch_updated_at() returns trigger language plpgsql
  as $$ begin new.updated_at = now(); return new; end $$;

\ir ../migrations/0334_brand_catalog_public_gate.sql

do $$
declare
  t1 uuid = '11111111-1111-4111-8111-111111111111';
  t2 uuid = '22222222-2222-4222-8222-222222222222';
  u1 uuid = '99999999-9999-4999-8999-999999999999';
  k  text = repeat('a', 64);
  k2 text = repeat('b', 64);
  r  record;
  n  integer;
  sec1 uuid;
  sec2 uuid;
begin
  -- El seed corre sobre los tenants que EXISTAN al aplicar; acá no había
  -- ninguno, así que se crean ahora y se siembra a mano lo mínimo.
  insert into public.tenants values (t1), (t2);
  insert into auth.users values (u1);
  insert into public.user_tenants(user_id, tenant_id, role) values (u1, t1, 'admin');
  insert into public.brand_access(tenant_id, code_hash, session_days)
  values (t1, extensions.crypt('4321', extensions.gen_salt('bf')), 30),
         (t2, null, 30);

  -- ── 1 · El bucket nace privado ───────────────────────────────
  select public into r from storage.buckets where id = 'brand-assets';
  if r.public is not false then
    raise exception '0334: el bucket brand-assets no es privado';
  end if;

  -- ── 2 · RLS activa en las cuatro tablas ──────────────────────
  select count(*) into n from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relname in ('brand_sections','brand_assets','brand_access','brand_access_attempts')
    and c.relrowsecurity;
  if n <> 4 then raise exception '0334: falta RLS en alguna tabla (activas: %)', n; end if;

  -- ── 3 · Los intentos son privilegiados ───────────────────────
  if has_table_privilege('anon', 'public.brand_access_attempts', 'SELECT')
     or has_table_privilege('authenticated', 'public.brand_access_attempts', 'SELECT') then
    raise exception '0334: brand_access_attempts es legible fuera de service_role';
  end if;
  -- Y nadie escribe el hash por PostgREST.
  if has_table_privilege('authenticated', 'public.brand_access', 'UPDATE') then
    raise exception '0334: authenticated puede UPDATE brand_access (el código se cambia por RPC)';
  end if;

  -- ── 4 · La RPC de verificación es server-only ────────────────
  if has_function_privilege('anon', 'public.verify_brand_access_code(uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verify_brand_access_code(uuid,text,text)', 'EXECUTE') then
    raise exception '0334: verify_brand_access_code ejecutable fuera de service_role';
  end if;

  -- ── 5 · Código correcto entra ────────────────────────────────
  select * into r from public.verify_brand_access_code(t1, '4321', k);
  if not r.ok then raise exception '0334: el código correcto no entró'; end if;
  if r.session_days <> 30 then raise exception '0334: session_days mal devuelto'; end if;

  -- ── 6 · Escalado: 3 fallos → 5 minutos ───────────────────────
  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.ok or r.attempts_left <> 2 then
    raise exception '0334: 1er fallo mal contado (left=%)', r.attempts_left;
  end if;
  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.attempts_left <> 1 then raise exception '0334: 2do fallo mal contado'; end if;

  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.locked_until is null then raise exception '0334: el 3er fallo no bloqueó'; end if;
  if r.locked_until > now() + interval '6 minutes'
     or r.locked_until < now() + interval '4 minutes' then
    raise exception '0334: el primer bloqueo no es de 5 minutos (%)', r.locked_until;
  end if;

  -- Bloqueado: ni el código bueno pasa.
  select * into r from public.verify_brand_access_code(t1, '4321', k);
  if r.ok then raise exception '0334: entró estando bloqueado'; end if;

  -- ── 7 · Escalado: 3 fallos más → 1 hora ──────────────────────
  -- Se envejecen los intentos para salir del bloqueo de 5 min sin esperar.
  update public.brand_access_attempts set created_at = now() - interval '10 minutes'
   where tenant_id = t1 and attempt_key = k;

  -- Vencida la espera se recuperan TRES intentos, no uno. (Con la condición
  -- ingenua `fallos >= 3` cada intento posterior volvía a bloquear 5 minutos:
  -- el visitante quedaba con un intento por ventana. Estas tres asserts fijan
  -- el comportamiento pedido.)
  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.locked_until is not null then raise exception '0334: siguió bloqueado tras vencer los 5 min'; end if;
  if r.attempts_left <> 2 then
    raise exception '0334: tras la espera no dio 3 intentos nuevos (left=%)', r.attempts_left;
  end if;

  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.locked_until is not null then raise exception '0334: bloqueó en el 5to fallo (debe ser al 6to)'; end if;
  if r.attempts_left <> 1 then raise exception '0334: 5to fallo mal contado'; end if;

  select * into r from public.verify_brand_access_code(t1, '0000', k);
  if r.locked_until is null then raise exception '0334: el 6to fallo no bloqueó'; end if;
  if r.locked_until < now() + interval '55 minutes' then
    raise exception '0334: el segundo bloqueo no escaló a 1 hora (%)', r.locked_until;
  end if;

  -- ── 8 · El acierto borra el historial de esa huella ──────────
  update public.brand_access_attempts set created_at = now() - interval '2 hours'
   where tenant_id = t1 and attempt_key = k;
  select * into r from public.verify_brand_access_code(t1, '4321', k);
  if not r.ok then raise exception '0334: no entró tras vencer el bloqueo de 1 h'; end if;
  select count(*) into n from public.brand_access_attempts
   where tenant_id = t1 and attempt_key = k;
  if n <> 0 then raise exception '0334: el acierto no limpió los intentos (quedan %)', n; end if;

  -- ── 9 · El bloqueo es por huella, no global ──────────────────
  -- Que un visitante se bloquee no puede dejar afuera a los demás.
  insert into public.brand_access_attempts(tenant_id, attempt_key, succeeded)
  select t1, k, false from generate_series(1, 6);
  select * into r from public.verify_brand_access_code(t1, '4321', k2);
  if not r.ok then raise exception '0334: el bloqueo de una huella afectó a otra'; end if;
  delete from public.brand_access_attempts where tenant_id = t1;

  -- ── 10 · Sin código puesto = cerrado, y no se distingue ──────
  -- t2 tiene code_hash NULL. La respuesta debe ser idéntica en forma a la de un
  -- código errado: ok=false, sin bloqueo. Si "no configurado" devolviera algo
  -- distinto, sería un oráculo sobre el estado del tenant.
  select * into r from public.verify_brand_access_code(t2, '4321', k);
  if r.ok then raise exception '0334: entró a un tenant sin código puesto'; end if;
  if r.locked_until is not null then raise exception '0334: cerrado devolvió bloqueo'; end if;

  -- Y no cuenta como intento fallido (no hay nada que adivinar).
  select count(*) into n from public.brand_access_attempts where tenant_id = t2;
  if n <> 0 then raise exception '0334: tenant sin código acumuló intentos'; end if;

  -- ── 11 · Huella mal formada no cuenta intentos ───────────────
  select * into r from public.verify_brand_access_code(t1, '4321', 'no-es-un-sha256');
  if r.ok then raise exception '0334: aceptó una huella inválida'; end if;

  -- ── 12 · Aislamiento multi-tenant en el catálogo ─────────────
  insert into public.brand_sections(tenant_id, slug, title, sort_order)
  values (t1, 'logos', 'Logos', 10) returning id into sec1;
  insert into public.brand_sections(tenant_id, slug, title, sort_order)
  values (t2, 'logos', 'Logos', 10) returning id into sec2;

  begin
    insert into public.brand_assets(tenant_id, section_id, title, storage_path)
    values (t1, sec2, 'Robado', 'x/y.png');
    raise exception '0334: un asset del tenant 1 colgó de una sección del tenant 2';
  exception when foreign_key_violation then
    null;  -- correcto
  end;

  -- ── 13 · set_brand_access_code valida el formato ─────────────
  begin
    perform public.set_brand_access_code('12', null);
    raise exception '0334: aceptó un código de 2 dígitos';
  exception when others then
    if sqlerrm not like '%codigo invalido%' then raise; end if;
  end;
  begin
    perform public.set_brand_access_code('abcd', null);
    raise exception '0334: aceptó un código no numérico';
  exception when others then
    if sqlerrm not like '%codigo invalido%' then raise; end if;
  end;

  -- Un código válido se guarda hasheado (nunca en claro) y limpia bloqueos.
  insert into public.brand_access_attempts(tenant_id, attempt_key, succeeded)
  select t1, k, false from generate_series(1, 6);
  perform public.set_brand_access_code('135790', 15);
  select count(*) into n from public.brand_access_attempts where tenant_id = t1;
  if n <> 0 then raise exception '0334: cambiar el código no limpió los bloqueos'; end if;

  select code_hash, session_days into r from public.brand_access where tenant_id = t1;
  if r.code_hash = '135790' then raise exception '0334: el código quedó guardado EN CLARO'; end if;
  if r.session_days <> 15 then raise exception '0334: no guardó session_days'; end if;

  select * into r from public.verify_brand_access_code(t1, '135790', k2);
  if not r.ok then raise exception '0334: el código nuevo no sirve'; end if;

  -- Poner NULL cierra el acceso externo.
  perform public.set_brand_access_code(null, null);
  select * into r from public.verify_brand_access_code(t1, '135790', k2);
  if r.ok then raise exception '0334: el código viejo siguió sirviendo tras cerrar'; end if;
end $$;

rollback;
