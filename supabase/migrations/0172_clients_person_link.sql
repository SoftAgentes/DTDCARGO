-- ─────────────────────────────────────────────────────────────
-- SDD-0106 (Fase 1): clients.person_id — link al ancla de identidad.
--
-- Cada clients (perfil de carga) apunta a su persons (identidad). Backfill por
-- legacy_client_id que 0170 guardó. Nullable: clientes borrados no tienen
-- persona; nuevos clientes setean person_id en el alta (capa app).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column person_id uuid references public.persons(id) on delete set null;

comment on column public.clients.person_id is
  'SDD-0106: identidad (persons) de este perfil de carga. Backfill por persons.legacy_client_id (0170).';

create index clients_person_idx on public.clients (person_id) where deleted_at is null;

-- Backfill del link: clients vivo → su persona derivada en 0170.
update public.clients c
set person_id = p.id
from public.persons p
where p.legacy_client_id = c.id
  and c.person_id is null;
