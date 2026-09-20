-- ─────────────────────────────────────────────────────────────────────────────
-- 0466 · SDD-0487 — el cliente agrega su empresa (o sus datos personales) y
-- elige a nombre de quién se le factura; la factura sella el titular al emitir.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). MIGRATE-FIRST ESTRICTO: el
--    código de la SDD-0487 deja de sellar en TypeScript, así que desplegado sin
--    esta migración emitiría facturas sin titular sellado.
--
-- ── Decisiones de Sam (2026-09-19, literales) ───────────────
-- «Razón social + RIF (Recomendado)» · «Sí, con su nombre y cédula
-- (Recomendado)» · «Nada gasta» · «Bloquear y avisar (Recomendado)» ·
-- «Sí, en el borrador» · «Apruebo el mockup; sí a los puntos 2 al 6»
-- (el asesor resuelve a mano un RIF repetido; los datos personales de una
-- cuenta de empresa tampoco gastan cupo; domicilio fiscal opcional; quitar
-- empresa; purga de intentos bloqueados a 90 días).
--
-- ── Qué agrega ──────────────────────────────────────────────
-- 1. `client_billing_identities`: la identidad SECUNDARIA del cliente, la del
--    tipo opuesto a `clients.doc_kind` (empresa de una persona, o persona de
--    una empresa). Una por cliente. `is_billing_default` es la preferencia
--    «Facturar a nombre de»: sin fila o en false se factura a la principal.
--    No se agrega ninguna columna a `clients`.
-- 2. Unicidad del documento ENTRE las dos tablas, por tenant y con la
--    normalización de `clients_tenant_doc_unique` (0095): índice único en la
--    tabla nueva y un trigger en `clients` que rechaza (23505) el documento que
--    ya es identidad secundaria de otro cliente vivo. Los dos lados toman el
--    mismo lock consultivo por (tenant, documento normalizado).
-- 3. `invoices.bill_to_kind` (elección del borrador en el Studio, null =
--    preferencia del cliente) e `invoices.client_fiscal_address` (sellado).
-- 4. Trigger `invoices_seal_billing_titular` (BEFORE INSERT OR UPDATE):
--    · sella sólo en INSERT con status 'emitida' o en UPDATE de 'borrador' a
--      'emitida'; nunca vuelve a sellar (Cobranzas 0467 devuelve parcial →
--      emitida al anular un recibo);
--    · sin cliente vivo para el Shipping Mark deja la fila como viene, igual
--      que `documentoDelCliente` de SDD-0298;
--    · con OLD.status distinto de 'borrador' rechaza cambios de client_name,
--      client_rif, client_doc_kind, client_fiscal_address y bill_to_kind.
--      Nada más: paid_amount, status, last_payment_at, due_date y
--      client_markbox siguen libres para sus escritores (0122, 0195/0359,
--      0294, 0367/0371, 0421, 0464 y 0467).
--    · si el borrador eligió un tipo distinto de la preferencia, audita
--      `invoice_bill_to_overridden` sin PII.
--    Corrige además que la RPC 0128 emitía sin sello.
-- 5. RPCs del Portal por sesión (EXECUTE sólo authenticated):
--    portal_get_my_billing_profile, portal_upsert_my_billing_identity,
--    portal_delete_my_billing_identity y portal_set_my_billing_kind. No gastan
--    cupo. Un documento de otra ficha se bloquea con el mismo registro y límite
--    de 0462 (5 en 24 h), sin el valor intentado.
-- 6. Lectura del Studio: SELECT para accounting, admin y commercial del tenant.
-- 7. `service_role` puede borrar `client_profile_blocked_attempts`: el cron
--    diario los purga a los 90 días.
--
-- ── Locks ───────────────────────────────────────────────────
-- Medido el 2026-09-19 en PostgreSQL 17 (Docker) con el preludio del contrato:
--   · ACCESS EXCLUSIVE sobre `invoices` (ADD COLUMN nullable sin default) y
--     sobre `client_profile_blocked_attempts` (cambio de CHECK); SHARE ROW
--     EXCLUSIVE sobre `clients` e `invoices` (CREATE TRIGGER) y sobre
--     `tenants` y `auth.users` (FK de la tabla nueva). Todo hasta el COMMIT.
--   · El DDL tarda 20-31 ms. Mientras tanto una lectura de `clients` no espera,
--     pero las lecturas y escrituras de `invoices` y las escrituras de
--     `clients` esperan hasta el COMMIT.
--   · Con una lectura larga abierta sobre `invoices`, la migración espera el
--     lock_timeout (5,0 s) y aborta entera sin crear nada; en ese lapso las
--     lecturas nuevas de `invoices` hacen cola detrás de ella (medido: 4 s).
-- Aplicar en baja actividad del Studio y del Portal. Sin backfill.
-- lock_timeout y statement_timeout son de sesión (rigen también fuera de una
-- transacción) y se restauran al final.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('auth.users') is null
     or pg_catalog.to_regclass('public.clients_tenant_doc_unique') is null
     or pg_catalog.to_regclass('public.client_profile_blocked_attempts') is null
     or pg_catalog.to_regprocedure('public.get_portal_client_id()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or pg_catalog.to_regprocedure(
       'public.portal_profile_record_blocked_attempt(uuid,uuid,uuid,text,uuid)'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0466 requiere clients, invoices, el índice 0095, la edición directa 0462, los helpers de sesión y rol, y la auditoría canónica';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.invoices'::pg_catalog.regclass
      and attname = 'client_rif' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.invoices'::pg_catalog.regclass
      and attname = 'client_doc_kind' and not attisdropped
  ) then
    raise exception '0466 requiere invoices.client_rif y client_doc_kind (0392)';
  end if;

  if (select pg_catalog.count(*) from public.audit_entity_types
      where entity_type in ('client', 'invoice') and status = 'active') <> 2 then
    raise exception '0466 requiere las entidades de auditoría client (0293) e invoice activas';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_profile_blocked_attempts'::pg_catalog.regclass
      and conname = 'client_profile_blocked_attempts_field_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%document%phone%'
  ) then
    raise exception '0466 abortado: el CHECK de campo de 0462 no tiene la forma esperada';
  end if;

  if pg_catalog.to_regclass('public.client_billing_identities') is not null
     or pg_catalog.to_regprocedure('public.portal_get_my_billing_profile()') is not null
     or exists (
       select 1 from pg_catalog.pg_attribute
       where attrelid = 'public.invoices'::pg_catalog.regclass
         and attname in ('bill_to_kind', 'client_fiscal_address')
         and not attisdropped
     ) then
    raise exception '0466 abortado: la identidad de facturación ya existe';
  end if;
