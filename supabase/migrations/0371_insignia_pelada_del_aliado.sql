-- 0371_insignia_pelada_del_aliado.sql — SDD-0258
--
-- LA FICHA DE UN ALIADO LLEVA SU PROPIA INSIGNIA, PELADA. AHORA POR DISEÑO.
--
-- El founder renombró sus dos aliadas a `DC` (Dynasty Cargo) y `AG` (Antonella
-- Guerrero): el Shipping Mark de la ficha ES la insignia, sin número. Funciona,
-- pero hasta hoy la base lo permitía por un HUECO, no por una decisión: el guard
-- rechazaba `DC-0777` (con guion) y `DC` pelado se le escapaba.
--
-- Una convención que se sostiene sobre un hueco es una convención que el próximo
-- cambio rompe sin avisar. Acá se vuelve explícita.
--
-- LA REGLA, EN UNA FRASE: la forma `XX-NNNN` es de los CLIENTES del aliado XX;
-- la forma `XX` pelada es del aliado XX y de nadie más.
--
--   `DC`        en la ficha de Dynasty Cargo  → ✅ es su insignia
--   `DC`        en la ficha de cualquier otro → ❌ suplantaría al aliado
--   `AG`        en la ficha de Dynasty Cargo  → ❌ es la insignia de otra
--   `DC-0001`   en la ficha de Dynasty Cargo  → ❌ esa forma es de SUS clientes
--   `DC-0777`   en un cliente sin aliado      → ❌ (ya lo rechazaba)
--
-- POR QUÉ UNA FUNCIÓN Y NO DOS COPIAS. La regla vivía duplicada: una en
-- `clients_guard_markbox_aliado` y otra dentro de `rename_client_markbox`. Dos
-- copias de la misma regla es exactamente cómo se desincronizan — y este repo ya
-- perdió candados así (ver la cabecera de la migr 0361). Acá hay UNA definición
-- y dos llamadores.
--
-- ⭐ Y queda preparada para varias insignias por aliado: el "es suya" se resuelve
-- por `a.client_id = p_client_id`, así que si mañana un aliado tiene tres filas
-- en `aliados`, las tres cuentan como propias sin tocar esta función.
--
-- Los dos cuerpos que se reemplazan se leyeron VIVOS antes (regla de la 0361).

-- ─────────────────────────────────────────────────────────────────────────────
-- La regla, en un solo lugar
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.markbox_choca_con_insignia(
  p_tenant_id uuid,
  p_markbox   text,
  p_client_id uuid
)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- Devuelve la insignia que estorba, o NULL si el código es válido.
  select upper(a.prefix)
    from public.aliados a
   where a.tenant_id = p_tenant_id
     and a.deleted_at is null
     and (
       -- `XX-…` es la forma de los CLIENTES de XX. Nadie más la usa — ni
       -- siquiera el propio aliado XX para su ficha.
       upper(btrim(p_markbox)) ~ ('^' || upper(a.prefix) || '-')
       -- `XX` pelada es del aliado XX. De nadie más.
       or (upper(btrim(p_markbox)) = upper(a.prefix)
           and (p_client_id is null or a.client_id is distinct from p_client_id))
     )
   limit 1;
$function$;

comment on function public.markbox_choca_con_insignia(uuid, text, uuid) is
  'Devuelve la insignia de aliado que impide usar ese Shipping Mark, o NULL si es válido. UNA definición para los dos llamadores (el guard de clients y rename_client_markbox), para que no se desincronicen. SDD-0258.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Llamador 1: el guard de `clients`
-- Cuerpo idéntico al vivo salvo la rama del else, que ahora delega.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.clients_guard_markbox_aliado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chain text;
  v_choca text;
begin
  if new.markbox is null then
    return new;
  end if;

  if new.aliado_id is not null then
    v_chain := public.aliado_prefix_chain(new.aliado_id);
    if tg_op = 'INSERT' and new.markbox !~ ('^' || v_chain || '-\d+$') then
      raise exception 'Un cliente nuevo de % debe llevar Shipping Mark %-NNNN, no %',
        v_chain, v_chain, new.markbox using errcode = '23514';
    end if;
  else
    v_choca := public.markbox_choca_con_insignia(new.tenant_id, new.markbox, new.id);
    if v_choca is not null then
      raise exception 'El Shipping Mark % choca con la insignia del aliado %: la forma %-NNNN es de sus clientes y % pelada es de su propia ficha',
        new.markbox, v_choca, v_choca, v_choca using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Llamador 2: rename_client_markbox
