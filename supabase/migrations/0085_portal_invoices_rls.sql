-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 3: Portal del Cliente — facturas read-only.
--
-- Policy ADITIVA (permissive, SELECT-only) para que el cliente lea SUS facturas
-- por markbox — ESPEJO de "shipments portal self read" (migr 0080). El cliente
-- ve sólo facturas REALES (status <> 'borrador'; los borradores son internos del
-- equipo) y no borradas. La escritura sigue siendo SOLO del equipo (policy
-- "invoices by tenant" de 0077). `invoices` linkea al cliente por `client_markbox`
-- (text, no FK) → usamos la helper get_portal_client_markbox().
--
-- NOTA aislamiento: las queries del portal (lib/portal/portal-queries) ADEMÁS
-- filtran EXPLÍCITO por get_portal_client_markbox() — defensa en profundidad para
-- el principal que es team + portal a la vez (la policy by-tenant del equipo es
-- permissive OR y, sola, le mostraría todo el tenant en el portal).
-- ─────────────────────────────────────────────────────────────

drop policy if exists "invoices portal self read" on public.invoices;

create policy "invoices portal self read"
  on public.invoices for select to authenticated
  using (
    deleted_at is null
    and status <> 'borrador'
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );
