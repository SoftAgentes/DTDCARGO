-- ─────────────────────────────────────────────────────────────────────────────
-- 0566 · SDD-0676 — «Vincular a cliente»: el contacto de Chatwoot unido a una
-- ficha se reconoce solo, en cualquier canal (decisiones de Sam, 2026-11-18:
-- «Las cinco preguntas recomendadas, correcto en todas.»).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN NI A NINGÚN OTRO ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK nominal de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO autoriza
--    aplicarla. El web anterior sigue funcionando con ella aplicada
--    (chatwoot_registrar_evento conserva sus 13 parámetros y suma uno con valor
--    por defecto), y el web actual tolera que falte: vuelve solo al cruce por
--    teléfono y «Vincular» une sin canal ni absorción (degradación declarada,
--    ver la espera).
--    REQUIERE la 0504, la 0506, la 0513, la 0519 y la 0554 (el preflight para si
--    falta alguna).
--
--    ORDEN OBLIGATORIO: EL WEB PRIMERO, LA 0566 DESPUÉS. El web de la corrección
--    (PR #696) tiene que estar publicado ANTES de aplicarla. La razón: desde que la
--    0566 existe, el chat del portal deja su unión en chatwoot_contact_links, y un
--    web anterior a la #696 la trataría como una unión cualquiera: le escribiría el
--    segmento y el Shipping Mark al contacto del portal en Chatwoot (a ese contacto
--    solo van su nombre y su identificador) y le pondría «Quitar» en la ficha del
--    cliente. El web de la #696 tolera que la 0566 falte.
--
-- CORREGIDA ANTES DE APLICARSE (Sam, 2026-11-18: «Ok, te encargo la corrección
-- al 0566»). La primera versión dejaba sin cliente una conversación cuando un
-- evento traía contacto, sin unión y sin teléfono. El chat del portal (0519)
-- fija su cliente sin teléfono y sin unión: el primer evento posterior se lo
-- habría quitado. Dos cambios lo cierran: un solo registro de vínculos, también
-- para el portal (punto 7), y ningún evento automático quita un cliente (punto 4).
--
-- ── Qué cambia ──────────────────────────────────────────────────────
-- 1. chatwoot_contact_links.canal_chat: por qué canal escribe ese contacto
--    (whatsapp | instagram | messenger | tiktok | correo | otro | portal). No es
--    un dato personal: sirve para pintar el logo sin llamar a Chatwoot. Nulo en
--    las uniones anteriores; se llena cuando se vuelve a vincular.
--    El origen de una unión suma el valor «portal» (se rehace su CHECK).
-- 1b. chatwoot_conversations.chat_contact_id: de qué contacto de Chatwoot es la
--    conversación. Nulo en las anteriores; se llena con su siguiente evento.
-- 2. crm_tarjetas.absorbida_en / absorbida_at: la tarjeta del lead que ese
--    contacto ya tenía queda ABSORBIDA en la tarjeta del cliente. No se mueve
--    ninguna fila: su historial de etapas, notas y tareas siguen colgando de
--    ella, y el tablero deja de pintarla. Quitar la unión borra la marca y la
--    tarjeta vuelve a su tablero, en la etapa donde estaba.
--    Al absorber se le quita phone_last10 (el teléfono ya vive en la ficha, y
--    así la entrada web no la confunde con un lead suelto); el nombre visible
--    se conserva para poder deshacer.
-- 3. chatwoot_ficha_de_contacto(tenant, contacto): la ficha viva unida a ese
--    contacto, o null. Solo service_role.
-- 4. El cruce de una conversación con su ficha, en chatwoot_registrar_evento
--    (parámetro nuevo p_contact_id, default null):
--      unión del contacto → teléfono con ficha única → si no hay ninguno, SE
--      CONSERVA el cliente que la conversación ya tenía.
--    NINGÚN evento automático deja una conversación sin cliente. Eso incluye el
--    teléfono que dejó de coincidir con una ficha (antes de la 0566 volvía a
--    null): se conserva, porque un cambio de teléfono en la ficha no cambia de
--    quién es el chat. Un teléfono que ahora cruza con OTRA ficha única sí la
--    cambia, y una unión manda siempre sobre el teléfono.
--    crm_entrada_chatwoot y crm_asesor_desde_chatwoot: misma firma, unión primero
--    y teléfono después. Si la tarjeta que encuentran está absorbida, trabajan
--    sobre la del cliente.
-- 5. chatwoot_vincular_contacto(tenant, actor, ficha, contacto, canal, motivo,
--    mover): «Vincular a cliente» de la Ficha DTD y «Vincular otra red» de la
--    ficha del cliente. Solo service_role, con la comprobación del actor de la
--    0554 (membresía activa y edición de la Bandeja). Une, absorbe la tarjeta
--    del lead, pasa a esa ficha las conversaciones de ese contacto y audita. Un
--    contacto unido a OTRA ficha solo se mueve con p_mover = true: quita la
--    unión anterior (auditada en esa ficha) y crea la nueva. La unión del portal
--    no se mueve (55000).
-- 6. Solo una persona deja una conversación sin cliente, y queda auditado:
--    · chatwoot_quitar_union: además de soltar la tarjeta absorbida, deja sin
--      ficha las conversaciones de ESE contacto. No quita la unión del portal
--      (55000): la pone el sistema y se va con la ficha.
--    · el disparador de ficha borrada: deja sin ficha TODAS las conversaciones de
--      la ficha (unidas o cruzadas por teléfono) y suelta las tarjetas absorbidas.
-- 7. chatwoot_portal_vincular (0519), misma firma: además deja la unión del
--    contacto del portal en chatwoot_contact_links (origen y canal «portal»,
--    auditada como del sistema) y anota el contacto en la conversación. Los
--    contactos del portal que YA existían no se migran aquí: van en
--    supabase/cargas/portal-uniones-0566/, con un OK de Sam aparte.
-- chatwoot_unir_contacto_manual (0554) queda como está; el código deja de
-- llamarla. chatwoot_portal_vincular_carga (0524, la carga histórica ya hecha)
-- no se toca: si se volviera a usar, sus contactos los recoge el relleno.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────
-- Ninguna fila existente: no hay relleno ni cambio de datos al aplicarla. Ni la
-- regla de segmentos (0505/0506), ni la anonimización de leads perdidos, ni
-- crm_alta_tarjeta_web, ni las tablas del portal.
--
-- ── Locks ───────────────────────────────────────────────────────────
-- ADD COLUMN sin default (instantáneo) en chatwoot_contact_links, crm_tarjetas
-- y chatwoot_conversations; la llave foránea de absorbida_en apunta a la misma
-- tabla y se valida contra una columna toda nula. Rehacer el CHECK del origen
-- recorre chatwoot_contact_links una vez (tabla chica: una fila por contacto
-- unido). lock_timeout 5 s: si hay espera, falla y se reintenta.
--
-- ── Idempotente ─────────────────────────────────────────────────────
-- add column if not exists, create index if not exists, create or replace, el
-- CHECK del origen se quita y se vuelve a poner, y drop function if exists de la
-- firma vieja de chatwoot_registrar_evento.
--
-- ── Deshacer ────────────────────────────────────────────────────────
-- supabase/desarmes/0566_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Devuelve las funciones a su cuerpo anterior, suelta las tarjetas
-- absorbidas y borra las uniones de origen «portal» (el dato sigue en
-- chatwoot_portal_contactos); las demás uniones quedan.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.chatwoot_contact_links') is null
     or pg_catalog.to_regprocedure('public.chatwoot_contact_links_actor_puede(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)') is null then
    raise exception '0566 requiere la 0554 (chatwoot_contact_links y sus funciones)';
  end if;
  if pg_catalog.to_regclass('public.crm_tarjetas') is null
     or pg_catalog.to_regprocedure('public.crm_segmento_cliente(uuid,uuid)') is null then
    raise exception '0566 requiere la 0506 (crm_tarjetas)';
  end if;
  if pg_catalog.to_regprocedure('public.crm_ficha_por_telefono(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.crm_buscar_tarjeta(uuid,uuid,bigint,text,text)') is null
     or pg_catalog.to_regprocedure('public.crm_asesor_activo(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.crm_usuario_de_agente(uuid,bigint)') is null
     or pg_catalog.to_regprocedure('public.crm_volver_a_recontacto(uuid,uuid,text,timestamptz)') is null
     or pg_catalog.to_regprocedure(
       'public.crm_entrada_chatwoot(uuid,bigint,text,text,text,text,bigint,text,timestamptz)') is null
     or pg_catalog.to_regprocedure('public.crm_asesor_desde_chatwoot(uuid,bigint,text,text,bigint)') is null then
    raise exception '0566 requiere la 0513 (entrada de leads)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_conversations') is null
     or pg_catalog.to_regclass('public.chatwoot_webhook_events') is null then
    raise exception '0566 requiere la 0504 (chatwoot_conversations y chatwoot_webhook_events)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_portal_contactos') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_hilos') is null
     or pg_catalog.to_regclass('public.conversations') is null then
    raise exception '0566 requiere la 0519 (chat del portal: chatwoot_portal_contactos y chatwoot_portal_hilos)';
  end if;
