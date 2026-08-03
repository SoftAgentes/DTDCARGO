-- SDD-0235 · funciones de trigger no son endpoints públicos.
set lock_timeout = '5s';
set statement_timeout = '30s';

revoke all on function public.warehouse_receipts_cn_sync_boxes()
  from public, anon, authenticated;
revoke all on function public.warehouse_receipts_cn_sync_box_identity()
  from public, anon, authenticated;
revoke all on function public.consolidation_box_positions_same_tenant()
  from public, anon, authenticated;

comment on function public.warehouse_receipts_cn_sync_boxes() is
  'SDD-0152/0235: función interna de trigger, sin EXECUTE público.';
comment on function public.warehouse_receipts_cn_sync_box_identity() is
  'SDD-0152/0235: función interna de trigger, sin EXECUTE público.';
comment on function public.consolidation_box_positions_same_tenant() is
  'SDD-0235: función interna de constraint trigger, sin EXECUTE público.';
