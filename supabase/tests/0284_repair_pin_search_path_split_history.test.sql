\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '20260703235255',
  '0210_pin_search_path_triggers',
  array[
    $sdd0118_pin_split_0$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public$sdd0118_pin_split_0$,
    $sdd0118_pin_split_1$alter function public.bank_statement_lines_validate_match() set search_path = public$sdd0118_pin_split_1$,
    $sdd0118_pin_split_2$alter function public.bug_reports_set_updated_at() set search_path = public$sdd0118_pin_split_2$,
    $sdd0118_pin_split_3$alter function public.comment_mentions_freeze_immutable() set search_path = public$sdd0118_pin_split_3$,
    $sdd0118_pin_split_4$alter function public.comments_freeze_immutable() set search_path = public$sdd0118_pin_split_4$,
    $sdd0118_pin_split_5$alter function public.comments_validate_entity() set search_path = public$sdd0118_pin_split_5$,
    $sdd0118_pin_split_6$alter function public.dispatch_orders_status_transition_guard() set search_path = public$sdd0118_pin_split_6$,
    $sdd0118_pin_split_7$alter function public.documents_validate_entity() set search_path = public$sdd0118_pin_split_7$,
    $sdd0118_pin_split_8$alter function public.fiscal_book_entries_immutable() set search_path = public$sdd0118_pin_split_8$,
    $sdd0118_pin_split_9$alter function public.fiscal_books_guard() set search_path = public$sdd0118_pin_split_9$,
    $sdd0118_pin_split_10$alter function public.fixed_asset_depreciation_validate_entry() set search_path = public$sdd0118_pin_split_10$,
    $sdd0118_pin_split_11$alter function public.journal_entries_validate_closing() set search_path = public$sdd0118_pin_split_11$,
    $sdd0118_pin_split_12$alter function public.journal_lines_validate_closing() set search_path = public$sdd0118_pin_split_12$,
    $sdd0118_pin_split_13$alter function public.kommo_discard_stale_update() set search_path = public$sdd0118_pin_split_13$,
    $sdd0118_pin_split_14$alter function public.legal_acceptances_immutable() set search_path = public$sdd0118_pin_split_14$,
    $sdd0118_pin_split_15$alter function public.legal_acceptances_validate_client() set search_path = public$sdd0118_pin_split_15$,
    $sdd0118_pin_split_16$alter function public.news_posts_touch_updated_at() set search_path = public$sdd0118_pin_split_16$,
    $sdd0118_pin_split_17$alter function public.partner_finance_validate_refs() set search_path = public$sdd0118_pin_split_17$,
    $sdd0118_pin_split_18$alter function public.partner_statement_line_validate_refs() set search_path = public$sdd0118_pin_split_18$,
    $sdd0118_pin_split_19$alter function public.partner_statement_validate_refs() set search_path = public$sdd0118_pin_split_19$,
    $sdd0118_pin_split_20$alter function public.prealerta_service_request_guard() set search_path = public$sdd0118_pin_split_20$,
    $sdd0118_pin_split_21$alter function public.prealertas_validate_sales_order() set search_path = public$sdd0118_pin_split_21$,
    $sdd0118_pin_split_22$alter function public.prealertas_validate_supplier() set search_path = public$sdd0118_pin_split_22$,
    $sdd0118_pin_split_23$alter function public.qr_print_orders_status_guard() set search_path = public$sdd0118_pin_split_23$,
    $sdd0118_pin_split_24$alter function public.referrals_validate_clients() set search_path = public$sdd0118_pin_split_24$,
    $sdd0118_pin_split_25$alter function public.rendition_receipts_validate() set search_path = public$sdd0118_pin_split_25$,
    $sdd0118_pin_split_26$alter function public.renditions_immutable() set search_path = public$sdd0118_pin_split_26$,
    $sdd0118_pin_split_27$alter function public.renditions_sync_voided() set search_path = public$sdd0118_pin_split_27$,
    $sdd0118_pin_split_28$alter function public.seo_drafts_touch_updated_at() set search_path = public$sdd0118_pin_split_28$,
    $sdd0118_pin_split_29$alter function public.shipment_costs_validate_shipment() set search_path = public$sdd0118_pin_split_29$,
    $sdd0118_pin_split_30$alter function public.supplier_credit_note_validate_refs() set search_path = public$sdd0118_pin_split_30$,
    $sdd0118_pin_split_31$alter function public.tg_back_set_updated_at() set search_path = public$sdd0118_pin_split_31$,
    $sdd0118_pin_split_32$alter function public.validate_operario_pin_format(p_pin text) set search_path = public$sdd0118_pin_split_32$
  ]
),
(
  '20260729152036',
  '0275_restore_pin_search_path_history',
  array[$sdd0118_pin_split_original_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza statements NULL del ledger; no ejecuta los ALTER almacenados.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and statements is null;

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_original_0275$]
);