end;
$preflight$;

-- ── Documento normalizado (misma expresión que 0095) ─────────
create function public.billing_doc_norm(p_doc text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select nullif(
    pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_doc, ''), '[^A-Za-z0-9]', '', 'g')),
    ''
  )
$function$;

-- ── 1. Identidad secundaria ──────────────────────────────────
create table public.client_billing_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('persona', 'empresa')),
  legal_name text not null
    check (legal_name = pg_catalog.btrim(legal_name)
           and pg_catalog.char_length(legal_name) between 2 and 200),
  doc text not null
    check (
      (kind = 'empresa' and doc ~ '^[VEJGP]-[0-9]{8}-[0-9]$')
      or (kind = 'persona' and doc ~ '^([VE]-[0-9]{6,9}|P-[A-Z0-9]{5,12})$')
    ),
  fiscal_address text
    check (fiscal_address is null
           or (fiscal_address = pg_catalog.btrim(fiscal_address)
               and pg_catalog.char_length(fiscal_address) between 5 and 300)),
  is_billing_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_billing_identities_one_per_client unique (client_id)
);

create unique index client_billing_identities_tenant_doc_unique
  on public.client_billing_identities (tenant_id, public.billing_doc_norm(doc));

comment on table public.client_billing_identities is
  'SDD-0487: identidad secundaria del cliente (empresa de una persona o persona de una empresa) y preferencia «Facturar a nombre de» (is_billing_default). El Portal la escribe por RPC de sesión; el Studio la lee (accounting, admin, commercial). No se sincroniza con Kommo.';

alter table public.client_billing_identities enable row level security;
revoke all on table public.client_billing_identities
  from public, anon, authenticated, service_role;
grant select on table public.client_billing_identities to authenticated, service_role;
create policy client_billing_identities_studio_select
  on public.client_billing_identities for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin', 'commercial')
  );