end;
$preflight$;

-- ─── 1. El canal de la unión ──────────────────────────────────────────────
alter table public.chatwoot_contact_links
  add column if not exists canal_chat text
  constraint chatwoot_contact_links_canal_chat_check
    check (canal_chat in ('whatsapp', 'instagram', 'messenger', 'tiktok', 'correo', 'otro', 'portal'));

comment on column public.chatwoot_contact_links.canal_chat is
  'SDD-0676: canal del contacto (whatsapp | instagram | messenger | tiktok | correo | otro | portal), para el logo. Nulo en las uniones anteriores a la 0566.';

-- El chat del portal (0519) pasa a tener su unión aquí, con origen «portal»: la
-- escribe chatwoot_portal_vincular y nadie la quita ni la mueve a mano.
do $origen$
declare
  r record;
begin
  -- El CHECK del origen nació sin nombre propio en la 0554: se busca por su contenido.
  for r in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.chatwoot_contact_links'::regclass
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%kommo%'
  loop
    execute pg_catalog.format('alter table public.chatwoot_contact_links drop constraint %I', r.conname);
  end loop;
  alter table public.chatwoot_contact_links add constraint chatwoot_contact_links_origen_check
    check (origen in ('webhook', 'kommo', 'manual', 'portal'));
end;
$origen$;

-- ─── 1b. De qué contacto es cada conversación ─────────────────────────────
-- Hace falta para que quitar una unión deje sin ficha SOLO las conversaciones de ese
-- contacto. La llenan chatwoot_registrar_evento (cuando el evento trae el contacto) y
-- chatwoot_portal_vincular. Nula en las conversaciones anteriores: se llena con su
-- siguiente evento. Es un id de Chatwoot, no un dato personal.
alter table public.chatwoot_conversations
  add column if not exists chat_contact_id bigint;

create index if not exists chatwoot_conversations_chat_contact_idx
  on public.chatwoot_conversations (tenant_id, chat_contact_id) where chat_contact_id is not null;

comment on column public.chatwoot_conversations.chat_contact_id is
  'SDD-0676: id del contacto de Chatwoot de la conversación. Lo usan quitar una unión y vincular para tocar solo las conversaciones de ese contacto. Nulo hasta el primer evento posterior a la 0566.';

-- ─── 2. La tarjeta absorbida ──────────────────────────────────────────────
alter table public.crm_tarjetas
  add column if not exists absorbida_en uuid references public.crm_tarjetas(id) on delete set null;
alter table public.crm_tarjetas
  add column if not exists absorbida_at timestamptz;

create index if not exists crm_tarjetas_absorbida_idx
  on public.crm_tarjetas (absorbida_en) where absorbida_en is not null;

do $check$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_tarjetas'::regclass and conname = 'crm_tarjetas_absorbida_check'
  ) then
    -- Solo se absorbe la tarjeta de un lead (sin ficha), y nunca en sí misma.
    alter table public.crm_tarjetas add constraint crm_tarjetas_absorbida_check
      check (absorbida_en is null or (client_id is null and absorbida_en <> id));
  end if;
end;
$check$;

comment on column public.crm_tarjetas.absorbida_en is
  'SDD-0676: tarjeta del cliente que absorbió a esta tarjeta de lead cuando su contacto de Chatwoot se vinculó a la ficha. Con valor, el tablero no la pinta; su historial, notas y tareas se ven en la tarjeta del cliente. Quitar la unión la deja en null.';

