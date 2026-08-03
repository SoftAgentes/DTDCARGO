-- 0339_brand_internal_second_gate.sql
-- SDD-0242 · Segunda capa: las piezas de PRODUCTO se abren con un código aparte
--
-- QUÉ PROBLEMA RESUELVE. SDD-0238 dejó 22 piezas fuera de `/marca`: el ERP por
-- dentro, la app del operario, los formularios de inspección, los documentos
-- comerciales. No se publican porque `/marca` es el link que se le pasa a diseño
-- externo y a la imprenta. Pero el founder SÍ necesita abrirlas, y hoy no puede:
-- ni siquiera están en Storage, así que su propio enlace le da la página de
-- aviso.
--
-- LA DECISIÓN (founder, 2026-08-03): que existan detrás de un SEGUNDO código,
-- distinto del de marca. No basta con la sesión del ERP — cualquiera de los 57
-- módulos la tiene, y estas piezas son producto, no marca. Dos códigos, dos
-- capas: el de marca abre el book, el interno abre el producto.
--
-- POR QUÉ UN `scope` Y NO UNA TABLA NUEVA. El bloqueo escalonado ya está escrito
-- y probado en `verify_brand_access_code`; duplicarlo para el código interno
-- sería mantener dos veces la misma lógica de seguridad, que es como se
-- desincronizan. Se le agrega la dimensión que le faltaba —de qué puerta es este
-- intento— y la función sirve a las dos. Los contadores quedan separados: fallar
-- el código interno no bloquea el de marca ni al revés.

-- Sin `begin;/commit;` explícitos: ninguna de las 326 migraciones del repo los
-- usa, y quien las aplica (`apply_migration`) ya envuelve el SQL en su propia
-- transacción. Un `begin` anidado sólo emite un warning, pero el `commit` de
-- adentro cerraría la transacción de afuera y dejaría corriendo suelto lo que
-- viniera después.

-- ─────────────────────────────────────────────────────────────
-- 1. El hash del segundo código
-- ─────────────────────────────────────────────────────────────
-- NULL = las piezas internas no las abre NADIE (ni el founder). Es el estado
-- inicial a propósito: igual que el código de marca, nace cerrado y lo abre una
-- persona desde el ERP. Un default en producción sería peor que no tener nada.

alter table public.brand_access
  add column if not exists internal_code_hash text;

comment on column public.brand_access.internal_code_hash is
  'SDD-0242: bcrypt del código que abre las piezas de PRODUCTO (ERP, operario, inspecciones). Distinto del de marca. NULL = cerrado para todos.';

-- ─────────────────────────────────────────────────────────────
-- 2. De qué puerta es cada intento
-- ─────────────────────────────────────────────────────────────
-- `default 'public'` para que las filas que ya existen queden donde estaban: son
-- intentos contra el código de marca, que es el único que había.

alter table public.brand_access_attempts
  add column if not exists scope text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'brand_access_attempts_scope_check'
  ) then
    alter table public.brand_access_attempts
      add constraint brand_access_attempts_scope_check
      check (scope in ('public', 'internal'));
  end if;
end $$;

comment on column public.brand_access_attempts.scope is
  'SDD-0242: contra qué código fue el intento. Los contadores son independientes — fallar el interno no bloquea el de marca.';

-- El índice viejo no lleva `scope`, así que la cuenta por puerta lo escanearía
-- entero. Se reemplaza en vez de agregar uno: el viejo queda cubierto por el
-- nuevo como prefijo, y dos índices sobre lo mismo es pagar dos escrituras.
drop index if exists public.brand_access_attempts_window_idx;

create index if not exists brand_access_attempts_scope_window_idx
  on public.brand_access_attempts (tenant_id, scope, attempt_key, created_at desc)
  where succeeded = false;

-- ─────────────────────────────────────────────────────────────
-- 3. Verificación con `scope`
-- ─────────────────────────────────────────────────────────────
-- Se DROPEA la de 3 argumentos y se crea con 4, el último con default. Las
-- llamadas que ya existen (`p_tenant_id`, `p_code`, `p_attempt_key`) siguen
-- resolviendo contra la nueva sin tocarlas. La alternativa —crear una sobrecarga
-- de 4— dejaría dos funciones vivas con la misma lógica, que es justo lo que
-- este cambio evita.

drop function if exists public.verify_brand_access_code(uuid, text, text);

