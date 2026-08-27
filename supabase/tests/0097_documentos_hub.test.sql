\set ON_ERROR_STOP on

-- Contrato del hub de documentos (SDD-0049 · migr 0097).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- `documents` es el adjunto de cualquier transacción del ERP — el BL de un
-- embarque, la factura de un proveedor, el comprobante de un pago. Es
-- **polimórfico y NO tiene FK**: `entity_type` + `entity_id` apuntan a nueve
-- tablas distintas y nada en el esquema obliga a que ese id exista.
--
-- Lo único que lo sostiene es un trigger. La propia migración lo dice y
-- explica por qué está en la base y no en la app: *«la server action valida,
-- PERO un cliente Supabase directo (PostgREST) la saltaría»*. Es decir: este
-- guard existe precisamente para el caso que los tests de la app no pueden
-- probar — hay que escribir en la tabla como lo haría quien se los salta.
--
-- Si se cae, el BL de una empresa queda colgado del embarque de otra, o de un
-- uuid que no es nada.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Las tres formas de forjar un `entity_id`: inexistente · de otra
--      empresa · **de otro tipo** (el id de una factura declarado como
--      embarque). La tercera es la que un `exists` mal escrito deja pasar.
--   2. 🔴 Y el guard cubre el **UPDATE**, no sólo el INSERT: un documento
--      legítimo no se puede *mover* después a una entidad ajena.
--   3. 🔴 La rama `else` del CASE es **fail-closed**. Es la que se olvida el
--      día que se agrega un tipo adjuntable al enum: se agrega uno sin tocar
--      el CASE y la base tiene que **rechazar**, no aceptar a ciegas.
--   4. 🔴 El CHECK de coherencia tapa el hueco del helper. El helper devuelve
--      `true` cuando `entity_id` es null — así que sin el CHECK un documento
--      podría declararse `shipment` SIN id y colgar de «un embarque» que no
--      existe. Las dos piezas se necesitan y por eso van juntas.
--   5. 🔴 Una entidad dada de baja no admite adjuntos nuevos: el helper exige
--      `deleted_at is null` en la tabla apuntada.
--   6. 🔴 RLS por empresa. Y los borrados SÍ se leen: quien los oculta es la
--      app (`.is("deleted_at", null)` en cada query), no la base. Lo abrió la
--      0230 a propósito y este contrato lo fija para que se note el día que
--      alguien lo cierre creyendo que corrige un descuido.
--   7. 🔴 El Storage está acotado por el primer segmento del path en las TRES
--      operaciones —subir, leer, borrar—, no en una. ⚠️ El escenario de
--      borrado NO aísla su policy: con la de DELETE abierta de par en par el
--      archivo ajeno sobrevive igual, porque un `delete … where name = …`
--      referencia una columna y Postgres aplica también las policies de
--      SELECT. Buena noticia como defensa en profundidad, mala como medición
--      — por eso el contrato mira además las tres policies una por una.
--   8. 🔴 El bucket es privado y no acepta `text/html` ni ejecutables. Un HTML
--      servido desde el dominio propio es XSS con sesión.
--   9. El mismo objeto del bucket no se indexa dos veces.
--  10. 🔴 El borrado suave es un CANDADO, no una convención: `authenticated`
--      no puede destruir la fila.
--
-- ── LO QUE SE MIDIÓ Y CAMBIÓ (2026-08-27) ─────────────────────────────────
--
-- Este bloque decía «TRES COSAS MEDIDAS QUE ESTE CONTRATO NO CIERRA». Dos ya no
-- van: una se cerró, la otra estaba MAL — describía la 0097 aislada, que es lo
-- único que este archivo aplicaba, y en producción la 0230 la había volteado.
--
--   A. ✅ **CERRADO** (migr 0394 · contrato 10). La tabla decía «soft delete
--      (auditable)» y el grant incluía `delete`: `authenticated` borraba la fila
--      de verdad y la auditoría se iba con ella. Ni `legal_hold = true` lo
--      frenaba, y tras el borrado no sobrevivía ningún evento en
--      `entity_audit_log` — con la 0313 (SDD-0224) prometiendo motivo, autor y
--      cadena auditable. Era el mismo hueco que la 0097 dice defender —el
--      cliente PostgREST que se salta la server action— dejado abierto en el
--      borrado. La 0394 le quita el `delete` al grant: falla con 42501, visible,
--      en vez de un 200 con la fila destruida.
--   B. ❌ **ERA FALSO.** Decía que un documento borrado «no se puede
--      restaurar» porque el `using` de la policy exige `deleted_at is null`. Eso
--      valía sólo contra la 0097 sola. La **0230** se lo quitó a ~60 tablas
--      —incluida ésta— porque ese `using` bloqueaba el propio soft-delete:
--      Postgres exige que la fila resultante de un UPDATE siga cumpliendo el
--      USING, así que poner `deleted_at` violaba la policy para cualquier
--      usuario, siempre. Medido con el schema entero reconstruido: el equipo VE
--      el borrado y lo restaura con `update … set deleted_at = null`. Está
--      abierto y es deliberado; ahora el contrato 6 lo fija.
--   C. 🔴 **SIGUE ABIERTO.** `anon` puede EJECUTAR `document_entity_in_tenant`.
--      Es `security definer`, lee nueve tablas saltándose sus grants y devuelve
--      un booleano: es un **oráculo de existencia**. Hay que adivinar dos uuids,
--      así que el riesgo práctico es bajo, pero le falta el `revoke … from
--      public, anon` que la convención del repo pide en toda función nueva.
--
-- ── ⚠️ LO QUE ESTE CONTRATO SIGUE SIN MIRAR ───────────────────────────────
--
-- El borrado del equipo NO exige motivo ni deja autor. La 0313 (SDD-0224) creó
-- `soft_delete_document(id, motivo)` —motivo de ≥8 caracteres, `deleted_by`,
-- `deletion_reason` y evento de auditoría— y **la app no la llama**: las dos
-- acciones que borran (`deleteDocument`, `deleteTaskAttachmentAction`) hacen
-- `update … set deleted_at = now()` a pelo. La 0394 cierra la destrucción de la
-- fila, no la falta de motivo. Decisión del founder (2026-08-27): se decide
-- aparte.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Las nueve tablas adjuntables tienen la misma forma para lo que el helper
-- mira: id, tenant_id y deleted_at.
do $esq$
declare t text;
begin
  foreach t in array array['shipments','invoices','supplier_bills','supplier_payments',
                           'journal_entries','clients','suppliers','consolidations','bookings'] loop
    execute format(
      'create table public.%I (id uuid primary key default gen_random_uuid(),
         tenant_id uuid not null, deleted_at timestamptz)', t);
  end loop;
