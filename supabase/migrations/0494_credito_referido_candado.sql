-- ─────────────────────────────────────────────────────────────
-- SDD-0567 · El crédito de referido no nace sin venta ni se aplica dos veces
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0567. Aplicada sola, la app
--    desplegada pierde el UPDATE directo de referrals: acreditar y avanzar a mano
--    dejan de funcionar hasta que entra la PR, que usa las RPC nuevas. Aplicar y
--    revertir el crédito siguen funcionando (pasan a DEFINER con el mismo cuerpo).
--
-- Hasta acá (B20 del plan contable, 2.11) la máquina de estados de referrals
-- vivía en la app: cualquier rol del tenant podía, por la API, acreditar sin
-- venta, sacar un crédito de «aplicado» sin bajar el pagado de la factura y
-- volver a aplicarlo, y cambiar el monto. Esta migración pasa las reglas a la
-- base:
--
--   1. Sin UPDATE ni DELETE de referrals para authenticated. La policy «for
--      all» se reemplaza por una de SELECT y otra de INSERT.
--   2. apply_referral_credit y revert_referral_credits (0471) pasan a SECURITY
--      DEFINER con ALTER FUNCTION: su cuerpo no cambia (ya filtran por tenant y
--      exigen admin o accounting), así que su md5 vivo tampoco.
--   3. El guardián referrals_candado, BEFORE INSERT OR UPDATE OR DELETE, para
--      todos los roles: las transiciones permitidas, venta real o motivo para
--      acreditar, el monto inmutable, «aplicado» sale solo con su rastro limpio.
--   4. accredit_referral_on_first_invoice (0250) guarda qué factura acreditó.
--   5. Al anularse o borrarse la venta que acreditó: el crédito sin aplicar pasa
--      a otra venta viva del referido o vuelve a «registrado»; uno ya aplicado
--      no se revierte solo, queda marcado (sale_voided_at) para mostrarlo.
--   6. Tres RPC para lo que la app hacía con UPDATE directo: acreditar con
--      motivo (solo admin), avanzar de paso y enlazar el asiento del crédito.
--
-- Decisiones del Director, 2026-10-20 (spec §Preguntas): la espera es
-- 'registrado'; la acreditación manual la hace solo el admin; un aplicado cuya
-- venta se anula se muestra y no se revierte solo; DEFINER y no UPDATE por
-- columna; un acreditado o aplicado no se borra; 'registrado' exige el cliente.
--
-- MIGRATE-FIRST: se aplica antes de fusionar, con la previa de solo lectura,
-- el OK nominal de Sam y docs/runbooks/aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

