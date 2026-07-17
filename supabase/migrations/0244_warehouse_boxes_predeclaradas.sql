-- 0244 · SDD-0153 · Cajas pre-declaradas: la caja nace con el aviso, no con la recepción
--
-- EL PROBLEMA QUE CIERRA
--   Hoy `warehouse_boxes.receipt_id` es NOT NULL (0240:45) → una caja NO PUEDE
--   existir antes de llegar al almacén. Por eso el operario en Yiwu no tiene contra
--   qué escanear y tipea los 4 pasos de /m/cn/nueva: no es que falte la pantalla,
--   es que no hay nada contra qué comparar. Venezuela sí escanea porque recibe
--   contra una lista que ya existe (`warehouse_receipt_ve_boxes`, 0067:12 —
--   "pre-poblado al crear el receipt según manifest, updated al escanear").
--
-- QUÉ HACE ESTA MIGRACIÓN
--   Solo la FUNDACIÓN: que una caja pueda existir `esperada`, con su
--   `DTD-B-NNNNNN` definitivo, desde que el cliente anuncia la prealerta (0105).
--   El proveedor imprime ESA etiqueta y la pega.
--
-- QUÉ **NO** HACE — y por qué
--   No toca `sync_boxes_for_receipt`. La ADOPCIÓN (esperada → recibida) va en
--   SDD-0154 junto con el escaneo, no acá. Motivo concreto, verificado:
--   `create_receipt_as_operario` (0045) NO recibe `prealerta_id` — el único camino
--   que lo setea es un UPDATE aparte y POSTERIOR al insert
--   (`app/studio/(app)/cn/actions.ts:257`). Los triggers de 0240:226-238 son
--   `after insert` y `after update OF boxes`: cuando corren, `prealerta_id` todavía
--   es NULL. Una adopción dentro del trigger sería código muerto que además
--   colisionaría en `seq` cuando sí llegara a correr. La adopción tiene que ser un
--   ACTO explícito del operario (escanear), no un efecto colateral.
--
-- LO QUE NO ROMPE
--   · Las 99 cajas que ya existen quedan 'recibida' con prealerta_id NULL.
--   · La recepción sin aviso sigue creando sus cajas al vuelo, igual que hoy — y
--     medido el 17-jul es el 100% de la realidad: de 6 recepciones en prod, 0
--     tienen prealerta_id. Pre-declarar es el camino nuevo, no el único.
--   · Los codes `DTD-B-NNNNNN` siguen siendo MAX+1 por tenant y jamás se reusan.

-- ── 1. Estructura ─────────────────────────────────────────────

-- El bloqueador estructural: sin esto no hay pre-declaración posible.
alter table public.warehouse_boxes
  alter column receipt_id drop not null;

alter table public.warehouse_boxes
  add column if not exists prealerta_id uuid references public.prealertas(id) on delete cascade;

-- Las filas que ya existen nacieron de una recepción → 'recibida'. El default
-- entra ANTES que el CHECK, así que ninguna fila viva puede violarlo.
alter table public.warehouse_boxes
  add column if not exists status text not null default 'recibida';

alter table public.warehouse_boxes
  drop constraint if exists warehouse_boxes_status_check;
alter table public.warehouse_boxes
  add constraint warehouse_boxes_status_check
  check (status in ('esperada', 'recibida'));

-- Una caja tiene que colgar de ALGO: o del aviso que la anunció, o del receipt
-- que la materializó. Sin esto, borrar una prealerta dejaría zombis.
alter table public.warehouse_boxes
  drop constraint if exists warehouse_boxes_origen_check;
alter table public.warehouse_boxes
  add constraint warehouse_boxes_origen_check
  check (receipt_id is not null or prealerta_id is not null);

-- `status` y `receipt_id` no pueden contradecirse: 'esperada' = todavía no llegó.
alter table public.warehouse_boxes
  drop constraint if exists warehouse_boxes_status_receipt_check;
alter table public.warehouse_boxes
  add constraint warehouse_boxes_status_receipt_check
  check (
    (status = 'esperada' and receipt_id is null) or
    (status = 'recibida' and receipt_id is not null)
  );

-- El seq de 0243 sólo cubre las recibidas (receipt_id NOT NULL). Entre las
-- esperadas `receipt_id` es NULL, y en Postgres los NULL no colisionan en un
-- índice único → sin esto nada impide dos "caja 3" en la misma prealerta.
create unique index if not exists warehouse_boxes_prealerta_seq_live_key
  on public.warehouse_boxes (prealerta_id, seq)
  where prealerta_id is not null and deleted_at is null;

-- El índice del escaneo en recepción (SDD-0154): "dame las esperadas del tenant".
create index if not exists warehouse_boxes_esperadas_idx
  on public.warehouse_boxes (tenant_id, status)
  where status = 'esperada' and deleted_at is null;

