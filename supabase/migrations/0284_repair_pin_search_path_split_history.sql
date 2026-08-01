-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('a217fa825ff964f2c2a4cb26d31c3dbc', 'cad36533b4225b674f1d8fd7b8c165ea')
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_split_patched_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
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
$sdd0118_pin_split_patched_0275$
]
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = 'a217fa825ff964f2c2a4cb26d31c3dbc';

do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$;
