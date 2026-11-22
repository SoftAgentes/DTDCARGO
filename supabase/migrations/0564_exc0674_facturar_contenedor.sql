-- ─────────────────────────────────────────────────────────────────────────────
-- 0564 · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria EXC-0674).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN NI A NINGÚN OTRO ENTORNO. Va declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Para aplicarla en producción hace
--    falta el OK nominal de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Fusionar la PR NO autoriza aplicarla. Sin la 0564 la pantalla no cambia:
--    el botón no aparece (degradación declarada en pending-migration-symbol-declarations.json).
--
-- ── Por qué (decisiones de Sam del 2026-11-18, por el DG; spec docs/specs/0674-…) ─────────
-- Los contenedores montados sin pasar por origen (hoy solo el 64) se facturan desde Embarques.
-- La facturación es por cliente del contenedor, o de todo el contenedor a la vez. El monto lo
-- teclea la oficina como TOTAL CON IVA, en USD. Se crea la factura REAL ya EMITIDA, a nombre del
-- aliado raíz si el cliente tiene uno. La oprimen SOLO `accounting` y `admin`, que ya ven montos
-- (0414, frontera SDD-0357). Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.»
--
-- La regla tiene una excepción explícita, registrada en
-- docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md:
--   · AUT-04: estas facturas NO pasan por el gate legal de la app (LEGAL_GATE_HARD_BLOCK sigue
--     igual para todo lo demás). Cada una queda en exc0674_facturas con legal_ack = 'exc_0674',
--     el usuario que tecleó el monto y la hora.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. public.exc0674_contenedores (tenant, consolidación): la lista transitoria.
--    · La migración la deja VACÍA. El 64 se agrega aparte, con el OK de Sam, en un insert de una
--      fila que se ejecuta después de aplicarla (ver el runbook en el handoff de la SDD-0674).
--    · SELECT solo para authenticated de su tenant con rol accounting o admin.
--    · Sin escritura para authenticated. Solo la cambia una migración o una operación con
--      service_role y el OK nominal de Sam.
--    · Un trigger audita cada alta y baja (entity_audit_log, entidad consolidation) y EXIGE un
--      motivo en dtd.audit_reason: sin motivo, la operación falla.
-- 2. public.exc0674_facturas: una fila por cliente facturado del contenedor (es el rastro).
--    · Columnas: factura, total tecleado, quién lo tecleó, cuándo y a quién se facturó.
--    · Índice único PARCIAL (tenant, contenedor, cliente) donde anulada_at es null: no se factura dos
--      veces, pero después de anular la factura en Facturación se puede volver a facturar. Un trigger
--      AFTER UPDATE OF status en invoices marca anulada_at cuando la factura pasa a 'anulada'.
--    · SELECT: accounting y admin de su tenant. Sin escritura para authenticated.
-- 2b. public.exc0674_factura_envios: qué envíos cubre cada factura, con el Shipping Mark del cliente
--     real del contenedor (con aliado raíz, la factura lleva el del aliado). SELECT para accounting y
--     admin, y sin escritura
--     para authenticated.
-- 2c. public.exc0674_envios_cubiertos: vista security_invoker que une ese vínculo con la factura viva
--     y su estado. La lee «Embarques sin facturar» (SDD-0574). La RLS 0414 de invoices decide quién ve
--     filas: accounting y admin.
-- 3. public.exc0674_facturar(p_consolidation_id, p_montos jsonb, p_confirmacion text):
--    · SECURITY DEFINER con search_path vacío; EXECUTE solo para authenticated.
--    · Recibe p_montos = [{"client_markbox": "...", "total_usd": 123.45}, …]: un elemento en el
--      modo por cliente, todos los clientes en el modo contenedor completo.
--    · TODO O NADA, en una transacción, y por cada cliente:
--        - comprueba rol, tenant, contenedor en la lista, cliente con embarques vigentes en el
--          contenedor, total > 0 con 2 decimales y que el cliente no esté facturado ya;
--        - toma el lock de numeración del tenant (next_invoice_code calcula max+1 sin lock; lo
--          protege solo el unique de la 0077) y un lock por cliente, en orden de Shipping Mark;
--        - resuelve el aliado raíz (como la carga de consolidados, SDD-0543);
--        - base = round(total / (1 + iva/100), 2), iva = total − base, con la tasa del tenant
--          (16 % si tenants.iva_enabled, si no 0, igual que la carga);
--        - arma una línea por embarque, con el monto repartido por CBM;
--        - pide el correlativo next_invoice_code e inserta la factura en 'emitida';
--        - hace el asiento con post_invoice_journal_entry_atomic, que NO lanza: devuelve un
--          outcome; si no es 'posted' ni 'already_posted', no se factura nada;
--        - escribe el vínculo con cada envío, la fila de exc0674_facturas y el evento de
--          auditoría con legal_ack = exc_0674 (append_audit_event, en la misma transacción).
--    · p_confirmacion tiene que ser exactamente 'Confirmado': la segunda confirmación de la
--      pantalla también la exige la base.
--
-- ── Lo que se dispara al emitir (como cualquier factura emitida) ─────────────
-- Los triggers existentes de invoices: titular (0466), guarda i3 (0497), auditoría d2 (0290) y
-- crédito de referido en la primera factura (0197/0494). La factura se ve en el portal del cliente
-- (0452). El correo invoice_emitted lo dispara la app después, igual que emitInvoice.
--
-- ── Qué NO toca ─────────────────────────────────────────────
-- Ninguna fila existente. Ni la RLS de invoices (0407/0414), ni sus grants, ni
-- LEGAL_GATE_HARD_BLOCK, ni la carga de consolidados. Sobre invoices solo agrega el trigger
-- exc0674_marcar_anulada (AFTER UPDATE OF status), que escribe únicamente exc0674_facturas.
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo CREATE TABLE, CREATE FUNCTION, policies y grants nuevos. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0564_desarme.sql (sin número; usarlo exige el OK nominal de Sam). Si ya hay
-- facturas emitidas por esta regla, el desarme se niega: esas facturas se anulan por el camino
-- normal de Facturación.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ─── 0. Preflight ────────────────────────────────────────────
do $preflight$
declare
  v_missing text;
