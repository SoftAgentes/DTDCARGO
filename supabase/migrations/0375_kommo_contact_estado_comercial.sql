-- 0375_kommo_contact_estado_comercial.sql
--
-- CRM · SDD-0256 · Fase 5 (B4) — el agente de IA de Kommo deja de contestar a ciegas.
--
-- ── Por qué en el CONTACTO y no en el lead ──────────────────────────────────
-- El lead se cierra y se lleva sus campos. El contacto es permanente. Y los
-- agentes de IA de Kommo leen campos del CONTACTO: es ahí donde tiene que estar
-- escrito "este cliente tiene saldo pendiente" para que el agente escale a un
-- humano en vez de responder como si nada.
--
-- ── Sí/no, sin montos (decisión del founder, 2026-08-14) ────────────────────
-- Los dos campos son de texto y llevan "Sí" o "No". No llevan el saldo en
-- dólares ni la cantidad de bultos. El motivo es que del otro lado hay un
-- agente automático: un monto exacto es plata hablando sola frente a algo que
-- puede repetirlo fuera de contexto, y el sí/no ya alcanza para lo único que
-- se le pide — que escale a una persona.
--
-- ── Nace inerte, por partida doble ─────────────────────────────────────────
-- 1. Sin `contact_*_field_id` configurado, el job no encola nada. Es el MISMO
--    patrón de `markbox_field_id` (0086) y `markbox_contact_field_id` (0344):
--    la feature existe y no hace nada hasta que el founder elige el campo.
-- 2. Y aunque se configure, el gate de escritura de la 0136
--    (`writeback_enabled` + `writeback_dry_run`) sigue mandando.
--
-- No se agrega un feature flag global: en este módulo la inercia ya vive en la
-- configuración del campo, y un tercer interruptor sólo agregaría un lugar más
-- donde mirar cuando algo no escribe.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_connections') is null then
    raise exception '0375 requiere public.kommo_connections (migración 0043)';
  end if;
end;
$preflight$;

alter table public.kommo_connections
  add column if not exists contact_saldo_field_id    bigint,
  add column if not exists contact_transito_field_id bigint;

comment on column public.kommo_connections.contact_saldo_field_id is
  'SDD-0256 B4: custom field de CONTACTO donde va "tiene saldo pendiente" (Si/No). '
  'null = la feature esta inerte, igual que markbox_contact_field_id.';

comment on column public.kommo_connections.contact_transito_field_id is
  'SDD-0256 B4: custom field de CONTACTO donde va "tiene carga en transito" (Si/No). '
  'null = inerte.';
