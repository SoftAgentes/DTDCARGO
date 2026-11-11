-- ─────────────────────────────────────────────────────────────
-- 0530 · SDD-0622 · Comercial en la base acepta los accesos por persona
--
-- QUÉ RESUELVE: con la 0529 la pantalla ya suma los accesos adicionales, pero la
-- base seguía comparando el rol suelto en Comercial (§12, grupo C):
--   · `crm_puede_usar()` = admin o commercial (0506:186) → a alguien de
--     contabilidad con el CRM concedido la RLS le cerraba las tablas.
--   · `document_entity_authorized` (0444) → la escritura de `clients` (0456) y
--     los documentos de clientes/proveedores solo miraban rol y desvío por rol.
--
-- CAMBIOS (solo funciones y policies; ningún dato):
--   1. `crm_puede_usar()` pasa a ser «ve el módulo CRM» = user_has_module('kommo').
--   2. `crm_puede_editar()` nueva = user_has_module('kommo', true). Las policies de
--      INSERT/UPDATE de tarjetas, tareas y notas y la RPC `crm_mover_etapa` la usan:
--      un acceso de solo ver lee el CRM pero no lo cambia (antes ver = editar,
--      porque solo admin y commercial pasaban). `support` nunca edita.
--   3. `document_entity_authorized` suma el acceso adicional vigente de la persona
--      sobre el módulo de la entidad. Las entidades de DINERO (invoice,
--      supplier_bill, supplier_payment, journal_entry) siguen por rol: eso es la
--      fase de dinero (R3), aparte.
--
-- Para admin y commercial nada cambia. Para los demás roles cambia solo si un
-- admin les concedió el módulo, o si hay un desvío por rol (0357) sobre `kommo`:
-- antes el CRM lo ignoraba y ahora pantalla y base deciden igual.
--
-- No toca: `crm_etapas` (escritura solo admin), las fusiones de fichas
-- (0358/0361) ni el cambio de código (0371), que siguen pidiendo su rol.
-- ─────────────────────────────────────────────────────────────

do $preflight$
declare
  v_puede text;
  v_doc   text;
begin
  if pg_catalog.to_regprocedure('public.user_has_module(text,boolean)') is null
     or to_regclass('public.studio_user_module_grants') is null then
    raise exception '0530 requiere la 0529 (user_has_module y studio_user_module_grants)';
  end if;
  if pg_catalog.to_regprocedure('public.crm_puede_usar()') is null
     or pg_catalog.to_regprocedure('public.crm_mover_etapa(uuid,text,text,text)') is null
     or to_regclass('public.crm_tarjetas') is null
     or to_regclass('public.crm_tareas') is null
     or to_regclass('public.crm_notas') is null then
    raise exception '0530 requiere el CRM propio de la 0506';
  end if;
  if pg_catalog.to_regprocedure('public.document_entity_authorized(text,uuid,text)') is null
     or pg_catalog.to_regprocedure('public.document_entity_module_contract(text)') is null then
    raise exception '0530 requiere el contrato documental de la 0444';
  end if;
  if pg_catalog.to_regprocedure('public.crm_puede_editar()') is not null then
    raise exception '0530 no aplica: crm_puede_editar ya existe';
  end if;

  select pg_catalog.pg_get_functiondef('public.crm_puede_usar()'::regprocedure) into v_puede;
  if v_puede not like '%current_studio_role()) in (''admin'', ''commercial'')%' then
    raise exception '0530: crm_puede_usar no tiene el cuerpo de la 0506 (drift)';
  end if;
  select pg_catalog.pg_get_functiondef('public.document_entity_authorized(text,uuid,text)'::regprocedure) into v_doc;
  if v_doc not like '%else false%'
     or v_doc like '%studio_user_module_grants%'
     or pg_catalog.obj_description('public.document_entity_authorized(text,uuid,text)'::regprocedure, 'pg_proc')
        not like 'SDD-0412:%' then
    raise exception '0530: document_entity_authorized no es el de la 0444 (drift)';
  end if;
