-- ─────────────────────────────────────────────────────────────────────────────
-- 0555 · SDD-0652 fase 2 — Ficha del empleado: enlace con su usuario, foto,
--        revelado de la cuenta bancaria y línea de tiempo con eventos.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, de a una,
--    con el name exacto `0555_nomina_ficha_empleado_identidad_foto`. Fusionar la
--    PR NO autoriza aplicarla.
--    ORDEN: indistinto. Con la app de antes y la migración aplicada no cambia
--    nada visible: nadie lee photo_path ni llama a las RPC. Con la app nueva y
--    sin la migración, la ficha se sigue leyendo (photo_path se pide aparte y
--    degrada a «sin foto»; los eventos de la línea de tiempo degradan a un
--    aviso) y cada acción nueva responde «No disponible todavía».
--
-- ── Qué crea ────────────────────────────────────────────────────────────────
-- · Tres tipos en el catálogo de auditoría (spec §F2 punto 3):
--     nomina_employee_access          access      user_linked, user_unlinked
--     nomina_employee_photo           governance  photo_set, photo_removed
--     nomina_employee_sensitive_view  security    bank_account_revealed
--   Primer uso del domain_code `security`: el calendario v1.0 y la 0304 ya lo
--   cuentan en la clase `security` (2 años); ningún lote cambia.
-- · `nomina_employees.photo_path text null` y el bucket PRIVADO
--   `employee-photos` (2 MB, solo JPEG, PNG y WebP), sin policies para
--   authenticated: se sube y se firma en el servidor con service_role.
-- · `nomina_ficha_actor_tenant(boolean)`: quién llama. Devuelve el tenant si la
--   persona tiene UNA sola membresía activa con rol admin (o admin/accounting);
--   si no, 42501. Un acceso extra a `nomina` (SDD-0635) y la lectura propia de
--   la 0181 no pasan: no son un rol. Sin EXECUTE para nadie: solo la llaman las
--   funciones de abajo, como dueño.
-- · `nomina_link_employee_user`, `nomina_unlink_employee_user`: solo admin.
-- · `nomina_set_employee_photo`: admin y Contabilidad (D5). Cambia la
--   referencia y deja el evento en la misma transacción; no toca el bucket.
-- · `nomina_reveal_bank_account`: admin y Contabilidad, con motivo (D9 opción b,
--   excepción a AUD-02 §3 registrada en docs/governance/). Si el evento no se
--   puede escribir, la función falla y no devuelve la cuenta.
-- · `nomina_employee_timeline_events`: admin y Contabilidad. Solo eventos de esa
--   ficha y de los tipos de Nómina. Sin payload, sin motivo, sin datos.
--   Todas: SECURITY DEFINER, search_path vacío, EXECUTE solo authenticated.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- Las policies de nomina_employees, el índice único del enlace (0181),
-- get_employee_id_for_user(), las filas ni el resto del catálogo.
--
-- LOCKS: un ALTER TABLE ADD COLUMN nullable sin default (ACCESS EXCLUSIVE breve
-- sobre nomina_employees, sin reescritura), tres filas en audit_entity_types,
-- una en storage.buckets, CREATE FUNCTION, REVOKE, GRANT y COMMENT. Sin
-- backfill. lock_timeout 5 s, statement_timeout 30 s.
-- Reaplicar aborta en el preflight: la columna ya existe.
-- Desarme: drop de las seis funciones y de la columna; el bucket se vacía y se
-- borra aparte; los tres tipos del catálogo se quedan (los eventos los usan).
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ── 1. Preflight ─────────────────────────────────────────────────────────────
do $preflight$
declare
  v_req record;
  v_fn text;
  v_tipo record;
  v_dom text;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0555 requiere los roles authenticated, anon y service_role';
  end if;

  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0555 requiere auth.uid()';
  end if;

  if pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0555 requiere public.append_audit_event (AUD-01)';
  end if;

  -- Cada columna que las funciones leen o escriben.
  for v_req in
    select * from (values
      ('public.nomina_employees', 'id'), ('public.nomina_employees', 'tenant_id'),
      ('public.nomina_employees', 'auth_user_id'), ('public.nomina_employees', 'status'),
      ('public.nomina_employees', 'deleted_at'), ('public.nomina_employees', 'bank_account'),
      ('public.nomina_employees', 'updated_at'),
      ('public.nomina_settlements', 'id'), ('public.nomina_settlements', 'tenant_id'),
      ('public.nomina_settlements', 'employee_id'),
      ('public.user_tenants', 'user_id'), ('public.user_tenants', 'tenant_id'),
      ('public.user_tenants', 'role'), ('public.user_tenants', 'disabled_at'),
      ('public.client_users', 'auth_user_id'),
      ('public.audit_entity_types', 'entity_type'), ('public.audit_entity_types', 'domain_code'),
      ('public.entity_audit_log', 'id'), ('public.entity_audit_log', 'tenant_id'),
      ('public.entity_audit_log', 'entity_type'), ('public.entity_audit_log', 'entity_id'),
      ('public.entity_audit_log', 'actor_id'), ('public.entity_audit_log', 'event_type'),
      ('public.entity_audit_log', 'occurred_at'),
      ('storage.buckets', 'id'), ('storage.buckets', 'public'),
      ('storage.buckets', 'file_size_limit'), ('storage.buckets', 'allowed_mime_types')
    ) as r(tbl, col)
  loop
    if pg_catalog.to_regclass(v_req.tbl) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_req.tbl)
        and attname = v_req.col and attnum > 0 and not attisdropped
    ) then
      raise exception '0555 requiere la columna %.%', v_req.tbl, v_req.col;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entity_audit_log'::pg_catalog.regclass
      and conname = 'entity_audit_log_entity_type_fkey' and contype = 'f'
  ) then
    raise exception '0555 requiere la FK entity_audit_log_entity_type_fkey';
  end if;

  -- El enlace es único por usuario vivo (0181): es la última defensa del enlace.
  if not exists (
    select 1 from pg_catalog.pg_index as i
    join pg_catalog.pg_class as c on c.oid = i.indexrelid
    where i.indrelid = 'public.nomina_employees'::pg_catalog.regclass
      and c.relname = 'nomina_employees_auth_user_uniq' and i.indisunique and i.indisvalid
  ) then
    raise exception '0555 requiere el índice único nomina_employees_auth_user_uniq';
  end if;

  -- Lo que esta migración crea no puede existir ya.
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.nomina_employees'::pg_catalog.regclass
      and attname = 'photo_path' and attnum > 0 and not attisdropped
  ) then
    raise exception '0555 abortada: nomina_employees ya tiene photo_path';
  end if;
  if exists (select 1 from storage.buckets where id = 'employee-photos') then
    raise exception '0555 abortada: el bucket employee-photos ya existe';
  end if;
  foreach v_fn in array array[
    'public.nomina_ficha_actor_tenant(boolean)',
    'public.nomina_link_employee_user(uuid,uuid,text)',
    'public.nomina_unlink_employee_user(uuid,text)',
    'public.nomina_set_employee_photo(uuid,text)',
    'public.nomina_reveal_bank_account(uuid,text)',
    'public.nomina_employee_timeline_events(uuid,text,integer)'
  ] loop
    if pg_catalog.to_regprocedure(v_fn) is not null then
      raise exception '0555 abortada: % ya existe', v_fn;
    end if;
  end loop;

  -- Un tipo que ya exista con OTRO dominio cambiaría su clase de retención.
  for v_tipo in
    select * from (values
      ('nomina_employee_access', 'access'),
      ('nomina_employee_photo', 'governance'),
      ('nomina_employee_sensitive_view', 'security')
    ) as t(entity_type, domain_code)
  loop
    select a.domain_code into v_dom
    from public.audit_entity_types as a where a.entity_type = v_tipo.entity_type;
    if found and v_dom is distinct from v_tipo.domain_code then
      raise exception '0555 abortada: el tipo % ya existe con el dominio % (se esperaba %)',
        v_tipo.entity_type, v_dom, v_tipo.domain_code;
    end if;
  end loop;
