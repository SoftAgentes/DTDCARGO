-- ─────────────────────────────────────────────────────────────────────────────
-- 0550 · SDD-0637 fase 2 — Faro, el asistente de ayuda del Studio: dónde se
-- guarda lo que se le pregunta.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General; en staging, el OK de Sam
--    con aviso previo al DG. Fusionar la PR NO autoriza aplicarla.
--    REQUIERE tenants, user_tenants, get_user_tenant_id(), is_tenant_admin() y el
--    enum bug_notif_type: su preflight para si falta alguno.
--    Ningún código del Studio la usa todavía (la fase 3 la conecta).
--
-- Diseño: docs/specs/0637-faro-asistente-ayuda/spec.md §6.4 y la revisión de
-- datos docs/specs/0637-faro-asistente-ayuda/privacidad.md (E-1, E-3, E-5, E-6,
-- E-7). Plazos aprobados por Sam el 2026-11-16 (D-6).
--
-- ── Qué crea ────────────────────────────────────────────────
-- Tres finalidades, cada una con su plazo:
-- AUDITORÍA (180 días, se borran las filas completas)
--   · asistente_conversaciones: quién abrió la conversación y cuándo.
--   · asistente_mensajes: la pregunta (ya depurada por el servidor) y la
--     respuesta final, con el resultado y las versiones del contenido.
-- MEJORA DEL CONOCIMIENTO Y SEGURIDAD
--   · asistente_eventos: feedback, rectificación y fallo (180 días); alerta y
--     alerta revisada (2 años). Sin texto libre: códigos cortos.
--   · asistente_lecturas: cada vez que un administrador abre una conversación
--     ajena (2 años).
-- COSTO Y OPERACIÓN
--   · asistente_llamadas: una fila por intento a la IA, sin texto ni usuario
--     (13 meses). De aquí sale el gasto del mes (D-8).
--   · asistente_cuotas: preguntas por persona y hora (7 días).
--   · asistente_purgas: constancia de cada purga, sin usuarios, actores ni
--     textos: el motivo es un código de una lista cerrada.
--
-- Todas: RLS activa y SIN policies (ni anon ni authenticated las alcanzan
-- directo); service_role lee e inserta; NADIE tiene UPDATE, DELETE ni TRUNCATE.
-- Esa es la barrera. El trigger asistente_solo_insercion() es una segunda capa:
-- frena también al dueño, y solo deja pasar el DELETE que hacen las funciones de
-- purga (E-1).
--
-- Funciones (search_path vacío):
--   · asistente_reservar_pregunta(tenant, usuario, tope) → boolean · service_role
--   · asistente_gasto_del_mes(tenant) → numeric · service_role
--   · asistente_purgar_vencidos() → jsonb · service_role (la corre un cron)
--   · asistente_purgar_usuario(tenant, usuario, actor, motivo_codigo) → jsonb ·
--     service_role; el actor tiene que ser admin activo del tenant
--   · asistente_listar_conversaciones(límite, antes) · authenticated, solo admin
--     del tenant; sin textos
--   · asistente_leer_conversacion(id) · authenticated, solo admin del tenant;
--     registra la lectura (E-7)
-- Y el valor nuevo 'asistente_alerta' en el enum bug_notif_type.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna tabla, función, policy ni grant existente. Solo agrega un valor al
-- enum bug_notif_type (no se puede quitar: ver el desarme).
--
-- ── Locks ───────────────────────────────────────────────────
-- Tablas nuevas y vacías. ALTER TYPE ... ADD VALUE toma un lock breve sobre el
-- tipo. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0550_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde todo lo guardado por Faro. El valor del enum queda.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.user_tenants') is null then
    raise exception '0550 requiere public.tenants y public.user_tenants';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null then
    raise exception '0550 requiere get_user_tenant_id() e is_tenant_admin()';
  end if;
  if pg_catalog.to_regtype('public.bug_notif_type') is null then
    raise exception '0550 requiere el enum bug_notif_type (0028)';
  end if;
end;
$preflight$;

-- ─── 0. La alerta de Faro en la campana ─────────────────────────────────────
alter type public.bug_notif_type add value if not exists 'asistente_alerta';