begin
  select pg_catalog.string_agg(required.object_name, ', ' order by required.object_name)
    into v_missing
  from (values
      ('table public.tenants',              pg_catalog.to_regclass('public.tenants') is not null),
      ('table public.invoices',             pg_catalog.to_regclass('public.invoices') is not null),
      ('table public.consolidations',       pg_catalog.to_regclass('public.consolidations') is not null),
      ('table public.consolidation_items',  pg_catalog.to_regclass('public.consolidation_items') is not null),
      ('table public.shipments',            pg_catalog.to_regclass('public.shipments') is not null),
      ('table public.clients',              pg_catalog.to_regclass('public.clients') is not null),
      ('table public.aliados',              pg_catalog.to_regclass('public.aliados') is not null),
      ('function public.get_user_tenant_id()', pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null),
      ('function public.current_studio_role()', pg_catalog.to_regprocedure('public.current_studio_role()') is not null),
      ('function public.next_invoice_code(uuid)', pg_catalog.to_regprocedure('public.next_invoice_code(uuid)') is not null),
      ('function public.post_invoice_journal_entry_atomic(uuid,uuid)',
        pg_catalog.to_regprocedure('public.post_invoice_journal_entry_atomic(uuid,uuid)') is not null),
      ('function public.append_audit_event(…)', pg_catalog.to_regprocedure(
        'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is not null)
  ) as required(object_name, present)
  where not required.present;
  if v_missing is not null then
    raise exception '0564 requiere objetos ausentes: %', v_missing;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tenants' and column_name = 'iva_enabled')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'aliados' and column_name = 'parent_aliado_id')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'clients' and column_name = 'aliado_id') then
    raise exception '0564 requiere tenants.iva_enabled, aliados.parent_aliado_id y clients.aliado_id';
  end if;
end
$preflight$;

-- ─── 1. La lista transitoria ─────────────────────────────────
create table if not exists public.exc0674_contenedores (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  nota             text,
  agregado_at      timestamptz not null default pg_catalog.now(),
  primary key (tenant_id, consolidation_id)
);
comment on table public.exc0674_contenedores is
  'SDD-0674 · EXC-0674: contenedores donde Embarques puede facturar (regla transitoria). Hoy solo el 64. Se escribe con service_role y el OK de Sam; nunca desde la app.';

alter table public.exc0674_contenedores enable row level security;
drop policy if exists exc0674_contenedores_select on public.exc0674_contenedores;
create policy exc0674_contenedores_select on public.exc0674_contenedores
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
revoke all on public.exc0674_contenedores from public, anon, authenticated;
grant select on public.exc0674_contenedores to authenticated;
grant all on public.exc0674_contenedores to service_role;

-- Cada alta o baja de la lista queda auditada, y sin motivo no se hace (AUD-01).
create or replace function public.exc0674_contenedores_auditar()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_motivo text := nullif(pg_catalog.btrim(pg_catalog.current_setting('dtd.audit_reason', true)), '');
  v_uid    uuid := (select auth.uid());
  v_fila   public.exc0674_contenedores%rowtype;
begin
  if tg_op = 'UPDATE' then
    raise exception 'exc0674:lista_inmutable' using errcode = '42501';
  end if;
  if v_motivo is null or pg_catalog.char_length(v_motivo) < 4 then
    raise exception 'exc0674:lista_sin_motivo' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then v_fila := old; else v_fila := new; end if;
  perform public.append_audit_event(
    v_fila.tenant_id, 'consolidation', v_fila.consolidation_id,
    case when v_uid is null then 'system' else 'user' end, v_uid,
    case when tg_op = 'INSERT' then 'exc0674_lista_alta' else 'exc0674_lista_baja' end,
    'rpc', 'succeeded', v_motivo, null,
    pg_catalog.jsonb_build_object('regla', 'EXC-0674', 'operacion', pg_catalog.lower(tg_op)),
    '{}'::jsonb, null, 1, 'internal');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.exc0674_contenedores_auditar() from public, anon, authenticated, service_role;
drop trigger if exists exc0674_contenedores_auditar on public.exc0674_contenedores;
create trigger exc0674_contenedores_auditar
  before insert or update or delete on public.exc0674_contenedores
  for each row execute function public.exc0674_contenedores_auditar();

-- ─── 2. El rastro de cada cliente facturado ──────────────────
create table if not exists public.exc0674_facturas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  consolidation_id uuid not null references public.consolidations(id) on delete restrict,
  client_markbox   text not null check (client_markbox = pg_catalog.upper(pg_catalog.btrim(client_markbox)) and client_markbox <> ''),
  invoice_id       uuid not null unique references public.invoices(id) on delete restrict,
  invoice_code     text not null,
  billed_markbox   text not null,
  total_usd        numeric(14,2) not null check (total_usd > 0),
  tecleado_por     uuid not null,
  confirmado_at    timestamptz not null default pg_catalog.now(),
  legal_ack        text not null default 'exc_0674' check (legal_ack = 'exc_0674'),
  anulada_at       timestamptz
);
-- Una factura viva de esta regla por cliente del contenedor. La anulada no cuenta: se puede volver a
-- facturar.
create unique index if not exists exc0674_facturas_un_cliente_vivo
  on public.exc0674_facturas (tenant_id, consolidation_id, client_markbox)
  where anulada_at is null;
comment on table public.exc0674_facturas is
  'SDD-0674 · EXC-0674: una fila por cliente del contenedor facturado desde Embarques. Rastro del monto tecleado (total con IVA, USD), de quién lo tecleó y de la excepción al gate AUT-04 (legal_ack = exc_0674). Solo la escribe exc0674_facturar().';

alter table public.exc0674_facturas enable row level security;
drop policy if exists exc0674_facturas_select on public.exc0674_facturas;
create policy exc0674_facturas_select on public.exc0674_facturas
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
revoke all on public.exc0674_facturas from public, anon, authenticated;
grant select on public.exc0674_facturas to authenticated;
grant all on public.exc0674_facturas to service_role;

-- Al anular en Facturación una factura de esta regla, su marca deja de contar y el cliente se puede
-- volver a facturar (índice parcial). No toca la factura ni su reverso contable (0497).
create or replace function public.exc0674_marcar_anulada()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  update public.exc0674_facturas f
     set anulada_at = pg_catalog.now()
   where f.invoice_id = new.id and f.tenant_id = new.tenant_id and f.anulada_at is null;
  return null;
end;
$function$;
revoke all on function public.exc0674_marcar_anulada() from public, anon, authenticated, service_role;
drop trigger if exists exc0674_marcar_anulada on public.invoices;
create trigger exc0674_marcar_anulada
  after update of status on public.invoices
  for each row
  when (new.status::text = 'anulada' and old.status::text is distinct from 'anulada')
  execute function public.exc0674_marcar_anulada();

-- ─── 2b. Qué envíos cubre cada factura ───────────────────────
create table if not exists public.exc0674_factura_envios (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  invoice_id       uuid not null references public.invoices(id) on delete restrict,
  shipment_id      uuid not null references public.shipments(id) on delete restrict,
  consolidation_id uuid not null references public.consolidations(id) on delete restrict,
  client_markbox   text not null check (client_markbox = pg_catalog.upper(pg_catalog.btrim(client_markbox)) and client_markbox <> ''),
  primary key (invoice_id, shipment_id)
);
create index if not exists exc0674_factura_envios_envio_idx
  on public.exc0674_factura_envios (tenant_id, shipment_id);
comment on table public.exc0674_factura_envios is
  'SDD-0674 · EXC-0674: cada envío que cubre una factura de esta regla, con el Shipping Mark del cliente real del contenedor. «Embarques sin facturar» (0574) lo lee por la vista exc0674_envios_cubiertos. Solo la escribe exc0674_facturar().';

alter table public.exc0674_factura_envios enable row level security;
drop policy if exists exc0674_factura_envios_select on public.exc0674_factura_envios;
create policy exc0674_factura_envios_select on public.exc0674_factura_envios
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
revoke all on public.exc0674_factura_envios from public, anon, authenticated;
grant select on public.exc0674_factura_envios to authenticated;
grant all on public.exc0674_factura_envios to service_role;

-- ─── 2c. La vista para la 0574 ───────────────────────────────
create or replace view public.exc0674_envios_cubiertos
  with (security_invoker = true)
as
select l.tenant_id, l.shipment_id, l.client_markbox, l.invoice_id, i.invoice_code, i.status::text as status
  from public.exc0674_factura_envios l
  join public.invoices i on i.id = l.invoice_id and i.tenant_id = l.tenant_id
 where i.deleted_at is null;
comment on view public.exc0674_envios_cubiertos is
  'SDD-0674 · EXC-0674: envíos cubiertos por una factura viva de esta regla, con el Shipping Mark del cliente real y el estado de la factura. security_invoker: la RLS de invoices (0414) decide quién ve filas.';
revoke all on public.exc0674_envios_cubiertos from public, anon, authenticated;
grant select on public.exc0674_envios_cubiertos to authenticated;
grant select on public.exc0674_envios_cubiertos to service_role;

-- ─── 3. La RPC ───────────────────────────────────────────────
create or replace function public.exc0674_facturar(
  p_consolidation_id uuid,
  p_montos jsonb,
  p_confirmacion text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid       uuid := (select auth.uid());
  v_tenant    uuid := public.get_user_tenant_id();
  v_role      text := public.current_studio_role();
  v_ref       text;
  v_iva_on    boolean;
  v_iva_rate  numeric;
  v_hoy       date := (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
  v_item      jsonb;
  v_mb        text;
  v_total     numeric;
  v_base      numeric;
  v_iva       numeric;
  v_n_env     integer;
  v_cbm_total numeric;
  v_lines     jsonb;
  v_first_id  uuid;
  v_first_cd  text;
  v_codes     text;
  v_client    uuid;
  v_aliado    uuid;
  v_padre     uuid;
  v_root      uuid;
  v_fact      public.clients%rowtype;
  v_code      text;
  v_inv       uuid;
  v_nombre    text;
  v_titular   text;
  v_post      jsonb;
  v_outcome   text;
  v_vistos    text[] := array[]::text[];
  v_n_fichas  integer;
  v_cadena    uuid[];
  v_salida    jsonb := '[]'::jsonb;
begin
  if v_uid is null or v_tenant is null then
    raise exception 'exc0674:sin_sesion' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('accounting', 'admin') then
    raise exception 'exc0674:rol' using errcode = '42501';
  end if;
  if p_confirmacion is distinct from 'Confirmado' then
    raise exception 'exc0674:sin_confirmacion' using errcode = '22023';
  end if;
  if p_consolidation_id is null or p_montos is null or pg_catalog.jsonb_typeof(p_montos) <> 'array'
     or pg_catalog.jsonb_array_length(p_montos) = 0 or pg_catalog.jsonb_array_length(p_montos) > 500 then
    raise exception 'exc0674:datos' using errcode = '22023';
  end if;

  -- El contenedor: vivo, del tenant y en la lista transitoria.
  select c.ref into v_ref
    from public.consolidations c
    join public.exc0674_contenedores l
      on l.consolidation_id = c.id and l.tenant_id = c.tenant_id
   where c.id = p_consolidation_id and c.tenant_id = v_tenant and c.deleted_at is null;
  if v_ref is null then
    raise exception 'exc0674:contenedor_fuera_de_lista' using errcode = '42501';
  end if;

  select coalesce(t.iva_enabled, false) into v_iva_on from public.tenants t where t.id = v_tenant;
  v_iva_rate := case when v_iva_on then 16 else 0 end;

  -- next_invoice_code (0077) calcula max+1 sin lock: dos llamadas simultáneas del mismo tenant
  -- pedirían el mismo número. Esta regla factura en fila por tenant. Contra un createInvoice del
  -- Studio que corra a la vez manda el unique (tenant_id, invoice_code) y se deshace todo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('exc0674:numeracion:' || v_tenant::text, 0));

  -- Los clientes se procesan (y se bloquean) en orden de Shipping Mark.
  for v_item in
    select e.value
      from pg_catalog.jsonb_array_elements(p_montos) as e
     order by pg_catalog.upper(pg_catalog.btrim(e.value ->> 'client_markbox')) nulls first
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or pg_catalog.jsonb_typeof(v_item -> 'client_markbox') <> 'string'
       or pg_catalog.jsonb_typeof(v_item -> 'total_usd') <> 'number' then
      raise exception 'exc0674:datos' using errcode = '22023';
    end if;
    v_mb := pg_catalog.upper(pg_catalog.btrim(v_item ->> 'client_markbox'));
    v_total := (v_item ->> 'total_usd')::numeric;
    if v_mb = '' or v_mb = any (v_vistos) then
      raise exception 'exc0674:datos' using errcode = '22023';
    end if;
    v_vistos := v_vistos || v_mb;
    if v_total is null or v_total <= 0 or v_total <> pg_catalog.round(v_total, 2)
       or v_total >= 1000000000000 then
      raise exception 'exc0674:monto:%', v_mb using errcode = '22023';
    end if;

    -- Un cliente se factura una vez por contenedor (además de la llave única).
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('exc0674:' || v_tenant::text || ':' || p_consolidation_id::text || ':' || v_mb, 0));
    if exists (select 1 from public.exc0674_facturas f
                where f.tenant_id = v_tenant and f.consolidation_id = p_consolidation_id
                  and f.client_markbox = v_mb and f.anulada_at is null) then
      raise exception 'exc0674:ya_facturado:%', v_mb using errcode = '23505';
    end if;

    -- Embarques vigentes del cliente en el contenedor: la asignación más reciente de cada
    -- embarque es este contenedor (la misma regla que Embarques, SDD-0643).
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    ), envios as (
      select s.id, s.code, coalesce(s.volume_m3, 0)::numeric as cbm
        from vigente v
        join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       where v.consolidation_id = p_consolidation_id
         and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb
    )
    select pg_catalog.count(*)::integer, coalesce(pg_catalog.sum(e.cbm), 0)
      into v_n_env, v_cbm_total
      from envios e;
    if v_n_env = 0 then
      raise exception 'exc0674:cliente_sin_embarques:%', v_mb using errcode = '22023';
    end if;

    -- A quién se factura: al cliente o, si es de un aliado, al aliado raíz (SDD-0543).
    -- Si dos fichas vivas comparten el Shipping Mark normalizado, no se adivina: error explícito.
    select pg_catalog.count(*)::integer into v_n_fichas
      from public.clients c
     where c.tenant_id = v_tenant and pg_catalog.upper(pg_catalog.btrim(c.markbox)) = v_mb
       and c.deleted_at is null;
    if v_n_fichas > 1 then
      raise exception 'exc0674:cliente_ambiguo:%', v_mb using errcode = '22023';
    end if;
    v_client := null;
    v_aliado := null;
    select c.id, c.aliado_id into v_client, v_aliado
      from public.clients c
     where c.tenant_id = v_tenant and pg_catalog.upper(pg_catalog.btrim(c.markbox)) = v_mb
       and c.deleted_at is null;
    if v_client is null then
      raise exception 'exc0674:cliente_inexistente:%', v_mb using errcode = '22023';
    end if;
    v_root := v_client;
    if v_aliado is not null then
      -- Guarda contra ciclos en la cadena de aliados: un aliado repetido (o más de 32 saltos) aborta.
      v_cadena := array[v_aliado];
      loop
        v_padre := null;
        select a.parent_aliado_id, a.client_id into v_padre, v_root
          from public.aliados a where a.id = v_aliado and a.tenant_id = v_tenant;
        exit when v_padre is null;
        if v_padre = any(v_cadena) or pg_catalog.cardinality(v_cadena) >= 32 then
          raise exception 'exc0674:aliado_ciclo:%', v_mb using errcode = '22023';
        end if;
        v_cadena := v_cadena || v_padre;
        v_aliado := v_padre;
      end loop;
      if v_root is null then v_root := v_client; end if;
    end if;
    select * into v_fact from public.clients c
     where c.id = v_root and c.tenant_id = v_tenant and c.deleted_at is null;
    if not found or v_fact.markbox is null then
      raise exception 'exc0674:titular_inexistente:%', v_mb using errcode = '22023';
    end if;

    -- El total tecleado incluye el IVA.
    v_base := pg_catalog.round(v_total / (1 + v_iva_rate / 100), 2);
    v_iva := v_total - v_base;

    -- Una línea por embarque. El monto se reparte por CBM (en partes iguales si ninguno tiene
    -- CBM) y la última línea absorbe el redondeo, así que la suma da exactamente la base.
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    ), envios as (
      select s.id, s.code, coalesce(s.volume_m3, 0)::numeric as cbm,
             pg_catalog.row_number() over (order by s.code, s.id) as n
        from vigente v
        join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       where v.consolidation_id = p_consolidation_id
         and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb
    ), reparto as (
      select e.*,
             pg_catalog.round(v_base * case when v_cbm_total > 0 then e.cbm / v_cbm_total
                                            else 1::numeric / v_n_env end, 2) as parte
        from envios e
    ), ajustado as (
      select r.*,
             case when r.n = v_n_env
                  then v_base - coalesce((select pg_catalog.sum(x.parte) from reparto x where x.n < v_n_env), 0)
                  else r.parte end as precio
        from reparto r
    )
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'desc', 'Flete DDP · ' || a.code || ' · ' || pg_catalog.round(a.cbm, 3)::text || ' m³ · contenedor ' || v_ref,
             'qty', 1, 'unitPrice', a.precio, 'shipmentCode', a.code) order by a.n),
           (pg_catalog.array_agg(a.id order by a.n))[1],
           (pg_catalog.array_agg(a.code order by a.n))[1],
           pg_catalog.string_agg(a.code, ', ' order by a.n)
      into v_lines, v_first_id, v_first_cd, v_codes
      from ajustado a;

    v_code := public.next_invoice_code(v_tenant);
    insert into public.invoices
      (tenant_id, invoice_code, client_markbox, client_name, client_rif, client_doc_kind,
       shipment_id, shipment_code, currency, iva_rate, base_amount, iva_amount, total_amount,
       status, issued_at, due_date, lines, notes, fund_class)
    values
      (v_tenant, v_code, v_fact.markbox, v_fact.name, v_fact.rif, v_fact.doc_kind,
       v_first_id, v_first_cd, 'USD', v_iva_rate, v_base, v_iva, v_total,
       'emitida', v_hoy, v_hoy + 30, v_lines,
       'EXC-0674 · contenedor ' || v_ref || ' · cliente ' || v_mb || ' · embarques: ' || v_codes
         || case when v_root <> v_client then ' · facturado al aliado raíz' else '' end,
       'third_party')
    returning id, client_name, client_markbox into v_inv, v_nombre, v_titular;

    -- El asiento va en la misma transacción: si no sale, no se factura nada.
    -- post_invoice_journal_entry_atomic NO lanza: devuelve outcome posted | already_posted |
    -- not_posted (0497). Cualquier otra cosa deshace todo.
    v_post := public.post_invoice_journal_entry_atomic(v_tenant, v_inv);
    v_outcome := coalesce(v_post ->> 'outcome', '');
    if v_outcome not in ('posted', 'already_posted') then
      raise exception 'exc0674:asiento:%', coalesce(v_post ->> 'reason', 'desconocido') using errcode = '55000';
    end if;

    -- Qué envíos cubre la factura (para «Embarques sin facturar», SDD-0574).
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    )
    insert into public.exc0674_factura_envios (tenant_id, invoice_id, shipment_id, consolidation_id, client_markbox)
    select v_tenant, v_inv, s.id, p_consolidation_id, v_mb
      from vigente v
      join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
     where v.consolidation_id = p_consolidation_id
       and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb;

    insert into public.exc0674_facturas
      (tenant_id, consolidation_id, client_markbox, invoice_id, invoice_code, billed_markbox,
       total_usd, tecleado_por)
    values
      (v_tenant, p_consolidation_id, v_mb, v_inv, v_code, v_titular, v_total, v_uid);

    -- AUD-01: el evento y la mutación son una sola operación. legal_ack = exc_0674 dice que esta
    -- factura salió sin el gate AUT-04, por la excepción de Sam.
    perform public.append_audit_event(
      v_tenant, 'invoice', v_inv, 'user', v_uid, 'invoice_emitted_exc0674', 'rpc', 'succeeded',
      'EXC-0674: factura emitida desde Embarques sin el gate AUT-04 (excepción de Sam, 2026-11-18)',
      null,
      pg_catalog.jsonb_build_object(
        'invoice_code', v_code, 'status', 'emitida', 'currency', 'USD', 'total_amount', v_total,
        'base_amount', v_base, 'iva_amount', v_iva, 'billed_markbox', v_titular,
        'client_markbox', v_mb, 'consolidation_id', p_consolidation_id, 'consolidation_ref', v_ref,
        'legal_ack', 'exc_0674', 'tecleado_por', v_uid, 'asiento', v_outcome),
      pg_catalog.jsonb_build_object('regla', 'EXC-0674', 'sdd', '0674'),
      null, 1, 'internal');

    v_salida := v_salida || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'client_markbox', v_mb, 'invoice_id', v_inv, 'invoice_code', v_code,
      'billed_markbox', v_titular, 'billed_name', v_nombre, 'shipment_code', v_first_cd,
      'issued_at', v_hoy, 'due_date', v_hoy + 30, 'total_usd', v_total));
  end loop;

  return pg_catalog.jsonb_build_object('version', 1, 'facturas', v_salida);
