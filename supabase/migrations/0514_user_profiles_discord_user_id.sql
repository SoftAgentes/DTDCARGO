-- ─────────────────────────────────────────────────────────────
-- 0514 · SDD-0606 — ID de Discord en el perfil del usuario del Studio.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). No bloquea el código: sin la
--    columna, los avisos a Discord salen igual, sólo que sin menciones.
--
-- ── Para qué ─────────────────────────────────────────────────
-- Los avisos del Studio pasan de Telegram a Discord (decisión de Sam,
-- 2026-11-05). En Telegram un aviso por persona era un mensaje a su chat
-- privado (`telegram_chat_id`, migr 0050). En Discord no hay chat privado: se
-- escribe en el canal y se MENCIONA a la persona. Para mencionarla hace falta su
-- ID de usuario de Discord, que cada quien pega en su perfil.
--
-- ── Qué guarda ───────────────────────────────────────────────
-- Un ID de usuario de Discord es un número de 17 a 20 dígitos (snowflake). No es
-- una credencial: no permite entrar a nada ni escribir en ningún canal. Sí es un
-- dato personal (identifica una cuenta), y por eso va en `user_profiles`, con la
-- misma visibilidad que el teléfono y el chat de Telegram del perfil.
--
-- La DIRECCIÓN de los webhooks —que sí es una llave— NO está en la base: vive en
-- variables del servidor.
--
-- ── Qué toca ─────────────────────────────────────────────────
-- Una columna nullable sin default y su CHECK de formato. Sin cambios de filas,
-- RLS, grants ni funciones: la columna hereda los privilegios de tabla de
-- `user_profiles` y la policy que ya deja a cada usuario editar su propia fila.
-- ADD COLUMN nullable sin default sólo toca metadatos; el CHECK recorre la
-- tabla una vez (decenas de filas: el personal del Studio).
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.user_profiles') is null then
    raise exception '0514: falta public.user_profiles';
  end if;

  -- Si la columna ya existe con otro tipo, no es la de esta migración: parar.
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'user_profiles'
       and column_name = 'discord_user_id'
       and data_type <> 'text'
  ) then
    raise exception '0514: user_profiles.discord_user_id ya existe con otro tipo';
  end if;
end
$preflight$;

alter table public.user_profiles
  add column if not exists discord_user_id text;

do $check$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.user_profiles'::regclass
       and conname = 'user_profiles_discord_user_id_formato'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_discord_user_id_formato
      check (discord_user_id is null or discord_user_id ~ '^[0-9]{17,20}$');
  end if;
end
$check$;

comment on column public.user_profiles.discord_user_id is
  'SDD-0606: ID de usuario de Discord (17 a 20 dígitos) que la persona pega en su perfil. '
  'Sólo sirve para mencionarla en los avisos del canal. NULL = sin menciones. No es una credencial.';
