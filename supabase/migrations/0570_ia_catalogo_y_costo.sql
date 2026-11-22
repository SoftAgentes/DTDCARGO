-- ─────────────────────────────────────────────────────────────────────────────
-- 0570 · SDD-0704 fase 1 (F1-A) — Pantalla «IA»: catálogo de modelos, cuentas con
-- tipo de cobro, tarifa por modelo y tope del mes, con la Oficina incluida.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK NOMINAL de Sam para este archivo y el runbook
--    docs/runbooks/aplicar-migraciones-prod.md. Fusionar la PR NO autoriza
--    aplicarla. REQUIERE la 0541 (task_events, office_paused,
--    office_esta_pausada), la 0258/0267 (catálogo y append_audit_event) y
--    is_platform_admin(): su preflight para si falta algo.
--    ORDEN: indiferente. Sin la 0570 el despachador sigue con las variables de
--    entorno de siempre y la pantalla dice que falta la migración.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. ia_catalogo_modelos (proveedor, modelo, origen): el catálogo aprobado por PR,
--    sembrado aquí (SDD-0704 §3.2). Sumar un modelo es otra migración con OK
--    nominal. origen = 'chino' para zai y deepseek (D-2); un CHECK lo ata.
-- 2. ia_cuentas: cada cuenta (alias, nunca un correo) con su proveedor, su uso
--    (erp | oficina) y su tipo de cobro (por_token | plan_fijo). Plan fijo exige
--    su tope de llamadas del mes (D-4). Una sola cuenta de la Oficina (I).
-- 3. ia_modelos: el modelo de una cuenta con su tarifa (USD por millón de tokens),
--    con llave foránea al catálogo. Por token exige tarifa > 0; plan fijo no
--    lleva tarifa.
-- 4. ia_topes: el tope del mes en USD por función. Techo de la Oficina en la
--    base: 15 USD (D5 de la 0626, igual que TOPE_MENSUAL_MAXIMO_USD).
-- 5. task_events.tokens_entrada / tokens_salida: los tokens de cada llamada
--    (hoy solo van en el texto del resumen). ADD COLUMN con default constante.
-- 6. Funciones de escritura (authenticated, SECURITY DEFINER, search_path vacío):
--    ia_guardar_cuenta, ia_guardar_modelo, ia_borrar_modelo, ia_guardar_tope y
--    ia_borrar_tope. Solo el superadministrador (F1-A; el módulo `ia` por persona
--    va en su propia PR). Motivo obligatorio (4-200). Todo lo que AFLOJA el
--    freno exige AAL2 o la contraseña de hace menos de 5 minutos (D-5 de Sam
--    del 2026-11-21 + bloqueante 1 de la revisión): subir el tope,
--    quitarlo, subir o quitar el tope de llamadas, pasar a plan fijo, bajar o
--    borrar una tarifa y dar de alta un modelo con tarifa menor que la mayor ya
--    declarada en su cuenta. La base no conoce las variables de entorno: cuando
--    el valor efectivo previo sale del .env (primera tarifa de una cuenta por
--    token, primer tope de una función) exige AAL2 siempre. Es más estricto que
--    «comparar con el .env», nunca menos. Cada cambio deja un evento en
--    entity_audit_log con el valor anterior, el nuevo y el motivo.
-- 7. Funciones del despachador (solo service_role): ia_costo_oficina() (tope,
--    cuenta y tarifas de la Oficina, o null), ia_oficina_llamadas_del_mes() e
--    ia_oficina_autopausar_por_llamadas(tope, umbral), que SOLO pausa.
-- 8. ia_gasto_del_mes(): el gasto del mes de la Oficina por modelo, para la
--    pantalla (superadministrador). Mes en UTC, como office_gasto_del_mes().
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna función ni policy existente. task_events gana dos columnas; su
-- disparador de solo agregar sigue igual (un ALTER TABLE no es un UPDATE).
--
-- ── Locks ───────────────────────────────────────────────────
-- ALTER TABLE task_events ADD COLUMN … default 0: ACCESS EXCLUSIVE un instante
-- (default constante, sin reescritura). lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0570_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde la configuración de la pantalla y los tokens por llamada; el
-- costo de task_events queda.
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
      ('table public.task_events (0541)', pg_catalog.to_regclass('public.task_events') is not null),
      ('table public.office_paused (0541)', pg_catalog.to_regclass('public.office_paused') is not null),
      ('table public.audit_entity_types (0258)', pg_catalog.to_regclass('public.audit_entity_types') is not null),
      ('function public.office_esta_pausada()', pg_catalog.to_regprocedure('public.office_esta_pausada()') is not null),
      ('function public.is_platform_admin()', pg_catalog.to_regprocedure('public.is_platform_admin()') is not null),
      ('function public.get_user_tenant_id()', pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null),
      ('function public.append_audit_event(…)', pg_catalog.to_regprocedure(
        'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is not null)
    ) as r(nombre, ok)
  loop
    if not v_req.ok then v_missing := v_missing || v_req.nombre; end if;
  end loop;
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception '0570 requiere objetos ausentes: %', v_missing;
  end if;
end
$preflight$;

-- ─── 1. Catálogo ─────────────────────────────────────────────
create table if not exists public.ia_catalogo_modelos (
  proveedor text not null,
  modelo    text not null,
  origen    text not null,
  primary key (proveedor, modelo),
  constraint ia_catalogo_proveedor_valido check (proveedor in ('anthropic', 'openai', 'zai', 'deepseek')),
  constraint ia_catalogo_modelo_valido check (modelo ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint ia_catalogo_origen_valido check (origen in ('chino', 'no_chino')),
  -- D-2: el origen sale del proveedor, no de quien escribe.
  constraint ia_catalogo_origen_del_proveedor
    check ((proveedor in ('zai', 'deepseek')) = (origen = 'chino'))
);

comment on table public.ia_catalogo_modelos is
  'SDD-0704 §3.2: catálogo aprobado por PR. Sumar un modelo es una migración con OK nominal de Sam; '
  'la pantalla solo elige entre los que están aquí. Debe coincidir con lib/studio/ia/catalogo.ts (prueba).';

insert into public.ia_catalogo_modelos (proveedor, modelo, origen) values
  ('anthropic', 'claude-opus-5-5', 'no_chino'),
  ('anthropic', 'claude-sonnet-5-5', 'no_chino'),
  ('anthropic', 'claude-haiku-5-5', 'no_chino'),
  ('anthropic', 'claude-sonnet-4-6', 'no_chino'),
  ('zai', 'glm-5.3', 'chino'),
  ('zai', 'glm-4.6', 'chino'),
  ('deepseek', 'deepseek-chat', 'chino')
on conflict (proveedor, modelo) do nothing;

-- ─── 2. Cuentas ──────────────────────────────────────────────
create table if not exists public.ia_cuentas (
  id                 uuid primary key default pg_catalog.gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  alias              text not null,
  proveedor          text not null,
  uso                text not null,
  tipo_cobro         text not null,
  tope_llamadas_mes  integer,
  creado_en          timestamptz not null default pg_catalog.now(),
  actualizado_en     timestamptz not null default pg_catalog.now(),
  actualizado_por    uuid,
  constraint ia_cuentas_alias_valido
    check (alias = pg_catalog.btrim(alias) and pg_catalog.char_length(alias) between 2 and 60 and alias !~ '@'),
  constraint ia_cuentas_proveedor_valido check (proveedor in ('anthropic', 'openai', 'zai', 'deepseek')),
  constraint ia_cuentas_uso_valido check (uso in ('erp', 'oficina')),
  constraint ia_cuentas_tipo_cobro_valido check (tipo_cobro in ('por_token', 'plan_fijo')),
  constraint ia_cuentas_tope_llamadas_valido
    check (tope_llamadas_mes is null or tope_llamadas_mes between 1 and 1000000),
  -- D-4: plan fijo suma 0 USD y tiene su propio tope de llamadas.
  constraint ia_cuentas_plan_fijo_con_tope check (tipo_cobro <> 'plan_fijo' or tope_llamadas_mes is not null),
  -- D-2: la Oficina lleva conversaciones de clientes; su cuenta nunca es de un proveedor chino.
  constraint ia_cuentas_oficina_no_china check (not (uso = 'oficina' and proveedor in ('zai', 'deepseek'))),
  unique (tenant_id, alias)
);

-- La Oficina es una sola (sus tablas no tienen tenant): una sola cuenta de uso oficina.
create unique index if not exists ia_cuentas_una_oficina on public.ia_cuentas ((true)) where uso = 'oficina';

comment on table public.ia_cuentas is
  'SDD-0704 §7.1: cuenta de IA con su tipo de cobro, declarado por Sam (el proveedor no lo dice). '
  'alias nunca es un correo. Plan fijo exige tope de llamadas. Una sola cuenta de uso oficina.';

-- ─── 3. Modelos con tarifa ───────────────────────────────────
create table if not exists public.ia_modelos (
  id                       uuid primary key default pg_catalog.gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  cuenta_id                uuid not null references public.ia_cuentas(id) on delete restrict,
  proveedor                text not null,
  modelo                   text not null,
  tarifa_entrada_usd_mtok  numeric(12, 6),
  tarifa_salida_usd_mtok   numeric(12, 6),
  vigente_desde            timestamptz not null default pg_catalog.now(),
  actualizado_por          uuid,
  foreign key (proveedor, modelo) references public.ia_catalogo_modelos (proveedor, modelo) on delete restrict,
  unique (cuenta_id, modelo),
  constraint ia_modelos_tarifas_juntas
    check ((tarifa_entrada_usd_mtok is null) = (tarifa_salida_usd_mtok is null)),
  constraint ia_modelos_tarifas_validas
    check (tarifa_entrada_usd_mtok is null
           or (tarifa_entrada_usd_mtok > 0 and tarifa_entrada_usd_mtok <= 1000
               and tarifa_salida_usd_mtok > 0 and tarifa_salida_usd_mtok <= 1000))
);

-- El proveedor del modelo es el de su cuenta, y la tarifa sigue el tipo de cobro de la cuenta.
create or replace function public.ia_modelos_coherente()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_cuenta public.ia_cuentas%rowtype;
begin
  select * into v_cuenta from public.ia_cuentas c where c.id = new.cuenta_id;
  if not found then
    raise exception 'ia:cuenta_inexistente' using errcode = '23503';
  end if;
  if v_cuenta.tenant_id <> new.tenant_id then
    raise exception 'ia:cuenta_de_otro_tenant' using errcode = '42501';
  end if;
  if v_cuenta.proveedor <> new.proveedor then
    raise exception 'ia:proveedor_distinto_de_la_cuenta' using errcode = '23514';
  end if;
  if v_cuenta.tipo_cobro = 'por_token' and new.tarifa_entrada_usd_mtok is null then
    raise exception 'ia:por_token_sin_tarifa' using errcode = '23514';
  end if;
  if v_cuenta.tipo_cobro = 'plan_fijo' and new.tarifa_entrada_usd_mtok is not null then
    raise exception 'ia:plan_fijo_con_tarifa' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists ia_modelos_coherente on public.ia_modelos;
create trigger ia_modelos_coherente
  before insert or update on public.ia_modelos
  for each row execute function public.ia_modelos_coherente();

-- Cambiar el tipo de cobro de una cuenta exige que sus modelos lo cumplan.
create or replace function public.ia_cuentas_coherente()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.proveedor <> old.proveedor
     and exists (select 1 from public.ia_modelos m where m.cuenta_id = new.id) then
    raise exception 'ia:cuenta_con_modelos_no_cambia_de_proveedor' using errcode = '23514';
  end if;
  if new.tipo_cobro = 'por_token'
     and exists (select 1 from public.ia_modelos m where m.cuenta_id = new.id and m.tarifa_entrada_usd_mtok is null) then
    raise exception 'ia:por_token_sin_tarifa' using errcode = '23514';
  end if;
  if new.tipo_cobro = 'plan_fijo'
     and exists (select 1 from public.ia_modelos m where m.cuenta_id = new.id and m.tarifa_entrada_usd_mtok is not null) then
    raise exception 'ia:plan_fijo_con_tarifa' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists ia_cuentas_coherente on public.ia_cuentas;
create trigger ia_cuentas_coherente
  before update on public.ia_cuentas
  for each row execute function public.ia_cuentas_coherente();

comment on table public.ia_modelos is
  'SDD-0704 §7.2: la tarifa vive con el modelo (USD por millón de tokens). Por token exige tarifa > 0; '
  'plan fijo no lleva tarifa. Llave foránea al catálogo: no se guarda un modelo fuera de él.';

-- ─── 4. Topes ────────────────────────────────────────────────
create table if not exists public.ia_topes (
  id               uuid not null default pg_catalog.gen_random_uuid() unique,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  funcion          text not null,
  tope_usd         numeric(12, 6) not null,
  actualizado_en   timestamptz not null default pg_catalog.now(),
  actualizado_por  uuid,
  primary key (tenant_id, funcion),
  constraint ia_topes_funcion_valida check (funcion in ('oficina')),
  constraint ia_topes_tope_valido check (tope_usd > 0 and tope_usd <= 10000),
  -- Techo de la Oficina (D5 de la 0626): igual que TOPE_MENSUAL_MAXIMO_USD en el código.
  constraint ia_topes_techo_oficina check (funcion <> 'oficina' or tope_usd <= 15)
);

create unique index if not exists ia_topes_una_oficina on public.ia_topes (funcion) where funcion = 'oficina';

comment on table public.ia_topes is
  'SDD-0704 §7.3: tope del mes en USD por función. La Oficina tiene techo de 15 USD aquí y en el código. '
  'Sin fila, manda la variable de entorno y luego el valor por defecto.';

-- ─── 5. Tokens por llamada ───────────────────────────────────
alter table public.task_events
  add column if not exists tokens_entrada integer not null default 0,
  add column if not exists tokens_salida  integer not null default 0;

do $tokens$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'task_events_tokens_validos') then
    alter table public.task_events
      add constraint task_events_tokens_validos
        check (tokens_entrada between 0 and 10000000 and tokens_salida between 0 and 10000000);
  end if;
end
$tokens$;

-- task_events se escribe por columna (0541): service_role suma las dos nuevas, nada más.
grant insert (tokens_entrada, tokens_salida) on public.task_events to service_role;

comment on column public.task_events.tokens_entrada is
  'SDD-0704 §7.4: tokens de entrada de la llamada (0 en los pasos sin modelo y en las filas anteriores a la 0570).';
comment on column public.task_events.tokens_salida is
  'SDD-0704 §7.4: tokens de salida de la llamada (0 en los pasos sin modelo y en las filas anteriores a la 0570).';

-- ─── 6. RLS y privilegios ────────────────────────────────────
alter table public.ia_catalogo_modelos enable row level security;
alter table public.ia_cuentas enable row level security;
alter table public.ia_modelos enable row level security;
alter table public.ia_topes enable row level security;

revoke all on public.ia_catalogo_modelos, public.ia_cuentas, public.ia_modelos, public.ia_topes
  from public, anon, authenticated;
grant select on public.ia_catalogo_modelos, public.ia_cuentas, public.ia_modelos, public.ia_topes to authenticated;
grant all on public.ia_catalogo_modelos, public.ia_cuentas, public.ia_modelos, public.ia_topes to service_role;

drop policy if exists ia_catalogo_lee_superadmin on public.ia_catalogo_modelos;
create policy ia_catalogo_lee_superadmin on public.ia_catalogo_modelos
  for select to authenticated using (public.is_platform_admin());
drop policy if exists ia_cuentas_lee_superadmin on public.ia_cuentas;
create policy ia_cuentas_lee_superadmin on public.ia_cuentas
  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());
