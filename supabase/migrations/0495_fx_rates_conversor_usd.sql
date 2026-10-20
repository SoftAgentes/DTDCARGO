-- ─────────────────────────────────────────────────────────────
-- SDD-0569 · Un solo conversor a USD, que falla cerrado, y una tabla de tasas
--            con fuente y fecha (2.1 del plan contable, primera parte)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0569. Es aditiva: la app desplegada
--    no la nota (no lee fx_rates ni las columnas nuevas).
--
-- Decisión 1 de Sam (2026-10-19): el mayor va en USD, con USDT = USD 1:1; los
-- bolívares solo en reportes; sin impuestos. El Director (2026-10-20): VES y
-- CNY siempre con tasa, fallando cerrado, con el modelo de amountToUsd de
-- Financiero China y RMB normalizado a CNY. Esta migración NO cambia ninguna
-- cifra de reportes: eso es la SDD siguiente (los 13 reemplazos).
--
--   1. fx_rates: la tasa por moneda y día de Caracas, con fuente (bcv, manual u
--      operacion), quién y nota. Lectura por tenant; escritura solo por la RPC
--      (admin o accounting) o service_role (la futura carga del BCV).
--   2. fx_normalizar_moneda y to_usd: IMMUTABLE, con la tasa como parámetro.
--      USD y USDT 1:1; VES y CNY divididos por la tasa; sin una tasa finita y
--      mayor que 0, o con una moneda desconocida, FALLA CERRADO.
--   3. fx_rate_on: STABLE, lee fx_rates; la tasa vigente a un día, con su
--      fuente y su fecha (bcv > manual > operacion); sin tasa, falla cerrado.
--   4. registrar_tasa_de_cambio: la RPC de Admin › Tasas. Una segunda tasa
--      manual del mismo día reemplaza a la primera y queda en la auditoría D2
--      con el valor anterior.
--   5. invoices y supplier_bills guardan la fuente y la fecha de la tasa que se
--      usó: una corrección posterior de fx_rates no cambia un documento emitido.
--
-- tenant_fx_history: el Director midió 0 filas en producción el 2026-10-20 (solo
-- un conteo). No hay backfill; el preflight aborta si tiene filas, para que
-- nadie las pierda en silencio. Desde la PR, ni Admin ni gastos la escriben;
-- queda para retirarla en otra SDD.
--
-- MIGRATE-FIRST: se aplica antes de fusionar, con la previa de solo lectura,
-- el OK nominal de Sam y docs/runbooks/aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

-- Locks: tabla y funciones nuevas; dos columnas nullable sin default en
-- invoices y en supplier_bills (sin reescritura, ACCESS EXCLUSIVE breve).
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_writer regprocedure := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  v_filas bigint;
begin
  if pg_catalog.to_regclass('public.fx_rates') is not null
     or pg_catalog.to_regprocedure('public.to_usd(numeric,text,numeric)') is not null then
    raise exception '0495 abortado: la tabla de tasas ya existe';
  end if;
  if pg_catalog.to_regclass('public.tenant_fx_history') is null then
    raise exception '0495 requiere tenant_fx_history (0074)';
  end if;
  execute 'select pg_catalog.count(*) from public.tenant_fx_history' into v_filas;
  if v_filas <> 0 then
    raise exception '0495 abortado: tenant_fx_history tiene % fila(s); el Director midió 0 el 2026-10-20 y no hay backfill. Revisar antes de aplicar', v_filas;
  end if;
  if pg_catalog.to_regclass('public.invoices') is null or pg_catalog.to_regclass('public.supplier_bills') is null
     or pg_catalog.to_regclass('public.user_tenants') is null or pg_catalog.to_regclass('public.audit_entity_types') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0495 requiere invoices, supplier_bills, user_tenants, audit_entity_types, get_user_tenant_id() y auth.uid()';
  end if;
  if v_writer is null or not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']) then
    raise exception '0495 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not exists (select 1 from public.audit_entity_types where entity_type = 'exchange_rate') then
    raise exception '0495 requiere el tipo de entidad exchange_rate (0293)';
  end if;