-- ── 2. Unicidad cruzada con clients.rif ──────────────────────
create function public.clients_doc_not_billing_identity_elsewhere()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_norm text := public.billing_doc_norm(new.rif);
begin
  if v_norm is null or new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and public.billing_doc_norm(old.rif) is not distinct from v_norm
     and old.deleted_at is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-doc:' || new.tenant_id::text || ':' || v_norm, 0)
  );

  if exists (
    select 1
    from public.client_billing_identities as identity
    join public.clients as owner
      on owner.id = identity.client_id and owner.deleted_at is null
    where identity.tenant_id = new.tenant_id
      and identity.client_id <> new.id
      and public.billing_doc_norm(identity.doc) = v_norm
  ) then
    raise exception 'client_doc_taken_by_billing_identity'
      using errcode = '23505',
            constraint = 'client_billing_identities_tenant_doc_unique';
  end if;
  return new;
end;
$function$;

create trigger clients_doc_not_billing_identity_elsewhere
  before insert or update of rif, deleted_at on public.clients
  for each row execute function public.clients_doc_not_billing_identity_elsewhere();

-- ── 3. Columnas de la factura ────────────────────────────────
alter table public.invoices
  add column bill_to_kind text,
  add column client_fiscal_address text;

alter table public.invoices
  add constraint invoices_bill_to_kind_valido
  check (bill_to_kind is null or bill_to_kind in ('persona', 'empresa'));

comment on column public.invoices.bill_to_kind is
  'SDD-0487: titular elegido en el borrador (persona o empresa). NULL = la preferencia del cliente al emitir. Inmutable después de emitir.';
comment on column public.invoices.client_fiscal_address is
  'SDD-0487: domicilio fiscal del titular SELLADO al emitir (sólo si la identidad lo tiene). Inmutable después de emitir.';

-- ── 4. Sello del titular al emitir ───────────────────────────
create function public.invoices_seal_billing_titular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client record;
  v_identity record;
  v_principal_kind text;
  v_preferred_kind text;
  v_kind text;
  v_actor uuid := auth.uid();
begin
  -- Después de emitir, el titular no cambia. Nada más queda congelado.
  if tg_op = 'UPDATE' and old.status <> 'borrador' then
    if new.client_name is distinct from old.client_name
       or new.client_rif is distinct from old.client_rif
       or new.client_doc_kind is distinct from old.client_doc_kind
       or new.client_fiscal_address is distinct from old.client_fiscal_address
       or new.bill_to_kind is distinct from old.bill_to_kind then
      raise exception 'invoice_titular_frozen' using errcode = '55000';
    end if;
    return new;
  end if;

  if not (
    (tg_op = 'INSERT' and new.status = 'emitida')
    or (tg_op = 'UPDATE' and old.status = 'borrador' and new.status = 'emitida')
  ) then
    return new;
  end if;

  select client.id, client.name, client.rif, client.doc_kind
    into v_client
  from public.clients as client
  where client.tenant_id = new.tenant_id
    and client.markbox = new.client_markbox
    and client.deleted_at is null
  limit 1;

  if not found then
    -- Sin cliente vivo: la factura se emite como viene (SDD-0298).
    return new;
  end if;

  select identity.kind, identity.legal_name, identity.doc,
         identity.fiscal_address, identity.is_billing_default
    into v_identity
  from public.client_billing_identities as identity
  where identity.client_id = v_client.id;

  v_principal_kind := coalesce(v_client.doc_kind, 'persona');
  v_preferred_kind := case
    when v_identity.kind is not null and v_identity.is_billing_default
      then v_identity.kind
    else v_principal_kind
  end;
  v_kind := coalesce(new.bill_to_kind, v_preferred_kind);

  if v_identity.kind is not null
     and v_kind = v_identity.kind
     and v_identity.kind <> v_principal_kind then
    new.client_name := v_identity.legal_name;
    new.client_rif := v_identity.doc;
    new.client_doc_kind := v_identity.kind;
    new.client_fiscal_address := v_identity.fiscal_address;
  else
    new.client_name := coalesce(nullif(pg_catalog.btrim(v_client.name), ''), new.client_name);
    new.client_rif := nullif(pg_catalog.btrim(coalesce(v_client.rif, '')), '');
    new.client_doc_kind := case when new.client_rif is null then null else v_client.doc_kind end;
    new.client_fiscal_address := null;
  end if;

  if new.bill_to_kind is not null and new.bill_to_kind <> v_preferred_kind then
    perform public.append_audit_event(
      new.tenant_id,
      'invoice',
      new.id,
      case when v_actor is null then 'system' else 'user' end,
      v_actor,
      'invoice_bill_to_overridden',
      'studio',
      'succeeded',
      'El operador eligió un titular distinto de la preferencia del cliente.',
      null,
      null,
      pg_catalog.jsonb_build_object(
        'bill_to_kind', new.bill_to_kind,
        'preferred_kind', v_preferred_kind,
        'applied_kind', coalesce(new.client_doc_kind, v_principal_kind)
      ),
      'invoice-bill-to:' || new.id::text,
      1,
      'internal'
    );
  end if;

  return new;