-- Locks: ACCESS EXCLUSIVE breve sobre referrals (tres columnas nullable sin
-- default, sin reescritura; policies y trigger nuevos) y sobre invoices (un
-- trigger nuevo). No toca filas: la radiografía del 2026-10-20 midió 0 referidos.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  -- Primero: si el candado ya existe, la 0494 ya se aplicó.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'referrals' and column_name = 'accredited_invoice_id'
  ) or to_regprocedure('public.referrals_candado()') is not null then
    raise exception '0494 abortado: el candado de referidos ya existe';
  end if;

  -- Las funciones que se reemplazan o se alteran, y la que se invoca: firma,
  -- seguridad, volatilidad, search_path y cuerpo vigentes (md5 del prosrc con
  -- CRLF→LF, o sin espacios).
  --
  -- DERIVA DE 0250, medida por el Director en producción el 2026-10-20 (solo
  -- el catálogo): accredit_referral_on_first_invoice vivo es el cuerpo del repo
  -- SIN sus líneas de comentario (994 caracteres contra 1306); la lógica es
  -- idéntica. Como en la 0493 con la 0133: se aceptan los dos cuerpos conocidos,
  -- el del repo (el que reconstruyen las pruebas) y el vivo. La 0250 no se toca.
  for v_expected in select * from (values
    ('public.accredit_referral_on_first_invoice()', true, 'v', 'search_path=public',
     array['e63cc18830e7b7a291c7429dcbcc3e18',     -- 0250 del repo
           '4d3026c55e3507024cc3b44e57f0dca9'],    -- vivo en producción (994 caracteres)
     array['a2522752dbac935710d568310e1ba18c',
           'c808193448382b4908fd3543cbaa4fcb']),
    ('public.apply_referral_credit(uuid,uuid)', false, 'v', 'search_path=""',
     array['8c32487e62bc23c16def30cc4e3c343b'], array['63b7e0eab68c60f5aa5d12796b16d66e']),   -- 0471
    ('public.revert_referral_credits(uuid,uuid)', false, 'v', 'search_path=""',
     array['256c1331a53ab794af184f8bb90a1ca4'], array['0bc1e5497316176f03dadefb7cb9897f']),   -- 0471
    ('public.get_user_tenant_id()', true, 's', 'search_path=""',
     array['5ff0c51c26a49419c34abc78f1d95c37'], array['4ce5acd04a577f91ca77b74ebc622c49'])    -- 0453
  ) e(signature, definer, volatility, config, body_md5s, body_md5s_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
      and p.prosecdef = v_expected.definer
      and p.provolatile::text = v_expected.volatility
      and p.proconfig = array[v_expected.config]::text[];
    if v_md5 is null then
      raise exception '0494: dependencia ausente o con otra firma, seguridad, volatilidad o search_path: %',
        v_expected.signature;
    end if;
    if not (v_md5 = any (v_expected.body_md5s))
       and not coalesce(v_md5_normalized = any (v_expected.body_md5s_normalized), false) then
      raise exception '0494 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;

  if to_regclass('public.referrals') is null or to_regclass('public.invoices') is null
     or to_regclass('public.clients') is null or to_regclass('public.journal_entries') is null
     or to_regclass('public.referral_settings') is null
     or to_regclass('public.studio_role_module_overrides') is null
     or to_regclass('public.user_tenants') is null or to_regprocedure('auth.uid()') is null then
    raise exception '0494 requiere referrals, invoices, clients, journal_entries, referral_settings, studio_role_module_overrides, user_tenants y auth.uid()';
  end if;
  -- El disparador de 0098 que se recrea: el vivo de producción (pg_get_triggerdef,
  -- leído por el Director el 2026-10-20) es el mismo que el del repo.
  if not exists (select 1 from pg_catalog.pg_trigger tg
      where tg.tgrelid = 'public.referrals'::regclass and tg.tgname = 'referrals_validate_clients_trg'
        and tg.tgfoid = 'public.referrals_validate_clients()'::regprocedure and not tg.tgisinternal
        and pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(tg.oid), '\s', '', 'g') =
            'CREATETRIGGERreferrals_validate_clients_trgBEFOREINSERTORUPDATEONpublic.referralsFOREACHROWEXECUTEFUNCTIONreferrals_validate_clients()') then
    raise exception '0494 abortado: el disparador referrals_validate_clients_trg no es el de 0098; revisar antes de aplicar';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.referrals'::regclass and conname = 'referrals_credit_applied_coherent') then
    raise exception '0494 requiere el CHECK referrals_credit_applied_coherent de 0237';
  end if;
  -- La policy que se reemplaza tiene que ser una de las dos conocidas. DERIVA DE
  -- 0098, leída por el Director en producción el 2026-10-20 con pg_policies: el
  -- qual vivo es «(tenant_id = get_user_tenant_id())», SIN el «and deleted_at is
  -- null» del repo (0098:172-175), y ninguna migración lo cambia. La SELECT nueva
  -- devuelve el comportamiento que la 0098 quería. Cualquier otra policy aborta.
  if not exists (select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'referrals' and policyname = 'referrals by tenant'
        and cmd = 'ALL' and roles = array['authenticated']::name[]
        and pg_catalog.regexp_replace(qual, '\s', '', 'g') in (
          '((tenant_id=get_user_tenant_id())AND(deleted_atISNULL))',   -- 0098 del repo
          '(tenant_id=get_user_tenant_id())')                          -- vivo en producción
        and pg_catalog.regexp_replace(with_check, '\s', '', 'g') = '(tenant_id=get_user_tenant_id())') then
    raise exception '0494 abortado: la policy «referrals by tenant» no es la de 0098 ni la viva de producción; revisar antes de aplicar';
  end if;
end;
$preflight$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Columnas: la venta que acreditó y la acreditación a mano ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Las dos FK sin «on delete set null»: limpiar en silencio la venta o el autor
-- de un crédito acreditado chocaría con el guardián. Son NO ACTION (como
-- RESTRICT, pero se comprueba al final de la sentencia): un borrado directo de
-- esa factura o de ese usuario falla, y el borrado en cascada de un tenant
-- entero, que se lleva también sus referidos, termina sin chocar.
alter table public.referrals
  add column accredited_invoice_id uuid references public.invoices(id) on delete no action,
  add column accredited_reason     text,
  add column accredited_by         uuid references auth.users(id) on delete no action,
  add column sale_voided_at        timestamptz,
  add constraint referrals_accredited_reason_length check (
    accredited_reason is null or pg_catalog.char_length(pg_catalog.btrim(accredited_reason)) between 10 and 1000);

-- Un solo referido vivo por cliente referido: con dos, una sola venta acreditaba
-- dos créditos (revisión de seguridad del Director, 2026-10-20, B2).
create unique index referrals_un_referido_por_cliente
  on public.referrals (tenant_id, referred_client_id)
  where referred_client_id is not null and deleted_at is null;
-- El disparador de invoices busca por la venta que acreditó.
create index referrals_accredited_invoice_idx
  on public.referrals (accredited_invoice_id)
  where accredited_invoice_id is not null;

comment on column public.referrals.accredited_invoice_id is
  'SDD-0567: la factura del referido que acreditó el crédito (disparador de 0250). Null en una acreditación manual.';