-- ─── 1. Solo inserción ──────────────────────────────────────────────────────
-- Rechaza UPDATE siempre, y DELETE/TRUNCATE salvo dentro de una función de purga,
-- que antes hace `set_config('asistente.purga', 'on', true)`. La barrera es el
-- privilegio: nadie tiene DELETE sobre estas tablas salvo el dueño, que es quien
-- ejecuta las funciones SECURITY DEFINER. Este trigger es la segunda capa, para el
-- dueño: la bandera la puede poner cualquier sesión, así que sola no protege nada.
create or replace function public.asistente_solo_insercion()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Faro: % es de solo inserción; no se edita', tg_table_name
      using errcode = '42501';
  end if;
  if coalesce(pg_catalog.current_setting('asistente.purga', true), '') <> 'on' then
    raise exception 'Faro: % solo se borra con la purga programada o a pedido', tg_table_name
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return null;
end;
$fn$;

revoke all on function public.asistente_solo_insercion() from public, anon, authenticated, service_role;

-- ─── 2. Tablas ──────────────────────────────────────────────────────────────
-- La FK a tenants no lleva ON DELETE CASCADE a propósito: borrar un tenant con datos de Faro
-- falla con un error de FK en vez de chocar contra el trigger de solo inserción.
create table if not exists public.asistente_conversaciones (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id),
  usuario_id          uuid not null,
  creada_at           timestamptz not null default now(),
  politica_retencion  text not null default 'd6-2026-11-16',
  constraint asistente_conversaciones_tenant_id_key unique (tenant_id, id)
);
comment on table public.asistente_conversaciones is
  'SDD-0637 Faro · una conversación con el asistente. Se borra a los 180 días (D-6) con asistente_purgar_vencidos(), o a pedido con asistente_purgar_usuario(). Solo inserción.';
comment on column public.asistente_conversaciones.usuario_id is
  'Quien preguntó (auth.users.id). Sin FK a propósito: si la cuenta se borra, la conversación sigue hasta su plazo y luego se purga.';

create index if not exists asistente_conversaciones_tenant_creada_idx
  on public.asistente_conversaciones (tenant_id, creada_at desc);
create index if not exists asistente_conversaciones_usuario_idx
  on public.asistente_conversaciones (tenant_id, usuario_id);

create table if not exists public.asistente_mensajes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  conversacion_id       uuid not null,
  solicitud_id          uuid not null,
  orden                 integer not null check (orden >= 1),
  tipo                  text not null check (tipo in ('usuario', 'asistente')),
  creado_at             timestamptz not null default now(),
  texto                 text not null check (pg_catalog.char_length(texto) between 1 and 8000),
  pantalla_id           text check (pantalla_id is null or pg_catalog.char_length(pantalla_id) <= 120),
  resultado             text check (resultado is null or resultado in (
                          'respondida', 'sin_acceso', 'reservada', 'inexistente', 'sin_guia', 'fuera_de_tema',
                          'error', 'tope_usuario', 'tope_gasto')),
  motivo_decision       text check (motivo_decision is null or pg_catalog.char_length(motivo_decision) <= 120),
  referencias_contenido jsonb not null default '[]'::jsonb check (jsonb_typeof(referencias_contenido) = 'array'),
  version_contenido     text,
  version_prompt        text,
  version_verificador   text,
  requisitos_contexto   jsonb not null default '[]'::jsonb check (jsonb_typeof(requisitos_contexto) = 'array'),
  constraint asistente_mensajes_resultado_solo_asistente
    check (tipo = 'asistente' or resultado is null),
  constraint asistente_mensajes_conversacion_fk
    foreign key (tenant_id, conversacion_id)
    references public.asistente_conversaciones (tenant_id, id) on delete cascade,
  constraint asistente_mensajes_orden_key unique (conversacion_id, orden),
  constraint asistente_mensajes_solicitud_key unique (conversacion_id, solicitud_id, tipo)
);
comment on table public.asistente_mensajes is
  'SDD-0637 Faro · pregunta (depurada por el servidor antes de guardarla, privacidad.md E-3) y respuesta final. Vive lo que vive su conversación. Solo inserción.';

create index if not exists asistente_mensajes_tenant_creado_idx
  on public.asistente_mensajes (tenant_id, creado_at desc);

