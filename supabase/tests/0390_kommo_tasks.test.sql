\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0390 (SDD-0288). Fixtures ficticios + rollback.
--
-- Carga la migración REAL con `\i` en vez de copiar su DDL: un contrato que
-- reimplementa el esquema deja de medir el archivo que se aplica a producción.
--
-- Valida con MUTACIÓN donde la mutación significa algo: cada bloque intenta la
-- operación prohibida y falla si NO la bloquean. Un test que sólo ejercita el
-- camino feliz no prueba que el camino prohibido esté cerrado.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

-- ── Lo que el preflight de la 0390 exige ────────────────────────────────────
create table public.tenants (id uuid primary key);

create function public.get_user_tenant_id()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.tenant', true), '')::uuid $$;

-- ── DDL bajo prueba: el archivo real ────────────────────────────────────────
\i /sb/migrations/0390_kommo_tasks.sql

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into public.tenants (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Mismo id de tarea en los dos tenants a propósito: la PK es (tenant_id, id),
-- así que tiene que convivir. Si alguien la cambiara a PK simple, esto revienta.
insert into public.kommo_tasks
  (tenant_id, id, entity_id, entity_type, text, complete_till, is_completed) values
  ('11111111-1111-1111-1111-111111111111', 5001, 900001, 'leads',
   'Responder al cliente', now() - interval '2 hours', false),
  ('11111111-1111-1111-1111-111111111111', 5002, 900002, 'leads',
   'Responder al cliente', now() + interval '2 hours', false),
  ('11111111-1111-1111-1111-111111111111', 5003, 900003, 'leads',
   'Ya atendida', now() - interval '5 hours', true),
  ('22222222-2222-2222-2222-222222222222', 5001, 900099, 'leads',
   'Tarea del OTRO tenant', now() - interval '2 hours', false);

-- ── 1. MUTACIÓN · el tenant A NO puede ver al tenant B ──────────────────────
-- Si esto pasa, la RLS es decorativa y el espejo filtra trabajo entre empresas.
do $aislamiento$
declare
  visibles int;
  ajenos   int;
begin
  perform set_config('request.jwt.claim.tenant',
                     '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;

  select count(*) into visibles from public.kommo_tasks;
  select count(*) into ajenos   from public.kommo_tasks
   where tenant_id = '22222222-2222-2222-2222-222222222222';

  reset role;

  if visibles <> 3 then
    raise exception 'TEST 0390: el tenant A ve % filas, esperaba 3', visibles;
  end if;
  if ajenos <> 0 then
    raise exception 'TEST 0390: FUGA — el tenant A ve % filas del tenant B', ajenos;
  end if;
end;
$aislamiento$;

-- ── 2. MUTACIÓN · authenticated NO escribe el espejo ────────────────────────
-- Lo escribe SOLO el sync (service_role). Si authenticated pudiera insertar,
-- cualquiera con sesión se fabrica una alerta roja — o se la borra a otro.
do $solo_lectura$
declare
  inserto boolean := false;
  borro   boolean := false;
begin
  perform set_config('request.jwt.claim.tenant',
                     '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;

  begin
    insert into public.kommo_tasks (tenant_id, id, entity_type, entity_id)
    values ('11111111-1111-1111-1111-111111111111', 9999, 'leads', 900001);
    inserto := true;
  exception when insufficient_privilege or check_violation then
    null;
  end;

  -- Apagar una alerta ajena borrando su fila sería igual de grave que crearla.
  begin
    delete from public.kommo_tasks
     where tenant_id = '11111111-1111-1111-1111-111111111111' and id = 5001;
    borro := true;
  exception when insufficient_privilege then
    null;
  end;

  reset role;

  if inserto then
    raise exception 'TEST 0390: authenticated pudo INSERTAR en el espejo';
  end if;
  if borro then
    raise exception 'TEST 0390: authenticated pudo BORRAR del espejo';
  end if;
end;
$solo_lectura$;

-- ── 3. MUTACIÓN · anon no ve absolutamente nada ─────────────────────────────
do $anon$
declare
  bloqueado boolean := false;
begin
  set local role anon;
  begin
    perform 1 from public.kommo_tasks;
  exception when insufficient_privilege then
    bloqueado := true;
  end;
  reset role;

  if not bloqueado then
    raise exception 'TEST 0390: anon pudo LEER el espejo de tareas';
  end if;
end;
$anon$;

-- ── 4. El índice parcial existe Y lleva el predicado ────────────────────────
-- Sin el `where is_completed = false` el índice cubre también las completadas,
-- que con el tiempo son la mayoría: deja de ser el índice que la pantalla
-- necesita y nadie se entera, porque la consulta sigue devolviendo lo correcto,
-- sólo que escaneando de más.
--
-- ⚠️ Esto afirma la ESTRUCTURA, no que el planner lo elija: con 4 filas de
-- fixture un seq scan siempre gana, así que un test de plan mediría el tamaño
-- del fixture, no el índice.
do $indice$
declare
  def text;
begin
  select indexdef into def
    from pg_indexes
   where schemaname = 'public'
     and tablename  = 'kommo_tasks'
     and indexname  = 'kommo_tasks_pendientes_idx';

  if def is null then
    raise exception 'TEST 0390: falta el indice kommo_tasks_pendientes_idx';
  end if;
  if def not like '%is_completed = false%' then
    raise exception 'TEST 0390: el indice no es PARCIAL sobre abiertas (def=%)', def;
  end if;
  if def not like '%entity_id%' or def not like '%complete_till%' then
    raise exception 'TEST 0390: el indice no cubre entity_id + complete_till (def=%)', def;
  end if;
end;
$indice$;

-- ── 5. La consulta que pinta el rojo devuelve exactamente un lead ───────────
-- Es la definición literal de "sin atender": abierta ∧ vencida ∧ de un lead.
-- El fixture tiene una de cada trampa: futura (5002) y completada-vencida (5003).
do $derivada$
declare
  n     int;
  cual  bigint;
begin
  select count(*), min(entity_id) into n, cual
    from public.kommo_tasks
   where tenant_id    = '11111111-1111-1111-1111-111111111111'
     and entity_type  = 'leads'
     and is_completed = false
     and complete_till < now();

  if n <> 1 then
    raise exception 'TEST 0390: "sin atender" devolvio % leads, esperaba 1', n;
  end if;
  if cual <> 900001 then
    raise exception 'TEST 0390: "sin atender" senalo el lead %, esperaba 900001', cual;
  end if;
end;
$derivada$;

-- ── 6. Borrar el tenant se lleva sus tareas (FK on delete cascade) ──────────
-- Sin cascade, dar de baja una empresa dejaría su trabajo pendiente colgando.
do $cascade$
declare
  quedan int;
begin
  delete from public.tenants where id = '22222222-2222-2222-2222-222222222222';
  select count(*) into quedan from public.kommo_tasks
   where tenant_id = '22222222-2222-2222-2222-222222222222';
  if quedan <> 0 then
    raise exception 'TEST 0390: quedaron % tareas huerfanas tras borrar el tenant', quedan;
  end if;
end;
$cascade$;

rollback;