end;
$esq$;

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $t$
begin new.updated_at := now(); return new; end;
$t$;

\ir ../migrations/0097_documentos_hub.sql

-- ⚠️ NO ALCANZA CON LA 0097. Este contrato aplicaba SÓLO esa migración, y por eso
-- llevaba meses midiendo un estado que en producción ya no existe: la **0230**
-- (bugfix, sin SDD) barrió ~60 tablas y le quitó el `and deleted_at is null` al
-- `using` de toda policy FOR ALL — `documents` incluida. Con la 0097 sola, este
-- archivo afirmaba en verde que un borrado no se ve, cuando en prod sí se ve.
-- Un contrato que mide una migración aislada mide historia, no producción.
--
-- Se aplican las DOS migraciones que cambian lo que este archivo contrata:
--   0230 → abre la lectura y la restauración de los borrados (deliberado).
--   0394 → cierra el borrado FÍSICO por `authenticated` (contrato 10).
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0394_documents_sin_borrado_duro.sql

-- ⚠️ La RLS de `storage.objects` la trae Supabase de fábrica, no esta
-- migración. Sin encenderla acá, las policies del contrato 7 existirían sin
-- gobernar nada y el contrato pasaría siempre.
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otra-empresa');

\set u1 'aa111111-1111-1111-1111-111111111111'
\set u2 'aa222222-2222-2222-2222-222222222222'
insert into auth.users (id, email) values (:'u1', 'log@dtd.test'), (:'u2', 'log@otra.test');
insert into public.user_tenants (user_id, tenant_id, role) values
  (:'u1', :'t1', 'admin'), (:'u2', :'t2', 'admin');