end;
$function$;

create trigger invoices_seal_billing_titular
  before insert or update on public.invoices
  for each row execute function public.invoices_seal_billing_titular();

-- ── 5. RPCs del Portal ───────────────────────────────────────
create function public.portal_get_my_billing_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_client_id uuid := public.get_portal_client_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_client_id is null then
    return null;
  end if;

  select pg_catalog.jsonb_build_object(
    'principal_kind', coalesce(client.doc_kind, 'persona'),
    'principal_name', client.name,
    'principal_doc', nullif(pg_catalog.btrim(coalesce(client.rif, '')), ''),
    'secondary', case when identity.id is null then null else
      pg_catalog.jsonb_build_object(
        'kind', identity.kind,
        'legal_name', identity.legal_name,
        'doc', identity.doc,
        'fiscal_address', identity.fiscal_address
      ) end,
    'billing_kind', case
      when identity.id is not null and identity.is_billing_default then identity.kind
      else coalesce(client.doc_kind, 'persona')
    end
  )
    into v_result
  from public.clients as client
  left join public.client_billing_identities as identity
    on identity.client_id = client.id
  where client.id = v_client_id and client.deleted_at is null;

  return v_result;
end;
$function$;

create function public.portal_upsert_my_billing_identity(
  p_legal_name text,
  p_doc text,
  p_fiscal_address text,
  p_set_default boolean
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_client_id uuid := public.get_portal_client_id();
  v_tenant_id uuid;
  v_principal_kind text;
  v_kind text;
  v_name text := nullif(pg_catalog.btrim(coalesce(p_legal_name, '')), '');
  v_doc text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_doc, ''))), '');
  v_address text := nullif(pg_catalog.btrim(coalesce(p_fiscal_address, '')), '');
  v_norm text;
  v_current record;
  v_conflict uuid;
  v_blocked integer;
  v_field text;
  v_doc_changed boolean;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  select client.tenant_id, coalesce(client.doc_kind, 'persona')
    into v_tenant_id, v_principal_kind
  from public.clients as client
  where client.id = v_client_id and client.deleted_at is null
  for update;
  if not found then
    raise exception 'profile_client_not_found' using errcode = 'P0001';
  end if;

  -- La secundaria es siempre la del tipo opuesto a la principal.
  v_kind := case when v_principal_kind = 'empresa' then 'persona' else 'empresa' end;
  v_field := case when v_kind = 'empresa' then 'company_rif' else 'personal_doc' end;

  if v_name is null or pg_catalog.char_length(v_name) not between 2 and 200 then
    raise exception 'invalid_billing_name' using errcode = '22023';
  end if;
  -- Forma canónica, con o sin guiones: J-12345678-9 · V-12345678 · P-AB12345.
  v_doc := public.billing_doc_norm(v_doc);
  v_doc := case
    when v_kind = 'empresa' and v_doc ~ '^[VEJGP][0-9]{9}$'
      then pg_catalog.substr(v_doc, 1, 1) || '-' || pg_catalog.substr(v_doc, 2, 8)
           || '-' || pg_catalog.substr(v_doc, 10, 1)
    when v_kind = 'persona' and v_doc ~ '^[VE][0-9]{6,9}$'
      then pg_catalog.substr(v_doc, 1, 1) || '-' || pg_catalog.substr(v_doc, 2)
    when v_kind = 'persona' and v_doc ~ '^P[A-Z0-9]{5,12}$'
      then 'P-' || pg_catalog.substr(v_doc, 2)
  end;
  if v_doc is null then
    raise exception 'invalid_billing_document' using errcode = '22023';
  end if;
  if v_address is not null and pg_catalog.char_length(v_address) not between 5 and 300 then
    raise exception 'invalid_billing_address' using errcode = '22023';
  end if;
  v_norm := public.billing_doc_norm(v_doc);

  select identity.legal_name, identity.doc, identity.fiscal_address,
         identity.is_billing_default
    into v_current
  from public.client_billing_identities as identity
  where identity.client_id = v_client_id
  for update;

  v_doc_changed := v_current.doc is null
    or public.billing_doc_norm(v_current.doc) is distinct from v_norm;

  if v_current.doc is not null
     and not v_doc_changed
     and v_current.legal_name = v_name
     and v_current.fiscal_address is not distinct from v_address
     and (p_set_default is null or v_current.is_billing_default = p_set_default) then
    return query select 'no_changes'::text;
    return;
  end if;

  if v_doc_changed then
    -- Mismo límite anti-enumeración que 0462: con 5 bloqueos en 24 h no se
    -- evalúa ningún documento, esté libre o no.
    select pg_catalog.count(*)::integer
      into v_blocked
    from public.client_profile_blocked_attempts as attempt
    where attempt.client_id = v_client_id
      and attempt.created_at > pg_catalog.now() - interval '24 hours';
    if v_blocked >= 5 then
      return query select 'rate_limited'::text;
      return;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('billing-doc:' || v_tenant_id::text || ':' || v_norm, 0)
    );

    select other.id
      into v_conflict
    from public.clients as other
    where other.tenant_id = v_tenant_id
      and other.id <> v_client_id
      and other.deleted_at is null
      and public.billing_doc_norm(other.rif) = v_norm
    limit 1;

    if v_conflict is null then
      select identity.client_id
        into v_conflict
      from public.client_billing_identities as identity
      join public.clients as owner
        on owner.id = identity.client_id and owner.deleted_at is null
      where identity.tenant_id = v_tenant_id
        and identity.client_id <> v_client_id
        and public.billing_doc_norm(identity.doc) = v_norm
      limit 1;
    end if;

    if v_conflict is not null then
      perform public.portal_profile_record_blocked_attempt(
        v_tenant_id, v_client_id, v_actor_id, v_field, v_conflict
      );
      return query select 'blocked'::text;
      return;
    end if;
  end if;

  begin
    insert into public.client_billing_identities as identity (
      tenant_id, client_id, kind, legal_name, doc, fiscal_address,
      is_billing_default, updated_by
    ) values (
      v_tenant_id, v_client_id, v_kind, v_name, v_doc, v_address,
      coalesce(p_set_default, false), v_actor_id
    )
    on conflict (client_id) do update
      set kind = excluded.kind,
          legal_name = excluded.legal_name,
          doc = excluded.doc,
          fiscal_address = excluded.fiscal_address,
          is_billing_default = coalesce(p_set_default, identity.is_billing_default),
          updated_at = pg_catalog.now(),
          updated_by = excluded.updated_by;
  exception
    when unique_violation then
      -- Carrera con el índice por documento: queda sólo el intento.
      perform public.portal_profile_record_blocked_attempt(
        v_tenant_id, v_client_id, v_actor_id, v_field, null
      );
      return query select 'blocked'::text;
      return;
  end;

  perform public.append_audit_event(
    v_tenant_id, 'client', v_client_id, 'user', v_actor_id,
    'client_billing_identity_saved', 'rpc', 'succeeded', null, null, null,
    pg_catalog.jsonb_build_object('kind', v_kind, 'document_changed', v_doc_changed,
                                  'billing_default', coalesce(p_set_default, v_current.is_billing_default, false)),
    'billing-identity:' || v_client_id::text || ':' || pg_catalog.gen_random_uuid()::text,
    1, 'sensitive'
  );

  return query select 'applied'::text;
