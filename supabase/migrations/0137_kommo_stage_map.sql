-- SDD-0084 (cierra SDD-0062 Slice B): mapa etapa-Kommo <-> estado-estimado para el
-- write-back de ETAPA. Aditiva, idempotente, metadata-only.
--
-- Reusa TODO el cableado de SDD-0083 (migr 0136): la misma outbox kommo_writeback_outbox
-- (op 'patch_stage' ya esta en el CHECK), la misma RPC enqueue_kommo_writeback (ya
-- blindada), el mismo gate writeback_enabled/writeback_dry_run, y la misma edge function
-- kommo-writeback (es op-agnostica: manda row.payload tal cual en el PATCH). Lo unico
-- nuevo es DONDE vive el mapa que el founder configura.
--
-- Por que columna y no tabla: el mapa son <=3 claves (sent/accepted/rejected) atadas 1:1
-- a la conexion del tenant. kommo_connections ya existe, ya tiene RLS (authenticated SELECT
-- por tenant + service_role ALL) y ya la lee la UI. Una columna jsonb reusa esa RLS sin
-- tabla/policy/RPC nuevos. authenticated PUEDE leer el mapa (UI) pero NO escribirlo (no hay
-- grant UPDATE) -> el guardado va por server action con admin client (service_role) y NO es
-- forjable via PostgREST. Sin SECURITY DEFINER nuevo -> sin deuda anon-execute.

-- Default constante ('{}'::jsonb) -> ADD COLUMN metadata-only (PG 11+, sin reescritura de
-- tabla). Forma: { "sent": {"pipeline_id":N,"status_id":N}, "accepted": {...}, "rejected": {...} }
-- (solo los estados que el founder mapeo; el resto queda fuera = no dispara patch_stage).
alter table public.kommo_connections
  add column if not exists stage_map jsonb not null default '{}'::jsonb;

comment on column public.kommo_connections.stage_map is
  'SDD-0084: mapa estado-del-estimado -> etapa de Kommo para el write-back de etapa (patch_stage). '
  'jsonb { sent|accepted|rejected: { pipeline_id, status_id } }. Lo configura el founder (admin) en '
  '/studio/kommo. Vacio ({}) = patch_stage inerte (no encola nada). Hereda el gate de SDD-0083.';
