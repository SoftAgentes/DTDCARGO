\set ON_ERROR_STOP on
-- SDD-0508 · Contrato de 0474: bucket_id pasa a 'bitacora' sólo en los
-- adjuntos de Bitácora cuyo objeto está en `bitacora` y no en `documents`.
-- Fixture sintético aislado; no ejecutar sobre una DB real. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0474_documents_bitacora_bucket_backfill.test.sql
--
-- storage.objects es un stub con las dos columnas que lee la migración (como en
-- 0309). document_entity_in_tenant() es reducida: none/null, 'shipment' y la
-- rama 'bitacora_task' de 0473, con su texto exacto (el preflight la busca). El
-- trigger documents_validate_entity es el de 0097 con el search_path de 0210:
-- el UPDATE de la migración pasa por la validación de entidad real.
-- Variantes del envoltorio PGlite: -v sin_rama=true (la función como la dejó
-- 0314, sin la rama) y -v sin_storage=true (sin storage.objects).
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?sin_rama}
\else
\set sin_rama false
\endif
\if :{?sin_storage}
\else
\set sin_storage false
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.documents') is not null
     or to_regtype('public.document_entity_type') is not null then
    raise exception 'TEST 0474: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
end;
$fixture_guard$;

create type public.document_entity_type as enum (
  'shipment', 'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry',
  'client', 'supplier', 'consolidation', 'booking', 'none', 'bitacora_task', 'expense'
);
create table public.shipments (id uuid primary key, tenant_id uuid not null, deleted_at timestamptz);
create table public.bitacora_tasks (id uuid primary key, tenant_id uuid not null);
create table public.documents (
  id uuid primary key,
  tenant_id uuid not null,
  entity_type public.document_entity_type not null default 'none',
  entity_id uuid,
  storage_path text not null,
  bucket_id text not null default 'documents',
  deleted_at timestamptz
);

\if :sin_storage
\else
create schema storage;
create table storage.objects (bucket_id text not null, name text not null, primary key (bucket_id, name));
\endif

