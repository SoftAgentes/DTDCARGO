-- SDD-0087: espejo de usuarios de Kommo, para mostrar el NOMBRE del asesor en el
-- tablero CRM (hoy "Asesor #142"). Read-only, clon del patron de los kommo_* (migr 0082).
-- Lo llena la edge function kommo-sync (GET /api/v4/users). Sin RPC, sin SECURITY DEFINER.

create table if not exists public.kommo_users (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  id          bigint not null,
  name        text,
  email       text,
  synced_at   timestamptz not null default now(),
  primary key (tenant_id, id)
);
comment on table public.kommo_users is
  'SDD-0087: espejo de usuarios (asesores) de Kommo. id = responsible_user_id de leads/contacts.';

-- Data API: el tablero lee con el cliente authenticated (RLS por tenant); la edge
-- function escribe con service_role. Mismos grants que el resto del espejo (0082).
grant select on public.kommo_users to authenticated;
grant all    on public.kommo_users to service_role;

alter table public.kommo_users enable row level security;

-- authenticated ve SOLO los usuarios de SU tenant (lectura). service_role todo (sync).
create policy "kommo_users tenant read" on public.kommo_users
  for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_users service all" on public.kommo_users
  for all to service_role using (true) with check (true);
