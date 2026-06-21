-- ─────────────────────────────────────────────────────────────
-- SDD-0101: Reclamos y siniestros del CLIENTE (gestión post-venta)
--
-- Incidencias que el cliente reporta sobre su carga — daño, faltante,
-- retraso u otro — atadas a la orden / Shipping Mark, con flujo de
-- evaluación → resolución y seguimiento de la cobertura de seguro.
--
-- NO confundir con supplier_claim_offsets (SDD-0059, lado PROVEEDOR /
-- cruce contable). Esto es lado CLIENTE / operativo.
--
-- Aditiva. RLS por tenant (equipo). RPC correlativo next_claim_code
-- (RC-YYYY-NNN). Trigger de coherencia + sellado de hitos. text+check
-- para los enums (extensible, sin landmine de cast enum↔text).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.client_claims (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  claim_code        text not null,                       -- RC-YYYY-NNN (next_claim_code)
  -- Cliente: FK viva + snapshot denormalizado (sobrevive borrado del cliente).
  client_id         uuid references public.clients(id) on delete set null,
  client_markbox    text,                                -- snapshot DTD-XXXX
  client_name       text,                                -- snapshot
  -- Embarque / contenedor (opcional): FK viva + snapshot.
  shipment_id       uuid references public.shipments(id) on delete set null,
  shipment_code     text,                                -- snapshot S-YYYY-NNNN
  container_code    text,                                -- DTDU-XXXXXX (texto libre)
  -- Naturaleza del reclamo.
  claim_type        text not null
    check (claim_type in ('dano', 'faltante', 'retraso', 'otro')),
  description       text not null,
  amount_usd        numeric(12,2) not null default 0,    -- monto reclamado (retraso puede ser 0)
  insured           boolean not null default false,      -- ¿embarque cubierto por póliza?
  -- Máquina de estados (§3 del spec).
  status            text not null default 'reportado'
    check (status in ('reportado', 'evaluacion', 'aprobado', 'pagado', 'resuelto', 'rechazado')),
  resolution_note   text,                                -- nota de resolución / motivo de rechazo
  evaluated_at      timestamptz,                         -- hito: entró a evaluación (sellado por trigger)
  resolved_at       timestamptz,                         -- hito: terminal (sellado por trigger)
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (tenant_id, claim_code)
);

comment on table public.client_claims is
  'SDD-0101: reclamos/siniestros del cliente (daño/faltante/retraso). Lado CLIENTE — NO confundir con supplier_claim_offsets (SDD-0059, lado proveedor). Soft delete. RLS por tenant.';
comment on column public.client_claims.insured is
  'El embarque del reclamo estaba cubierto por la póliza de carga (ver legal/Brief-Seguro-Operador).';
comment on column public.client_claims.amount_usd is
  'Monto reclamado en USD. numeric(12,2) → llega a TS como string, coercer con num().';

-- Índices: listado por estado, reclamos por cliente, por embarque.
create index client_claims_tenant_status_idx
  on public.client_claims (tenant_id, status)
  where deleted_at is null;

create index client_claims_tenant_client_idx
  on public.client_claims (tenant_id, client_id)
  where deleted_at is null and client_id is not null;

create index client_claims_shipment_idx
  on public.client_claims (shipment_id)
  where deleted_at is null and shipment_id is not null;

-- ── Correlativo RC-YYYY-NNN ───────────────────────────────────
-- MAX(num)+1 por tenant+año (mismo patrón que next_markbox). El unique
-- (tenant_id, claim_code) protege contra carreras (el 2º insert falla 23505).
-- assert_tenant_match exige tenant autenticado y que p_tenant_id sea el suyo
-- → un authenticated no puede leer el correlativo de otro tenant.
create or replace function public.next_claim_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_max  int;
begin
  perform public.assert_tenant_match(p_tenant_id);

  select coalesce(max((regexp_match(claim_code, '^RC-' || v_year || '-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.client_claims
   where tenant_id = p_tenant_id;

  return 'RC-' || v_year || '-' || lpad(v_max::text, 3, '0');
end;
$$;

comment on function public.next_claim_code is
  'SDD-0101: próximo código de reclamo RC-YYYY-NNN para el tenant (assert_tenant_match). MAX(num)+1 por año, padding 3.';

revoke all on function public.next_claim_code(uuid) from public;
revoke all on function public.next_claim_code(uuid) from anon;
grant execute on function public.next_claim_code(uuid) to authenticated;

-- ── Trigger de coherencia + sellado de hitos ──────────────────
-- security definer (patrón clients_check_advisor, migr 0151): valida que
-- client_id / shipment_id pertenezcan al mismo tenant (defensa en profundidad
-- aunque la RLS with-check ya fuerza new.tenant_id = get_user_tenant_id()), y
-- sella evaluated_at / resolved_at según el estado.
create or replace function public.client_claims_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    if not exists (
      select 1 from public.clients c
      where c.id = new.client_id and c.tenant_id = new.tenant_id
    ) then
      raise exception 'client_id % no pertenece al tenant %', new.client_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  if new.shipment_id is not null then
    if not exists (
      select 1 from public.shipments s
      where s.id = new.shipment_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'shipment_id % no pertenece al tenant %', new.shipment_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  -- Sellado de hitos (idempotente: solo si aún no se sellaron).
  if new.status = 'evaluacion' and new.evaluated_at is null then
    new.evaluated_at := now();
  end if;
  if new.status in ('pagado', 'resuelto', 'rechazado') and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

revoke execute on function public.client_claims_check() from public, anon;

drop trigger if exists client_claims_check_trg on public.client_claims;
create trigger client_claims_check_trg
  before insert or update on public.client_claims
  for each row execute function public.client_claims_check();

-- Trigger updated_at (reusa la función existente de 0002).
create trigger client_claims_touch
  before update on public.client_claims
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.client_claims to authenticated;

-- ── RLS por tenant (equipo del Studio) ────────────────────────
alter table public.client_claims enable row level security;

create policy "client_claims by tenant"
  on public.client_claims for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ── Seed demo (3 reclamos para el tenant 'dtd') ───────────────
-- Atados a los clientes del seed (DTD-1001..1003, migr 0006). claim_code fijo
-- e idempotente. evaluated_at/resolved_at los sella el trigger. created_by null.
insert into public.client_claims
  (tenant_id, claim_code, client_id, client_markbox, client_name,
   container_code, claim_type, description, amount_usd, insured, status, resolution_note)
select
  t.id, x.claim_code, c.id, c.markbox, c.name,
  x.container_code, x.claim_type, x.description, x.amount_usd, x.insured, x.status, x.resolution_note
from public.tenants t
join lateral (values
  ('RC-2026-001', 'DTD-1001', 'DTDU-204815', 'dano',     'Caja 12/30 con producto quebrado al abrir',  340.00, true,  'evaluacion', null),
  ('RC-2026-002', 'DTD-1002', 'DTDU-204815', 'faltante', '2 cajas no llegaron al despacho',            560.00, true,  'aprobado',   'Faltante confirmado contra packing list.'),
  ('RC-2026-003', 'DTD-1003', 'DTDU-201190', 'retraso',  'Entrega 6 días fuera de la ETA acordada',      0.00, false, 'resuelto',   'Compensado con crédito de bodegaje. Sin monto.')
) as x(claim_code, markbox, container_code, claim_type, description, amount_usd, insured, status, resolution_note) on true
join public.clients c on c.tenant_id = t.id and c.markbox = x.markbox
where t.slug = 'dtd'
on conflict (tenant_id, claim_code) do nothing;