\set emb1     'c1111111-1111-1111-1111-111111111111'
\set emb_baja 'c1999999-1111-1111-1111-111111111111'
\set emb2     'c2222222-2222-2222-2222-222222222222'
insert into public.shipments (id, tenant_id, deleted_at) values
  (:'emb1',     :'t1', null),
  (:'emb_baja', :'t1', now()),
  (:'emb2',     :'t2', null);

\set fac1 'e1111111-1111-1111-1111-111111111111'
insert into public.invoices (id, tenant_id) values (:'fac1', :'t1');

-- Intenta guardar un documento y devuelve cuántos quedaron con ese id. Se mira
-- el ESTADO, no el texto del error: da igual si el guard rechaza con excepción
-- o de otra forma — lo que se afirma es si la fila existe.
create or replace function pg_temp.guardar(
  p_id uuid, p_tenant uuid, p_type document_entity_type, p_entity uuid, p_path text
) returns int language plpgsql as $g$
declare v_n int;
begin
  begin
    insert into public.documents (id, tenant_id, entity_type, entity_id, folder, name, storage_path)
    values (p_id, p_tenant, p_type, p_entity, 'log-bl', 'documento', p_path);
  exception when others then
    null;
  end;
  select count(*) into v_n from public.documents where id = p_id;
  return v_n;
end;
$g$;

-- ── 1 · 🔴 Las tres formas de forjar un `entity_id` ───────────────────────
--
-- No hay FK. Este trigger es todo lo que separa un adjunto legítimo de uno
-- colgado del expediente de otra empresa.
do $$
declare v_n int;
begin
  -- (a) la entidad no existe
  v_n := pg_temp.guardar('d0000001-0000-0000-0000-000000000001',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         'deadbeef-0000-0000-0000-000000000000', 'p/inexistente.pdf');
  if v_n > 0 then
    raise exception 'CONTRATO 1 ROTO: se adjunto un documento a un embarque que NO EXISTE';
  end if;

  -- (b) la entidad es de OTRA empresa
  v_n := pg_temp.guardar('d0000002-0000-0000-0000-000000000002',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         'c2222222-2222-2222-2222-222222222222', 'p/ajena.pdf');
  if v_n > 0 then
    raise exception
      'CONTRATO 1 ROTO: se colgo un documento del embarque de OTRA empresa';
  end if;

  -- (c) 🔴 el id existe, es del tenant, pero es de OTRO TIPO: el uuid de una
  --     factura declarado como embarque. Es la que un `exists` que sólo mire
  --     el tenant deja pasar.
  v_n := pg_temp.guardar('d0000003-0000-0000-0000-000000000003',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         'e1111111-1111-1111-1111-111111111111', 'p/otro-tipo.pdf');
  if v_n > 0 then
    raise exception
      'CONTRATO 1 ROTO: el id de una FACTURA se acepto como si fuera un embarque';
  end if;

  -- (d) y el caso legítimo entra: un guard que rechaza todo no es un guard.
  v_n := pg_temp.guardar('d0000004-0000-0000-0000-000000000004',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         'c1111111-1111-1111-1111-111111111111', 'p/legitimo.pdf');
  if v_n <> 1 then
    raise exception 'CONTRATO 1 ROTO: no se pudo adjuntar un documento legitimo';
  end if;

  -- (e) y `none` no necesita entidad: son plantillas e internos.
  v_n := pg_temp.guardar('d0000005-0000-0000-0000-000000000005',
                         '11111111-1111-1111-1111-111111111111', 'none',
                         null, 'p/plantilla.pdf');
  if v_n <> 1 then
    raise exception 'CONTRATO 1 ROTO: un documento sin transaccion («none») no entro';
  end if;
end;
$$;

