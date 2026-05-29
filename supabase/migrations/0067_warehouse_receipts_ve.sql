-- ═════════════════════════════════════════════════════════════
-- Sprint E (Plan v3) · Recepción VE bodeguero
-- ═════════════════════════════════════════════════════════════
-- Schema paralelo a `warehouse_receipts_cn` para el flujo VE:
-- el bodeguero abre la recepción del contenedor que llegó al puerto,
-- escanea las cajas (cada una con su DTDU-* code que ya fue asignado
-- en CN al recibirse), y al sellar marca todas las escaneadas como
-- "en bodega VE" disponibles para despacho.
--
-- Tablas:
--   1. warehouse_receipts_ve · 1 row por contenedor que llega
--   2. warehouse_receipt_ve_boxes · 1 row por caja esperada/escaneada
--
-- RPCs (implementan los stubs P0103/P0104 de operario_action en 0066):
--   - scan_box · branch del operario_action
--   - seal_reception · branch del operario_action
--
-- Code generator:
--   - next_receipt_ve_code(p_tenant_id) → 'WR-VE-YYYY-NNNN'
--
-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Enum + tablas                                          ║
-- ╚═══════════════════════════════════════════════════════════╝

do $$ begin
  create type warehouse_receipt_ve_status as enum (
    'en_muelle',       -- contenedor anunciado, todavía no llegó al hub
    'recibiendo',      -- bodeguero está escaneando cajas
    'sellado',         -- todas las cajas (o las suficientes) escaneadas → cerrado
    'con_incidencia'   -- diferencia entre expected y scanned · supervisor revisa
  );
exception when duplicate_object then null; end $$;

create table if not exists public.warehouse_receipts_ve (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  receipt_code                text not null,                    -- 'WR-VE-2026-0001'
  container_code              text,                             -- 'MSCU-1234567' (línea naviera)
  vessel                      text,                             -- 'MSC Bridge'
  port                        text,                             -- 'La Guaira'
  eta                         date,
  expected_cbm                numeric(10,3),
  expected_boxes              int not null default 0 check (expected_boxes >= 0),
  status                      warehouse_receipt_ve_status not null default 'en_muelle',
  -- Operarios responsables (snapshot)
  received_by_operario_id     uuid references public.operario_pins(id) on delete set null,
  sealed_by_operario_id       uuid references public.operario_pins(id) on delete set null,
  started_at                  timestamptz,                      -- primer escaneo
  sealed_at                   timestamptz,                      -- al sellar
  notes                       text,
  incident_note               text,                             -- detalle si status = con_incidencia
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (tenant_id, receipt_code)
);

comment on table public.warehouse_receipts_ve is
  'Sprint E · 1 row por contenedor que llega al hub VE. El bodeguero escanea cajas hasta sellar. Soft delete via deleted_at. RLS por tenant_id.';

create index if not exists warehouse_receipts_ve_tenant_status_idx
  on public.warehouse_receipts_ve (tenant_id, status) where deleted_at is null;

create index if not exists warehouse_receipts_ve_tenant_eta_idx
  on public.warehouse_receipts_ve (tenant_id, eta desc) where deleted_at is null;

create index if not exists warehouse_receipts_ve_container_idx
  on public.warehouse_receipts_ve (tenant_id, container_code) where deleted_at is null and container_code is not null;

create table if not exists public.warehouse_receipt_ve_boxes (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  receipt_id             uuid not null references public.warehouse_receipts_ve(id) on delete cascade,
  -- Box code (el código DTDU-* asignado en CN al receipt_cn original)
  -- Acepta cualquier formato — la UI valida con QR/manual lookup.
  code                   text not null,
  -- Snapshot de identidad del cliente al momento del receipt CN
  markbox                text,
  client_name            text,
  cbm                    numeric(10,3),
  weight_kg              numeric(10,2),
  -- Link al receipt CN original (opcional · facilita trazabilidad)
  source_receipt_cn_id   uuid references public.warehouse_receipts_cn(id) on delete set null,
  -- Estado del scan
  scanned_at             timestamptz,
  scanned_by_operario_id uuid references public.operario_pins(id) on delete set null,
  -- Si el escaneo fue manual (sin QR) por código entered a mano
  scanned_manual         boolean not null default false,
  created_at             timestamptz not null default now(),
  unique (receipt_id, code)
);

comment on table public.warehouse_receipt_ve_boxes is
  'Sprint E · cajas esperadas/escaneadas por un receipt VE. Pre-poblado al crear el receipt (boxes esperadas según manifest), updated al escanear. RLS por tenant_id.';

create index if not exists warehouse_receipt_ve_boxes_receipt_idx
  on public.warehouse_receipt_ve_boxes (receipt_id, scanned_at nulls first);

