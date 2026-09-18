-- ─────────────────────────────────────────────────────────────────────────────
-- 0462 · SDD-0482 — el cliente edita nombre, cédula/RIF y teléfono al instante.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Migrate-first: con el Portal
--    viejo es invisible (sigue creando solicitudes con aprobación).
--
-- ── Decisiones de Sam (2026-09-18, literales) ───────────────
-- «Editar directo, sin aprobación» · «También directos» (nombre y teléfono) ·
-- «No, se mantiene verificado» · «Bloquear y avisar al asesor (Recomendado)».
-- Todo dentro del cupo compartido de 3 cambios (0445).
--
-- ── Qué agrega ──────────────────────────────────────────────
-- 1. `client_profile_blocked_attempts`: cada intento bloqueado por duplicado,
--    SIN el valor intentado. Sirve para el límite anti-enumeración y para el
--    aviso al asesor (service_role sólo SELECT).
-- 2. `portal_update_my_profile(p_name, p_doc, p_phone)`: SECURITY DEFINER,
--    cliente por sesión, lock por fila, sólo los campos que cambian. Registra
--    el cambio como fila `approved` de `client_change_requests`; el trigger de
--    0445 consume el cupo con su propio lock y audita sin PII. No toca
--    `doc_verify_*`. Devuelve `outcome` + `remaining_count`, nunca datos de
--    otro cliente: se puede llamar directo por PostgREST sin filtrar nada.
--
-- ── Anti-enumeración ────────────────────────────────────────
-- Un bloqueo no gasta cupo. Para que no sirva de oráculo de cédulas: la
-- respuesta es genérica, cada bloqueo queda registrado y con 5 bloqueos en
-- 24 h se rechaza CUALQUIER cambio de documento o teléfono (libre o no).
--
-- ── Locks ───────────────────────────────────────────────────
-- Sólo DDL de objetos nuevos: no bloquea `clients` ni `client_change_requests`.
-- ─────────────────────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.client_change_requests') is null
     or pg_catalog.to_regclass('public.client_profile_edits') is null
     or pg_catalog.to_regclass('public.clients_tenant_doc_unique') is null
     or pg_catalog.to_regprocedure('public.get_portal_client_id()') is null
     or pg_catalog.to_regprocedure('public.portal_profile_edit_request_lifecycle()') is null
     or pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0462 requiere clients, el índice 0095, el cupo de 0445 y la auditoría canónica';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.client_change_requests'::pg_catalog.regclass
      and trigger_row.tgname = 'client_change_requests_profile_edit_lifecycle'
      and not trigger_row.tgisinternal
  ) then
    raise exception '0462 abortado: falta el trigger de cupo de 0445';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.clients'::pg_catalog.regclass
      and attname = 'phone_last10'
      and attgenerated = 's'
      and not attisdropped
  ) or not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.client_change_requests'::pg_catalog.regclass
      and attname = 'submitted_by'
      and not attisdropped
  ) then
    raise exception '0462 abortado: falta clients.phone_last10 generada (0383) o client_change_requests.submitted_by (0445)';
  end if;

  if pg_catalog.to_regclass('public.client_profile_blocked_attempts') is not null
     or pg_catalog.to_regprocedure('public.portal_update_my_profile(text,text,text)') is not null then
    raise exception '0462 abortado: la edición directa ya existe';
  end if;
end;
$preflight$;

create table public.client_profile_blocked_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  field text not null check (field in ('document', 'phone')),
  conflicting_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.client_profile_blocked_attempts is
  'SDD-0482: intentos del Portal bloqueados por documento o teléfono de otro cliente. No guarda el valor intentado. Alimenta el límite anti-enumeración (5 en 24 h) y el aviso al asesor.';

create index client_profile_blocked_attempts_recent_idx
  on public.client_profile_blocked_attempts (client_id, created_at desc);

alter table public.client_profile_blocked_attempts enable row level security;
revoke all on table public.client_profile_blocked_attempts
  from public, anon, authenticated, service_role;
grant select on table public.client_profile_blocked_attempts to service_role;
-- Sin policies: authenticated no lee ni escribe; sólo la RPC (owner postgres)
-- inserta y el servidor lee con service_role para armar el aviso.

