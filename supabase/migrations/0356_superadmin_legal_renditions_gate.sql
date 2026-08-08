-- ─────────────────────────────────────────────────────────────
-- 0356 · Superadmin · corte 2 (SDD-0252) — Legal y Rendiciones
--
-- QUÉ RESUELVE: la 0355 subió DOS llaves a `is_platform_admin()` (feature
-- flags + tocar otro admin) y dejó el resto como decisión pendiente del
-- founder: "capa legal, No-Olvidar, Financiero China, Dirección, Mailing,
-- Rendiciones". El founder revisó las 6 y aprobó subir Legal, No-Olvidar,
-- Financiero China y Rendiciones (2026-08-07) — Dirección y Mailing se
-- quedan en admin-por-rol.
--
-- ESTA MIGRACIÓN cubre la mitad que tiene RLS "by admin" hoy: `legal_docs`,
-- `renditions` y `rendition_receipts`. Mismo patrón que 0355: se agrega
-- `is_platform_admin()` a la condición existente, mismo nombre de policy con
-- sufijo distinto para que quede trazable en `pg_policies`.
--
-- LO QUE NO CUBRE, A PROPÓSITO:
--   - Financiero China: sus tablas (`supplier_charges`, `supplier_credit_notes`,
--     `currency_conversions`, `partner_ledger_entries`, `supplier_claim_offsets`)
--     tienen RLS por TENANT, no por rol — patrón ya documentado de SDD-0085 (el
--     gate real vive en la app, no en RLS). El gate de app
--     (`rbac-guard.ts` · `SUPERADMIN_ONLY_MODULES`, mismo commit) ya exige
--     superadmin ahí; no se inventa RLS por rol nueva en esta migración.
--   - No-Olvidar: su mutación (`no_olvidar_rotate_kek`) usa un concepto de
--     "admin" PROPIO (`no_olvidar_user_keys.role`), no `user_tenants.role`. Es
--     un sistema custodial dormante — el gate de app ya cubre quién ABRE la
--     pantalla del Studio; cruzar los dos conceptos de admin en su RPC queda
--     fuera de esta migración.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0356 requiere public.is_platform_admin() (migr 0058)';
  end if;
  if not exists (select 1 from public.platform_admins) then
    raise exception '0356 abortado: platform_admins está VACÍA — dejaría Legal/Rendiciones sin nadie que pueda escribir.';
  end if;
end;
$preflight$;

-- ─── legal_docs ────────────────────────────────────────────────
drop policy if exists "legal_docs write by admin" on public.legal_docs;
create policy "legal_docs write by platform admin"
  on public.legal_docs for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

drop policy if exists "legal_docs update by admin" on public.legal_docs;
create policy "legal_docs update by platform admin"
  on public.legal_docs for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = public.get_user_tenant_id());

drop policy if exists "legal_docs delete by admin" on public.legal_docs;
create policy "legal_docs delete by platform admin"
  on public.legal_docs for delete to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

comment on policy "legal_docs write by platform admin" on public.legal_docs is
  'Sólo un platform admin publica documentos legales. Antes bastaba con ser admin del tenant. SDD-0252 · 0356.';

-- ─── renditions ────────────────────────────────────────────────
drop policy if exists "renditions insert by admin" on public.renditions;
create policy "renditions insert by platform admin"
  on public.renditions for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

drop policy if exists "renditions update by admin" on public.renditions;
create policy "renditions update by platform admin"
  on public.renditions for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = public.get_user_tenant_id());

comment on policy "renditions insert by platform admin" on public.renditions is
  'Sólo un platform admin emite rendiciones. Antes bastaba con ser admin del tenant. SDD-0252 · 0356.';

-- ─── rendition_receipts ────────────────────────────────────────
drop policy if exists "rendition_receipts insert by admin" on public.rendition_receipts;
create policy "rendition_receipts insert by platform admin"
  on public.rendition_receipts for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (select public.is_platform_admin())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

comment on policy "rendition_receipts insert by platform admin" on public.rendition_receipts is
  'Sólo un platform admin adjunta soportes de rendición. Antes bastaba con ser admin del tenant. SDD-0252 · 0356.';

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
declare
  v_old_names text[] := array[
    'legal_docs write by admin', 'legal_docs update by admin', 'legal_docs delete by admin',
    'renditions insert by admin', 'renditions update by admin',
    'rendition_receipts insert by admin'
  ];
  v_new_names text[] := array[
    'legal_docs write by platform admin', 'legal_docs update by platform admin', 'legal_docs delete by platform admin',
    'renditions insert by platform admin', 'renditions update by platform admin',
    'rendition_receipts insert by platform admin'
  ];
  v_name text;
begin
  foreach v_name in array v_old_names loop
    if exists (select 1 from pg_policies where schemaname='public' and policyname=v_name) then
      raise exception '0356: la policy vieja "%" sigue viva', v_name;
    end if;
  end loop;

  foreach v_name in array v_new_names loop
    if not exists (select 1 from pg_policies where schemaname='public' and policyname=v_name) then
      raise exception '0356: no quedó la policy nueva "%"', v_name;
    end if;
  end loop;
end;
$post$;