end;
$preflight$;

-- ── 2. Catálogo de auditoría ─────────────────────────────────────────────────
insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values
  ('nomina_employee_access', 'active', 'access', 1, 'migration:0555'),
  ('nomina_employee_photo', 'active', 'governance', 1, 'migration:0555'),
  ('nomina_employee_sensitive_view', 'active', 'security', 1, 'migration:0555')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(public.audit_entity_types.contract_version, excluded.contract_version);

-- ── 3. Foto: columna y bucket privado ────────────────────────────────────────
alter table public.nomina_employees add column photo_path text;

comment on column public.nomina_employees.photo_path is
  'SDD-0652: ruta de la foto en el bucket privado employee-photos ({tenant_id}/{employee_id}/{uuid}.webp). null = sin foto. La escribe solo nomina_set_employee_photo; se lee con URL firmada desde el servidor.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── 4. Quién llama ───────────────────────────────────────────────────────────
create function public.nomina_ficha_actor_tenant(p_solo_admin boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_memberships integer;
begin
  -- El patrón de audit_list_events (0398): una sola membresía activa con el rol.
  select
    pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(ut.tenant_id order by ut.tenant_id))[1]
    into v_memberships, v_tenant_id
  from public.user_tenants as ut
  where ut.user_id = v_user_id
    and ut.disabled_at is null
    and (ut.role = 'admin' or (not coalesce(p_solo_admin, true) and ut.role = 'accounting'));

  if v_user_id is null or v_memberships <> 1 or v_tenant_id is null then
    raise exception 'nomina: no tienes permiso para esta ficha' using errcode = '42501';
  end if;
  return v_tenant_id;