end;
$function$;

create function public.portal_delete_my_billing_identity()
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_client_id uuid := public.get_portal_client_id();
  v_tenant_id uuid;
  v_kind text;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  delete from public.client_billing_identities as identity
  where identity.client_id = v_client_id
  returning identity.tenant_id, identity.kind into v_tenant_id, v_kind;

  if not found then
    return query select 'no_changes'::text;
    return;
  end if;

  perform public.append_audit_event(
    v_tenant_id, 'client', v_client_id, 'user', v_actor_id,
    'client_billing_identity_deleted', 'rpc', 'succeeded',
    'El cliente quitó su identidad de facturación desde el Portal.', null, null,
    pg_catalog.jsonb_build_object('kind', v_kind),
    'billing-identity-deleted:' || v_client_id::text || ':' || pg_catalog.gen_random_uuid()::text,
    1, 'sensitive'
  );
  return query select 'applied'::text;
end;
$function$;

create function public.portal_set_my_billing_kind(p_kind text)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_client_id uuid := public.get_portal_client_id();
  v_tenant_id uuid;
  v_principal_kind text;
  v_identity record;
  v_target boolean;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('persona', 'empresa') then
    raise exception 'invalid_billing_kind' using errcode = '22023';
  end if;

  select client.tenant_id, coalesce(client.doc_kind, 'persona')
    into v_tenant_id, v_principal_kind
  from public.clients as client
  where client.id = v_client_id and client.deleted_at is null;
  if not found then
    raise exception 'profile_client_not_found' using errcode = 'P0001';
  end if;

  select identity.kind, identity.is_billing_default
    into v_identity
  from public.client_billing_identities as identity
  where identity.client_id = v_client_id
  for update;

  if p_kind = v_principal_kind then
    v_target := false;
  elsif v_identity.kind = p_kind then
    v_target := true;
  else
    return query select 'missing_identity'::text;
    return;
  end if;

  if v_identity.kind is null or v_identity.is_billing_default = v_target then
    return query select 'no_changes'::text;
    return;
  end if;

  update public.client_billing_identities
  set is_billing_default = v_target,
      updated_at = pg_catalog.now(),
      updated_by = v_actor_id
  where client_id = v_client_id;

  perform public.append_audit_event(
    v_tenant_id, 'client', v_client_id, 'user', v_actor_id,
    'client_billing_kind_changed', 'rpc', 'succeeded', null, null, null,
    pg_catalog.jsonb_build_object('billing_kind', p_kind),
    'billing-kind:' || v_client_id::text || ':' || pg_catalog.gen_random_uuid()::text,
    1, 'internal'
  );
  return query select 'applied'::text;