create index if not exists warehouse_receipt_ve_boxes_markbox_idx
  on public.warehouse_receipt_ve_boxes (tenant_id, markbox) where markbox is not null;

create index if not exists warehouse_receipt_ve_boxes_code_idx
  on public.warehouse_receipt_ve_boxes (tenant_id, code);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Code generator · next_receipt_ve_code                  ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.next_receipt_ve_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(receipt_code, '^WR-VE-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.warehouse_receipts_ve
  where tenant_id = p_tenant_id
    and receipt_code like 'WR-VE-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'WR-VE-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_receipt_ve_code(uuid) is
  'Sprint E · genera próximo receipt_code WR-VE-YYYY-NNNN para el tenant.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RLS · authenticated by tenant + service_role full      ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.warehouse_receipts_ve enable row level security;
alter table public.warehouse_receipt_ve_boxes enable row level security;

drop policy if exists "warehouse_receipts_ve by tenant" on public.warehouse_receipts_ve;
create policy "warehouse_receipts_ve by tenant"
  on public.warehouse_receipts_ve for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

drop policy if exists "warehouse_receipts_ve service_role full" on public.warehouse_receipts_ve;
create policy "warehouse_receipts_ve service_role full"
  on public.warehouse_receipts_ve for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "warehouse_receipt_ve_boxes by tenant" on public.warehouse_receipt_ve_boxes;
create policy "warehouse_receipt_ve_boxes by tenant"
  on public.warehouse_receipt_ve_boxes for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

drop policy if exists "warehouse_receipt_ve_boxes service_role full" on public.warehouse_receipt_ve_boxes;
create policy "warehouse_receipt_ve_boxes service_role full"
  on public.warehouse_receipt_ve_boxes for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.warehouse_receipts_ve to authenticated;
grant select, insert, update, delete on public.warehouse_receipt_ve_boxes to authenticated;
grant execute on function public.next_receipt_ve_code(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Trigger updated_at                                     ║
-- ╚═══════════════════════════════════════════════════════════╝

drop trigger if exists warehouse_receipts_ve_touch on public.warehouse_receipts_ve;
create trigger warehouse_receipts_ve_touch
  before update on public.warehouse_receipts_ve
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. operario_action · implementar scan_box + seal_reception║
-- ║    Replaza los stubs P0103/P0104 de 0066                  ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.operario_action(
  p_operario_id  uuid,
  p_action_type  text,
  p_payload      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operario       record;
  v_result         jsonb := '{}'::jsonb;
  v_receipt_id     uuid;
  v_box_code       text;
  v_box            record;
  v_receipt        record;
  v_force          boolean;
  v_scanned_count  int;
  v_expected_count int;
begin
  -- 1. Validar operario activo · obtener identidad
  select id, tenant_id, role, roles, region, active
    into v_operario
    from public.operario_pins
   where id = p_operario_id;

  if v_operario.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_operario.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Switch por action_type
  case p_action_type
    when 'edit_receipt' then
      raise exception 'edit_receipt branch pendiente · Sprint 1' using errcode = 'P0100';

    when 'reassign_od' then
      raise exception 'reassign_od branch pendiente · Sprint 2' using errcode = 'P0101';

    when 'partial_delivery' then
      raise exception 'partial_delivery branch pendiente · Sprint 3' using errcode = 'P0102';

    when 'scan_box' then
      -- ─────────────────────────────────────────────────────
      -- Sprint E · escanear caja del receipt VE
      -- Payload: { "receipt_id": "uuid", "code": "text", "manual": bool }
      -- ─────────────────────────────────────────────────────
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden escanear cajas' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite escanear cajas' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_box_code := nullif(trim(p_payload->>'code'), '');
      if v_receipt_id is null or v_box_code is null then
        raise exception 'Falta receipt_id o code' using errcode = 'P0110';
      end if;

      -- Receipt debe existir, pertenecer al tenant, no estar sellado
      select id, tenant_id, status, started_at
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya está sellado · no admite más escaneos' using errcode = 'P0112';
      end if;

      -- Buscar la caja por code (no es FK · es match por texto)
      select id, scanned_at
        into v_box
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id
         and code = v_box_code;
      if v_box.id is null then
        raise exception 'Caja % no figura en este receipt', v_box_code using errcode = 'P0113';
      end if;
      if v_box.scanned_at is not null then
        raise exception 'Caja % ya estaba escaneada', v_box_code using errcode = 'P0114';
      end if;

      -- Marcar como escaneada
      update public.warehouse_receipt_ve_boxes
         set scanned_at             = now(),
             scanned_by_operario_id = p_operario_id,
             scanned_manual         = coalesce((p_payload->>'manual')::boolean, false)
       where id = v_box.id;

      -- Si era el primer scan, mover el receipt a `recibiendo` + setear started_at
      if v_receipt.status = 'en_muelle' then
        update public.warehouse_receipts_ve
           set status      = 'recibiendo',
               started_at  = coalesce(started_at, now()),
               received_by_operario_id = coalesce(received_by_operario_id, p_operario_id)
         where id = v_receipt_id;
      end if;

      -- Audit log (sprint F)
      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt', v_receipt_id, 'operario', p_operario_id,
         'box_scanned',
         jsonb_build_object('code', v_box_code, 'manual', coalesce((p_payload->>'manual')::boolean, false)));

      -- Contar progreso
      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      v_result := jsonb_build_object(
        'ok', true,
        'box_id', v_box.id,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count
      );

    when 'seal_reception' then
      -- ─────────────────────────────────────────────────────
      -- Sprint E · sellar el receipt VE
      -- Payload: { "receipt_id": "uuid", "force": bool, "incident_note": "text" }
      -- ─────────────────────────────────────────────────────
      if v_operario.region <> 've' then
        raise exception 'Solo operarios VE pueden sellar receipts' using errcode = 'P0003';
      end if;
      if not (
        'bodeguero' = any(v_operario.roles) or
        'supervisor' = any(v_operario.roles)
      ) then
        raise exception 'Tu rol no permite sellar receipts' using errcode = 'P0004';
      end if;

      v_receipt_id := (p_payload->>'receipt_id')::uuid;
      v_force := coalesce((p_payload->>'force')::boolean, false);
      if v_receipt_id is null then
        raise exception 'Falta receipt_id' using errcode = 'P0110';
      end if;

      select id, tenant_id, status
        into v_receipt
        from public.warehouse_receipts_ve
       where id = v_receipt_id
         and tenant_id = v_operario.tenant_id
         and deleted_at is null;
      if v_receipt.id is null then
        raise exception 'Receipt no encontrado' using errcode = 'P0111';
      end if;
      if v_receipt.status = 'sellado' then
        raise exception 'Receipt ya estaba sellado' using errcode = 'P0112';
      end if;

      -- Contar progreso
      select count(*) filter (where scanned_at is not null),
             count(*)
        into v_scanned_count, v_expected_count
        from public.warehouse_receipt_ve_boxes
       where receipt_id = v_receipt_id;

      -- Si hay faltantes y NO se pasó force, abortar
      if v_scanned_count < v_expected_count and not v_force then
        raise exception 'Faltan % cajas por escanear · usá force=true si querés sellar con incidencia',
          (v_expected_count - v_scanned_count) using errcode = 'P0115';
      end if;

      -- Sellar: si hay diferencia, marcar incidencia
      update public.warehouse_receipts_ve
         set status                = case
                                       when v_scanned_count < v_expected_count then 'con_incidencia'
                                       else 'sellado'
                                     end,
             sealed_at             = now(),
             sealed_by_operario_id = p_operario_id,
             incident_note         = nullif(trim(coalesce(p_payload->>'incident_note', '')), '')
       where id = v_receipt_id;

      insert into public.entity_audit_log
        (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
      values
        (v_operario.tenant_id, 'warehouse_receipt', v_receipt_id, 'operario', p_operario_id,
         'sealed',
         jsonb_build_object(
           'scanned', v_scanned_count,
           'expected', v_expected_count,
           'force', v_force,
           'incident_note', p_payload->>'incident_note'
         ));

      v_result := jsonb_build_object(
        'ok', true,
        'scanned_count', v_scanned_count,
        'expected_count', v_expected_count,
        'status', case
                    when v_scanned_count < v_expected_count then 'con_incidencia'
                    else 'sellado'
                  end
      );

    else
      raise exception 'action_type % desconocido', p_action_type using errcode = 'P0105';
  end case;

  return v_result;
end;
$$;

comment on function public.operario_action(uuid, text, jsonb) is
  'Sprint F + E: RPC genérica mutaciones operario. Switch interno. Branches scan_box + seal_reception implementadas en Sprint E. SECURITY DEFINER + service_role only.';

revoke all on function public.operario_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.operario_action(uuid, text, jsonb) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Realtime publication para sync cross-cliente          ║
-- ║    (bodegueros viendo el progreso del mismo receipt)     ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Solo agregar si supabase_realtime existe (no en local sin Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Receipts (cambios de status)
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'warehouse_receipts_ve'
    ) then
      execute 'alter publication supabase_realtime add table public.warehouse_receipts_ve';
    end if;
    -- Boxes (scan events)
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'warehouse_receipt_ve_boxes'
    ) then
      execute 'alter publication supabase_realtime add table public.warehouse_receipt_ve_boxes';
    end if;
  end if;
end $$;
