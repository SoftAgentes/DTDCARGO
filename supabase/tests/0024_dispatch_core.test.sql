\set ON_ERROR_STOP on

-- Contrato de la máquina de estados del despacho (SDD-0024 · migr 0024).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- La orden de despacho es la última milla en Venezuela: el camión, el chofer y
-- las cajas de varios clientes. Su status decide qué ve el camionero en `/m/ve`
-- y qué se le dice al cliente. Retroceder un estado no es un detalle de
-- prolijidad: una orden que vuelve de `entregada` a `en_ruta` deja una entrega
-- firmada colgando de una orden que dice que todavía va en camino.
--
-- El guard vive en la base a propósito —cubre PostgREST directo, no sólo la
-- server action— y no tenía contrato.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Desde un estado terminal (cerrada/cancelada) no se mueve nada.
--   2. 🔴 Desde `entregada` sólo se va a `cerrada`. No se des-entrega.
--   3. 🔴 No se retrocede `lista → cargando` ni `en_ruta → lista`.
--   4. 🔴 La base sella las horas, y respeta la que le pasen: si el caller trae
--      la hora real del evento —el camionero sin señal que sincroniza después—
--      el trigger NO la pisa con `now()`.
--   5. Avanzar por el camino legítimo funciona. Sin este contrato, un guard que
--      bloqueara TODO también «pasaría» los tres de arriba.
--   6. Un UPDATE que no toca el status pasa libre — corregir un dato no puede
--      depender del estado del viaje.
--
-- ⚠️ **Cómo se afirma cada contrato, y por qué así.** Se mira el ESTADO DE LA
-- FILA después del intento, no el texto de la excepción. La primera versión
-- comparaba `sqlerrm` contra un substring y se tragaba su propio mensaje de
-- error («…una orden terminal» contenía la palabra que el handler buscaba), así
-- que salía verde con el guard arrancado. Un contrato no puede depender de cómo
-- está redactado su propio fallo.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.tms_trucks  (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.tms_drivers (id uuid primary key default gen_random_uuid(), tenant_id uuid);

-- La 0024 le agrega una columna (`description`) a la recepción CN. Sólo tiene
-- que existir para que el ALTER aplique; nada de este contrato la mira.
create table public.warehouse_receipts_cn (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

\ir ../migrations/0024_dispatch_core.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
insert into public.tenants (id, slug) values (:'t1', 'dtd');

create or replace function pg_temp.nueva_od(p_status text)
returns uuid language plpgsql as $nod$
declare v_id uuid;
begin
  insert into public.dispatch_orders (tenant_id, order_code, status, hub)
  values ('11111111-1111-1111-1111-111111111111',
          'OD-TEST-' || substr(gen_random_uuid()::text, 1, 8),
          p_status::dispatch_order_status,
          (select min(e.enumlabel)
             from pg_enum e
             join pg_type t on t.oid = e.enumtypid
            where t.typname = 'dispatch_hub')::dispatch_hub)
  returning id into v_id;
  return v_id;
end;
$nod$;

/*
 * ¿Quedó la orden donde estaba? Intenta el cambio tragándose CUALQUIER error y
 * devuelve el status REAL después del intento.
 *
 * Devolver el estado en vez de un booleano es lo que hace al contrato honesto:
 * no importa si el guard rechazó con excepción, con un no-op silencioso o de
 * ninguna forma — lo que se afirma es dónde terminó la fila.
 */
create or replace function pg_temp.intentar(p_id uuid, p_nuevo text)
returns text language plpgsql as $int$
begin
  begin
    update public.dispatch_orders
       set status = p_nuevo::dispatch_order_status
     where id = p_id;
  exception when others then
    null;  -- el rechazo es una de las formas válidas de proteger
  end;
  return (select status::text from public.dispatch_orders where id = p_id);
end;
$int$;

-- ── 1 · 🔴 Los estados terminales no se mueven ────────────────────────────
do $$
declare v_id uuid; v_fin text;
begin
  v_id  := pg_temp.nueva_od('cerrada');
  v_fin := pg_temp.intentar(v_id, 'en_ruta');
  if v_fin <> 'cerrada' then
    raise exception 'CONTRATO 1 ROTO: una orden CERRADA paso a % — se resucito un despacho terminado', v_fin;
  end if;

  v_id  := pg_temp.nueva_od('cancelada');
  v_fin := pg_temp.intentar(v_id, 'en_ruta');
  if v_fin <> 'cancelada' then
    raise exception 'CONTRATO 1 ROTO: una orden CANCELADA paso a %', v_fin;
  end if;
end;
$$;

-- ── 2 · 🔴 De entregada sólo se va a cerrada ──────────────────────────────
do $$
declare v_id uuid; v_fin text;
begin
  v_id  := pg_temp.nueva_od('entregada');
  v_fin := pg_temp.intentar(v_id, 'en_ruta');
  if v_fin <> 'entregada' then
    raise exception
      'CONTRATO 2 ROTO: una orden ENTREGADA paso a % — la entrega firmada queda colgando de un viaje en curso',
      v_fin;
  end if;

  -- Y el único camino permitido SÍ funciona.
  v_fin := pg_temp.intentar(v_id, 'cerrada');
  if v_fin <> 'cerrada' then
    raise exception 'CONTRATO 2 ROTO: entregada → cerrada, que SI es valido, quedo en %', v_fin;
  end if;
end;
$$;

-- ── 3 · 🔴 No se retrocede ────────────────────────────────────────────────
do $$
declare v_id uuid; v_fin text;
begin
  v_id  := pg_temp.nueva_od('lista');
  v_fin := pg_temp.intentar(v_id, 'cargando');
  if v_fin <> 'lista' then
    raise exception 'CONTRATO 3 ROTO: lista → cargando (retroceso); quedo en %', v_fin;
  end if;

  v_id  := pg_temp.nueva_od('en_ruta');
  v_fin := pg_temp.intentar(v_id, 'lista');
  if v_fin <> 'en_ruta' then
    raise exception 'CONTRATO 3 ROTO: en_ruta → lista (retroceso); quedo en %', v_fin;
  end if;
end;
$$;

-- ── 4 · 🔴 Sella la hora, y respeta la que le pasen ───────────────────────
--
-- El `is null` del trigger no es cosmético: el camionero sin señal registra la
-- salida a las 08:00 y sincroniza a las 11:00. Si el trigger pisara con now(),
-- la orden diría que salió a las 11:00 — tres horas de viaje borradas del
-- registro que después se usa para responderle a un cliente.
do $$
declare
  v_id      uuid;
  v_salida  timestamptz;
  v_real    timestamptz := now() - interval '3 hours';
begin
  -- (a) sin hora explícita, la base la pone
  v_id := pg_temp.nueva_od('lista');
  update public.dispatch_orders set status = 'en_ruta' where id = v_id;
  select departed_at into v_salida from public.dispatch_orders where id = v_id;
  if v_salida is null then
    raise exception 'CONTRATO 4 ROTO: pasar a en_ruta no sello departed_at';
  end if;

  update public.dispatch_orders set status = 'entregada' where id = v_id;
  if (select completed_at from public.dispatch_orders where id = v_id) is null then
    raise exception 'CONTRATO 4 ROTO: pasar a entregada no sello completed_at';
  end if;
  if (select departed_at from public.dispatch_orders where id = v_id) <> v_salida then
    raise exception 'CONTRATO 4 ROTO: departed_at cambio al avanzar de estado';
  end if;

  -- (b) 🔴 con hora explícita, el trigger NO la pisa
  v_id := pg_temp.nueva_od('lista');
  update public.dispatch_orders
     set status = 'en_ruta', departed_at = v_real
   where id = v_id;
  select departed_at into v_salida from public.dispatch_orders where id = v_id;
  if v_salida <> v_real then
    raise exception
      'CONTRATO 4 ROTO: el trigger piso la hora real de salida (% en vez de %) — el registro offline se pierde',
      v_salida, v_real;
  end if;
end;
$$;

-- ── 5 · El camino legítimo completo pasa ──────────────────────────────────
do $$
declare v_id uuid; v_fin text;
begin
  v_id := pg_temp.nueva_od('creada');
  foreach v_fin in array array['cargando', 'lista', 'en_ruta', 'entregada', 'cerrada']
  loop
    if pg_temp.intentar(v_id, v_fin) <> v_fin then
      raise exception
        'CONTRATO 5 ROTO: el paso legitimo hacia % fue bloqueado — el guard congela el despacho entero',
        v_fin;
    end if;
  end loop;
end;
$$;

-- ── 6 · Editar sin tocar el status pasa libre ─────────────────────────────
do $$
declare v_id uuid; v_antes timestamptz;
begin
  v_id := pg_temp.nueva_od('cerrada');   -- el estado más restrictivo que hay
  select updated_at into v_antes from public.dispatch_orders where id = v_id;

  -- Corregir un dato de una orden ya cerrada tiene que poder hacerse.
  update public.dispatch_orders set current_city = 'Valencia' where id = v_id;

  if (select current_city from public.dispatch_orders where id = v_id) is distinct from 'Valencia' then
    raise exception 'CONTRATO 6 ROTO: no se pudo editar un campo que no es el status';
  end if;
  if (select updated_at from public.dispatch_orders where id = v_id) < v_antes then
    raise exception 'CONTRATO 6 ROTO: updated_at retrocedio';
  end if;
end;
$$;

rollback;