comment on column public.referrals.accredited_reason is
  'SDD-0567: el motivo de una acreditación manual (sin venta), de 10 a 1000 caracteres. Solo el admin, por acreditar_referido_con_motivo.';
comment on column public.referrals.accredited_by is
  'SDD-0567: quién acreditó a mano.';
comment on column public.referrals.sale_voided_at is
  'SDD-0567: cuándo se anuló o borró la venta que acreditó un crédito ya aplicado. No se revierte solo (decisión del Director): la app lo muestra.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Sin UPDATE ni DELETE para authenticated                ║
-- ╚═══════════════════════════════════════════════════════════╝

revoke update, delete on public.referrals from authenticated;

-- El «for all» de 0098 deja de servir para escribir: se reemplaza por lo que
-- authenticated todavía hace. El predicado de tenant es el de 0098.
drop policy "referrals by tenant" on public.referrals;
create policy "referrals select by tenant" on public.referrals
  for select to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null);
-- La sesión solo invita (registerReferral). Registrar con un cliente es del
-- registro público (service_role) y de avanzar_referido: si no, cualquier rol
-- insertaba un «registrado» con un cliente que ya tenía una factura abierta y el
-- próximo cobro le acreditaba el crédito (B2).
create policy "referrals insert by tenant" on public.referrals
  for insert to authenticated
  with check (tenant_id = public.get_user_tenant_id() and status = 'invitado' and referred_client_id is null);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Aplicar y revertir: DEFINER, con el mismo cuerpo       ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Sin el UPDATE de authenticated, como INVOKER fallarían. El cuerpo de 0471 ya
-- filtra cada lectura por el tenant de la sesión (get_user_tenant_id) y exige
-- admin o accounting antes de tocar nada, así que no dependía de la RLS para
-- el alcance. EXECUTE sigue solo para authenticated.
alter function public.apply_referral_credit(uuid,uuid) security definer;
alter function public.revert_referral_credits(uuid,uuid) security definer;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. ¿Es una venta real del cliente referido?               ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.referido_venta_real(p_tenant_id uuid, p_client_id uuid, p_invoice_id uuid, p_desde timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.invoices i
    join public.clients c on c.id = p_client_id and c.tenant_id = p_tenant_id
    where i.id = p_invoice_id
      and i.tenant_id = p_tenant_id
      and i.client_markbox = c.markbox
      and i.deleted_at is null
      and i.status::text in ('emitida', 'parcial', 'pagada', 'vencida')
      and i.created_at >= p_desde
  )
$function$;

comment on function public.referido_venta_real(uuid, uuid, uuid, timestamptz) is
  'SDD-0567: la factura es viva, facturable (emitida, parcial, pagada o vencida), del cliente referido y creada desde p_desde (el alta del referido: una factura vieja no es la venta que trajo el referido), en el tenant. Interna: sin EXECUTE para la API.';
revoke all on function public.referido_venta_real(uuid, uuid, uuid, timestamptz) from public, anon, authenticated, service_role;

