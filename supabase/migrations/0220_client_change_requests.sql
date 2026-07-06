-- ─────────────────────────────────────────────────────────────
-- SDD-0151 Fase B: solicitudes de cambio de datos del cliente.
--
-- El cliente PROPONE un cambio a sus datos de identidad (nombre, cédula/RIF,
-- teléfono) desde el Portal; el asesor lo APRUEBA dentro del Studio antes de
-- que se aplique a la ficha `clients`. Nunca markbox (código) ni email.
--
-- Patrón de escritura = SDD-0101 Slice B (0153_client_claims_portal.sql):
-- el cliente del portal NO inserta por RLS. La action del portal usa el ADMIN
-- client (service_role) y CONTROLA los campos sensibles (client_id resuelto por
-- sesión, status='pending', snapshot de los valores previos). El cliente solo
-- VE los suyos (policy SELECT self-scope). El approve/reject lo hace el Studio
-- con service_role (aplica a clients tras revisión humana). Así el cliente no
-- puede auto-aprobar, forjar el estado, ni tocar otra cuenta.
--
-- Una sola solicitud abierta por cliente → índice único parcial (protege
-- contra carreras; la UX del portal ya bloquea el reenvío antes del 23505).
--
-- NO aplicar a prod (lo hace la coordinación / founder con su OK).
-- ─────────────────────────────────────────────────────────────

create table public.client_change_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,

  -- Valores propuestos (whitelist). NULL = "no cambiar este campo".
  proposed_name  text,
  proposed_rif   text,
  proposed_phone text,

  -- Snapshot del valor previo al momento de proponer (para el diff en el Studio
  -- y para auditoría — qué se cambió, aunque la ficha ya haya mutado después).
  prev_name  text,
  prev_rif   text,
  prev_phone text,

  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),

  -- Traza ISO 9001: quién revisó y cuándo, nota opcional del rechazo/aprobación.
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id),
  review_note  text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Al menos un campo propuesto no-nulo (no crear solicitudes vacías).
  constraint client_change_requests_not_empty check (
    proposed_name is not null
    or proposed_rif is not null
    or proposed_phone is not null
  )
);

comment on table public.client_change_requests is
  'SDD-0151: solicitudes de cambio de datos de identidad del cliente (nombre/rif/teléfono). El cliente propone desde el portal; el asesor aprueba en el Studio y ahí se aplica a clients. Nunca markbox ni email.';

-- Una sola solicitud PENDING por cliente (idempotencia + "editar de a una").
create unique index client_change_requests_one_open
  on public.client_change_requests (client_id)
  where status = 'pending';

-- El asesor lista las pendientes de su tenant; el detalle busca por cliente.
create index client_change_requests_tenant_status_idx
  on public.client_change_requests (tenant_id, status);
create index client_change_requests_client_idx
  on public.client_change_requests (client_id);

-- ── RLS ──
alter table public.client_change_requests enable row level security;

-- El cliente del portal VE las suyas (self-scope por sesión). El admin del
-- tenant las ve por tenant. PERMISSIVE (OR): un cliente del portal no está en
-- user_tenants → solo matchea la primera; un user de equipo → la segunda.
create policy "client_change_requests self or tenant read"
  on public.client_change_requests for select
  to authenticated
  using (
    client_id = public.get_portal_client_id()
    or tenant_id = public.get_user_tenant_id()
  );
-- Sin policies de INSERT/UPDATE/DELETE: solo service_role escribe (la action del
-- portal crea la solicitud; la del Studio la aprueba/rechaza). service_role
-- bypassa RLS — el cliente NUNCA muta esta tabla directo.

grant select on public.client_change_requests to authenticated;

-- Trigger updated_at (reusa la function existente del repo).
create trigger client_change_requests_touch
  before update on public.client_change_requests
  for each row execute function public.touch_updated_at();
