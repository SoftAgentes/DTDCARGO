-- ─────────────────────────────────────────────────────────────
-- 0264 · Hardening de comment_mentions_validate()
--
-- La función es un trigger SECURITY DEFINER. La migración 0209 retiró anon,
-- pero concedió EXECUTE directo a authenticated y service_role. El trigger no
-- necesita ese grant para ejecutarse durante INSERT.
--
-- Esta corrección:
--   · conserva cuerpo, owner, SECURITY DEFINER y trigger;
--   · sella search_path en vacío porque el cuerpo califica public.*;
--   · retira EXECUTE directo de PUBLIC, anon, authenticated y service_role.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_definition text;
begin
  if to_regprocedure('public.comment_mentions_validate()') is null then
    raise exception '0264 requiere public.comment_mentions_validate()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comment_mentions_validate()'::regprocedure
      and proowner = 'postgres'::regrole
      and prorettype = 'trigger'::regtype
      and prosecdef
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception '0264 detectó drift en propiedades de comment_mentions_validate()';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.comment_mentions'::regclass
      and tgname = 'comment_mentions_validate_trg'
      and tgfoid = 'public.comment_mentions_validate()'::regprocedure
      and tgenabled = 'O'
      and not tgisinternal
      and pg_get_triggerdef(oid) like '%BEFORE INSERT%'
  ) then
    raise exception '0264 requiere el trigger vigente comment_mentions_validate_trg';
  end if;

  select pg_get_functiondef('public.comment_mentions_validate()'::regprocedure)
    into v_definition;

  if v_definition not like '%public.user_tenants%'
     or v_definition not like '%new.mentioned_user_id%'
     or v_definition not like '%new.tenant_id%'
     or v_definition not like '%disabled_at is null%' then
    raise exception '0264 detectó drift semántico en comment_mentions_validate()';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.comment_mentions_validate()',
       'EXECUTE'
     ) then
    raise exception '0264 detectó un ACL previo inesperado en comment_mentions_validate()';
  end if;
end
$preflight$;

alter function public.comment_mentions_validate()
  set search_path = '';

revoke execute on function public.comment_mentions_validate()
  from public, anon, authenticated, service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comment_mentions_validate()'::regprocedure
      and proowner = 'postgres'::regrole
      and prorettype = 'trigger'::regtype
      and prosecdef
      and proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0264 no conservó la función con search_path sellado';
  end if;

  if has_function_privilege(
       'anon',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.comment_mentions_validate()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.comment_mentions_validate()',
       'EXECUTE'
     ) then
    raise exception '0264 dejó EXECUTE directo sobre comment_mentions_validate()';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.comment_mentions'::regclass
      and tgname = 'comment_mentions_validate_trg'
      and tgfoid = 'public.comment_mentions_validate()'::regprocedure
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception '0264 alteró o desactivó comment_mentions_validate_trg';
  end if;
end
$postconditions$;
