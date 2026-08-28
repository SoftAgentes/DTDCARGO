-- 0394_bug_reporter_tuteo_y_revoke_anon.sql
--
-- SDD-0312 · dos residuos del Bug Reporter, medidos el 2026-08-27.
--
-- ── 1 · Voseo en dos mensajes que SÍ llegan a la pantalla ────────────────
--
-- `bug_advance_state` (viva desde 0039) y `bug_increment_duplicate` (viva
-- desde 0028) levantan 'Necesitás estar autenticado' y 'No pertenecés al
-- tenant del bug'. Es voseo argentino; la regla del repo es español
-- venezolano neutro con TUTEO.
--
-- DÓNDE SE VE — medido, no supuesto: la ruta API
-- `app/api/studio/bugs/[id]/state/route.ts` mapea los códigos a mensajes
-- propios, así que por ahí no se ve. Pero la server action
-- `app/studio/(app)/bugs/actions.ts:83` devuelve `error.message` CRUDO al
-- cliente, así que por el camino del Studio el voseo llega al usuario.
--
-- Se reemplaza el cuerpo completo de las dos funciones porque un mensaje de
-- `raise exception` no se puede parchear de otra forma. `bug_advance_state`
-- se copia de 0039 —NO de 0028— para no revertir el cast explícito a
-- `bug_author_type` que aquella arregló: 0028 es la versión con el bug.
--
-- ── 2 · El `revoke ... from public, anon` que le falta a next_bug_folio ──
--
-- 0028:289 hace `grant execute ... to authenticated` sin el `revoke ... from
-- public, anon` que sí llevan sus dos RPC hermanas (0028:399 y 0028:456). En
-- Postgres las funciones nacen con EXECUTE para PUBLIC, así que el archivo
-- 0028 aplicado SOLO deja la función abierta a `anon`.
--
-- ⚠️ ALCANCE REAL — medido con replay completo de las 372 migraciones sobre
-- Postgres limpio el 2026-08-27: en la base compuesta esto YA está cerrado.
-- `0209_revoke_anon_rpc_sweep.sql:64` revoca `next_bug_folio` de `public,
-- anon`, y el ACL vivo queda
-- `postgres=X/postgres service_role=X/postgres authenticated=X/postgres`
-- (sin PUBLIC, sin anon) → `has_function_privilege('anon', ...)` = false.
--
-- El `true` que se midió salía de replayar 0028 AISLADA, que es justo lo que
-- hace el harness de contratos (`\ir` de su propia migración). O sea: el
-- hueco es del ARCHIVO, no de la base. Esta migración no cierra una fuga
-- —no había ninguna abierta en prod— sino que hace explícita la invariante
-- a nivel de archivo, para que el contrato de 0028 pueda afirmarla sin
-- depender de una migración de barrido 181 números más adelante.
--
-- Es idempotente y no cambia el ACL vivo: revoca lo que ya no está y
-- re-otorga lo que ya estaba.

-- ─────────────────────────────────────────────────────────────
-- 1 · next_bug_folio · la revocación que faltaba en 0028
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.next_bug_folio(uuid) from public, anon;
grant  execute on function public.next_bug_folio(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2 · bug_advance_state · tuteo (cuerpo copiado de 0039)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_advance_state(
  p_bug_id uuid,
  p_new_state bug_state,
  p_note text default null
)
returns bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No perteneces al tenant del bug' using errcode = '42501';
  end if;

  if v_actor_role <> 'admin' then
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- FIX 0039: cast explícito a bug_author_type
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id, 'state_change', v_actor,
    (case when v_actor_role = 'admin' then 'admin' else 'user' end)::bug_author_type,
    jsonb_build_object('from_state', v_old_state, 'to_state', p_new_state, 'note', p_note)
  );

  return v_row;
end;
$func$;

grant  execute on function public.bug_advance_state(uuid, bug_state, text) to authenticated;
revoke execute on function public.bug_advance_state(uuid, bug_state, text) from public, anon;

-- ─────────────────────────────────────────────────────────────
-- 3 · bug_increment_duplicate · tuteo (cuerpo copiado de 0028)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_increment_duplicate(
  p_original_id  uuid
)
returns public.bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor      uuid := auth.uid();
  v_tenant_id  uuid;
  v_row        public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado' using errcode = '42501';
  end if;

  -- Validar tenant
  select tenant_id into v_tenant_id
    from public.bug_reports
   where id = p_original_id;

  if v_tenant_id is null then
    raise exception 'Bug original no encontrado' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.user_tenants
    where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null
  ) then
    raise exception 'No perteneces al tenant del bug' using errcode = '42501';
  end if;

  update public.bug_reports
     set duplicate_count = duplicate_count + 1,
         updated_at      = now()
   where id = p_original_id
   returning * into v_row;

  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (p_original_id, 'duplicate_detected', v_actor, 'system',
          jsonb_build_object('new_count', v_row.duplicate_count));

  return v_row;
end;
$func$;

grant  execute on function public.bug_increment_duplicate(uuid) to authenticated;
revoke execute on function public.bug_increment_duplicate(uuid) from public, anon;
