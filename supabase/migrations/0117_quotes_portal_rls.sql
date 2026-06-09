-- ─────────────────────────────────────────────────────────────
-- SDD-0061 · Portal del Cliente — estimados read-only.
--
-- Policy ADITIVA (permissive, SELECT-only) para que el cliente lea SUS estimados
-- por markbox — ESPEJO de "invoices portal self read" (migr 0085). El cliente ve
-- sólo estimados ya VINCULADOS a su cuenta (client_markbox = su markbox) y no
-- borrados. Un estimado web sin vincular (client_markbox null) NO es visible para
-- nadie en el portal (todavía no es de un cliente). La escritura sigue siendo SOLO
-- del equipo (policy "quotes by tenant" de 0007). `quotes` linkea al cliente por
-- `client_markbox` (text, no FK) → usamos la helper get_portal_client_markbox().
--
-- NOTA aislamiento: las queries del portal (lib/portal/portal-queries) ADEMÁS
-- filtran EXPLÍCITO por get_portal_client_markbox() — defensa en profundidad para
-- el principal que es team + portal a la vez (la policy by-tenant del equipo es
-- permissive OR y, sola, le mostraría todo el tenant en el portal).
--
-- Sin DDL sobre la tabla: sólo agrega una policy. No toca datos.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "quotes portal self read" on public.quotes;

create policy "quotes portal self read"
  on public.quotes for select to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );
