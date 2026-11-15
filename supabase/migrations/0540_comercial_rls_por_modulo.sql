-- ─────────────────────────────────────────────────────────────
-- 0540 · SDD-0622 · RLS de tablas comerciales por módulo (no solo por tenant)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: 0528 → 0538 → 0539 → 0540. Requiere la 0538 (`user_has_module`).
--
-- ⚠️ LOCK: cada DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre su tabla hasta
--    el COMMIT. Son 8 tablas vivas (rates, quotes, conversations,
--    conversation_messages, purchase_orders, purchase_order_items, sales_orders
--    y chatwoot_conversations): mientras corre, el Studio, el portal y los
--    webhooks de Chatwoot que las lean o escriban esperan. Aplicar en una
--    ventana tranquila y con lock_timeout corto (runbook).
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
-- update, delete) que deciden con `user_has_module` (0538): rol, desvío por rol
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
--   · Borrado lógico, como lo dejó la 0230 (`0230_fix_rls_soft_delete_blocked.sql`):
--     las lecturas (SELECT) NO filtran `deleted_at`. Postgres aplica la policy de
--     SELECT a la fila nueva de un UPDATE que lee la tabla, así que un filtro
--     `deleted_at is null` ahí haría fallar el borrado lógico con la sesión
--     («new row violates row-level security policy»), también para admin. Lo
--     borrado lo oculta la aplicación en cada consulta (`.is("deleted_at", null)`).
--     Update y delete siguen sin tocar filas ya borradas (`deleted_at is null` en
--     su USING, que solo mira la fila vieja).
--   · Las policies de service_role y las del portal (0117, 0217) no se tocan.
--
-- Esto NO es la fase de dinero (R3): las tablas de dinero las endurece la
-- SDD-0624 en su propia migración.
-- ─────────────────────────────────────────────────────────────

-- Como la 0511: si una de las 8 tablas está tomada, abortar en vez de hacer cola
-- (y de dejar en cola a todo lo que llegue detrás del ACCESS EXCLUSIVE).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_t     record;
  v_priv  text;
  v_falta text;
