-- ─────────────────────────────────────────────────────────────
-- 0516 · SDD-0608 — Consulta de clientes desde Discord (`/cliente`).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    y pasar por el Director General (docs/runbooks/aplicar-migraciones-prod.md).
--    Va DESPUÉS de 0514 (SDD-0606, `user_profiles.discord_user_id`), aunque no
--    la necesita para aplicarse: el enlace de usuario lo lee el código.
--
-- ── Para qué ─────────────────────────────────────────────────
-- El equipo de Operación pregunta en Discord por un cliente con su nombre y
-- recibe, en privado, su código (Shipping Mark) y el enlace a la ficha del
-- Studio. Nada más. Esta migración da a esa ruta tres piezas:
--
--   1. `discord_consultas_clientes`: el registro de cada consulta (quién, cuándo,
--      qué buscó y cómo terminó). Sólo `service_role`; RLS sin policies.
--   2. `discord_consulta_registrar(...)`: anota la consulta y aplica el límite
--      por persona y minuto en el MISMO paso, con un candado por persona, para
--      que dos pedidos simultáneos no pasen los dos.
--   3. `discord_buscar_clientes(...)`: busca por nombre y devuelve SÓLO
--      `markbox` y `name`. La minimización vive en la base: la ruta no puede
--      pedir el teléfono aunque quisiera.
--
-- ── La búsqueda ──────────────────────────────────────────────
-- En SQL y no con `.ilike()` de PostgREST, porque PostgREST convierte `*` en
-- `%` sin forma de escaparlo. Acá `\`, `%` y `_` se escapan y `*` es literal.
-- Cada palabra del término tiene que aparecer en el nombre (en cualquier
-- orden), sin distinguir mayúsculas ni acentos (á→a, ñ→n). Un término sin
-- palabras de al menos 2 caracteres no devuelve nada (nunca «todos»).
--
-- ── Retención ────────────────────────────────────────────────
-- El término puede ser el nombre de una persona. Las filas de más de 180 días
-- se borran en cada registro (la tabla es chica: decenas de consultas al día).
--
-- ── Qué toca ─────────────────────────────────────────────────
-- Una tabla nueva con sus índices y dos funciones nuevas. Sin cambios de filas
-- en tablas existentes, ni de RLS o grants de otras tablas. Locks: los de crear
-- objetos nuevos.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null then
    raise exception '0516: falta public.tenants';
  end if;
  if pg_catalog.to_regclass('public.clients') is null then
    raise exception '0516: falta public.clients';
  end if;
  if pg_catalog.to_regclass('auth.users') is null then
    raise exception '0516: falta auth.users';
  end if;
  -- Si ya existe una tabla con este nombre y no tiene la forma de esta
  -- migración, parar: no es la nuestra.
  if pg_catalog.to_regclass('public.discord_consultas_clientes') is not null
     and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'discord_consultas_clientes'
          and column_name = 'resultado'
     ) then
    raise exception '0516: public.discord_consultas_clientes ya existe con otra forma';
  end if;
end
$preflight$;

create table if not exists public.discord_consultas_clientes (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  discord_user_id  text not null,
  user_id          uuid references auth.users(id) on delete set null,
  tenant_id        uuid references public.tenants(id) on delete cascade,
  termino          text not null,
  resultado        text not null,

  constraint discord_consultas_clientes_snowflake
    check (discord_user_id ~ '^[0-9]{17,20}$'),
  constraint discord_consultas_clientes_termino_corto
    check (char_length(termino) between 1 and 100),
  constraint discord_consultas_clientes_resultado_valido
    check (resultado in (
      'ok', 'sin_enlace', 'enlace_ambiguo', 'sin_permiso', 'limite', 'no_disponible'
    ))
);

comment on table public.discord_consultas_clientes is
  'SDD-0608: registro de cada consulta /cliente desde Discord (quién, cuándo, término, resultado). '
  'Sólo service_role. Se borra a los 180 días en cada registro.';

-- Finalidad de cada dato personal, junto a la columna (revisar-datos-ve, punto 2).
comment on column public.discord_consultas_clientes.discord_user_id is
  'Cuenta de Discord que pidió la consulta, con o sin enlace al Studio. Finalidad: saber quién '
  'consultó y aplicar el tope por minuto también a quien no está autorizado.';
comment on column public.discord_consultas_clientes.user_id is
  'Usuario del Studio enlazado a esa cuenta, si lo hay. Finalidad: atribuir la consulta a una persona del equipo.';
comment on column public.discord_consultas_clientes.termino is
  'Lo que se buscó (hasta 100 caracteres). Puede ser el nombre de un cliente o de cualquier persona. '
  'Finalidad: trazabilidad de qué se consultó. No guarda qué clientes se mostraron.';
comment on column public.discord_consultas_clientes.resultado is
  'Cómo terminó: ok, sin_enlace, enlace_ambiguo, sin_permiso, limite o no_disponible.';

-- Lo que lee el límite por minuto.
create index if not exists discord_consultas_clientes_usuario_idx
  on public.discord_consultas_clientes (discord_user_id, created_at desc);
-- Lo que lee la retención.
create index if not exists discord_consultas_clientes_fecha_idx
  on public.discord_consultas_clientes (created_at);

alter table public.discord_consultas_clientes enable row level security;

revoke all on public.discord_consultas_clientes from public;
revoke all on public.discord_consultas_clientes from anon;
revoke all on public.discord_consultas_clientes from authenticated;
grant select, insert, delete on public.discord_consultas_clientes to service_role;

-- ── Registrar + límite por minuto ───────────────────────────
-- Devuelve true si la consulta entra dentro del tope; false si lo pasa. En los
-- dos casos queda una fila: con el resultado pedido, o con 'limite'. Cuenta
-- TODAS las filas del último minuto de ese usuario de Discord, autorizadas o
-- no: quien no tiene enlace también queda frenado.
create or replace function public.discord_consulta_registrar(
  p_discord_user_id text,
  p_user_id uuid,
  p_tenant_id uuid,
  p_termino text,
  p_resultado text,
  p_tope integer
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_recientes integer;
  v_permitida boolean;
begin
  -- Serializa por persona: dos pedidos a la vez no leen el mismo conteo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('discord_consulta:' || coalesce(p_discord_user_id, ''), 0)
  );

  select count(*)
    into v_recientes
    from public.discord_consultas_clientes c
   where c.discord_user_id = p_discord_user_id
     and c.created_at > pg_catalog.now() - interval '1 minute';

  v_permitida := v_recientes < greatest(coalesce(p_tope, 1), 1);

  insert into public.discord_consultas_clientes
    (discord_user_id, user_id, tenant_id, termino, resultado)
  values (
    p_discord_user_id,
    p_user_id,
    p_tenant_id,
    left(coalesce(nullif(btrim(p_termino), ''), '(vacío)'), 100),
    case when v_permitida then p_resultado else 'limite' end
  );

  delete from public.discord_consultas_clientes c
   where c.created_at < pg_catalog.now() - interval '180 days';

  return v_permitida;
end
$fn$;

comment on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) is
  'SDD-0608: anota una consulta /cliente y aplica el tope por usuario de Discord y minuto. Sólo service_role.';

revoke all on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) from public;
revoke all on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) from anon;
revoke all on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) from authenticated;
grant execute on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) to service_role;

-- ── Buscar por nombre: sólo código y nombre ─────────────────
create or replace function public.discord_buscar_clientes(
  p_tenant_id uuid,
  p_termino text,
  p_limite integer
)
returns table (markbox text, name text)
language sql
stable
security invoker
set search_path = ''
as $fn$
  with palabras as (
    select '%'
           || replace(replace(replace(
                lower(translate(p, 'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
                                   'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc')),
                '\', '\\'), '%', '\%'), '_', '\_')
           || '%' as patron
      from (
        select p
          from pg_catalog.regexp_split_to_table(btrim(coalesce(p_termino, '')), '\s+') as p
         where char_length(p) >= 2
         limit 6
      ) as t
  )
  select c.markbox, c.name
    from public.clients c
   where c.tenant_id = p_tenant_id
     and c.deleted_at is null
     and exists (select 1 from palabras)
     and not exists (
       select 1
         from palabras w
        where not (
          lower(translate(c.name, 'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
                                  'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc'))
            like w.patron escape '\'
        )
     )
   order by c.name, c.markbox
   limit least(greatest(coalesce(p_limite, 1), 1), 25);
$fn$;

comment on function public.discord_buscar_clientes(uuid, text, integer) is
  'SDD-0608: busca clientes del tenant por nombre (palabras, sin acentos, comodines escapados) y devuelve SÓLO markbox y name. Sólo service_role.';

revoke all on function public.discord_buscar_clientes(uuid, text, integer) from public;
revoke all on function public.discord_buscar_clientes(uuid, text, integer) from anon;
revoke all on function public.discord_buscar_clientes(uuid, text, integer) from authenticated;
grant execute on function public.discord_buscar_clientes(uuid, text, integer) to service_role;