end;
$function$;

comment on function public.exc0674_facturar(uuid, jsonb, text) is
  'SDD-0674 · EXC-0674: factura por cliente un contenedor de la lista transitoria (exc0674_contenedores). Todo o nada: crea la factura emitida en USD (el total tecleado lleva el IVA; se factura al aliado raíz si lo hay), su asiento y el rastro en exc0674_facturas. Roles accounting y admin del tenant de la sesión (Sam, 2026-11-18: operaciones no factura). No pasa por el gate legal AUT-04 de la app (excepción explícita, legal_ack = exc_0674).';

revoke all on function public.exc0674_facturar(uuid, jsonb, text) from public, anon, service_role;
grant execute on function public.exc0674_facturar(uuid, jsonb, text) to authenticated;

-- ─── 4. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_rol text;
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.exc0674_facturar(uuid,jsonb,text)')
       and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0564 postflight: exc0674_facturar sin search_path vacío o sin SECURITY DEFINER';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_function_privilege(v_rol, 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
       <> (v_rol = 'authenticated') then
      raise exception '0564 postflight: EXECUTE de % sobre exc0674_facturar no es el esperado', v_rol;
    end if;
  end loop;
  foreach v_rol in array array['anon', 'authenticated'] loop
    if pg_catalog.has_table_privilege(v_rol, 'public.exc0674_contenedores', 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_table_privilege(v_rol, 'public.exc0674_facturas', 'INSERT,UPDATE,DELETE') then
      raise exception '0564 postflight: % puede escribir las tablas de la EXC-0674', v_rol;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('anon', 'public.exc0674_facturas', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.exc0674_contenedores', 'SELECT') then
    raise exception '0564 postflight: anon puede leer las tablas de la EXC-0674';
  end if;
  if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.exc0674_facturas'::pg_catalog.regclass)
     or not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.exc0674_contenedores'::pg_catalog.regclass)
     or not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.exc0674_factura_envios'::pg_catalog.regclass) then
    raise exception '0564 postflight: RLS apagada en las tablas de la EXC-0674';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.exc0674_factura_envios', 'INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('anon', 'public.exc0674_factura_envios', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.exc0674_envios_cubiertos', 'SELECT') then
    raise exception '0564 postflight: privilegios del vínculo o de la vista no son los esperados';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
     where c.oid = 'public.exc0674_envios_cubiertos'::pg_catalog.regclass
       and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception '0564 postflight: la vista exc0674_envios_cubiertos no es security_invoker';
  end if;
  if exists (select 1 from pg_catalog.pg_policies
              where schemaname = 'public'
                and tablename in ('exc0674_contenedores', 'exc0674_facturas', 'exc0674_factura_envios')
                and cmd <> 'SELECT') then
    raise exception '0564 postflight: hay policies de escritura en las tablas de la EXC-0674';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgrelid = 'public.exc0674_contenedores'::pg_catalog.regclass
                    and tgname = 'exc0674_contenedores_auditar' and not tgisinternal) then
    raise exception '0564 postflight: falta el trigger que audita la lista';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgrelid = 'public.invoices'::pg_catalog.regclass
                    and tgname = 'exc0674_marcar_anulada' and not tgisinternal) then
    raise exception '0564 postflight: falta el trigger que marca la factura anulada';
  end if;
  if not exists (select 1 from pg_catalog.pg_indexes
                  where schemaname = 'public' and indexname = 'exc0674_facturas_un_cliente_vivo'
                    and indexdef like '%UNIQUE%' and indexdef like '%anulada_at IS NULL%') then
    raise exception '0564 postflight: falta el índice único parcial del rastro';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