drop policy if exists ia_modelos_lee_superadmin on public.ia_modelos;
create policy ia_modelos_lee_superadmin on public.ia_modelos
  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());
drop policy if exists ia_topes_lee_superadmin on public.ia_topes;
create policy ia_topes_lee_superadmin on public.ia_topes
  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());

drop policy if exists ia_catalogo_service_role on public.ia_catalogo_modelos;
create policy ia_catalogo_service_role on public.ia_catalogo_modelos for all to service_role using (true) with check (true);
drop policy if exists ia_cuentas_service_role on public.ia_cuentas;
create policy ia_cuentas_service_role on public.ia_cuentas for all to service_role using (true) with check (true);
drop policy if exists ia_modelos_service_role on public.ia_modelos;
create policy ia_modelos_service_role on public.ia_modelos for all to service_role using (true) with check (true);
drop policy if exists ia_topes_service_role on public.ia_topes;
create policy ia_topes_service_role on public.ia_topes for all to service_role using (true) with check (true);

-- ─── 7. Auditoría ────────────────────────────────────────────
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('ia_config', 'active', 'ia', 1, 'migration:0570')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(public.audit_entity_types.contract_version, excluded.contract_version);

-- ─── 8. Escritura desde la pantalla ──────────────────────────
-- Contexto común: sesión, superadministrador, tenant y motivo.
create or replace function public.ia_contexto_de_escritura(p_motivo text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'ia:sin_sesion' using errcode = '42501';
  end if;
  if not public.is_platform_admin() then
    raise exception 'ia:solo_superadmin' using errcode = '42501';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'ia:sin_tenant' using errcode = '42501';
  end if;
  if p_motivo is null or pg_catalog.btrim(p_motivo) <> p_motivo
     or pg_catalog.char_length(p_motivo) not between 4 and 200 then
    raise exception 'ia:motivo' using errcode = '22023';
  end if;
  return v_tenant;
end;
$function$;

-- LA BARRERA (D-5 de Sam, 2026-11-21: «Pantalla IA: opción A, pedir la contraseña otra vez; y abre después la SDD de
-- verificación en dos pasos»). Lo que afloja el freno exige AAL2 o una autenticación con contraseña de hace menos de
-- 5 minutos (claim amr del JWT, que la pantalla consigue pidiendo la contraseña otra vez). Devuelve el método, que va
-- a la auditoría: 'aal2', 'contrasena_reciente' o 'no_hace_falta'. Cuando el Studio tenga la verificación en dos
-- pasos, esta misma función ya acepta AAL2 sin otro cambio.
create or replace function public.ia_exigir_aal2_si(p_afloja boolean)
returns text
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_ahora numeric := extract(epoch from pg_catalog.now());
begin
  if p_afloja is not true then
    return 'no_hace_falta';
  end if;
  if coalesce(v_jwt ->> 'aal', '') = 'aal2' then
    return 'aal2';
  end if;
  if pg_catalog.jsonb_typeof(v_jwt -> 'amr') = 'array' and exists (
    select 1
      from pg_catalog.jsonb_array_elements(v_jwt -> 'amr') as a(e)
     where pg_catalog.jsonb_typeof(a.e) = 'object'
       and a.e ->> 'method' = 'password'
       and (a.e ->> 'timestamp') ~ '^[0-9]{1,12}$'
       and (a.e ->> 'timestamp')::numeric between v_ahora - 300 and v_ahora + 60
  ) then
    return 'contrasena_reciente';
  end if;
  raise exception 'ia:requiere_aal2' using errcode = '42501';
end;
$function$;

create or replace function public.ia_guardar_cuenta(
  p_id uuid,
  p_alias text,
  p_proveedor text,
  p_uso text,
  p_tipo_cobro text,
  p_tope_llamadas integer,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_antes public.ia_cuentas%rowtype;
  v_despues public.ia_cuentas%rowtype;
  v_afloja boolean;
  v_metodo text;
begin
  if p_id is null then
    -- Alta: plan fijo deja de sumar USD → afloja.
    v_afloja := p_tipo_cobro = 'plan_fijo';
    v_metodo := public.ia_exigir_aal2_si(v_afloja);
    insert into public.ia_cuentas (tenant_id, alias, proveedor, uso, tipo_cobro, tope_llamadas_mes, actualizado_por)
    values (v_tenant, p_alias, p_proveedor, p_uso, p_tipo_cobro, p_tope_llamadas, v_uid)
    returning * into v_despues;
  else
    select * into v_antes from public.ia_cuentas c where c.id = p_id and c.tenant_id = v_tenant for update;
    if not found then
      raise exception 'ia:cuenta_inexistente' using errcode = '22023';
    end if;
    v_afloja :=
      (v_antes.tipo_cobro = 'por_token' and p_tipo_cobro = 'plan_fijo')
      or (v_antes.tope_llamadas_mes is not null and p_tope_llamadas is null)
      or (v_antes.tope_llamadas_mes is not null and p_tope_llamadas > v_antes.tope_llamadas_mes);
    v_metodo := public.ia_exigir_aal2_si(v_afloja);
    update public.ia_cuentas
       set alias = p_alias, proveedor = p_proveedor, uso = p_uso, tipo_cobro = p_tipo_cobro,
           tope_llamadas_mes = p_tope_llamadas, actualizado_en = pg_catalog.now(), actualizado_por = v_uid
     where id = p_id
    returning * into v_despues;
  end if;

  perform public.append_audit_event(
    v_tenant, 'ia_config', v_despues.id, 'user', v_uid, 'ia_cuenta_guardada', 'studio', 'succeeded', p_motivo,
    case when p_id is null then null else pg_catalog.jsonb_build_object(
      'alias', v_antes.alias, 'proveedor', v_antes.proveedor, 'uso', v_antes.uso,
      'tipo_cobro', v_antes.tipo_cobro, 'tope_llamadas_mes', v_antes.tope_llamadas_mes) end,
    pg_catalog.jsonb_build_object(
      'alias', v_despues.alias, 'proveedor', v_despues.proveedor, 'uso', v_despues.uso,
      'tipo_cobro', v_despues.tipo_cobro, 'tope_llamadas_mes', v_despues.tope_llamadas_mes),
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', v_afloja, 'metodo', v_metodo),
    null, 1, 'internal');
  return v_despues.id;
end;
$function$;

create or replace function public.ia_guardar_modelo(
  p_cuenta_id uuid,
  p_modelo text,
  p_tarifa_entrada numeric,
  p_tarifa_salida numeric,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_cuenta public.ia_cuentas%rowtype;
  v_antes public.ia_modelos%rowtype;
  v_despues public.ia_modelos%rowtype;
  v_max_entrada numeric;
  v_max_salida numeric;
  v_afloja boolean := false;
  v_metodo text;
begin
  select * into v_cuenta from public.ia_cuentas c where c.id = p_cuenta_id and c.tenant_id = v_tenant for update;
  if not found then
    raise exception 'ia:cuenta_inexistente' using errcode = '22023';
  end if;
  select * into v_antes from public.ia_modelos m where m.cuenta_id = p_cuenta_id and m.modelo = p_modelo for update;

  if v_cuenta.tipo_cobro = 'por_token' then
    if found then
      -- Cambio de tarifa: bajarla afloja.
      v_afloja := p_tarifa_entrada < v_antes.tarifa_entrada_usd_mtok or p_tarifa_salida < v_antes.tarifa_salida_usd_mtok;
    else
      -- Alta: el valor efectivo previo es la mayor tarifa declarada de la cuenta (la que se le
      -- aplicaría a un modelo sin tarifa, §7.2). Sin ninguna, el previo es el .env, que la base no
      -- conoce: se exige AAL2 siempre (más estricto, nunca menos).
      select pg_catalog.max(m.tarifa_entrada_usd_mtok), pg_catalog.max(m.tarifa_salida_usd_mtok)
        into v_max_entrada, v_max_salida
        from public.ia_modelos m where m.cuenta_id = p_cuenta_id;
      v_afloja := v_max_entrada is null
                  or p_tarifa_entrada < v_max_entrada or p_tarifa_salida < v_max_salida;
    end if;
  end if;
  v_metodo := public.ia_exigir_aal2_si(coalesce(v_afloja, true));

  if v_antes.id is null then
    insert into public.ia_modelos (tenant_id, cuenta_id, proveedor, modelo, tarifa_entrada_usd_mtok,
                                   tarifa_salida_usd_mtok, actualizado_por)
    values (v_tenant, p_cuenta_id, v_cuenta.proveedor, p_modelo, p_tarifa_entrada, p_tarifa_salida, v_uid)
    returning * into v_despues;
  else
    update public.ia_modelos
       set tarifa_entrada_usd_mtok = p_tarifa_entrada, tarifa_salida_usd_mtok = p_tarifa_salida,
           vigente_desde = pg_catalog.now(), actualizado_por = v_uid
     where id = v_antes.id
    returning * into v_despues;
  end if;

  perform public.append_audit_event(
    v_tenant, 'ia_config', v_despues.id, 'user', v_uid, 'ia_modelo_guardado', 'studio', 'succeeded', p_motivo,
    case when v_antes.id is null then null else pg_catalog.jsonb_build_object(
      'modelo', v_antes.modelo, 'tarifa_entrada', v_antes.tarifa_entrada_usd_mtok,
      'tarifa_salida', v_antes.tarifa_salida_usd_mtok) end,
    pg_catalog.jsonb_build_object(
      'cuenta_id', v_despues.cuenta_id, 'proveedor', v_despues.proveedor, 'modelo', v_despues.modelo,
      'tarifa_entrada', v_despues.tarifa_entrada_usd_mtok, 'tarifa_salida', v_despues.tarifa_salida_usd_mtok),
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', coalesce(v_afloja, true), 'metodo', v_metodo),
    null, 1, 'internal');
  return v_despues.id;
end;
$function$;

create or replace function public.ia_borrar_modelo(p_id uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_antes public.ia_modelos%rowtype;
  v_metodo text;
begin
  select * into v_antes from public.ia_modelos m where m.id = p_id and m.tenant_id = v_tenant for update;
  if not found then
    return false;
  end if;
  -- Borrar una tarifa cambia el valor efectivo (pasa a la más alta declarada o al .env): afloja.
  v_metodo := public.ia_exigir_aal2_si(v_antes.tarifa_entrada_usd_mtok is not null);
  delete from public.ia_modelos where id = p_id;
  perform public.append_audit_event(
    v_tenant, 'ia_config', p_id, 'user', v_uid, 'ia_modelo_quitado', 'studio', 'succeeded', p_motivo,
    pg_catalog.jsonb_build_object(
      'cuenta_id', v_antes.cuenta_id, 'proveedor', v_antes.proveedor, 'modelo', v_antes.modelo,
      'tarifa_entrada', v_antes.tarifa_entrada_usd_mtok, 'tarifa_salida', v_antes.tarifa_salida_usd_mtok),
    null,
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', v_antes.tarifa_entrada_usd_mtok is not null, 'metodo', v_metodo),
    null, 1, 'internal');
  return true;
end;
$function$;

create or replace function public.ia_guardar_tope(p_funcion text, p_tope_usd numeric, p_motivo text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_antes numeric;
  v_id uuid;
  v_afloja boolean;
  v_metodo text;
begin
  select t.tope_usd into v_antes from public.ia_topes t
   where t.tenant_id = v_tenant and t.funcion = p_funcion for update;
  -- Sin fila, el previo es el .env, que la base no conoce: AAL2 siempre.
  v_afloja := v_antes is null or p_tope_usd > v_antes;
  v_metodo := public.ia_exigir_aal2_si(v_afloja);
  insert into public.ia_topes (tenant_id, funcion, tope_usd, actualizado_por)
  values (v_tenant, p_funcion, p_tope_usd, v_uid)
  on conflict (tenant_id, funcion) do update
    set tope_usd = excluded.tope_usd, actualizado_en = pg_catalog.now(), actualizado_por = excluded.actualizado_por
  returning id into v_id;
  perform public.append_audit_event(
    v_tenant, 'ia_config', v_id, 'user', v_uid, 'ia_tope_guardado', 'studio', 'succeeded', p_motivo,
    case when v_antes is null then null else pg_catalog.jsonb_build_object('funcion', p_funcion, 'tope_usd', v_antes) end,
    pg_catalog.jsonb_build_object('funcion', p_funcion, 'tope_usd', p_tope_usd),
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', v_afloja, 'metodo', v_metodo),
    null, 1, 'internal');
  return p_tope_usd;
end;
$function$;

create or replace function public.ia_borrar_tope(p_funcion text, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);
  v_uid uuid := auth.uid();
  v_antes numeric;
  v_id uuid;
  v_metodo text;
begin
  select t.tope_usd, t.id into v_antes, v_id from public.ia_topes t
   where t.tenant_id = v_tenant and t.funcion = p_funcion for update;
  if v_antes is null then
    return false;
  end if;
  -- Volver al .env puede subir el tope: afloja.
  v_metodo := public.ia_exigir_aal2_si(true);
  delete from public.ia_topes where id = v_id;
  perform public.append_audit_event(
    v_tenant, 'ia_config', v_id, 'user', v_uid, 'ia_tope_quitado', 'studio', 'succeeded', p_motivo,
    pg_catalog.jsonb_build_object('funcion', p_funcion, 'tope_usd', v_antes), null,
    pg_catalog.jsonb_build_object('sdd', '0704', 'afloja', true, 'metodo', v_metodo),
    null, 1, 'internal');
  return true;
end;
$function$;

-- ─── 9. Lectura del despachador (service_role) ───────────────
create or replace function public.ia_costo_oficina()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case when c.id is null and t.tope_usd is null then null else pg_catalog.jsonb_build_object(
    'version', 1,
    'tope_usd', t.tope_usd,
    'cuenta', case when c.id is null then null else pg_catalog.jsonb_build_object(
      'tipo_cobro', c.tipo_cobro, 'tope_llamadas_mes', c.tope_llamadas_mes) end,
    'modelos', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'proveedor', m.proveedor, 'modelo', m.modelo,
               'entrada', m.tarifa_entrada_usd_mtok, 'salida', m.tarifa_salida_usd_mtok) order by m.modelo)
        from public.ia_modelos m where m.cuenta_id = c.id), '[]'::jsonb)
  ) end
  from (select 1) as uno
  left join public.ia_cuentas c on c.uso = 'oficina'
  left join public.ia_topes t on t.funcion = 'oficina';
$function$;

create or replace function public.ia_oficina_llamadas_del_mes()
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.count(*)::integer
    from public.task_events ev
   where ev.tipo = 'modelo.respuesta'
     and ev.ts >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC';
$function$;

create or replace function public.ia_oficina_autopausar_por_llamadas(p_tope integer, p_umbral numeric default 0.8)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_llamadas integer;
begin
  if p_tope is null or p_tope < 1 or p_tope > 1000000 then
    raise exception 'ia_oficina_autopausar_por_llamadas: el tope va de 1 a 1000000' using errcode = '22023';
  end if;
  if p_umbral is null or p_umbral <= 0 or p_umbral > 1 then
    raise exception 'ia_oficina_autopausar_por_llamadas: el umbral va de 0 a 1' using errcode = '22023';
  end if;
  v_llamadas := public.ia_oficina_llamadas_del_mes();
  if v_llamadas < p_tope * p_umbral then
    return false;
  end if;
  lock table public.office_paused in share row exclusive mode;
  -- SOLO PAUSA, como office_autopausar_por_tope; despausar es de office_cambiar_pausa.
  if not public.office_esta_pausada() then
    insert into public.office_paused (pausada, cambiado_por, motivo)
    values (true, null,
            'Auto-pausa: las llamadas del mes (' || v_llamadas || ') llegaron al '
            || pg_catalog.round(p_umbral * 100) || ' % del tope del plan fijo (' || p_tope || '). SDD-0704 §7.5.');
  end if;
  return true;
end;
$function$;

-- ─── 10. Gasto del mes para la pantalla ──────────────────────
create or replace function public.ia_gasto_del_mes()
returns table (funcion text, modelo text, llamadas integer, tokens_entrada bigint, tokens_salida bigint, costo_usd numeric)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'ia:solo_superadmin' using errcode = '42501';
  end if;
  return query
    select 'oficina'::text,
           coalesce(ev.modelo_usado, 'no consta'),
           pg_catalog.count(*)::integer,
           pg_catalog.sum(ev.tokens_entrada)::bigint,
           pg_catalog.sum(ev.tokens_salida)::bigint,
           pg_catalog.sum(ev.costo_usd)::numeric
      from public.task_events ev
     where ev.tipo = 'modelo.respuesta'
       and ev.ts >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC'
     group by 2
     order by 2;
end;
$function$;

-- ─── 11. Dueño y privilegios de las funciones ────────────────
do $funciones$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.ia_modelos_coherente()',
    'public.ia_cuentas_coherente()',
    'public.ia_contexto_de_escritura(text)',
    'public.ia_exigir_aal2_si(boolean)',
    'public.ia_guardar_cuenta(uuid, text, text, text, text, integer, text)',
    'public.ia_guardar_modelo(uuid, text, numeric, numeric, text)',
    'public.ia_borrar_modelo(uuid, text)',
    'public.ia_guardar_tope(text, numeric, text)',
    'public.ia_borrar_tope(text, text)',
    'public.ia_costo_oficina()',
    'public.ia_oficina_llamadas_del_mes()',
    'public.ia_oficina_autopausar_por_llamadas(integer, numeric)',
    'public.ia_gasto_del_mes()'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_firma);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_firma);
  end loop;
  -- La pantalla (sesión del superadministrador).
  foreach v_firma in array array[
    'public.ia_guardar_cuenta(uuid, text, text, text, text, integer, text)',
    'public.ia_guardar_modelo(uuid, text, numeric, numeric, text)',
    'public.ia_borrar_modelo(uuid, text)',
    'public.ia_guardar_tope(text, numeric, text)',
    'public.ia_borrar_tope(text, text)',
    'public.ia_gasto_del_mes()'
  ] loop
    execute pg_catalog.format('grant execute on function %s to authenticated', v_firma);
  end loop;
  -- El despachador.
  foreach v_firma in array array[
    'public.ia_costo_oficina()',
    'public.ia_oficina_llamadas_del_mes()',
    'public.ia_oficina_autopausar_por_llamadas(integer, numeric)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to service_role', v_firma);
  end loop;
end
$funciones$;

comment on function public.ia_guardar_tope(text, numeric, text) is
  'SDD-0704 §7.3 y §8: guarda el tope del mes de una función. Solo superadmin, con motivo. Subirlo (o la '
  'primera fila, cuyo previo es el .env) exige AAL2. Audita antes y después.';
comment on function public.ia_costo_oficina() is
  'SDD-0704 §7: configuración de costo de la Oficina para el despachador (service_role), o null sin configuración.';
comment on function public.ia_oficina_autopausar_por_llamadas(integer, numeric) is
  'SDD-0704 §7.5: si las llamadas del mes llegan al umbral del tope del plan fijo, pausa la oficina. SOLO PAUSA.';
