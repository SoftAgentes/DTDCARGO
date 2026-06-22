-- ─────────────────────────────────────────────────────────────
-- SDD-0104 Slice B · Retenciones (comprobantes emitidos por DTD)
--
-- DTD, como agente de retención, emite comprobantes de retención de IVA (p.ej.
-- 75% sobre el IVA de una compra) e ISLR (honorarios/servicios). SDD-0073 dejó
-- la columna `retention` de los libros PREPARADA pero vacía (— , V2). Acá nace
-- la tabla transaccional de esos comprobantes.
--
--   tax_withholdings = un comprobante de retención emitido (iva | islr)
--
-- Decisiones (ver spec §3):
--  - Nº de comprobante CAPTURADO (no auto-generado): el correlativo fiscal lo
--    asigna el portal SENIAT (AAAAMM+secuencia); el ERP no inventa correlativos.
--    Unicidad por índice único parcial sobre el comprobante VIGENTE.
--  - Gate de poderes EN LA DB: INSERT/UPDATE solo accounting/admin (en la RLS
--    with-check → cierra el bypass PostgREST). RBAC fiscal=accounting (0085).
--  - Editable mientras 'emitido'; corregir un error grave = anular + recrear.
--  - text + CHECK para enums (sin landmine de cast). Coherencia de tenant por
--    trigger (patrón client_claims_check 0152). touch_updated_at (0002).
--
-- Reusa: get_user_tenant_id() (0001/0012), touch_updated_at() (0002),
-- suppliers (0088), supplier_bills (0088). Aditiva. NO aplicar a prod.
-- ─────────────────────────────────────────────────────────────

create table public.tax_withholdings (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  withholding_type text not null check (withholding_type in ('iva', 'islr')),
  -- Nº del comprobante real emitido en el portal SENIAT (capturado, no generado).
  voucher_number   text not null,
  period           text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- YYYY-MM
  op_date          date not null,
  -- Proveedor: FK viva (set null si se borra) + snapshot denormalizado.
  supplier_id      uuid references public.suppliers(id) on delete set null,
  supplier_name    text not null,                 -- snapshot al momento
  rif              text,
  -- Documento que origina la retención (la compra): FK viva + snapshot.
  source_bill_id   uuid references public.supplier_bills(id) on delete set null,
  source_doc       text,                          -- snapshot (bill_code / referencia)
  -- Base de la retención: el IVA (ret-IVA) o el monto/honorario (ret-ISLR).
  base             numeric(14,2) not null check (base >= 0),
  pct              numeric(6,3)  not null check (pct >= 0 and pct <= 100),
  amount           numeric(14,2) not null check (amount >= 0 and amount <= base),  -- retenido
  currency         text not null default 'USD',
  status           text not null default 'emitido' check (status in ('emitido', 'anulado')),
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users(id) on delete set null
);

comment on table public.tax_withholdings is
  'SDD-0104: comprobantes de retención de IVA/ISLR emitidos por DTD (agente de retención). Nº de comprobante capturado del portal SENIAT (no autogenerado). RLS por tenant; crear/editar solo accounting/admin. status emitido|anulado.';
comment on column public.tax_withholdings.base is
  'Base de la retención: el IVA de la compra (ret-IVA) o el monto/honorario (ret-ISLR). numeric → llega a TS como string.';
comment on column public.tax_withholdings.amount is
  'Monto retenido (base × pct / 100). Invariante: amount <= base.';

-- Idempotencia: no dos comprobantes VIGENTES con el mismo nº por tipo. Anular y
-- recapturar (corrección) no choca con el histórico anulado.
create unique index tax_withholdings_voucher_live_idx
  on public.tax_withholdings (tenant_id, withholding_type, voucher_number)
  where status = 'emitido';

-- Listado por período+tipo (pestaña Retenciones) y por proveedor/compra origen.
create index tax_withholdings_tenant_period_type_idx
  on public.tax_withholdings (tenant_id, period, withholding_type);
create index tax_withholdings_supplier_idx
  on public.tax_withholdings (supplier_id) where supplier_id is not null;
create index tax_withholdings_bill_idx
  on public.tax_withholdings (source_bill_id) where source_bill_id is not null;

-- ── Trigger de coherencia de tenant (patrón client_claims_check 0152) ──
-- supplier_id / source_bill_id deben pertenecer al mismo tenant (defensa en
-- profundidad sobre la RLS with-check).
create or replace function public.tax_withholdings_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 'anulado' es TERMINAL: un comprobante anulado no revive ni se edita (registro
  -- fiscal inmutable). Solo se permite emitido→anulado, o editar mientras emitido.
  -- Espeja el guard de fiscal_books (0165). Cierra el revival vía PostgREST.
  if tg_op = 'UPDATE' and old.status = 'anulado' then
    raise exception 'Un comprobante de retención anulado es inmutable.'
      using errcode = 'check_violation';
  end if;

  if new.supplier_id is not null then
    if not exists (
      select 1 from public.suppliers s
      where s.id = new.supplier_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'supplier_id % no pertenece al tenant %', new.supplier_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  if new.source_bill_id is not null then
    if not exists (
      select 1 from public.supplier_bills b
      where b.id = new.source_bill_id and b.tenant_id = new.tenant_id
    ) then
      raise exception 'source_bill_id % no pertenece al tenant %', new.source_bill_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  -- Sellado del hito de anulación (idempotente).
  if new.status = 'anulado' and new.voided_at is null then
    new.voided_at := now();
    new.voided_by := auth.uid();
  end if;

  return new;
end;
$$;

comment on function public.tax_withholdings_check() is
  'SDD-0104: coherencia de tenant (supplier_id/source_bill_id) + sellado de voided_* al anular.';

revoke execute on function public.tax_withholdings_check() from public, anon;

drop trigger if exists tax_withholdings_check_trg on public.tax_withholdings;
create trigger tax_withholdings_check_trg
  before insert or update on public.tax_withholdings
  for each row execute function public.tax_withholdings_check();

create trigger tax_withholdings_touch
  before update on public.tax_withholdings
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update on public.tax_withholdings to authenticated;
grant all on public.tax_withholdings to service_role;

-- ── RLS por tenant · escritura gateada a accounting/admin (gate en DB) ──
alter table public.tax_withholdings enable row level security;

-- SELECT: cualquier usuario autenticado del tenant.
create policy "tax_withholdings_tenant_select"
  on public.tax_withholdings for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT: solo accounting/admin del tenant (gate de poderes en la DB).
create policy "tax_withholdings_editor_insert"
  on public.tax_withholdings for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = tax_withholdings.tenant_id
        and ut.role in ('accounting', 'admin')
        and ut.disabled_at is null
    )
  );

-- UPDATE: solo accounting/admin del tenant (editar mientras emitido / anular).
create policy "tax_withholdings_editor_update"
  on public.tax_withholdings for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = tax_withholdings.tenant_id
        and ut.role in ('accounting', 'admin')
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- DELETE: bloqueado para authenticated (solo se anula).
create policy "tax_withholdings_no_delete"
  on public.tax_withholdings for delete to authenticated using (false);

create policy "service_role_all_tax_withholdings"
  on public.tax_withholdings for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Fin 0166_tax_withholdings.sql · Aditiva · NO aplicar a prod (coordinación).
-- ─────────────────────────────────────────────────────────────
