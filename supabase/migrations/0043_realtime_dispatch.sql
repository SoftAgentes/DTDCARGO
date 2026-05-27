-- ─────────────────────────────────────────────────────────────
-- Bridge Fase 1 (memoria [[bridge-approach-supabase-realtime]]):
-- Habilita Supabase Realtime para las tablas del pipeline Despacho.
--
-- Habilita propagación cross-cliente (CN → Admin → Bodeguero →
-- Transportista) sin polling ni broker pub/sub adicional. Cada cliente
-- subscribe via `supabase.channel()` y recibe payloads filtrados por
-- RLS automáticamente (tenant_id queda transparente).
--
-- Tablas incluidas:
--   - dispatch_orders         · status transitions del OD
--   - dispatch_order_packages · paquetes cargados/quitados de un OD
--   - warehouse_receipts_cn   · paquetes que llegan a CN (alimenta cola)
--
-- NO se incluyen (read-only durante el flow operativo):
--   - dispatch_routes, dispatch_city_catalog, dispatch_rules (catálogos)
--
-- Idempotente: usa DO bloque con check antes de agregar.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  -- dispatch_orders
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dispatch_orders'
  ) then
    alter publication supabase_realtime add table public.dispatch_orders;
  end if;

  -- dispatch_order_packages
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dispatch_order_packages'
  ) then
    alter publication supabase_realtime add table public.dispatch_order_packages;
  end if;

  -- warehouse_receipts_cn
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'warehouse_receipts_cn'
  ) then
    alter publication supabase_realtime add table public.warehouse_receipts_cn;
  end if;
end $$;

comment on publication supabase_realtime is
  'Publicación nativa de Supabase Realtime. Incluye tablas con changes que deben propagar a clientes subscritos via WebSocket (filtrado por RLS automático).';
