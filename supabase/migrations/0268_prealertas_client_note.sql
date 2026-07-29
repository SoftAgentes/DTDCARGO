-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · nota del cliente sobre la compra
--
-- El paso 1 del Norte (`_norte/portal/app.jsx` · `PortalNuevaCompra`) tiene un
-- campo "NOTA · opcional" debajo del proveedor: "me dio mejor precio esta vez,
-- pedido urgente, incluye una muestra…". Es contexto del CLIENTE sobre ESA
-- compra — distinto de `suppliers_cn.notes` (que describe al proveedor, no a la
-- compra) y de las notas por servicio (que son instrucciones operativas).
--
-- Se construyó sin el campo porque no había dónde guardarlo; el founder decidió
-- la columna (2026-07-28).
--
-- SEGURIDAD / PERFORMANCE (checklist de los 2 skills de Supabase):
--   · ADD COLUMN nullable y SIN default → sólo metadatos: no reescribe la tabla
--     ni toma lock largo (PG 11+).
--   · RLS: no se tocan políticas. Las de `prealertas` son row-level (tenant_id +
--     client_markbox) y la columna nueva queda cubierta.
--   · GRANTS: los privilegios de `prealertas` se verifican de TABLA antes de
--     aplicar (si fueran por columna haría falta GRANT explícito).
--   · Sin índice: es texto libre que nadie filtra ni ordena.
--   · Sin CHECK de vocabulario (es prosa), pero SÍ tope de largo: 2000 caracteres
--     es holgado para una nota y evita que un pegado accidental infle la fila.
--
-- NO APLICADA A PROD. Registrada en supabase/migrations-baseline.json; se aplica
-- sólo con OK explícito del founder NOMBRANDO este archivo
-- (docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.prealertas
  add column if not exists client_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prealertas_client_note_len_chk'
  ) then
    alter table public.prealertas
      add constraint prealertas_client_note_len_chk
      check (client_note is null or char_length(client_note) <= 2000);
  end if;
end $$;

comment on column public.prealertas.client_note is
  'SDD-0172 · nota del CLIENTE sobre esta compra (paso 1 del asistente). No confundir con suppliers_cn.notes (describe al proveedor) ni con las notas por servicio (instrucciones operativas).';