end;
$preflight$;

-- ─── 1. crm_puede_usar / crm_puede_editar ─────────────────────────────────
create or replace function public.crm_puede_usar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select (select public.get_user_tenant_id()) is not null
     and coalesce((select public.user_has_module('kommo', false)), false);
$fn$;

comment on function public.crm_puede_usar() is
  'SDD-0587 (6.2) y SDD-0622: el usuario VE el módulo CRM (kommo) — rol, desvío por rol o acceso adicional vigente, vía user_has_module — y tiene un tenant activo.';

create function public.crm_puede_editar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select (select public.get_user_tenant_id()) is not null
     and coalesce((select public.user_has_module('kommo', true)), false);
$fn$;

comment on function public.crm_puede_editar() is
  'SDD-0622: el usuario EDITA el módulo CRM (kommo) vía user_has_module(…, true) y tiene un tenant activo. support nunca edita.';

revoke all on function public.crm_puede_editar() from public;
revoke all on function public.crm_puede_editar() from anon;
grant execute on function public.crm_puede_editar() to authenticated, service_role;

-- ─── 2. Escritura del CRM pide edición ────────────────────────────────────
drop policy crm_tarjetas_insert on public.crm_tarjetas;
create policy crm_tarjetas_insert on public.crm_tarjetas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()) and fuente = 'manual');
drop policy crm_tarjetas_update on public.crm_tarjetas;
create policy crm_tarjetas_update on public.crm_tarjetas
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()));

drop policy crm_tareas_insert on public.crm_tareas;
create policy crm_tareas_insert on public.crm_tareas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar())
              and origen = 'manual' and created_by = (select auth.uid()));
drop policy crm_tareas_update on public.crm_tareas;
create policy crm_tareas_update on public.crm_tareas
  for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()))
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()));

drop policy crm_notas_insert on public.crm_notas;
create policy crm_notas_insert on public.crm_notas
  for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar())
              and autor_id = (select auth.uid()));

-- Mismo cuerpo que la 0506; cambia solo el candado: mover una etapa es editar.
create or replace function public.crm_mover_etapa(p_tarjeta_id uuid, p_tablero text, p_etapa text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant   uuid := (select public.get_user_tenant_id());
  v_actual   text;
  v_terminal boolean;
  v_motivo   text := nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '');
begin
  if not (select public.crm_puede_editar()) then
    raise exception 'crm_mover_etapa: sin acceso al CRM' using errcode = '42501';
  end if;
  if p_tablero not in ('leads', 'clientes') then
    raise exception 'crm_mover_etapa: tablero desconocido' using errcode = '22023';
  end if;
  select e.terminal into v_terminal
  from public.crm_etapas e
  where e.tenant_id = v_tenant and e.tablero = p_tablero and e.clave = p_etapa and e.activa;
  if not found then
    raise exception 'crm_mover_etapa: etapa inexistente o apagada' using errcode = '22023';
  end if;
  if v_terminal and v_motivo is null then
    raise exception 'crm_mover_etapa: una etapa de cierre pide motivo' using errcode = '22023';
  end if;

  select case when p_tablero = 'leads' then t.etapa_leads else t.etapa_clientes end
    into v_actual
  from public.crm_tarjetas t
  where t.id = p_tarjeta_id and t.tenant_id = v_tenant
  for update;
  if not found then
    raise exception 'crm_mover_etapa: tarjeta inexistente' using errcode = '22023';
  end if;
  if v_actual = p_etapa then
    return false;
  end if;

  if p_tablero = 'leads' then
    update public.crm_tarjetas t
    set etapa_leads = p_etapa, etapa_leads_at = pg_catalog.now(), etapa_leads_manual_at = pg_catalog.now(),
        motivo_perdida = case when v_terminal then v_motivo end,
        ultima_actividad_at = pg_catalog.now()
    where t.id = p_tarjeta_id;
  else
    update public.crm_tarjetas t
    set etapa_clientes = p_etapa, etapa_clientes_at = pg_catalog.now(), etapa_clientes_manual_at = pg_catalog.now(),
        ultima_actividad_at = pg_catalog.now()
    where t.id = p_tarjeta_id;
  end if;

  insert into public.crm_historial_etapas (tenant_id, tarjeta_id, tablero, de, a, origen, actor_id, motivo, ocurrio_at)
  values (v_tenant, p_tarjeta_id, p_tablero, v_actual, p_etapa, 'manual', (select auth.uid()), v_motivo, pg_catalog.now());
  return true;
