-- ─────────────────────────────────────────────────────────────
-- SDD-0043 fix — kommo_statuses: la PK debe incluir pipeline_id.
-- Las etapas reservadas de Kommo (142 "ganado" / 143 "perdido") se repiten en
-- TODOS los pipelines con el MISMO id → la PK (tenant_id, id) rompía el UPSERT
-- con "ON CONFLICT DO UPDATE command cannot affect row a second time".
-- La clave natural de una etapa en Kommo es (pipeline_id, id).
-- ─────────────────────────────────────────────────────────────
alter table public.kommo_statuses drop constraint kommo_statuses_pkey;
alter table public.kommo_statuses add  primary key (tenant_id, pipeline_id, id);

-- El índice (tenant_id, pipeline_id) queda redundante (prefijo de la nueva PK).
drop index if exists public.kommo_statuses_pipeline_idx;
