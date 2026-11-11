-- ─────────────────────────────────────────────────────────────
-- 0531 · SDD-0622 · RLS de tablas comerciales por módulo (no solo por tenant)
--
-- QUÉ RESUELVE (auditoría de permisos del 2026-11-11): estas tablas tenían una
-- policy `for all to authenticated using (tenant_id = get_user_tenant_id())`,
-- sin rol y con GRANT de escritura a authenticated. Cualquier miembro activo
-- —incluido `support`, que es de solo lectura, y `marketing`— podía leer y
-- ESCRIBIR por PostgREST, saltándose la matriz del Studio:
--   · rates          0012_rls_perf_and_rpc_guards.sql:242-244
--   · quotes         0012_rls_perf_and_rpc_guards.sql:256-258
--   · conversations / conversation_messages   0106_conversaciones.sql:129-145
--   · purchase_orders / purchase_order_items  0124_purchase_orders.sql:178-185
--   · sales_orders   0125_sales_orders.sql:187-189
--   · chatwoot_conversations (solo lectura)   0504_chatwoot_eventos.sql:117-119
--
-- CÓMO QUEDA. Se reemplaza cada policy `for all` por cuatro (select, insert,
-- update, delete) que deciden con `user_has_module` (0529): rol, desvío por rol
-- (0357), acceso adicional de la persona y scope de almacén, igual que el Studio.
--   · ESCRIBIR exige EDITAR el módulo dueño (support nunca edita).
--   · LEER exige VER alguno de los módulos que hoy consumen la tabla con la
--     sesión del usuario. No es solo el módulo dueño porque otras pantallas ya
--     la leen con su propia sesión y se romperían:
--       - rates: el cotizador (quotes, también el cambio de destino de un envío,
--         que desde esta SDD pide ver el cotizador), la lista de precios de la
--         ficha de cliente (clients), la propuesta de tarifa de la recepción CN
--         (cn, `lib/studio/rate-snapshots/propuesta.ts`) y la conversión a orden
--         de venta (sales-orders). Almacén solo la lee por la CN y con su scope.
--       - quotes: clientes, órdenes de venta, la propuesta CN y reportes.
--       - sales_orders: la propuesta CN y facturación (invoices).
--     El efecto: `marketing` deja de leerlas, y quien no tiene ninguno de esos
--     módulos (o su scope de almacén no lo deja) tampoco.
--   · Se conserva la semántica de borrado lógico: lo borrado (`deleted_at`) no
--     se lee ni se vuelve a tocar. OJO, sin cambio: marcar `deleted_at` con la
--     sesión ya fallaba antes (Postgres aplica la policy de SELECT a la fila
--     nueva de un UPDATE que lee la tabla, y la `for all` vieja filtraba
--     `deleted_at is null`); esta migración no lo arregla ni lo empeora.
--   · Las policies de service_role y las del portal (0117, 0217) no se tocan.
--
-- Esto NO es la fase de dinero (R3): las tablas de dinero las endurece la
-- SDD-0624 en su propia migración.
-- ─────────────────────────────────────────────────────────────

do $preflight$
declare
  v_falta text;
begin
  if pg_catalog.to_regprocedure('public.user_has_module(text,boolean)') is null then
    raise exception '0531 requiere la 0529 (user_has_module)';
  end if;
  select string_agg(t.tabla || '::' || t.policy, ', ')
    into v_falta
  from (values
    ('rates', 'rates by tenant'),
    ('quotes', 'quotes by tenant'),
    ('conversations', 'conversations by tenant'),
    ('conversation_messages', 'conversation_messages by tenant'),
    ('purchase_orders', 'purchase_orders by tenant'),
    ('purchase_order_items', 'purchase_order_items by tenant'),
    ('sales_orders', 'sales_orders by tenant'),
    ('chatwoot_conversations', 'chatwoot_conversations_select_tenant')
  ) as t(tabla, policy)
  where not exists (
    select 1 from pg_catalog.pg_policy p
    where p.polrelid = pg_catalog.to_regclass('public.' || t.tabla)
      and p.polname = t.policy
  );
  if v_falta is not null then
    raise exception '0531: faltan las policies que reemplaza (drift o ya aplicada): %', v_falta;
  end if;
end;
$preflight$;

-- ─── Ayudante: ¿ve/edita ALGUNO de estos módulos? ────────────────────────
create function public.user_has_any_module(p_module_ids text[], p_edit boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(bool_or(public.user_has_module(m, p_edit)), false)
  from pg_catalog.unnest(p_module_ids) as m;
$fn$;

comment on function public.user_has_any_module(text[], boolean) is
  'SDD-0622: true si la persona de la sesión ve (o edita, con p_edit) alguno de los módulos, con la misma decisión que user_has_module.';

revoke all on function public.user_has_any_module(text[], boolean) from public, anon;
grant execute on function public.user_has_any_module(text[], boolean) to authenticated, service_role;

-- ─── rates ────────────────────────────────────────────────────────────────
drop policy "rates by tenant" on public.rates;
create policy rates_select_por_modulo on public.rates
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_any_module(array['rates', 'quotes', 'clients', 'sales-orders', 'cn'])));
create policy rates_insert_por_modulo on public.rates
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('rates', true)));
create policy rates_update_por_modulo on public.rates
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('rates', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('rates', true)));
create policy rates_delete_por_modulo on public.rates
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('rates', true)));

