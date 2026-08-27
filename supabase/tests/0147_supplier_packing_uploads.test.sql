\set ON_ERROR_STOP on

-- Contrato del packing list que el proveedor envía online (SDD-0096 · migr 0147).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- El proveedor chino abre `/p/{token}` —anónimo, sin cuenta— y manda el packing
-- list de la mercancía: qué hay en cada caja, cuánto pesa, cuánto vale. Es el
-- papel con el que después se declara en aduana. El proveedor puede grabar tres
-- veces mientras corrige, así que la tabla es **append-only con versionado**: el
-- equipo ve la última y el historial queda entero.
--
-- Dos cosas lo pueden arruinar en silencio: que queden DOS versiones vigentes
-- (el equipo no sabe cuál declarar) y que el número de versión se repita (el
-- historial deja de ser una cadena).
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Una sola versión vigente por orden. Es un índice único PARCIAL, y la
--      RPC tiene que apagar la anterior antes de insertar: las dos piezas
--      juntas, o el segundo envío revienta.
--   2. 🔴 Append-only: enviar de nuevo NO pisa lo anterior. El historial es la
--      prueba de qué declaró el proveedor y cuándo.
--   3. 🔴 `version_no` es MONOTÓNICO y cuenta también las borradas. El `max()`
--      no filtra por `deleted_at` a propósito: si filtrara, borrar la v3 haría
--      que el próximo envío volviera a ser v3 y habría dos «versión 3»
--      distintas en la misma cadena.
--   4. 🔴 La RPC es **sólo `service_role`**. El proveedor es anónimo y su
--      capability es el token, que resuelve el route server-side. Si `anon` o
--      `authenticated` pudieran llamarla, cualquiera inyecta un packing list en
--      la orden de cualquiera.
--   5. 🔴 El proveedor NUNCA toca la tabla: no hay policy para `anon`.
--   6. Sin tenant, sin orden o sin Shipping Mark, rechaza.
--   7. El folio DTD-PL-YYYY-NNNN no se comparte entre tenants.
--   8. El adjunto declara su procedencia (`client` | `supplier` | `team`) y
--      nace en `client` para las filas que ya existían.
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

create table public.prealertas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  code       text,
  deleted_at timestamptz
);

create type prealerta_doc_type as enum ('factura', 'packing_list', 'foto');

create table public.prealerta_documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  prealerta_id uuid,
  doc_type     prealerta_doc_type not null default 'factura',
  deleted_at   timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

\ir ../migrations/0147_supplier_packing_uploads.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set p1 'ea111111-1111-1111-1111-111111111111'
\set p2 'eb222222-2222-2222-2222-222222222222'
insert into public.prealertas (id, tenant_id, code) values
  (:'p1', :'t1', 'PA-0001'),
  (:'p2', :'t1', 'PA-0002');

/*
 * Un envío del proveedor, con lo mínimo. Devuelve la fila creada.
 */
create or replace function pg_temp.enviar(p_prealerta uuid, p_nota text)
returns public.packing_list_submissions language sql as $e$
  select public.submit_packing_list(
    p_prealerta, '11111111-1111-1111-1111-111111111111', 'DTD-5000',
    'USD'::packing_list_currency, current_date,
    'Yiwu Trading Co', 'Wang', 'wang@ejemplo.test', 'wechat-id', '+86 000',
    p_nota,
    '[{"code":"A1","ctns":10}]'::jsonb,
    10, 100, 2500.00, 320.5, 1.85,
    '203.0.113.7', 'Mozilla/5.0'
  );
$e$;

create or replace function pg_temp.vigentes(p_prealerta uuid) returns int
language sql as $v$
  select count(*)::int from public.packing_list_submissions
   where prealerta_id = p_prealerta and is_current and deleted_at is null
$v$;

