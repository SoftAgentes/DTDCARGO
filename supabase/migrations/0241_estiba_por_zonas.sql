-- ─────────────────────────────────────────────────────────────
-- SDD-0152 · Fase 2 — Zonas del contenedor + captura de estiba
--
-- Registra DÓNDE quedó realmente cada bulto dentro del contenedor. El operario
-- en CN escanea la caja al subirla y tapea la zona; acá vive ese dato.
--
-- Modelo por ZONAS, no por coordenadas: el contenedor es una grilla gruesa
-- (default 3 tramos de largo × 3 de ancho × 2 de altura = 18 zonas). Decisión
-- del founder. Consecuencia: NO se miden bultos (largo/ancho/alto) y NO hace
-- falta motor de bin-packing — que es justo lo caro de las herramientas del
-- mercado (SeaRates, EasyCargo, CubeMaster…), todas planificadores teóricos que
-- resuelven el problema inverso (optimizar ANTES) y no capturan la realidad.
--
-- Decisiones:
--   · RPC PROPIO (stuff_box_as_operario) en vez de un branch nuevo en
--     operario_action. Esa función mide 16.727 chars y ya fue re-declarada en 6
--     migraciones (0066→0072): cada branch nuevo copia el cuerpo entero. Una 7ª
--     copia arriesga revertir en silencio cualquier fix que solo viva en prod
--     (ya pasó con el RPC de invitar). El patrón *_as_operario es el mayoritario
--     del repo (create_receipt_as_operario, camionero_pod, bodeguero_advance_od)
--     y está documentado en app/m/CLAUDE.md. Aditivo, cero drift.
--   · El evento igual va a entity_audit_log ('box_stuffed'/'box_unstuffed'), así
--     que la trazabilidad queda unificada con el resto del flujo operario.
--   · Una caja tiene UNA posición viva: UNIQUE parcial where unstuffed_at is
--     null. Corregir = unstuff + stuff (deja las dos filas en la historia).
--   · zx/zy/zz son la verdad; zone_code es generado para leerlo en logs.
--   · Los límites de la grilla se validan contra container_types.zone_layout en
--     el RPC (es cross-tabla; un CHECK no puede).
--
-- Aditiva salvo el ADD COLUMN de container_types (con default → no reescribe).
-- RLS fail-closed por tenant + helpers *_in_tenant() + trigger same-tenant +
-- GRANTS explícitos + FK indexes.
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. La grilla de zonas, por tipo de contenedor             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- nx = tramos a lo largo (fondo→puerta) · ny = niveles de altura (piso→arriba)
-- nz = tramos a lo ancho (izq→der). Configurable por tenant y tipo: un 20GP
-- podría querer nx=2.
alter table public.container_types
  add column if not exists zone_layout jsonb not null
  default '{"nx": 3, "ny": 2, "nz": 3}'::jsonb;

alter table public.container_types
  drop constraint if exists container_types_zone_layout_shape;
alter table public.container_types
  add constraint container_types_zone_layout_shape check (
    (zone_layout->>'nx')::int between 1 and 10 and
    (zone_layout->>'ny')::int between 1 and 6  and
    (zone_layout->>'nz')::int between 1 and 6
  );

comment on column public.container_types.zone_layout is
  'SDD-0152: grilla de zonas del contenedor {nx,ny,nz}. nx=largo (fondo→puerta), ny=altura (piso→arriba), nz=ancho (izq→der). Default 3×2×3 = 18 zonas.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1b. entity_audit_log admite 'consolidation'               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- entity_type tiene lista blanca por CHECK y 'consolidation' NO estaba: sin
-- esto, cada escaneo revienta con violación de constraint. Es la misma trampa
-- que 0072_fix_audit_entity_type. Se re-declara la lista COMPLETA (verificada
-- contra prod el 2026-07-16) + el valor nuevo.
alter table public.entity_audit_log
  drop constraint if exists entity_audit_log_entity_type_check;
