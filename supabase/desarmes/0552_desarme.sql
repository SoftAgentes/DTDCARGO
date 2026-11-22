-- SDD-0646 · Desarme de la 0552: quita el registro al portal por link y devuelve
-- rename_client_markbox y find_duplicate_client_service a sus cuerpos de la 0371 y la 0342.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0552_registro_portal_por_link.test.sql y
--   lib/portal/__tests__/registro-por-link.migration.test.ts.
--
-- QUITA la tabla client_registration_links (con los links y la revisión: el «antes/después» de cada
-- registro se pierde; exportarlo antes si se quiere conservar), sus RPC, find_duplicate_client_except_service
-- y el trigger clients_guard_markbox_retirado_t.
-- NO DESHACE DATOS: las fichas que el cliente completó siguen completas, los accesos al portal creados
-- siguen activos y un código recuperado sigue siendo el actual (su 8xxx queda en el historial).
-- SE QUEDAN client_markbox_history.restored_at / restored_by y el índice único parcial
--   (sólo lo retirado vigente): son historia, y el índice completo de la 0367 podría no recrearse
--   si un código se restauró y después se volvió a retirar. La 0371 restaurada no los necesita: su
--   chequeo de historial mira todas las filas, así que vuelve a rechazar cualquier código retirado.
-- Los cuerpos de abajo son copia exacta de la 0371 y la 0342 (md5 ed233ed2… y 61d5707d…).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists clients_guard_markbox_retirado_t on public.clients;
drop function if exists public.clients_guard_markbox_retirado();
drop function if exists public.portal_registration_link_email_status(uuid[]);
drop function if exists public.portal_registration_link_mark_reviewed(uuid);
drop function if exists public.portal_registration_link_access_error(uuid, text);
drop function if exists public.portal_registration_link_bind(uuid, uuid);
drop function if exists public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean);
drop function if exists public.portal_registration_link_peek(text);
drop function if exists public.portal_registration_link_create(uuid, text);
drop table if exists public.client_registration_links;

create or replace function public.find_duplicate_client_service(
  p_tenant_id uuid,
  p_document text default null,
  p_email text default null,
  p_phone text default null
)
returns table (client_id uuid, matched_by text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      nullif(upper(regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      nullif(lower(btrim(coalesce(p_email, ''))), '') as em,
      public.phone_match_key(p_phone) as tel
  )
  select
    c.id,
    case
      when q.doc is not null
        and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc
        then 'documento'
      when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em
        then 'correo'
      else 'telefono'
    end
  from public.clients c, q
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and (
         (q.doc is not null
           and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc)
      or (q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em)
      or (q.tel is not null and public.phone_match_key(c.phone) = q.tel)
    )
  order by case
    when q.doc is not null
      and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc then 0
    when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em then 1
    else 2 end
  limit 1;
$$;

revoke all on function public.find_duplicate_client_service(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.find_duplicate_client_service(uuid, text, text, text)
  to service_role;

drop function if exists public.find_duplicate_client_except_service(uuid, uuid, text, text, text);

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

revoke all on function public.rename_client_markbox(uuid, text, text) from public, anon, service_role;
grant execute on function public.rename_client_markbox(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