end;
$preflight$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. La tabla de tasas                                      ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.fx_rates (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- RMB se guarda como CNY (fx_normalizar_moneda).
  currency  text not null check (currency in ('VES', 'CNY')),
  -- Unidades de esa moneda por 1 USD.
  rate      numeric(20,8) not null check (rate > 0 and rate < 1000000000000),
  -- La fecha de valor: el día de Caracas.
  valid_on  date not null,
  source    text not null check (source in ('bcv', 'manual', 'operacion')),
  set_by    uuid references auth.users(id) on delete set null,
  set_at    timestamptz not null default pg_catalog.now(),
  note      text check (note is null or pg_catalog.char_length(note) <= 500),
  unique (tenant_id, currency, valid_on, source)
);

comment on table public.fx_rates is
  'SDD-0569: tasas de cambio por tenant, moneda y día de Caracas, con fuente (bcv, manual u operacion) y quién. rate = unidades de la moneda por 1 USD. Lectura por tenant; escritura por registrar_tasa_de_cambio (admin o accounting) o service_role.';

create index fx_rates_vigente_idx on public.fx_rates (tenant_id, currency, valid_on desc);

alter table public.fx_rates enable row level security;
create policy "fx_rates select by tenant" on public.fx_rates
  for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "fx_rates service_role all" on public.fx_rates
  for all to service_role using (true) with check (true);
