-- ─────────────────────────────────────────────────────────────
-- SDD-0152 · Fase 1 — Identidad del bulto (warehouse_boxes)
--
-- Hoy NO existe un identificador único por caja física: la etiqueta lleva
-- "MARKBOX + Caja M/N" y el QR es un placeholder que no codifica datos
-- (app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx). Sin código
-- escaneable no hay escaneo, y sin escaneo no hay captura de estiba.
--
-- Esta migración materializa UNA FILA POR CAJA con un `code` único y
-- escaneable (DTD-B-NNNNNN). `warehouse_receipts_cn.boxes` sigue siendo el
-- CONTEO declarado por el operario — no se toca, no cambia de semántica; las
-- filas de warehouse_boxes se derivan de él vía trigger.
--
-- Decisiones:
--   · TRIGGER en vez de extender create_receipt_as_operario (0045). Es aditivo,
--     cubre TODAS las rutas que crean recepciones (operario CN, Studio, seed,
--     backfill) y no re-declara un RPC de ~150 líneas con riesgo de drift.
--   · El trigger RECONCILIA en update: si `boxes` sube, crea las que faltan; si
--     baja, soft-borra las de seq más alto que no estén estibadas. Nunca borra
--     una caja con historia.
--   · Correlativo MAX+1 por tenant (patrón next_markbox/next_receipt_code de
--     0006/0012). El UNIQUE (tenant_id, code) es la red ante TOCTOU: dos
--     recepciones concurrentes chocan y la tx pierde reintenta — mismo trato que
--     las 3 UNIQUE parciales de SDD-0110.
--   · Se crean cajas TAMBIÉN para huérfanas (is_orphan): el código identifica la
--     caja física aunque todavía no se sepa de quién es. El markbox se rellena
--     cuando se le asigne dueño.
--   · NO se capturan medidas (largo/ancho/alto): la estiba es POR ZONAS y no las
--     necesita. cbm/weight_kg quedan como snapshot opcional por caja.
--
-- Aditiva: NO altera tablas existentes. RLS fail-closed por tenant_id + GRANTS
-- explícitos (auto-expose OFF) + FK indexes. Reusa get_user_tenant_id() (0001),
-- touch_updated_at() (0002).
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Tabla · 1 fila = 1 caja física                         ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.warehouse_boxes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  receipt_id   uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  -- Lo que codifica el QR de la etiqueta. Único por tenant.
  code         text not null,
  -- M de N dentro del receipt (la "Caja 3/7" que ya se imprime hoy)
  seq          int  not null check (seq >= 1),
  -- Snapshot de identidad al momento de la recepción (igual que
  -- warehouse_receipt_ve_boxes de 0067). Nullable: las huérfanas no lo tienen.
  markbox      text,
  client_name  text,
  -- Snapshot opcional por caja. NO hay largo/ancho/alto: la estiba es por zonas.
  cbm          numeric(10,3) check (cbm is null or cbm >= 0),
  weight_kg    numeric(10,2) check (weight_kg is null or weight_kg >= 0),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint warehouse_boxes_tenant_code_key unique (tenant_id, code),
  constraint warehouse_boxes_receipt_seq_key unique (receipt_id, seq)
);

comment on table public.warehouse_boxes is
  'SDD-0152: 1 fila = 1 caja física recibida en CN, con code único escaneable (DTD-B-NNNNNN). Derivada de warehouse_receipts_cn.boxes vía trigger. Es lo que el QR de la etiqueta codifica y lo que el operario escanea al estibar. RLS por tenant_id.';

comment on column public.warehouse_boxes.code is
  'Código único por tenant (DTD-B-NNNNNN). Es el payload del QR de la etiqueta.';
comment on column public.warehouse_boxes.seq is
  'M de N dentro del receipt · el "Caja 3/7" impreso en la etiqueta.';

-- FK indexes + lookup del escaneo (code es el camino caliente)
create index if not exists warehouse_boxes_tenant_code_idx
  on public.warehouse_boxes (tenant_id, code) where deleted_at is null;

create index if not exists warehouse_boxes_receipt_idx
  on public.warehouse_boxes (receipt_id, seq) where deleted_at is null;

create index if not exists warehouse_boxes_tenant_markbox_idx
  on public.warehouse_boxes (tenant_id, markbox)
  where deleted_at is null and markbox is not null;