create table if not exists public.asistente_eventos (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id),
  conversacion_id  uuid,
  mensaje_id       uuid,
  creado_at        timestamptz not null default now(),
  tipo             text not null check (tipo in ('feedback', 'rectificacion', 'fallo', 'alerta', 'alerta_revisada')),
  usuario_id       uuid,
  actor_id         uuid,
  codigo           text not null check (pg_catalog.char_length(codigo) between 1 and 60),
  valor            text check (valor is null or pg_catalog.char_length(valor) <= 120),
  version_regla    text check (version_regla is null or pg_catalog.char_length(version_regla) <= 40),
  constraint asistente_eventos_alerta_con_regla
    check (tipo not in ('alerta') or version_regla is not null)
);
comment on table public.asistente_eventos is
  'SDD-0637 Faro · feedback, rectificación y fallo (180 días); alerta y alerta revisada (2 años, sin texto de la pregunta: privacidad.md E-6). Sin FK a la conversación a propósito: la alerta sobrevive a la purga de su conversación. Solo inserción.';

create index if not exists asistente_eventos_tenant_tipo_idx
  on public.asistente_eventos (tenant_id, tipo, creado_at desc);
create index if not exists asistente_eventos_conversacion_idx
  on public.asistente_eventos (conversacion_id);

create table if not exists public.asistente_lecturas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id),
  lector_id        uuid not null,
  conversacion_id  uuid not null,
  leida_at         timestamptz not null default now()
);
comment on table public.asistente_lecturas is
  'SDD-0637 Faro · un administrador abrió una conversación ajena (privacidad.md E-7). 2 años. Solo la escribe asistente_leer_conversacion(). Solo inserción.';

create index if not exists asistente_lecturas_tenant_idx
  on public.asistente_lecturas (tenant_id, leida_at desc);

create table if not exists public.asistente_llamadas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id),
  solicitud_id    uuid not null,
  intento         smallint not null check (intento between 1 and 10),
  iniciada_at     timestamptz not null default now(),
  duracion_ms     integer check (duracion_ms is null or duracion_ms >= 0),
  motor           text not null check (motor in ('principal', 'respaldo', 'simulado')),
  proveedor       text not null check (pg_catalog.char_length(proveedor) between 1 and 40),
  modelo          text not null check (pg_catalog.char_length(modelo) between 1 and 120),
  estado          text not null check (estado in ('ok', 'error', 'tiempo', 'ficha_invalida')),
  error_codigo    text check (error_codigo is null or pg_catalog.char_length(error_codigo) <= 60),
  tokens_entrada  integer check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_salida   integer check (tokens_salida is null or tokens_salida >= 0),
  costo_usd       numeric(12, 6) check (costo_usd is null or costo_usd >= 0)
);
comment on table public.asistente_llamadas is
  'SDD-0637 Faro · una fila por intento a la IA, sin texto ni usuario. 13 meses. El gasto del mes (D-8) se suma de aquí, fallos y respaldo incluidos. costo_usd nulo = desconocido, no cero. Solo inserción.';

create index if not exists asistente_llamadas_tenant_iniciada_idx
  on public.asistente_llamadas (tenant_id, iniciada_at desc);

create table if not exists public.asistente_cuotas (
  tenant_id       uuid not null references public.tenants(id),
  usuario_id      uuid not null,
  inicio_ventana  timestamptz not null,
  consumido       integer not null default 0 check (consumido >= 0),
  primary key (tenant_id, usuario_id, inicio_ventana)
);
comment on table public.asistente_cuotas is
  'SDD-0637 Faro · preguntas por persona en cada hora (D-5). Solo la toca asistente_reservar_pregunta(). Se borra a los 7 días.';

create table if not exists public.asistente_purgas (
  id             uuid primary key default gen_random_uuid(),
  ejecutada_at   timestamptz not null default now(),
  motivo         text not null check (motivo in ('plazo', 'pedido')),
  motivo_codigo  text,
  tenant_id      uuid,
  conteos        jsonb not null check (jsonb_typeof(conteos) = 'object'),
  -- Lista cerrada, sin texto libre: la constancia no lleva datos personales (privacidad.md §2).
  constraint asistente_purgas_motivo_codigo check (
    (motivo = 'plazo' and motivo_codigo is null)
    or (motivo = 'pedido'
        and motivo_codigo in ('pedido_titular', 'baja_personal', 'orden_legal', 'registro_erroneo')))
);
comment on table public.asistente_purgas is
  'SDD-0637 Faro · constancia de cada purga: cuándo, por qué (código de una lista cerrada) y cuántas filas por tabla. Sin usuarios, actores ni textos. Quién pidió una purga a pedido lo registra el servidor en la auditoría general. Solo inserción y sin plazo.';

