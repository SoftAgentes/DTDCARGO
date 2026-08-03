-- SDD-0244 · Vínculo estable cliente ↔ contacto de Kommo.
--
-- Hoy `clients` sólo tiene `kommo_lead_id`: apunta a LA VENTA, no a LA PERSONA.
-- El lead se cierra y se lleva la marca, así que un cliente que vuelve a escribir
-- se ve idéntico a un desconocido (medido 2026-08-03: 0 de 428 clientes marcados
-- en Kommo, 0 de 2.877 leads con Shipping Mark).
--
-- Esta migración agrega el vínculo con la persona —que es permanente— más los dos
-- índices que hacen barato el enrutado a Recontacto:
--   · por contacto  → camino rápido cuando el cliente ya está vinculado
--   · por teléfono  → camino de AUTO-SANADO la primera vez que escribe
--
-- Aditiva y metadata-only sobre `clients`: la columna es nullable y sin default,
-- así que el ADD COLUMN no reescribe la tabla (PG 11+). No toca RLS ni policies.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.clients') is null then
    raise exception '0342 requiere public.clients';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'phone'
  ) then
    raise exception '0342 requiere clients.phone para el índice de auto-sanado';
  end if;
end;
$preflight$;

-- ── El vínculo con la persona ────────────────────────────────────────────────
alter table public.clients
  add column if not exists kommo_contact_id bigint;

comment on column public.clients.kommo_contact_id is
  'SDD-0244: id del contacto de Kommo (la PERSONA). Estable: sobrevive al cierre '
  'del trato, a diferencia de kommo_lead_id que apunta a UNA venta. Lo llena el '
  'enrutador la primera vez que resuelve al cliente por teléfono (auto-sanado), o '
  'el puente lead→cliente (SDD-0058) al convertir. NULL = todavía no vinculado.';

-- Camino rápido del enrutador: ¿este contacto ya es cliente?
create index if not exists clients_kommo_contact_idx
  on public.clients (tenant_id, kommo_contact_id)
  where kommo_contact_id is not null;

-- Camino de auto-sanado: resolver por teléfono SIN escanear la tabla.
-- Se indexan los últimos 10 dígitos, que es como compara `phonesMatch`
-- (lib/studio/estimado-linking.ts) para números VE. Las funciones van calificadas
-- por esquema porque el índice se evalúa con el search_path del escritor.
create index if not exists clients_phone_last10_idx
  on public.clients (
    tenant_id,
    pg_catalog."right"(
      pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'),
      10
    )
  )
  where phone is not null and phone <> '';

-- ── La outbox aprende a escribirle al CONTACTO ───────────────────────────────
-- Las tres ops existentes (patch_price · patch_stage · patch_lead) apuntan a
-- leads. `patch_contact` es la que hace que el Shipping Mark quede en un lugar
-- que no muere al cerrar el trato. La edge function es op-agnóstica (manda
-- row.payload tal cual): lo único que cambia allá es el endpoint.
alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_op_check;

alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_op_check
  check (op in ('patch_price', 'patch_stage', 'patch_lead', 'patch_contact'));

comment on column public.kommo_writeback_outbox.op is
  'SDD-0083/0084/0086 + SDD-0244: patch_price · patch_stage · patch_lead apuntan a '
  'un lead; patch_contact apunta a un contacto (PATCH /api/v4/contacts) y es el que '
  'deja el Shipping Mark donde sobrevive al cierre del trato.';
