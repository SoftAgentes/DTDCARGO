-- Contrato de SDD-0191 Slice A · legal_docs sella su cuerpo y es inmutable.
--
-- Lo que este test defiende (hallazgo H-1 de la auditoría 2026-07): que nadie
-- pueda cambiar el texto de un documento vigente sin cambiar la versión. Si el
-- trigger `legal_docs_guard_trg` desaparece o se ablanda, los casos 3 a 6 dejan
-- de levantar excepción y el test cae. Esa es la mutación que lo hace real.

\set ON_ERROR_STOP on
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.legal_docs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  key            text not null,
  name           text not null,
  audience       text not null default 'cliente',
  version        text not null,
  effective_date date not null,
  status         text not null default 'vigente'
                   check (status in ('vigente', 'archivada')),
  sections       int not null default 0,
  change_note    text,
  body           jsonb not null default '[]'::jsonb,
  body_sha256    text,
  created_at     timestamptz not null default now()
);

\ir ../migrations/0297_legal_docs_body_hash.sql

-- El .sql trae un `drop policy` sobre una tabla sin RLS ni esa policy: en el
-- fixture no existe, y `if exists` lo hace inocuo. Se deja para que el test
-- ejecute la migración TAL CUAL, sin recortes.

do $t$
declare
  v_tenant uuid := gen_random_uuid();
  v_id     uuid;
  v_hash   text;
  v_hash2  text;
  v_ok     boolean;
begin
  -- ── 1 · INSERT sella el cuerpo, y lo sella el SERVER ────────────────
  -- Se manda un body_sha256 falso a propósito: tiene que ser descartado.
  insert into public.legal_docs
    (tenant_id, key, name, version, effective_date, sections, body, body_sha256)
  values
    (v_tenant, 'tyc', 'Términos', 'v3.0', '2026-07-01', 2,
     '[["Uno","Texto uno"],["Dos","Texto dos"]]'::jsonb,
     'hash-falso-del-cliente')
  returning id, body_sha256 into v_id, v_hash;

  if v_hash is null or v_hash = 'hash-falso-del-cliente' then
    raise exception 'FALLO 1: el server no selló body_sha256 (quedó %)', v_hash;
  end if;

  if v_hash <> encode(extensions.digest(
       (select body::text from public.legal_docs where id = v_id), 'sha256'), 'hex') then
    raise exception 'FALLO 1b: body_sha256 no es el SHA-256 del cuerpo';
  end if;

  -- ── 2 · change_note sí se puede tocar, y no mueve el sello ──────────
  update public.legal_docs set change_note = 'nota' where id = v_id;
  select body_sha256 into v_hash2 from public.legal_docs where id = v_id;
  if v_hash2 <> v_hash then
    raise exception 'FALLO 2: change_note movió el hash (% → %)', v_hash, v_hash2;
  end if;

  -- ── 3 · cambiar el CUERPO de un documento publicado: prohibido ──────
  -- Este es el hallazgo H-1. Sin el trigger, este update pasa en silencio.
  v_ok := false;
  begin
    update public.legal_docs
       set body = '[["Uno","TEXTO ADULTERADO"]]'::jsonb
     where id = v_id;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 3: se pudo reescribir el cuerpo de un documento publicado';
  end if;

  -- ── 4 · cambiar la versión sin crear una nueva fila: prohibido ──────
  v_ok := false;
  begin
    update public.legal_docs set version = 'v3.1' where id = v_id;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 4: se pudo renumerar la versión de un documento publicado';
  end if;

  -- ── 5 · DELETE: prohibido siempre ───────────────────────────────────
  v_ok := false;
  begin
    delete from public.legal_docs where id = v_id;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 5: se pudo borrar un documento legal';
  end if;

  -- ── 6 · archivar SÍ, desarchivar NO ─────────────────────────────────
  update public.legal_docs set status = 'archivada' where id = v_id;
  if (select status from public.legal_docs where id = v_id) <> 'archivada' then
    raise exception 'FALLO 6a: no se pudo archivar (rompe la publicación de v3.1)';
  end if;

  v_ok := false;
  begin
    update public.legal_docs set status = 'vigente' where id = v_id;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLO 6b: se pudo revivir un documento archivado';
  end if;

  -- ── 7 · dos cuerpos distintos ⇒ dos hashes distintos ────────────────
  insert into public.legal_docs
    (tenant_id, key, name, version, effective_date, body)
  values
    (v_tenant, 'tyc', 'Términos', 'v3.1', '2026-08-01',
     '[["Uno","Texto uno"],["Dos","Texto DISTINTO"]]'::jsonb)
  returning body_sha256 into v_hash2;

  if v_hash2 = v_hash then
    raise exception 'FALLO 7: dos cuerpos distintos produjeron el mismo hash';
  end if;

  raise notice 'OK · 0297 legal_docs sella su cuerpo y resiste la adulteración';
end;
$t$;

rollback;
