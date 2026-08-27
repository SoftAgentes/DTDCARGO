\set ON_ERROR_STOP on

-- Contrato de las fotos de recepción CN (SDD-0028 · migr 0022 + 0183).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Son las fotos que el operario le toma a la mercancía cuando entra a la
-- bodega de Yiwu. Es la ÚNICA prueba de qué llegó y en qué estado — cuando el
-- cliente reclama que faltaba una caja o que venía golpeada, lo que se mira es
-- esto. Y son fotos de la carga de un cliente: quién las ve importa tanto como
-- quién las borra.
--
-- Por eso esta pareja de migraciones es de las que hacen daño en silencio. El
-- bucket es privado y la lectura va acotada por tenant desde el PATH; las dos
-- RPC son `security definer` y reciben el `p_operario_id` como PARÁMETRO — el
-- que las pueda llamar se hace pasar por cualquier operario, y una de ellas
-- BORRA. Nada de eso grita si se cae: la pantalla sigue mostrando fotos.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 El bucket es PRIVADO. Público, cualquiera con la URL ve la carga de
--      un cliente sin pasar por un login.
--   2. 🔴 La lectura de Storage está acotada al tenant por el primer segmento
--      del path. Sin eso, una empresa ve las fotos de la carga de la otra.
--   3. 🔴 Un operario no cuelga una foto en el expediente de OTRA empresa.
--   4. 🔴 Al operario inactivo se le cerró el PIN por algo: ni linkea ni
--      desvincula.
--   5. 🔴 **`unlink_receipt_photo` no borra la foto de otra empresa.** Ésta es
--      la que destruye evidencia: si el filtro de tenant se cae, un operario
--      borra la prueba de un reclamo ajeno y no queda rastro.
--   6. 🔴 Ni `anon` ni `authenticated` pueden EJECUTAR las RPC. La 0183 las
--      re-declara con un `revoke` más corto que el de la 0022 (omite
--      `authenticated`) — se verifica que el estado final siga cerrado.
--   7. 🔴 En la tabla índice, `authenticated` sólo LEE lo suyo: sin insert,
--      sin delete, y `anon` sin nada.
--   8. 🔴 (0183) El reintento offline no duplica la foto. La cola reintenta
--      cuando se pierde la RESPUESTA, no la subida.
--   9. 🔴 (0183) Y ese reintento devuelve el id EXISTENTE, no null. Con null,
--      el cliente lo lee como fallo y reintenta para siempre.
--  10. Dos recepciones distintas SÍ pueden tener foto en la misma posición: el
--      índice es por recepción, no global.
--
-- ⚠️ Hallazgo que queda anotado y NO se puede contratar acá: el
-- `on conflict (id) do update` del bucket reajusta el tamaño y los mime types,
-- pero **no toca `public`**. Si alguien abre el bucket a mano desde el panel,
-- re-correr la migración no lo vuelve a cerrar. El contrato 1 sólo puede
-- probar que una aplicación limpia lo crea privado.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id   uuid,
  tenant_id uuid,
  role      text
);

create table public.operario_pins (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  region    text,
  active    boolean not null default true
);