create or replace function public.verify_brand_access_code(
  p_tenant_id   uuid,
  p_code        text,
  p_attempt_key text,
  p_scope       text default 'public'
)
returns table (
  ok            boolean,
  locked_until  timestamptz,
  attempts_left integer,
  session_days  integer
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_hash        text;
  v_days        integer;
  v_fails       integer;
  v_last_fail   timestamptz;
  v_tier        integer;
  v_lock        interval;
  v_locked_until timestamptz;
  v_match       boolean;
begin
  -- Forma de entrada inválida → negativo silencioso, sin tocar el contador.
  -- El `scope` desconocido entra acá: un llamador que se equivoque de puerta no
  -- puede abrir la otra por descuido.
  if p_tenant_id is null
     or p_attempt_key is null
     or p_attempt_key !~ '^[0-9a-f]{64}$'
     or p_scope is null
     or p_scope not in ('public', 'internal') then
    return query select false, null::timestamptz, 0, 0;
    return;
  end if;

  select
      case when p_scope = 'internal' then ba.internal_code_hash else ba.code_hash end,
      ba.session_days
    into v_hash, v_days
  from public.brand_access ba
  where ba.tenant_id = p_tenant_id;

  v_days := coalesce(v_days, 30);

  -- ¿Está bloqueado? Se cuentan los fallos POSTERIORES al último acierto DE ESTA
  -- PUERTA: al acertar se borran los intentos de esa huella en ese scope.
  select count(*), max(a.created_at)
    into v_fails, v_last_fail
  from public.brand_access_attempts a
  where a.tenant_id = p_tenant_id
    and a.attempt_key = p_attempt_key
    and a.scope = p_scope
    and a.succeeded = false;

  -- El bloqueo se dispara SÓLO cuando el último fallo cerró un tramo de 3
  -- (3, 6, 9…). Si se evaluara con `v_fails >= 3` a secas, del 3er fallo en
  -- adelante CADA intento posterior volvería a bloquear 5 minutos y el visitante
  -- tendría un intento por ventana, no tres — que no es lo que se pidió.
  if v_fails > 0 and v_fails % 3 = 0 then
    v_tier := v_fails / 3;   -- 3 → 1 (5 min) · 6, 9, … → 2+ (1 hora)
    v_lock := case when v_tier = 1 then interval '5 minutes' else interval '1 hour' end;
    if v_last_fail + v_lock > now() then
      return query select false, (v_last_fail + v_lock)::timestamptz, 0, v_days;
      return;
    end if;
  end if;

  -- Puerta cerrada (nadie puso código para este scope todavía).
  if v_hash is null then
    return query select false, null::timestamptz, 0, v_days;
    return;
  end if;

  v_match := (p_code is not null and length(p_code) > 0
              and v_hash = extensions.crypt(p_code, v_hash));

  if v_match then
    delete from public.brand_access_attempts a
     where a.tenant_id = p_tenant_id
       and a.attempt_key = p_attempt_key
       and a.scope = p_scope;
    return query select true, null::timestamptz, 3, v_days;
    return;
  end if;

  insert into public.brand_access_attempts (tenant_id, attempt_key, succeeded, scope)
  values (p_tenant_id, p_attempt_key, false, p_scope);
  v_fails := v_fails + 1;

  v_tier := v_fails / 3;
  if v_fails % 3 = 0 then
    v_lock := case when v_tier = 1 then interval '5 minutes' else interval '1 hour' end;
    v_locked_until := now() + v_lock;
  end if;

  return query select
    false,
    v_locked_until,
    (3 - (v_fails % 3))::integer,
    v_days;
end;
$function$;

revoke all on function public.verify_brand_access_code(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_brand_access_code(uuid, text, text, text)
  to service_role;

comment on function public.verify_brand_access_code(uuid, text, text, text) is
  'SDD-0238/0242: valida el código de /marca (scope public) o el de las piezas de producto (scope internal), con bloqueo escalonado independiente por puerta (3 fallos → 5 min · 3 más → 1 h). Server-only: sólo service_role.';

-- ─────────────────────────────────────────────────────────────
-- 4. RPC para poner el código interno (admin del tenant)
-- ─────────────────────────────────────────────────────────────
-- Aparte de `set_brand_access_code` y no un parámetro suyo: esa function también
-- fija `session_days`, que es del acceso de marca y no aplica acá. Meterle un
-- scope obligaría a decidir qué hace con los días en cada rama — más ramas en la
-- función que escribe credenciales, que es donde menos conviene tenerlas.

create or replace function public.set_brand_internal_code(
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'sin tenant';
  end if;

  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = v_tenant
      and ut.role = 'admin'
      and ut.disabled_at is null
  ) then
    raise exception 'solo admin';
  end if;

  -- 6 dígitos, no 4 a 6. Esta puerta da a material de producto y la de marca ya
  -- admite 4; dejar el mínimo bajo en la capa más profunda sería al revés de lo
  -- que se pidió. Son 100× más combinaciones por el mismo esfuerzo de tecleo.
  if p_code is not null and length(trim(p_code)) > 0 and trim(p_code) !~ '^\d{6}$' then
    raise exception 'codigo invalido';
  end if;

  insert into public.brand_access (tenant_id, internal_code_hash, updated_by, updated_at)
  values (
    v_tenant,
    case
      when p_code is null or length(trim(p_code)) = 0 then null
      else extensions.crypt(trim(p_code), extensions.gen_salt('bf'))
    end,
    (select auth.uid()),
    now()
  )
  on conflict (tenant_id) do update set
    internal_code_hash = excluded.internal_code_hash,
    updated_by         = excluded.updated_by,
    updated_at         = now();

  -- Sólo los bloqueos de ESTA puerta: cambiar el código interno no debe
  -- perdonarle los intentos fallidos a quien está adivinando el de marca.
  delete from public.brand_access_attempts a
   where a.tenant_id = v_tenant and a.scope = 'internal';
end;
$function$;

revoke all on function public.set_brand_internal_code(text) from public, anon;
grant execute on function public.set_brand_internal_code(text) to authenticated;

comment on function public.set_brand_internal_code(text) is
  'SDD-0242: pone (o quita, con NULL) el código de 6 dígitos que abre las piezas de producto en /marca. Sólo admin del tenant. Hashea con bcrypt en el servidor.';


