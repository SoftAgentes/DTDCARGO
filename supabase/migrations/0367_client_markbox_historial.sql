-- 0367_client_markbox_historial.sql — SDD-0258
--
-- RENOMBRAR UN SHIPPING MARK SIN PERDER NADA.
--
-- POR QUÉ ESTO NO ES UN `update clients set markbox`.
-- El Shipping Mark no es una referencia, es un VALOR COPIADO en 33 columnas
-- (31 text + 2 arrays) de 32 tablas, y NO hay una sola foreign key por markbox.
-- Medido el 2026-08-13. Un UPDATE suelto no falla, no cascadea y no avisa: deja
-- 33 columnas apuntando a un texto que ya no existe. La migr 0341 ya lo decía
-- ("POR QUÉ NO SE RENUMERA") y por eso hasta hoy no existía este camino.
--
-- LAS DOS MITADES. Un alias resuelve que el código VIEJO siga encontrando al
-- cliente (la caja ya rotulada, el QR ya impreso). NO resuelve que el sistema,
-- preguntando con el código NUEVO, encuentre las filas guardadas con el viejo —
-- y eso es lo que vacía el portal, porque 32 políticas RLS comparan
-- `client_markbox = get_portal_client_markbox()` por igualdad de TEXTO y ese
-- helper lee el markbox VIVO. Por eso acá van las dos: historial (alias) +
-- backfill transaccional.
--
-- POR QUÉ UNA TABLA Y NO UNA FICHA-TUMBA. La 0341 resuelve la fusión dejando la
-- fila soft-deleted que retiene su markbox ("la propia fila es el alias"). Ese
-- truco NO sirve acá por dos razones: (1) en un rename hay UN solo cliente, no
-- hay segunda fila que retenga el valor; (2) `clients_guard_no_merge_aliado`
-- (migr 0362) prohíbe expresamente dejar una tumba sobre un aliado — que es
-- justo el caso real que originó esto.
--
-- 🔴 EL CÓDIGO RETIRADO NUNCA SE REEMITE. `clients_tenant_id_markbox_key` sólo
-- protege lo que sigue en `clients`; los tres generadores hacen max()+1 sobre
-- filas vivas. Sin esta migración, renombrar al cliente del número más alto hace
-- que el contador RETROCEDA y el próximo cliente reciba el código liberado — y
-- con él, por las 32 políticas del portal, la historia visible del anterior.
-- Eso es fuga de datos entre clientes, no un enlace roto. Por eso los tres
-- generadores pasan a mirar `clients ∪ client_markbox_history`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. El historial
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_markbox_history (
  id         uuid primary key default extensions.gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete restrict,
  markbox    text not null,
  reason     text,
  retired_at timestamptz not null default now(),
  retired_by uuid references auth.users(id)
);

comment on table public.client_markbox_history is
  'Shipping Marks que un cliente TUVO y ya no son el actual. No se borran: quedan reservados (ningún generador los reemite) y resuelven vía resolve_markbox, para que una caja rotulada con el código viejo no llegue huérfana. SDD-0258.';

-- Reserva el código: nadie más lo puede tomar, ni siquiera otro cliente.
create unique index if not exists client_markbox_history_uq
  on public.client_markbox_history (tenant_id, upper(markbox));

create index if not exists client_markbox_history_client_idx
  on public.client_markbox_history (tenant_id, client_id);

alter table public.client_markbox_history enable row level security;

-- Sólo lectura, y sólo del propio tenant. NO hay política de escritura a
-- propósito: con RLS activa y sin política, todo INSERT/UPDATE/DELETE directo
-- queda negado. La única vía de escritura es rename_client_markbox(), que es
-- security definer y por eso salta RLS.
drop policy if exists "client_markbox_history by tenant" on public.client_markbox_history;
create policy "client_markbox_history by tenant"
  on public.client_markbox_history for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