-- ─── 3. La ficha de un contacto ───────────────────────────────────────────
create or replace function public.chatwoot_ficha_de_contacto(p_tenant_id uuid, p_contact_id bigint)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select l.client_id
  from public.chatwoot_contact_links l
  join public.clients c on c.id = l.client_id
  where l.tenant_id = p_tenant_id
    and l.chatwoot_contact_id = p_contact_id
    and c.tenant_id = p_tenant_id
    and c.deleted_at is null;
$fn$;

comment on function public.chatwoot_ficha_de_contacto(uuid, bigint) is
  'SDD-0676: la ficha viva del tenant unida a ese contacto de Chatwoot (chatwoot_contact_links), o null. Solo service_role.';

revoke all on function public.chatwoot_ficha_de_contacto(uuid, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_ficha_de_contacto(uuid, bigint) to service_role;

-- ─── 4. Absorber y soltar la tarjeta del lead ─────────────────────────────
-- Devuelve la tarjeta absorbida, o null si ese contacto no tenía tarjeta de lead.
-- Si el cliente no tiene tarjeta, se crea la suya con la fuente del lead (por
-- ese canal llegó). Dueño: el de la tarjeta del cliente; si no tiene, el asesor
-- de la ficha y, si tampoco, el del lead.
create or replace function public.crm_absorber_tarjeta_de_contacto(
  p_tenant_id uuid, p_client_id uuid, p_contact_id bigint
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_lead    uuid;
  v_asesor  uuid;
  v_fuente  text;
  v_ultima  timestamptz;
  v_cliente uuid;
begin
  select t.id, t.asesor_id, t.fuente, t.ultima_actividad_at
    into v_lead, v_asesor, v_fuente, v_ultima
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id
    and t.chatwoot_contact_id = p_contact_id
    and t.client_id is null
    and t.anonimizada_at is null
    and t.absorbida_en is null
  for update;
  if v_lead is null then
    return null;
  end if;

  select t.id into v_cliente
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id and t.client_id = p_client_id
  for update;

  if v_cliente is null then
    insert into public.crm_tarjetas as t (tenant_id, client_id, etapa_leads, asesor_id, fuente, ultima_actividad_at)
    select p_tenant_id, p_client_id,
           case when public.crm_segmento_cliente(p_tenant_id, p_client_id) = 'lead_nuevo'
                then 'nuevo' else 'registrado_recontacto' end,
           coalesce(
             (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = p_client_id),
             public.crm_asesor_activo(p_tenant_id, v_asesor)),
           v_fuente, v_ultima
    on conflict do nothing
    returning t.id into v_cliente;
    if v_cliente is null then
      -- Otra transacción la creó entre la búsqueda y la inserción.
      select t.id into v_cliente
      from public.crm_tarjetas t
      where t.tenant_id = p_tenant_id and t.client_id = p_client_id
      for update;
    end if;
    if v_cliente is null then
      raise exception 'crm_absorber_tarjeta_de_contacto: conflicto sin tarjeta' using errcode = '40001';
    end if;
  end if;

  update public.crm_tarjetas t
  set asesor_id = coalesce(
        t.asesor_id,
        (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = p_client_id),
        public.crm_asesor_activo(p_tenant_id, v_asesor)),
      ultima_actividad_at = greatest(t.ultima_actividad_at, v_ultima)
  where t.id = v_cliente;

  update public.crm_tarjetas t
  set absorbida_en = v_cliente,
      absorbida_at = pg_catalog.now(),
      phone_last10 = null
  where t.id = v_lead;

  return v_lead;
end;
$fn$;

comment on function public.crm_absorber_tarjeta_de_contacto(uuid, uuid, bigint) is
  'SDD-0676: marca como absorbida la tarjeta de lead de ese contacto de Chatwoot en la tarjeta del cliente (la crea si falta). No mueve historial, notas ni tareas. Interna.';

revoke all on function public.crm_absorber_tarjeta_de_contacto(uuid, uuid, bigint) from public, anon, authenticated, service_role;

create or replace function public.crm_soltar_tarjeta_de_contacto(p_tenant_id uuid, p_contact_id bigint)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_lead uuid;
begin
  update public.crm_tarjetas t
  set absorbida_en = null, absorbida_at = null
  where t.tenant_id = p_tenant_id
    and t.chatwoot_contact_id = p_contact_id
    and t.absorbida_en is not null
  returning t.id into v_lead;
  return v_lead;
end;
$fn$;

comment on function public.crm_soltar_tarjeta_de_contacto(uuid, bigint) is
  'SDD-0676: deshace la absorción de la tarjeta de lead de ese contacto: vuelve a su tablero en la etapa donde estaba. Interna.';

revoke all on function public.crm_soltar_tarjeta_de_contacto(uuid, bigint) from public, anon, authenticated, service_role;

-- ─── 5. «Vincular a cliente» ──────────────────────────────────────────────
create or replace function public.chatwoot_vincular_contacto(
  p_tenant_id     uuid,
  p_actor_user_id uuid,
  p_client_id     uuid,
  p_contact_id    bigint,
  p_canal         text,
  p_motivo        text,
  p_mover         boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_motivo    text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_actual    uuid;
  v_origen    text;
  v_resultado text := 'unido';
  v_tarjeta   uuid;
begin
  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
  if p_contact_id is null or p_contact_id <= 0 then
    raise exception 'chatwoot_vincular_contacto: contacto inválido' using errcode = '22023';
  end if;
  if p_canal is not null and p_canal not in ('whatsapp', 'instagram', 'messenger', 'tiktok', 'correo', 'otro') then
    raise exception 'chatwoot_vincular_contacto: canal inválido' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_vincular_contacto: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.tenant_id = p_tenant_id and c.deleted_at is null
  ) then
    raise exception 'chatwoot_vincular_contacto: ficha inexistente' using errcode = 'P0002';
  end if;

  select l.client_id, l.origen into v_actual, v_origen
  from public.chatwoot_contact_links l
  where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id
  for update;

  if v_actual = p_client_id then
    -- Ya estaba: se completa el canal si faltaba y la absorción si quedó pendiente.
    update public.chatwoot_contact_links l
    set canal_chat = coalesce(l.canal_chat, p_canal)
    where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id;
    v_tarjeta := public.crm_absorber_tarjeta_de_contacto(p_tenant_id, p_client_id, p_contact_id);
    if v_tarjeta is not null then
      -- La unión ya existía (webhook, Kommo o a mano) y la tarjeta del lead seguía suelta:
      -- absorberla ahora saca una tarjeta del tablero, así que queda con el actor y el motivo.
      perform public.append_audit_event(
        p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
        'chatwoot_contact_linked', 'studio', 'succeeded', v_motivo,
        null,
        pg_catalog.jsonb_build_object(
          'chatwoot_contact_id', p_contact_id, 'origen', v_origen, 'canal', p_canal,
          'tarjeta_absorbida', v_tarjeta),
        pg_catalog.jsonb_build_object('solo_absorcion', true),
        pg_catalog.concat('chatwoot-contact-absorb:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
        1,
        'internal'
      );
    end if;
    return pg_catalog.jsonb_build_object('resultado', 'ya_estaba', 'tarjeta_absorbida', v_tarjeta is not null);
  end if;

  if v_actual is not null then
    if v_origen = 'portal' then
      -- El contacto del portal es de su ficha por construcción (0519): no se mueve a mano.
      raise exception 'chatwoot_vincular_contacto: el chat del portal no se mueve de ficha' using errcode = '55000';
    end if;
    if not coalesce(p_mover, false) then
      raise exception 'chatwoot_vincular_contacto: ese chat ya está unido a otra ficha' using errcode = '23505';
    end if;
    delete from public.chatwoot_contact_links l
    where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id;
    perform public.crm_soltar_tarjeta_de_contacto(p_tenant_id, p_contact_id);
    perform public.append_audit_event(
      p_tenant_id, 'chatwoot_contact_link', v_actual, 'user', p_actor_user_id,
      'chatwoot_contact_unlinked', 'studio', 'succeeded', v_motivo,
      pg_catalog.jsonb_build_object('chatwoot_contact_id', p_contact_id, 'origen', v_origen),
      null,
      pg_catalog.jsonb_build_object('movido_a', p_client_id),
      pg_catalog.concat('chatwoot-contact-unlink:', v_actual::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
      1,
      'internal'
    );
    v_resultado := 'movido';
  end if;

  -- Si el contacto está unido en OTRO tenant, la llave lo rechaza con el mismo
  -- 23505 que «otra ficha» sin p_mover: no se distingue un caso del otro.
  -- Doble clic: dos llamadas a la vez no ven la fila de la otra; la segunda espera en
  -- la llave y recibe el 23505. Si la que ganó unió a ESTA ficha, es «ya_estaba».
  begin
    insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
    values (p_tenant_id, p_client_id, p_contact_id, 'manual', p_actor_user_id, p_canal);
  exception when unique_violation then
    select l.client_id into v_actual
    from public.chatwoot_contact_links l
    where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id;
    if v_actual is distinct from p_client_id then
      raise exception 'chatwoot_vincular_contacto: ese chat ya está unido a otra ficha' using errcode = '23505';
    end if;
    -- Igual que la rama «ya_estaba» de arriba: si la fila que ganó no traía canal, se completa.
    update public.chatwoot_contact_links l
    set canal_chat = coalesce(l.canal_chat, p_canal)
    where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id;
    return pg_catalog.jsonb_build_object('resultado', 'ya_estaba', 'tarjeta_absorbida', false);
  end;

  -- Las conversaciones de ese contacto pasan a ser de esta ficha desde ya (al mover, dejan
  -- de ser de la anterior): no hace falta esperar a su siguiente evento.
  update public.chatwoot_conversations cc
  set client_id = p_client_id
  where cc.tenant_id = p_tenant_id
    and cc.chat_contact_id = p_contact_id
    and cc.client_id is distinct from p_client_id;

  v_tarjeta := public.crm_absorber_tarjeta_de_contacto(p_tenant_id, p_client_id, p_contact_id);

  perform public.append_audit_event(
    p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
    'chatwoot_contact_linked', 'studio', 'succeeded', v_motivo,
    null,
    pg_catalog.jsonb_build_object(
      'chatwoot_contact_id', p_contact_id, 'origen', 'manual', 'canal', p_canal,
      'tarjeta_absorbida', v_tarjeta),
    case when v_resultado = 'movido'
         then pg_catalog.jsonb_build_object('movido_de', v_actual) else '{}'::jsonb end,
    pg_catalog.concat('chatwoot-contact-link:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return pg_catalog.jsonb_build_object('resultado', v_resultado, 'tarjeta_absorbida', v_tarjeta is not null);
end;
$fn$;

comment on function public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean) is
  'SDD-0676: «Vincular a cliente». Solo service_role (el ERP, después de su candado): comprueba otra vez al actor (membresía activa y edición de la Bandeja) y la ficha; une el contacto con su canal, absorbe la tarjeta del lead y audita con el actor real. Un chat unido a otra ficha solo se mueve con p_mover.';

revoke all on function public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean) from public, anon, authenticated;
grant execute on function public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean) to service_role;

-- ─── 6. Quitar la unión: además suelta la tarjeta absorbida ───────────────
create or replace function public.chatwoot_quitar_union(
  p_tenant_id uuid, p_actor_user_id uuid, p_client_id uuid, p_contact_id bigint, p_motivo text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_motivo  text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_fila    public.chatwoot_contact_links;
  v_tarjeta uuid;
  v_convs   integer := 0;
begin
  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_quitar_union: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.chatwoot_contact_links l
    where l.tenant_id = p_tenant_id and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id
      and l.origen = 'portal'
  ) then
    -- La unión del portal la pone el sistema (0519) y se va con la ficha: no se quita a mano.
    raise exception 'chatwoot_quitar_union: el chat del portal no se desvincula' using errcode = '55000';
  end if;

  delete from public.chatwoot_contact_links l
  where l.tenant_id = p_tenant_id and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id
  returning l.* into v_fila;
  if not found then
    return false;
  end if;

  v_tarjeta := public.crm_soltar_tarjeta_de_contacto(p_tenant_id, p_contact_id);

  -- Quitar la unión es la decisión de una persona: las conversaciones de ese contacto
  -- dejan de ser de esta ficha. Ningún evento automático hace esto.
  update public.chatwoot_conversations cc
  set client_id = null
  where cc.tenant_id = p_tenant_id
    and cc.chat_contact_id = p_contact_id
    and cc.client_id = p_client_id;
  get diagnostics v_convs = row_count;

  perform public.append_audit_event(
    p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
    'chatwoot_contact_unlinked', 'studio', 'succeeded', v_motivo,
    pg_catalog.jsonb_build_object(
      'chatwoot_contact_id', v_fila.chatwoot_contact_id, 'origen', v_fila.origen, 'canal', v_fila.canal_chat),
    null,
    pg_catalog.jsonb_build_object('tarjeta_restaurada', v_tarjeta, 'conversaciones_sin_ficha', v_convs),
    pg_catalog.concat('chatwoot-contact-unlink:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return true;
end;
$fn$;

comment on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) is
  'SDD-0650 F2 (D4) y SDD-0676: deshace una unión chat ↔ ficha (salvo la del portal, que no se quita a mano), suelta la tarjeta de lead absorbida y deja sin ficha las conversaciones de ese contacto. Solo service_role, con la misma comprobación del actor que unir; motivo; auditada con el actor real.';

revoke all on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) to service_role;

create or replace function public.chatwoot_contact_links_al_borrar_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid       uuid := (select auth.uid());
  v_contactos bigint[];
  v_tarjetas  uuid[];
  v_convs     integer := 0;
begin
  if new.deleted_at is not null and old.deleted_at is null then
    with borradas as (
      delete from public.chatwoot_contact_links l where l.client_id = new.id
      returning l.chatwoot_contact_id
    )
    select pg_catalog.array_agg(b.chatwoot_contact_id order by b.chatwoot_contact_id) into v_contactos from borradas b;

    -- SDD-0676: como ningún evento automático quita ya un cliente, es aquí donde las
    -- conversaciones de la ficha borrada dejan de apuntarla (todas: unidas o por teléfono).
    update public.chatwoot_conversations cc
    set client_id = null
    where cc.tenant_id = new.tenant_id and cc.client_id = new.id;
    get diagnostics v_convs = row_count;

    if v_contactos is not null then
      -- SDD-0676: las tarjetas de lead que absorbió vuelven a su tablero.
      with sueltas as (
        update public.crm_tarjetas t
        set absorbida_en = null, absorbida_at = null
        where t.tenant_id = new.tenant_id
          and t.chatwoot_contact_id = any (v_contactos)
          and t.absorbida_en is not null
        returning t.id
      )
      select pg_catalog.array_agg(s.id order by s.id) into v_tarjetas from sueltas s;
    end if;

    if v_contactos is not null or v_convs > 0 then
      perform public.append_audit_event(
        new.tenant_id, 'chatwoot_contact_link', new.id,
        case when v_uid is null then 'system' else 'user' end, v_uid,
        'chatwoot_contact_unlinked', 'rpc', 'succeeded', 'Ficha borrada: sus chats dejan de estar unidos',
        pg_catalog.jsonb_build_object(
          'chatwoot_contact_ids', coalesce(pg_catalog.to_jsonb(v_contactos), '[]'::jsonb), 'motivo', 'ficha_borrada',
          'tarjetas_soltadas', coalesce(pg_catalog.to_jsonb(v_tarjetas), '[]'::jsonb),
          'conversaciones_sin_ficha', v_convs),
        null,
        '{}'::jsonb,
        pg_catalog.concat('chatwoot-contact-unlink:', new.id::text, ':ficha-borrada:', pg_catalog.txid_current()::text),
        1,
        'internal'
      );
    end if;
  end if;
  return null;
end;
$fn$;

revoke all on function public.chatwoot_contact_links_al_borrar_ficha() from public, anon, authenticated;

-- ─── 7. El evento: unión primero, teléfono después ────────────────────────
drop function if exists public.chatwoot_registrar_evento(
  uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean);

create or replace function public.chatwoot_registrar_evento(
  p_tenant_id         uuid,
  p_event_key         text,
  p_event             text,
  p_conversation_id   bigint,
  p_inbox_id          bigint,
  p_status            text,
  p_unread_count      integer,
  p_assignee_id       bigint,
  p_phone_last10      text,
  p_last_activity_at  timestamptz,
  p_source_updated_at double precision,
  p_message_id        bigint default null,
  p_avisar            boolean default false,
  p_contact_id        bigint default null
)
returns table (nuevo boolean, aplicado boolean, client_id uuid, origen_cliente text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_filas    integer;
  v_cliente  uuid;
  -- De dónde salió el cliente que se devuelve: 'union' | 'telefono' | 'conservado' | null.
  -- Quien une solo (chatwoot_unir_contactos, origen webhook) lo hace ÚNICAMENTE con
  -- 'telefono': un cliente conservado no prueba que el teléfono haya cruzado.
  v_origen   text;
  v_guardado uuid;
  v_cruces   integer := 0;
  v_telefono boolean := coalesce(p_phone_last10 ~ '^[0-9]{10}$', false);
  v_contacto boolean := p_contact_id is not null and p_contact_id > 0;
begin
  if p_tenant_id is null or p_conversation_id is null or p_conversation_id <= 0 then
    raise exception 'chatwoot_registrar_evento: tenant y conversación son obligatorios';
  end if;

  -- Idempotencia: el mismo evento dos veces no hace nada la segunda, salvo que
  -- la primera haya fallado (o se haya colgado): entonces se reclama.
  if p_event_key is not null then
    insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id, message_id, avisar, assignee_id)
    values (p_tenant_id, p_event_key, p_event, p_conversation_id, p_message_id, coalesce(p_avisar, false), p_assignee_id)
    on conflict on constraint chatwoot_webhook_events_pkey do nothing;
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      update public.chatwoot_webhook_events e
      set status = 'procesando', attempts = e.attempts + 1, updated_at = pg_catalog.now(), next_attempt_at = null
      where e.tenant_id = p_tenant_id
        and e.event_key = p_event_key
        and e.attempts < 5
        and (e.status = 'fallido'
             or (e.status = 'procesando' and e.updated_at < pg_catalog.now() - interval '5 minutes'));
      get diagnostics v_filas = row_count;
      if v_filas = 0 then
        return query select false, false, null::uuid, null::text;
        return;
      end if;
    end if;
  end if;

  -- SDD-0676: primero la unión del contacto (chatwoot_contact_links); una
  -- unión hecha a mano manda sobre el teléfono.
  if v_contacto then
    v_cliente := public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id);
    if v_cliente is not null then
      v_origen := 'union';
    end if;
  end if;

  -- Después, el teléfono: exactamente una ficha o nada (phone_last10 no es único).
  if v_cliente is null and v_telefono then
    select (pg_catalog.array_agg(c.id))[1], pg_catalog.count(*)
      into v_cliente, v_cruces
    from public.clients c
    where c.tenant_id = p_tenant_id
      and c.phone_last10 = p_phone_last10
      and c.deleted_at is null;
    if v_cruces <> 1 then
      v_cliente := null;
    else
      v_origen := 'telefono';
    end if;
  end if;

  -- Carrera con el borrado de la ficha: se toma la ficha encontrada con FOR SHARE. Si
  -- alguien la está borrando, este evento espera y, al seguir, ya la ve borrada y no la
  -- escribe; si este evento va primero, el borrado espera y su disparador limpia después.
  if v_cliente is not null then
    perform 1 from public.clients c
    where c.id = v_cliente and c.tenant_id = p_tenant_id and c.deleted_at is null
    for share;
    if not found then
      v_cliente := null;
      v_origen := null;
    end if;
  end if;

  insert into public.chatwoot_conversations as cc (
    tenant_id, conversation_id, inbox_id, status, unread_count, assignee_id,
    client_id, last_activity_at, source_updated_at, updated_at, chat_contact_id
  ) values (
    p_tenant_id, p_conversation_id, p_inbox_id, p_status, greatest(coalesce(p_unread_count, 0), 0),
    p_assignee_id, v_cliente, p_last_activity_at, coalesce(p_source_updated_at, 0), pg_catalog.now(),
    case when v_contacto then p_contact_id end
  )
  on conflict (tenant_id, conversation_id) do update set
    inbox_id          = excluded.inbox_id,
    status            = excluded.status,
    unread_count      = excluded.unread_count,
    assignee_id       = excluded.assignee_id,
    -- NINGÚN evento automático quita un cliente: si este evento no encontró ficha (ni
    -- unión, ni teléfono con ficha única), se conserva la que la conversación ya tenía.
    -- Así sobreviven el chat del portal (0519, que fija su cliente sin teléfono) y un
    -- teléfono que dejó de coincidir. Solo chatwoot_quitar_union y el borrado de la ficha,
    -- que son decisiones de una persona, dejan una conversación sin cliente.
    -- El conservado se revalida aquí mismo: una ficha borrada no se conserva.
    client_id         = coalesce(
                          excluded.client_id,
                          (select c.id from public.clients c
                           where c.id = cc.client_id and c.tenant_id = cc.tenant_id and c.deleted_at is null)),
    chat_contact_id   = coalesce(excluded.chat_contact_id, cc.chat_contact_id),
    last_activity_at  = excluded.last_activity_at,
    source_updated_at = excluded.source_updated_at,
    updated_at        = pg_catalog.now()
  where cc.source_updated_at <= excluded.source_updated_at
  returning cc.client_id into v_guardado;
  get diagnostics v_filas = row_count;

  -- Devuelve el cliente que la conversación tiene de verdad y de dónde salió. Si este
  -- evento no encontró ficha y la conversación conservó la suya, es 'conservado'.
  if v_filas = 1 and v_cliente is null and v_guardado is not null then
    v_origen := 'conservado';
  end if;
  return query select true, v_filas = 1, case when v_filas = 1 then v_guardado else v_cliente end, v_origen;
end;
$fn$;

comment on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean, bigint) is
  'SDD-0585 E2-D18/E2-D19/E2-D22 y SDD-0676: registra un evento de Chatwoot (idempotente por event_key) y aplica el estado de la conversación si no es más viejo que lo guardado. El cliente sale de la unión del contacto (0554) y, si no hay, del teléfono con ficha única; si tampoco, se conserva el que la conversación ya tenía, salvo que esa ficha esté borrada (ningún evento quita un cliente). Devuelve además origen_cliente (union | telefono | conservado): solo con telefono se une sola. event_key nulo = reconciliación por API. Solo service_role.';

revoke all on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean, bigint) to service_role;