end
$function$;

-- ── 5. Enlace ficha ↔ usuario ────────────────────────────────────────────────
create function public.nomina_link_employee_user(
  p_employee_id uuid,
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.nomina_ficha_actor_tenant(true);
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_ficha record;
begin
  if p_employee_id is null or p_user_id is null then
    raise exception 'nomina: faltan la ficha o el usuario' using errcode = '22023';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500 then
    raise exception 'nomina: el motivo es obligatorio (entre 4 y 500 caracteres)' using errcode = '22023';
  end if;

  -- Bloquea la ficha: dos enlaces a la vez se resuelven en fila.
  select e.id, e.auth_user_id, e.status into v_ficha
  from public.nomina_employees as e
  where e.id = p_employee_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    raise exception 'nomina: la ficha no existe' using errcode = 'P0002';
  end if;
  if v_ficha.status = 'egresado' then
    raise exception 'nomina: una ficha egresada no se enlaza' using errcode = '22023';
  end if;
  if v_ficha.auth_user_id is not null then
    raise exception 'nomina: esta ficha ya está enlazada a un usuario' using errcode = '23505';
  end if;

  if not exists (
    select 1 from public.user_tenants as ut
    where ut.user_id = p_user_id and ut.tenant_id = v_tenant and ut.disabled_at is null
  ) then
    raise exception 'nomina: la persona no es miembro activo del Studio' using errcode = '22023';
  end if;
  if exists (select 1 from public.client_users as cu where cu.auth_user_id = p_user_id) then
    raise exception 'nomina: esa cuenta es de un cliente del portal' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.nomina_employees as o
    where o.auth_user_id = p_user_id and o.deleted_at is null
  ) then
    raise exception 'nomina: ese usuario ya está enlazado a otra ficha' using errcode = '23505';
  end if;

  begin
    update public.nomina_employees
    set auth_user_id = p_user_id, updated_at = pg_catalog.now()
    where id = p_employee_id;
  exception when unique_violation then
    -- La última defensa: el índice único de la 0181.
    raise exception 'nomina: ese usuario ya está enlazado a otra ficha' using errcode = '23505';
  end;

  perform public.append_audit_event(
    v_tenant, 'nomina_employee_access', p_employee_id, 'user', v_actor,
    'user_linked', 'rpc', 'succeeded', v_reason,
    pg_catalog.jsonb_build_object('linked', false),
    pg_catalog.jsonb_build_object('linked', true, 'user_id', p_user_id),
    '{}'::jsonb, null, 1, 'internal'
  );
end
$function$;

