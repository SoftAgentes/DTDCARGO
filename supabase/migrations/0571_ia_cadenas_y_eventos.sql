-- ─────────────────────────────────────────────────────────────────────────────
-- 0571 · SDD-0704 fase 1 (F1-B) — Pantalla «IA»: la cadena de hasta tres modelos
-- por función y el registro de cada intento.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK NOMINAL de Sam para este archivo y el runbook
--    docs/runbooks/aplicar-migraciones-prod.md. Fusionar la PR NO autoriza
--    aplicarla. REQUIERE la 0570 (catálogo, cuentas, ia_contexto_de_escritura)
--    y la 0258/0267 (append_audit_event): su preflight para si falta algo.
--    ORDEN: indiferente. Sin la 0571, A1 (noticias) y A2 (brief) siguen con el
--    modelo por defecto del código, sin cadena ni registro, como hoy.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. ia_cadenas (tenant, función, puesto 1-3, proveedor, modelo, cuenta): la
--    cadena de cada función (§3.1). Llave foránea al catálogo de la 0570: no se
--    guarda un modelo fuera de él. Un modelo no se repite en la misma cadena.
--    Regla D-2 (§5): un disparador copia datos_clientes desde la lista FIJA de
--    funciones con datos de clientes (quien escribe no la elige) y un CHECK impide
--    datos_clientes con un proveedor chino. Vale para los tres puestos, también
--    con la clave de servicio. Si el puesto nombra una cuenta, su proveedor tiene
--    que ser el de la cuenta y la cuenta, del mismo tenant.
-- 2. ia_eventos: una fila por intento (§4.4, 0638 §5.3): función, puesto,
--    proveedor, modelo, resultado (ok o la clase del clasificador), status,
--    código y tokens. NUNCA texto, pregunta ni respuesta. Solo se agrega.
-- 3. ia_guardar_cadena(función, proveedores[], modelos[], motivo): la pantalla,
--    solo el superadministrador, con motivo y auditoría. En la F1-B solo A1 y A2
--    (la Oficina es la fase 1b). Cambiar la cadena no afloja el freno: no pide
--    la barrera (§8).
-- 4. ia_cadena_de(función) e ia_registrar_evento(…): para A1, que corre con la
--    sesión de quien redacta (no tiene por qué ser superadmin). Solo leen la
--    cadena de su tenant y solo anotan eventos de A1. A2 corre en un cron con la
--    clave de servicio y lee y escribe directo, con grants mínimos.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Nada existente: ni la 0570 ni el despachador de la Oficina (fase 1b).
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo tablas y funciones nuevas. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0571_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde la cadena elegida y el registro de intentos; A1 y A2 vuelven al
-- modelo por defecto del código.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ─── 0. Preflight ────────────────────────────────────────────
do $preflight$
declare
  v_missing text[] := array[]::text[];
  v_req record;
