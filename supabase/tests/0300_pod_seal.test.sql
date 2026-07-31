-- Contrato de SDD-0192 Slice A · el POD se sella y no se puede reescribir.
--
-- Lo que defiende (hallazgo H-2): que nadie pueda cambiar una prueba de entrega
-- después de hecha, ni sustituir la foto sin que se note. El caso 4 es el que
-- vale de verdad: se REEMPLAZA el archivo en Storage dejando la misma ruta, y el
-- verificador tiene que decir que el POD ya no es el que se selló. Un sello que
-- solo cubre la ruta pasa ese caso sin enterarse.
--
-- Mutación: si se quita `dispatch_pods_guard_trg`, caen los casos 1, 2 y 3.

\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$roles$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Fixture mínimo de Storage: solo lo que el sello lee.
create schema if not exists storage;
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name      text not null,
  metadata  jsonb
);

create table public.dispatch_pods (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  od_id                  uuid not null,
  package_id             uuid,
  photo_path             text,
  signature_path         text,
  received_by            text not null,
  received_doc           text,
  notes                  text,
  created_by_operario_id uuid,
  created_at             timestamptz not null default now(),
  pod_lat                numeric(9,6),
  pod_lng                numeric(9,6),
  pod_accuracy_m         numeric(7,2),
  pod_gps_status         text
);

\ir ../migrations/0300_pod_seal.sql

do $t$
declare
  v_pod    uuid;
  v_hash   text;
  v_ok     boolean;
begin
  -- Los dos archivos del POD, con su huella de contenido.
  insert into storage.objects (bucket_id, name, metadata) values
    ('receipt-photos', 'pod/t1/od1/1.jpg',   '{"eTag":"\"aaa111\"","size":1000}'::jsonb),
    ('receipt-photos', 'firma/t1/od1/1.png', '{"eTag":"\"bbb222\"","size":500}'::jsonb);

  insert into public.dispatch_pods
    (tenant_id, od_id, photo_path, signature_path, received_by, received_doc,
     pod_lat, pod_lng, pod_gps_status)
  values
    (gen_random_uuid(), gen_random_uuid(), 'pod/t1/od1/1.jpg', 'firma/t1/od1/1.png',
     'Juan Pérez', 'V-12345678', 10.162000, -68.007800, 'on')
  returning id, hash into v_pod, v_hash;

  -- ── 1 · el server sella al insertar ─────────────────────────────────
  if v_hash is null or length(v_hash) <> 64 then
    raise exception 'FALLO 1: no se selló el POD (hash=%)', v_hash;
  end if;
  if (select evidence_version from public.dispatch_pods where id = v_pod) <> 1 then
    raise exception 'FALLO 1b: evidence_version no quedó en 1';
  end if;

  -- ── 2 · el sello recién puesto verifica ─────────────────────────────
  if not public.dispatch_pod_hash_valid(v_pod) then
    raise exception 'FALLO 2: el POD no valida contra su propio sello';
  end if;

  -- ── 3 · append-only: ni UPDATE ni DELETE ────────────────────────────
  v_ok := false;
  begin
    update public.dispatch_pods set received_by = 'Otro Nombre' where id = v_pod;
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 3a: se pudo reescribir el receptor de un POD';
  end if;

  v_ok := false;
  begin
    delete from public.dispatch_pods where id = v_pod;
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 3b: se pudo borrar un POD';
  end if;

  -- ── 4 · ⭐ sustituir la FOTO dejando la misma ruta ───────────────────
  -- El escenario real: "esa foto salió mal, súbela de nuevo". La fila no se
  -- toca; cambia el archivo. Un sello de la RUTA no se entera. Este sí.
  update storage.objects
     set metadata = '{"eTag":"\"HACK999\"","size":1000}'::jsonb
   where name = 'pod/t1/od1/1.jpg';

  if public.dispatch_pod_hash_valid(v_pod) then
    raise exception 'FALLO 4: se sustituyó la foto y el POD siguió validando — el sello cubre la ruta, no el contenido';
  end if;

  -- restaurar y confirmar que vuelve a validar (no es un falso positivo fijo)
  update storage.objects
     set metadata = '{"eTag":"\"aaa111\"","size":1000}'::jsonb
   where name = 'pod/t1/od1/1.jpg';
  if not public.dispatch_pod_hash_valid(v_pod) then
    raise exception 'FALLO 4b: restaurado el archivo, el POD debería volver a validar';
  end if;

  -- ── 5 · borrar el archivo también rompe el sello ─────────────────────
  delete from storage.objects where name = 'firma/t1/od1/1.png';
  if public.dispatch_pod_hash_valid(v_pod) then
    raise exception 'FALLO 5: desapareció la firma y el POD siguió validando';
  end if;

  raise notice 'OK · 0300 el POD se sella por contenido y resiste la sustitución';
end;
$t$;

rollback;