create table public.warehouse_receipts_cn (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  client_markbox text,
  deleted_at     timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

\ir ../migrations/0022_receipt_photos.sql
\ir ../migrations/0183_receipt_photo_idempotent_link.sql

-- ⚠️ La RLS de `storage.objects` la trae Supabase de fábrica, no esta
-- migración. Sin encenderla acá, las policies del contrato 2 existirían sin
-- gobernar nada y el contrato pasaría siempre.
alter table storage.objects enable row level security;
grant select on storage.objects to authenticated;

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otra-empresa');

\set u1 'aa111111-1111-1111-1111-111111111111'
\set u2 'aa222222-2222-2222-2222-222222222222'
insert into auth.users (id, email) values
  (:'u1', 'bodega@dtd.test'),
  (:'u2', 'bodega@otra.test');
insert into public.user_tenants (user_id, tenant_id, role) values
  (:'u1', :'t1', 'admin'),
  (:'u2', :'t2', 'admin');

\set op1        'b1111111-1111-1111-1111-111111111111'
\set op_baja    'b2111111-1111-1111-1111-111111111111'
\set op_ajeno   'b3222222-2222-2222-2222-222222222222'
insert into public.operario_pins (id, tenant_id, region, active) values
  (:'op1',      :'t1', 'cn', true),
  (:'op_baja',  :'t1', 'cn', false),
  (:'op_ajeno', :'t2', 'cn', true);

\set r1     'c1111111-1111-1111-1111-111111111111'
\set r1_bis 'c1222222-1111-1111-1111-111111111111'
\set r2     'c2222222-2222-2222-2222-222222222222'
insert into public.warehouse_receipts_cn (id, tenant_id, client_markbox) values
  (:'r1',     :'t1', 'DTD-1000'),
  (:'r1_bis', :'t1', 'DTD-1001'),
  (:'r2',     :'t2', 'DTD-9000');

-- Dos objetos ya subidos al bucket, uno por empresa, con el path real
-- {tenant_id}/{receipt_id}/{position}-{uuid}.jpg
insert into storage.objects (bucket_id, name) values
  ('receipt-photos', :'t1' || '/' || :'r1' || '/0-aaaaaaaa.jpg'),
  ('receipt-photos', :'t2' || '/' || :'r2' || '/0-bbbbbbbb.jpg');

-- ── 1 · 🔴 El bucket es privado ───────────────────────────────────────────
--
-- Público, el object de Storage se sirve por URL directa sin sesión: las fotos
-- de la carga de un cliente quedan al alcance de cualquiera que adivine —
-- o reciba — el link.
do $$
declare b record;
begin
  select * into b from storage.buckets where id = 'receipt-photos';
  if b is null then
    raise exception 'CONTRATO 1 ROTO: el bucket receipt-photos no existe';
  end if;
  if b.public then
    raise exception
      'CONTRATO 1 ROTO: el bucket de fotos quedo PUBLICO — la carga de un cliente se ve sin login';
  end if;
  if b.file_size_limit is distinct from 8 * 1024 * 1024 then
    raise exception 'CONTRATO 1 ROTO: el limite de tamano es % (esperado 8 MB)', b.file_size_limit;
  end if;
  if not ('image/jpeg' = any(b.allowed_mime_types)) then
    raise exception 'CONTRATO 1 ROTO: el bucket ya no acepta image/jpeg';
  end if;
  if 'application/pdf' = any(b.allowed_mime_types) then
    raise exception
      'CONTRATO 1 ROTO: el bucket de FOTOS acepta % — deja de ser solo imagenes',
      b.allowed_mime_types;
  end if;
end;
$$;

-- ── 2 · 🔴 La lectura de Storage está acotada al tenant ───────────────────
--
-- La policy compara el PRIMER segmento del path contra el tenant del que lee.
-- Es lo único que separa las fotos de una empresa de las de la otra: acá no
-- hay tabla con `tenant_id`, hay un string.
do $$
declare v_ajenos int; v_propios int;
begin
  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);

  select count(*) into v_ajenos from storage.objects
   where bucket_id = 'receipt-photos'
     and name like '22222222-2222-2222-2222-222222222222/%';
  if v_ajenos > 0 then
    raise exception
      'CONTRATO 2 ROTO: se ven % foto(s) de OTRA empresa en el bucket', v_ajenos;
  end if;

  -- Y sí ve las suyas: una policy que no deja ver nada tampoco sirve.
  select count(*) into v_propios from storage.objects where bucket_id = 'receipt-photos';
  if v_propios <> 1 then
    raise exception
      'CONTRATO 2 ROTO: la empresa ve % de sus propias fotos (esperaba 1)', v_propios;
  end if;

  reset role;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 3 · 🔴 Nadie cuelga una foto en el expediente de otra empresa ─────────