begin
  for v_req in
    select * from (values
      ('table public.tenants', pg_catalog.to_regclass('public.tenants') is not null),
      ('table public.ia_catalogo_modelos (0570)', pg_catalog.to_regclass('public.ia_catalogo_modelos') is not null),
      ('table public.ia_cuentas (0570)', pg_catalog.to_regclass('public.ia_cuentas') is not null),
      ('function public.ia_contexto_de_escritura(text) (0570)',
        pg_catalog.to_regprocedure('public.ia_contexto_de_escritura(text)') is not null),
      ('function public.is_platform_admin()', pg_catalog.to_regprocedure('public.is_platform_admin()') is not null),
      ('function public.get_user_tenant_id()', pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null),
      ('function public.append_audit_event(…)', pg_catalog.to_regprocedure(
        'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is not null),
      ('audit type ia_config (0570)', exists (select 1 from public.audit_entity_types where entity_type = 'ia_config'))
    ) as r(nombre, ok)
  loop
    if not v_req.ok then v_missing := v_missing || v_req.nombre; end if;
  end loop;
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception '0571 requiere objetos ausentes: %', v_missing;
  end if;
end
$preflight$;

-- ─── 1. Cadenas ──────────────────────────────────────────────
create table if not exists public.ia_cadenas (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  funcion          text not null,
  puesto           smallint not null,
  proveedor        text not null,
  modelo           text not null,
  cuenta_id        uuid references public.ia_cuentas(id) on delete set null,
  datos_clientes   boolean not null default false,
  actualizado_en   timestamptz not null default pg_catalog.now(),
  actualizado_por  uuid,
  primary key (tenant_id, funcion, puesto),
  constraint ia_cadenas_funcion_valida check (funcion in (
    'oficina', 'a1_noticias', 'a2_brief', 'a3_actas', 'a4a_resumen_interno', 'a4b_resumen_portal',
    'a5_documentos', 'a6_agentes', 'a8_analisis_chatwoot')),
  constraint ia_cadenas_puesto_valido check (puesto between 1 and 3),
  constraint ia_cadenas_proveedor_valido check (proveedor in ('anthropic', 'openai', 'zai', 'deepseek')),
  -- D-2: datos de clientes nunca con un proveedor chino, en ninguno de los tres puestos.
  constraint ia_cadenas_datos_no_chino check (not (datos_clientes and proveedor in ('zai', 'deepseek'))),
  constraint ia_cadenas_modelo_del_catalogo foreign key (proveedor, modelo)
    references public.ia_catalogo_modelos (proveedor, modelo),
  constraint ia_cadenas_sin_repetir unique (tenant_id, funcion, proveedor, modelo)
);

-- La marca de datos sale de la lista fija de la migración, nunca de quien escribe (0639 §4, catalogo.ts).
create or replace function public.ia_cadenas_coherente()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_cuenta public.ia_cuentas%rowtype;
begin
  new.datos_clientes := new.funcion in (
    'oficina', 'a3_actas', 'a4a_resumen_interno', 'a4b_resumen_portal', 'a5_documentos', 'a6_agentes');
  if new.cuenta_id is not null then
    select * into v_cuenta from public.ia_cuentas c where c.id = new.cuenta_id;
    if not found or v_cuenta.tenant_id <> new.tenant_id then
      raise exception 'ia:cuenta_de_otro_tenant' using errcode = '23514';
    end if;
    if v_cuenta.proveedor <> new.proveedor then
      raise exception 'ia:proveedor_distinto_de_la_cuenta' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists ia_cadenas_coherente on public.ia_cadenas;
create trigger ia_cadenas_coherente
  before insert or update on public.ia_cadenas
  for each row execute function public.ia_cadenas_coherente();

comment on table public.ia_cadenas is
  'SDD-0704 §3: la cadena de hasta tres modelos por función. Cada llamada nueva empieza por el puesto 1 (D-2 de '
  'Sam) y salta al siguiente solo con las clases de §4.1. D-2: datos_clientes sale de la lista fija y un CHECK '
  'impide un proveedor chino con datos de clientes.';

-- ─── 2. Registro de intentos ─────────────────────────────────
create table if not exists public.ia_eventos (
  id               uuid not null default pg_catalog.gen_random_uuid() primary key,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  ts               timestamptz not null default pg_catalog.now(),
  funcion          text not null,
  puesto           smallint not null,
  proveedor        text not null,
  modelo           text not null,
  resultado        text not null,
  status           integer,
  codigo           text,
  tokens_entrada   integer,
  tokens_salida    integer,
  constraint ia_eventos_funcion_valida check (funcion in (
    'oficina', 'a1_noticias', 'a2_brief', 'a3_actas', 'a4a_resumen_interno', 'a4b_resumen_portal',
    'a5_documentos', 'a6_agentes', 'a8_analisis_chatwoot')),
  constraint ia_eventos_puesto_valido check (puesto between 1 and 3),
  constraint ia_eventos_proveedor_valido check (proveedor in ('anthropic', 'openai', 'zai', 'deepseek')),
  constraint ia_eventos_modelo_valido check (modelo ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint ia_eventos_resultado_valido check (resultado in (
    'ok', 'falta_de_pago', 'cuenta_suspendida', 'llave_invalida', 'limite_de_uso', 'proveedor_caido', 'otro')),
  constraint ia_eventos_status_valido check (status is null or status between 0 and 999),
  -- Un código, nunca texto: sin espacios y corto.
  constraint ia_eventos_codigo_valido check (codigo is null or codigo ~ '^[a-z0-9_.:-]{1,64}$'),
  constraint ia_eventos_tokens_validos check (
    (tokens_entrada is null or tokens_entrada between 0 and 10000000)
    and (tokens_salida is null or tokens_salida between 0 and 10000000))
);

create index if not exists ia_eventos_por_funcion on public.ia_eventos (tenant_id, funcion, ts desc);

comment on table public.ia_eventos is
  'SDD-0704 §4.4 y 0638 §5.3: una fila por intento de llamada (resultado ok o la clase del clasificador). Nunca '
  'texto, pregunta ni respuesta. Solo se agrega.';

-- ─── 3. RLS y privilegios ────────────────────────────────────
alter table public.ia_cadenas enable row level security;
alter table public.ia_eventos enable row level security;

revoke all on public.ia_cadenas, public.ia_eventos from public, anon, authenticated, service_role;
grant select on public.ia_cadenas, public.ia_eventos to authenticated;
-- A2 corre con la clave de servicio: lee la cadena y agrega eventos. Nada más.
grant select on public.ia_cadenas to service_role;
grant select, insert on public.ia_eventos to service_role;

drop policy if exists ia_cadenas_lee_superadmin on public.ia_cadenas;
create policy ia_cadenas_lee_superadmin on public.ia_cadenas
  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());
drop policy if exists ia_eventos_lee_superadmin on public.ia_eventos;
create policy ia_eventos_lee_superadmin on public.ia_eventos
  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());

drop policy if exists ia_cadenas_lee_service_role on public.ia_cadenas;
create policy ia_cadenas_lee_service_role on public.ia_cadenas for select to service_role using (true);
drop policy if exists ia_eventos_lee_service_role on public.ia_eventos;
create policy ia_eventos_lee_service_role on public.ia_eventos for select to service_role using (true);
drop policy if exists ia_eventos_agrega_service_role on public.ia_eventos;
create policy ia_eventos_agrega_service_role on public.ia_eventos for insert to service_role with check (true);

-- ─── 4. La pantalla guarda la cadena ─────────────────────────
create or replace function public.ia_guardar_cadena(
  p_funcion text,
  p_proveedores text[],
  p_modelos text[],
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_n integer := coalesce(pg_catalog.cardinality(p_modelos), 0);
  v_antes jsonb;
  v_despues jsonb;
begin
  -- F1-B: solo A1 y A2. La Oficina entra en la fase 1b, cuando Ofi_Hermes conecte los alias (§6).
  if p_funcion is null or p_funcion not in ('a1_noticias', 'a2_brief') then
    raise exception 'ia:funcion_no_editable' using errcode = '22023';
  end if;
  if v_n not between 1 and 3 or coalesce(pg_catalog.cardinality(p_proveedores), 0) <> v_n then
    raise exception 'ia:cadena_invalida' using errcode = '22023';
  end if;
  if pg_catalog.array_position(p_modelos, null) is not null
     or pg_catalog.array_position(p_proveedores, null) is not null then
    raise exception 'ia:cadena_invalida' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'puesto', c.puesto, 'proveedor', c.proveedor, 'modelo', c.modelo) order by c.puesto), '[]'::jsonb)
    into v_antes
    from public.ia_cadenas c
   where c.tenant_id = v_tenant and c.funcion = p_funcion;

  delete from public.ia_cadenas c where c.tenant_id = v_tenant and c.funcion = p_funcion;
  insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo, actualizado_por)
  select v_tenant, p_funcion, x.puesto::smallint, x.proveedor, x.modelo, v_uid
    from pg_catalog.unnest(p_proveedores, p_modelos) with ordinality as x(proveedor, modelo, puesto);

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'puesto', c.puesto, 'proveedor', c.proveedor, 'modelo', c.modelo) order by c.puesto)
    into v_despues
    from public.ia_cadenas c
   where c.tenant_id = v_tenant and c.funcion = p_funcion;

  perform public.append_audit_event(
    -- La cadena no tiene id propio: uno estable por tenant y función, para que sus eventos se agrupen.
    v_tenant, 'ia_config', pg_catalog.md5(v_tenant::text || ':' || p_funcion)::uuid, 'user', v_uid, 'ia_cadena_guardada', 'studio', 'succeeded', p_motivo,
    pg_catalog.jsonb_build_object('funcion', p_funcion, 'cadena', v_antes),
    pg_catalog.jsonb_build_object('funcion', p_funcion, 'cadena', v_despues),
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', false),
    null, 1, 'internal');
  return v_n;