-- ─── 7b. El chat del portal: su unión va al registro único ───────────────
-- Misma firma y mismas reglas que en la 0519. Dos cosas nuevas: deja la unión del
-- contacto del portal en chatwoot_contact_links (origen y canal «portal», auditada) y
-- anota el contacto en la conversación. Los contactos del portal que ya existían NO se
-- migran aquí: van en supabase/cargas/portal-uniones-0566/ (con OK de Sam aparte).
create or replace function public.chatwoot_portal_vincular(
  p_tenant_id          uuid,
  p_hilo_id            uuid,
  p_contacto_id        bigint,
  p_contacto_source_id text,
  p_inbox_id           bigint default null,
  p_conversacion_id    bigint default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_client uuid;
  v_actual bigint;
  v_filas  integer;
begin
  select c.client_id into v_client
  from public.conversations c
  where c.id = p_hilo_id and c.tenant_id = p_tenant_id and c.channel = 'portal';
  if v_client is null then
    raise exception 'chatwoot_portal_vincular: hilo del portal no encontrado' using errcode = 'P0002';
  end if;
  if p_contacto_id is null or p_contacto_id <= 0 or p_contacto_id > 2147483647 then
    raise exception 'chatwoot_portal_vincular: id de contacto inválido' using errcode = '22023';
  end if;

  select k.chatwoot_contact_id into v_actual
  from public.chatwoot_portal_contactos k
  where k.tenant_id = p_tenant_id and k.client_id = v_client
  for update;
  if not found then
    -- Sin identificador guardado no hay contacto legítimo: lo crea chatwoot_portal_tomar.
    raise exception 'chatwoot_portal_vincular: la ficha no tiene identificador' using errcode = 'P0002';
  end if;
  if v_actual is not null and v_actual <> p_contacto_id then
    raise exception 'chatwoot_portal_vincular: la ficha ya tiene otro contacto' using errcode = '23505';
  end if;
  update public.chatwoot_portal_contactos k
  set chatwoot_contact_id = p_contacto_id, chatwoot_source_id = p_contacto_source_id, updated_at = pg_catalog.now()
  where k.tenant_id = p_tenant_id and k.client_id = v_client;

  -- SDD-0676: la unión del contacto del portal, en el mismo registro que las demás. Si
  -- ese contacto ya tiene una unión (esta misma, o una que alguien hizo a mano antes del
  -- relleno), no se toca ni falla el envío del cliente: el relleno la informa.
  insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
  values (p_tenant_id, v_client, p_contacto_id, 'portal', null, 'portal')
  on conflict (chatwoot_contact_id) do nothing;
  get diagnostics v_filas = row_count;
  if v_filas = 1 then
    perform public.append_audit_event(
      p_tenant_id, 'chatwoot_contact_link', v_client, 'system', null,
      'chatwoot_contact_linked', 'rpc', 'succeeded', 'Chat del portal: el contacto queda unido a su ficha',
      null,
      pg_catalog.jsonb_build_object('chatwoot_contact_id', p_contacto_id, 'origen', 'portal', 'canal', 'portal'),
      '{}'::jsonb,
      pg_catalog.concat('chatwoot-contact-link:', v_client::text, ':', p_contacto_id::text, ':portal:', pg_catalog.txid_current()::text),
      1,
      'internal'
    );
  end if;

  if p_conversacion_id is null then
    return;
  end if;
  if p_conversacion_id <= 0 or p_conversacion_id > 2147483647 or p_inbox_id is null or p_inbox_id <= 0 then
    raise exception 'chatwoot_portal_vincular: conversación o bandeja inválida' using errcode = '22023';
  end if;

  insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
  values (p_hilo_id, p_tenant_id, p_conversacion_id)
  on conflict do nothing;
  select hl.chatwoot_conversation_id into v_actual
  from public.chatwoot_portal_hilos hl
  where hl.conversation_id = p_hilo_id;
  if v_actual is distinct from p_conversacion_id then
    raise exception 'chatwoot_portal_vincular: el hilo o la conversación ya tienen otro vínculo' using errcode = '23505';
  end if;

  insert into public.chatwoot_conversations as cc (tenant_id, conversation_id, inbox_id, status, client_id, chat_contact_id)
  values (p_tenant_id, p_conversacion_id, p_inbox_id, 'open', v_client, p_contacto_id)
  on conflict (tenant_id, conversation_id) do update
    set client_id       = excluded.client_id,
        chat_contact_id = excluded.chat_contact_id,
        inbox_id        = coalesce(cc.inbox_id, excluded.inbox_id);
end;
$function$;

comment on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) is
  'SDD-0586 E10-D35 y SDD-0676: guarda el contacto de Chatwoot de la ficha del hilo y, si viene, la conversación del hilo; deja el client_id en chatwoot_conversations para la Ficha DTD y la unión del contacto en chatwoot_contact_links (origen portal, auditada). Rechaza un segundo contacto o una segunda conversación.';