-- Remanente del cupo compartido (misma cuenta que 0445).
create function public.portal_profile_edit_remaining(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select greatest(0, 3 - pg_catalog.count(*)::integer)::integer
  from public.client_profile_edits as edit
  where edit.client_id = p_client_id
    and edit.status in ('reserved', 'applied')
$function$;

-- Registra un bloqueo y lo audita sin el valor intentado.
create function public.portal_profile_record_blocked_attempt(
  p_tenant_id uuid,
  p_client_id uuid,
  p_actor_id uuid,
  p_field text,
  p_conflicting_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt_id uuid;
begin
  insert into public.client_profile_blocked_attempts (
    tenant_id, client_id, actor_id, field, conflicting_client_id
  ) values (
    p_tenant_id, p_client_id, p_actor_id, p_field, p_conflicting_client_id
  ) returning id into v_attempt_id;

  perform public.append_audit_event(
    p_tenant_id,
    'client',
    p_client_id,
    'user',
    p_actor_id,
    'client_profile_edit_blocked',
    'rpc',
    'rejected',
    'duplicate_' || p_field,
    null,
    null,
    pg_catalog.jsonb_build_object('attempt_id', v_attempt_id, 'field', p_field),
    'profile-blocked:' || v_attempt_id::text,
    1,
    'sensitive'
  );
end;
$function$;

create function public.portal_update_my_profile(
  p_name text,
  p_doc text,
  p_phone text
)
returns table (outcome text, remaining_count integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_client_id uuid := public.get_portal_client_id();
  v_tenant_id uuid;
  v_cur_name text;
  v_cur_rif text;
  v_cur_phone text;
  v_cur_phone_last10 text;
  v_kind text;
  v_name text;
  v_doc text;
  v_phone text;
  v_new_name text;
  v_new_doc text;
  v_new_phone text;
  v_conflict uuid;
  v_blocked integer;
  v_field text;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  select client.tenant_id, client.name, client.rif, client.phone,
         client.phone_last10, coalesce(client.doc_kind, 'persona')
    into v_tenant_id, v_cur_name, v_cur_rif, v_cur_phone,
         v_cur_phone_last10, v_kind
  from public.clients as client
  where client.id = v_client_id and client.deleted_at is null
  for update;

  if not found then
    raise exception 'profile_client_not_found' using errcode = 'P0001';
  end if;

  -- Entradas: la action ya normaliza; esto es defensa por si se llama directo.
  v_name := nullif(pg_catalog.btrim(coalesce(p_name, '')), '');
  v_doc := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_doc, ''))), '');
  v_phone := nullif(pg_catalog.regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if v_name is not null
     and pg_catalog.char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_profile_name' using errcode = '22023';
  end if;

  if v_doc is not null and (
    (v_kind = 'empresa' and v_doc !~ '^[VEJGP]-[0-9]{8}-[0-9]$')
    or (v_kind <> 'empresa' and v_doc !~ '^([VE]-[0-9]{6,9}|P-[A-Z0-9]{5,12})$')
  ) then
    raise exception 'invalid_profile_document' using errcode = '22023';
  end if;

  if v_phone is not null
     and pg_catalog.char_length(v_phone) not between 7 and 15 then
    raise exception 'invalid_profile_phone' using errcode = '22023';
  end if;

  -- Sólo cuenta lo que cambia de verdad (el formato no es un cambio).
  if v_name is not null
     and v_name is distinct from pg_catalog.btrim(coalesce(v_cur_name, '')) then
    v_new_name := v_name;
  end if;

  if v_doc is not null
     and pg_catalog.upper(pg_catalog.regexp_replace(v_doc, '[^A-Za-z0-9]', '', 'g'))
       is distinct from
         pg_catalog.upper(pg_catalog.regexp_replace(coalesce(v_cur_rif, ''), '[^A-Za-z0-9]', '', 'g')) then
    v_new_doc := v_doc;
  end if;

  if v_phone is not null and (
    case
      when pg_catalog.char_length(v_phone) >= 10 and v_cur_phone_last10 is not null
        then pg_catalog."right"(v_phone, 10) is distinct from v_cur_phone_last10
      else v_phone is distinct from
        pg_catalog.regexp_replace(coalesce(v_cur_phone, ''), '\D', '', 'g')
    end
  ) then
    v_new_phone := v_phone;
  end if;

  if v_new_name is null and v_new_doc is null and v_new_phone is null then
    return query select 'no_changes'::text, public.portal_profile_edit_remaining(v_client_id);
    return;
  end if;

  -- Anti-enumeración: con 5 bloqueos en 24 h no se evalúa ningún documento ni
  -- teléfono, esté libre o no. El nombre sigue editable.
  if v_new_doc is not null or v_new_phone is not null then
    select pg_catalog.count(*)::integer
      into v_blocked
    from public.client_profile_blocked_attempts as attempt
    where attempt.client_id = v_client_id
      and attempt.created_at > pg_catalog.now() - interval '24 hours';

    if v_blocked >= 5 then
      return query select 'rate_limited'::text, public.portal_profile_edit_remaining(v_client_id);
      return;
    end if;
  end if;

  if v_new_doc is not null then
    select other.id
      into v_conflict
    from public.clients as other
    where other.tenant_id = v_tenant_id
      and other.id <> v_client_id
      and other.deleted_at is null
      and other.rif is not null
      and pg_catalog.btrim(other.rif) <> ''
      and pg_catalog.upper(pg_catalog.regexp_replace(other.rif, '[^A-Za-z0-9]', '', 'g'))
        = pg_catalog.upper(pg_catalog.regexp_replace(v_new_doc, '[^A-Za-z0-9]', '', 'g'))
    limit 1;
    if found then
      v_field := 'document';
    end if;
  end if;

  if v_field is null
     and v_new_phone is not null
     and pg_catalog.char_length(v_new_phone) >= 10 then
    select other.id
      into v_conflict
    from public.clients as other
    where other.tenant_id = v_tenant_id
      and other.id <> v_client_id
      and other.deleted_at is null
      and other.phone_last10 = pg_catalog."right"(v_new_phone, 10)
    limit 1;
    if found then
      v_field := 'phone';
    end if;
  end if;

  if v_field is not null then
    perform public.portal_profile_record_blocked_attempt(
      v_tenant_id, v_client_id, v_actor_id, v_field, v_conflict
    );
    return query select 'blocked'::text, public.portal_profile_edit_remaining(v_client_id);
    return;
  end if;

  begin
    -- La edición directa reemplaza la solicitud pendiente propia: su borrado
    -- libera la reserva (trigger 0445) y una aprobación tardía ya no puede
    -- pisar el dato nuevo con uno viejo.
    delete from public.client_change_requests
    where client_id = v_client_id
      and status = 'pending'
      and source = 'client';

    -- El trigger 0445 cuenta esta fila como `applied` con lock por cliente y
    -- lanza `profile_edit_limit_reached` si ya no queda cupo.
    insert into public.client_change_requests (
      tenant_id, client_id,
      proposed_name, proposed_rif, proposed_phone,
      prev_name, prev_rif, prev_phone,
      status, source, submitted_by, submitted_at,
      reviewed_at, reviewed_by, review_note
    ) values (
      v_tenant_id, v_client_id,
      v_new_name, v_new_doc, v_new_phone,
      v_cur_name, v_cur_rif, v_cur_phone,
      'approved', 'client', v_actor_id, pg_catalog.now(),
      pg_catalog.now(), null,
      'Cambio directo del cliente desde el Portal (SDD-0482).'
    );

    -- La verificación de identidad NO se toca (decisión de Sam).
    update public.clients
    set name = coalesce(v_new_name, name),
        rif = coalesce(v_new_doc, rif),
        phone = coalesce(v_new_phone, phone)
    where id = v_client_id;
  exception
    when unique_violation then
      -- Carrera con `clients_tenant_doc_unique`: el bloque se deshace entero
      -- (borrado, fila y cupo) y queda sólo el intento.
      perform public.portal_profile_record_blocked_attempt(
        v_tenant_id, v_client_id, v_actor_id, 'document', null
      );
      return query select 'blocked'::text, public.portal_profile_edit_remaining(v_client_id);
      return;
  end;

  return query select 'applied'::text, public.portal_profile_edit_remaining(v_client_id);
end;
$function$;

alter function public.portal_update_my_profile(text, text, text) owner to postgres;
alter function public.portal_profile_edit_remaining(uuid) owner to postgres;
alter function public.portal_profile_record_blocked_attempt(uuid, uuid, uuid, text, uuid)
  owner to postgres;

revoke all on function public.portal_update_my_profile(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_profile_edit_remaining(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_profile_record_blocked_attempt(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.portal_update_my_profile(text, text, text)
  to authenticated;

comment on function public.portal_update_my_profile(text, text, text) is
  'SDD-0482: edición directa self-scope de nombre, cédula/RIF y teléfono dentro del cupo de 3 cambios. Bloquea duplicados sin revelarlos, con límite de 5 en 24 h. No reinicia la verificación (decisión de Sam).';
comment on function public.portal_profile_edit_remaining(uuid) is
  'SDD-0482: remanente del cupo compartido de 0445. Interna; sin EXECUTE para roles API.';
comment on function public.portal_profile_record_blocked_attempt(uuid, uuid, uuid, text, uuid) is
  'SDD-0482: registra y audita un intento bloqueado sin el valor intentado. Interna; sin EXECUTE para roles API.';
