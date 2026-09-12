-- ─────────────────────────────────────────────────────────────
-- 0451 · SDD-0461 — La CADENA de aliados tampoco cruza tenants.
--
-- QUÉ CIERRA LA 0450 Y QUÉ DEJÓ ABIERTO
-- La 0450 (aplicada) exige que `clients.aliado_id` apunte a un aliado del MISMO
-- tenant. Pero la entidad `aliados` nació en la 0362 con otras dos FK simples que
-- tampoco comparan tenants, y la coherencia del cliente no alcanza a taparlas:
--
--   1. `aliados.parent_aliado_id` (0362:69) → `aliados (id)`, de cualquier tenant.
--      Un sub-aliado de T1 puede colgar de un aliado de T2. Entonces:
--        · `aliado_prefix_chain` (0362:159-179) compone la insignia subiendo por
--          esa cadena, así que el Shipping Mark guardado mezcla el prefijo de dos
--          empresas (`DC-HR-1232`, con DC de otro tenant);
--        · `resolve_price_book` (0382:292-328) sube por la misma cadena hasta el
--          RAÍZ y devuelve `pb.id` SIN filtrar `pb.tenant_id` en la rama del
--          aliado. Si el raíz quedó en T2, el cliente de T1 se cotiza con la LISTA
--          DE PRECIOS de la otra empresa. Es el hueco de dinero, no sólo de marca.
--   2. `aliados.client_id` (0362:66) → `clients (id)`, de cualquier tenant.
--      `convertirEnAliadoAction` (app/studio/(app)/clientes/actions.ts:880-888)
--      inserta el `clientId` que viene del formulario, y la RLS de `aliados`
--      (0362:146-149) sólo mira `aliados.tenant_id`: nada compara el tenant del
--      cliente. Un aliado de T1 puede quedar colgado de un cliente de T2, que es
--      el ancla de su ficha en el Studio.
--
-- Hallazgo registrado como FUERA DE ALCANCE en
-- `.agents/handoffs/aliado-tenant-coherence.md` cuando se escribió la 0450.
--
-- EL ARREGLO: DOS FK COMPUESTAS, COMO EN LA 0450
--   · `aliados (tenant_id, parent_aliado_id) → aliados (tenant_id, id)`, que
--     reutiliza el destino `aliados_tenant_id_id_key` que ya creó la 0450;
--   · `aliados (tenant_id, client_id) → clients (tenant_id, id)`, que necesita un
--     destino nuevo: `clients_tenant_id_id_key`. La 0450 NO lo creó — creó el de
--     `aliados` — así que acá se agrega, y es trivialmente única porque `id` ya es
--     la PK de `clients`.
-- Postgres las vigila por los dos lados: rechaza el enlace cruzado y rechaza
-- mover de tenant a cualquiera de las dos puntas. Con trigger harían falta cuatro
-- funciones vivas, y una función viva se puede reescribir mal (ver la cabecera de
-- la 0361).
--
-- SEMÁNTICA: LA MISMA DE LAS FK SIMPLES DE LA 0362
--   · MATCH SIMPLE. Para el padre es imprescindible: `parent_aliado_id` NULL es un
--     aliado RAÍZ, y MATCH FULL lo rechazaría porque `tenant_id` nunca es NULL.
--     Para `client_id` da igual (es `not null`), y se deja SIMPLE por simetría.
--   · ON DELETE RESTRICT, como las simples de la 0362: borrar un aliado con
--     sub-aliados, o un cliente que es el ancla de un aliado, se bloquea con el
--     MISMO SQLSTATE de hoy. Los borrados no cambian de comportamiento: cada fila
--     que estas FK protegen ya la protegía la FK simple de una columna.
--   · ON UPDATE NO ACTION, como las simples. Lo nuevo es que ahora mover de tenant
--     a un aliado con hijos, a un aliado con ancla, o al cliente-ancla, falla.
--   · `deleted_at` no exime: la FK mira todas las filas, vivas o no.
--   · La 0362 conserva sus FK simples de una columna. PostgREST sólo resuelve el
--     embed por columna con FK de UNA columna, y `listAliadoOptions`
--     (lib/studio/aliados/aliado-queries.ts:41) pide `clients:client_id (markbox)`.
--     Igual que en la 0450, las dos FK conviven: la simple sirve al embed y la
--     compuesta exige el tenant.
--
-- UNA SOLA SENTENCIA, CON LOCKS ANTES DEL PREFLIGHT
-- Locks, preflight y DDL van en un único bloque `do`, así el conteo y las FK
-- comparten transacción aunque alguien aplique el archivo en autocommit. El orden
-- de los locks es el MISMO de la 0450 (primero `aliados`, después `clients`): dos
-- migraciones de esta familia corriendo a la vez no se abrazan.
-- `clients` va en ACCESS EXCLUSIVE, un nivel MÁS ALTO que en la 0450, porque acá
-- se le agrega una constraint única y eso pide reescribir el catálogo y construir
-- el índice: mientras corre, `clients` no se puede ni leer. Es el precio de tener
-- el destino de la FK; el índice es sobre unos cientos de filas.
-- `lock_timeout` de 5 s, como en la 0342, la 0383 y la 0450: si otra transacción
-- retiene alguna de las dos tablas, la migración falla rápido en vez de encolar
-- las lecturas del Studio y del Portal.
--
-- PREFLIGHT SIN DML
-- Dos conteos, uno por FK. Si ya existe una fila incoherente, la migración FALLA
-- antes de cualquier DDL y no toca nada. Reporta sólo el CONTEO: el mensaje queda
-- en los logs, así que no lleva ids, prefijos ni Shipping Marks. Qué hacer con
-- cada fila se decide aparte con el founder; esta migración nunca la corrige en
-- silencio. El conteo previo del Director (2026-09-12, sólo agregados) dio 0 y 0,
-- pero el preflight se queda: entre esa lectura y la aplicación puede entrar un
-- sub-aliado nuevo.
--
-- EL FILTRO EXPLÍCITO DE `get_portal_brand()`
-- La 0401 resuelve la marca del Portal con `join aliados a on a.id = c.aliado_id`
-- (0401:41-42), sin comparar tenants. Con la 0450 aplicada ese join YA es coherente
-- por construcción, así que el filtro es cinturón y tirantes: si algún día la FK
-- compuesta se cayera, o se aplicara este archivo antes que la 0450, la RPC no
-- entregaría la marca de otra empresa. Se redefine acá con `create or replace` y
-- NO se modifica la 0401, que ya está aplicada. Mismo cuerpo, misma firma, mismos
-- grants; lo único que cambia es la condición del join.
--
-- IDEMPOTENTE SIN DROPS
-- Crea sólo lo que falta y después comprueba la forma exacta de lo que quedó: una
-- constraint homónima con otra forma hace fallar la migración en vez de darse por
-- buena. Como no suelta nada, una FK futura que reutilice cualquiera de los dos
-- destinos únicos no rompe una reaplicación.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0451_aliados_cadena_mismo_tenant`.
-- ─────────────────────────────────────────────────────────────

do $migracion$
declare
  v_padres   bigint;
  v_anclas   bigint;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '60s';

  lock table public.aliados in access exclusive mode;
  lock table public.clients in access exclusive mode;

  -- ─── Preflight 1: la cadena de aliados ─────────────────────────────────────
  select count(*)
    into v_padres
    from public.aliados hijo
    join public.aliados padre on padre.id = hijo.parent_aliado_id
   where padre.tenant_id <> hijo.tenant_id;

  if v_padres > 0 then
    raise exception '0451: % aliado(s) cuelgan de un aliado de otro tenant; esta migración no los corrige',
      v_padres
      using hint = 'Decidir cada fila aparte con el founder (reasignar el padre del tenant correcto '
                   || 'o dejar parent_aliado_id en NULL) y volver a aplicar.';
  end if;

  -- ─── Preflight 2: el cliente-ancla del aliado ──────────────────────────────
  select count(*)
    into v_anclas
    from public.aliados a
    join public.clients c on c.id = a.client_id
   where c.tenant_id <> a.tenant_id;

  if v_anclas > 0 then
    raise exception '0451: % aliado(s) cuelgan de un cliente de otro tenant; esta migración no los corrige',
      v_anclas
      using hint = 'Decidir cada fila aparte con el founder (apuntar client_id al cliente del tenant '
                   || 'correcto) y volver a aplicar.';
  end if;

  -- ─── Destino de la FK del padre ────────────────────────────────────────────
  -- Lo creó la 0450. Se cubre el caso de aplicar este archivo por su cuenta: sin
  -- esto la FK compuesta no tendría a qué apuntar.
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.aliados'::regclass and conname = 'aliados_tenant_id_id_key'
  ) then
    alter table public.aliados
      add constraint aliados_tenant_id_id_key unique (tenant_id, id);
  end if;

  -- ─── Destino de la FK del cliente-ancla ────────────────────────────────────
  -- Trivialmente única, porque `id` ya es PK de `clients`. Existe sólo porque una
  -- FK compuesta necesita del otro lado una constraint única con esas columnas.
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.clients'::regclass and conname = 'clients_tenant_id_id_key'
  ) then
    alter table public.clients
      add constraint clients_tenant_id_id_key unique (tenant_id, id);
  end if;

  -- ─── FK 1: el padre es del mismo tenant ────────────────────────────────────
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.aliados'::regclass and conname = 'aliados_parent_mismo_tenant_fkey'
  ) then
    alter table public.aliados
      add constraint aliados_parent_mismo_tenant_fkey
      foreign key (tenant_id, parent_aliado_id)
      references public.aliados (tenant_id, id)
      match simple
      on update no action
      on delete restrict;
  end if;

  -- ─── FK 2: el cliente-ancla es del mismo tenant ────────────────────────────
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.aliados'::regclass and conname = 'aliados_client_mismo_tenant_fkey'
  ) then
    alter table public.aliados
      add constraint aliados_client_mismo_tenant_fkey
      foreign key (tenant_id, client_id)
      references public.clients (tenant_id, id)
      match simple
      on update no action
      on delete restrict;
  end if;

  -- ─── Postflight: la forma exacta, también si ya existían ───────────────────
  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.clients'::regclass
       and c.conname = 'clients_tenant_id_id_key'
       and c.contype = 'u'
       and c.conkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'id')]
  ) then
    raise exception '0451: clients_tenant_id_id_key existe con otra forma; revisar antes de aplicar';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.aliados'::regclass
       and c.conname = 'aliados_parent_mismo_tenant_fkey'
       and c.contype = 'f'
       and c.confrelid = 'public.aliados'::regclass
       and c.confmatchtype = 's'
       and c.confdeltype = 'r'
       and c.confupdtype = 'a'
       and c.convalidated
       and c.conkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'parent_aliado_id')]
       and c.confkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'id')]
  ) then
    raise exception '0451: aliados_parent_mismo_tenant_fkey existe con otra forma; revisar antes de aplicar';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.aliados'::regclass
       and c.conname = 'aliados_client_mismo_tenant_fkey'
       and c.contype = 'f'
       and c.confrelid = 'public.clients'::regclass
       and c.confmatchtype = 's'
       and c.confdeltype = 'r'
       and c.confupdtype = 'a'
       and c.convalidated
       and c.conkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'client_id')]
       and c.confkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'id')]
  ) then
    raise exception '0451: aliados_client_mismo_tenant_fkey existe con otra forma; revisar antes de aplicar';
  end if;
end;
$migracion$;

comment on constraint clients_tenant_id_id_key on public.clients is
  'SDD-0461: destino de aliados_client_mismo_tenant_fkey. Trivialmente única (id ya es PK).';

comment on constraint aliados_parent_mismo_tenant_fkey on public.aliados is
  'SDD-0461: un sub-aliado sólo cuelga de un aliado de su mismo tenant, así que aliado_prefix_chain no '
  'mezcla prefijos de dos empresas y resolve_price_book no llega a la lista de precios de otro tenant. '
  'Convive con la FK simple de la 0362. MATCH SIMPLE (parent_aliado_id NULL = aliado raíz), '
  'ON DELETE RESTRICT y ON UPDATE NO ACTION, como la simple.';

comment on constraint aliados_client_mismo_tenant_fkey on public.aliados is
  'SDD-0461: el cliente-ancla de un aliado es de su mismo tenant. Convive con la FK simple de la 0362, '
  'que sigue sirviendo al embed PostgREST clients:client_id. MATCH SIMPLE, ON DELETE RESTRICT y '
  'ON UPDATE NO ACTION, como la simple.';

-- ─── La marca del Portal filtra el tenant, sin tocar la 0401 ─────────────────
-- Copia exacta de la 0401 con una sola línea nueva: `and a.tenant_id = c.tenant_id`.
-- Misma firma, así que `create or replace` conserva el oid, y con él las
-- dependencias y el ACL; los grants se repiten igual para que el estado final no
-- dependa de lo que haya quedado antes.

create or replace function public.get_portal_brand()
returns table (
  trade_name text,
  brand_name text,
  brand_primary text,
  brand_secondary text,
  support_email text,
  support_whatsapp text,
  support_website text,
  hide_dtd_brand boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    a.trade_name,
    a.brand_name,
    a.brand_primary,
    a.brand_secondary,
    a.support_email,
    a.support_whatsapp,
    a.support_website,
    a.hide_dtd_brand
  from public.client_users as cu
  join public.clients as c
    on c.id = cu.client_id
   and c.deleted_at is null
  join public.aliados as a
    on a.id = c.aliado_id
   and a.tenant_id = c.tenant_id
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
  limit 1
$function$;

comment on function public.get_portal_brand() is
  'SDD-0336, filtro de tenant por SDD-0461: marca white-label del cliente del Portal autenticado. '
  'Sin parámetros; identidad derivada de auth.uid(). El join exige a.tenant_id = c.tenant_id, así que '
  'ni con la FK compuesta caída entregaría la marca de otra empresa. Devuelve sólo campos públicos de marca.';

revoke all on function public.get_portal_brand()
  from public, anon, service_role;
grant execute on function public.get_portal_brand()
  to authenticated;

do $postflight_rpc$
begin
  if pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure)
       !~* 'a\.tenant_id\s*=\s*c\.tenant_id' then
    raise exception '0451: get_portal_brand() quedó sin el filtro de tenant; revisar antes de aplicar';
  end if;
end;
$postflight_rpc$;