-- ─── 3. Triggers de solo inserción ──────────────────────────────────────────
do $triggers$
declare
  t text;
begin
  foreach t in array array['asistente_conversaciones', 'asistente_mensajes', 'asistente_eventos',
                           'asistente_lecturas', 'asistente_llamadas', 'asistente_purgas'] loop
    execute pg_catalog.format('drop trigger if exists %I on public.%I', t || '_solo_insercion', t);
    execute pg_catalog.format(
      'create trigger %I before update or delete on public.%I for each row execute function public.asistente_solo_insercion()',
      t || '_solo_insercion', t);
    execute pg_catalog.format('drop trigger if exists %I on public.%I', t || '_sin_truncate', t);
    execute pg_catalog.format(
      'create trigger %I before truncate on public.%I for each statement execute function public.asistente_solo_insercion()',
      t || '_sin_truncate', t);
  end loop;
end;
$triggers$;

-- ─── 4. RLS y privilegios ───────────────────────────────────────────────────
do $privilegios$
declare
  t text;
begin
  foreach t in array array['asistente_conversaciones', 'asistente_mensajes', 'asistente_eventos',
                           'asistente_lecturas', 'asistente_llamadas', 'asistente_cuotas', 'asistente_purgas'] loop
    execute pg_catalog.format('alter table public.%I enable row level security', t);
    execute pg_catalog.format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
  -- service_role: lee e inserta en las de solo inserción; nada de UPDATE, DELETE ni TRUNCATE.
  foreach t in array array['asistente_conversaciones', 'asistente_mensajes', 'asistente_eventos',
                           'asistente_llamadas'] loop
    execute pg_catalog.format('grant select, insert on table public.%I to service_role', t);
  end loop;
  -- Las lecturas y las purgas solo las escriben sus funciones; service_role las puede leer.
  grant select on table public.asistente_lecturas, public.asistente_purgas to service_role;
  -- Las cuotas solo las toca asistente_reservar_pregunta().
  grant select on table public.asistente_cuotas to service_role;
end;
$privilegios$;