-- ── 2 · 🔴 El guard cubre el UPDATE, no sólo el INSERT ────────────────────
--
-- Sin esto, se sube el documento contra la entidad propia —que pasa— y después
-- se lo mueve con un UPDATE al expediente de otra empresa.
do $$
declare v_ent uuid;
begin
  begin
    update public.documents
       set entity_id = 'c2222222-2222-2222-2222-222222222222'
     where id = 'd0000004-0000-0000-0000-000000000004';
  exception when others then
    null;
  end;

  select entity_id into v_ent from public.documents
   where id = 'd0000004-0000-0000-0000-000000000004';
  if v_ent <> 'c1111111-1111-1111-1111-111111111111'::uuid then
    raise exception
      'CONTRATO 2 ROTO: un documento legitimo se MOVIO al expediente de otra empresa (quedo en %)', v_ent;
  end if;

  -- Y tampoco cambiando el tipo para que apunte a otra tabla.
  begin
    update public.documents
       set entity_type = 'invoice'
     where id = 'd0000004-0000-0000-0000-000000000004';
  exception when others then
    null;
  end;
  if (select entity_type from public.documents
       where id = 'd0000004-0000-0000-0000-000000000004') <> 'shipment' then
    raise exception
      'CONTRATO 2 ROTO: se cambio el TIPO de un documento a una tabla donde ese id no existe';
  end if;
end;
$$;

