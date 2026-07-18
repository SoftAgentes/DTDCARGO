-- ─────────────────────────────────────────────────────────────
-- SDD-0025 · No-Olvidar — endurecimiento crypto (Fase 2.1)
--
-- Aditiva sobre 0250 (que NO cambia — está en el bundle de review). Agrega 2
-- RPCs SECURITY DEFINER que reemplazan patrones frágiles del código TS:
--
--   1) no_olvidar_increment_failed_attempt — cuenta el intento fallido de
--      desbloqueo de forma ATÓMICA (el TS lo hacía read-then-write, con carrera).
--   2) no_olvidar_create_kek_secret — envuelve vault.create_secret detrás de un
--      RPC restringido a service_role, en vez de exigir el schema `vault`
--      expuesto a PostgREST. Lo usa key-manager.rotateKek.
--
-- Checklist SECURITY DEFINER aplicado a ambas:
--   · SET search_path fijo (no hijack de search_path).
--   · Todo objeto calificado por schema (public./vault./auth.).
--   · Autorización validada DENTRO de la función (no solo por GRANT).
--   · EXECUTE revocado de public/anon; grant al mínimo rol necesario.
--
-- Prereq: 0250 aplicada (tablas + no_olvidar_check_admin + extensión vault).
-- NO se aplica a prod desde la rama — la aplica el founder con su OK (§ regla dura).
-- ─────────────────────────────────────────────────────────────

-- ─── RPC 1: incremento atómico de intentos fallidos ──────────
create or replace function public.no_olvidar_increment_failed_attempt(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold   int;
  v_lockout_min int;
  v_attempts    int;
  v_locked_until timestamptz;
  v_should_lock boolean;
begin
  -- Authz: un user solo incrementa el SUYO. service_role (auth.uid() null)
  -- puede incrementar cualquiera (lo usa el runtime server-side).
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'No autorizado para modificar intentos de otro usuario'
      using errcode = '42501';
  end if;

  select failed_attempts_lockout, lockout_minutes
    into v_threshold, v_lockout_min
    from public.no_olvidar_config
   where id = 1;
  v_threshold   := coalesce(v_threshold, 5);
  v_lockout_min := coalesce(v_lockout_min, 15);

  -- Incremento atómico: un solo UPDATE ... RETURNING (sin lost updates bajo
  -- concurrencia; cada llamada suma exactamente 1).
  update public.no_olvidar_user_keys
     set failed_unlock_attempts = failed_unlock_attempts + 1,
         updated_at = now()
   where user_id = p_user_id
  returning failed_unlock_attempts, locked_until
       into v_attempts, v_locked_until;

  if v_attempts is null then
    raise exception 'Usuario % sin fila en no_olvidar_user_keys', p_user_id
      using errcode = 'P0002';
  end if;

  v_should_lock := v_attempts >= v_threshold;
  if v_should_lock then
    v_locked_until := now() + make_interval(mins => v_lockout_min);
    update public.no_olvidar_user_keys
       set locked_until = v_locked_until
     where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'attempts', v_attempts,
    'locked',   v_should_lock,
    'until',    v_locked_until
  );
end;
$$;

comment on function public.no_olvidar_increment_failed_attempt is
  'Suma 1 intento fallido de desbloqueo de forma atómica y bloquea (locked_until) al llegar al umbral. Reemplaza el read-then-write del TS. Authz: dueño o service_role.';

revoke execute on function public.no_olvidar_increment_failed_attempt(uuid) from public, anon;
grant  execute on function public.no_olvidar_increment_failed_attempt(uuid) to authenticated;

-- ─── RPC 2: crear secret de KEK en Vault (service_role only) ──
create or replace function public.no_olvidar_create_kek_secret(
  p_name        text,
  p_secret      text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or length(p_name) < 3 then
    raise exception 'p_name inválido (mín 3 chars)' using errcode = '22023';
  end if;
  -- 32 bytes en base64 ≈ 44 chars; exigimos un mínimo defensivo.
  if p_secret is null or length(p_secret) < 40 then
    raise exception 'p_secret inválido (se esperaba base64 de 32 bytes)' using errcode = '22023';
  end if;

  v_id := vault.create_secret(p_secret, p_name, coalesce(p_description, ''));
  return v_id;
end;
$$;

comment on function public.no_olvidar_create_kek_secret is
  'Wrapper de vault.create_secret para el KEK del No-Olvidar. Restringido a service_role: evita exponer el schema vault a PostgREST. Lo usa key-manager.rotateKek.';

-- Least privilege: SOLO service_role puede crear material de KEK.
revoke execute on function public.no_olvidar_create_kek_secret(text, text, text) from public, anon, authenticated;
grant  execute on function public.no_olvidar_create_kek_secret(text, text, text) to service_role;
