-- ─────────────────────────────────────────────────────────────
-- 0460 · SDD-0477 — Un vínculo del Portal revocado conserva su correo y sus
-- fechas 30 días; después se borran y la fila queda como «Revocado».
--
-- LA DECISIÓN (Sam, 2026-09-15, textual): «30 dias se gusrdan guardamos el
-- email y las fechas de un vínculo del Portal revocado.». El 2026-09-18 eligió,
-- para el resto de la fila: «Queda como «Revocado»».
--
-- EL HUECO (en main y en producción hasta aplicar esta migración)
--   · Una fila de `client_users` revocada (a mano con `portal_revoke_client`,
--     por el borrado de su cliente desde 0454 o por `merge_clients`) conserva
--     sin plazo el correo y las fechas de la persona: `email`, `invited_at`,
--     `bound_at`, `last_login_at`, `revoked_at`, `last_email_invite_at` y
--     `last_whatsapp_invite_at`. El mapa de borrado (§10) lo marca 🔴 SIN
--     FUNDAMENTO.
--
-- LA REGLA
--   · Pasados 30 días desde la revocación, reloj de la base, se borran esos
--     siete campos. También `auth_user_id` y `token`, que una revocación
--     completa ya deja en NULL. La fila no se borra: queda `revoked`, con
--     tenant, cliente, contadores de invitación, quién invitó y `created_at`,
--     y el Studio sigue mostrando «Revocado».
--   · Base del plazo: `revoked_at`. Una fila revocada sin `revoked_at` (fusión
--     anterior a 0454) usa `updated_at`, que nunca es anterior a la revocación:
--     el plazo sólo puede alargarse, nunca acortarse.
--   · `email` e `invited_at` pasan a admitir NULL sólo en una fila `revoked`
--     (CHECK `client_users_erased_only_when_revoked`). Una fila `invited` o
--     `active` sigue exigiendo los dos.
--   · RPC `erase_revoked_portal_access_data(p_limit, p_dry_run)`, SECURITY
--     DEFINER y ejecutable sólo por `service_role`: la llama el cron diario de
--     Vercel. En una sola transacción, por cada fila borra los datos y escribe
--     con `append_audit_event` el evento `portal_access_data_erased` sobre la
--     entidad `portal_invitation` (id del cliente, como D5). El actor es
--     `system`, el origen `job`, lleva motivo y antes/después sin valores. Si el
--     evento no se escribe, no se borra nada.
--   · Tope por corrida (1 a 1000) y `FOR UPDATE SKIP LOCKED`: una segunda
--     corrida, o una concurrente, no repite filas ni eventos. Una fila ya
--     borrada no vuelve a ser elegible.
--   · Retención legal (MP-D3, 0301): una fila cuyo tenant, o cuyo cliente como
--     entidad `portal_invitation` o `client`, tenga un hold activo o con
--     liberación pedida no se toca. Se ignoran el rango y la correlación del
--     hold: cualquier hold que cubra el alcance bloquea. Falla cerrado.
--   · `p_dry_run` cuenta sin cambiar nada ni escribir eventos.
--
-- PREFLIGHT QUE FALLA CERRADO (mensajes sin ids ni correos)
--   · roles de la API; `client_users` con RLS, sin FORCE, sus columnas y el
--     CHECK de status de 0080 exacto;
--   · `email` e `invited_at` NOT NULL, o anulables con el CHECK final
--     (reaplicación); el CHECK con otra definición aborta;
--   · `append_audit_event` (0294) SECURITY DEFINER con search_path vacío y
--     ejecutable por el rol que aplica, que queda como dueño de la RPC;
--   · el tipo de entidad `portal_invitation` activo;
--   · las tablas de holds de 0301 con sus columnas;
--   · que el rol que aplica se salte la RLS de `client_users` y de las dos
--     tablas de holds (superusuario, BYPASSRLS o dueño) y que ninguna tenga
--     FORCE: si no, la RPC actualizaría o leería 0 filas sin error;
--   · la RPC ausente o con su firma final (ninguna otra sobrecarga);
--   · huella del catálogo dependiente, que el postflight exige intacta.
--
-- LOCKS: los ALTER TABLE toman ACCESS EXCLUSIVE sobre `client_users` hasta el
-- COMMIT. Toda lectura del Portal que resuelve al principal espera: aplicar en
-- baja actividad. `lock_timeout` 5 s y `statement_timeout` 30 s de sesión, como
-- 0454 y 0455; se restauran al final. Reaplicar no cambia nada.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0460_retencion_vinculo_portal_revocado`.
-- ─────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_column text;
  v_table text;
  v_writer oid;
  v_huella text;
  v_email_nullable boolean;
  v_invited_nullable boolean;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0460 requiere los roles authenticated, anon y service_role';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.client_users') and relkind in ('r', 'p') and relrowsecurity
  ) then
    raise exception '0460 requiere tabla con RLS: public.client_users';
  end if;

  foreach v_column in array array[
    'id', 'tenant_id', 'client_id', 'email', 'auth_user_id', 'token', 'status', 'invited_at',
    'bound_at', 'revoked_at', 'last_login_at', 'updated_at', 'last_email_invite_at',
    'last_whatsapp_invite_at'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = 'public.client_users'::pg_catalog.regclass
        and attname = v_column and attnum > 0 and not attisdropped
    ) then
      raise exception '0460 requiere la columna public.client_users.%', v_column;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_users'::pg_catalog.regclass and contype = 'c'
      and conname = 'client_users_status_check'
      and pg_catalog.pg_get_constraintdef(oid)
          = 'CHECK ((status = ANY (ARRAY[''invited''::text, ''active''::text, ''revoked''::text])))'
  ) then
    raise exception '0460 abortada: el CHECK de status de client_users no tiene la forma de 0080';
  end if;

  -- email e invited_at: NOT NULL (primera aplicación) o anulables con el CHECK
  -- final (reaplicación). Anulables sin ese CHECK es drift.
  select not attnotnull into v_email_nullable from pg_catalog.pg_attribute
   where attrelid = 'public.client_users'::pg_catalog.regclass and attname = 'email';
  select not attnotnull into v_invited_nullable from pg_catalog.pg_attribute
   where attrelid = 'public.client_users'::pg_catalog.regclass and attname = 'invited_at';
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_users'::pg_catalog.regclass
      and conname = 'client_users_erased_only_when_revoked'
      and (contype <> 'c' or not convalidated
           or pg_catalog.pg_get_constraintdef(oid)
              <> 'CHECK (((status = ''revoked''::text) OR ((email IS NOT NULL) AND (invited_at IS NOT NULL))))')
  ) then
    raise exception '0460 abortada: ya existe client_users_erased_only_when_revoked con otra forma';
  end if;
  if (v_email_nullable or v_invited_nullable)
     and not exists (
       select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.client_users'::pg_catalog.regclass
         and conname = 'client_users_erased_only_when_revoked'
     ) then
    raise exception '0460 abortada: email o invited_at ya admiten NULL sin el CHECK de esta migración';
  end if;

  -- El writer de auditoría: SECURITY DEFINER, search_path vacío y ejecutable por
  -- el rol que aplica, que queda como dueño de la RPC.
  v_writer := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  if v_writer is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0460 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not pg_catalog.has_function_privilege(current_user, v_writer, 'EXECUTE') then
    raise exception '0460 abortada: el rol que aplica no puede ejecutar append_audit_event; la RPC quedaría con un dueño que no escribe el evento';
  end if;

  -- Holds de 0301: la RPC los lee para no tocar datos retenidos.
  for v_table, v_column in select * from (values
    ('public.audit_legal_holds', 'id'), ('public.audit_legal_holds', 'tenant_id'),
    ('public.audit_legal_holds', 'scope_type'), ('public.audit_legal_holds', 'entity_type'),
    ('public.audit_legal_holds', 'entity_id'), ('public.audit_legal_hold_events', 'id'),
    ('public.audit_legal_hold_events', 'hold_id'), ('public.audit_legal_hold_events', 'event_type'),
    ('public.audit_legal_hold_events', 'occurred_at')
  ) as x(relation, col) loop
    if pg_catalog.to_regclass(v_table) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_table) and attname = v_column and attnum > 0 and not attisdropped
    ) then
      raise exception '0460 requiere los holds de 0301: falta %.%', v_table, v_column;
    end if;
  end loop;

  -- RLS: la RPC corre como su dueño, que queda siendo el rol que aplica. Tiene
  -- que saltarse la RLS de las tres tablas; si no, borraría y leería 0 filas sin
  -- error (y no vería un hold). FORCE aborta siempre, aunque el rol tenga BYPASSRLS.
  foreach v_table in array array['public.client_users', 'public.audit_legal_holds',
                                  'public.audit_legal_hold_events'] loop
    if exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relforcerowsecurity
    ) then
      raise exception '0460 abortada: % tiene FORCE ROW LEVEL SECURITY; la RPC trabajaría sobre 0 filas sin error', v_table;
    end if;
    if not exists (
         select 1 from pg_catalog.pg_roles as r
         where r.rolname = current_user and (r.rolsuper or r.rolbypassrls)
       )
       and not exists (
         select 1 from pg_catalog.pg_class as c
         where c.oid = pg_catalog.to_regclass(v_table)
           and pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')
       ) then
      raise exception '0460 abortada: el rol que aplica no es dueño de % ni tiene BYPASSRLS; la RPC trabajaría sobre 0 filas sin error', v_table;
    end if;
  end loop;

  -- Después de la RLS: un rol que no se la salta leería audit_entity_types vacía
  -- y el mensaje culparía al tipo de entidad.
  if pg_catalog.to_regclass('public.audit_entity_types') is null
     or not exists (
       select 1 from public.audit_entity_types where entity_type = 'portal_invitation' and status = 'active'
     ) then
    raise exception '0460 abortada: el tipo de entidad portal_invitation no está activo; cada corrida fallaría';
  end if;

  -- La RPC: ausente, o sólo con su firma final.
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::pg_catalog.regnamespace
      and p.proname = 'erase_revoked_portal_access_data'
      and p.oid is distinct from pg_catalog.to_regprocedure('public.erase_revoked_portal_access_data(integer,boolean)')
  ) then
    raise exception '0460 abortada: existe otra firma de erase_revoked_portal_access_data; revisar antes de aplicar';
  end if;

  -- Huella del catálogo dependiente, que el postflight exige intacta: triggers,
  -- policies, ACL y RLS de client_users, y cuerpo, ACL y configuración de las RPC
  -- del Portal que escriben client_users y del writer de auditoría.
  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text || ':' || t.tgenabled::text
           || ':' || pg_catalog.pg_get_triggerdef(t.oid)
      from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.client_users'::pg_catalog.regclass and not t.tgisinternal
    union all
    select 'P:' || pol.polname || ':' || pol.polcmd::text || ':' || pol.polpermissive::text || ':'
           || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid = 'public.client_users'::pg_catalog.regclass
    union all
    select 'A:' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || ':'
           || c.relforcerowsecurity::text || ':' || c.relowner::text
      from pg_catalog.pg_class c
     where c.oid = 'public.client_users'::pg_catalog.regclass
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') || ':'
           || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text || ':' || p.proowner::text
      from pg_catalog.pg_proc p
     where p.oid in (
       select pg_catalog.to_regprocedure(s) from pg_catalog.unnest(array[
         'public.portal_invite_client(uuid)', 'public.portal_bind_session()',
         'public.portal_revoke_client(uuid)', 'public.portal_bump_invite_count(uuid,text)',
         'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
       ]) as s
     )
  ) as huella(x);
  perform pg_catalog.set_config('dtd.m0460_huella', v_huella, false);
end;
$preflight$;

alter table public.client_users
  alter column email drop not null,
  alter column invited_at drop not null;

do $check$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_users'::pg_catalog.regclass
      and conname = 'client_users_erased_only_when_revoked'
  ) then
    alter table public.client_users
      add constraint client_users_erased_only_when_revoked
      check (status = 'revoked' or (email is not null and invited_at is not null));
  end if;
end;
$check$;

comment on constraint client_users_erased_only_when_revoked on public.client_users is
  'SDD-0477: sólo un vínculo revocado puede quedar sin correo ni fecha de invitación, cuando se borraron por la retención de 30 días.';
comment on column public.client_users.email is
  'Correo del vínculo. NULL sólo en un vínculo revocado cuyo plazo de 30 días venció (SDD-0477, erase_revoked_portal_access_data).';
comment on column public.client_users.invited_at is
  'Fecha de la última invitación. NULL sólo en un vínculo revocado cuyo plazo de 30 días venció (SDD-0477).';

create or replace function public.erase_revoked_portal_access_data(
  p_limit integer default 200,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  c_retention constant interval := interval '30 days';
  c_max_limit constant integer := 1000;
  c_reason constant text :=
    'Retención de 30 días cumplida: se borran el correo y las fechas del vínculo del Portal revocado (SDD-0477).';
  v_cutoff timestamptz := pg_catalog.now() - c_retention;
  v_prev_reason text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_eligible bigint;
  v_held bigint;
  v_erased integer := 0;
  r record;
begin
  if p_limit is null or p_limit < 1 or p_limit > c_max_limit then
    raise exception 'erase_revoked_portal_access_data: p_limit debe estar entre 1 y %', c_max_limit
      using errcode = '22023';
  end if;
  if p_dry_run is null then
    raise exception 'erase_revoked_portal_access_data: p_dry_run no puede ser NULL'
      using errcode = '22023';
  end if;

  -- Elegible: revocada, con el plazo vencido y con algo que borrar. Retenida: un
  -- hold activo, o con liberación pedida, cubre su tenant o su cliente.
  select pg_catalog.count(*) filter (where not x.retenida), pg_catalog.count(*) filter (where x.retenida)
    into v_eligible, v_held
  from (
    select exists (
             select 1
             from public.audit_legal_holds as h
             cross join lateral (
               select e.event_type from public.audit_legal_hold_events as e
               where e.hold_id = h.id order by e.occurred_at desc, e.id desc limit 1
             ) as estado
             where h.tenant_id = cu.tenant_id
               and estado.event_type in ('active', 'release_requested')
               and (h.scope_type = 'tenant'
                    or (h.scope_type = 'entity_type' and h.entity_type in ('portal_invitation', 'client'))
                    or (h.scope_type = 'entity' and h.entity_type in ('portal_invitation', 'client')
                        and h.entity_id = cu.client_id))
           ) as retenida
    from public.client_users as cu
    where cu.status = 'revoked'
      and coalesce(cu.revoked_at, cu.updated_at) <= v_cutoff
      and (cu.email is not null or cu.invited_at is not null or cu.bound_at is not null
           or cu.last_login_at is not null or cu.revoked_at is not null
           or cu.last_email_invite_at is not null or cu.last_whatsapp_invite_at is not null
           or cu.auth_user_id is not null or cu.token is not null)
  ) as x;

  if not p_dry_run then
    -- El motivo del evento es siempre el de la retención, no uno heredado del caller.
    perform pg_catalog.set_config('dtd.audit_reason', '', true);

    for r in
      select cu.id, cu.tenant_id, cu.client_id,
             cu.email is not null as email_present,
             (cu.auth_user_id is not null or cu.token is not null) as identity_present,
             pg_catalog.array_remove(array[
               case when cu.invited_at is not null then 'invited_at' end,
               case when cu.bound_at is not null then 'bound_at' end,
               case when cu.last_login_at is not null then 'last_login_at' end,
               case when cu.revoked_at is not null then 'revoked_at' end,
               case when cu.last_email_invite_at is not null then 'last_email_invite_at' end,
               case when cu.last_whatsapp_invite_at is not null then 'last_whatsapp_invite_at' end
             ], null) as dates_present,
             case when cu.revoked_at is null then 'updated_at' else 'revoked_at' end as basis
      from public.client_users as cu
      where cu.status = 'revoked'
        and coalesce(cu.revoked_at, cu.updated_at) <= v_cutoff
        and (cu.email is not null or cu.invited_at is not null or cu.bound_at is not null
             or cu.last_login_at is not null or cu.revoked_at is not null
             or cu.last_email_invite_at is not null or cu.last_whatsapp_invite_at is not null
             or cu.auth_user_id is not null or cu.token is not null)
        and not exists (
          select 1
          from public.audit_legal_holds as h
          cross join lateral (
            select e.event_type from public.audit_legal_hold_events as e
            where e.hold_id = h.id order by e.occurred_at desc, e.id desc limit 1
          ) as estado
          where h.tenant_id = cu.tenant_id
            and estado.event_type in ('active', 'release_requested')
            and (h.scope_type = 'tenant'
                 or (h.scope_type = 'entity_type' and h.entity_type in ('portal_invitation', 'client'))
                 or (h.scope_type = 'entity' and h.entity_type in ('portal_invitation', 'client')
                     and h.entity_id = cu.client_id))
        )
      order by coalesce(cu.revoked_at, cu.updated_at), cu.id
      limit p_limit
      for update of cu skip locked
    loop
      update public.client_users
         set email = null, invited_at = null, bound_at = null, last_login_at = null,
             revoked_at = null, last_email_invite_at = null, last_whatsapp_invite_at = null,
             auth_user_id = null, token = null
       where id = r.id and status = 'revoked';
      if not found then
        raise exception 'erase_revoked_portal_access_data: una fila bloqueada dejó de estar revocada'
          using errcode = '40001';
      end if;

      perform public.append_audit_event(
        r.tenant_id, 'portal_invitation', r.client_id, 'system', null,
        'portal_access_data_erased', 'job', 'succeeded', c_reason,
        pg_catalog.jsonb_build_object(
          'status', 'revoked', 'email_present', r.email_present,
          'identity_present', r.identity_present, 'dates_present', pg_catalog.to_jsonb(r.dates_present)),
        pg_catalog.jsonb_build_object(
          'status', 'revoked', 'email_present', false,
          'identity_present', false, 'dates_present', '[]'::jsonb),
        pg_catalog.jsonb_build_object(
          'mp01', 'minimizacion_pii', 'retention_days', 30, 'retention_basis', r.basis, 'sdd', '0477'),
        pg_catalog.concat('sdd0477:erase:', r.id::text, ':', pg_catalog.txid_current()::text),
        1, 'restricted'
      );
      v_erased := v_erased + 1;
    end loop;

    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_prev_reason, ''), true);
  end if;

  return pg_catalog.jsonb_build_object(
    'dry_run', p_dry_run,
    'retention_days', 30,
    'cutoff', v_cutoff,
    'limit', p_limit,
    'eligible', v_eligible,
    'held', v_held,
    'erased', v_erased,
    'remaining', greatest(v_eligible - v_erased, 0)
  );
end;
$function$;

comment on function public.erase_revoked_portal_access_data(integer, boolean) is
  'SDD-0477: a los 30 días de revocado un vínculo del Portal, borra su correo, sus fechas y su identidad, deja la fila revoked y escribe portal_access_data_erased por fila. Respeta los holds de 0301. Sólo service_role (cron diario).';

revoke all on function public.erase_revoked_portal_access_data(integer, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.erase_revoked_portal_access_data(integer, boolean) to service_role;

do $postflight$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.erase_revoked_portal_access_data(integer,boolean)');
  v_huella text;
  v_table text;
begin
  if v_fn is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn and p.prosecdef and p.provolatile = 'v'
      and p.prorettype = 'pg_catalog.jsonb'::pg_catalog.regtype
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception '0460: la RPC no quedó SECURITY DEFINER, volátil, jsonb y con search_path vacío';
  end if;
  if not pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or exists (
       select 1 from pg_catalog.pg_proc p, pg_catalog.aclexplode(p.proacl) a
       where p.oid = v_fn and a.grantee = 0
     ) then
    raise exception '0460: ACL de la RPC inválida; sólo service_role la ejecuta';
  end if;

  -- El dueño de la RPC tiene que saltarse la RLS de las tres tablas.
  foreach v_table in array array['public.client_users', 'public.audit_legal_holds',
                                  'public.audit_legal_hold_events'] loop
    if exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relforcerowsecurity
    ) or (
      not exists (
        select 1 from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
        where p.oid = v_fn and (r.rolsuper or r.rolbypassrls)
      )
      and not exists (
        select 1 from pg_catalog.pg_proc p, pg_catalog.pg_class c
        where p.oid = v_fn and c.oid = pg_catalog.to_regclass(v_table)
          and pg_catalog.pg_has_role(p.proowner, c.relowner, 'USAGE')
      )
    ) then
      raise exception '0460: el dueño de la RPC no se salta la RLS de %', v_table;
    end if;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.client_users'::pg_catalog.regclass
      and attname in ('email', 'invited_at') and attnotnull
  ) then
    raise exception '0460: email o invited_at siguen NOT NULL';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_users'::pg_catalog.regclass
      and conname = 'client_users_erased_only_when_revoked' and contype = 'c' and convalidated
      and pg_catalog.pg_get_constraintdef(oid)
          = 'CHECK (((status = ''revoked''::text) OR ((email IS NOT NULL) AND (invited_at IS NOT NULL))))'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_users'::pg_catalog.regclass and conname = 'client_users_status_check'
      and pg_catalog.pg_get_constraintdef(oid)
          = 'CHECK ((status = ANY (ARRAY[''invited''::text, ''active''::text, ''revoked''::text])))'
  ) then
    raise exception '0460: los CHECK de client_users no quedaron con su forma final';
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text || ':' || t.tgenabled::text
           || ':' || pg_catalog.pg_get_triggerdef(t.oid)
      from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.client_users'::pg_catalog.regclass and not t.tgisinternal
    union all
    select 'P:' || pol.polname || ':' || pol.polcmd::text || ':' || pol.polpermissive::text || ':'
           || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid = 'public.client_users'::pg_catalog.regclass
    union all
    select 'A:' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || ':'
           || c.relforcerowsecurity::text || ':' || c.relowner::text
      from pg_catalog.pg_class c
     where c.oid = 'public.client_users'::pg_catalog.regclass
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') || ':'
           || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text || ':' || p.proowner::text
      from pg_catalog.pg_proc p
     where p.oid in (
       select pg_catalog.to_regprocedure(s) from pg_catalog.unnest(array[
         'public.portal_invite_client(uuid)', 'public.portal_bind_session()',
         'public.portal_revoke_client(uuid)', 'public.portal_bump_invite_count(uuid,text)',
         'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
       ]) as s
     )
  ) as huella(x);
  if v_huella is distinct from nullif(pg_catalog.current_setting('dtd.m0460_huella', true), '') then
    raise exception '0460: cambió el catálogo dependiente de client_users durante la migración';
  end if;
  perform pg_catalog.set_config('dtd.m0460_huella', '', false);
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