grant select on public.client_markbox_history to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. resolve_markbox aprende una SEGUNDA fuente de redirect
--
-- Cuerpo base copiado del VIVO en prod (verificado 2026-08-13, migr 0341:89-131)
-- antes de este create or replace — regla de la 0361:11-17, porque ya se perdió
-- un candado dos veces reescribiendo a ciegas.
-- Lo único que cambia: si el código no está en `clients`, se busca en el
-- historial ANTES de rendirse. El seguimiento de fusiones queda intacto.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.resolve_markbox(p_tenant_id uuid, p_markbox text)
returns table(client_id uuid, canonical_markbox text, was_redirected boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_next uuid;
  v_hops int := 0;
  v_redirected boolean := false;
begin
  if p_tenant_id is null or p_markbox is null or btrim(p_markbox) = '' then
    return;
  end if;

  select c.id, c.merged_into_client_id into v_id, v_next
  from public.clients c
  where c.tenant_id = p_tenant_id and upper(btrim(c.markbox)) = upper(btrim(p_markbox))
  limit 1;

  -- NUEVO (SDD-0258): un código retirado por renombrado ya no está en `clients`.
  -- Vive en el historial y sigue apuntando a su dueño.
  if v_id is null then
    select h.client_id into v_id
    from public.client_markbox_history h
    where h.tenant_id = p_tenant_id and upper(btrim(h.markbox)) = upper(btrim(p_markbox))
    limit 1;

    if v_id is not null then
      v_redirected := true;
      select c.merged_into_client_id into v_next from public.clients c where c.id = v_id;
    end if;
  end if;

  if v_id is null then
    return;
  end if;

  while v_next is not null and v_hops < 10 loop
    v_redirected := true;
    v_id := v_next;
    v_hops := v_hops + 1;
    select c.merged_into_client_id into v_next
    from public.clients c where c.id = v_id;
  end loop;

  return query
    select c.id, c.markbox, v_redirected
    from public.clients c
    where c.id = v_id;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Los tres generadores dejan de reemitir códigos retirados
--
-- Cuerpos copiados de los VIVOS en prod (verificados 2026-08-13). El único
-- cambio en cada uno: el max() mira `clients ∪ client_markbox_history`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.next_markbox(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(m, '^DTD-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from (
      select markbox as m from public.clients where tenant_id = p_tenant_id
      union all
      select markbox as m from public.client_markbox_history where tenant_id = p_tenant_id
    ) s;
  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-' || v_padded;
end; $function$;

create or replace function public.next_markbox_service(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_max int;
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  select coalesce(max((regexp_match(m, '^DTD-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from (
      select markbox as m from public.clients where tenant_id = p_tenant_id
      union all
      select markbox as m from public.client_markbox_history where tenant_id = p_tenant_id
    ) s;
  return 'DTD-' || lpad(v_max::text, 4, '0');
end;
$function$;

create or replace function public.next_markbox_aliado(p_aliado_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid;
  v_status text;
  v_chain  text;
  v_max    int;
begin
  select tenant_id, status into v_tenant, v_status
    from public.aliados
   where id = p_aliado_id and deleted_at is null;

  if v_tenant is null then
    raise exception 'Aliado no encontrado' using errcode = '22023';
  end if;

  perform public.assert_tenant_match(v_tenant);

  if v_status <> 'activo' then
    raise exception 'El aliado no está activo' using errcode = '23514';
  end if;

  v_chain := public.aliado_prefix_chain(p_aliado_id);
  if v_chain is null then
    raise exception 'No se pudo componer la cadena de prefijos del aliado' using errcode = '22023';
  end if;

  select coalesce(max((regexp_match(m, '^' || v_chain || '-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from (
      select markbox as m from public.clients where tenant_id = v_tenant
      union all
      select markbox as m from public.client_markbox_history where tenant_id = v_tenant
    ) s;

  return v_chain || '-' || lpad(v_max::text, 4, '0');
end;
$function$;

revoke all on function public.next_markbox_aliado(uuid) from public, anon, service_role;
grant execute on function public.next_markbox_aliado(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. rename_client_markbox() — el renombrado atómico
--
-- ⚠️ EL ORDEN DE LOS UPDATE NO ES ESTÉTICO, ES OBLIGATORIO.
--   · `clients` va PRIMERO: varios triggers de denormalización
--     (client_delivery_addresses_validate_client, club_members_validate_refs)
--     releen el markbox DESDE clients por client_id.
--   · `invoices` va ANTES que `payment_reports`: el trigger
--     payment_reports_validate_invoice exige que exista una factura con el mismo
--     markbox, y si no la encuentra levanta excepción.
--   · `prealertas` va ANTES que `prealerta_service_requests`: mismo patrón con
--     prealerta_service_request_guard.
-- Cambiar el orden hace que el propio sistema rechace el renombrado.
--
-- ⚠️ `legal_acceptances` NO SE TOCA, y es una decisión, no un olvido. El markbox
-- entra al payload canónico del sello (legal/seal.ts:103), así que reescribirlo
-- haría que rowHashVerified recompute distinto y la aceptación se descarte como
-- forjada. Además la tabla es append-only por trigger: el UPDATE ni siquiera
-- pasaría. Se reporta en `needs_review` y el gate legal debe resolver por
-- client_id / resolve_markbox — cambio de código, no de esta migración.
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
  v_legal  int := 0;
  v_moved  jsonb := '{}'::jsonb;
  v_n      int;
begin
  -- El candado va de PRIMERO, antes de tocar clients: sin permiso no se puede
  -- ni sondear qué ids existen usando el mensaje de error como oráculo
  -- (misma doctrina que merge_clients, SDD-0251 d).
  -- Sin 'support' ni 'accounting': renombrar mueve 30 tablas de una vez.
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

  -- Que no lo tenga otro cliente, ni esté retirado por alguien más.
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

  -- Coherencia con el módulo de aliados. Cierra de paso el hueco de la migr
  -- 0362: clients_guard_markbox_aliado sólo valida el formato en INSERT, así que
  -- en UPDATE la base no comprobaba nada.
  if c.aliado_id is not null then
    v_chain := public.aliado_prefix_chain(c.aliado_id);
    if v_new !~ ('^' || v_chain || '-\d+$') then
      raise exception 'Un cliente de % debe llevar Shipping Mark %-NNNN, no %',
        v_chain, v_chain, v_new using errcode = '23514';
    end if;
  else
    if exists (
      select 1 from public.aliados a
       where a.tenant_id = c.tenant_id and a.deleted_at is null
         and v_new ~ ('^' || upper(a.prefix) || '-')
    ) then
      raise exception 'El Shipping Mark % usa la insignia de un aliado pero el cliente no tiene aliado asignado',
        v_new using errcode = '23514';
    end if;
  end if;

  -- ── El código viejo se JUBILA antes de tocar nada más ──
  -- Va primero a propósito: si algo revienta después, la transacción entera se
  -- deshace, pero mientras tanto el valor viejo ya está reservado y ningún
  -- generador concurrente lo puede reemitir.
  insert into public.client_markbox_history (tenant_id, client_id, markbox, reason, retired_by)
  values (c.tenant_id, c.id, v_old, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid());

  -- ── 1. La fuente de verdad ──
  update public.clients set markbox = v_new where id = c.id;

  -- ── 2. Las que otros triggers consultan (orden obligatorio, ver cabecera) ──
  update public.invoices  set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('invoices', v_n);

  update public.prealertas set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('prealertas', v_n);

  update public.shipments set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('shipments', v_n);

  -- ── 3. El resto de las copias (28 tablas) ──
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

  -- ⚠️ dispatch_order_packages es la ÚNICA de las 30 que no tiene tenant_id
  -- propio: cuelga de dispatch_orders. Verificado por su foreign key el
  -- 2026-08-13. Filtrarla por `tenant_id` habría reventado en tiempo de
  -- ejecución con "column tenant_id does not exist".
  update public.dispatch_order_packages p
     set markbox = v_new
    from public.dispatch_orders o
   where o.id = p.od_id and o.tenant_id = c.tenant_id and p.markbox = v_old;

  -- ── 4. Los dos arrays: array_replace, no `=` ──
  update public.dispatch_rules
     set vip_markboxes = array_replace(vip_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(vip_markboxes);
  update public.dispatch_rules
     set whitelist_markboxes = array_replace(whitelist_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(whitelist_markboxes);

  -- ── 5. Lo que queda a mano, dicho en voz alta ──
  select count(*) into v_legal
    from public.legal_acceptances
   where tenant_id = c.tenant_id and client_markbox = v_old;

  return jsonb_build_object(
    'ok', true,
    'client_id', c.id,
    'old_markbox', v_old,
    'new_markbox', v_new,
    'moved', v_moved,
    -- Cabos que este renombrado NO ata. Si vienen en cero, no quedó nada suelto.
    'needs_review', jsonb_build_object(
      -- Expedientes sellados: intocables por diseño (ver cabecera).
      'legal_acceptances_bajo_codigo_viejo', v_legal,
      -- Kommo guarda el código en el nombre del lead y en 2 campos custom, y no
      -- existe op de renombrado en kommo-writeback. Se empuja aparte.
      'kommo_requiere_push', c.kommo_lead_id is not null
    )
  );
end;
$function$;

comment on function public.rename_client_markbox(uuid, text, text) is
  'Cambia el Shipping Mark de un cliente moviendo las 30 tablas que lo copian, en UNA transacción, y jubila el código viejo en client_markbox_history para que siga resolviendo y nunca se reemita. SDD-0258.';

revoke all on function public.rename_client_markbox(uuid, text, text) from public, anon, service_role;
grant execute on function public.rename_client_markbox(uuid, text, text) to authenticated;