-- Otra venta viva y facturable del cliente referido, distinta de p_excluir: la
-- más antigua. Null si no hay.
create function public.referido_otra_venta(p_tenant_id uuid, p_client_id uuid, p_excluir uuid, p_desde timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select i.id
  from public.invoices i
  join public.clients c on c.id = p_client_id and c.tenant_id = p_tenant_id
  where i.tenant_id = p_tenant_id and i.id is distinct from p_excluir and i.client_markbox = c.markbox
    and i.deleted_at is null and i.status::text in ('emitida', 'parcial', 'pagada', 'vencida')
    and i.created_at >= p_desde
  order by i.issued_at nulls last, i.id
  limit 1
$function$;

comment on function public.referido_otra_venta(uuid, uuid, uuid, timestamptz) is
  'SDD-0567: otra venta viva y facturable del cliente referido, creada desde p_desde (la más antigua), o null. Interna: sin EXECUTE para la API.';
revoke all on function public.referido_otra_venta(uuid, uuid, uuid, timestamptz) from public, anon, authenticated, service_role;

-- ¿El cliente referido es el propio referidor? Por id o por su markbox (el
-- referidor puede no tener referrer_client_id).
create function public.referido_es_el_referidor(p_referred uuid, p_referrer uuid, p_referrer_markbox text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_referred is not null and (
    p_referred = p_referrer
    or exists (select 1 from public.clients c
               where c.id = p_referred and pg_catalog.upper(c.markbox) = pg_catalog.upper(p_referrer_markbox))
  )
$function$;

comment on function public.referido_es_el_referidor(uuid, uuid, text) is
  'SDD-0567: el cliente referido es el referidor (por id o por markbox). Interna: sin EXECUTE para la API.';
revoke all on function public.referido_es_el_referidor(uuid, uuid, text) from public, anon, authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. El guardián                                            ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Corre para TODOS los roles, también service_role y las funciones DEFINER:
-- es una propiedad de la tabla, no de un camino de la app. DEFINER para que
-- sus ayudantes (sin EXECUTE para la API) respondan igual con cualquier rol.
create function public.referrals_candado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_viejo text;
  v_nuevo text;
  v_otra  uuid;
  v_espera_por_reversion boolean := false;
begin
  if tg_op = 'DELETE' then
    -- Borrar el tenant entero se lleva sus referidos en cascada: ahí el tenant ya
    -- no existe y el borrado pasa (M3).
    if old.status::text in ('acreditado', 'aplicado')
       and exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'Un referido % no se borra.', old.status
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status::text not in ('invitado', 'registrado') then
      raise exception 'Un referido nace invitado o registrado, no %.', new.status
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    if new.reward_usd <> 0 or new.accredited_at is not null or new.accredited_invoice_id is not null
       or new.accredited_reason is not null or new.accredited_by is not null or new.sale_voided_at is not null
       or new.applied_invoice_id is not null or new.applied_at is not null or new.applied_entry_id is not null
       or new.deleted_at is not null then
      raise exception 'Un referido nace sin crédito, sin acreditación y sin aplicación.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    if new.status::text = 'registrado' and new.referred_client_id is null then
      raise exception 'Un referido registrado tiene que tener su cliente.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    if public.referido_es_el_referidor(new.referred_client_id, new.referrer_client_id, new.referrer_markbox) then
      raise exception 'Un cliente no se refiere a sí mismo.' using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    return new;
  end if;

  v_viejo := old.status::text;
  v_nuevo := new.status::text;

  -- La reversión de un crédito aplicado cuya venta ya se anuló: ya no está
  -- aplicado, así que vale la regla de la venta anulada. Pasa a otra venta viva
  -- del referido o vuelve a espera (registrado), sin quedar acreditado en el aire.
  if v_viejo = 'aplicado' and v_nuevo = 'acreditado' and old.sale_voided_at is not null then
    v_otra := public.referido_otra_venta(old.tenant_id, old.referred_client_id, old.accredited_invoice_id, old.created_at);
    new.sale_voided_at := null;
    if v_otra is not null then
      new.accredited_invoice_id := v_otra;
    else
      new.status := 'registrado';
      new.reward_usd := 0;
      new.accredited_at := null;
      new.accredited_invoice_id := null;
      new.accredited_reason := null;
      new.accredited_by := null;
      v_nuevo := 'registrado';
      v_espera_por_reversion := true;
    end if;
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Un referido no cambia de tenant.' using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;
  if new.deleted_at is not null and old.deleted_at is null and v_viejo in ('acreditado', 'aplicado') then
    raise exception 'Un referido % no se borra.', old.status
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  -- Las transiciones permitidas. Cualquier otra se rechaza.
  if v_nuevo <> v_viejo and not v_espera_por_reversion and (v_viejo, v_nuevo) not in (
       ('invitado', 'registrado'),
       ('registrado', 'primer-embarque'),
       ('registrado', 'acreditado'),
       ('primer-embarque', 'acreditado'),
       ('acreditado', 'aplicado'),
       ('aplicado', 'acreditado'),     -- la reversión (revert_referral_credits)
       ('acreditado', 'registrado')    -- la vuelta a espera al anularse la venta
     ) then
    raise exception 'Un referido no pasa de % a %.', old.status, new.status
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  -- Volver a espera es SOLO por la venta anulada: si la venta que acreditó sigue
  -- siendo real, o el crédito fue a mano (sin venta), no hay espera (M4).
  if v_viejo = 'acreditado' and v_nuevo = 'registrado'
     and (old.accredited_invoice_id is null
          or public.referido_venta_real(old.tenant_id, old.referred_client_id, old.accredited_invoice_id, old.created_at)) then
    raise exception 'Un crédito vuelve a espera solo si se anuló la venta que lo acreditó.'
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  if new.referred_client_id is distinct from old.referred_client_id
     and public.referido_es_el_referidor(new.referred_client_id, new.referrer_client_id, new.referrer_markbox) then
    raise exception 'Un cliente no se refiere a sí mismo.' using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  -- Volver a espera limpia la acreditación entera: la próxima venta la sella de nuevo.
  if v_viejo = 'acreditado' and v_nuevo = 'registrado' then
    new.reward_usd := 0;
    new.accredited_at := null;
    new.accredited_invoice_id := null;
    new.accredited_reason := null;
    new.accredited_by := null;
  end if;

  -- Al ENTRAR en registrado, no al quedarse: borrar el cliente pone la FK en
  -- null (on delete set null) y no debe trabar ese borrado.
  if v_nuevo = 'registrado' and v_viejo <> 'registrado' and new.referred_client_id is null then
    raise exception 'Un referido registrado tiene que tener su cliente.'
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  -- Nacer acreditado: venta real del cliente referido, o motivo; y un monto.
  if v_nuevo = 'acreditado' and v_viejo in ('registrado', 'primer-embarque') then
    if new.reward_usd is null or new.reward_usd <= 0 then
      raise exception 'Un crédito de referido tiene un monto mayor que 0.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    if not (
      (new.accredited_invoice_id is not null
        and public.referido_venta_real(new.tenant_id, new.referred_client_id, new.accredited_invoice_id, new.created_at))
      or (new.accredited_reason is not null and new.accredited_by is not null)
    ) then
      raise exception 'Un crédito de referido nace de una venta real del referido o de una acreditación con motivo.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
  end if;

  -- Acreditado o aplicado (y sigue así): el crédito no cambia.
  if v_viejo in ('acreditado', 'aplicado') and v_nuevo in ('acreditado', 'aplicado') then
    if new.reward_usd is distinct from old.reward_usd
       or new.accredited_at is distinct from old.accredited_at
       or new.accredited_reason is distinct from old.accredited_reason
       or new.accredited_by is distinct from old.accredited_by then
      raise exception 'El crédito de un referido no cambia después de acreditarse.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    -- La venta que acreditó cambia en un solo caso: ya no es real (anulada o
    -- borrada) y la nueva sí lo es.
    if new.accredited_invoice_id is distinct from old.accredited_invoice_id
       and not (
         old.accredited_invoice_id is not null and new.accredited_invoice_id is not null
         and not public.referido_venta_real(old.tenant_id, old.referred_client_id, old.accredited_invoice_id, old.created_at)
         and public.referido_venta_real(new.tenant_id, new.referred_client_id, new.accredited_invoice_id, new.created_at)
       ) then
      raise exception 'La venta que acreditó un crédito no cambia.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
  end if;

  -- La aplicación: entra con su rastro, sale con el rastro limpio.
  if v_viejo = 'acreditado' and v_nuevo = 'aplicado'
     and (new.applied_invoice_id is null or new.applied_at is null) then
    raise exception 'Un crédito se aplica con su factura y su fecha.'
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;
  if v_nuevo <> 'aplicado'
     and (new.applied_invoice_id is not null or new.applied_at is not null or new.applied_entry_id is not null) then
    raise exception 'Un crédito que no está aplicado no tiene factura, fecha ni asiento de aplicación.'
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;
  if v_viejo = 'aplicado' and v_nuevo = 'aplicado' then
    if new.applied_invoice_id is distinct from old.applied_invoice_id
       or new.applied_at is distinct from old.applied_at then
      raise exception 'La aplicación de un crédito no cambia: se revierte.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
    if new.applied_entry_id is distinct from old.applied_entry_id and old.applied_entry_id is not null then
      raise exception 'El asiento de un crédito aplicado no cambia.'
        using errcode = 'check_violation', hint = 'dtd-referidos';
    end if;
  end if;

  -- La marca de la venta anulada: solo en un aplicado, solo de nada a una fecha.
  if new.sale_voided_at is distinct from old.sale_voided_at
     and not (v_nuevo = 'aplicado' and old.sale_voided_at is null and new.sale_voided_at is not null)
     and not (v_viejo = 'aplicado' and v_nuevo in ('acreditado', 'registrado') and new.sale_voided_at is null) then
    raise exception 'La marca de venta anulada solo se pone en un crédito aplicado.'
      using errcode = 'check_violation', hint = 'dtd-referidos';
  end if;

  return new;