comment on column public.warehouse_boxes.prealerta_id is
  'SDD-0153: la prealerta que ANUNCIÓ esta caja. Se setea al pre-declarar (antes de que la caja exista físicamente) y sobrevive a la recepción — es lo que ata la etiqueta impresa por el proveedor con la caja recibida. NULL = caja nacida de una recepción sin aviso previo.';

comment on column public.warehouse_boxes.status is
  'SDD-0153: esperada = anunciada por la prealerta, etiqueta impresa, todavía no llegó a Yiwu. recibida = está físicamente en el almacén. Invariante en constraint: esperada ⇔ receipt_id IS NULL.';

-- ── 2. Pre-declarar: la prealerta pare las cajas ──────────────

create or replace function public.sync_boxes_for_prealerta(p_prealerta_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p       record;
  v_have    int;
  v_max_seq int;
  v_base    int;
  v_created int := 0;
  v_excess  int;
begin
  select id, tenant_id, client_markbox, boxes, status, deleted_at
    into v_p
    from public.prealertas
   where id = p_prealerta_id;

  if v_p.id is null or v_p.deleted_at is not null then
    return 0;
  end if;

  -- Cancelada → sus etiquetas no siguen vivas. Se van SOLO las que nunca
  -- llegaron: si una caja ya se recibió, cancelar el aviso no la desaparece del
  -- galpón. El guard de estiba protege igual (ver Caso B).
  if v_p.status = 'cancelada' then
    update public.warehouse_boxes
       set deleted_at = now()
     where prealerta_id = p_prealerta_id
       and deleted_at is null
       and status = 'esperada'
       and receipt_id is null
       and not exists (
         select 1 from public.consolidation_box_positions p
          where p.box_id = public.warehouse_boxes.id
       );
    return 0;
  end if;

  select count(*), coalesce(max(seq), 0)
    into v_have, v_max_seq
    from public.warehouse_boxes
   where prealerta_id = p_prealerta_id and deleted_at is null;

  -- Caso A · faltan cajas → crearlas 'esperada' con su code definitivo.
  if v_have < coalesce(v_p.boxes, 0) then
    -- MAX+1 por tenant SIN filtrar deleted_at: los codes jamás se reusan, porque
    -- una etiqueta ya impresa apuntaría a la caja equivocada. La red anti-TOCTOU
    -- es warehouse_boxes_tenant_code_key: dos concurrentes chocan y una reintenta.
    select coalesce(max((regexp_match(code, '^DTD-B-(\d+)$'))[1]::int), 0) + 1
      into v_base
      from public.warehouse_boxes
     where tenant_id = v_p.tenant_id;

    insert into public.warehouse_boxes (
      tenant_id, receipt_id, prealerta_id, status, code, seq, markbox, client_name
    )
    select
      v_p.tenant_id,
      null,                       -- todavía no llegó
      p_prealerta_id,
      'esperada',
      'DTD-B-' || lpad((v_base + g.i - 1)::text, 6, '0'),
      v_max_seq + g.i,
      v_p.client_markbox,
      -- Si el cliente no está en `clients`, la etiqueta igual sirve: lleva el
      -- MARKBOX, que es el identificador real.
      (select c.name from public.clients c
        where c.tenant_id = v_p.tenant_id
          and c.markbox = v_p.client_markbox
        limit 1)
    from generate_series(1, v_p.boxes - v_have) as g(i);

    v_created := v_p.boxes - v_have;

  -- Caso B · sobran → soft-delete SOLO de las que todavía no llegaron. Una caja
  -- recibida no se borra por bajarle el conteo al aviso: llegó de verdad y su
  -- etiqueta está pegada a un cartón físico.
  --
  -- El `not exists` sobre consolidation_box_positions es el mismo guard que 0241
  -- puso en sync_boxes_for_receipt. Acá no debería poder dispararse nunca (el
  -- trigger de la sección 3 impide estibar una caja no recibida), pero el modo de
  -- falla que evita es feo — caja soft-borrada mientras está estibada, que
  -- `unstuff_box_as_operario` ya no encuentra → carga inamovible del contenedor.
  elsif v_have > coalesce(v_p.boxes, 0) then
    v_excess := v_have - coalesce(v_p.boxes, 0);

    update public.warehouse_boxes
       set deleted_at = now()
     where id in (
       select b.id
         from public.warehouse_boxes b
        where b.prealerta_id = p_prealerta_id
          and b.deleted_at is null
          and b.status = 'esperada'
          and b.receipt_id is null
          and not exists (
            select 1 from public.consolidation_box_positions p
             where p.box_id = b.id
          )
        order by b.seq desc
        limit v_excess
     );
  end if;

  return v_created;
end;
$$;

comment on function public.sync_boxes_for_prealerta(uuid) is
  'SDD-0153: idempotente. Alinea las cajas esperadas de una prealerta con su conteo `boxes`. Crea las que faltan con code definitivo (para que el proveedor imprima la etiqueta real) y soft-borra las sobrantes SOLO si todavía no llegaron ni están estibadas. Nunca toca una caja recibida.';

create or replace function public.prealertas_sync_boxes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_boxes_for_prealerta(new.id);
  return new;
end;
$$;

drop trigger if exists prealertas_sync_boxes_ins on public.prealertas;
create trigger prealertas_sync_boxes_ins
  after insert on public.prealertas
  for each row execute function public.prealertas_sync_boxes();

drop trigger if exists prealertas_sync_boxes_upd on public.prealertas;
create trigger prealertas_sync_boxes_upd
  after update of boxes, status on public.prealertas
  for each row
  when (old.boxes is distinct from new.boxes
        or (old.status is distinct from new.status and new.status = 'cancelada'))
  execute function public.prealertas_sync_boxes();

-- ── 3. No se estiba lo que no llegó ──────────────────────────
--
-- Agujero que ABRE esta migración: hasta hoy toda caja de warehouse_boxes estaba
-- recibida por construcción (receipt_id NOT NULL), así que
-- `stuff_box_as_operario` (0241) busca por code SIN mirar status. Con cajas
-- 'esperada' en la tabla, un operario podría escanear la etiqueta de una caja que
-- nunca llegó y estibarla.
--
-- Se cierra con un trigger sobre la tabla y no re-declarando el RPC: protege el
-- invariante venga por donde venga (RPC, backfill, un fix manual futuro) y evita
-- el drift de re-declarar ~120 líneas.

create or replace function public.consolidation_box_positions_require_recibida()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_box record;
begin
  select code, status into v_box
    from public.warehouse_boxes
   where id = new.box_id;

  if v_box.status is distinct from 'recibida' then
    raise exception 'La caja % todavía no se recibió en el almacén · no se puede estibar',
      coalesce(v_box.code, new.box_id::text) using errcode = 'P0128';
  end if;

  return new;
end;
$$;

drop trigger if exists consolidation_box_positions_require_recibida_ins
  on public.consolidation_box_positions;
create trigger consolidation_box_positions_require_recibida_ins
  before insert on public.consolidation_box_positions
  for each row execute function public.consolidation_box_positions_require_recibida();

-- ── 4. RLS · el cliente ve sus cajas esperadas ────────────────
--
-- Sin esto el portal no puede imprimir la etiqueta: la política de 0240 es
-- `get_user_tenant_id()` (staff del Studio) y el cliente del portal no es staff.
-- Fail-closed: para un usuario staff `get_portal_client_tenant()` devuelve NULL →
-- `tenant_id = NULL` → NULL → la fila no pasa.
--
-- El proveedor en /p/[token] no necesita política: esa ruta resuelve el token con
-- service_role (es un visitante anónimo, sin sesión).

drop policy if exists "warehouse_boxes portal self read" on public.warehouse_boxes;
create policy "warehouse_boxes portal self read"
  on public.warehouse_boxes
  for select
  to authenticated
  using (
    tenant_id = public.get_portal_client_tenant()
    and markbox = public.get_portal_client_markbox()
    and deleted_at is null
  );

-- ── 5. Backfill · las prealertas vivas paren sus etiquetas ────
--
-- Idempotente por construcción (sync_boxes_for_prealerta cuenta antes de crear):
-- correrlo dos veces no duplica nada. Medido en prod el 17-jul: 2 prealertas
-- vivas → 23 cajas esperadas. `boxes >= 1` está garantizado por 0105:91.

do $$
declare
  r       record;
  v_total int := 0;
  v_n     int;
begin
  for r in
    select id from public.prealertas
     where deleted_at is null
       and status in ('anunciada', 'en_camino')
     order by created_at
  loop
    v_n := public.sync_boxes_for_prealerta(r.id);
    v_total := v_total + coalesce(v_n, 0);
  end loop;

  raise notice 'SDD-0153 · backfill: % cajas esperadas creadas', v_total;
end;
$$;

-- ── 6. Grants ────────────────────────────────────────────────
-- Mismo criterio que 0240/0241: nadie las ejecuta desde el cliente; corren por
-- trigger con los privilegios del definer.

revoke execute on function public.sync_boxes_for_prealerta(uuid) from public;
revoke execute on function public.sync_boxes_for_prealerta(uuid) from anon;
revoke execute on function public.sync_boxes_for_prealerta(uuid) from authenticated;
grant  execute on function public.sync_boxes_for_prealerta(uuid) to service_role;

revoke execute on function public.prealertas_sync_boxes() from public;
revoke execute on function public.prealertas_sync_boxes() from anon;
revoke execute on function public.prealertas_sync_boxes() from authenticated;

revoke execute on function public.consolidation_box_positions_require_recibida() from public;
revoke execute on function public.consolidation_box_positions_require_recibida() from anon;
revoke execute on function public.consolidation_box_positions_require_recibida() from authenticated;
