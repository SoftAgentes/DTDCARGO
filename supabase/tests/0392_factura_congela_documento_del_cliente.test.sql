\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0392 (SDD-0298).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege son tres cosas:
--
--   1. Que se pueda facturar a un cliente SIN documento. 146 de 490 clientes
--      vivos no lo tienen cargado (medido 2026-08-25): un `not null` acá
--      bloquearía facturarle a un tercio de la cartera.
--   2. Que el tipo de documento NO pueda ser cualquier cosa. Decide la etiqueta
--      que se imprime, y poner "RIF" sobre una cédula identifica mal al
--      contribuyente — es un error fiscal, no de estilo. TypeScript no alcanza:
--      la columna la puede escribir cualquier cliente de Postgres.
--   3. Que el tipo pueda quedar en NULL con número presente. Un cliente viejo
--      puede tener RIF sin `doc_kind`; el papel cae a etiqueta neutra en vez de
--      adivinar, pero la fila tiene que poder existir.
--
-- Cada contrato se validó rompiéndolo a propósito (quitando el CHECK): un
-- contrato verde que sigue verde con la protección apagada es decorado.

begin;

-- ── Esqueleto mínimo: sólo lo que la 0392 toca ─────────────────────────────
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  invoice_code    text not null,
  client_markbox  text not null,
  client_name     text not null
);

\ir ../migrations/0392_factura_congela_documento_del_cliente.sql

-- ── 1 · Se puede facturar sin documento ────────────────────────────────────
do $$
begin
  insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name)
  values (gen_random_uuid(), 'F-1', 'DTD-0001', 'Sin documento');
exception when others then
  raise exception 'CONTRATO 1 ROTO: no se pudo facturar a un cliente sin documento (%)', sqlerrm;
end;
$$;

-- ── 2 · Los dos tipos válidos entran ───────────────────────────────────────
do $$
begin
  insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name,
                               client_rif, client_doc_kind)
  values (gen_random_uuid(), 'F-2', 'DTD-0002', 'Empresa', 'J-12345678-9', 'empresa'),
         (gen_random_uuid(), 'F-3', 'DTD-0003', 'Persona', 'V-12345678',   'persona');
exception when others then
  raise exception 'CONTRATO 2 ROTO: un tipo válido fue rechazado (%)', sqlerrm;
end;
$$;

-- ── 3 · 🔴 Un tipo inventado NO entra ──────────────────────────────────────
do $$
begin
  insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name,
                               client_rif, client_doc_kind)
  values (gen_random_uuid(), 'F-4', 'DTD-0004', 'Raro', 'X-1', 'pasaporte');
  raise exception 'CONTRATO 3 ROTO: se aceptó un doc_kind inventado — el PDF imprimiría una etiqueta falsa';
exception
  when check_violation then null;  -- esperado
end;
$$;

-- ── 4 · Número presente y tipo NULL: se permite (etiqueta neutra) ──────────
do $$
begin
  insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name,
                               client_rif, client_doc_kind)
  values (gen_random_uuid(), 'F-5', 'DTD-0005', 'Viejo', 'J-99999999-9', null);
exception when others then
  raise exception 'CONTRATO 4 ROTO: no se pudo guardar un documento sin tipo (%)', sqlerrm;
end;
$$;

-- ── 5 · El UPDATE también queda cubierto ───────────────────────────────────
do $$
begin
  update public.invoices set client_doc_kind = 'sociedad' where invoice_code = 'F-2';
  raise exception 'CONTRATO 5 ROTO: el CHECK no cubre el UPDATE — se sella al EMITIR, que es un update';
exception
  when check_violation then null;  -- esperado
end;
$$;

rollback;
