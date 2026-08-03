-- ─────────────────────────────────────────────────────────────
-- SDD-0244 — Fusión de cliente duplicado.
--
-- El problema: un cliente que YA existe entra a /registro, se registra como si
-- fuera nuevo y el sistema le emite un Shipping Mark nuevo. Queda con dos
-- identidades y dos códigos.
--
-- POR QUÉ NO SE RENUMERA. `clients.markbox` no es una referencia, es un VALOR
-- COPIADO: se snapshotea dentro de facturas (invoice-types.ts:348), expedientes
-- sellados (legal/seal.ts:103), prealertas, despachos, aduana, pagos y cobranzas.
-- Un `update clients set markbox = …` dejaría todo eso apuntando a un texto que
-- ya no existe, y un expediente sellado NO se reescribe — para eso está el sello.
--
-- POR QUÉ NO HACE FALTA UNA TABLA DE ALIAS. `clients_tenant_id_markbox_key` es
-- UNIQUE (tenant_id, markbox) SIN filtro de deleted_at → la fila fusionada
-- RETIENE su markbox aunque quede soft-deleted. O sea: **la propia fila es el
-- alias**, y `merged_into_client_id` es el redirect. Una columna en vez de una
-- tabla nueva, sin superficie de RLS extra y sin riesgo de desincronización.
--
-- POR QUÉ EL CÓDIGO RETIRADO NUNCA SE REEMITE. next_markbox / next_markbox_service
-- calculan max()+1 SIN filtrar deleted_at (0012:78, 0109:34), y el unique de
-- arriba tampoco lo libera. Doble protección. Esta migración depende de esas dos
-- propiedades y NO las toca.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ── 1. El redirect ───────────────────────────────────────────

alter table public.clients
  add column if not exists merged_into_client_id uuid
    references public.clients(id) on delete set null;

comment on column public.clients.merged_into_client_id is
  'SDD-0244: si no es null, esta ficha se fusionó en otra y este es el cliente superviviente. La fila se conserva soft-deleted para que su markbox siga resolviendo (una caja ya rotulada con ese código no queda huérfana) y para que el correlativo nunca lo reemita.';

-- Índice para "¿qué fichas se fusionaron en este cliente?" (lo usa el detalle).
create index if not exists clients_merged_into_idx
  on public.clients (merged_into_client_id)
  where merged_into_client_id is not null;

-- Un cliente no puede fusionarse en sí mismo, ni siquiera por un UPDATE suelto.
alter table public.clients
  drop constraint if exists clients_merge_not_self;
alter table public.clients
  add constraint clients_merge_not_self
    check (merged_into_client_id is null or merged_into_client_id <> id);

-- ── 2. Índices de dedup por correo y teléfono ────────────────
--
-- El dedup vigente compara SÓLO el documento (registro/actions.ts:157) y con el
-- legado no funciona: 144 fichas no tienen documento, y cuando lo tienen suele
-- venir corrompido por la exportación de Excel ('2108108.0' con el .0 que le
-- pega Excel al leerlo como número, '123456/822326660' con dos valores pegados).
-- El correo y el teléfono son mejores llaves para el legado.
--
-- Teléfono: comparamos los ÚLTIMOS 7 dígitos. Así '0414-0538566' y
-- '+58 4140538566' —el mismo número escrito por el legado y por el registro—
-- caen en la misma llave, sin pelear con el prefijo de país ni con el 0 inicial.

