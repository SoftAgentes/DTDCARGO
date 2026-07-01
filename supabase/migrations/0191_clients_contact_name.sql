-- ─────────────────────────────────────────────────────────────
-- SDD-0122 · Registro de cliente persona/empresa — clients.contact_name.
--
-- El alta de cliente INTERNO (Studio) ahora distingue persona vs empresa
-- (doc_kind, columna ya existente de 0092). Para EMPRESA el `name` guarda la
-- RAZÓN SOCIAL; la persona de contacto con la que se habla necesita su propio
-- campo (antes se metía en `notes`, poco consultable). Esta columna lo formaliza.
--
--   · persona → contact_name null (el `name` ES la persona).
--   · empresa → contact_name = nombre del contacto operativo (opcional).
--
-- ADITIVA y NULLABLE. Sin backfill (los datos viejos que estaban en notes se
-- dejan como están; el asesor los mueve al editar). Hereda la RLS multi-tenant
-- de `clients` (nada que policy-ar de nuevo). Sin DDL destructivo.
--
-- NO aplicar a prod (lo hace el Director / founder).
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists contact_name text;

comment on column public.clients.contact_name is
  'SDD-0122: persona de contacto operativo de un cliente EMPRESA (con quién se habla). Null para personas naturales (ahí `name` ES la persona). Opcional.';