-- T = tenant; K = tarea; S = embarque. Cada fila es un caso; su objeto, abajo.
insert into public.shipments values ('5a000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001', null);
insert into public.bitacora_tasks values ('4b000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001');
insert into public.documents (id, tenant_id, entity_type, entity_id, storage_path, bucket_id, deleted_at) values
  -- A: subida de Bitácora antes del fix (el caso medido en producción) → se corrige.
  ('d0000000-0000-4000-8000-00000000000a', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/a.jpg', 'documents', null),
  -- B: igual pero borrada lógicamente → también se corrige.
  ('d0000000-0000-4000-8000-00000000000b', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/b.jpg', 'documents', '2026-10-14T02:00:00Z'),
  -- C: versión que el hub guardó en `documents` → no se toca.
  ('d0000000-0000-4000-8000-00000000000c', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/c.pdf', 'documents', null),
  -- D: objeto en los dos buckets (ambiguo) → no se toca.
  ('d0000000-0000-4000-8000-00000000000d', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/d.jpg', 'documents', null),
  -- E: objeto en ningún bucket → no se toca.
  ('d0000000-0000-4000-8000-00000000000e', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/e.jpg', 'documents', null),
  -- F: otra entidad con un objeto en `bitacora` → no se toca.
  ('d0000000-0000-4000-8000-00000000000f', '7e000000-0000-4000-8000-000000000001', 'shipment', '5a000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/f.jpg', 'documents', null),
  -- G: ya dice `bitacora` → sigue igual.
  ('d0000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/g.jpg', 'bitacora', null),
  -- H: otro bucket de origen (erp-attachments) con objeto en `bitacora` → no se toca.
  ('d0000000-0000-4000-8000-000000000002', '7e000000-0000-4000-8000-000000000001', 'bitacora_task', '4b000000-0000-4000-8000-000000000001', 'T/bitacora_task/K/h.jpg', 'erp-attachments', null);

\if :sin_storage
\else
insert into storage.objects (bucket_id, name) values
  ('bitacora', 'T/bitacora_task/K/a.jpg'),
  ('bitacora', 'T/bitacora_task/K/b.jpg'),
  ('documents', 'T/bitacora_task/K/c.pdf'),
  ('bitacora', 'T/bitacora_task/K/d.jpg'),
  ('documents', 'T/bitacora_task/K/d.jpg'),
  ('bitacora', 'T/bitacora_task/K/f.jpg'),
  ('bitacora', 'T/bitacora_task/K/g.jpg'),
  ('bitacora', 'T/bitacora_task/K/h.jpg');
\endif

\if :sin_rama
-- Como en producción antes de la 0473 (0314): sin la rama de Bitácora.
create or replace function public.document_entity_in_tenant(
  p_type public.document_entity_type,
  p_id uuid,
  p_tenant uuid
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ok boolean := false;
begin
  if p_type::text = 'none' or p_id is null then return true; end if;
  case p_type::text
    when 'shipment' then select exists(select 1 from public.shipments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    else ok := false;
  end case;
  return ok;
end;
$$;
\else
-- Reducida: none/null, 'shipment' y la rama de 0473 con su texto exacto.
create or replace function public.document_entity_in_tenant(
  p_type public.document_entity_type,
  p_id uuid,
  p_tenant uuid
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ok boolean := false;
begin
  if p_type::text = 'none' or p_id is null then return true; end if;
  case p_type::text
    when 'shipment' then select exists(select 1 from public.shipments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'bitacora_task' then select exists(select 1 from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;
    else ok := false;
  end case;
  return ok;
end;
$$;
\endif

-- 0097, con el search_path de 0210. Se crea después de sembrar: con la función
-- sin rama, sembrar los bitacora_task sería imposible.
create or replace function public.documents_validate_entity()
returns trigger
language plpgsql
as $$
begin
  if not public.document_entity_in_tenant(new.entity_type, new.entity_id, new.tenant_id) then
    raise exception 'documento sobre entidad inexistente, de otro tipo o ajena al tenant: %/%', new.entity_type, new.entity_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
alter function public.documents_validate_entity() set search_path = public;
create trigger documents_validate_entity_trg
  before insert or update on public.documents
  for each row execute function public.documents_validate_entity();

\if :apply_fix
\ir ../migrations/0474_documents_bitacora_bucket_backfill.sql
-- Re-aplicable: la segunda corrida no encuentra filas y su postflight pasa.
\ir ../migrations/0474_documents_bitacora_bucket_backfill.sql
\endif

create temp table resultados (n serial, nombre text, ok boolean);

insert into resultados (nombre, ok)
select 'A: adjunto de Bitácora con objeto en bitacora pasa a bitacora', bucket_id = 'bitacora'
from public.documents where id = 'd0000000-0000-4000-8000-00000000000a';
insert into resultados (nombre, ok)
select 'B: el borrado lógico también pasa a bitacora', bucket_id = 'bitacora' and deleted_at is not null
from public.documents where id = 'd0000000-0000-4000-8000-00000000000b';
insert into resultados (nombre, ok)
select 'C: la versión del hub en documents no se toca', bucket_id = 'documents'
from public.documents where id = 'd0000000-0000-4000-8000-00000000000c';
insert into resultados (nombre, ok)
select 'D: objeto en los dos buckets no se toca', bucket_id = 'documents'
from public.documents where id = 'd0000000-0000-4000-8000-00000000000d';
insert into resultados (nombre, ok)
select 'E: objeto en ningún bucket no se toca', bucket_id = 'documents'
from public.documents where id = 'd0000000-0000-4000-8000-00000000000e';
insert into resultados (nombre, ok)
select 'F: otra entidad no se toca', bucket_id = 'documents'
from public.documents where id = 'd0000000-0000-4000-8000-00000000000f';
insert into resultados (nombre, ok)
select 'G: la que ya decía bitacora sigue igual', bucket_id = 'bitacora'
from public.documents where id = 'd0000000-0000-4000-8000-000000000001';
insert into resultados (nombre, ok)
select 'H: otro bucket de origen no se toca', bucket_id = 'erp-attachments'
from public.documents where id = 'd0000000-0000-4000-8000-000000000002';
insert into resultados (nombre, ok)
select 'storage_path y entidad intactos en todas las filas',
  count(*) = 8 and bool_and(storage_path like 'T/bitacora_task/K/_.%')
from public.documents;
insert into resultados (nombre, ok)
select 'storage.objects intacto (ningún objeto movido ni borrado)', count(*) = 8
from storage.objects;

do $veredicto$
declare
  v_fallo text;
  v_total integer;
begin
  select count(*) into v_total from resultados;
  select nombre into v_fallo from resultados where ok is not true order by n limit 1;
  if v_total <> 10 then
    raise exception 'TEST 0474: se esperaban 10 aserciones y hubo %', v_total;
  end if;
  if v_fallo is not null then
    raise exception 'TEST 0474: %', v_fallo;
  end if;
end;
$veredicto$;

select 'TEST 0474 GREEN: ' || count(*) || ' aserciones' as resultado from resultados;

rollback;