begin
  if pg_catalog.to_regprocedure('public.user_has_module(text,boolean)') is null then
    raise exception '0540 requiere la 0538 (user_has_module)';
  end if;

  -- Tabla por tabla, al nivel de la 0511: de postgres, RLS activa y SIN FORCE
  -- (así la RLS no alcanza a los DEFINER), y los privilegios que las policies
  -- nuevas necesitan. `escribe` = authenticated tiene INSERT/UPDATE/DELETE.
  -- anon no se afirma aquí: lo mide el DG en el catálogo de producción.
  for v_t in select * from (values
    ('rates', true), ('quotes', true), ('conversations', true), ('conversation_messages', true),
    ('purchase_orders', true), ('purchase_order_items', true), ('sales_orders', true),
    ('chatwoot_conversations', false)
  ) e(tabla, escribe) loop
    if not exists (select 1 from pg_catalog.pg_class c
                    where c.oid = pg_catalog.to_regclass('public.' || v_t.tabla)
                      and c.relrowsecurity and not c.relforcerowsecurity
                      and c.relowner = 'postgres'::pg_catalog.regrole) then
      raise exception '0540 abortado: public.% no es de postgres con RLS activa y sin FORCE', v_t.tabla;
    end if;
    if not pg_catalog.has_table_privilege('authenticated', 'public.' || v_t.tabla, 'SELECT') then
      raise exception '0540 abortado: authenticated no tiene SELECT sobre public.%', v_t.tabla;
    end if;
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE'] loop
      if pg_catalog.has_table_privilege('authenticated', 'public.' || v_t.tabla, v_priv) <> v_t.escribe then
        raise exception '0540 abortado: el % de authenticated sobre public.% no es el esperado', v_priv, v_t.tabla;
      end if;
    end loop;
  end loop;

  -- El conjunto EXACTO de policies que deja el repo en las 8 tablas: nombre,
  -- comando, roles, permisiva y huella (md5 sin espacios de `qual|with_check`,
  -- mismo método que la 0511). Es el estado del repo DESPUÉS de la 0230, que
  -- quitó `AND (deleted_at IS NULL)` del USING de las FOR ALL «by tenant»: el
  -- fixture de supabase/tests/0540_*.test.sql copia 0012, 0106, 0124, 0125,
  -- 0428, 0433 y 0504 y aplica la 0230 real. `166af319…` es la huella que la
  -- 0511 midió en producción para la misma forma (0511:73 y :75). El catálogo de
  -- producción lo mide el DG antes de aplicar.
  -- Una policy de más quedaría en paralelo y, si es permisiva, reabriría lo
  -- que esta cierra.
  with expected(tablename, policyname, cmd, roles, huella) as (values
    ('rates',                  'rates by tenant',                        'ALL',    array['authenticated']::name[], '5b84860214a7eeed1bd1cd67c154b817'),
    ('quotes',                 'quotes by tenant',                       'ALL',    array['authenticated']::name[], '5b84860214a7eeed1bd1cd67c154b817'),
    ('quotes',                 'quotes portal self read',                'SELECT', array['authenticated']::name[], 'dcd0ac40a95dd62de8bc8a9da1254ef4'),
    ('conversations',          'conversations by tenant',                'ALL',    array['authenticated']::name[], '166af3198bb588089bebf7ac447ad386'),
    ('conversations',          'conversations service_role all',         'ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d'),
    ('conversation_messages',  'conversation_messages by tenant',        'ALL',    array['authenticated']::name[], '166af3198bb588089bebf7ac447ad386'),
    ('conversation_messages',  'conversation_messages service_role all', 'ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d'),
    ('conversation_messages',  'conv_messages portal client read own',   'SELECT', array['authenticated']::name[], 'b020e161bd5da9a8be82dd285d7737d8'),
    ('purchase_orders',        'purchase_orders by tenant',              'ALL',    array['authenticated']::name[], '166af3198bb588089bebf7ac447ad386'),
    ('purchase_orders',        'purchase_orders service_role all',       'ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d'),
    ('purchase_order_items',   'purchase_order_items by tenant',         'ALL',    array['authenticated']::name[], '166af3198bb588089bebf7ac447ad386'),
    ('purchase_order_items',   'purchase_order_items service_role all',  'ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d'),
    ('sales_orders',           'sales_orders by tenant',                 'ALL',    array['authenticated']::name[], '166af3198bb588089bebf7ac447ad386'),
    ('sales_orders',           'sales_orders service_role all',          'ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d'),
    ('chatwoot_conversations', 'chatwoot_conversations_select_tenant',   'SELECT', array['authenticated']::name[], '8a6363ce084bcb9f4547aa7a80376539'),
    ('chatwoot_conversations', 'chatwoot_conversations_service_role_all','ALL',    array['service_role']::name[],  'fe2e7aa3a94b94b876d7713f1517686d')
  ), actual as (
    select p.tablename::text as tablename, p.policyname::text as policyname, p.cmd, p.roles, p.permissive,
           pg_catalog.md5(pg_catalog.regexp_replace(
             coalesce(p.qual, '') || '|' || coalesce(p.with_check, ''), '\s', '', 'g')) as huella
      from pg_catalog.pg_policies p
     where p.schemaname = 'public'
       and p.tablename in ('rates', 'quotes', 'conversations', 'conversation_messages',
                           'purchase_orders', 'purchase_order_items', 'sales_orders', 'chatwoot_conversations')
  )
  select string_agg(coalesce(e.tablename, a.tablename) || '::' || coalesce(e.policyname, a.policyname), ', ')
    into v_falta
  from expected e full join actual a
    on a.tablename = e.tablename and a.policyname = e.policyname
  where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
     or a.roles <> e.roles or a.permissive <> 'PERMISSIVE' or a.huella <> e.huella;
  if v_falta is not null then
    raise exception '0540: faltan las policies que reemplaza o no son las del repo (drift o ya aplicada): %', v_falta;
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
  using (tenant_id = (select public.get_user_tenant_id())
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
  using (tenant_id = (select public.get_user_tenant_id())
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
  using (tenant_id = (select public.get_user_tenant_id())
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
  using (tenant_id = (select public.get_user_tenant_id())
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
  using (tenant_id = (select public.get_user_tenant_id())
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
    -- authenticated o TO public (polroles con 0): las dos alcanzan a la sesión.
    and ('authenticated'::regrole = any (p.polroles) or 0 = any (p.polroles))
    -- Las dos del portal, por nombre exacto: un comodín dejaría pasar cualquiera.
    and p.polname not in ('quotes portal self read', 'conv_messages portal client read own')
    and coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '')
        || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') not like '%user_has_%module%';
  if v_abiertas is not null then
    raise exception '0540: quedan policies de authenticated sin módulo: %', v_abiertas;
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.user_has_any_module(text[],boolean)', 'EXECUTE') then
    raise exception '0540: anon no debe ejecutar user_has_any_module';
  end if;

  -- El conjunto EXACTO que queda, como el postflight de la 0511: las 29 nuevas
  -- (cuatro por tabla y una en chatwoot_conversations), las 6 de service_role y
  -- las 2 del portal, que no se tocan. Una de más, de menos o con otro comando o
  -- roles aborta.
  with nuevas(tablename) as (values
    ('rates'), ('quotes'), ('conversations'), ('conversation_messages'),
    ('purchase_orders'), ('purchase_order_items'), ('sales_orders')
  ), expected(tablename, policyname, cmd, roles) as (
    select n.tablename, n.tablename || '_' || o.op || '_por_modulo', o.cmd, array['authenticated']::name[]
      from nuevas n
      cross join (values ('select', 'SELECT'), ('insert', 'INSERT'), ('update', 'UPDATE'), ('delete', 'DELETE')) o(op, cmd)
    union all values
      ('chatwoot_conversations', 'chatwoot_conversations_select_por_modulo', 'SELECT', array['authenticated']::name[]),
      ('quotes',                 'quotes portal self read',                  'SELECT', array['authenticated']::name[]),
      ('conversation_messages',  'conv_messages portal client read own',     'SELECT', array['authenticated']::name[]),
      ('conversations',          'conversations service_role all',           'ALL',    array['service_role']::name[]),
      ('conversation_messages',  'conversation_messages service_role all',   'ALL',    array['service_role']::name[]),
      ('purchase_orders',        'purchase_orders service_role all',         'ALL',    array['service_role']::name[]),
      ('purchase_order_items',   'purchase_order_items service_role all',    'ALL',    array['service_role']::name[]),
      ('sales_orders',           'sales_orders service_role all',            'ALL',    array['service_role']::name[]),
      ('chatwoot_conversations', 'chatwoot_conversations_service_role_all',  'ALL',    array['service_role']::name[])
  ), actual as (
    select p.tablename::text as tablename, p.policyname::text as policyname, p.cmd, p.roles, p.permissive
      from pg_catalog.pg_policies p
     where p.schemaname = 'public'
       and p.tablename in ('rates', 'quotes', 'conversations', 'conversation_messages',
                           'purchase_orders', 'purchase_order_items', 'sales_orders', 'chatwoot_conversations')
  )
  select string_agg(coalesce(e.tablename, a.tablename) || '::' || coalesce(e.policyname, a.policyname), ', ')
    into v_abiertas
  from expected e full join actual a
    on a.tablename = e.tablename and a.policyname = e.policyname
  where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
     or a.roles <> e.roles or a.permissive <> 'PERMISSIVE';
  if v_abiertas is not null then
    raise exception '0540 postflight: las policies finales no son las esperadas: %', v_abiertas;
  end if;
end;
$post$;
