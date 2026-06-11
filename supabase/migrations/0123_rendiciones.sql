-- ─────────────────────────────────────────────────────────────
-- SDD-0069 · Rendición quincenal a la Operadora (SDD-D capa legal)
--
-- Cierra el ciclo del mandato: Inversiones DTD Services es AGENTE DE
-- COBRANZA — el flete internacional que recauda es de la Operadora y
-- debe RENDIRSE. SDD-0068 separó los fondos (`fund_class`) y dejó
-- `payment_receipts.application_status='rendido'` DEFINIDO pero sin
-- productor; esta migración crea su productor.
--
-- Dos tablas:
--   · renditions          = SNAPSHOT inmutable de una rendición quincenal.
--                           Totales CONGELADOS al emitir (recaudado de
--                           terceros, servicios locales facturados, neto a
--                           favor de la Operadora). status emitida|anulada;
--                           el único cambio post-emisión es la anulación
--                           (status→anulada + void_reason). Trigger de
--                           inmutabilidad como `legal_acceptances` (0102).
--   · rendition_receipts  = puente rendición↔recibo (los recibos incluidos).
--                           Único PARCIAL (tenant_id, receipt_id) sobre
--                           rendiciones NO anuladas (vía columna denormalizada
--                           `rendition_voided`): un recibo no entra en dos
--                           rendiciones activas (lección 0045 — defender en DB,
--                           no solo en la action).
--
-- + RLS por tenant_id (read authenticated del tenant; write admin/service_role,
--   patrón legal_docs de 0102).
-- + Trigger de inmutabilidad en renditions: SOLO permite status emitida→anulada
--   (+ void_reason); cualquier otro UPDATE raise; DELETE bloqueado.
-- + Validación cross-tenant del receipt_id en rendition_receipts (helper
--   rendition_receipt_in_tenant() + trigger BEFORE INSERT OR UPDATE) — un
--   cliente PostgREST directo no puede colar un recibo de otro tenant.
-- + Sincronía del flag denormalizado `rendition_voided` (trigger AFTER UPDATE
--   en renditions): al anular, el puente se marca y libera el recibo del índice
--   parcial.
-- + RPC next_rendition_code(p_tenant uuid default null) → RND-YYYY-NNNN (calca
--   next_acceptance_code / next_quote_code; security definer, search_path=public).
--
-- Aditiva: NO toca tablas existentes (la transición aplicado↔rendido de
-- payment_receipts la hace la action con el grant ya existente). NO genera
-- journal_entries (la liquidación contable Operadora↔DTD la decide el contador,
-- decisión #4). ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0123 (0122 = recibos cobranza, ya tomado; siguiente libre).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. RENDITIONS · snapshot inmutable de la quincena         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila por rendición emitida. period_from/period_to = el rango quincenal
-- (Q1 1-15, Q2 16-último). Los 3 totales quedan CONGELADOS al emitir (no se
-- recalculan): third_party_usd (base CAJA: recaudado de terceros), local_revenue_usd
-- (base DEVENGADO: servicios locales facturados), net_to_operadora_usd (= terceros −
-- local). receipt_count = #recibos incluidos. void_reason solo al anular.
create table public.renditions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  rendition_code        text not null,                       -- 'RND-2026-0001'
  period_from           date not null,
  period_to             date not null,
  third_party_usd       numeric(14,2) not null default 0,    -- recaudado de terceros (CAJA)
  local_revenue_usd     numeric(14,2) not null default 0,    -- servicios locales facturados (DEVENGADO)
  net_to_operadora_usd  numeric(14,2) not null default 0,    -- = terceros − local
  receipt_count         int not null default 0,
  status                text not null default 'emitida'
                          check (status in ('emitida', 'anulada')),
  void_reason           text,
  created_by            uuid,                                 -- auth.uid() del emisor
  emitted_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (tenant_id, rendition_code),
  check (period_to >= period_from)
);

comment on table public.renditions is
  'SDD-0069: snapshot INMUTABLE de la rendición quincenal a la Operadora. Totales congelados al emitir (third_party_usd recaudado de terceros [CAJA] − local_revenue_usd servicios locales facturados [DEVENGADO] = net_to_operadora_usd). status emitida|anulada; el único cambio post-emisión es la anulación (trigger de inmutabilidad). NO genera asientos (la liquidación contable la decide el contador). RLS por tenant_id.';

create index renditions_tenant_period_idx
  on public.renditions (tenant_id, period_from);