do $$
declare v_id uuid; v_n int;
begin
  begin
    v_id := public.link_receipt_photo(
      'b1111111-1111-1111-1111-111111111111',            -- operario del tenant 1
      'c2222222-2222-2222-2222-222222222222',            -- recepción del tenant 2
      '22222222-2222-2222-2222-222222222222/intrusa.jpg', 0, 1000, 'image/jpeg');
  exception when others then
    v_id := null;
  end;

  -- Se mira el ESTADO, no el mensaje: lo que importa es que la fila no exista.
  select count(*) into v_n from public.warehouse_receipt_photos
   where receipt_id = 'c2222222-2222-2222-2222-222222222222';
  if v_n > 0 then
    raise exception
      'CONTRATO 3 ROTO: un operario colgo una foto en el expediente de OTRA empresa';
  end if;
  if v_id is not null then
    raise exception 'CONTRATO 3 ROTO: el link cross-tenant devolvio un id (%)', v_id;
  end if;
end;
$$;

-- ── 4 · 🔴 Al operario inactivo se le cerró el PIN por algo ───────────────
do $$
declare v_id uuid; v_path text; v_n int;
begin
  -- (a) no linkea
  begin
    v_id := public.link_receipt_photo(
      'b2111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111/de-baja.jpg', 7, 1000, 'image/jpeg');
  exception when others then
    v_id := null;
  end;
  select count(*) into v_n from public.warehouse_receipt_photos where position = 7;
  if v_n > 0 or v_id is not null then
    raise exception 'CONTRATO 4 ROTO: un operario INACTIVO indexo una foto';
  end if;

  -- (b) y tampoco desvincula. Se le arma una foto propia para que lo único
  --     que pueda frenarlo sea su estado.
  insert into public.warehouse_receipt_photos (id, tenant_id, receipt_id, storage_path, position)
  values ('d0000000-0000-0000-0000-000000000009',
          '11111111-1111-1111-1111-111111111111',
          'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111/blindada.jpg', 9);

  begin
    v_path := public.unlink_receipt_photo(
      'b2111111-1111-1111-1111-111111111111',
      'd0000000-0000-0000-0000-000000000009');
  exception when others then
    v_path := null;
  end;

  select count(*) into v_n from public.warehouse_receipt_photos
   where id = 'd0000000-0000-0000-0000-000000000009';
  if v_n = 0 then
    raise exception 'CONTRATO 4 ROTO: un operario INACTIVO borro una foto';
  end if;

  delete from public.warehouse_receipt_photos
   where id = 'd0000000-0000-0000-0000-000000000009';
end;
$$;

-- ── 5 · 🔴 Nadie borra la foto de otra empresa ────────────────────────────
--
-- La que destruye evidencia. `unlink` borra por id filtrando por el tenant del
-- operario; si ese filtro se cae, un operario borra la prueba de un reclamo
-- ajeno y la RPC ni siquiera falla — devuelve el path y sigue.
do $$
declare v_path text; v_mia uuid; v_ajena uuid; v_n int;
begin
  v_mia := public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/mia.jpg', 3, 2048, 'image/jpeg');
  v_ajena := public.link_receipt_photo(
    'b3222222-2222-2222-2222-222222222222',
    'c2222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222/ajena.jpg', 3, 2048, 'image/jpeg');

  if v_mia is null or v_ajena is null then
    raise exception 'CONTRATO 5 ROTO: el fixture no se armo (mia=% ajena=%)', v_mia, v_ajena;
  end if;

  -- El operario del tenant 1 intenta borrar la del tenant 2.
  begin
    v_path := public.unlink_receipt_photo('b1111111-1111-1111-1111-111111111111', v_ajena);
  exception when others then
    v_path := null;
  end;

  select count(*) into v_n from public.warehouse_receipt_photos where id = v_ajena;
  if v_n = 0 then
    raise exception
      'CONTRATO 5 ROTO: un operario BORRO la foto de otra empresa — evidencia de un reclamo ajeno';
  end if;
  if v_path is not null then
    raise exception
      'CONTRATO 5 ROTO: el unlink cross-tenant devolvio el path «%» — el server action borra el object del bucket',
      v_path;
  end if;

  -- Y sí borra la suya: un guard que prohíbe todo no prueba nada.
  v_path := public.unlink_receipt_photo('b1111111-1111-1111-1111-111111111111', v_mia);
  if v_path is distinct from '11111111-1111-1111-1111-111111111111/mia.jpg' then
    raise exception
      'CONTRATO 5 ROTO: el operario no pudo desvincular su PROPIA foto (path=%)', v_path;
  end if;
  if exists (select 1 from public.warehouse_receipt_photos where id = v_mia) then
    raise exception 'CONTRATO 5 ROTO: la foto propia quedo indexada despues del unlink';
  end if;

  delete from public.warehouse_receipt_photos where id = v_ajena;