-- ── 1 · 🔴 Una sola versión vigente, y el 2º envío no revienta ────────────
do $$
declare v1 public.packing_list_submissions; v2 public.packing_list_submissions;
begin
  v1 := pg_temp.enviar('ea111111-1111-1111-1111-111111111111', 'primer intento');
  if v1.version_no <> 1 or not v1.is_current then
    raise exception 'CONTRATO 1 ROTO: el primer envio no quedo como v1 vigente (v%, current=%)',
      v1.version_no, v1.is_current;
  end if;

  -- El proveedor corrige y vuelve a grabar.
  v2 := pg_temp.enviar('ea111111-1111-1111-1111-111111111111', 'ya con el HS code');
  if v2.version_no <> 2 or not v2.is_current then
    raise exception 'CONTRATO 1 ROTO: el segundo envio no quedo como v2 vigente (v%)', v2.version_no;
  end if;

  if pg_temp.vigentes('ea111111-1111-1111-1111-111111111111') <> 1 then
    raise exception
      'CONTRATO 1 ROTO: hay % packing lists VIGENTES para la misma orden — el equipo no sabe cual declarar',
      pg_temp.vigentes('ea111111-1111-1111-1111-111111111111');
  end if;

  -- 🔴 Y el índice sostiene el invariante SIN la RPC. No es redundante: son dos
  -- protecciones del mismo hecho, y con la RPC intacta el comportamiento se ve
  -- bien aunque el índice esté roto. Un INSERT directo —lo que haría un cliente
  -- PostgREST que se salte la RPC— es lo único que lo pone a prueba solo.
  begin
    insert into public.packing_list_submissions
      (tenant_id, prealerta_id, client_markbox, version_no, is_current)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111', 'DTD-5000', 99, true);
  exception when others then null;
  end;

  if pg_temp.vigentes('ea111111-1111-1111-1111-111111111111') <> 1 then
    raise exception
      'CONTRATO 1 ROTO: un INSERT directo colo una segunda version vigente — el indice no la para';
  end if;
end;
$$;

-- ── 2 · 🔴 Append-only: la versión anterior sigue ahí ─────────────────────
--
-- El historial es la prueba de qué declaró el proveedor y cuándo. Si el segundo
-- envío pisara al primero, se perdería el «antes» de la corrección.
do $$
declare v_n int; v_nota text;
begin
  select count(*) into v_n from public.packing_list_submissions
   where prealerta_id = 'ea111111-1111-1111-1111-111111111111';
  if v_n <> 2 then
    raise exception 'CONTRATO 2 ROTO: la cadena tiene % filas — el envio nuevo piso al anterior', v_n;
  end if;

  select supplier_note into v_nota from public.packing_list_submissions
   where prealerta_id = 'ea111111-1111-1111-1111-111111111111' and version_no = 1;
  if v_nota is distinct from 'primer intento' then
    raise exception 'CONTRATO 2 ROTO: la v1 fue reescrita (nota = %)', v_nota;
  end if;
end;
$$;

-- ── 3 · 🔴 `version_no` cuenta también las borradas ───────────────────────
--
-- El `max(version_no)` de la RPC NO filtra por `deleted_at`, a propósito. Si
-- filtrara, borrar la v2 haría que el próximo envío volviera a ser v2 y la
-- cadena tendría dos «versión 2» distintas — el historial deja de ser cadena.
do $$
declare v3 public.packing_list_submissions; v_repes int;
begin
  update public.packing_list_submissions set deleted_at = now()
   where prealerta_id = 'ea111111-1111-1111-1111-111111111111' and version_no = 2;

  v3 := pg_temp.enviar('ea111111-1111-1111-1111-111111111111', 'tercero');
  if v3.version_no <> 3 then
    raise exception
      'CONTRATO 3 ROTO: tras borrar la v2 el envio nuevo salio como v% — se repite un numero de version',
      v3.version_no;
  end if;

  select count(*) into v_repes from (
    select version_no from public.packing_list_submissions
     where prealerta_id = 'ea111111-1111-1111-1111-111111111111'
     group by version_no having count(*) > 1
  ) d;
  if v_repes > 0 then
    raise exception 'CONTRATO 3 ROTO: hay % numero(s) de version repetidos en la cadena', v_repes;
  end if;
end;
$$;

-- ── 4 · 🔴 La RPC es SÓLO para service_role ───────────────────────────────
--
-- El proveedor es anónimo: su capability es el token, y quien lo valida es el
-- route server-side. Si `anon` o `authenticated` alcanzaran la RPC, cualquiera
-- inyectaría un packing list en la orden de cualquiera — sin token y sin rastro.
do $$
declare v_mal text; v_oid oid;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_packing_list';

  select string_agg(quien, ', ') into v_mal
    from (values ('anon'), ('authenticated'), ('public')) as r(quien)
   where has_function_privilege(r.quien, v_oid, 'EXECUTE');

  if v_mal is not null then
    raise exception 'CONTRATO 4 ROTO: la RPC del proveedor esta abierta a %', v_mal;
  end if;
  if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception 'CONTRATO 4 ROTO: service_role NO puede usar su propia RPC';
  end if;
end;
$$;

