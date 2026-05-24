-- ─────────────────────────────────────────────────────────────
-- DTD-ERPv1-DIA3 audit fix continuation
--   FINDING-005 (MEDIUM) — getOperationalCounts() trae todos los rows a JS
--
-- Antes: lib/studio/dashboard-queries.ts hacia
--   `select status from shipments` (sin limit) y contaba en TypeScript.
--   Con 100K shipments traia 100K rows al cliente.
--
-- Despues: RPC SQL que cuenta con count(*) filter (where ...) en una sola
--   query, usando los indexes (tenant_id, status) ya existentes.
--   RLS filtra por tenant automaticamente — uso `security invoker` para
--   evitar el lint "anon_security_definer_function_executable" del advisor.
--
-- Drop-in. No toca data ni schema.
-- ─────────────────────────────────────────────────────────────

create or replace function public.shipments_dashboard_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'enTransito', count(*) filter (where status in ('shipped','in_transit','last_mile','out_for_delivery')),
    'enAduana',   count(*) filter (where status = 'in_customs'),
    'entregados', count(*) filter (where status = 'delivered'),
    'conAlerta',  count(*) filter (where status in ('exception','delayed_warehouse')),
    'total',      count(*)
  )
  from public.shipments
  where deleted_at is null;
$$;

comment on function public.shipments_dashboard_counts is
  'Agregacion de counts del dashboard operacional. Reemplaza loop JS de getOperationalCounts(). RLS filtra por tenant automaticamente (security invoker).';

-- Grant a authenticated (RLS de shipments hace el resto del filtrado)
grant execute on function public.shipments_dashboard_counts() to authenticated;
revoke execute on function public.shipments_dashboard_counts() from public, anon;
