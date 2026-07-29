-- ─────────────────────────────────────────────────────────────
-- 0266 · SDD-0172 · ficha del proveedor nuevo desde el portal
--
-- El Norte (`_norte/portal/app.jsx` · `PortalNuevaCompra`) pide 3 preguntas al
-- dar de alta un proveedor: de dónde salió, si ya le había comprado, y por qué
-- canal habla con él. El texto de la spec decía "ampliar el modelo de
-- proveedor"; verificado contra prod, `suppliers_cn` YA tiene `industry`
-- (= "¿qué vende?") y `contact_phone`, así que sólo faltan estas 4 columnas
-- (3 respuestas + la nota condicional de la primera).
--
-- Son datos DEL CLIENTE para su propio control (así lo dice el copy del Norte),
-- no de operación: nadie del ERP decide nada con ellos todavía.
--
-- SEGURIDAD / PERFORMANCE (checklist de los 2 skills de Supabase):
--   · ADD COLUMN nullable y SIN default → cambio de sólo metadatos: no reescribe
--     la tabla ni toma un lock largo (PG 11+).
--   · RLS: no se tocan políticas. Son row-level (tenant_id + client_markbox) y
--     las columnas nuevas quedan cubiertas por las que ya existen.
--   · GRANTS: verificado en prod que los privilegios de `authenticated` /
--     `service_role` son de TABLA (no por columna) → las columnas nuevas heredan
--     permiso solas. Si fueran por columna harían falta GRANT explícitos.
--   · Sin índices a propósito: son campos descriptivos de baja cardinalidad que
--     nunca entran en un WHERE. Indexarlos sería costo de escritura sin lectura.
--   · Vocabulario cerrado por CHECK (permitiendo NULL) para que ningún escritor
--     —portal, ERP o script— meta variantes sueltas. Se guardan SLUGS; las
--     etiquetas visibles viven en el código.
--
-- NO APLICADA A PROD. Registrada en supabase/migrations-baseline.json; se
-- aplica sólo con OK explícito del founder NOMBRANDO este archivo
-- (docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.suppliers_cn
  add column if not exists source_origin      text,
  add column if not exists source_origin_note text,
  add column if not exists purchase_history   text,
  add column if not exists comm_method        text;

-- ── Vocabularios (NULL permitido: la ficha es opcional y hay filas viejas) ──

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_cn_source_origin_chk'
  ) then
    alter table public.suppliers_cn
      add constraint suppliers_cn_source_origin_chk
      check (source_origin is null or source_origin in
        ('alibaba', '1688', 'feria_canton', 'recomendado', 'otro'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_cn_purchase_history_chk'
  ) then
    alter table public.suppliers_cn
      add constraint suppliers_cn_purchase_history_chk
      check (purchase_history is null or purchase_history in ('nuevo', 'previo'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_cn_comm_method_chk'
  ) then
    alter table public.suppliers_cn
      add constraint suppliers_cn_comm_method_chk
      check (comm_method is null or comm_method in
        ('whatsapp', 'wechat', 'alibaba', 'otro'));
  end if;
end $$;

comment on column public.suppliers_cn.source_origin is
  'SDD-0172 · de dónde salió el proveedor (dato del CLIENTE, para su control).';
comment on column public.suppliers_cn.source_origin_note is
  'SDD-0172 · detalle libre cuando source_origin es recomendado/otro.';
comment on column public.suppliers_cn.purchase_history is
  'SDD-0172 · si el cliente ya le había comprado antes de registrarlo acá.';
comment on column public.suppliers_cn.comm_method is
  'SDD-0172 · canal por el que el cliente habla hoy con el proveedor.';