-- Cuerpo idéntico al vivo salvo la rama del else, que ahora delega.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.rename_client_markbox(
  p_client_id   uuid,
  p_new_markbox text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c        public.clients;
  v_old    text;
  v_new    text;
  v_chain  text;
  v_choca  text;
  v_legal  int := 0;
  v_moved  jsonb := '{}'::jsonb;
  v_n      int;
begin
  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  if p_client_id is null then
    raise exception 'Falta el cliente' using errcode = '22023';
  end if;

  v_new := upper(btrim(coalesce(p_new_markbox, '')));
  if v_new = '' then
    raise exception 'El Shipping Mark nuevo es obligatorio' using errcode = '22023';
  end if;
  if length(v_new) > 40 then
    raise exception 'El Shipping Mark nuevo es muy largo' using errcode = '22023';
  end if;
  if v_new !~ '^[A-Z0-9-]+$' then
    raise exception 'El Shipping Mark sólo admite letras, números y guiones: %', v_new
      using errcode = '22023';
  end if;

  select * into c from public.clients where id = p_client_id for update;

  if c.id is null then
    raise exception 'No existe el cliente' using errcode = 'P0002';
  end if;
  if c.deleted_at is not null then
    raise exception 'El cliente está eliminado' using errcode = '22023';
  end if;
  if c.merged_into_client_id is not null then
    raise exception 'Esa ficha ya fue fusionada; renombra la que sobrevivió'
      using errcode = '22023';
  end if;

  perform public.assert_tenant_match(c.tenant_id);

  v_old := c.markbox;
  if v_old is null then
    raise exception 'El cliente no tiene Shipping Mark que renombrar' using errcode = '22023';
  end if;
  if upper(btrim(v_old)) = v_new then
    raise exception 'El Shipping Mark nuevo es igual al actual' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.clients x
     where x.tenant_id = c.tenant_id and upper(btrim(x.markbox)) = v_new
  ) then
    raise exception 'El Shipping Mark % ya es de otro cliente', v_new using errcode = '23505';
  end if;
  if exists (
    select 1 from public.client_markbox_history h
     where h.tenant_id = c.tenant_id and upper(h.markbox) = v_new
  ) then
    raise exception 'El Shipping Mark % está retirado y reservado; no se reutiliza', v_new
      using errcode = '23505';
  end if;

  if c.aliado_id is not null then
    v_chain := public.aliado_prefix_chain(c.aliado_id);
    if v_new !~ ('^' || v_chain || '-\d+$') then
      raise exception 'Un cliente de % debe llevar Shipping Mark %-NNNN, no %',
        v_chain, v_chain, v_new using errcode = '23514';
    end if;
  else
    v_choca := public.markbox_choca_con_insignia(c.tenant_id, v_new, c.id);
    if v_choca is not null then
      raise exception 'El Shipping Mark % choca con la insignia del aliado %: la forma %-NNNN es de sus clientes y % pelada es de su propia ficha',
        v_new, v_choca, v_choca, v_choca using errcode = '23514';
    end if;
  end if;

  insert into public.client_markbox_history (tenant_id, client_id, markbox, reason, retired_by)
  values (c.tenant_id, c.id, v_old, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid());

  update public.clients set markbox = v_new where id = c.id;

  update public.invoices  set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('invoices', v_n);

  update public.prealertas set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('prealertas', v_n);

  update public.shipments set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('shipments', v_n);

  update public.payment_reports          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.payment_receipts         set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.prealerta_service_requests set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.prealerta_documents      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.shipment_documents       set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_delivery_addresses set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_claims            set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_claim_evidence    set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_notification_schedule set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.quotes                   set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.sales_orders             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.purchase_orders          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.consolidation_items      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.packing_list_submissions set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.suppliers_cn             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.supplier_claims          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.supplier_order_signals   set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.warehouse_receipts_cn    set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_enrollments      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_lesson_progress  set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_diplomas         set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.club_members             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.referrals                set referrer_markbox = v_new where tenant_id = c.tenant_id and referrer_markbox = v_old;
  update public.warehouse_boxes          set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;
  update public.warehouse_receipt_ve_boxes set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;
  update public.qr_print_orders          set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;

  update public.dispatch_order_packages p
     set markbox = v_new
    from public.dispatch_orders o
   where o.id = p.od_id and o.tenant_id = c.tenant_id and p.markbox = v_old;

  update public.dispatch_rules
     set vip_markboxes = array_replace(vip_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(vip_markboxes);
  update public.dispatch_rules
     set whitelist_markboxes = array_replace(whitelist_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(whitelist_markboxes);

  select count(*) into v_legal
    from public.legal_acceptances
   where tenant_id = c.tenant_id and client_markbox = v_old;

  return jsonb_build_object(
    'ok', true,
    'client_id', c.id,
    'old_markbox', v_old,
    'new_markbox', v_new,
    'moved', v_moved,
    'needs_review', jsonb_build_object(
      'legal_acceptances_bajo_codigo_viejo', v_legal,
      'kommo_requiere_push', c.kommo_lead_id is not null
    )
  );
end;
$function$;

revoke all on function public.markbox_choca_con_insignia(uuid, text, uuid) from public, anon;
grant execute on function public.markbox_choca_con_insignia(uuid, text, uuid) to authenticated;
revoke all on function public.rename_client_markbox(uuid, text, text) from public, anon, service_role;
grant execute on function public.rename_client_markbox(uuid, text, text) to authenticated;
