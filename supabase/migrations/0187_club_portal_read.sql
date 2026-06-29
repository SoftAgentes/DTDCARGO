-- ─────────────────────────────────────────────────────────────
-- 0187 · SDD-0116 · Club DTD — Slice E: lectura del Club desde el PORTAL
--
-- El miembro del Club (cliente del portal, rol authenticated SIN tenant) hoy no
-- puede leer club_members / club_group_buys / _participants (solo tienen la policy
-- "by tenant", que usa get_user_tenant_id() = NULL para el portal). Esta migración
-- agrega lectura de PORTAL, additiva (OR con las policies de Studio existentes),
-- SOLO SELECT (V1 read-only: el miembro VE, no muta desde el portal):
--   · club_members         → su PROPIA membresía (por persona).
--   · club_group_buys       → rondas ABIERTAS de su tenant, si es miembro ACTIVO.
--   · _participants         → SOLO sus PROPIAS participaciones (privacidad: NO ve
--                             la identidad de otros miembros).
--
-- El portal scope-a por cliente; el miembro del Club se ancla a persons (SDD-0106).
-- Puente: get_portal_person_id() = clients.person_id del cliente del portal. El
-- agregado de CBM comprometido NO se expone al portal en V1 (vive en Studio); se
-- reevalúa cuando llegue el auto-sumarse (write-path del miembro).
--
-- Patrón portal SDD-0042: helper SECURITY DEFINER + predicado de pertenencia (no
-- BOLA). Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder. Skills Supabase (seguridad + postgres) seguidos.
-- ─────────────────────────────────────────────────────────────

-- ── Puente portal→persona ─────────────────────────────────────
-- El cliente del portal (get_portal_client_id) apunta a una persona vía
-- clients.person_id (SDD-0106, 0172). Devuelve NULL si el principal no es cliente
-- o el cliente no tiene persona ligada → los predicados de portal fallan cerrados.
create or replace function public.get_portal_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.person_id
  from public.clients c
  where c.id = public.get_portal_client_id()
    and c.deleted_at is null
  limit 1
$$;

comment on function public.get_portal_person_id is
  'Portal (SDD-0116 Slice E): persons.id del cliente del portal vía clients.person_id (SDD-0106). NULL si no aplica → cierra los predicados de portal. NO tocar get_user_tenant_id().';

grant execute on function public.get_portal_person_id() to authenticated;
revoke execute on function public.get_portal_person_id() from public, anon;

-- ── 1) club_members — el miembro ve SU PROPIA membresía ───────
drop policy if exists "club_members portal read" on public.club_members;
create policy "club_members portal read" on public.club_members for select
  to authenticated
  using (
    deleted_at is null
    and person_id = public.get_portal_person_id()
  );

-- ── 2) club_group_buys — rondas ABIERTAS, si es miembro ACTIVO ─
-- El miembro ve las compras grupales abiertas de SU tenant (la membresía fija el
-- tenant; el portal no tiene get_user_tenant_id()). Solo 'abierta' en V1.
drop policy if exists "club_group_buys portal read" on public.club_group_buys;
create policy "club_group_buys portal read" on public.club_group_buys for select
  to authenticated
  using (
    deleted_at is null
    and status = 'abierta'
    and exists (
      select 1 from public.club_members m
      where m.tenant_id = club_group_buys.tenant_id
        and m.person_id = public.get_portal_person_id()
        and m.status = 'activa'
        and m.deleted_at is null
    )
  );

-- ── 3) _participants — SOLO las propias (privacidad) ──────────
-- El miembro ve únicamente SUS participaciones (no las de otros miembros). El
-- agregado de volumen comprometido NO se deriva en el portal (no ve a los demás).
drop policy if exists "club_gb_participants portal read" on public.club_group_buy_participants;
create policy "club_gb_participants portal read" on public.club_group_buy_participants for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.club_members m
      where m.id = club_group_buy_participants.member_id
        and m.person_id = public.get_portal_person_id()
        and m.deleted_at is null
    )
  );
