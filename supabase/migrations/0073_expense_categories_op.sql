-- ─────────────────────────────────────────────────────────────
-- SDD-0039 (Gastos CN) Fase 1a · categorías operativas op_*
--
-- Agrega 7 categorías de gasto OPERATIVO (overhead de oficina/bodega CN)
-- al enum expense_category existente (de 0047_expenses). Las categorías
-- viejas (taxi/comida/hotel/...) son gastos de viaje del personal; las
-- op_* son overhead del contenedor/oficina que carga la contadora CN.
--
-- ⚠ AISLADA del resto del schema: `ALTER TYPE ... ADD VALUE` no puede
-- coexistir con el USO del nuevo valor en la misma transacción. Esta
-- migración SOLO agrega valores; scope/fx/uso van en 0074.
-- ─────────────────────────────────────────────────────────────

alter type public.expense_category add value if not exists 'op_rent';
alter type public.expense_category add value if not exists 'op_utilities';
alter type public.expense_category add value if not exists 'op_salaries';
alter type public.expense_category add value if not exists 'op_supplies';
alter type public.expense_category add value if not exists 'op_equipment';
alter type public.expense_category add value if not exists 'op_local_transport';
alter type public.expense_category add value if not exists 'op_customs_local';