-- ─── 5. Tope de preguntas por persona y hora (D-5) ──────────────────────────
-- Atómica: suma uno solo si queda cupo en la hora en curso. El tope lo pasa el
-- servidor (D-5: 30, configurable), no está fijo aquí.
create or replace function public.asistente_reservar_pregunta(p_tenant uuid, p_usuario uuid, p_tope integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ventana timestamptz := pg_catalog.date_trunc('hour', pg_catalog.now());
  v_ok boolean;
begin
  if p_tenant is null or p_usuario is null or p_tope is null or p_tope < 1 then
    raise exception 'asistente_reservar_pregunta: tenant, usuario y un tope >= 1 son obligatorios'
      using errcode = '22023';
  end if;
  insert into public.asistente_cuotas as c (tenant_id, usuario_id, inicio_ventana, consumido)
  values (p_tenant, p_usuario, v_ventana, 1)
  on conflict (tenant_id, usuario_id, inicio_ventana)
    do update set consumido = c.consumido + 1
    where c.consumido < p_tope
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$fn$;

-- ─── 6. Gasto del mes (D-8) ─────────────────────────────────────────────────
create or replace function public.asistente_gasto_del_mes(p_tenant uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(pg_catalog.sum(l.costo_usd), 0)::numeric
    from public.asistente_llamadas l
   where l.tenant_id = p_tenant
     and l.iniciada_at >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC';
$fn$;

-- ─── 7. Purga por plazo (D-6) ───────────────────────────────────────────────
-- 180 días: conversaciones (con sus mensajes) y los eventos que no son alertas.
-- 2 años: alertas, alertas revisadas y lecturas. 13 meses: llamadas. 7 días: cuotas.
-- Borra filas completas: el dato personal está en el texto (privacidad.md E-1).
create or replace function public.asistente_purgar_vencidos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ahora timestamptz := pg_catalog.now();
  n_conv integer; n_msj integer; n_ev integer; n_al integer; n_lec integer; n_lla integer; n_cuo integer;
  v_conteos jsonb;
begin
  perform pg_catalog.set_config('asistente.purga', 'on', true);

  select pg_catalog.count(*) into n_msj
    from public.asistente_mensajes m
    join public.asistente_conversaciones c on c.tenant_id = m.tenant_id and c.id = m.conversacion_id
   where c.creada_at < v_ahora - interval '180 days';
  delete from public.asistente_conversaciones where creada_at < v_ahora - interval '180 days';
  get diagnostics n_conv = row_count;

  delete from public.asistente_eventos
   where tipo in ('feedback', 'rectificacion', 'fallo') and creado_at < v_ahora - interval '180 days';
  get diagnostics n_ev = row_count;

  delete from public.asistente_eventos
   where tipo in ('alerta', 'alerta_revisada') and creado_at < v_ahora - interval '2 years';
  get diagnostics n_al = row_count;

  delete from public.asistente_lecturas where leida_at < v_ahora - interval '2 years';
  get diagnostics n_lec = row_count;

  delete from public.asistente_llamadas where iniciada_at < v_ahora - interval '13 months';
  get diagnostics n_lla = row_count;

  delete from public.asistente_cuotas where inicio_ventana < v_ahora - interval '7 days';
  get diagnostics n_cuo = row_count;

  v_conteos := pg_catalog.jsonb_build_object(
    'conversaciones', n_conv, 'mensajes', n_msj, 'eventos', n_ev, 'alertas', n_al,
    'lecturas', n_lec, 'llamadas', n_lla, 'cuotas', n_cuo);
  insert into public.asistente_purgas (motivo, conteos) values ('plazo', v_conteos);

  perform pg_catalog.set_config('asistente.purga', 'off', true);
  return v_conteos;
end;
$fn$;

-- ─── 8. Purga a pedido de una persona (privacidad.md E-5) ───────────────────
-- Borra, en ese tenant, sus conversaciones (con mensajes), sus eventos no-alerta
-- (de esas conversaciones o a su nombre) y sus cuotas. Las alertas se quedan su
-- plazo (seguridad). Exige que el actor sea administrador activo del tenant y un
-- motivo de la lista cerrada; el actor no se guarda aquí (privacidad.md §2).
create or replace function public.asistente_purgar_usuario(
  p_tenant uuid, p_usuario uuid, p_actor uuid, p_motivo_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  n_conv integer; n_msj integer; n_ev integer; n_cuo integer;
  v_conteos jsonb;
begin
  if p_tenant is null or p_usuario is null or p_actor is null then
    raise exception 'asistente_purgar_usuario: tenant, usuario y actor son obligatorios' using errcode = '22023';
  end if;
  if p_motivo_codigo is null
     or p_motivo_codigo not in ('pedido_titular', 'baja_personal', 'orden_legal', 'registro_erroneo') then
    raise exception 'asistente_purgar_usuario: motivo fuera de la lista cerrada' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_tenants ut
                  where ut.user_id = p_actor and ut.tenant_id = p_tenant
                    and ut.role = 'admin' and ut.disabled_at is null) then
    raise exception 'asistente_purgar_usuario: el actor no es administrador activo del tenant' using errcode = '42501';
  end if;

  perform pg_catalog.set_config('asistente.purga', 'on', true);

  delete from public.asistente_eventos e
   where e.tenant_id = p_tenant
     and e.tipo in ('feedback', 'rectificacion', 'fallo')
     and (e.usuario_id = p_usuario
          or e.conversacion_id in (select c.id from public.asistente_conversaciones c
                                    where c.tenant_id = p_tenant and c.usuario_id = p_usuario));
  get diagnostics n_ev = row_count;

  select pg_catalog.count(*) into n_msj
    from public.asistente_mensajes m
    join public.asistente_conversaciones c on c.tenant_id = m.tenant_id and c.id = m.conversacion_id
   where c.tenant_id = p_tenant and c.usuario_id = p_usuario;
  delete from public.asistente_conversaciones dc
   where dc.tenant_id = p_tenant
     and dc.usuario_id = p_usuario;
  get diagnostics n_conv = row_count;

  delete from public.asistente_cuotas q where q.tenant_id = p_tenant and q.usuario_id = p_usuario;
  get diagnostics n_cuo = row_count;

  v_conteos := pg_catalog.jsonb_build_object(
    'conversaciones', n_conv, 'mensajes', n_msj, 'eventos', n_ev, 'cuotas', n_cuo);
  insert into public.asistente_purgas (motivo, motivo_codigo, tenant_id, conteos)
  values ('pedido', p_motivo_codigo, p_tenant, v_conteos);

  perform pg_catalog.set_config('asistente.purga', 'off', true);
  return v_conteos;
end;
$fn$;

-- ─── 9. Lectura para el administrador del tenant (D-4) ──────────────────────
-- La lista no trae textos; abrir una conversación sí, y queda registrado.
create or replace function public.asistente_listar_conversaciones(p_limite integer default 50, p_antes timestamptz default null)
returns table (id uuid, usuario_id uuid, creada_at timestamptz, mensajes integer, ultimo_resultado text)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_tenant uuid := public.get_user_tenant_id();
begin
  if v_tenant is null or not public.is_tenant_admin() then
    raise exception 'Solo el administrador del tenant lee las conversaciones de Faro' using errcode = '42501';
  end if;
  return query
    select c.id, c.usuario_id, c.creada_at,
           (select pg_catalog.count(*)::integer from public.asistente_mensajes m
             where m.tenant_id = c.tenant_id and m.conversacion_id = c.id),
           (select m.resultado from public.asistente_mensajes m
             where m.tenant_id = c.tenant_id and m.conversacion_id = c.id and m.tipo = 'asistente'
             order by m.orden desc limit 1)
      from public.asistente_conversaciones c
     where c.tenant_id = v_tenant
       and (p_antes is null or c.creada_at < p_antes)
     order by c.creada_at desc
     limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$fn$;

create or replace function public.asistente_leer_conversacion(p_conversacion uuid)
returns table (orden integer, tipo text, creado_at timestamptz, texto text, resultado text, pantalla_id text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_lector uuid := auth.uid();
begin
  if v_tenant is null or v_lector is null or not public.is_tenant_admin() then
    raise exception 'Solo el administrador del tenant lee las conversaciones de Faro' using errcode = '42501';
  end if;
  if not exists (select 1 from public.asistente_conversaciones c
                  where c.tenant_id = v_tenant and c.id = p_conversacion) then
    raise exception 'Conversación no encontrada' using errcode = 'P0002';
  end if;
  insert into public.asistente_lecturas (tenant_id, lector_id, conversacion_id)
  values (v_tenant, v_lector, p_conversacion);
  return query
    select m.orden, m.tipo, m.creado_at, m.texto, m.resultado, m.pantalla_id
      from public.asistente_mensajes m
     where m.tenant_id = v_tenant and m.conversacion_id = p_conversacion
     order by m.orden;
end;
$fn$;

-- ─── 10. Quién ejecuta qué ──────────────────────────────────────────────────
revoke all on function public.asistente_reservar_pregunta(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.asistente_gasto_del_mes(uuid) from public, anon, authenticated;
revoke all on function public.asistente_purgar_vencidos() from public, anon, authenticated;
revoke all on function public.asistente_purgar_usuario(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.asistente_listar_conversaciones(integer, timestamptz) from public, anon, service_role;
revoke all on function public.asistente_leer_conversacion(uuid) from public, anon, service_role;

grant execute on function public.asistente_reservar_pregunta(uuid, uuid, integer) to service_role;
grant execute on function public.asistente_gasto_del_mes(uuid) to service_role;
grant execute on function public.asistente_purgar_vencidos() to service_role;
grant execute on function public.asistente_purgar_usuario(uuid, uuid, uuid, text) to service_role;
grant execute on function public.asistente_listar_conversaciones(integer, timestamptz) to authenticated;
grant execute on function public.asistente_leer_conversacion(uuid) to authenticated;

notify pgrst, 'reload schema';