revoke all on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) to service_role;

-- ─── 8. La tarjeta del CRM: unión primero, teléfono después ───────────────
create or replace function public.crm_entrada_chatwoot(
  p_tenant_id          uuid,
  p_contact_id         bigint,
  p_bsuid              text,
  p_phone_last10       text,
  p_nombre_visible     text,
  p_fuente             text,
  p_agente_chatwoot_id bigint,
  p_clave_mensaje      text,
  p_ocurrio_at         timestamptz
)
returns table (tarjeta_id uuid, creada boolean, volvio boolean)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ocurrio  timestamptz := coalesce(p_ocurrio_at, pg_catalog.now());
  v_telefono text := case when p_phone_last10 ~ '^[0-9]{10}$' then p_phone_last10 end;
  v_nombre   text := nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_nombre_visible, '')), 120)), '');
  v_agente   uuid := public.crm_usuario_de_agente(p_tenant_id, p_agente_chatwoot_id);
  v_ficha    uuid;
  v_segmento text;
  v_tarjeta  uuid;
  v_actual   uuid;
  v_etapa    text;
  v_volvio   boolean := false;
begin
  if p_tenant_id is null or (p_contact_id is null and p_bsuid is null) then
    raise exception 'crm_entrada_chatwoot: tenant y contacto o BSUID son obligatorios' using errcode = '22023';
  end if;
  if p_fuente is null or p_fuente not in ('whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo') then
    raise exception 'crm_entrada_chatwoot: fuente que no viene de Chatwoot' using errcode = '22023';
  end if;

  -- SDD-0676: la unión del contacto manda; si no hay, el teléfono.
  v_ficha := coalesce(
    public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id),
    public.crm_ficha_por_telefono(p_tenant_id, v_telefono));
  v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);

  if v_tarjeta is null then
    v_segmento := public.crm_segmento_cliente(p_tenant_id, v_ficha);
    insert into public.crm_tarjetas as t (
      tenant_id, client_id, chatwoot_contact_id, bsuid, nombre_visible, phone_last10,
      etapa_leads, asesor_id, fuente, ultima_actividad_at
    )
    select p_tenant_id, v_ficha, p_contact_id, p_bsuid,
           case when v_ficha is null then v_nombre end,
           case when v_ficha is null then v_telefono end,
           case when v_segmento = 'lead_nuevo' then 'nuevo' else 'registrado_recontacto' end,
           coalesce(
             (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha),
             v_agente),
           p_fuente, v_ocurrio
    on conflict do nothing
    returning t.id into v_tarjeta;
    if v_tarjeta is not null then
      return query select v_tarjeta, true, false;
      return;
    end if;
    -- Otra entrega la creó entre la búsqueda y la inserción.
    v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);
    if v_tarjeta is null then
      raise exception 'crm_entrada_chatwoot: conflicto sin tarjeta' using errcode = '40001';
    end if;
  end if;

  -- SDD-0676: una tarjeta absorbida no se toca; la actividad va a la del cliente.
  select coalesce(t.absorbida_en, t.id) into v_tarjeta
  from public.crm_tarjetas t
  where t.id = v_tarjeta;

  select t.client_id, t.etapa_leads into v_actual, v_etapa
  from public.crm_tarjetas t
  where t.id = v_tarjeta
  for update;

  -- Una ficha borrada o fusionada ya no sirve: manda la que cruce hoy.
  if v_actual is not null and exists (
    select 1 from public.clients c where c.id = v_actual and c.deleted_at is null
  ) then
    v_ficha := v_actual;
  end if;

  -- Se completa lo que falta. Con ficha, nombre y teléfono viven en clients (D6).
  update public.crm_tarjetas t
  set client_id = v_ficha,
      nombre_visible = case when v_ficha is null then coalesce(t.nombre_visible, v_nombre) end,
      phone_last10 = case when v_ficha is null then coalesce(t.phone_last10, v_telefono) end,
      chatwoot_contact_id = coalesce(t.chatwoot_contact_id, case when not exists (
        select 1 from public.crm_tarjetas x
        where x.tenant_id = p_tenant_id and x.chatwoot_contact_id = p_contact_id and x.id <> v_tarjeta
      ) then p_contact_id end),
      bsuid = coalesce(t.bsuid, case when not exists (
        select 1 from public.crm_tarjetas x
        where x.tenant_id = p_tenant_id and x.bsuid = p_bsuid and x.id <> v_tarjeta
      ) then p_bsuid end),
      asesor_id = coalesce(
        t.asesor_id,
        (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha),
        v_agente),
      ultima_actividad_at = greatest(t.ultima_actividad_at, v_ocurrio)
  where t.id = v_tarjeta;

  if p_clave_mensaje is not null
     and v_etapa = 'perdido'
     and public.crm_segmento_cliente(p_tenant_id, v_ficha) <> 'cliente' then
    v_volvio := public.crm_volver_a_recontacto(p_tenant_id, v_tarjeta, 'chatwoot_volvio:' || p_clave_mensaje, v_ocurrio);
  end if;

  return query select v_tarjeta, false, v_volvio;