-- ── 5 · 🔴 El proveedor nunca toca la tabla ───────────────────────────────
do $$
declare v_pol text;
begin
  select string_agg(polname, ', ') into v_pol
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
   where c.relname = 'packing_list_submissions'
     and exists (
       select 1 from unnest(pol.polroles) r
        where r = 'anon'::regrole or r = 0   -- 0 = PUBLIC
     );

  if v_pol is not null then
    raise exception 'CONTRATO 5 ROTO: hay policy para anon/public sobre los packing lists: %', v_pol;
  end if;

  if not (select relrowsecurity from pg_class where relname = 'packing_list_submissions') then
    raise exception 'CONTRATO 5 ROTO: la tabla quedo SIN row level security';
  end if;
end;
$$;

-- ── 6 · Sin tenant, sin orden o sin Shipping Mark, rechaza ────────────────
do $$
declare v_antes int; v_despues int;
begin
  select count(*) into v_antes from public.packing_list_submissions;

  begin
    perform public.submit_packing_list(
      'ea111111-1111-1111-1111-111111111111', null, 'DTD-5000',
      'USD'::packing_list_currency, current_date, null, null, null, null, null, null,
      '[]'::jsonb, 0, 0, 0, 0, 0, null, null);
  exception when others then null;
  end;
  begin
    perform public.submit_packing_list(
      null, '11111111-1111-1111-1111-111111111111', 'DTD-5000',
      'USD'::packing_list_currency, current_date, null, null, null, null, null, null,
      '[]'::jsonb, 0, 0, 0, 0, 0, null, null);
  exception when others then null;
  end;
  begin
    perform public.submit_packing_list(
      'ea111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '   ',
      'USD'::packing_list_currency, current_date, null, null, null, null, null, null,
      '[]'::jsonb, 0, 0, 0, 0, 0, null, null);
  exception when others then null;
  end;

  select count(*) into v_despues from public.packing_list_submissions;
  if v_despues <> v_antes then
    raise exception 'CONTRATO 6 ROTO: entraron % envios sin tenant, sin orden o sin Shipping Mark',
      v_despues - v_antes;
  end if;
end;
$$;

-- ── 7 · El folio no se comparte entre tenants ─────────────────────────────
do $$
declare v1 text; v2 text;
begin
  -- El tenant 1 ya quemó 3 folios (los 3 envíos de arriba).
  v1 := public.next_packing_list_folio('11111111-1111-1111-1111-111111111111');
  v2 := public.next_packing_list_folio('22222222-2222-2222-2222-222222222222');

  if v1 !~ '^DTD-PL-[0-9]{4}-[0-9]{4}$' then
    raise exception 'CONTRATO 7 ROTO: el folio no tiene forma DTD-PL-YYYY-NNNN (es %)', v1;
  end if;
  if v1 not like '%-0004' then
    raise exception 'CONTRATO 7 ROTO: el tenant 1 iba por 0004 y dio %', v1;
  end if;
  if v2 not like '%-0001' then
    raise exception 'CONTRATO 7 ROTO: el contador se comparte entre tenants (tenant 2 dio %)', v2;
  end if;
end;
$$;

-- ── 8 · El adjunto declara de dónde vino ──────────────────────────────────
--
-- Distinguir la subida del proveedor de la del cliente no es cosmético: si un
-- documento aparece mal, lo primero que se pregunta es quién lo subió.
do $$
declare v_n int; v_id uuid;
begin
  insert into public.prealerta_documents (tenant_id, prealerta_id)
  values ('11111111-1111-1111-1111-111111111111',
          'ea111111-1111-1111-1111-111111111111')
  returning id into v_id;

  if (select source from public.prealerta_documents where id = v_id) <> 'client' then
    raise exception 'CONTRATO 8 ROTO: el adjunto no nace con source = client';
  end if;

  begin
    insert into public.prealerta_documents (tenant_id, prealerta_id, source)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111', 'quien_sabe');
  exception when others then null;
  end;
  select count(*) into v_n from public.prealerta_documents where source = 'quien_sabe';
  if v_n <> 0 then
    raise exception 'CONTRATO 8 ROTO: entro un adjunto con procedencia inventada';
  end if;

  -- Las tres válidas sí.
  insert into public.prealerta_documents (tenant_id, prealerta_id, source) values
    ('11111111-1111-1111-1111-111111111111', 'ea111111-1111-1111-1111-111111111111', 'supplier'),
    ('11111111-1111-1111-1111-111111111111', 'ea111111-1111-1111-1111-111111111111', 'team');
end;
$$;

rollback;