revoke all on public.fx_rates from public, anon, authenticated;
grant select on public.fx_rates to authenticated;
grant all on public.fx_rates to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. El conversor: IMMUTABLE, la tasa como parámetro        ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.fx_normalizar_moneda(p_currency text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case pg_catalog.upper(pg_catalog.btrim(p_currency)) when 'RMB' then 'CNY'
    else pg_catalog.upper(pg_catalog.btrim(p_currency)) end
$function$;

comment on function public.fx_normalizar_moneda(text) is
  'SDD-0569: el código de moneda en mayúsculas, con RMB (Financiero China) como CNY.';

-- USD y USDT 1:1. VES y CNY divididos por la tasa. FALLA CERRADO: nunca 0 ni
-- el monto tal cual. Postgres ordena NaN por encima de todo número, así que el
-- tope deja afuera a NaN y a Infinity, igual que en la 0493.
create function public.to_usd(p_amount numeric, p_currency text, p_rate numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_moneda text := public.fx_normalizar_moneda(p_currency);
begin
  if p_amount is null then
    return null;
  end if;
  if p_amount > 1000000000000 or p_amount < -1000000000000 then
    raise exception 'FX_AMOUNT_INVALID' using errcode = '22023', hint = 'dtd-fx';
  end if;
  if v_moneda in ('USD', 'USDT') then
    return pg_catalog.round(p_amount, 2);
  end if;
  if v_moneda in ('VES', 'CNY') then
    if p_rate is null or p_rate <= 0 or p_rate >= 1000000000000 then
      raise exception 'FX_RATE_MISSING' using errcode = '22023', hint = 'dtd-fx';
    end if;
    return pg_catalog.round(p_amount / p_rate, 2);
  end if;
  raise exception 'FX_CURRENCY_UNKNOWN' using errcode = '22023', hint = 'dtd-fx';
end;
$function$;

comment on function public.to_usd(numeric, text, numeric) is
  'SDD-0569: el conversor canónico a USD. USD y USDT 1:1 (decisión 1 de Sam); VES y CNY (RMB) divididos por la tasa. Sin tasa finita y mayor que 0, o con moneda desconocida, lanza FX_RATE_MISSING o FX_CURRENCY_UNKNOWN (22023, hint dtd-fx): nunca 0 ni el monto tal cual. IMMUTABLE: recibe la tasa ya resuelta.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. La tasa vigente: STABLE, lee fx_rates                  ║
-- ╚═══════════════════════════════════════════════════════════╝

-- La de la fecha más reciente <= p_on; ese día, bcv > manual > operacion.
-- INVOKER: la RLS de fx_rates limita a la sesión a su tenant.
create function public.fx_rate_on(p_tenant_id uuid, p_currency text, p_on date)
returns table (rate numeric, source text, valid_on date)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_moneda text := public.fx_normalizar_moneda(p_currency);
begin
  return query
    select f.rate, f.source, f.valid_on
    from public.fx_rates f
    where f.tenant_id = p_tenant_id and f.currency = v_moneda and f.valid_on <= p_on
    order by f.valid_on desc,
      case f.source when 'bcv' then 0 when 'manual' then 1 else 2 end
    limit 1;
  if not found then
    raise exception 'FX_RATE_MISSING' using errcode = '22023', hint = 'dtd-fx';
  end if;
end;
$function$;

comment on function public.fx_rate_on(uuid, text, date) is
  'SDD-0569: la tasa vigente al día p_on (la fecha más reciente <= p_on; ese día, bcv > manual > operacion), con su fuente y su fecha de valor. Sin tasa, lanza FX_RATE_MISSING (22023, hint dtd-fx). STABLE e INVOKER: la RLS de fx_rates limita al tenant de la sesión.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Admin › Tasas: registrar una tasa manual               ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.registrar_tasa_de_cambio(p_currency text, p_rate numeric, p_valid_on date, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_moneda text := public.fx_normalizar_moneda(p_currency);
  v_hoy    date := (pg_catalog.now() at time zone 'America/Caracas')::date;
  v_id     uuid;
begin
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) in ('admin', 'accounting')
  ) then
    raise exception 'Solo admin o contabilidad registran una tasa de cambio.' using errcode = '42501', hint = 'dtd-fx';
  end if;
  if v_moneda not in ('VES', 'CNY') then
    raise exception 'La tasa se registra para bolívares (VES) o yuanes (CNY).' using errcode = '22023', hint = 'dtd-fx';
  end if;
  if p_rate is null or p_rate <= 0 or p_rate >= 1000000000000 then
    raise exception 'La tasa tiene que ser un número mayor que 0.' using errcode = '22023', hint = 'dtd-fx';
  end if;
  if p_valid_on is null or p_valid_on > v_hoy then
    raise exception 'La fecha de la tasa no puede ser posterior a hoy.' using errcode = '22023', hint = 'dtd-fx';
  end if;

  insert into public.fx_rates (tenant_id, currency, rate, valid_on, source, set_by, note)
  values (v_tenant, v_moneda, p_rate, p_valid_on, 'manual', (select auth.uid()),
          nullif(pg_catalog.btrim(p_note), ''))
  on conflict (tenant_id, currency, valid_on, source) do update
    set rate = excluded.rate, set_by = excluded.set_by, set_at = pg_catalog.now(), note = excluded.note
  returning id into v_id;

  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'currency', v_moneda, 'valid_on', p_valid_on);
end;
$function$;

comment on function public.registrar_tasa_de_cambio(text, numeric, date, text) is
  'SDD-0569: registra la tasa manual de un día (admin o accounting). Una segunda del mismo día y moneda la reemplaza; la auditoría D2 guarda el valor anterior.';
revoke all on function public.registrar_tasa_de_cambio(text, numeric, date, text) from public, anon, service_role;
grant execute on function public.registrar_tasa_de_cambio(text, numeric, date, text) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. La auditoría D2 de fx_rates                            ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Como 0491: la escritura y su evento en la misma transacción. Guarda la tasa
-- antes y después (no es un dato personal).
create function public.audit_fx_rate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else pg_catalog.to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor_id uuid := (select auth.uid());
  v_campos text[] := array['currency', 'rate', 'valid_on', 'source'];
  v_before jsonb;
  v_after jsonb;
  v_event_type text;
  v_reason text;
