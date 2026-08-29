-- 0394_bug_state_transitions_via_rpc_only.sql · SDD-0314
--
-- Cierra la SEGUNDA PUERTA de la máquina de estados del Bug Reporter.
--
-- ── QUÉ ESTABA ABIERTO ────────────────────────────────────────────────────
--
-- La 0028 dice en el comentario de su policy que «las transiciones de estado
-- pasan por RPC», pero nada lo obligaba. Convivían:
--
--   grant update on public.bug_reports to authenticated;   -- 0028, línea 715
--   create policy "bug_reports_admin_update" ...           -- 0028, línea 517
--
-- y la policy sólo exige ser admin del tenant. Con eso, un admin podía saltarse
-- `bug_advance_state` por PostgREST y escribir el estado a mano.
--
-- Medido el 2026-08-27 contra un Postgres desechable (stubs + 0028 + 0039),
-- como `authenticated` con el uid de un admin del tenant:
--
--   update bug_reports set state = 'resuelto' where id = …;
--     → ACEPTADO. state: nuevo → resuelto DE UN SALTO,
--       resolved_at = NULL, renglones de timeline = 0.
--   update bug_reports set state = 'nuevo' where id = …;
--     → ACEPTADO. Un terminal reabierto, sin rastro.
--   La MISMA transición por la RPC → RECHAZADA (P0003).
--
-- No es una fuga entre empresas —hace falta ser admin del propio tenant— y por
-- eso nunca reventó. Lo que se pierde es la fidelidad del expediente: un bug
-- puede figurar resuelto sin que exista rastro de quién lo resolvió ni cuándo.
-- Los guards (whitelist, estado terminal, sellado, timeline) viven TODOS dentro
-- de `bug_advance_state`; la puerta de al lado no pasaba por ninguno.
--
-- ── CÓMO SE CIERRA: DOS CAPAS, Y CADA UNA TAPA EL PUNTO CIEGO DE LA OTRA ──
--
-- CAPA 1 · Privilegios por columna. `authenticated` deja de tener UPDATE sobre
--   la tabla entera y lo recibe SÓLO sobre las cinco columnas que la app
--   escribe de verdad en directo (medidas en PATCHABLE_FIELDS de
--   app/api/studio/bugs/[id]/route.ts y en updateBugAdminAction de
--   app/studio/(app)/bugs/actions.ts). Nombrar `state` en un UPDATE pasa a ser
--   `42501 permission denied for column state`, y lo rechaza el motor: no hay
--   nada que forjar. `bug_advance_state` es SECURITY DEFINER, corre como dueño
--   y no la ve.
--   👉 Punto ciego: un `grant update on public.bug_reports to authenticated`
--      futuro la borra de un plumazo — que es EXACTAMENTE cómo nació el hueco.
--
-- CAPA 2 · Trigger. Rechaza tocar el expediente (`state` y sus cuatro sellos)
--   cuando el cambio no viene de adentro de la RPC. Sobrevive a ese re-GRANT.
--   La señal exige DOS cosas a la vez:
--     (a) la GUC `dtd.bug_state_via_rpc` en 'on' — la pone y la saca la propia
--         `bug_advance_state` alrededor de su UPDATE; y
--     (b) `current_user` = dueño de la tabla.
--   La (b) es la que no se puede forjar: una GUC de prefijo propio la setea
--   cualquiera, pero un cliente conectado como `authenticated` NUNCA llega a
--   ser el dueño, así que forjar la GUC sola no compra nada. La (a) es la que
--   da precisión: distingue a `bug_advance_state` de cualquier otra escritura
--   a nivel dueño.
--
-- NO se duplica acá la whitelist de transiciones (como sí hace
-- `dispatch_orders_status_transition_guard`): la whitelist tiene un solo dueño,
-- `bug_advance_state`. Dos copias driftean. Este trigger no decide QUÉ
-- transición es válida — decide QUIÉN puede decidirlo.
--
-- Reparación deliberada desde una migración (corre como dueño):
--   select set_config('dtd.bug_state_via_rpc', 'on', true);
--
-- Contratos: supabase/tests/0028_bug_reporter.test.sql (14 a 17 tras integrar SDD-0312).
--
-- ⚠️ NOTA DE RENUMERACIÓN. Esta migración se aplicó a prod cuando su spec era la
-- SDD-0313; otra ventana ya tenía ese número en `main` y la spec se movió a la
-- 0314. La MIGRACIÓN no se renumera (ya corrió como 0394), pero el
-- `comment on function` grabado en la base todavía dice `(SDD-0313)`. El archivo
-- dice 0314. Es drift de un comentario, sin efecto funcional; se corrige
-- re-emitiendo ese COMMENT con OK del founder.

-- ─────────────────────────────────────────────────────────────
-- CAPA 1 · Privilegios por columna
-- ─────────────────────────────────────────────────────────────

revoke update on public.bug_reports from authenticated;

grant update (severity, eta_days, admin_thanks, commit_url, duplicate_of_id)
  on public.bug_reports to authenticated;

-- ─────────────────────────────────────────────────────────────
-- CAPA 2 · Trigger: el expediente sólo lo mueve la RPC
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_reports_state_via_rpc_guard()
returns trigger
language plpgsql
set search_path = public   -- convención 0210: search_path pineado
as $guard$
declare
  v_owner text;
begin
  -- Sólo mira los cambios del expediente. Editar severidad, ETA, gracias o el
  -- link del commit no pasa por acá.
  if new.state            is not distinct from old.state
     and new.taken_by     is not distinct from old.taken_by
     and new.taken_at     is not distinct from old.taken_at
     and new.resolved_at  is not distinct from old.resolved_at
     and new.discarded_at is not distinct from old.discarded_at
  then
    return new;
  end if;

  select pg_get_userbyid(c.relowner) into v_owner
    from pg_class c
   where c.oid = 'public.bug_reports'::regclass;

  if current_setting('dtd.bug_state_via_rpc', true) = 'on'
     and current_user = v_owner
  then
    return new;
  end if;

  raise exception
    'El estado del bug se cambia con bug_advance_state(), no con UPDATE directo (% → %)',
    old.state, new.state
    using errcode = '42501';
end;
$guard$;

comment on function public.bug_reports_state_via_rpc_guard() is
  'Candado de la máquina de estados del Bug Reporter (SDD-0314): rechaza cambiar state/taken_by/taken_at/resolved_at/discarded_at fuera de bug_advance_state(). Exige la GUC dtd.bug_state_via_rpc=on Y current_user = dueño de la tabla; la segunda mitad es la que no se puede forjar.';

drop trigger if exists bug_reports_state_guard_trigger on public.bug_reports;

create trigger bug_reports_state_guard_trigger
  before update on public.bug_reports
  for each row execute function public.bug_reports_state_via_rpc_guard();

-- ─────────────────────────────────────────────────────────────
-- La RPC declara que es ella: abre la GUC y la cierra
-- ─────────────────────────────────────────────────────────────
--
-- Cuerpo idéntico al de la 0039 (mismos guards, mismo cast a bug_author_type).
-- Lo único que cambia son las dos líneas de `set_config` alrededor del UPDATE.

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
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
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

  -- SDD-0314: acá adentro —y sólo acá— el trigger deja mover el expediente.
  -- Transaction-local: si algo revienta, la transacción se va y la GUC con ella.
  perform set_config('dtd.bug_state_via_rpc', 'on', true);

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- Se cierra enseguida: nadie más en esta transacción viaja con la puerta abierta.
  perform set_config('dtd.bug_state_via_rpc', 'off', true);

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