end;
$fn$;

comment on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) is
  'SDD-0587 (6.4, §5.1, §5.2) y SDD-0676: crea o completa la tarjeta de quien entra por Chatwoot. La ficha sale de la unión del contacto (0554) y, si no hay, del teléfono. Una tarjeta absorbida no se toca: la actividad va a la del cliente. Idempotente. Solo service_role.';

revoke all on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) to service_role;

create or replace function public.crm_asesor_desde_chatwoot(
  p_tenant_id uuid, p_contact_id bigint, p_bsuid text, p_phone_last10 text, p_agente_chatwoot_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_telefono text := case when p_phone_last10 ~ '^[0-9]{10}$' then p_phone_last10 end;
  v_agente   uuid := public.crm_usuario_de_agente(p_tenant_id, p_agente_chatwoot_id);
  v_tarjeta  uuid;
  v_filas    integer;
begin
  if v_agente is null then
    return false;
  end if;
  v_tarjeta := public.crm_buscar_tarjeta(
    p_tenant_id,
    coalesce(
      public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id),
      public.crm_ficha_por_telefono(p_tenant_id, v_telefono)),
    p_contact_id, p_bsuid, v_telefono);
  if v_tarjeta is null then
    return false;
  end if;
  -- SDD-0676: el asesor va a la tarjeta del cliente, no a la absorbida.
  select coalesce(t.absorbida_en, t.id) into v_tarjeta
  from public.crm_tarjetas t
  where t.id = v_tarjeta;
  update public.crm_tarjetas t
  set asesor_id = coalesce(
        (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = t.client_id),
        v_agente)
  where t.id = v_tarjeta
    and t.asesor_id is null;
  get diagnostics v_filas = row_count;
  return v_filas = 1;
