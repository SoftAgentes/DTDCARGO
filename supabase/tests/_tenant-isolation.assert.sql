-- ─────────────────────────────────────────────────────────────
-- Contrato de AISLAMIENTO MULTI-TENANT del ERP
--
-- Corre sobre el schema COMPLETO reconstruido desde cero (las 267 migraciones),
-- desde `scripts/check-schema-rebuild.mjs`. No es un fixture recortado: mira las
-- 219 tablas reales.
--
-- POR QUÉ: `get_user_tenant_id()` tiene ~480 usos en las migraciones. Que un
-- tenant no vea los datos de otro es LA propiedad de la que cuelga todo el ERP
-- — clientes, cédulas, RIFs, montos — y hasta hoy no la verificaba nada
-- automático. El estado actual es bueno (190 de 192 tablas con `tenant_id`
-- filtran por tenant); esto lo CONGELA: si mañana alguien agrega una tabla con
-- `tenant_id` y se olvida la policy, el gate se pone rojo.
--
-- Termina en ROLLBACK. Cero datos persistidos.
-- ─────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

begin;

-- ═════════════════════════════════════════════════════════════
-- A · Barrido estructural sobre todas las tablas
-- ═════════════════════════════════════════════════════════════

-- A1 · Toda tabla de `public` tiene RLS. Sin RLS, las policies son decoración.
do $a1$
declare
  v_sin_rls text;
begin
  select string_agg(k.relname, ', ' order by k.relname)
    into v_sin_rls
  from pg_class k
  join pg_namespace n on n.oid = k.relnamespace and n.nspname = 'public'
  where k.relkind = 'r'
    and not k.relrowsecurity
    -- Catálogo público de localidades de Venezuela: datos de referencia, sin
    -- dueño ni tenant. Si algún día gana una columna tenant_id, sacala de acá.
    and k.relname <> 've_locality_catalog';

  if v_sin_rls is not null then
    raise exception 'AISLAMIENTO A1: tabla(s) sin RLS en public: %', v_sin_rls;
  end if;
end
$a1$;

-- A2 · Ninguna policy de LECTURA para `authenticated` sobre una tabla con
-- `tenant_id` puede ser permisiva. Un `USING (true)` acá = cualquier usuario
-- autenticado lee los datos de todos los tenants.
-- (Las policies de INSERT no tienen USING: su filtro vive en WITH CHECK, y se
--  verifica aparte en A3 + la prueba dinámica de la parte B.)
do $a2$
declare
  v_malas text;
begin
  select string_agg(k.relname || '.' || p.polname, ', ' order by k.relname)
    into v_malas
  from pg_policy p
  join pg_class k on k.oid = p.polrelid
  join pg_namespace n on n.oid = k.relnamespace and n.nspname = 'public'
  where p.polcmd in ('r', '*')                       -- SELECT y ALL
    and 'authenticated' = any (select rolname from pg_roles where oid = any (p.polroles))
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = k.relname
        and c.column_name = 'tenant_id'
    )
    and coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true';

  if v_malas is not null then
    raise exception 'AISLAMIENTO A2: policy de lectura SIN filtro sobre tabla con tenant_id: %', v_malas;
  end if;
end
$a2$;

-- A3 · Toda tabla con `tenant_id` que `authenticated` pueda leer tiene que
-- filtrar por tenant (o por dueño, que es más estricto).
do $a3$
declare
  v_sin_filtro text;
begin
  select string_agg(t.relname, ', ' order by t.relname)
    into v_sin_filtro
  from (
    select k.oid, k.relname
    from pg_class k
    join pg_namespace n on n.oid = k.relnamespace and n.nspname = 'public'
    where k.relkind = 'r'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = k.relname
          and c.column_name = 'tenant_id'
      )
      and has_table_privilege('authenticated', k.oid, 'SELECT')
      -- Excepciones VERIFICADAS una por una (2026-07-29). Agregar algo acá exige
      -- mirar sus policies y justificarlo por escrito:
      --   · user_tenants / user_push_subscriptions → filtran por
      --     `user_id = auth.uid()`, MÁS estricto que por tenant (la fila
      --     pertenece a una persona, no al tenant).
      --   · news_posts → es el blog PÚBLICO de /noticias: su policy de lectura
      --     es `published = true` para todos los roles (anon incluido), a
      --     propósito. Los borradores no se filtran (exige published) y el
      --     INSERT/UPDATE/DELETE sí valida tenant + rol admin.
      and k.relname not in ('user_tenants', 'user_push_subscriptions', 'news_posts')
  ) t
  where not exists (
    select 1 from pg_policy p
    where p.polrelid = t.oid
      and p.polcmd in ('r', '*')
      and (
        pg_get_expr(p.polqual, p.polrelid) like '%tenant%'
        or pg_get_expr(p.polqual, p.polrelid) like '%uid()%'
      )
  );

  if v_sin_filtro is not null then
    raise exception 'AISLAMIENTO A3: tabla(s) con tenant_id legibles sin policy que filtre por tenant/dueño: %', v_sin_filtro;
  end if;
end
$a3$;

