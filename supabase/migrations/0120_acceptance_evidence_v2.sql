-- ─────────────────────────────────────────────────────────────
-- SDD-0067 · Aceptación con evidencia reforzada (SDD-B del handoff legal)
--
-- Sube `legal_acceptances` (0102) al estándar probatorio del handoff:
--
--   · user_agent            = navegador/dispositivo del cliente al aceptar.
--                             Lo sella el SERVIDOR (headers() en la action,
--                             NUNCA el body del form), saneado: trim, máx 512
--                             chars, vacío → null. ENTRA al hash v2.
--   · merchant_declaration  = declaración de comerciante (checkbox 2 del modal,
--                             cláusula 1.4 del Acuerdo v3): "actúo como
--                             comerciante, empresa o emprendedor con fines de
--                             lucro". FORMA PARTE de lo aceptado → ENTRA al
--                             hash v2. default false: una fila sin declaración
--                             explícita NO la acredita.
--   · invoice_id            = atadura FORENSE a la factura borrador que originó
--                             la aceptación. METADATO: NO entra al hash — la
--                             granularidad de re-aceptación sigue siendo la
--                             ORDEN (`quote_code` = shipment_code; decisión M-1
--                             de SDD-0054 round 2: re-emisión de factura del
--                             mismo shipment comparte aceptación). on delete
--                             set null: borrar la factura no borra la prueba.
--
-- Evidencia v2 = PRIMER formato productivo: verificado 2026-06-10 que
-- `legal_acceptances` tiene 0 filas en prod (v1 nunca llegó a sellar nada) →
-- el bump v:1 → v:2 del hash es un breaking LIMPIO, sin compat hacia atrás.
--
-- Aditiva: solo ADD COLUMN + índice. ⚠️ El trigger de inmutabilidad de 0102
-- (`legal_acceptances_immutable`) es BEFORE UPDATE OR DELETE *FOR EACH ROW* —
-- un ALTER TABLE es DDL y no dispara triggers por fila, así que este ALTER
-- pasa limpio sin tocar el trigger. ADD COLUMN con default es fast-default en
-- Postgres 11+ (sin rewrite de la tabla; con 0 filas es instantáneo igual).
--
-- ⚠️ NO se aplica a prod desde acá (la aplica el founder; debe estar aplicada
-- ANTES de deployar el código v2 — el gate y la bitácora seleccionan las
-- columnas nuevas).
-- Número de migración: 0120 (0119 = prealerta_share_token es la última).
-- ─────────────────────────────────────────────────────────────

alter table public.legal_acceptances
  add column user_agent           text,
  add column merchant_declaration boolean not null default false,
  add column invoice_id           uuid references public.invoices(id) on delete set null;

comment on column public.legal_acceptances.user_agent is
  'SDD-0067: user agent del cliente al aceptar. Server-sellado (headers() en la action; saneado trim/512/vacío→null). ENTRA al hash v2.';

comment on column public.legal_acceptances.merchant_declaration is
  'SDD-0067: declaración de comerciante (checkbox 2 · cláusula 1.4 Acuerdo v3). Parte de lo aceptado → ENTRA al hash v2. Sin declaración (false) no hay aceptación válida.';

comment on column public.legal_acceptances.invoice_id is
  'SDD-0067: atadura forense a la factura borrador que originó la aceptación. METADATO (NO entra al hash; la granularidad de re-aceptación sigue siendo la orden/quote_code — M-1 de 0054 round 2).';

-- Lookup forense por factura (export de evidencia / expediente). Parcial: la
-- mayoría de las filas legacy/edge podrían no enlazar factura.
create index legal_acceptances_tenant_invoice_idx
  on public.legal_acceptances (tenant_id, invoice_id)
  where invoice_id is not null;

comment on table public.legal_acceptances is
  'SDD-0054 + SDD-0067: registro INMUTABLE (append-only) de aceptaciones legales. PRUEBA LEGAL server-sellada: accepted_at/ip/user_agent/hash los pone el servidor; hash v2 NOT NULL es LOAD-BEARING (cubre también user_agent + merchant_declaration; el gate AUT-04 lo recomputa y verifica). Atada a la medida (cbm/weight/total) y forense a la factura (invoice_id, fuera del hash). Trigger rechaza UPDATE/DELETE. Idempotente por (tenant, hash). RLS por tenant_id.';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0120_acceptance_evidence_v2.sql
-- (la aplica el founder; el harness NO aplica a prod)
-- ─────────────────────────────────────────────────────────────