drop trigger if exists warehouse_boxes_touch on public.warehouse_boxes;
create trigger warehouse_boxes_touch
  before update on public.warehouse_boxes
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Helper same-tenant (lo consume la Fase 2)              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ¿La caja pertenece al tenant? NULL-safe: null → true (el trigger deja pasar;
-- la NOT NULL de la columna es la que exige valor).
create or replace function public.warehouse_box_in_tenant(
  p_box    uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_box is null then
    return true;
  end if;
  return exists (
    select 1 from public.warehouse_boxes
    where id = p_box and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

comment on function public.warehouse_box_in_tenant is
  'SDD-0152: ¿la caja warehouse_boxes pertenece al tenant? NULL-safe (null → true). Para el trigger same-tenant de consolidation_box_positions.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Materializar cajas de un receipt (idempotente)         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Crea las cajas que FALTAN para llegar a p_count, arrancando en el seq
-- siguiente al más alto vivo. Idempotente: llamarla dos veces no duplica.
-- Interna: la llama el trigger. NO valida tenant del caller — el caller (RPC de
-- operario o RLS del Studio) ya lo hizo; el operario no tiene auth.uid() así que
-- assert_tenant_match() NO aplica acá.
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

  -- ── Caso A · faltan cajas → crearlas ────────────────────────
  if v_have < coalesce(v_r.boxes, 0) then
    -- Base del correlativo: MAX+1 del tenant. El UNIQUE (tenant_id, code) es la
    -- red si dos recepciones corren a la vez (la perdedora reintenta).
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
      -- Reparto parejo del CBM/peso declarado entre las cajas del receipt.
      -- Es una estimación: el dato autoritativo sigue siendo el total del receipt.
      case when v_r.total_cbm is null or coalesce(v_r.boxes, 0) = 0 then null
           else round(v_r.total_cbm / v_r.boxes, 3) end,
      case when v_r.total_weight_kg is null or coalesce(v_r.boxes, 0) = 0 then null
           else round(v_r.total_weight_kg / v_r.boxes, 2) end
    from generate_series(1, v_r.boxes - v_have) as g(i);

    v_created := v_r.boxes - v_have;

  -- ── Caso B · sobran cajas → soft-borrar las de seq más alto ─
  -- En 0240 no hay estiba posible todavía (consolidation_box_positions nace en
  -- 0241), así que acá el borrado es directo. 0241 hace CREATE OR REPLACE de
  -- esta función para agregar el guard "nunca borres una caja ya estibada".
  elsif v_have > coalesce(v_r.boxes, 0) then
    v_excess := v_have - coalesce(v_r.boxes, 0);
    update public.warehouse_boxes
       set deleted_at = now()
     where id in (
       select b2.id
         from public.warehouse_boxes b2
        where b2.receipt_id = p_receipt_id
          and b2.deleted_at is null
        order by b2.seq desc
        limit v_excess
     );
  end if;

  return v_created;
end;
$$;

comment on function public.sync_boxes_for_receipt is
  'SDD-0152: materializa/reconcilia las filas de warehouse_boxes de un receipt CN contra su conteo `boxes`. Idempotente. La llama el trigger; no valida tenant del caller (el operario no tiene auth.uid()).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Trigger · cubre TODAS las rutas de creación            ║
-- ╚═══════════════════════════════════════════════════════════╝
create or replace function public.warehouse_receipts_cn_sync_boxes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_boxes_for_receipt(new.id);
  return new;
end;
$$;

comment on function public.warehouse_receipts_cn_sync_boxes is
  'SDD-0152: trigger AFTER de warehouse_receipts_cn → sincroniza warehouse_boxes. Aditivo: no re-declara create_receipt_as_operario (0045).';

drop trigger if exists warehouse_receipts_cn_sync_boxes_ins on public.warehouse_receipts_cn;
create trigger warehouse_receipts_cn_sync_boxes_ins
  after insert on public.warehouse_receipts_cn
  for each row execute function public.warehouse_receipts_cn_sync_boxes();

-- Solo cuando cambia el conteo o la identidad del cliente (evita ruido en cada
-- update de status/notes).
drop trigger if exists warehouse_receipts_cn_sync_boxes_upd on public.warehouse_receipts_cn;
create trigger warehouse_receipts_cn_sync_boxes_upd
  after update of boxes on public.warehouse_receipts_cn
  for each row
  when (old.boxes is distinct from new.boxes)
  execute function public.warehouse_receipts_cn_sync_boxes();

-- Cuando a una huérfana le asignan dueño, propagar el markbox a sus cajas.
create or replace function public.warehouse_receipts_cn_sync_box_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.warehouse_boxes
     set markbox     = new.client_markbox,
         client_name = new.client_name
   where receipt_id = new.id
     and deleted_at is null;
  return new;
end;
$$;

drop trigger if exists warehouse_receipts_cn_sync_identity on public.warehouse_receipts_cn;
create trigger warehouse_receipts_cn_sync_identity
  after update of client_markbox, client_name on public.warehouse_receipts_cn
  for each row
  when (old.client_markbox is distinct from new.client_markbox
        or old.client_name is distinct from new.client_name)
  execute function public.warehouse_receipts_cn_sync_box_identity();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RLS + GRANTS (auto-expose OFF → explícitos)            ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.warehouse_boxes enable row level security;

-- Studio (authenticated): solo su tenant, solo vivas.
drop policy if exists "warehouse_boxes by tenant" on public.warehouse_boxes;
create policy "warehouse_boxes by tenant"
  on public.warehouse_boxes for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

grant select, insert, update, delete on public.warehouse_boxes to authenticated;

-- El operario NO es authenticated: entra por service_role vía RPC.
grant select, insert, update, delete on public.warehouse_boxes to service_role;

revoke execute on function public.sync_boxes_for_receipt(uuid) from public, anon, authenticated;
revoke execute on function public.warehouse_box_in_tenant(uuid, uuid) from public, anon;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Backfill · cajas de las recepciones que ya existen     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Idempotente (sync_boxes_for_receipt solo crea lo que falta). Sin esto, la
-- carga que YA está en los hubs no se puede escanear ni estibar.
do $$
declare
  v_r      record;
  v_total  int := 0;
begin
  for v_r in
    select id from public.warehouse_receipts_cn
     where deleted_at is null and coalesce(boxes, 0) > 0
     order by received_at asc
  loop
    v_total := v_total + public.sync_boxes_for_receipt(v_r.id);
  end loop;
  raise notice 'SDD-0152 backfill · cajas creadas: %', v_total;
end;
$$;