-- ── 3 · 🔴 La rama `else` es fail-closed ──────────────────────────────────
--
-- El CASE cubre los nueve tipos de hoy. El riesgo no es hoy: es el día que
-- alguien agregue un tipo adjuntable al enum y olvide su rama. Acá se agrega
-- uno a propósito, sin tocar el CASE, y la base tiene que RECHAZAR.
do $$
declare v_ok boolean;
begin
  alter type document_entity_type add value 'purchase_order';

  -- El valor nuevo no se puede usar en la misma sentencia que lo creó, así que
  -- se resuelve por texto en tiempo de ejecución.
  execute format(
    'select public.document_entity_in_tenant(%L::document_entity_type, %L::uuid, %L::uuid)',
    'purchase_order',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111')
  into v_ok;

  if v_ok then
    raise exception
      'CONTRATO 3 ROTO: un tipo adjuntable SIN rama en el CASE se acepto a ciegas — el fail-closed se cayo';
  end if;
end;
$$;

-- ── 4 · 🔴 El CHECK tapa el hueco del helper ──────────────────────────────
--
-- El helper devuelve `true` en cuanto `entity_id` es null: no valida, se
-- aparta. Lo que impide un documento declarado `shipment` SIN embarque es el
-- CHECK de coherencia. Las dos piezas se necesitan — y por eso se prueban
-- juntas.
do $$
declare v_ok boolean; v_n int;
begin
  -- (a) el helper, solo, dice que sí
  v_ok := public.document_entity_in_tenant('shipment', null,
                                           '11111111-1111-1111-1111-111111111111');
  if not v_ok then
    raise exception
      'CONTRATO 4 ROTO: cambio el comportamiento del helper con entity_id null (ahora dice %) — revisar si el CHECK sigue siendo necesario', v_ok;
  end if;

  -- (b) y sin embargo la fila no entra
  v_n := pg_temp.guardar('d0000006-0000-0000-0000-000000000006',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         null, 'p/sin-entidad.pdf');
  if v_n > 0 then
    raise exception
      'CONTRATO 4 ROTO: se guardo un documento de tipo «shipment» SIN embarque — cuelga de nada';
  end if;

  -- (c) el simétrico: «none» con un id pegado
  v_n := pg_temp.guardar('d0000007-0000-0000-0000-000000000007',
                         '11111111-1111-1111-1111-111111111111', 'none',
                         'c1111111-1111-1111-1111-111111111111', 'p/none-con-id.pdf');
  if v_n > 0 then
    raise exception
      'CONTRATO 4 ROTO: un documento «sin transaccion» quedo con un entity_id pegado';
  end if;
end;
$$;

-- ── 5 · 🔴 Una entidad dada de baja no admite adjuntos nuevos ─────────────
do $$
declare v_n int;
begin
  v_n := pg_temp.guardar('d0000008-0000-0000-0000-000000000008',
                         '11111111-1111-1111-1111-111111111111', 'shipment',
                         'c1999999-1111-1111-1111-111111111111', 'p/de-baja.pdf');
  if v_n > 0 then
    raise exception
      'CONTRATO 5 ROTO: se adjunto un documento a un embarque DADO DE BAJA';
  end if;
end;
$$;

-- ── 6 · 🔴 RLS por empresa · y los borrados SÍ se ven (0230) ──────────────
--
-- Lo que aísla es el tenant, nada más. La 0230 le quitó `and deleted_at is null`
-- al `using` a propósito: con esa condición adentro, el propio soft-delete era
-- imposible —Postgres exige que la fila que sale de un UPDATE siga cumpliendo el
-- USING, y ponerle `deleted_at` la sacaba—. Ocultar los borrados quedó del lado
-- de la app (`.is("deleted_at", null)` en cada query de lib/studio/*-queries.ts).
--
-- Se fija en las DOS direcciones para que el arreglo de ida y el de vuelta no se
-- pisen: si alguien devuelve el `deleted_at is null` al `using` creyendo que
-- corrige un descuido, rompe el soft-delete otra vez y este contrato lo dice.
do $$
declare v_ajenos int; v_propios int; v_borrado int; v_marcadas int; v_restauradas int;
begin
  -- Un documento de la otra empresa y uno propio ya borrado.
  insert into public.documents (id, tenant_id, entity_type, entity_id, folder, name, storage_path)
  values ('d0000009-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222',
          'shipment', 'c2222222-2222-2222-2222-222222222222', 'log-bl', 'de la otra',
          '22222222-2222-2222-2222-222222222222/shipment/x/otra.pdf');
  insert into public.documents (id, tenant_id, entity_type, entity_id, folder, name, storage_path, deleted_at)
  values ('d0000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111',
          'shipment', 'c1111111-1111-1111-1111-111111111111', 'log-bl', 'borrado',
          '11111111-1111-1111-1111-111111111111/shipment/x/borrado.pdf', now());

  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);

  select count(*) into v_ajenos from public.documents
   where tenant_id <> '11111111-1111-1111-1111-111111111111';
  select count(*) into v_propios from public.documents;
  select count(*) into v_borrado from public.documents
   where id = 'd0000010-0000-0000-0000-000000000010';

  -- 🔴 El soft-delete tiene que PODER marcarse. Es lo que la 0230 vino a
  -- arreglar: con `deleted_at is null` en el USING, este UPDATE fallaba con
  -- «new row violates row-level security policy» para cualquier usuario.
  -- Se capturan los dos: sin esto el rojo sale como un «new row violates
  -- row-level security policy» pelado y quien lo lea no sabe qué rompió.
  v_marcadas := 0;
  begin
    update public.documents set deleted_at = now()
     where id = 'd0000004-0000-0000-0000-000000000004';
    get diagnostics v_marcadas = row_count;
  exception when others then
    null;
  end;

  -- Y tiene que poder deshacerse: la fila marcada sigue al alcance del equipo.
  v_restauradas := 0;
  begin
    update public.documents set deleted_at = null
     where id = 'd0000004-0000-0000-0000-000000000004';
    get diagnostics v_restauradas = row_count;
  exception when others then
    null;
  end;
  reset role;

  if v_ajenos > 0 then
    raise exception
      'CONTRATO 6 ROTO: se ven % documento(s) de OTRA empresa', v_ajenos;
  end if;
  if v_borrado = 0 then
    raise exception
      'CONTRATO 6 ROTO: la RLS volvio a ocultar los borrados. Alguien le devolvio el '
      '«deleted_at is null» al USING que la 0230 quito — y con eso el soft-delete '
      'vuelve a ser IMPOSIBLE para todos (ver el UPDATE de mas abajo)';
  end if;
  if v_propios = 0 then
    raise exception 'CONTRATO 6 ROTO: la empresa no ve ninguno de sus propios documentos';
  end if;
  if v_marcadas <> 1 then
    raise exception
      'CONTRATO 6 ROTO: el SOFT-DELETE no se puede marcar (% filas) — es el bug que la 0230 arreglo, de vuelta', v_marcadas;
  end if;
  if v_restauradas <> 1 then
    raise exception
      'CONTRATO 6 ROTO: un documento marcado como borrado ya no se puede RESTAURAR (% filas)', v_restauradas;
  end if;

  if has_table_privilege('anon', 'public.documents', 'select') then
    raise exception 'CONTRATO 6 ROTO: anon lee los documentos del ERP';
  end if;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 7 · 🔴 El Storage está acotado en las TRES operaciones ────────────────
--
-- Subir, leer y borrar. Una sola de las tres abierta ya alcanza: si el borrado
-- no filtra, una empresa destruye los papeles de la otra.
do $$
declare v_n int;
begin
  insert into storage.objects (bucket_id, name) values
    ('documents', '11111111-1111-1111-1111-111111111111/shipment/x/propio.pdf'),
    ('documents', '22222222-2222-2222-2222-222222222222/shipment/x/ajeno.pdf');

  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);

  -- (a) leer
  select count(*) into v_n from storage.objects
   where bucket_id = 'documents'
     and name like '22222222-2222-2222-2222-222222222222/%';
  if v_n > 0 then
    raise exception 'CONTRATO 7 ROTO: se ven % archivo(s) de OTRA empresa en el bucket', v_n;
  end if;

  -- (b) subir con el path de otra empresa
  begin
    insert into storage.objects (bucket_id, name)
    values ('documents', '22222222-2222-2222-2222-222222222222/shipment/x/intruso.pdf');
  exception when others then null;
  end;

  -- (c) borrar el de otra empresa
  begin
    delete from storage.objects
     where name = '22222222-2222-2222-2222-222222222222/shipment/x/ajeno.pdf';
  exception when others then null;
  end;

  reset role;

  if exists (select 1 from storage.objects
              where name = '22222222-2222-2222-2222-222222222222/shipment/x/intruso.pdf') then
    raise exception
      'CONTRATO 7 ROTO: se subio un archivo a la carpeta de OTRA empresa';
  end if;
  if not exists (select 1 from storage.objects
                  where name = '22222222-2222-2222-2222-222222222222/shipment/x/ajeno.pdf') then
    raise exception
      'CONTRATO 7 ROTO: se BORRO el archivo de otra empresa — sus papeles desaparecen';
  end if;

  -- ⚠️ (d) Y una afirmación estructural sobre las TRES, porque la de arriba no
  -- aísla el borrado. Lo descubrió la mutación: con la policy de DELETE abierta
  -- de par en par, el archivo ajeno SOBREVIVE igual — un `delete … where name =
  -- …` referencia una columna, así que Postgres aplica también las policies de
  -- SELECT, y la fila ajena es invisible antes de poder borrarse. Es defensa en
  -- profundidad real, pero significa que el escenario de arriba mide la policy
  -- de lectura. Acá se mira cada una por su lado.
  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'documents tenant %'
         and coalesce(qual, '') || coalesce(with_check, '') like '%foldername%') <> 3 then
    raise exception
      'CONTRATO 7 ROTO: alguna de las 3 policies del bucket (subir/leer/borrar) perdio el scope por path';
  end if;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 8 · 🔴 El bucket es privado y no acepta cualquier cosa ────────────────
do $$
declare b record;
begin
  select * into b from storage.buckets where id = 'documents';
  if b is null then
    raise exception 'CONTRATO 8 ROTO: el bucket documents no existe';
  end if;
  if b.public then
    raise exception
      'CONTRATO 8 ROTO: el bucket de documentos quedo PUBLICO — los papeles del ERP se leen sin login';
  end if;
  if b.file_size_limit is distinct from 10 * 1024 * 1024 then
    raise exception 'CONTRATO 8 ROTO: el limite de tamano es % (esperado 10 MB)', b.file_size_limit;
  end if;
  if 'text/html' = any(b.allowed_mime_types) then
    raise exception
      'CONTRATO 8 ROTO: el bucket acepta text/html — un HTML servido desde el dominio propio es XSS con sesion';
  end if;
  if not ('application/pdf' = any(b.allowed_mime_types)) then
    raise exception 'CONTRATO 8 ROTO: el bucket dejo de aceptar PDF';
  end if;
end;
$$;

-- ── 9 · El mismo objeto no se indexa dos veces ────────────────────────────
--
-- Dos filas apuntando al mismo archivo: borrar una deja a la otra mostrando un
-- documento que ya no está.
do $$
begin
  begin
    insert into public.documents (tenant_id, entity_type, entity_id, folder, name, storage_path)
    values ('11111111-1111-1111-1111-111111111111', 'shipment',
            'c1111111-1111-1111-1111-111111111111', 'log-bl', 'duplicado', 'p/legitimo.pdf');
    raise exception 'CONTRATO 9 ROTO: el mismo archivo del bucket se indexo dos veces';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- ── 10 · 🔴 El borrado suave es un CANDADO, no una convención ─────────────
--
-- La 0097 escribió «soft delete (auditable)» en el comentario de la columna y
-- acto seguido le dio `delete` al rol del equipo. Medido antes de la 0394: la
-- fila desaparecía de verdad, sin error, y con ella el rastro — ni siquiera
-- `legal_hold = true` la protegía, y `entity_audit_log` quedaba sin un solo
-- evento de esa entidad. Es el MISMO hueco que la 0097 dice defender con su
-- trigger («la server action valida, PERO un cliente Supabase directo la
-- saltaría»), dejado abierto justo en el borrado.
--
-- Se mira el ESTADO, no el texto del error: da igual con qué código falle, lo
-- que se afirma es que la fila sigue ahí.
do $$
declare v_vive int; v_service int;
begin
  insert into public.documents (id, tenant_id, entity_type, entity_id, folder, name, storage_path)
  values ('d0000011-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111',
          'shipment', 'c1111111-1111-1111-1111-111111111111', 'log-bl', 'no me borres',
          '11111111-1111-1111-1111-111111111111/shipment/x/candado.pdf');

  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  begin
    delete from public.documents where id = 'd0000011-0000-0000-0000-000000000011';
  exception when others then
    null;
  end;
  reset role;

  select count(*) into v_vive from public.documents
   where id = 'd0000011-0000-0000-0000-000000000011';
  if v_vive <> 1 then
    raise exception
      'CONTRATO 10 ROTO: «authenticated» DESTRUYO la fila. El soft delete volvio a '
      'ser una convencion de la server action — y quien la saltee por PostgREST se '
      'lleva el documento, su motivo, su autor y su auditoria';
  end if;

  -- Y el privilegio no está sólo dormido: no está.
  if has_table_privilege('authenticated', 'public.documents', 'delete') then
    raise exception
      'CONTRATO 10 ROTO: «authenticated» tiene otra vez el privilegio DELETE sobre documents';
  end if;
  if has_table_privilege('authenticated', 'public.documents', 'truncate') then
    raise exception
      'CONTRATO 10 ROTO: «authenticated» puede TRUNCATE — la puerta de al lado, y se lleva la tabla entera';
  end if;

  -- 🔴 Pero el borrado FÍSICO legítimo tiene que seguir existiendo: el worker de
  -- retención de SDD-0224 purga con service_role. Un candado que también traba a
  -- quien sí debe borrar no es un candado, es un daño.
  set local role service_role;
  begin
    delete from public.documents where id = 'd0000011-0000-0000-0000-000000000011';
  exception when others then
    null;  -- el ESTADO decide, no el error: se mira abajo si la fila se fue
  end;
  reset role;

  select count(*) into v_service from public.documents
   where id = 'd0000011-0000-0000-0000-000000000011';
  if v_service <> 0 then
    raise exception
      'CONTRATO 10 ROTO: service_role ya no puede borrar fisicamente — el worker de retencion queda sin brazo';
  end if;
end;
$$;

rollback;