\ir ../migrations/0284_repair_pin_search_path_split_history.sql
\ir ../migrations/0284_repair_pin_search_path_split_history.sql

do $patched_0275_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729152036'
    and name = '0275_restore_pin_search_path_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea';

  if v_payload <> $sdd0118_pin_split_expected_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
    )
  );

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_expected_0275$ then
    raise exception 'TEST 0284: payload 0275 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '442a34163980f1fc26bf6f930347b8a1') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 33') = 0 then
    raise exception 'TEST 0284: falta compatibilidad con el split de R15';
  end if;
end
$patched_0275_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
\gexec

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'TEST 0275: estado final incorrecto en 20260703235255';
  end if;
  if to_regprocedure('public.comments_freeze_immutable()') is not null then
    raise exception 'TEST 0275: la migración ejecutó el payload almacenado';
  end if;
end
$ledger_contract$;

create function public.academy_enrollments_validate_person()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.bank_statement_lines_validate_match()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.bug_reports_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.comment_mentions_freeze_immutable()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.comments_freeze_immutable()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.comments_validate_entity()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.documents_validate_entity()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.fiscal_book_entries_immutable()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.fiscal_books_guard()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.fixed_asset_depreciation_validate_entry()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.journal_entries_validate_closing()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.journal_lines_validate_closing()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.kommo_discard_stale_update()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.legal_acceptances_immutable()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.legal_acceptances_validate_client()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.news_posts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.partner_finance_validate_refs()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.partner_statement_line_validate_refs()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.partner_statement_validate_refs()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.prealerta_service_request_guard()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.prealertas_validate_sales_order()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.prealertas_validate_supplier()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.referrals_validate_clients()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.rendition_receipts_validate()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.renditions_immutable()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.renditions_sync_voided()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.seo_drafts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.shipment_costs_validate_shipment()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.supplier_credit_note_validate_refs()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.tg_back_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create function public.validate_operario_pin_format(p_pin text)
returns boolean
language sql
as $$
  select true
$$;

select unnest(statements)
from supabase_migrations.schema_migrations
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
\gexec

do $replay_contract$
begin
  if not exists (
    select 1
    from pg_proc
    where oid = 'public.academy_enrollments_validate_person()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.academy_enrollments_validate_person()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.bank_statement_lines_validate_match()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.bank_statement_lines_validate_match()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.bug_reports_set_updated_at()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.bug_reports_set_updated_at()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comment_mentions_freeze_immutable()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.comment_mentions_freeze_immutable()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comments_freeze_immutable()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.comments_freeze_immutable()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comments_validate_entity()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.comments_validate_entity()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.dispatch_orders_status_transition_guard()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.dispatch_orders_status_transition_guard()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.documents_validate_entity()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.documents_validate_entity()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.fiscal_book_entries_immutable()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.fiscal_book_entries_immutable()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.fiscal_books_guard()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.fiscal_books_guard()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.fixed_asset_depreciation_validate_entry()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.fixed_asset_depreciation_validate_entry()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.journal_entries_validate_closing()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.journal_entries_validate_closing()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.journal_lines_validate_closing()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.journal_lines_validate_closing()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.kommo_discard_stale_update()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.kommo_discard_stale_update()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.legal_acceptances_immutable()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.legal_acceptances_immutable()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.legal_acceptances_validate_client()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.legal_acceptances_validate_client()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.news_posts_touch_updated_at()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.news_posts_touch_updated_at()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.partner_finance_validate_refs()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.partner_finance_validate_refs()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.partner_statement_line_validate_refs()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.partner_statement_line_validate_refs()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.partner_statement_validate_refs()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.partner_statement_validate_refs()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.prealerta_service_request_guard()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.prealerta_service_request_guard()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.prealertas_validate_sales_order()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.prealertas_validate_sales_order()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.prealertas_validate_supplier()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.prealertas_validate_supplier()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.qr_print_orders_status_guard()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.qr_print_orders_status_guard()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.referrals_validate_clients()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.referrals_validate_clients()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.rendition_receipts_validate()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.rendition_receipts_validate()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.renditions_immutable()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.renditions_immutable()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.renditions_sync_voided()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.renditions_sync_voided()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.seo_drafts_touch_updated_at()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.seo_drafts_touch_updated_at()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.shipment_costs_validate_shipment()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.shipment_costs_validate_shipment()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.supplier_credit_note_validate_refs()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.supplier_credit_note_validate_refs()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.tg_back_set_updated_at()'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.tg_back_set_updated_at()';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.validate_operario_pin_format(text)'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en public.validate_operario_pin_format(p_pin text)';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regprocedure('public.comments_freeze_immutable()') is null
  as sdd_0118_pin_search_path_fixture_rolled_back;
