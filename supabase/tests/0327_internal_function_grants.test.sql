\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create function public.warehouse_receipts_cn_sync_boxes() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.warehouse_receipts_cn_sync_box_identity() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.consolidation_box_positions_same_tenant() returns trigger language plpgsql security definer as $$ begin return new; end $$;
grant execute on function public.warehouse_receipts_cn_sync_boxes() to anon,authenticated;
grant execute on function public.warehouse_receipts_cn_sync_box_identity() to anon,authenticated;
grant execute on function public.consolidation_box_positions_same_tenant() to anon,authenticated;
\ir ../migrations/0327_internal_function_grants.sql
do $$ begin
  if not has_function_privilege('anon','public.warehouse_receipts_cn_sync_boxes()','EXECUTE') then raise exception '0327: sync_boxes público'; end if;
  if has_function_privilege('authenticated','public.warehouse_receipts_cn_sync_box_identity()','EXECUTE') then raise exception '0327: sync_identity público'; end if;
  if has_function_privilege('anon','public.consolidation_box_positions_same_tenant()','EXECUTE') then raise exception '0327: constraint trigger público'; end if;
end $$;
rollback;
