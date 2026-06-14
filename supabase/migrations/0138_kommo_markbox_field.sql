-- SDD-0086: campo de Kommo donde escribir el MARKBOX al convertir un lead en cliente
-- (write-back patch_lead). Aditiva, idempotente, metadata-only.
--
-- Reusa TODO el cableado de SDD-0083/0084: la misma outbox kommo_writeback_outbox (op
-- 'patch_lead' ya esta en el CHECK de migr 0136), la misma RPC blindada enqueue_kommo_writeback,
-- el mismo gate writeback_enabled/writeback_dry_run, y la misma edge function kommo-writeback
-- (op-agnostica: manda row.payload tal cual -> para patch_lead el payload es
-- { custom_fields_values: [{ field_id, values: [{ value }] }] }). Lo unico nuevo es DONDE
-- vive el id del custom field elegido por el founder.
--
-- Columna nullable sin default -> ADD COLUMN instantaneo (metadata-only, sin reescritura).
-- kommo_connections ya tiene RLS (authenticated SELECT por tenant + service_role ALL): la UI
-- LEE el campo, pero el guardado va por server action con admin client (service_role) y NO es
-- forjable via PostgREST (authenticated no tiene grant UPDATE). Sin RLS/RPC/policy/funcion nueva.
alter table public.kommo_connections
  add column if not exists markbox_field_id bigint;

comment on column public.kommo_connections.markbox_field_id is
  'SDD-0086: id del custom field de leads en Kommo donde se escribe el MARKBOX (Shipping Mark) al '
  'convertir un lead en cliente (write-back patch_lead). Lo configura el founder (admin) en /studio/kommo. '
  'null = inerte (no escribe nada). Hereda el gate de SDD-0083.';