end;
$function$;

comment on function public.referrals_candado() is
  'SDD-0567: guardián de referrals para todos los roles. Transiciones permitidas; venta real o motivo para acreditar; monto e historia de la acreditación inmutables; aplicado sale solo con su rastro limpio; un acreditado o aplicado no se borra; registrado exige el cliente.';
revoke all on function public.referrals_candado() from public, anon, authenticated, service_role;

-- referrals_candado_trg corre ANTES que referrals_seal_accredited_at_trg (orden
-- alfabético de los BEFORE): al volver a 'registrado' limpia accredited_at y el
-- sello, que solo mira 'acreditado', no lo vuelve a poner.
create trigger referrals_candado_trg
  before insert or update or delete on public.referrals
  for each row execute function public.referrals_candado();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. La acreditación por venta guarda la factura (0250)     ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Reescrita desde su última definición (0250). Lo único nuevo es
-- accredited_invoice_id = new.id: la venta que acreditó.
create or replace function public.accredit_referral_on_first_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_reward numeric(12,2);
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if new.status::text not in ('emitida', 'parcial', 'pagada', 'vencida') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  -- Resolver el cliente por markbox (shipments/invoices no tienen client_id).
  select id into v_client
  from public.clients
  where markbox = new.client_markbox
    and tenant_id = new.tenant_id
    and deleted_at is null
  limit 1;

  if v_client is null then
    return new;
  end if;

  -- SDD-0159: monto del crédito desde la config del tenant (fallback 80).
  select rs.referrer_reward_usd into v_reward
  from public.referral_settings rs
  where rs.tenant_id = new.tenant_id;
  v_reward := coalesce(v_reward, 80);
  -- SDD-0567 (B1): con el premio en 0 no hay crédito que acreditar. Sin esto, el
  -- guardián rechazaba el UPDATE y la factura del referido no se podía emitir ni cobrar.
  if v_reward <= 0 then
    return new;
  end if;

  -- Acreditar idempotente por estado: solo referidos aún pendientes de este
  -- cliente. La 1ª factura los pasa a 'acreditado'; las siguientes no matchean.
  -- SDD-0567: guarda la venta que acreditó, que el guardián exige, y solo cuenta
  -- una factura creada desde el alta del referido (una vieja no es su venta).
  update public.referrals
     set status     = 'acreditado',
         reward_usd = v_reward,
         accredited_invoice_id = new.id,
         updated_at = now()
   where referred_client_id = v_client
     and tenant_id = new.tenant_id
     and status in ('registrado', 'primer-embarque')
     and deleted_at is null
     and created_at <= new.created_at;

  return new;