begin
  v_before := case when v_old is null then null else pg_catalog.jsonb_build_object(
    'currency', v_old->'currency', 'rate', v_old->'rate', 'valid_on', v_old->'valid_on', 'source', v_old->'source') end;
  v_after := case when v_new is null then null else pg_catalog.jsonb_build_object(
    'currency', v_new->'currency', 'rate', v_new->'rate', 'valid_on', v_new->'valid_on', 'source', v_new->'source') end;
  if tg_op = 'UPDATE' and v_before is not distinct from v_after then
    return new;
  end if;
  v_event_type := case tg_op when 'INSERT' then 'exchange_rate_recorded'
    when 'UPDATE' then 'exchange_rate_corrected' else 'exchange_rate_deleted' end;
  v_reason := case tg_op when 'UPDATE' then 'Tasa del mismo día y fuente reemplazada.' end;

  perform public.append_audit_event(
    (v_row->>'tenant_id')::uuid, 'exchange_rate', (v_row->>'id')::uuid,
    case when v_actor_id is null then 'system' else 'user' end, v_actor_id,
    v_event_type, 'rpc', 'succeeded', v_reason, v_before, v_after,
    pg_catalog.jsonb_build_object('fields', pg_catalog.to_jsonb(v_campos)),
    pg_catalog.concat('fx-rate:', v_row->>'id', ':', pg_catalog.txid_current()::text, ':', tg_op),
    1, 'restricted');
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.audit_fx_rate_change() owner to postgres;
revoke all on function public.audit_fx_rate_change() from public, anon, authenticated, service_role;
comment on function public.audit_fx_rate_change() is
  'SDD-0569 · AUD-01: evento exchange_rate_* con la tasa antes y después, en la misma transacción que la escritura de fx_rates.';

create trigger audit_fx_rates
  after insert or update or delete on public.fx_rates
  for each row execute function public.audit_fx_rate_change();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. El documento guarda la fuente y la fecha de su tasa    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- La decisión 1 congela «la tasa BCV del día de emisión»: el documento guarda
-- la tasa que usó (fx_rate, ya existía), su fuente y su fecha de valor. Una
-- corrección posterior de fx_rates no lo cambia. Null en USD y USDT, y en los
-- documentos anteriores a la 0495.
alter table public.invoices
  add column fx_rate_source   text check (fx_rate_source is null or fx_rate_source in ('bcv', 'manual', 'operacion')),
  add column fx_rate_valid_on date;
alter table public.supplier_bills
  add column fx_rate_source   text check (fx_rate_source is null or fx_rate_source in ('bcv', 'manual', 'operacion')),
  add column fx_rate_valid_on date;

comment on column public.invoices.fx_rate_source is
  'SDD-0569: de dónde salió la fx_rate de la factura (bcv, manual u operacion). Manual cuando la escribió quien factura.';
comment on column public.invoices.fx_rate_valid_on is
  'SDD-0569: la fecha de valor de la fx_rate de la factura (día de Caracas).';
comment on column public.supplier_bills.fx_rate_source is
  'SDD-0569: de dónde salió la fx_rate de la CxP (bcv, manual u operacion).';
comment on column public.supplier_bills.fx_rate_valid_on is
  'SDD-0569: la fecha de valor de la fx_rate de la CxP (día de Caracas).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Postflight                                             ║
-- ╚═══════════════════════════════════════════════════════════╝

do $postflight$
begin
  if (select p.provolatile from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.to_usd(numeric,text,numeric)')) <> 'i'
     or (select p.provolatile from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.fx_rate_on(uuid,text,date)')) <> 's' then
    raise exception '0495: postflight — to_usd tiene que ser IMMUTABLE y fx_rate_on STABLE';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.fx_rates', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.fx_rates', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.fx_rates', 'DELETE')
     or not pg_catalog.has_table_privilege('authenticated', 'public.fx_rates', 'SELECT') then
    raise exception '0495: postflight — authenticated solo lee fx_rates';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.registrar_tasa_de_cambio(text,numeric,date,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.registrar_tasa_de_cambio(text,numeric,date,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.registrar_tasa_de_cambio(text,numeric,date,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.audit_fx_rate_change()', 'EXECUTE') then
    raise exception '0495: postflight — la ACL de la RPC o de la auditoría no es la esperada';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.fx_rates'::regclass and tgname = 'audit_fx_rates' and not tgisinternal and tgenabled = 'O') then
    raise exception '0495: postflight — falta el disparador audit_fx_rates';
  end if;
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
