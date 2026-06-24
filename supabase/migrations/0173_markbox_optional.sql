-- ─────────────────────────────────────────────────────────────
-- SDD-0106 (Fase 1): Shipping Mark opcional + generación lazy.
--
-- markbox deja de ser NOT NULL: una persona puede ser cliente sin carga (ej.
-- solo-academia, Fase 2) y por tanto sin Shipping Mark. El unique(tenant_id,
-- markbox) sigue: Postgres permite múltiples NULL, así que varios clientes sin
-- markbox conviven. El Shipping Mark se genera lazy con ensure_client_markbox()
-- cuando la persona inicia su primera carga.
--
-- Fase 1 NO cambia el alta de carga (sigue autogenerando markbox); solo habilita
-- el null y el helper para Fase 2.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

alter table public.clients alter column markbox drop not null;

comment on column public.clients.markbox is
  'SDD-0106: Shipping Mark (DTD-NNNN) del perfil de carga. OPCIONAL: null = persona sin carga aún. Se genera lazy con ensure_client_markbox(). unique(tenant_id, markbox) tolera múltiples null.';

-- ── Generación lazy del Shipping Mark ─────────────────────────
-- Si el cliente ya tiene markbox lo devuelve; si no, genera uno (next_markbox)
-- y lo setea. assert_tenant_match exige que el caller sea del tenant del cliente.
-- El unique(tenant_id, markbox) protege la carrera (2.º update concurrente → 23505).
create or replace function public.ensure_client_markbox(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid;
  v_markbox text;
begin
  select tenant_id, markbox into v_tenant, v_markbox
  from public.clients
  where id = p_client_id and deleted_at is null;

  if v_tenant is null then
    raise exception 'cliente % no existe o está borrado', p_client_id;
  end if;

  perform public.assert_tenant_match(v_tenant);

  if v_markbox is not null then
    return v_markbox;
  end if;

  v_markbox := public.next_markbox(v_tenant);
  update public.clients set markbox = v_markbox where id = p_client_id;
  return v_markbox;
end;
$$;

comment on function public.ensure_client_markbox is
  'SDD-0106: devuelve el Shipping Mark del cliente; si es null lo genera (next_markbox) y lo setea. Idempotente. assert_tenant_match + unique(tenant_id, markbox) protegen tenant y carrera.';

revoke all on function public.ensure_client_markbox(uuid) from public;
revoke execute on function public.ensure_client_markbox(uuid) from anon;
grant execute on function public.ensure_client_markbox(uuid) to authenticated;