create index if not exists clients_tenant_email_norm_idx
  on public.clients (tenant_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '' and deleted_at is null;

create index if not exists clients_tenant_phone_norm_idx
  on public.clients (tenant_id, right(regexp_replace(phone, '[^0-9]', '', 'g'), 7))
  where phone is not null and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 7
    and deleted_at is null;

-- ── 3. Resolver un markbox siguiendo el redirect ─────────────
--
-- El caso que esto salva: el cliente se registró, anotó el código nuevo y se lo
-- pasó a su proveedor en Yiwu ANTES de que alguien fusionara. La caja llega
-- rotulada con un código retirado. Sin esto, llega huérfana.
--
-- Sigue la cadena por si hubo fusiones encadenadas (A→B→C), con tope de 10
-- saltos para que un ciclo accidental no cuelgue la recepción.

create or replace function public.resolve_markbox(p_tenant_id uuid, p_markbox text)
returns table (client_id uuid, canonical_markbox text, was_redirected boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

comment on function public.resolve_markbox is
  'SDD-0244: dado un markbox devuelve el cliente vigente, siguiendo merged_into_client_id si esa ficha se fusionó. Sirve para que un bulto ya rotulado con un código retirado siga encontrando a su dueño.';

revoke all on function public.resolve_markbox(uuid, text) from public, anon;
grant execute on function public.resolve_markbox(uuid, text) to authenticated, service_role;

-- ── 4. Candidatos a duplicado ────────────────────────────────
--
-- PROPONE, no decide. La fusión nunca es automática: el caso real DTD-J000 /
-- DTD-9001 coincide SÓLO por nombre ("Jose Mendez"), el viejo no tiene correo ni
-- teléfono ni documento, y el nombre es común. Eso lo confirma un humano.
--
-- Además: todas las fichas del legado tienen created_at = 2026-06-12, que es la
-- fecha de la IMPORTACIÓN, no del alta. En DTD-J000 el registro "nuevo" es del
-- 08-jun, ANTERIOR. Por eso el candidato no se ordena por antigüedad de fila:
-- se marca cuál tiene formato de código legado, que es la señal real.

create or replace function public.client_duplicate_candidates(p_tenant_id uuid)
returns table (
  legacy_id uuid,
  legacy_markbox text,
  legacy_name text,
  new_id uuid,
  new_markbox text,
  new_name text,
  match_email boolean,
  match_phone boolean,
  match_name boolean,
  match_document boolean,
  score int
)
language sql
stable
security definer
set search_path = public
as $$
  with vivos as (
    select
      c.id, c.markbox, c.name, c.created_at, c.registration_channel,
      lower(btrim(c.email))                                        as em,
      right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 7) as tel7,
      upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) as doc,
      lower(btrim(c.name))                                         as nom,
      -- El legado NO matchea '^DTD-\d+$' (son DTD-A###, ITS-##, AD-###…). Esa es
      -- justamente la razón por la que el correlativo nunca los vio.
      (c.markbox !~ '^DTD-\d+$')                                   as es_legado
    from public.clients c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and c.merged_into_client_id is null
  )
  select
    v.id, v.markbox, v.name,
    n.id, n.markbox, n.name,
    (n.em = v.em and coalesce(n.em, '') <> '')                     as match_email,
    (n.tel7 = v.tel7 and length(coalesce(n.tel7, '')) = 7)         as match_phone,
    (n.nom = v.nom and coalesce(n.nom, '') <> '')                  as match_name,
    (n.doc = v.doc and coalesce(n.doc, '') <> '')                  as match_document,
    (case when n.em = v.em and coalesce(n.em, '') <> '' then 2 else 0 end)
      + (case when n.tel7 = v.tel7 and length(coalesce(n.tel7, '')) = 7 then 2 else 0 end)
      + (case when n.doc = v.doc and coalesce(n.doc, '') <> '' then 3 else 0 end)
      + (case when n.nom = v.nom and coalesce(n.nom, '') <> '' then 1 else 0 end) as score
  from vivos v
  join vivos n
    on v.es_legado and not n.es_legado
   and (
        (n.em = v.em and coalesce(n.em, '') <> '')
     or (n.tel7 = v.tel7 and length(coalesce(n.tel7, '')) = 7)
     or (n.doc = v.doc and coalesce(n.doc, '') <> '')
     or (n.nom = v.nom and coalesce(n.nom, '') <> '')
   )
  order by score desc, v.markbox;
$$;

comment on function public.client_duplicate_candidates is
  'SDD-0244: pares (ficha legado ↔ ficha del registro público) que parecen el mismo cliente, con la razón de la coincidencia y un score. PROPONE — la fusión la confirma un humano.';

revoke all on function public.client_duplicate_candidates(uuid) from public, anon;
grant execute on function public.client_duplicate_candidates(uuid) to authenticated;

-- ── 4b. Dedup del registro público por las TRES llaves ───────
--
-- El dedup vigente (registro/actions.ts) compara sólo el documento y por eso deja
-- pasar al legado. Esta función mira documento, correo y teléfono, y dice CUÁL
-- coincidió para que el formulario ponga el aviso en el campo correcto.
--
-- Es *_service (sin assert_tenant_match, EXECUTE sólo para service_role) por el
-- mismo motivo que next_markbox_service (0109): el registrante es ANÓNIMO, la
-- action corre con el admin client y no hay tenant autenticado. No es forjable
-- desde el navegador.
--
-- Devuelve el id, pero la capa web NUNCA se lo enseña al visitante: sólo usa el
-- hecho de que existe y por qué. Esa es la regla de privacidad del registro.

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
      case
        when length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 7
          then right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 7)
      end as tel
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
      or (q.tel is not null
           and length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')) >= 7
           and right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 7) = q.tel)
    )
  -- El documento es la señal más fuerte; el teléfono la más débil (una familia
  -- puede compartir número). Si hay varias, gana la más fuerte.
  order by case
    when q.doc is not null
      and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc then 0
    when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em then 1
    else 2 end
  limit 1;
$$;

comment on function public.find_duplicate_client_service is
  'SDD-0244: ¿ya existe una ficha con este documento, correo o teléfono? Devuelve la primera y por cuál llave coincidió. Path-servidor-de-confianza (el registrante es anónimo): EXECUTE sólo para service_role.';

revoke all on function public.find_duplicate_client_service(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.find_duplicate_client_service(uuid, text, text, text)
  to service_role;

-- ── 5. La fusión ─────────────────────────────────────────────
--
-- Superviviente = el VIEJO, por su código: carga el historial y es el que el
-- cliente ya le pasó a su proveedor.
-- Datos ganadores = los del NUEVO: vienen limpios del registro (documento bien
-- formado, correo, teléfono). Se copian SÓLO donde el superviviente está vacío,
-- así cada fusión además rellena una de las 144 fichas sin documento.
--
-- ⚠️ ORDEN OBLIGATORIO: primero se soft-deletea la ficha fusionada, DESPUÉS se
-- rellena el superviviente. Los índices clients_tenant_doc_unique y
-- clients_kommo_lead_unique son parciales `where deleted_at is null`: si se
-- copiara el documento mientras la otra ficha sigue viva, chocarían.

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

comment on function public.merge_clients is
  'SDD-0244: fusiona la ficha duplicada (p_merged_id) en la superviviente (p_survivor_id). Muda el acceso y el historial, rellena los huecos del superviviente con los datos limpios del registro, y retira la ficha duplicada soft-deleted conservando su markbox para que siga resolviendo y nunca se reemita. Atómica: o pasa entera o no pasa. NO mueve legal_acceptances (una aceptación está atada a quién la aceptó).';

revoke all on function public.merge_clients(uuid, uuid) from public, anon;
grant execute on function public.merge_clients(uuid, uuid) to authenticated;