end;
$$;

-- ── 6 · 🔴 Las RPC son sólo de service_role ───────────────────────────────
--
-- Las dos son `security definer` y reciben el `p_operario_id` como PARÁMETRO:
-- no lo derivan de la sesión. Quien las pueda ejecutar elige de qué operario
-- hacerse pasar — y `unlink` además borra. La 0183 re-declara el `revoke` sin
-- nombrar a `authenticated`; se verifica el estado FINAL, no la intención.
do $$
declare
  v_link   text := 'public.link_receipt_photo(uuid, uuid, text, int, bigint, text)';
  v_unlink text := 'public.unlink_receipt_photo(uuid, uuid)';
  v_rol    text;
  v_fn     text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_fn in array array[v_link, v_unlink] loop
      if has_function_privilege(v_rol, v_fn, 'execute') then
        raise exception
          'CONTRATO 6 ROTO: «%» puede ejecutar % — se hace pasar por cualquier operario',
          v_rol, v_fn;
      end if;
    end loop;
  end loop;

  -- Y el server action sí puede: si nadie pudiera, no habría producto.
  if not has_function_privilege('service_role', v_link, 'execute')
     or not has_function_privilege('service_role', v_unlink, 'execute') then
    raise exception 'CONTRATO 6 ROTO: service_role perdio el execute de las RPC de fotos';
  end if;
end;
$$;

-- ── 7 · 🔴 La tabla índice: se lee lo propio, no se escribe ───────────────
do $$
declare v_ajenas int; v_propias int;
begin
  if has_table_privilege('authenticated', 'public.warehouse_receipt_photos', 'insert')
     or has_table_privilege('authenticated', 'public.warehouse_receipt_photos', 'delete')
     or has_table_privilege('authenticated', 'public.warehouse_receipt_photos', 'update') then
    raise exception
      'CONTRATO 7 ROTO: authenticated puede ESCRIBIR el indice de fotos por PostgREST';
  end if;
  if has_table_privilege('anon', 'public.warehouse_receipt_photos', 'select') then
    raise exception 'CONTRATO 7 ROTO: anon lee el indice de fotos';
  end if;

  insert into public.warehouse_receipt_photos (tenant_id, receipt_id, storage_path, position) values
    ('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
     '11111111-1111-1111-1111-111111111111/lectura-1.jpg', 20),
    ('22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222',
     '22222222-2222-2222-2222-222222222222/lectura-2.jpg', 20);

  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);

  select count(*) into v_ajenas from public.warehouse_receipt_photos
   where tenant_id <> '11111111-1111-1111-1111-111111111111';
  select count(*) into v_propias from public.warehouse_receipt_photos;
  reset role;

  if v_ajenas > 0 then
    raise exception
      'CONTRATO 7 ROTO: se ven % fila(s) de fotos de OTRA empresa', v_ajenas;
  end if;
  if v_propias = 0 then
    raise exception 'CONTRATO 7 ROTO: la empresa no ve ninguna de sus propias fotos';
  end if;

  delete from public.warehouse_receipt_photos where position = 20;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 8 · 🔴 (0183) El reintento offline no duplica la foto ─────────────────
