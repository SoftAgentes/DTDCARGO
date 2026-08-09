-- ─────────────────────────────────────────────────────────────
-- 0361 · SDD-0246 + SDD-0244 — `merge_clients` también hereda el CONTACTO.
--
-- REEMPLAZA A LA 0345, QUE NO SE APLICÓ NUNCA Y NO DEBE APLICARSE.
-- La 0345 arreglaba esto mismo, pero su cuerpo se copió de la migr 0341 y es
-- del 2026-08-03. Después llegó la 0358 (SDD-0251) y volvió a reemplazar la
-- MISMA función para meterle `assert_studio_role()`. Aplicar la 0345 hoy sería
-- un `create or replace` con el cuerpo viejo: el candado de rol desaparecería
-- en silencio y cualquier autenticado del tenant podría volver a fusionar
-- fichas. Medido el 2026-08-09 contra prod: el cuerpo vivo es el de la 0358
-- (md5 del cuerpo normalizado idéntico) y NO contiene `kommo_contact_id`.
--
-- Es la tercera vuelta del mismo tropiezo, y conviene decirlo: la 0345 nació
-- porque la 0341 y la 0342 no se vieron entre sí; ahora la 0345 y la 0358
-- tampoco. La regla que queda es leer la función VIVA antes de un
-- `create or replace`, no el archivo que uno cree que corrió.
--
-- QUÉ ARREGLA
-- `merge_clients` copiaba al sobreviviente el vínculo con el TRATO de Kommo
-- (`kommo_lead_id`) pero no el vínculo con el CONTACTO (`kommo_contact_id`,
-- nacido en la 0342).
--
-- POR QUÉ IMPORTA
-- `kommo_contact_id` es el camino rápido y exacto del enrutador de Recontacto:
-- cuando un cliente conocido escribe, el webhook lo resuelve por ese vínculo
-- sin cruzar teléfonos. Se llena solo la primera vez que alguien escribe, y ése
-- es el mecanismo por el que la cobertura crece sin backfill. Si la ficha que
-- se RETIRA en la fusión era la que tenía el contacto vinculado —el caso
-- probable, porque la ficha nueva nace del registro web y el vínculo lo estampa
-- el enrutador sobre quien escribe— la fusión BORRA ese vínculo y el cliente
-- vuelve al cruce por teléfono para siempre. Falla en silencio.
--
-- POR QUÉ ES SEGURO COPIARLO
--   1. `clients_kommo_contact_idx` (0342) NO es único: es un índice parcial de
--      lectura. Copiar no puede violar ninguna restricción.
--   2. Aunque quedaran dos filas con el mismo contacto, el enrutador filtra
--      `deleted_at is null` en sus DOS consultas (kommo-webhook/index.ts:139 y
--      :108), y la fusión retira la ficha absorbida en la misma transacción.
--   3. Se usa `coalesce(sobreviviente, absorbida)`: si el sobreviviente ya tiene
--      vínculo, se respeta. Sólo rellena el hueco, igual que el resto.
--
-- FORMA
-- El cuerpo se copió TEXTUAL de la migr 0358 —candado de rol incluido— y lo
-- único que cambia es UNA línea en el bloque de relleno. El diff contra la 0358
-- es de una línea más su comentario, a propósito, para auditarlo de un vistazo.
--
-- Ref: SDD-0246 (fusión) · SDD-0244 (enrutado) · SDD-0251 (candado de rol).
-- ─────────────────────────────────────────────────────────────

