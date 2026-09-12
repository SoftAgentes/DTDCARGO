-- ─────────────────────────────────────────────────────────────
-- 0450 · SDD-0456 — Un cliente sólo cuelga de un aliado de SU tenant.
--
-- EL HUECO (anterior a esta migración; también existe en main)
-- `clients.aliado_id` nació en la 0362 con una FK simple a `aliados (id)`, que
-- acepta el id de un aliado de CUALQUIER tenant. Ni esa FK ni los guards de las
-- migraciones 0362, 0371 y 0372 comparan tenants. La marca white-label se
-- resuelve por ese vínculo (`resolveBrandForClient` en
-- lib/studio/aliados/brand-resolve.ts, y la RPC `get_portal_brand()` de la 0401,
-- PR #82, pendiente), y esa marca define el EMISOR del comprobante y de las
-- etiquetas (lib/shared/brand-context.ts:4-7). Un cliente de T1 enlazado al
-- aliado de T2 imprime documentos con la marca y el contacto de otra empresa. El
-- Worker de L01 lo reprodujo en Postgres efímero.
--
-- EL ARREGLO: UNA FK COMPUESTA, NO UN TRIGGER
-- `(tenant_id, aliado_id) → aliados (tenant_id, id)`. Postgres la vigila por los
-- DOS lados: rechaza enlazar un cliente a un aliado ajeno, mover de tenant a un
-- cliente sin soltar su aliado y mover de tenant a un aliado que tiene clientes.
-- Con trigger harían falta dos funciones, una por tabla, y una función viva se
-- puede reescribir mal (ver la cabecera de la 0361). La 0382 usa trigger para
-- `price_books` porque además exige que el aliado sea raíz y esté vivo. Aquí la
-- regla es sólo de tenant, que es justo lo que expresa una FK.
--
-- LA FK SIMPLE DE LA 0362 SE QUEDA
-- PostgREST resuelve el embed por columna `aliados:aliado_id (...)`
-- (brand-resolve.ts y app/studio/(app)/etiquetas/page.tsx) sólo con FKs de UNA
-- columna. Verificado con PostgREST 16.1: sin la simple, ese embed responde
-- PGRST200 y la marca caería a DTD en silencio para todo cliente de aliado. Las
-- dos conviven: la simple sirve al embed y la compuesta exige el tenant.
--
-- SEMÁNTICA: LA MISMA DE LA FK SIMPLE
--   · MATCH SIMPLE: con `aliado_id` NULL (cliente directo) no se chequea nada.
--     MATCH FULL rechazaría a todos los directos, porque `tenant_id` nunca es NULL.
--   · ON DELETE RESTRICT, como en la 0362: un aliado con clientes no se borra, y
--     el bloqueo sale con el mismo SQLSTATE de hoy. Nada de SET NULL sin lista de
--     columnas: pondría en NULL también `clients.tenant_id`.
--   · ON UPDATE NO ACTION, como en la 0362: cambiar `aliados.tenant_id` con
--     clientes colgando falla al terminar la sentencia.
--   · `deleted_at` no exime a nadie: la FK mira todas las filas, vivas o no.
--   · Sin índice nuevo, igual que la FK simple: sólo se consulta al borrar o
--     mover un aliado, que es raro.
--
-- UNA SOLA SENTENCIA, CON LOCKS ANTES DEL PREFLIGHT
-- Locks, preflight y DDL van en un único bloque `do`: el conteo y la FK comparten
-- transacción aunque alguien la aplique fuera de una. Los locks se toman antes
-- del conteo y en orden fijo. `aliados` va en ACCESS EXCLUSIVE, que la
-- constraint única pide igual, así no hay que subir de nivel a mitad de camino.
-- `clients` va en SHARE ROW EXCLUSIVE: frena escrituras y deja leer mientras se
-- valida la FK. Así, entre el conteo y la FK no se cuela una fila incoherente,
-- que fallaría como 23503 crudo y con uuids en el DETAIL. `lock_timeout` de 5 s,
-- como en la 0342 y la 0383: si otra transacción retiene alguna de las dos
-- tablas, la migración falla rápido en vez de encolar las lecturas del Studio y
-- del Portal.
--
-- PREFLIGHT SIN DML
-- Si ya existen filas incoherentes, la migración FALLA antes de cualquier DDL y
-- no toca nada. Reporta sólo el CONTEO; el mensaje queda en los logs, así que no
-- lleva ids ni Shipping Marks. Qué hacer con cada fila (reasignarle el aliado
-- del tenant correcto o dejar `aliado_id` en NULL) se decide aparte con el
-- founder. Esta migración nunca las corrige en silencio.
--
-- IDEMPOTENTE SIN DROPS
-- Crea sólo lo que falta y después comprueba la forma exacta de lo que quedó: si
-- una constraint con el mismo nombre ya existía con otra forma, falla en vez de
-- darla por buena. Como no suelta nada, una FK futura que reutilice
-- `aliados_tenant_id_id_key` no rompe una reaplicación.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0450_clients_aliado_mismo_tenant`.
-- ─────────────────────────────────────────────────────────────

do $migracion$
declare
  v_incoherentes bigint;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '60s';

  lock table public.aliados in access exclusive mode;
  lock table public.clients in share row exclusive mode;

  -- ─── Preflight: nada de DML silencioso ─────────────────────────────────────
  select count(*)
    into v_incoherentes
    from public.clients c
    join public.aliados a on a.id = c.aliado_id
   where a.tenant_id <> c.tenant_id;

  if v_incoherentes > 0 then
    raise exception '0450: % cliente(s) cuelgan de un aliado de otro tenant; esta migración no los corrige',
      v_incoherentes
      using hint = 'Decidir cada fila aparte con el founder (reasignar el aliado del tenant correcto '
                   || 'o dejar aliado_id en NULL) y volver a aplicar.';
  end if;

  -- ─── El destino de la FK compuesta ─────────────────────────────────────────
  -- Trivialmente única, porque `id` ya es PK. Existe sólo porque una FK
  -- compuesta necesita del otro lado una constraint única con esas columnas.
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.aliados'::regclass and conname = 'aliados_tenant_id_id_key'
  ) then
    alter table public.aliados
      add constraint aliados_tenant_id_id_key unique (tenant_id, id);
  end if;

  -- ─── La FK compuesta ───────────────────────────────────────────────────────
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.clients'::regclass and conname = 'clients_aliado_mismo_tenant_fkey'
  ) then
    alter table public.clients
      add constraint clients_aliado_mismo_tenant_fkey
      foreign key (tenant_id, aliado_id)
      references public.aliados (tenant_id, id)
      match simple
      on update no action
      on delete restrict;
  end if;

  -- ─── Postflight: la forma exacta, también si ya existían ───────────────────
  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.aliados'::regclass
       and c.conname = 'aliados_tenant_id_id_key'
       and c.contype = 'u'
       and c.conkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'id')]
  ) then
    raise exception '0450: aliados_tenant_id_id_key existe con otra forma; revisar antes de aplicar';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.clients'::regclass
       and c.conname = 'clients_aliado_mismo_tenant_fkey'
       and c.contype = 'f'
       and c.confrelid = 'public.aliados'::regclass
       and c.confmatchtype = 's'
       and c.confdeltype = 'r'
       and c.confupdtype = 'a'
       and c.convalidated
       and c.conkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.clients'::regclass and attname = 'aliado_id')]
       and c.confkey = array[
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'tenant_id'),
             (select attnum from pg_catalog.pg_attribute
               where attrelid = 'public.aliados'::regclass and attname = 'id')]
  ) then
    raise exception '0450: clients_aliado_mismo_tenant_fkey existe con otra forma; revisar antes de aplicar';
  end if;
end;
$migracion$;

comment on constraint aliados_tenant_id_id_key on public.aliados is
  'SDD-0456: destino de clients_aliado_mismo_tenant_fkey. Trivialmente única (id ya es PK).';

comment on constraint clients_aliado_mismo_tenant_fkey on public.clients is
  'SDD-0456: un cliente sólo cuelga de un aliado de su mismo tenant. Convive con la FK simple de la 0362, '
  'que sigue sirviendo al embed PostgREST aliados:aliado_id. MATCH SIMPLE (aliado_id NULL = cliente directo), '
  'ON DELETE RESTRICT y ON UPDATE NO ACTION, como la simple.';