--
-- La cola reintenta cuando se pierde la RESPUESTA, no la subida: el server ya
-- insertó y el teléfono no se enteró. Sin el único (receipt_id, position) el
-- retry crea una segunda fila y la foto sale repetida en el detalle.
do $$
declare v_a uuid; v_b uuid; v_n int;
begin
  v_a := public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/retry-a.jpg', 1, 4096, 'image/jpeg');

  -- El reintento sube un objeto NUEVO (otro uuid en el path) a la MISMA
  -- posición: es el mismo hecho contado dos veces.
  v_b := public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/retry-b.jpg', 1, 4096, 'image/jpeg');

  select count(*) into v_n from public.warehouse_receipt_photos
   where receipt_id = 'c1111111-1111-1111-1111-111111111111' and position = 1;
  if v_n <> 1 then
    raise exception
      'CONTRATO 8 ROTO: el reintento offline dejo % filas en la posicion 1 — foto repetida', v_n;
  end if;

  -- (b) Y el mismo objeto no se indexa dos veces: dos filas apuntando al
  --     mismo path harían que borrar una deje a la otra colgando.
  begin
    insert into public.warehouse_receipt_photos (tenant_id, receipt_id, storage_path, position)
    values ('11111111-1111-1111-1111-111111111111',
            'c1222222-1111-1111-1111-111111111111',
            '11111111-1111-1111-1111-111111111111/retry-a.jpg', 5);
    raise exception 'CONTRATO 8 ROTO: el mismo object del bucket se indexo dos veces';
  exception when unique_violation then
    null;
  end;

  delete from public.warehouse_receipt_photos where id = v_a;
end;
$$;

-- ── 9 · 🔴 (0183) Y el reintento devuelve el id EXISTENTE ─────────────────
--
-- `on conflict do nothing` hace que el `returning` no devuelva NADA. Sin el
-- bloque que recupera el id, la RPC responde null, el server action lo lee
-- como fallo y la cola reintenta esa foto para siempre.
do $$
declare v_a uuid; v_b uuid;
begin
  v_a := public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/idem-a.jpg', 2, 4096, 'image/jpeg');
  v_b := public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/idem-b.jpg', 2, 4096, 'image/jpeg');

  if v_b is null then
    raise exception
      'CONTRATO 9 ROTO: el reintento devolvio NULL — el telefono lo lee como fallo y reintenta sin fin';
  end if;
  if v_b <> v_a then
    raise exception
      'CONTRATO 9 ROTO: el reintento devolvio otro id (% <> %) — no es idempotente', v_b, v_a;
  end if;

  delete from public.warehouse_receipt_photos where id = v_a;
end;
$$;

-- ── 10 · Dos recepciones distintas comparten la posición 0 ────────────────
--
-- El único es por RECEPCIÓN. Si fuera por tenant, la segunda recepción del día
-- no podría tener su primera foto.
do $$
declare v_n int;
begin
  perform public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/rec1-pos0.jpg', 0, 4096, 'image/jpeg');
  perform public.link_receipt_photo(
    'b1111111-1111-1111-1111-111111111111',
    'c1222222-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111/rec2-pos0.jpg', 0, 4096, 'image/jpeg');

  select count(*) into v_n from public.warehouse_receipt_photos
   where position = 0 and tenant_id = '11111111-1111-1111-1111-111111111111';
  if v_n <> 2 then
    raise exception
      'CONTRATO 10 ROTO: dos recepciones no pueden tener su foto 0 (quedaron % de 2)', v_n;
  end if;
end;
$$;

rollback;