create index renditions_tenant_status_idx
  on public.renditions (tenant_id, status);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RENDITION_RECEIPTS · puente rendición↔recibo           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Un row por recibo incluido en la rendición. amount_usd = el monto normalizado
-- a USD al emitir (congelado junto al snapshot). rendition_voided = flag
-- denormalizado del estado de SU rendición (lo mantiene el trigger de §5) para
-- que el índice único parcial pueda excluir las rendiciones anuladas SIN un join
-- (Postgres no admite subqueries en índices parciales).
create table public.rendition_receipts (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  rendition_id       uuid not null references public.renditions(id) on delete cascade,
  receipt_id         uuid not null references public.payment_receipts(id),
  amount_usd         numeric(14,2) not null default 0,
  rendition_voided   boolean not null default false,
  created_at         timestamptz not null default now()
);

comment on table public.rendition_receipts is
  'SDD-0069: puente rendición↔recibo (los payment_receipts incluidos en una rendición). amount_usd congelado al emitir. rendition_voided = flag denormalizado del estado de la rendición (lo sincroniza un trigger) para el índice único parcial. RLS por tenant_id.';

-- Un recibo en UNA sola rendición ACTIVA (decisión #7): índice único PARCIAL
-- sobre las rendiciones no anuladas. Al anular, rendition_voided pasa a true →
-- la fila sale del índice y el recibo queda libre para una nueva rendición.
create unique index rendition_receipts_one_active_uniq
  on public.rendition_receipts (tenant_id, receipt_id)
  where rendition_voided = false;

create index rendition_receipts_rendition_idx
  on public.rendition_receipts (rendition_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. INMUTABILIDAD · renditions (snapshot, decisión #5)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El snapshot no se reescribe. BEFORE UPDATE: el ÚNICO cambio permitido es la
-- transición status emitida→anulada (+ void_reason). Cualquier otro UPDATE
-- (period, totales, recibos, re-emitir una anulada) raise. BEFORE DELETE bloquea
-- (auditable). Cubre PostgREST directo, no solo la action.
create or replace function public.renditions_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'renditions es inmutable (snapshot de rendición): DELETE no permitido'
      using errcode = 'check_violation';
  end if;

  -- UPDATE: solo se admite la transición emitida → anulada.
  if not (old.status = 'emitida' and new.status = 'anulada') then
    raise exception 'renditions es inmutable: solo se permite anular una rendición emitida (status emitida→anulada)'
      using errcode = 'check_violation';
  end if;

  -- En esa transición, todo lo demás debe quedar igual al snapshot original.
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.rendition_code is distinct from old.rendition_code
     or new.period_from is distinct from old.period_from
     or new.period_to is distinct from old.period_to
     or new.third_party_usd is distinct from old.third_party_usd
     or new.local_revenue_usd is distinct from old.local_revenue_usd
     or new.net_to_operadora_usd is distinct from old.net_to_operadora_usd
     or new.receipt_count is distinct from old.receipt_count
     or new.created_by is distinct from old.created_by
     or new.emitted_at is distinct from old.emitted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'renditions es inmutable: al anular solo se puede cambiar status y void_reason'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists renditions_immutable_trg on public.renditions;
create trigger renditions_immutable_trg
  before update or delete on public.renditions
  for each row execute function public.renditions_immutable();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. VALIDACIÓN cross-tenant del receipt_id (lección 0045)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ¿El recibo existe, es del tenant y está vivo? SECURITY DEFINER (no depende del
-- grant SELECT de payment_receipts al rol caller); el filtro por tenant_id es
-- explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó = tenant del caller)
-- → sin fuga cross-tenant.
create or replace function public.rendition_receipt_in_tenant(
  p_receipt uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_receipt is null then
    return false;
  end if;
  return exists (
    select 1 from public.payment_receipts
    where id = p_receipt and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

create or replace function public.rendition_receipts_validate()
returns trigger
language plpgsql
as $$
begin
  if not public.rendition_receipt_in_tenant(new.receipt_id, new.tenant_id) then
    raise exception 'recibo inexistente, anulado o ajeno al tenant: %', new.receipt_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists rendition_receipts_validate_trg on public.rendition_receipts;
create trigger rendition_receipts_validate_trg
  before insert or update on public.rendition_receipts
  for each row execute function public.rendition_receipts_validate();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. SYNC del flag denormalizado rendition_voided           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Al anular una rendición (status→anulada), marca sus filas puente como
-- rendition_voided=true → salen del índice único parcial y liberan los recibos.
-- AFTER UPDATE (corre después de que el trigger de inmutabilidad validó la
-- transición). Solo dispara cuando el status cambió a 'anulada'.
create or replace function public.renditions_sync_voided()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'anulada' and old.status <> 'anulada' then
    update public.rendition_receipts
    set rendition_voided = true
    where rendition_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists renditions_sync_voided_trg on public.renditions;
create trigger renditions_sync_voided_trg
  after update on public.renditions
  for each row execute function public.renditions_sync_voided();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC next_rendition_code · RND-YYYY-NNNN                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Counter por año + tenant (calca next_acceptance_code 0102 / next_quote_code
-- 0007). Si p_tenant es null resuelve el tenant del caller vía get_user_tenant_id().
-- Padding 4. ⚠️ max()+1 sin lock tiene una race bajo concurrencia (igual que
-- next_quote_code, tolerada por la red del unique) → la action REINTENTA ante
-- choque de unique(tenant,rendition_code), decisión #10/§4.
create or replace function public.next_rendition_code(p_tenant uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(p_tenant, public.get_user_tenant_id());
  v_year   int  := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(rendition_code, '^RND-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.renditions
  where tenant_id = v_tenant
    and rendition_code like 'RND-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'RND-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_rendition_code is
  'SDD-0069: genera el próximo rendition_code RND-YYYY-NNNN para el tenant del año actual (resuelve get_user_tenant_id() si p_tenant null).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6b. entity_audit_log: + 'rendition' (patrón 0077/0079/0088)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Emitir/anular una rendición son acciones legal-sensibles: `auditRendition`
-- (lib/studio/renditions/actions-helpers.ts) escribe el rastro emitted|voided en
-- el audit log compartido con actor_type='user' via service_role. Ese audit usa
-- entity_type='rendition', PERO el CHECK entity_audit_log_entity_type_check (última
-- redefinición en 0088_tesoreria.sql) NO incluye ese valor → el INSERT violaría el
-- CHECK y caería en el try/catch best-effort del helper, DESCARTANDO el rastro en
-- silencio. Acá se redefine el CHECK sumando 'rendition' a la lista vigente de 0088
-- (cada entidad que entra al audit lo extiende al sumarse: 0077 invoice, 0079
-- payment_receipt, 0088 supplier*). Como 0123 aún no está en prod, esto se corrige
-- sin migración correctiva. La lista es la EXACTA de 0088 + 'rendition' al final.
do $$
begin
  alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
  alter table public.entity_audit_log
    add constraint entity_audit_log_entity_type_check
    check (entity_type in (
      'shipment',
      'dispatch_order',
      'dispatch_order_package',
      'warehouse_receipt_cn',
      'warehouse_receipt_ve',
      'invoice',
      'journal_entry',
      'account',
      'payment_receipt',
      'supplier',
      'supplier_bill',
      'supplier_payment',
      'rendition'
    ));
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- renditions: write reservado a admin/service_role (la RLS de write filtra).
-- authenticated lee. (update lo necesita la action de anular; el trigger de
-- inmutabilidad lo acota a la transición emitida→anulada.)
grant select, insert, update on public.renditions to authenticated;
grant all on public.renditions to service_role;

-- rendition_receipts: insert al emitir; el delete cae por cascade de renditions
-- (no se borran sueltas desde la action). Read por tenant.
grant select, insert on public.rendition_receipts to authenticated;
grant all on public.rendition_receipts to service_role;

grant execute on function public.next_rendition_code(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. RLS · fail-closed por tenant_id                        ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.renditions enable row level security;

-- Read: cualquier autenticado del tenant.
create policy "renditions read by tenant"
  on public.renditions for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Insert (emitir): solo admin del tenant.
create policy "renditions insert by admin"
  on public.renditions for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

-- Update (anular): solo admin del tenant. El trigger de inmutabilidad limita el
-- cambio a status emitida→anulada + void_reason.
create policy "renditions update by admin"
  on public.renditions for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = public.get_user_tenant_id());

create policy "renditions service_role all"
  on public.renditions for all to service_role using (true) with check (true);

alter table public.rendition_receipts enable row level security;

create policy "rendition_receipts read by tenant"
  on public.rendition_receipts for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Insert (al emitir): solo admin del tenant (mismo gate que renditions).
create policy "rendition_receipts insert by admin"
  on public.rendition_receipts for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "rendition_receipts service_role all"
  on public.rendition_receipts for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0123_rendiciones.sql
-- Aplicar con: supabase migration apply 0123 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
