-- 0397_bug_advance_state_tuteo_sobre_sdd0313.sql
--
-- ✅ APLICADA a producción el 2026-08-28 con OK del founder nombrándola.
--    Ledger: 20260828162058 / 0397_bug_advance_state_tuteo_sobre_sdd0313
--
-- SDD-0312 · reaplica el tuteo de `bug_advance_state`, que una migración
-- concurrente pisó 72 segundos después.
--
-- ── QUÉ PASÓ (medido contra prod el 2026-08-28) ───────────────────────────
--
-- El 2026-08-28 entraron a producción TRES migraciones distintas con el mismo
-- número 0394, desde tres ventanas que no se veían entre sí:
--
--   20260828005838  0394_bug_reporter_tuteo_y_revoke_anon      (SDD-0312)
--   20260828005909  0394_documents_sin_borrado_duro            (bugfix)
--   20260828005950  0394_bug_state_transitions_via_rpc_only    (entonces SDD-0313; hoy SDD-0314)
--
-- La primera pasó a tuteo los mensajes de `bug_advance_state` y
-- `bug_increment_duplicate`. La tercera cerró la «segunda puerta» de la máquina
-- de estados (privilegios por columna + trigger) y, para meter sus dos
-- `set_config` alrededor del UPDATE, **copió el cuerpo de la 0039** — que es la
-- versión con voseo. Como corrió 72 s después, ganó.
--
-- Nadie hizo nada mal: la de SDD-0313 no podía saber del tuteo porque, en ese
-- momento, ninguno de los tres archivos había llegado a `main`. Es el modo de
-- falla clásico de `create or replace` concurrente: el último en correr se
-- lleva la función entera, no sólo su parte. La spec se renumeró después a
-- SDD-0314; la migración conserva 0394 porque ya estaba aplicada.
--
-- Estado medido DESPUÉS de las tres:
--   bug_advance_state        → voseo SÍ · set_config SDD-0313 SÍ · cast 0039 SÍ
--   bug_increment_duplicate  → tuteo SÍ (la 0394 de SDD-0312 sigue intacta acá)
--   trigger bug_reports_state_guard_trigger → presente
--   anon sobre las 3 RPC     → sin EXECUTE
--
-- O sea: de los dos arreglos del SDD-0312, uno sobrevivió y el otro se perdió.
--
-- ── QUÉ HACE ESTA MIGRACIÓN ───────────────────────────────────────────────
--
-- Toma el cuerpo VIVO —el de SDD-0313, con sus dos `set_config`— y le cambia
-- SÓLO las dos cadenas de voseo. No revierte nada de SDD-0313: el candado, el
-- trigger y los privilegios por columna quedan como están.
--
--   'Necesitás estar autenticado'      → 'Necesitas estar autenticado'
--   'No pertenecés al tenant del bug'  → 'No perteneces al tenant del bug'
--
-- Importa porque `app/studio/(app)/bugs/actions.ts:83` devuelve `error.message`
-- CRUDO al cliente: ese texto es la copy de la pantalla del Studio.
--
-- ── POR QUÉ NO SE TOCA NADA MÁS ───────────────────────────────────────────
--
-- `bug_increment_duplicate` NO se incluye: su tuteo sigue vivo y volver a
-- declararla sólo agregaría superficie para el próximo choque. `next_bug_folio`
-- tampoco: su ACL ya estaba cerrado desde la 0209 (medido en prod:
-- `postgres=X service_role=X authenticated=X`, sin PUBLIC y sin anon).
--
-- ── Verificado DESPUÉS de aplicar, contra el objeto ───────────────────────
--
-- La sonda fuerte es la huella, no el «success» del apply: el md5 del `prosrc`
-- vivo quedó en **a76e8bea85a821bb8f7bbfdd5e89c503** — exactamente el que se
-- calculó ANTES aplicándole los dos reemplazos al cuerpo que estaba corriendo.
-- Eso prueba que no se movió nada más. Además, medido: cero voseo, tuteo
-- completo, `set_config` y cast presentes, trigger `bug_reports_state_guard_trigger`
-- vivo, 5 privilegios de UPDATE por columna para `authenticated`, y `anon` sin
-- EXECUTE.
--
-- ── Numeración ────────────────────────────────────────────────────────────
--
-- El 0397 quedó firme (nadie más lo tomó) y ya corrió con ese nombre, así que
-- de acá en más **no se renumera**. Las tres 0394 tampoco: están declaradas en
-- `CHOQUES_HISTORICOS` de `scripts/check-numbering.mjs`, con los tres basenames
-- exactos que existen en el ledger y en el repo.
--
-- Contrato: supabase/tests/0028_bug_reporter.test.sql (13).

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

  -- SDD-0313: acá adentro —y sólo acá— el trigger deja mover el expediente.
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

grant  execute on function public.bug_advance_state(uuid, bug_state, text) to authenticated;
revoke execute on function public.bug_advance_state(uuid, bug_state, text) from public, anon;