end;
$fn$;

comment on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) is
  'SDD-0587 (6.4, §5.4) y SDD-0676: conversation_updated con asignado. Da asesor solo a la tarjeta que no lo tiene (la del cliente si la del contacto está absorbida) y no crea tarjetas. Idempotente. Solo service_role.';

revoke all on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) from public, anon, authenticated;
grant execute on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) to service_role;

-- ─── Postcondiciones ──────────────────────────────────────────────────────
do $post$
begin
  if pg_catalog.to_regprocedure(
       'public.chatwoot_registrar_evento(uuid,text,text,bigint,bigint,text,integer,bigint,text,timestamptz,double precision,bigint,boolean)'
     ) is not null then
    raise exception '0566: quedó la firma vieja de chatwoot_registrar_evento (dos firmas vuelven ambigua la llamada)';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_ficha_de_contacto(uuid,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.chatwoot_ficha_de_contacto(uuid,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege(
          'authenticated',
          'public.chatwoot_registrar_evento(uuid,text,text,bigint,bigint,text,integer,bigint,text,timestamptz,double precision,bigint,boolean,bigint)',
          'EXECUTE')
     or pg_catalog.has_function_privilege(
          'authenticated', 'public.crm_entrada_chatwoot(uuid,bigint,text,text,text,text,bigint,text,timestamptz)', 'EXECUTE')
     or pg_catalog.has_function_privilege(
          'authenticated', 'public.crm_asesor_desde_chatwoot(uuid,bigint,text,text,bigint)', 'EXECUTE') then
    raise exception '0566: una función quedó abierta a una sesión (son solo de service_role)';
  end if;
  if pg_catalog.has_function_privilege('service_role', 'public.crm_absorber_tarjeta_de_contacto(uuid,uuid,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.crm_soltar_tarjeta_de_contacto(uuid,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.crm_absorber_tarjeta_de_contacto(uuid,uuid,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.crm_soltar_tarjeta_de_contacto(uuid,bigint)', 'EXECUTE') then
    raise exception '0566: absorber o soltar quedaron ejecutables fuera de las funciones';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_portal_vincular(uuid,uuid,bigint,text,bigint,bigint)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.chatwoot_portal_vincular(uuid,uuid,bigint,text,bigint,bigint)', 'EXECUTE') then
    raise exception '0566: chatwoot_portal_vincular quedó abierta a una sesión (es solo de service_role)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.chatwoot_contact_links'::regclass and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%kommo%' and pg_catalog.pg_get_constraintdef(c.oid) like '%portal%'
  ) or exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.chatwoot_contact_links'::regclass and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%kommo%' and pg_catalog.pg_get_constraintdef(c.oid) not like '%portal%'
  ) then
    raise exception '0566: el CHECK del origen de chatwoot_contact_links no quedó con «portal»';
  end if;
end;
$post$;