end;
$function$;

-- ── 6. Intentos bloqueados: dos campos nuevos y purga a 90 días ──
alter table public.client_profile_blocked_attempts
  drop constraint client_profile_blocked_attempts_field_check;
alter table public.client_profile_blocked_attempts
  add constraint client_profile_blocked_attempts_field_check
  check (field in ('document', 'phone', 'company_rif', 'personal_doc'));
grant delete on table public.client_profile_blocked_attempts to service_role;

-- ── 7. Owner y privilegios ───────────────────────────────────
alter function public.billing_doc_norm(text) owner to postgres;
alter function public.clients_doc_not_billing_identity_elsewhere() owner to postgres;
alter function public.invoices_seal_billing_titular() owner to postgres;
alter function public.portal_get_my_billing_profile() owner to postgres;
alter function public.portal_upsert_my_billing_identity(text, text, text, boolean) owner to postgres;
alter function public.portal_delete_my_billing_identity() owner to postgres;
alter function public.portal_set_my_billing_kind(text) owner to postgres;

revoke all on function public.clients_doc_not_billing_identity_elsewhere()
  from public, anon, authenticated, service_role;
revoke all on function public.invoices_seal_billing_titular()
  from public, anon, authenticated, service_role;
revoke all on function public.portal_get_my_billing_profile()
  from public, anon, authenticated, service_role;
revoke all on function public.portal_upsert_my_billing_identity(text, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_delete_my_billing_identity()
  from public, anon, authenticated, service_role;
revoke all on function public.portal_set_my_billing_kind(text)
  from public, anon, authenticated, service_role;
grant execute on function public.portal_get_my_billing_profile() to authenticated;
grant execute on function public.portal_upsert_my_billing_identity(text, text, text, boolean) to authenticated;
grant execute on function public.portal_delete_my_billing_identity() to authenticated;
grant execute on function public.portal_set_my_billing_kind(text) to authenticated;

comment on function public.invoices_seal_billing_titular() is
  'SDD-0487: sella el titular (nombre, documento, tipo y domicilio fiscal) al emitir y lo hace inmutable después. Sustituye el sello en TypeScript de SDD-0298 y cubre la RPC 0128.';
comment on function public.portal_upsert_my_billing_identity(text, text, text, boolean) is
  'SDD-0487: el cliente del Portal agrega o corrige su identidad secundaria. No gasta cupo. Un documento de otra ficha se bloquea sin revelarlo (límite de 0462).';

reset lock_timeout;
reset statement_timeout;