end;
$$;

comment on function public.accredit_referral_on_first_invoice is
  'SDD-0051 Fase 2 (+ SDD-0159, SDD-0567): en la 1ª factura billable de un cliente referido, acredita al referidor (referrals.status=acreditado + reward_usd desde referral_settings, fallback 80) y guarda la factura en accredited_invoice_id. Advisory: NO postea a CxC. Idempotente por estado.';
revoke execute on function public.accredit_referral_on_first_invoice() from public, anon;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. La venta que acreditó se anula o se borra              ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.referrals_venta_anulada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ref  record;
  v_otra uuid;
begin
  if not ((new.status::text = 'anulada' and old.status::text is distinct from 'anulada')
          or (new.deleted_at is not null and old.deleted_at is null)) then
    return new;
  end if;

  for v_ref in
    select r.id, r.status::text as estado, r.referred_client_id, r.created_at
    from public.referrals r
    where r.tenant_id = new.tenant_id and r.accredited_invoice_id = new.id and r.deleted_at is null
    order by r.id
    for update
  loop
    if v_ref.estado = 'acreditado' then
      v_otra := public.referido_otra_venta(new.tenant_id, v_ref.referred_client_id, new.id, v_ref.created_at);
      if v_otra is not null then
        update public.referrals set accredited_invoice_id = v_otra where id = v_ref.id;
      else
        update public.referrals set status = 'registrado' where id = v_ref.id;
      end if;
    elsif v_ref.estado = 'aplicado' then
      -- Primero, otra venta viva del referido (M1). Solo sin ella queda marcado.
      v_otra := public.referido_otra_venta(new.tenant_id, v_ref.referred_client_id, new.id, v_ref.created_at);
      if v_otra is not null then
        update public.referrals set accredited_invoice_id = v_otra where id = v_ref.id;
      else
        update public.referrals set sale_voided_at = pg_catalog.now()
        where id = v_ref.id and sale_voided_at is null;
      end if;
    end if;
  end loop;
  return new;
end;
$function$;

comment on function public.referrals_venta_anulada() is
  'SDD-0567: al anularse o borrarse la venta que acreditó un crédito: sin aplicar, pasa a otra venta viva del referido o vuelve a registrado; aplicado, queda con sale_voided_at para mostrarlo (no se revierte solo).';
revoke all on function public.referrals_venta_anulada() from public, anon, authenticated, service_role;

create trigger invoices_referral_sale_voided
  after update of status, deleted_at on public.invoices
  for each row
  when (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at)
  execute function public.referrals_venta_anulada();

-- La validación de clientes de 0098 corría en TODO UPDATE y exige clientes no
-- borrados: un UPDATE de estado (anular la venta) fallaba si el referidor o el
-- referido estaban borrados (I2). Ahora corre al insertar y cuando cambia un
-- cliente o el tenant (la validación ata los clientes al tenant). La función de
-- 0098 no cambia: el preflight compara la definición viva del disparador.
drop trigger referrals_validate_clients_trg on public.referrals;
create trigger referrals_validate_clients_trg
  before insert or update of referrer_client_id, referred_client_id, tenant_id on public.referrals
  for each row execute function public.referrals_validate_clients();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. Quién edita Fidelización (la matriz de lib/studio/rbac.ts) ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Como contabilidad_edicion_autorizada (0493): admin sí, support no, el resto
-- según el override del tenant, y por defecto commercial.
create function public.fidelizacion_edicion_autorizada(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select m.role, o.can_edit
    from membership m
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = 'fidelizacion'
  )
  select coalesce((
    select case
      when d.role = 'admin' then true
      when d.role = 'support' then false
      else coalesce(d.can_edit, d.role = 'commercial')
    end
    from decision d
  ), false)
$function$;

comment on function public.fidelizacion_edicion_autorizada(uuid) is
  'SDD-0567: ¿la sesión edita Fidelización en el tenant? La matriz de lib/studio/rbac.ts: admin sí, support no, el resto por override y por defecto commercial. Interna.';
