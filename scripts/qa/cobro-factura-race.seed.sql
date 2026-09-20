-- SDD-0488 · Semilla sintética de scripts/qa/cobro-factura-race.mjs.
-- Corre como postgres sobre el esquema reconstruido desde cero en un contenedor
-- desechable; nunca sobre una base de red. Variables psql: tenant, user, cash,
-- markbox (las fija el script).
--
-- Un tenant propio, un usuario de contabilidad con UNA sola membresía activa
-- (get_user_tenant_id, 0453, devuelve NULL con cero o más de una) y una cuenta
-- de caja postable para cash_account_id (0079 sólo tiene la FK). Facturas,
-- recibos y reportes los crea cada escenario.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values (:'user', 'contabilidad-0488@carrera.test');
insert into public.tenants (id, slug, display_name)
  values (:'tenant', 'carrera-0488', 'Tenant sintético de la carrera 0488');
-- user_tenants tiene FK a user_profiles (0036), no sólo a auth.users.
insert into public.user_profiles (user_id, first_name) values (:'user', 'Contabilidad 0488');
insert into public.user_tenants (user_id, tenant_id, role) values (:'user', :'tenant', 'accounting');
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
  values (:'cash', :'tenant', '1.1.1.1', 'Banco sintético 0488', 'A', true);
commit;