create or replace function public.merge_clients(p_survivor_id uuid, p_merged_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.clients;
  m public.clients;
  v_access text := 'sin cambios';
  v_addresses int := 0;
  v_conversations int := 0;
  v_conversations_archived int := 0;
  v_requests_left int := 0;
  v_rules_moved int := 0;
  v_rules_dropped int := 0;
  v_claims int := 0;
  v_filled text[] := '{}';
begin

  -- ── EL CANDADO NUEVO (SDD-0251 d) ────────────────────────────────────────
  -- De primero, antes de tocar `clients`: sin permiso no se puede ni sondear
  -- qué ids existen usando el mensaje de error como oráculo.
  perform public.assert_studio_role(
    array['admin', 'commercial', 'operations', 'accounting', 'support']
  );

  if p_survivor_id is null or p_merged_id is null then
    raise exception 'Hacen falta los dos clientes para fusionar' using errcode = '22023';
  end if;
  if p_survivor_id = p_merged_id then
    raise exception 'No se puede fusionar un cliente consigo mismo' using errcode = '22023';
  end if;

  -- Lock en orden determinista por id: si dos operadores fusionan el mismo par
  -- cruzado al mismo tiempo, uno espera al otro en vez de deadlockear.
  perform 1 from public.clients
   where id in (p_survivor_id, p_merged_id)
   order by id
     for update;

  select * into s from public.clients where id = p_survivor_id;
  select * into m from public.clients where id = p_merged_id;

  if s.id is null then
    raise exception 'No existe el cliente superviviente' using errcode = 'P0002';
  end if;
  if m.id is null then
    raise exception 'No existe el cliente a fusionar' using errcode = 'P0002';
  end if;
  if s.tenant_id <> m.tenant_id then
    raise exception 'Los dos clientes son de tenants distintos' using errcode = '42501';
  end if;

  -- Guard de tenant: sólo un usuario autenticado DE ESE tenant puede fusionar.
  perform public.assert_tenant_match(s.tenant_id);

  if s.deleted_at is not null then
    raise exception 'El cliente superviviente está eliminado' using errcode = '22023';
  end if;
  if m.deleted_at is not null then
    raise exception 'La ficha a fusionar ya está eliminada' using errcode = '22023';
  end if;
  if m.merged_into_client_id is not null or s.merged_into_client_id is not null then
    raise exception 'Alguna de las dos fichas ya fue fusionada' using errcode = '22023';
  end if;

  -- ── 5.1 Acceso al portal ──
  -- client_users es UNIQUE (tenant_id, client_id): UNA fila por cliente. Si el
  -- superviviente NO tiene acceso, se lo mudamos (el cliente conserva su login).
  -- Si YA tiene, no se puede mover: revocamos el duplicado y lo reportamos, para
  -- que el operador le diga al cliente con cuál correo entrar.
  if exists (select 1 from public.client_users where client_id = m.id) then
    if exists (select 1 from public.client_users where client_id = s.id) then
      update public.client_users
         set status = 'revoked'
       where client_id = m.id;
      v_access := 'el superviviente ya tenía acceso; se revocó el duplicado';
    else
      update public.client_users
         set client_id = s.id
       where client_id = m.id;
      v_access := 'acceso mudado al superviviente';
    end if;
  end if;

  -- ── 5.2 Direcciones de entrega ──
  -- client_delivery_addresses_default_uidx es UNIQUE (client_id) WHERE is_default:
  -- si el superviviente ya tiene una por defecto, las que llegan entran como
  -- secundarias en vez de reventar la fusión.
  if exists (
    select 1 from public.client_delivery_addresses
     where client_id = s.id and is_default and deleted_at is null
  ) then
    update public.client_delivery_addresses
       set is_default = false
     where client_id = m.id and is_default;
  end if;
  update public.client_delivery_addresses set client_id = s.id where client_id = m.id;
  get diagnostics v_addresses = row_count;

  -- ── 5.3 Conversaciones y digests ──
  -- conversations_client_channel_live_idx es UNIQUE (tenant_id, client_id,
  -- channel) WHERE deleted_at is null: si ambas fichas tienen hilo VIVO en el
  -- mismo canal (los dos por WhatsApp, por ejemplo), moverlo tal cual reventaría.
  -- Archivamos el hilo duplicado ANTES de mudarlo: así queda colgando del
  -- superviviente —no se pierde el historial— y el índice parcial ya no aplica.
  update public.conversations cv
     set deleted_at = now()
   where cv.client_id = m.id
     and cv.deleted_at is null
     and exists (
       select 1 from public.conversations c2
        where c2.client_id = s.id
          and c2.tenant_id = cv.tenant_id
          and c2.channel = cv.channel
          and c2.deleted_at is null
     );
  get diagnostics v_conversations_archived = row_count;

  update public.conversations set client_id = s.id where client_id = m.id;
  get diagnostics v_conversations = row_count;
  update public.conversation_monthly_digests set client_id = s.id where client_id = m.id;

  -- ── 5.4 Reglas de notificación ──
  -- client_notif_rules_override_uniq es UNIQUE (tenant_id, client_id,
  -- trigger_event): si el superviviente ya tiene regla para ese evento, la suya
  -- manda y la de la ficha fusionada se descarta.
  delete from public.client_notification_rules r
   where r.client_id = m.id
     and exists (
       select 1 from public.client_notification_rules r2
        where r2.client_id = s.id
          and r2.tenant_id = r.tenant_id
          and r2.trigger_event = r.trigger_event
     );
  get diagnostics v_rules_dropped = row_count;
  update public.client_notification_rules set client_id = s.id where client_id = m.id;
  get diagnostics v_rules_moved = row_count;

  -- ── 5.5 Resto del historial operativo ──
  update public.client_claims set client_id = s.id where client_id = m.id;
  get diagnostics v_claims = row_count;
  -- client_change_requests_one_open es UNIQUE (client_id) WHERE status='pending':
  -- si las dos fichas tienen una solicitud abierta, la del superviviente manda.
  -- La de la ficha fusionada NO se mueve ni se borra: queda donde estaba (la fila
  -- sobrevive soft-deleted) porque es una solicitud del cliente y borrarla sería
  -- perder algo que él pidió. Se reporta para que el operador la revise.
  select count(*) into v_requests_left
    from public.client_change_requests r
   where r.client_id = m.id
     and r.status = 'pending'
     and exists (
       select 1 from public.client_change_requests r2
        where r2.client_id = s.id and r2.status = 'pending'
     );

  update public.client_change_requests set client_id = s.id
   where client_id = m.id
     and not (
       status = 'pending'
       and exists (
         select 1 from public.client_change_requests r2
          where r2.client_id = s.id and r2.status = 'pending'
       )
     );
  update public.bitacora_meetings       set client_id = s.id where client_id = m.id;
  update public.bitacora_tasks          set client_id = s.id where client_id = m.id;
  update public.currency_conversions    set client_id = s.id where client_id = m.id;
  update public.inspection_reports      set client_id = s.id where client_id = m.id;
  update public.supplier_claim_offsets  set client_id = s.id where client_id = m.id;
  update public.referrals set referrer_client_id = s.id where referrer_client_id = m.id;
  update public.referrals set referred_client_id = s.id where referred_client_id = m.id;

  -- legal_acceptances NO se mueve A PROPÓSITO. Una aceptación legal está atada a
  -- QUIÉN la aceptó, con su hash y su sello (SDD-0054). Reapuntarla a otra ficha
  -- falsificaría el registro: diría que el superviviente aceptó algo que aceptó
  -- la otra ficha. Se queda donde ocurrió; la ficha sobrevive soft-deleted.

  -- ── 5.6 Retirar la ficha fusionada ──
  -- Va ANTES de rellenar al superviviente (ver la nota de orden obligatorio).
  -- El markbox NO se toca: la fila lo retiene y por eso sigue resolviendo y nunca
  -- se reemite.
  update public.clients
     set merged_into_client_id = s.id,
         deleted_at = now()
   where id = m.id;

  -- ── 5.7 Rellenar los huecos del superviviente ──
  -- Sólo donde está vacío. Nunca pisa un dato que el superviviente ya tenía.
  --
  -- doc_verify_* NO se copia a propósito: una verificación de identidad se hizo
  -- sobre una ficha concreta (SDD-0046). Heredarla sería afirmar una comprobación
  -- que no se corrió sobre esta. El superviviente queda sin verificar y se
  -- verifica por el camino normal.
  update public.clients c set
    email = case when coalesce(btrim(c.email), '') = '' then m.email else c.email end,
    phone = case when coalesce(btrim(c.phone), '') = '' then m.phone else c.phone end,
    address = case when coalesce(btrim(c.address), '') = '' then m.address else c.address end,
    address_reference = coalesce(c.address_reference, m.address_reference),
    rif = case when coalesce(btrim(c.rif), '') = '' then m.rif else c.rif end,
    doc_kind = coalesce(c.doc_kind, m.doc_kind),
    contact_name = coalesce(c.contact_name, m.contact_name),
    cedula_photo_path = coalesce(c.cedula_photo_path, m.cedula_photo_path),
    facade_photo_url = coalesce(c.facade_photo_url, m.facade_photo_url),
    avatar_path = coalesce(c.avatar_path, m.avatar_path),
    lat = coalesce(c.lat, m.lat),
    lng = coalesce(c.lng, m.lng),
    person_id = coalesce(c.person_id, m.person_id),
    advisor_id = coalesce(c.advisor_id, m.advisor_id),
    kommo_lead_id = coalesce(c.kommo_lead_id, m.kommo_lead_id),
    -- 0361: el vínculo con la PERSONA también se hereda. Sin esta línea la
    -- fusión rompía el camino rápido del enrutador de Recontacto.
    kommo_contact_id = coalesce(c.kommo_contact_id, m.kommo_contact_id),
    portal_approved_at = coalesce(c.portal_approved_at, m.portal_approved_at),
    -- El opt-in de marketing viaja en par (cuándo + de dónde): o se copian los
    -- dos o ninguno, si no queda un consentimiento sin origen.
    email_marketing_optin_at = coalesce(c.email_marketing_optin_at, m.email_marketing_optin_at),
    email_optin_source = case
      when c.email_marketing_optin_at is null and m.email_marketing_optin_at is not null
        then m.email_optin_source else c.email_optin_source end,
    whatsapp_marketing_optin_at =
      coalesce(c.whatsapp_marketing_optin_at, m.whatsapp_marketing_optin_at),
    notes = case
      when coalesce(btrim(m.notes), '') = '' then c.notes
      else concat_ws(E'\n', nullif(btrim(coalesce(c.notes, '')), ''),
                     '— Fusionado desde ' || coalesce(m.markbox, 'ficha sin código')
                       || ': ' || btrim(m.notes))
    end
  where c.id = s.id;

  -- Qué se rellenó de verdad (para mostrárselo al operador y dejarlo en bitácora).
  select array_remove(array[
    case when coalesce(btrim(s.email), '') = '' and coalesce(btrim(m.email), '') <> '' then 'correo' end,
    case when coalesce(btrim(s.phone), '') = '' and coalesce(btrim(m.phone), '') <> '' then 'teléfono' end,
    case when coalesce(btrim(s.rif), '') = '' and coalesce(btrim(m.rif), '') <> '' then 'documento' end,
    case when coalesce(btrim(s.address), '') = '' and coalesce(btrim(m.address), '') <> '' then 'dirección' end,
    case when s.doc_kind is null and m.doc_kind is not null then 'tipo de documento' end,
    case when s.cedula_photo_path is null and m.cedula_photo_path is not null then 'foto del documento' end,
    case when s.portal_approved_at is null and m.portal_approved_at is not null then 'activación del portal' end
  ], null) into v_filled;

  return jsonb_build_object(
    'ok', true,
    'survivor_id', s.id,
    'survivor_markbox', s.markbox,
    'merged_id', m.id,
    'retired_markbox', m.markbox,
    'access', v_access,
    'filled', to_jsonb(v_filled),
    'moved', jsonb_build_object(
      'addresses', v_addresses,
      'conversations', v_conversations,
      'claims', v_claims,
      'notification_rules', v_rules_moved,
      'notification_rules_dropped', v_rules_dropped
    ),
    -- Lo que quedó pendiente de mirar a mano. Si viene en cero, la fusión no
    -- dejó cabos sueltos.
    'needs_review', jsonb_build_object(
      'conversations_archived', v_conversations_archived,
      'change_requests_left_behind', v_requests_left
    )
  );
end;
$$;

comment on function public.merge_clients(uuid, uuid) is
  'SDD-0246 · fusión atómica de dos fichas del mismo cliente. SDD-0251 d): exige rol de la matriz `clients` (+admin) vía assert_studio_role, porque assert_tenant_match sólo validaba el tenant y PostgREST expone la RPC directo.';

revoke all on function public.merge_clients(uuid, uuid) from public, anon;
grant execute on function public.merge_clients(uuid, uuid) to authenticated, service_role;