revoke all on function public.fidelizacion_edicion_autorizada(uuid) from public, anon, authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9. Las RPC                                                ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Acreditar a mano, sin venta: solo el admin, con motivo y queda quién.
create function public.acreditar_referido_con_motivo(p_referral_id uuid, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_reason text := nullif(pg_catalog.btrim(p_motivo), '');
  v_ref    public.referrals%rowtype;
  v_reward numeric(12,2);
begin
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) = 'admin'
  ) then
    raise exception 'Solo el admin acredita un referido sin venta.' using errcode = '42501', hint = 'dtd-referidos';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 10 and 1000 then
    raise exception 'El motivo debe tener entre 10 y 1000 caracteres.' using errcode = '22023', hint = 'dtd-referidos';
  end if;

  select r.* into v_ref from public.referrals r
  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null
  for update;
  if not found then
    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';
  end if;
  if v_ref.status::text not in ('registrado', 'primer-embarque') then
    raise exception 'Solo se acredita un referido registrado o en su primer embarque.'
      using errcode = '22023', hint = 'dtd-referidos';
  end if;

  select rs.referrer_reward_usd into v_reward
  from public.referral_settings rs where rs.tenant_id = v_tenant;
  v_reward := coalesce(v_reward, 80);

  update public.referrals
  set status = 'acreditado', reward_usd = v_reward, accredited_reason = v_reason,
      accredited_by = (select auth.uid())
  where id = v_ref.id;

  return pg_catalog.jsonb_build_object('ok', true, 'reward_usd', v_reward);
end;
$function$;

-- Avanzar de paso a mano: invitado → registrado (con el cliente, por su
-- markbox) y registrado → primer-embarque. Nunca acredita ni retrocede.
create function public.avanzar_referido(p_referral_id uuid, p_estado text, p_markbox text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant  uuid := public.get_user_tenant_id();
  v_ref     public.referrals%rowtype;
  v_cliente uuid;
begin
  if v_tenant is null or not public.fidelizacion_edicion_autorizada(v_tenant) then
    raise exception 'No tienes permiso para editar Fidelización.' using errcode = '42501', hint = 'dtd-referidos';
  end if;

  select r.* into v_ref from public.referrals r
  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null
  for update;
  if not found then
    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';
  end if;

  if v_ref.status::text = 'invitado' and p_estado = 'registrado' then
    select c.id into v_cliente from public.clients c
    where c.tenant_id = v_tenant and c.deleted_at is null
      and pg_catalog.upper(c.markbox) = pg_catalog.upper(pg_catalog.btrim(coalesce(p_markbox, '')))
    limit 1;
    if v_cliente is null then
      raise exception 'Para marcarlo registrado, indica el markbox de un cliente activo.'
        using errcode = '22023', hint = 'dtd-referidos';
    end if;
    if public.referido_es_el_referidor(v_cliente, v_ref.referrer_client_id, v_ref.referrer_markbox) then
      raise exception 'Ese cliente es el que refiere: un cliente no se refiere a sí mismo.'
        using errcode = '22023', hint = 'dtd-referidos';
    end if;
    if exists (select 1 from public.referrals o
               where o.tenant_id = v_tenant and o.referred_client_id = v_cliente
                 and o.deleted_at is null and o.id <> v_ref.id) then
      raise exception 'Ese cliente ya tiene un referido.' using errcode = '22023', hint = 'dtd-referidos';
    end if;
    update public.referrals set status = 'registrado', referred_client_id = v_cliente where id = v_ref.id;
  elsif v_ref.status::text = 'registrado' and p_estado = 'primer-embarque' then
    update public.referrals set status = 'primer-embarque' where id = v_ref.id;
  else
    raise exception 'Ese paso no se marca a mano.' using errcode = '22023', hint = 'dtd-referidos';
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'status', p_estado);
end;
$function$;

-- Enlazar el asiento del crédito aplicado (lo que la app hacía con UPDATE
-- directo después de postReferralCreditJournalEntry). Admin o accounting, como
-- apply_referral_credit.
create function public.vincular_asiento_del_credito(p_referral_id uuid, p_entry_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_ref    public.referrals%rowtype;
begin
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')
  ) then
    raise exception 'No tienes permiso para enlazar el asiento del crédito.' using errcode = '42501', hint = 'dtd-referidos';
  end if;

  select r.* into v_ref from public.referrals r
  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null
  for update;
  if not found or v_ref.status::text <> 'aplicado' then
    raise exception 'El crédito no está aplicado.' using errcode = '22023', hint = 'dtd-referidos';
  end if;
  if v_ref.applied_entry_id is not distinct from p_entry_id then
    return pg_catalog.jsonb_build_object('ok', true, 'entry_id', p_entry_id);
  end if;
  if v_ref.applied_entry_id is not null then
    raise exception 'El crédito ya tiene su asiento.' using errcode = '22023', hint = 'dtd-referidos';
  end if;
  if not exists (
    select 1 from public.journal_entries e
    where e.id = p_entry_id and e.tenant_id = v_tenant and e.source = 'referral_credit'
      and e.referral_id = v_ref.id and e.invoice_id = v_ref.applied_invoice_id
      and e.status::text <> 'anulado'
  ) then
    raise exception 'Ese asiento no es el del crédito.' using errcode = '22023', hint = 'dtd-referidos';
  end if;

  update public.referrals set applied_entry_id = p_entry_id where id = v_ref.id;
  return pg_catalog.jsonb_build_object('ok', true, 'entry_id', p_entry_id);