-- ═════════════════════════════════════════════════════════════
-- B · Prueba dinámica: dos tenants reales, datos reales
--
-- El barrido de arriba dice que las policies EXISTEN y tienen buena pinta.
-- Esto prueba que además FUNCIONAN.
-- ═════════════════════════════════════════════════════════════

insert into auth.users (id, email, raw_user_meta_data) values
  ('aa000000-0000-4000-8000-000000000001', 'a@tenant-a.test', '{"tenant":"dtd-cargo"}'::jsonb),
  ('bb000000-0000-4000-8000-000000000002', 'b@tenant-b.test', '{"tenant":"dtd-cargo"}'::jsonb);

insert into public.tenants (id, slug, display_name) values
  ('11110000-0000-4000-8000-00000000000a', 'tenant-a-test', 'Tenant A (prueba)'),
  ('22220000-0000-4000-8000-00000000000b', 'tenant-b-test', 'Tenant B (prueba)');

-- user_tenants tiene FK a user_profiles (no sólo a auth.users).
insert into public.user_profiles (user_id, first_name) values
  ('aa000000-0000-4000-8000-000000000001', 'Ana'),
  ('bb000000-0000-4000-8000-000000000002', 'Beto');

insert into public.user_tenants (user_id, tenant_id) values
  ('aa000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-00000000000a'),
  ('bb000000-0000-4000-8000-000000000002', '22220000-0000-4000-8000-00000000000b');

-- Un cliente por tenant (se insertan como owner, sin pasar por RLS).
insert into public.clients (tenant_id, name) values
  ('11110000-0000-4000-8000-00000000000a', 'Cliente del tenant A'),
  ('22220000-0000-4000-8000-00000000000b', 'Cliente del tenant B');

do $b_setup$
begin
  if (select count(*) from public.clients
      where tenant_id in ('11110000-0000-4000-8000-00000000000a',
                          '22220000-0000-4000-8000-00000000000b')) <> 2 then
    raise exception 'AISLAMIENTO B: el fixture no quedó armado';
  end if;
end
$b_setup$;

-- ── Sesión del usuario A ─────────────────────────────────────
-- La identidad va en los tres lugares donde la buscan los `auth.uid()` que corren
-- este contrato: `test.uid` (stub de `postgres:17`), `request.jwt.claim.sub` y
-- `request.jwt.claims` (el `auth.uid()` real de `supabase/postgres`, modo Supabase
-- de check-schema-rebuild · SDD-0505). Con solo `test.uid`, en la imagen real A
-- era anónimo y el contrato fallaba por RLS de más, no por el aislamiento.
set local role authenticated;
select set_config('test.uid', 'aa000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $b_tenant_a$
declare
  v_propios int;
  v_ajenos  int;
  v_tocadas int;
begin
  -- `is distinct from` y no `<>`: si la identidad no llegó, el tenant sale null y
  -- `null <> x` es null, así que el `if` no disparaba y el chequeo pasaba en falso.
  if public.get_user_tenant_id() is distinct from '11110000-0000-4000-8000-00000000000a' then
    raise exception 'AISLAMIENTO B: get_user_tenant_id() no resolvió el tenant de A';
  end if;

  select count(*) into v_propios from public.clients
   where tenant_id = '11110000-0000-4000-8000-00000000000a';
  if v_propios <> 1 then
    raise exception 'AISLAMIENTO B: A no ve a su propio cliente (RLS de más)';
  end if;

  -- El corazón del contrato.
  select count(*) into v_ajenos from public.clients
   where tenant_id = '22220000-0000-4000-8000-00000000000b';
  if v_ajenos <> 0 then
    raise exception 'AISLAMIENTO B: el tenant A LEE % cliente(s) del tenant B', v_ajenos;
  end if;

  -- Tampoco puede escribir sobre lo ajeno (RLS filtra el UPDATE a 0 filas).
  update public.clients set name = 'secuestrado por A'
   where tenant_id = '22220000-0000-4000-8000-00000000000b';
  get diagnostics v_tocadas = row_count;
  if v_tocadas <> 0 then
    raise exception 'AISLAMIENTO B: el tenant A MODIFICÓ % fila(s) del tenant B', v_tocadas;
  end if;

  -- Ni sembrar filas con el tenant de otro (eso lo ataja el WITH CHECK).
  begin
    insert into public.clients (tenant_id, name)
    values ('22220000-0000-4000-8000-00000000000b', 'inyectado por A');
    raise exception 'AISLAMIENTO B: el tenant A INSERTÓ una fila en el tenant B';
  exception
    when insufficient_privilege then null;   -- RLS WITH CHECK: lo correcto
  end;
end
$b_tenant_a$;

reset role;

-- ── Y el simétrico, desde B ──────────────────────────────────
set local role authenticated;
select set_config('test.uid', 'bb000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.sub', 'bb000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $b_tenant_b$
declare
  v_ajenos int;
begin
  select count(*) into v_ajenos from public.clients
   where tenant_id = '11110000-0000-4000-8000-00000000000a';
  if v_ajenos <> 0 then
    raise exception 'AISLAMIENTO B: el tenant B LEE % cliente(s) del tenant A', v_ajenos;
  end if;
end
$b_tenant_b$;

reset role;

-- Nada de esto sobrevive.
rollback;

select 'aislamiento multi-tenant: contrato verificado' as resultado;