-- ─── quotes ───────────────────────────────────────────────────────────────
-- Escriben el cotizador (quotes) y la conversión a orden de venta, que marca
-- `quotes.sales_order_id` (lib/studio/sales-orders/actions.ts).
drop policy "quotes by tenant" on public.quotes;
create policy quotes_select_por_modulo on public.quotes
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_any_module(array['quotes', 'clients', 'sales-orders', 'cn', 'reports'])));
create policy quotes_insert_por_modulo on public.quotes
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('quotes', true)));
create policy quotes_update_por_modulo on public.quotes
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_any_module(array['quotes', 'sales-orders'], true)))
  with check (tenant_id = (select public.get_user_tenant_id())
              and (select public.user_has_any_module(array['quotes', 'sales-orders'], true)));
create policy quotes_delete_por_modulo on public.quotes
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('quotes', true)));

-- ─── conversations / conversation_messages ───────────────────────────────
drop policy "conversations by tenant" on public.conversations;
create policy conversations_select_por_modulo on public.conversations
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_module('conversaciones', false)));
create policy conversations_insert_por_modulo on public.conversations
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));
create policy conversations_update_por_modulo on public.conversations
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('conversaciones', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));
create policy conversations_delete_por_modulo on public.conversations
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('conversaciones', true)));

drop policy "conversation_messages by tenant" on public.conversation_messages;
create policy conversation_messages_select_por_modulo on public.conversation_messages
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', false)));
create policy conversation_messages_insert_por_modulo on public.conversation_messages
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));
create policy conversation_messages_update_por_modulo on public.conversation_messages
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));
create policy conversation_messages_delete_por_modulo on public.conversation_messages
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));

-- ─── purchase_orders / purchase_order_items ──────────────────────────────
drop policy "purchase_orders by tenant" on public.purchase_orders;
create policy purchase_orders_select_por_modulo on public.purchase_orders
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_module('purchase-orders', false)));
create policy purchase_orders_insert_por_modulo on public.purchase_orders
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));
create policy purchase_orders_update_por_modulo on public.purchase_orders
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('purchase-orders', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));
create policy purchase_orders_delete_por_modulo on public.purchase_orders
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('purchase-orders', true)));

drop policy "purchase_order_items by tenant" on public.purchase_order_items;
create policy purchase_order_items_select_por_modulo on public.purchase_order_items
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', false)));
create policy purchase_order_items_insert_por_modulo on public.purchase_order_items
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));
create policy purchase_order_items_update_por_modulo on public.purchase_order_items
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));
create policy purchase_order_items_delete_por_modulo on public.purchase_order_items
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));

-- ─── sales_orders ─────────────────────────────────────────────────────────
drop policy "sales_orders by tenant" on public.sales_orders;
create policy sales_orders_select_por_modulo on public.sales_orders
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
         and (select public.user_has_any_module(array['sales-orders', 'cn', 'invoices'])));
create policy sales_orders_insert_por_modulo on public.sales_orders
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('sales-orders', true)));
create policy sales_orders_update_por_modulo on public.sales_orders
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('sales-orders', true)))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('sales-orders', true)));
create policy sales_orders_delete_por_modulo on public.sales_orders
  for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('sales-orders', true)));

-- ─── chatwoot_conversations (solo lectura para authenticated) ────────────
-- La leen la Bandeja y la ficha del CRM («quién contesta el chat»). La escribe
-- solo `chatwoot_registrar_evento` (service_role).
drop policy chatwoot_conversations_select_tenant on public.chatwoot_conversations;
create policy chatwoot_conversations_select_por_modulo on public.chatwoot_conversations
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id())
         and (select public.user_has_any_module(array['bandeja', 'kommo'])));

-- ─── Postcondiciones ──────────────────────────────────────────────────────
do $post$
declare
  v_abiertas text;
begin
  -- Ninguna policy de authenticated sobre estas tablas puede quedar sin módulo.
  select string_agg(c.relname || '::' || p.polname, ', ')
    into v_abiertas
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('rates', 'quotes', 'conversations', 'conversation_messages',
                      'purchase_orders', 'purchase_order_items', 'sales_orders', 'chatwoot_conversations')
    and 'authenticated'::regrole = any (p.polroles)
    and p.polname not like '%portal%'
    and coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '')
        || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') not like '%user_has_%module%';
  if v_abiertas is not null then
    raise exception '0531: quedan policies de authenticated sin módulo: %', v_abiertas;
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.user_has_any_module(text[],boolean)', 'EXECUTE') then
    raise exception '0531: anon no debe ejecutar user_has_any_module';
  end if;
end;
$post$;