end;
$function$;

comment on function public.acreditar_referido_con_motivo(uuid, text) is
  'SDD-0567: acredita a mano un referido registrado o en su primer embarque, sin venta. Solo el admin, con motivo de 10 a 1000 caracteres; guarda motivo y autor.';
comment on function public.avanzar_referido(uuid, text, text) is
  'SDD-0567: avanza a mano invitado → registrado (con el cliente por su markbox) o registrado → primer-embarque. Editores de Fidelización.';
comment on function public.vincular_asiento_del_credito(uuid, uuid) is
  'SDD-0567: enlaza el asiento referral_credit vivo de ese crédito y esa factura a un crédito aplicado sin asiento. Admin o accounting.';

revoke all on function public.acreditar_referido_con_motivo(uuid, text) from public, anon, service_role;
revoke all on function public.avanzar_referido(uuid, text, text) from public, anon, service_role;
revoke all on function public.vincular_asiento_del_credito(uuid, uuid) from public, anon, service_role;
grant execute on function public.acreditar_referido_con_motivo(uuid, text) to authenticated;
grant execute on function public.avanzar_referido(uuid, text, text) to authenticated;
grant execute on function public.vincular_asiento_del_credito(uuid, uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 10. Postflight                                            ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Como 0471: si algo de lo que esta migración promete no quedó así, aborta y
-- deshace todo (la migración corre en una transacción).
do $postflight$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (pg_catalog.to_regprocedure('public.apply_referral_credit(uuid,uuid)'),
                      pg_catalog.to_regprocedure('public.revert_referral_credits(uuid,uuid)'))
        and p.prosecdef and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')) <> 2 then
    raise exception '0494: postflight — apply y revert sin DEFINER, search_path o ACL esperados';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (pg_catalog.to_regprocedure('public.acreditar_referido_con_motivo(uuid,text)'),
                      pg_catalog.to_regprocedure('public.avanzar_referido(uuid,text,text)'),
                      pg_catalog.to_regprocedure('public.vincular_asiento_del_credito(uuid,uuid)'))
        and p.prosecdef and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) <> 3 then
    raise exception '0494: postflight — las tres RPC sin DEFINER, search_path o ACL esperados';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
      where p.oid in (pg_catalog.to_regprocedure('public.referrals_candado()'),
                      pg_catalog.to_regprocedure('public.referrals_venta_anulada()'),
                      pg_catalog.to_regprocedure('public.referido_venta_real(uuid,uuid,uuid,timestamptz)'),
                      pg_catalog.to_regprocedure('public.referido_otra_venta(uuid,uuid,uuid,timestamptz)'),
                      pg_catalog.to_regprocedure('public.referido_es_el_referidor(uuid,uuid,text)'),
                      pg_catalog.to_regprocedure('public.fidelizacion_edicion_autorizada(uuid)'))
        and (pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
             or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
             or pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'))) then
    raise exception '0494: postflight — una función interna tiene EXECUTE para la API';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.referrals', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.referrals', 'DELETE')
     or not pg_catalog.has_table_privilege('authenticated', 'public.referrals', 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.referrals', 'SELECT') then
    raise exception '0494: postflight — los grants de referrals para authenticated no son SELECT e INSERT';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger tg
      where not tg.tgisinternal and tg.tgname in ('referrals_candado_trg', 'invoices_referral_sale_voided', 'referrals_validate_clients_trg')) <> 3 then
    raise exception '0494: postflight — faltan los disparadores del candado';
  end if;
  -- Las funciones DEFINER escriben referrals e invoices sin la RLS: su dueño la salta.
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
      where p.oid in (pg_catalog.to_regprocedure('public.referrals_candado()'),
                      pg_catalog.to_regprocedure('public.referrals_venta_anulada()'),
                      pg_catalog.to_regprocedure('public.acreditar_referido_con_motivo(uuid,text)'),
                      pg_catalog.to_regprocedure('public.avanzar_referido(uuid,text,text)'),
                      pg_catalog.to_regprocedure('public.vincular_asiento_del_credito(uuid,uuid)'),
                      pg_catalog.to_regprocedure('public.apply_referral_credit(uuid,uuid)'),
                      pg_catalog.to_regprocedure('public.revert_referral_credits(uuid,uuid)'))
        and not (r.rolbypassrls or r.rolsuper)) then
    raise exception '0494: postflight — una función DEFINER del candado tiene un dueño que no salta la RLS';
  end if;
end;
$postflight$;