end;
$function$;

-- ─── 5. A1 con la sesión de quien redacta ────────────────────
create or replace function public.ia_cadena_de(p_funcion text)
returns table (puesto smallint, proveedor text, modelo text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'ia:sin_sesion' using errcode = '42501';
  end if;
  -- Solo las funciones que corren con la sesión de una persona.
  if p_funcion is null or p_funcion not in ('a1_noticias') then
    raise exception 'ia:funcion_no_editable' using errcode = '22023';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'ia:sin_tenant' using errcode = '42501';
  end if;
  return query
    select c.puesto, c.proveedor, c.modelo
      from public.ia_cadenas c
     where c.tenant_id = v_tenant and c.funcion = p_funcion
     order by c.puesto;
end;
$function$;

create or replace function public.ia_registrar_evento(
  p_funcion text,
  p_puesto integer,
  p_proveedor text,
  p_modelo text,
  p_resultado text,
  p_status integer,
  p_codigo text,
  p_tokens_entrada integer,
  p_tokens_salida integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'ia:sin_sesion' using errcode = '42501';
  end if;
  if p_funcion is null or p_funcion not in ('a1_noticias') then
    raise exception 'ia:funcion_no_editable' using errcode = '22023';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'ia:sin_tenant' using errcode = '42501';
  end if;
  insert into public.ia_eventos
    (tenant_id, funcion, puesto, proveedor, modelo, resultado, status, codigo, tokens_entrada, tokens_salida)
  values
    (v_tenant, p_funcion, p_puesto::smallint, p_proveedor, p_modelo, p_resultado, p_status, p_codigo,
     p_tokens_entrada, p_tokens_salida);
end;
$function$;

-- ─── 6. Dueño y privilegios de las funciones ─────────────────
do $funciones$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.ia_cadenas_coherente()',
    'public.ia_guardar_cadena(text, text[], text[], text)',
    'public.ia_cadena_de(text)',
    'public.ia_registrar_evento(text, integer, text, text, text, integer, text, integer, integer)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_firma);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_firma);
  end loop;
  foreach v_firma in array array[
    'public.ia_guardar_cadena(text, text[], text[], text)',
    'public.ia_cadena_de(text)',
    'public.ia_registrar_evento(text, integer, text, text, text, integer, text, integer, integer)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to authenticated', v_firma);
  end loop;
end
$funciones$;

comment on function public.ia_guardar_cadena(text, text[], text[], text) is
  'SDD-0704 §2.3: guarda la cadena de 1 a 3 modelos de una función (F1-B: A1 y A2). Solo superadmin, con motivo; '
  'audita el antes y el después. No afloja el freno.';
comment on function public.ia_cadena_de(text) is
  'SDD-0704 §4: la cadena de A1 para quien redacta, de su tenant. Solo nombres de modelo.';
comment on function public.ia_registrar_evento(text, integer, text, text, text, integer, text, integer, integer) is
  'SDD-0704 §4.4: anota un intento de A1 (sin texto). Los CHECK de ia_eventos limitan cada campo.';

-- ─── 7. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_tabla text;
  v_firma text;
  v_rol text;
begin
  foreach v_tabla in array array['public.ia_cadenas', 'public.ia_eventos'] loop
    if not exists (select 1 from pg_catalog.pg_class c
                    where c.oid = pg_catalog.to_regclass(v_tabla) and c.relrowsecurity) then
      raise exception '0571 postflight: % no existe o no tiene RLS activa', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated'] loop
      if pg_catalog.has_table_privilege(v_rol, v_tabla, 'INSERT,UPDATE,DELETE,TRUNCATE') then
        raise exception '0571 postflight: % puede escribir %', v_rol, v_tabla;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('anon', v_tabla, 'SELECT') then
      raise exception '0571 postflight: anon puede leer %', v_tabla;
    end if;
    if pg_catalog.has_table_privilege('service_role', v_tabla, 'UPDATE,DELETE,TRUNCATE') then
      raise exception '0571 postflight: service_role puede cambiar o borrar %', v_tabla;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('service_role', 'public.ia_cadenas', 'INSERT') then
    raise exception '0571 postflight: service_role puede escribir la cadena';
  end if;
  foreach v_firma in array array[
    'public.ia_cadenas_coherente()',
    'public.ia_guardar_cadena(text, text[], text[], text)',
    'public.ia_cadena_de(text)',
    'public.ia_registrar_evento(text, integer, text, text, text, integer, text, integer, integer)'
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = pg_catalog.to_regprocedure(v_firma)
                      and p.proconfig @> array['search_path=""']) then
      raise exception '0571 postflight: % no existe o no tiene search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE') then
      raise exception '0571 postflight: anon puede ejecutar %', v_firma;
    end if;
  end loop;
end
$postflight$;