alter table public.entity_audit_log
  add constraint entity_audit_log_entity_type_check check (
    entity_type = any (array[
      'shipment', 'dispatch_order', 'dispatch_order_package',
      'warehouse_receipt_cn', 'warehouse_receipt_ve',
      'invoice', 'journal_entry', 'account', 'payment_receipt',
      'supplier', 'supplier_bill', 'supplier_payment',
      'purchase_order', 'sales_order',
      'consolidation'                                   -- ← SDD-0152
    ])
  );

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Helper same-tenant de consolidación                    ║
-- ╚═══════════════════════════════════════════════════════════╝
create or replace function public.consolidation_in_tenant(
  p_consolidation uuid,
  p_tenant        uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_consolidation is null then
    return true;
  end if;
  return exists (
    select 1 from public.consolidations
    where id = p_consolidation and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

comment on function public.consolidation_in_tenant is
  'SDD-0152: ¿la consolidación pertenece al tenant? NULL-safe (null → true).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. La tabla de realidad                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.consolidation_box_positions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  consolidation_id    uuid not null references public.consolidations(id) on delete cascade,
  box_id              uuid not null references public.warehouse_boxes(id) on delete cascade,
  -- Coordenada de zona (0-indexed). La verdad.
  zx                  smallint not null check (zx >= 0),   -- largo: 0=fondo … n-1=puerta
  zy                  smallint not null check (zy >= 0),   -- altura: 0=piso … n-1=arriba
  zz                  smallint not null check (zz >= 0),   -- ancho: 0=izq … n-1=der
  -- Legible en logs/debug. Derivado, nunca se teclea.
  zone_code           text generated always as
                        ('L' || zx || '-H' || zy || '-W' || zz) stored,
  -- Orden en que se fue cargando (1, 2, 3… dentro de la consolidación)
  seq                 int not null check (seq >= 1),
  stuffed_at          timestamptz not null default now(),
  stuffed_by_operario_id uuid references public.operario_pins(id) on delete set null,
  stuffed_manual      boolean not null default false,
  -- Sacar la caja = cerrar la fila, no borrarla (la historia queda)
  unstuffed_at        timestamptz,
  unstuffed_by_operario_id uuid references public.operario_pins(id) on delete set null,
  created_at          timestamptz not null default now()
);

comment on table public.consolidation_box_positions is
  'SDD-0152: dónde quedó REALMENTE cada caja dentro del contenedor. Escrito por el operario CN al escanear y tapear la zona. Captura de realidad, no plan teórico. RLS por tenant_id.';

-- Una caja no puede estar en dos lugares a la vez.
create unique index if not exists consolidation_box_positions_live_box_key
  on public.consolidation_box_positions (box_id)
  where unstuffed_at is null;

-- Orden de carga único dentro de la consolidación (mientras esté viva).
create unique index if not exists consolidation_box_positions_live_seq_key
  on public.consolidation_box_positions (consolidation_id, seq)
  where unstuffed_at is null;

create index if not exists consolidation_box_positions_consol_idx
  on public.consolidation_box_positions (consolidation_id)
  where unstuffed_at is null;

create index if not exists consolidation_box_positions_tenant_idx
  on public.consolidation_box_positions (tenant_id, consolidation_id);

-- FK index (el UNIQUE parcial no cubre las filas cerradas)
create index if not exists consolidation_box_positions_box_idx
  on public.consolidation_box_positions (box_id);

-- Trigger same-tenant: defensa en DB para los FK cruzados (patrón 0102/0111)
create or replace function public.consolidation_box_positions_same_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.consolidation_in_tenant(new.consolidation_id, new.tenant_id) then
    raise exception 'La consolidación % no pertenece al tenant %',
      new.consolidation_id, new.tenant_id using errcode = '42501';
  end if;
  if not public.warehouse_box_in_tenant(new.box_id, new.tenant_id) then
    raise exception 'La caja % no pertenece al tenant %',
      new.box_id, new.tenant_id using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists consolidation_box_positions_same_tenant_trg
  on public.consolidation_box_positions;
create trigger consolidation_box_positions_same_tenant_trg
  before insert or update on public.consolidation_box_positions
  for each row execute function public.consolidation_box_positions_same_tenant();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Estibar · el operario escanea y tapea la zona          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El operario NO tiene auth.uid() → service_role only, tenant resuelto desde
-- operario_pins (mismo trato que create_receipt_as_operario).
create or replace function public.stuff_box_as_operario(
  p_operario_id      uuid,
  p_consolidation_id uuid,
  p_code             text,
  p_zx               int,
  p_zy               int,
  p_zz               int,
  p_manual           boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op        record;
  v_consol    record;
  v_layout    jsonb;
  v_box       record;
  v_live      record;
  v_seq       int;
  v_stuffed   int;
  v_total     int;
begin
  -- 1. Operario activo · resolver tenant
  select id, tenant_id, region, roles, active
    into v_op
    from public.operario_pins
   where id = p_operario_id;

  if v_op.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_op.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_op.region <> 'cn' then
    raise exception 'Solo operarios CN pueden estibar' using errcode = 'P0003';
  end if;

  -- 2. Consolidación viva, del tenant, todavía abierta
  select c.id, c.tenant_id, c.status, c.container_type
    into v_consol
    from public.consolidations c
   where c.id = p_consolidation_id
     and c.tenant_id = v_op.tenant_id
     and c.deleted_at is null;

  if v_consol.id is null then
    raise exception 'Consolidación no encontrada' using errcode = 'P0120';
  end if;
  if v_consol.status <> 'consolidando' then
    raise exception 'La consolidación está en % · solo se estiba mientras consolida',
      v_consol.status using errcode = 'P0121';
  end if;

  -- 3. Zona dentro de la grilla del tipo de contenedor
  select ct.zone_layout into v_layout
    from public.container_types ct
   where ct.tenant_id = v_op.tenant_id
     and ct.code = v_consol.container_type;

  if v_layout is null then
    raise exception 'El tipo de contenedor % no tiene grilla de zonas',
      v_consol.container_type using errcode = 'P0122';
  end if;
  if p_zx is null or p_zy is null or p_zz is null
     or p_zx < 0 or p_zx >= (v_layout->>'nx')::int
     or p_zy < 0 or p_zy >= (v_layout->>'ny')::int
     or p_zz < 0 or p_zz >= (v_layout->>'nz')::int then
    raise exception 'Zona (%,%,%) fuera de la grilla %', p_zx, p_zy, p_zz, v_layout
      using errcode = 'P0123';
  end if;

  -- 4. La caja existe y es del tenant
  select b.id, b.code, b.markbox, b.client_name
    into v_box
    from public.warehouse_boxes b
   where b.tenant_id = v_op.tenant_id
     and b.code = nullif(trim(p_code), '')
     and b.deleted_at is null;

  if v_box.id is null then
    raise exception 'La caja % no existe', p_code using errcode = 'P0124';
  end if;

  -- 5. ¿Ya estaba estibada?
  select p.id, p.consolidation_id, p.zone_code
    into v_live
    from public.consolidation_box_positions p
   where p.box_id = v_box.id and p.unstuffed_at is null;

  if v_live.id is not null then
    if v_live.consolidation_id = p_consolidation_id then
      raise exception 'La caja % ya está estibada en la zona %', p_code, v_live.zone_code
        using errcode = 'P0125';
    else
      raise exception 'La caja % ya está estibada en otro contenedor', p_code
        using errcode = 'P0126';
    end if;
  end if;

  -- 6. Registrar. El UNIQUE parcial (consolidation_id, seq) es la red si dos
  --    operarios estiban a la vez: el perdedor reintenta.
  select coalesce(max(seq), 0) + 1 into v_seq
    from public.consolidation_box_positions
   where consolidation_id = p_consolidation_id and unstuffed_at is null;

  insert into public.consolidation_box_positions (
    tenant_id, consolidation_id, box_id, zx, zy, zz, seq,
    stuffed_by_operario_id, stuffed_manual
  ) values (
    v_op.tenant_id, p_consolidation_id, v_box.id, p_zx, p_zy, p_zz, v_seq,
    p_operario_id, coalesce(p_manual, false)
  );

  insert into public.entity_audit_log
    (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
  values
    (v_op.tenant_id, 'consolidation', p_consolidation_id, 'operario', p_operario_id,
     'box_stuffed',
     jsonb_build_object(
       'code', v_box.code, 'markbox', v_box.markbox,
       'zx', p_zx, 'zy', p_zy, 'zz', p_zz,
       'seq', v_seq, 'manual', coalesce(p_manual, false)
     ));

  -- 7. Progreso: cuántas de las cajas asignadas a este contenedor ya están.
  select count(*) into v_stuffed
    from public.consolidation_box_positions
   where consolidation_id = p_consolidation_id and unstuffed_at is null;

  select coalesce(sum(ci.pieces), 0) into v_total
    from public.consolidation_items ci
   where ci.consolidation_id = p_consolidation_id;

  return jsonb_build_object(
    'ok', true,
    'box_id', v_box.id,
    'code', v_box.code,
    'markbox', v_box.markbox,
    'client_name', v_box.client_name,
    'zone_code', 'L' || p_zx || '-H' || p_zy || '-W' || p_zz,
    'seq', v_seq,
    'stuffed_count', v_stuffed,
    'expected_count', v_total
  );
end;
$$;

comment on function public.stuff_box_as_operario is
  'SDD-0152: el operario CN escanea una caja y marca en qué zona del contenedor la puso. Valida grilla contra container_types.zone_layout. Escribe entity_audit_log box_stuffed. Service_role only (el operario no tiene auth.uid()).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Des-estibar · corregir sin perder la historia          ║
-- ╚═══════════════════════════════════════════════════════════╝
create or replace function public.unstuff_box_as_operario(
  p_operario_id uuid,
  p_code        text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op      record;
  v_box     record;
  v_live    record;
  v_stuffed int;
begin
  select id, tenant_id, region, active into v_op
    from public.operario_pins where id = p_operario_id;

  if v_op.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_op.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_op.region <> 'cn' then
    raise exception 'Solo operarios CN pueden estibar' using errcode = 'P0003';
  end if;

  select b.id, b.code into v_box
    from public.warehouse_boxes b
   where b.tenant_id = v_op.tenant_id
     and b.code = nullif(trim(p_code), '')
     and b.deleted_at is null;

  if v_box.id is null then
    raise exception 'La caja % no existe', p_code using errcode = 'P0124';
  end if;

  select p.id, p.consolidation_id, p.zone_code into v_live
    from public.consolidation_box_positions p
   where p.box_id = v_box.id and p.unstuffed_at is null;

  if v_live.id is null then
    raise exception 'La caja % no está estibada', p_code using errcode = 'P0127';
  end if;

  update public.consolidation_box_positions
     set unstuffed_at = now(),
         unstuffed_by_operario_id = p_operario_id
   where id = v_live.id;

  insert into public.entity_audit_log
    (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload)
  values
    (v_op.tenant_id, 'consolidation', v_live.consolidation_id, 'operario', p_operario_id,
     'box_unstuffed',
     jsonb_build_object('code', v_box.code, 'zone_code', v_live.zone_code));

  select count(*) into v_stuffed
    from public.consolidation_box_positions
   where consolidation_id = v_live.consolidation_id and unstuffed_at is null;

  return jsonb_build_object(
    'ok', true,
    'code', v_box.code,
    'consolidation_id', v_live.consolidation_id,
    'stuffed_count', v_stuffed
  );
end;
$$;

comment on function public.unstuff_box_as_operario is
  'SDD-0152: saca una caja de su zona (cierra la fila, no la borra). Escribe entity_audit_log box_unstuffed.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Endurecer sync_boxes_for_receipt (0240)                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Ahora que consolidation_box_positions existe: nunca soft-borrar una caja con
-- historia de estiba. Si el operario baja el conteo con carga adentro, es una
-- incidencia que se resuelve a mano — no un delete silencioso.
create or replace function public.sync_boxes_for_receipt(
  p_receipt_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r        record;
  v_have     int;
  v_max_seq  int;
  v_base     int;
  v_created  int := 0;
  v_excess   int;
begin
  select id, tenant_id, boxes, client_markbox, client_name, total_cbm,
         total_weight_kg, deleted_at
    into v_r
    from public.warehouse_receipts_cn
   where id = p_receipt_id;

  if v_r.id is null or v_r.deleted_at is not null then
    return 0;
  end if;

  select count(*), coalesce(max(seq), 0)
    into v_have, v_max_seq
    from public.warehouse_boxes
   where receipt_id = p_receipt_id and deleted_at is null;

  if v_have < coalesce(v_r.boxes, 0) then
    select coalesce(max((regexp_match(code, '^DTD-B-(\d+)$'))[1]::int), 0) + 1
      into v_base
      from public.warehouse_boxes
     where tenant_id = v_r.tenant_id;

    insert into public.warehouse_boxes (
      tenant_id, receipt_id, code, seq, markbox, client_name, cbm, weight_kg
    )
    select
      v_r.tenant_id,
      p_receipt_id,
      'DTD-B-' || lpad((v_base + g.i - 1)::text, 6, '0'),
      v_max_seq + g.i,
      v_r.client_markbox,
      v_r.client_name,
      case when v_r.total_cbm is null or coalesce(v_r.boxes, 0) = 0 then null
           else round(v_r.total_cbm / v_r.boxes, 3) end,
      case when v_r.total_weight_kg is null or coalesce(v_r.boxes, 0) = 0 then null
           else round(v_r.total_weight_kg / v_r.boxes, 2) end
    from generate_series(1, v_r.boxes - v_have) as g(i);

    v_created := v_r.boxes - v_have;

  elsif v_have > coalesce(v_r.boxes, 0) then
    v_excess := v_have - coalesce(v_r.boxes, 0);
    update public.warehouse_boxes
       set deleted_at = now()
     where id in (
       select b2.id
         from public.warehouse_boxes b2
        where b2.receipt_id = p_receipt_id
          and b2.deleted_at is null
          -- ← el guard nuevo: la que tiene historia de estiba no se toca
          and not exists (
            select 1 from public.consolidation_box_positions p
             where p.box_id = b2.id
          )
        order by b2.seq desc
        limit v_excess
     );
  end if;

  return v_created;
end;
$$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RLS + GRANTS (auto-expose OFF → explícitos)            ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.consolidation_box_positions enable row level security;

drop policy if exists "consolidation_box_positions by tenant"
  on public.consolidation_box_positions;
create policy "consolidation_box_positions by tenant"
  on public.consolidation_box_positions for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

grant select, insert, update, delete on public.consolidation_box_positions to authenticated;
grant select, insert, update, delete on public.consolidation_box_positions to service_role;

revoke execute on function public.stuff_box_as_operario(uuid, uuid, text, int, int, int, boolean)
  from public, anon, authenticated;
revoke execute on function public.unstuff_box_as_operario(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.consolidation_in_tenant(uuid, uuid) from public, anon;