create function public.nomina_unlink_employee_user(
  p_employee_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.nomina_ficha_actor_tenant(true);
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_ficha record;
begin
  if p_employee_id is null then
    raise exception 'nomina: falta la ficha' using errcode = '22023';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500 then
    raise exception 'nomina: el motivo es obligatorio (entre 4 y 500 caracteres)' using errcode = '22023';
  end if;

  select e.id, e.auth_user_id into v_ficha
  from public.nomina_employees as e
  where e.id = p_employee_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    raise exception 'nomina: la ficha no existe' using errcode = 'P0002';
  end if;
  if v_ficha.auth_user_id is null then
    raise exception 'nomina: esta ficha no tiene usuario enlazado' using errcode = '22023';
  end if;

  update public.nomina_employees
  set auth_user_id = null, updated_at = pg_catalog.now()
  where id = p_employee_id;

  perform public.append_audit_event(
    v_tenant, 'nomina_employee_access', p_employee_id, 'user', v_actor,
    'user_unlinked', 'rpc', 'succeeded', v_reason,
    pg_catalog.jsonb_build_object('linked', true, 'user_id', v_ficha.auth_user_id),
    pg_catalog.jsonb_build_object('linked', false),
    '{}'::jsonb, null, 1, 'internal'
  );
end
$function$;

-- ── 6. Foto ──────────────────────────────────────────────────────────────────
create function public.nomina_set_employee_photo(
  p_employee_id uuid,
  p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.nomina_ficha_actor_tenant(false);
  v_actor uuid := auth.uid();
  v_path text := nullif(pg_catalog.btrim(p_photo_path), '');
  v_ficha record;
begin
  if p_employee_id is null then
    raise exception 'nomina: falta la ficha' using errcode = '22023';
  end if;

  select e.id, e.status, e.photo_path into v_ficha
  from public.nomina_employees as e
  where e.id = p_employee_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    raise exception 'nomina: la ficha no existe' using errcode = 'P0002';
  end if;
  if v_ficha.status = 'egresado' then
    raise exception 'nomina: la foto de una ficha egresada no se cambia' using errcode = '22023';
  end if;

  if v_path is null then
    if v_ficha.photo_path is null then
      raise exception 'nomina: esta ficha no tiene foto' using errcode = '22023';
    end if;
  elsif v_path !~ ('^' || v_tenant::text || '/' || p_employee_id::text
                   || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$') then
    -- La ruta la arma el servidor: tenant, ficha y un uuid. Nada más entra.
    raise exception 'nomina: la ruta de la foto no es de esta ficha' using errcode = '22023';
  elsif v_path = v_ficha.photo_path then
    raise exception 'nomina: esa ya es la foto de la ficha' using errcode = '22023';
  end if;

  update public.nomina_employees
  set photo_path = v_path, updated_at = pg_catalog.now()
  where id = p_employee_id;

  -- Sin la imagen ni la ruta: solo que cambió.
  perform public.append_audit_event(
    v_tenant, 'nomina_employee_photo', p_employee_id, 'user', v_actor,
    case when v_path is null then 'photo_removed' else 'photo_set' end,
    'rpc', 'succeeded', null,
    pg_catalog.jsonb_build_object('has_photo', v_ficha.photo_path is not null),
    pg_catalog.jsonb_build_object('has_photo', v_path is not null),
    '{}'::jsonb, null, 1, 'internal'
  );
end
$function$;

-- ── 7. Revelado de la cuenta bancaria ────────────────────────────────────────
create function public.nomina_reveal_bank_account(
  p_employee_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.nomina_ficha_actor_tenant(false);
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_account text;
begin
  if p_employee_id is null then
    raise exception 'nomina: falta la ficha' using errcode = '22023';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500 then
    raise exception 'nomina: el motivo es obligatorio (entre 4 y 500 caracteres)' using errcode = '22023';
  end if;

  select nullif(pg_catalog.btrim(e.bank_account), '') into v_account
  from public.nomina_employees as e
  where e.id = p_employee_id and e.tenant_id = v_tenant and e.deleted_at is null;
  if not found then
    raise exception 'nomina: la ficha no existe' using errcode = 'P0002';
  end if;
  if v_account is null then
    raise exception 'nomina: la ficha no tiene cuenta registrada' using errcode = '22023';
  end if;

  -- El evento va ANTES de devolver, en la misma transacción y sin el número.
  -- Si no se puede escribir, la función falla y la cuenta no sale.
  perform public.append_audit_event(
    v_tenant, 'nomina_employee_sensitive_view', p_employee_id, 'user', v_actor,
    'bank_account_revealed', 'rpc', 'succeeded', v_reason,
    null, null,
    pg_catalog.jsonb_build_object('field', 'bank_account'),
    null, 1, 'sensitive'
  );

  return v_account;
end
$function$;

-- ── 8. Línea de tiempo: eventos de la ficha ──────────────────────────────────
create function public.nomina_employee_timeline_events(
  p_employee_id uuid,
  p_cursor text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  entity_type text,
  event_type text,
  occurred_at timestamptz,
  actor_id uuid,
  next_cursor text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.nomina_ficha_actor_tenant(false);
  v_limit integer := coalesce(p_limit, 20);
  v_cursor_at timestamptz;
  v_cursor_id uuid;
begin
  if p_employee_id is null then
    raise exception 'nomina: falta la ficha' using errcode = '22023';
  end if;
  if v_limit < 1 or v_limit > 100 then
    raise exception 'nomina: limit debe estar entre 1 y 100' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.nomina_employees as e
    where e.id = p_employee_id and e.tenant_id = v_tenant and e.deleted_at is null
  ) then
    raise exception 'nomina: la ficha no existe' using errcode = 'P0002';
  end if;

  -- Cursor estable (occurred_at, id): «<instante UTC>|<uuid>».
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z[|][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'nomina: cursor inválido' using errcode = '22023';
    end if;
    v_cursor_at := (pg_catalog.split_part(p_cursor, '|', 1))::timestamptz;
    v_cursor_id := (pg_catalog.split_part(p_cursor, '|', 2))::uuid;
  end if;

  return query
  with pagina as (
    select log.id, log.entity_type, log.event_type, log.occurred_at, log.actor_id
    from public.entity_audit_log as log
    where log.tenant_id = v_tenant
      and (
        -- Los tipos de la ficha: el evento apunta a la ficha.
        (log.entity_type in (
           'nomina_employee', 'nomina_employee_access',
           'nomina_employee_photo', 'nomina_employee_sensitive_view'
         ) and log.entity_id = p_employee_id)
        -- El finiquito apunta a su propia fila: se llega por la ficha.
        or (log.entity_type = 'payroll_settlement' and log.entity_id in (
              select s.id from public.nomina_settlements as s
              where s.tenant_id = v_tenant and s.employee_id = p_employee_id
            ))
      )
      and (v_cursor_at is null or (log.occurred_at, log.id) < (v_cursor_at, v_cursor_id))
    order by log.occurred_at desc, log.id desc
    limit v_limit + 1
  ),
  numerada as (
    select p.*, pg_catalog.row_number() over (order by p.occurred_at desc, p.id desc) as n,
           pg_catalog.count(*) over () as total
    from pagina as p
  )
  select
    r.id, r.entity_type, r.event_type, r.occurred_at, r.actor_id,
    case when r.total > v_limit and r.n = v_limit then
      pg_catalog.to_char(r.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z|' || r.id::text
    end
  from numerada as r
  where r.n <= v_limit
  order by r.occurred_at desc, r.id desc;
end
$function$;

-- ── 9. Permisos ──────────────────────────────────────────────────────────────
revoke all on function public.nomina_ficha_actor_tenant(boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.nomina_link_employee_user(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.nomina_unlink_employee_user(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.nomina_set_employee_photo(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.nomina_reveal_bank_account(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.nomina_employee_timeline_events(uuid, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.nomina_link_employee_user(uuid, uuid, text) to authenticated;
grant execute on function public.nomina_unlink_employee_user(uuid, text) to authenticated;
grant execute on function public.nomina_set_employee_photo(uuid, text) to authenticated;
grant execute on function public.nomina_reveal_bank_account(uuid, text) to authenticated;
grant execute on function public.nomina_employee_timeline_events(uuid, text, integer) to authenticated;

comment on function public.nomina_ficha_actor_tenant(boolean) is
  'SDD-0652: tenant de quien llama si tiene una sola membresía activa con rol admin (o admin/accounting con false). 42501 si no. Sin EXECUTE: solo la usan las RPC de la ficha.';
comment on function public.nomina_link_employee_user(uuid, uuid, text) is
  'SDD-0652: enlaza una ficha con un miembro activo del Studio. Solo admin, con motivo. No sobrescribe; 23505 si la ficha o el usuario ya están enlazados. Deja user_linked en la misma transacción.';
comment on function public.nomina_unlink_employee_user(uuid, text) is
  'SDD-0652: quita el enlace ficha ↔ usuario. Solo admin, con motivo. La ficha y el usuario quedan. Deja user_unlinked.';
comment on function public.nomina_set_employee_photo(uuid, text) is
  'SDD-0652: cambia o quita (null) la referencia de la foto. Admin y Contabilidad. No toca el bucket. Deja photo_set o photo_removed, sin la ruta.';
comment on function public.nomina_reveal_bank_account(uuid, text) is
  'SDD-0652: devuelve la cuenta bancaria completa. Admin y Contabilidad, con motivo (excepción D9 a AUD-02 §3). Deja bank_account_revealed sin el número; si el evento falla, no devuelve nada.';
comment on function public.nomina_employee_timeline_events(uuid, text, integer) is
  'SDD-0652: eventos de auditoría de una ficha (tipos nomina_employee* y payroll_settlement de sus finiquitos). Admin y Contabilidad. Sin payload ni motivo. Cursor (occurred_at, id).';

-- ── 10. Postcondiciones ──────────────────────────────────────────────────────
do $postflight$
declare
  v_fn text;
  v_oid oid;
begin
  if (select pg_catalog.count(*) from public.audit_entity_types as a
      where a.status = 'active' and (a.entity_type, a.domain_code) in (
        ('nomina_employee_access', 'access'),
        ('nomina_employee_photo', 'governance'),
        ('nomina_employee_sensitive_view', 'security')
      )) <> 3 then
    raise exception '0555 postflight: el catálogo no quedó con los tres tipos y su dominio';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute as a
    where a.attrelid = 'public.nomina_employees'::pg_catalog.regclass
      and a.attname = 'photo_path' and a.attnum > 0 and not a.attisdropped
      and a.atttypid = 'text'::pg_catalog.regtype and not a.attnotnull
  ) then
    raise exception '0555 postflight: photo_path no quedó como text nullable';
  end if;

  if not exists (
    select 1 from storage.buckets as b
    where b.id = 'employee-photos' and b.public = false and b.file_size_limit = 2097152
      and b.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  ) then
    raise exception '0555 postflight: el bucket employee-photos no quedó privado, con 2 MB y solo imágenes';
  end if;

  foreach v_fn in array array[
    'public.nomina_ficha_actor_tenant(boolean)',
    'public.nomina_link_employee_user(uuid,uuid,text)',
    'public.nomina_unlink_employee_user(uuid,text)',
    'public.nomina_set_employee_photo(uuid,text)',
    'public.nomina_reveal_bank_account(uuid,text)',
    'public.nomina_employee_timeline_events(uuid,text,integer)'
  ] loop
    v_oid := pg_catalog.to_regprocedure(v_fn);
    if v_oid is null or not exists (
      select 1 from pg_catalog.pg_proc as p
      where p.oid = v_oid and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception '0555 postflight: % sin SECURITY DEFINER o con search_path', v_fn;
    end if;
    if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception '0555 postflight: anon o service_role ejecutan %', v_fn;
    end if;
    if exists (
      select 1 from pg_catalog.aclexplode((select proacl from pg_catalog.pg_proc where oid = v_oid)) as a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0555 postflight: PUBLIC conserva EXECUTE sobre %', v_fn;
    end if;
    -- La que resuelve el actor no la ejecuta nadie; las demás, solo authenticated.
    if pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
       is distinct from (v_fn <> 'public.nomina_ficha_actor_tenant(boolean)') then
      raise exception '0555 postflight: EXECUTE de authenticated mal puesto en %', v_fn;
    end if;
  end loop;
end;
$postflight$;

notify pgrst, 'reload schema';