end;
$fn$;

comment on function public.crm_mover_etapa(uuid, text, text, text) is
  'SDD-0587 (6.2) y SDD-0622: movimiento manual de etapa desde Studio. Pide EDITAR el módulo CRM (crm_puede_editar). Una etapa de cierre pide motivo. Deja historial.';

revoke all on function public.crm_mover_etapa(uuid, text, text, text) from public;
revoke all on function public.crm_mover_etapa(uuid, text, text, text) from anon;
grant execute on function public.crm_mover_etapa(uuid, text, text, text) to authenticated;

-- ─── 3. Documentos y escritura de clients suman el acceso adicional ───────
-- Mismo cuerpo que la 0444 con una sola diferencia: además del rol y del desvío
-- por rol, un acceso adicional VIGENTE de la persona sobre el módulo de la
-- entidad deja ver (y editar, si es de edición). Dinero sigue por rol.
create or replace function public.document_entity_authorized(
  p_entity_type text,
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      n.entity_type,
      n.access,
      m.role,
      c.module_id,
      c.default_roles,
      o.can_view,
      o.can_edit,
      g.can_view as grant_view,
      g.can_edit as grant_edit
    from normalized n
    cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c
      on true
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
    left join public.studio_user_module_grants g
      on g.tenant_id = p_tenant_id
     and g.user_id = (select auth.uid())
     and g.module_id = c.module_id
     and (g.expires_at is null or g.expires_at > pg_catalog.now())
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
        or coalesce(d.grant_view, false)
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and (
          coalesce(d.can_edit, d.role = any(d.default_roles))
          or coalesce(d.grant_edit, false)
        )
      else false
    end
    from decision d
  ), false)
$$;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0412: autorización documental tenant-aware completa para los 12 tipos; none/vacío heredan Documents y cualquier tipo desconocido falla cerrado. SDD-0622: suma el acceso adicional vigente de la persona sobre el módulo de la entidad (las entidades de dinero siguen por rol).';

revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

-- ─── 4. Postcondiciones ───────────────────────────────────────────────────
do $post$
begin
  if pg_catalog.pg_get_functiondef('public.crm_puede_usar()'::regprocedure) not like '%user_has_module(''kommo'', false)%' then
    raise exception '0530: crm_puede_usar no quedó con user_has_module';
  end if;
  if pg_catalog.pg_get_functiondef('public.crm_mover_etapa(uuid,text,text,text)'::regprocedure) not like '%crm_puede_editar()%' then
    raise exception '0530: crm_mover_etapa no pide edición';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_policy
      where polrelid in ('public.crm_tarjetas'::regclass, 'public.crm_tareas'::regclass, 'public.crm_notas'::regclass)
        and polcmd in ('a', 'w')
        and pg_catalog.pg_get_expr(coalesce(polwithcheck, polqual), polrelid) like '%crm_puede_editar()%') <> 5 then
    raise exception '0530: las 5 policies de escritura del CRM no piden edición';
  end if;
  if pg_catalog.pg_get_functiondef('public.document_entity_authorized(text,uuid,text)'::regprocedure) not like '%studio_user_module_grants%' then
    raise exception '0530: document_entity_authorized no suma los accesos adicionales';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.crm_puede_editar()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.document_entity_authorized(text,uuid,text)', 'EXECUTE') then
    raise exception '0530: anon no debe ejecutar las funciones de acceso';
  end if;
end;
$post$;
