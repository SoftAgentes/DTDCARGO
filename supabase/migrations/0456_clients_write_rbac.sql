-- SDD-0472: escritura de clients con el permiso efectivo del módulo.
-- Reutiliza el contrato client -> clients de 0440, vigente en 0444: no duplica
-- roles/defaults/overrides ni agrega otro SECURITY DEFINER o bypass service_role.
-- 0230 dejó la lectura Studio tenant-only; el filtro de vivos es del consumidor.
-- Se conserva esa lectura y toda policy SELECT adicional (incluida Portal).
-- UPDATE conserva soft-delete/restauración: no filtrar deleted_at en la policy.
-- 0454/0455 y merge_clients conservan cuerpos, guards, ACL y triggers completos.
-- Un solo DO hace preflight, DDL y postflight atómicos incluso con autocommit.
-- Sólo catálogo en los vuelos; cero filas de negocio, backfill o DML de datos.
-- Aplicación productiva fuera de esta tarea: requiere autorización nominal.

do $migration$
declare
  v_clients oid := pg_catalog.to_regclass('public.clients');
  v_auth oid := pg_catalog.to_regrole('authenticated');
  v_expected record;
  v_policy record;
  v_phase integer;
  v_old boolean;
  v_before text;
  v_after text;
  v_lock_timeout text := pg_catalog.current_setting('lock_timeout');
  v_read constant text := 'tenant_id=SELECTget_user_tenant_idASget_user_tenant_id';
  v_write constant text := 'tenant_id=SELECTget_user_tenant_idASget_user_tenant_idANDdocument_entity_authorized''client''::text,tenant_id,''edit''::text';
begin
  perform pg_catalog.set_config('lock_timeout', '5s', true);

  -- PREFLIGHT: metadatos, nunca invocar helpers que consultan memberships.
  if v_auth is null or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null
     or not exists (select from pg_catalog.pg_class
       where oid = v_clients and relkind = 'r' and relrowsecurity
         and not pg_catalog.pg_has_role(v_auth, relowner, 'USAGE'))
     or exists (select from pg_catalog.pg_roles where oid = v_auth and (rolsuper or rolbypassrls)) then
    raise exception '0456: roles API o clients con RLS ausentes/inseguros';
  end if;
  lock table public.clients in share row exclusive mode;

  for v_expected in select * from (values
    ('id', 'uuid'), ('tenant_id', 'uuid'), ('deleted_at', 'timestamp with time zone'),
    ('merged_into_client_id', 'uuid')
  ) e(col, typ) loop
    if not exists (select from pg_catalog.pg_attribute
      where attrelid = v_clients and attname = v_expected.col and not attisdropped
        and atttypid = v_expected.typ::pg_catalog.regtype) then
      raise exception '0456: columna requerida de clients ausente o incompatible';
    end if;
  end loop;

  -- Huellas MD5 de prosrc con CRLF -> LF: no quitar espacios dentro de literales
  -- (alterar 'clients' podría evitar overrides). Cuerpos versionados, no filas.
  for v_expected in select * from (values
    ('public.document_entity_module_contract(text)', '9c78c98fb29c311926f93a1c28ce1c32', false), -- 0444
    ('public.document_entity_authorized(text,uuid,text)', '4eb9fd08721e8f754087dddc5cb88953', true), -- 0444
    ('public.get_user_tenant_id()', '5ff0c51c26a49419c34abc78f1d95c37', true), -- 0453
    ('public.clients_revoke_portal_access()', '050880a2e2d30d6aed40aa9de02a554e', true), -- 0454
    ('public.portal_access_require_live_client()', 'b8e102e15e6b8ba899c6a2721ef92b16', true), -- 0454
    ('public.soft_delete_client_with_audit_reason(uuid,text)', '5cbe0d58604436bb59fcd0d3f096d352', false), -- 0455
    ('public.clients_audit_soft_delete()', '5dfc92310d83ee35fae68780f9a8199b', true), -- 0455
    ('public.merge_clients(uuid,uuid)', '1a65fc744a15d060e4a441c8c8270bad', true) -- 0361
  ) e(signature, body_hash, definer) loop
    if not exists (select from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body_hash
        and p.prosecdef = v_expected.definer
        and p.proconfig = case when v_expected.signature = 'public.merge_clients(uuid,uuid)'
          then array['search_path=public']::text[] else array['search_path=""']::text[] end) then
      raise exception '0456: dependencia ausente o con drift: %', v_expected.signature;
    end if;
  end loop;

  -- El helper comparte defaults/overrides con TS. Sus invariantes 0357 impiden
  -- un override NULL, un rol desconocido o editar sin ver. No consultar filas.
  if pg_catalog.to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0456: falta tabla de overrides';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.studio_role_module_overrides', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('anon', 'public.studio_role_module_overrides', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception '0456: escritura directa de overrides expuesta a API';
  end if;
  if (select count(*) from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass('public.studio_role_module_overrides')
        and attname in ('tenant_id','role','module_id','can_view','can_edit')
        and attnotnull and not attisdropped) <> 5 then
    raise exception '0456: columnas/NOT NULL de overrides con drift';
  end if;
  for v_expected in select * from (values
    ('studio_role_module_overrides_pkey', 'PRIMARY KEY (tenant_id, role, module_id)'),
    ('studio_role_module_overrides_edit_implies_view', 'CHECK (((NOT can_edit) OR can_view))'),
    ('studio_role_module_overrides_role_check', 'CHECK ((role = ANY (ARRAY[''commercial''::text, ''operations''::text, ''accounting''::text, ''warehouse''::text, ''support''::text, ''marketing''::text])))')
  ) e(name, definition) loop
    if not exists (select from pg_catalog.pg_constraint c
      where c.conrelid = pg_catalog.to_regclass('public.studio_role_module_overrides')
        and c.conname = v_expected.name and c.convalidated
        and pg_catalog.pg_get_constraintdef(c.oid) = v_expected.definition) then
      raise exception '0456: constraint de overrides con drift: %', v_expected.name;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege('authenticated', 'public.document_entity_authorized(text,uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.document_entity_authorized(text,uuid,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.soft_delete_client_with_audit_reason(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.soft_delete_client_with_audit_reason(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.soft_delete_client_with_audit_reason(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.document_entity_module_contract(text)', 'EXECUTE') then
    raise exception '0456: ACL de autorización o RPC de borrado inseguro';
  end if;
  for v_expected in select * from (values
    ('public.clients', 'clients_revoke_portal_on_soft_delete', 'public.clients_revoke_portal_access()',
     'CREATE TRIGGER clients_revoke_portal_on_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_revoke_portal_access()'),
    ('public.clients', 'clients_audit_soft_delete', 'public.clients_audit_soft_delete()',
     'CREATE TRIGGER clients_audit_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_audit_soft_delete()'),
    ('public.client_users', 'client_users_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER client_users_require_live_client BEFORE INSERT OR UPDATE OF status, client_id ON public.client_users FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''invited''::text, ''active''::text]))) EXECUTE FUNCTION portal_access_require_live_client()'),
    ('public.portal_access_links', 'portal_access_links_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER portal_access_links_require_live_client BEFORE INSERT OR UPDATE OF revoked_at, client_id ON public.portal_access_links FOR EACH ROW WHEN ((new.revoked_at IS NULL)) EXECUTE FUNCTION portal_access_require_live_client()')
  ) e(rel, name, signature, definition) loop
    if not exists (select from pg_catalog.pg_trigger t
      where t.tgrelid = pg_catalog.to_regclass(v_expected.rel) and t.tgname = v_expected.name
        and t.tgenabled = 'O' and not t.tgisinternal
        and t.tgfoid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.replace(pg_catalog.pg_get_triggerdef(t.oid), 'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ') = v_expected.definition)
      or pg_catalog.has_function_privilege('authenticated', v_expected.signature, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_expected.signature, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', v_expected.signature, 'EXECUTE') then
      raise exception '0456: trigger/ACL de Portal o auditoría con drift: %', v_expected.name;
    end if;
  end loop;

  if not pg_catalog.has_table_privilege('authenticated', v_clients, 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', v_clients, 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', v_clients, 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', v_clients, 'TRUNCATE')
     or pg_catalog.has_table_privilege('anon', v_clients, 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception '0456: privilegios de clients ausentes o inseguros';
  end if;

  -- Mismo verificador antes/después. Estado previo exacto o final exacto;
  -- ninguna policy permisiva ajena puede reabrir las escrituras por OR.
  for v_phase in 1..2 loop
    v_old := exists (select from pg_catalog.pg_policy
      where polrelid = v_clients and polname = 'clients by tenant' and polcmd = '*');
    if v_phase = 2 and v_old then raise exception '0456: policy FOR ALL residual'; end if;
    if not exists (select from pg_catalog.pg_policy
      where polrelid = v_clients and polname = 'clients by tenant') then
      raise exception '0456: falta la policy clients by tenant';
    end if;
    for v_policy in select polname, polcmd, polroles, polpermissive,
      pg_catalog.regexp_replace(pg_catalog.replace(coalesce(pg_catalog.pg_get_expr(polqual,polrelid),''),'public.',''), '[\s()]', '', 'g') as qual,
      pg_catalog.regexp_replace(pg_catalog.replace(coalesce(pg_catalog.pg_get_expr(polwithcheck,polrelid),''),'public.',''), '[\s()]', '', 'g') as chk
      from pg_catalog.pg_policy where polrelid = v_clients loop
      if v_policy.polname = 'clients by tenant' then
        if not v_policy.polpermissive or v_policy.polroles <> array[v_auth]::oid[]
           or v_policy.qual <> v_read
           or v_policy.polcmd <> (case when v_old then '*' else 'r' end)
           or v_policy.chk <> (case when v_old then v_read else '' end) then
          raise exception '0456: clients by tenant con drift';
        end if;
      elsif v_policy.polname in ('clients insert authorized','clients update authorized') then
        if v_old or not v_policy.polpermissive or v_policy.polroles <> array[v_auth]::oid[]
           or v_policy.chk <> v_write
           or v_policy.polcmd <> (case when v_policy.polname = 'clients insert authorized' then 'a' else 'w' end)
           or v_policy.qual <> (case when v_policy.polname = 'clients insert authorized' then '' else v_write end) then
          raise exception '0456: policy de escritura con drift';
        end if;
      elsif v_policy.polcmd <> 'r' then
        raise exception '0456: policy ajena de escritura; revisar antes de aplicar';
      end if;
    end loop;
    if not v_old and (select count(*) from pg_catalog.pg_policy where polrelid = v_clients
      and polname in ('clients insert authorized','clients update authorized')) <> 2 then
      raise exception '0456: policies de escritura incompletas';
    end if;

    -- Huella integral del catálogo que esta migración NO debe modificar.
    select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_after from (
      select 'F:' || p.oid || ':' || pg_catalog.pg_get_functiondef(p.oid) || ':' || p.proowner || ':' || coalesce(p.proacl::text,'') as x
      from pg_catalog.pg_proc p where p.pronamespace = 'public'::pg_catalog.regnamespace and p.prokind = 'f'
      union all
      select 'T:' || t.oid || ':' || pg_catalog.pg_get_triggerdef(t.oid) || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t where t.tgrelid in (v_clients, 'public.client_users'::pg_catalog.regclass,
        'public.portal_access_links'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
      union all
      select 'P:' || pol.oid || ':' || pol.polcmd::text || ':' || pol.polroles::text || ':' || pol.polpermissive::text || ':'
        || coalesce(pg_catalog.pg_get_expr(pol.polqual,pol.polrelid),'') || ':' || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck,pol.polrelid),'')
      from pg_catalog.pg_policy pol where not (pol.polrelid = v_clients and pol.polname in
        ('clients by tenant','clients insert authorized','clients update authorized'))
      union all
      select 'R:' || c.oid || ':' || c.relowner || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c where c.relnamespace = 'public'::pg_catalog.regnamespace
      union all
      select 'A:' || c.oid || ':' || a.grantor || ':' || a.grantee || ':' || a.privilege_type || ':' || a.is_grantable::text
      from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.relnamespace = 'public'::pg_catalog.regnamespace
        and not (c.oid = v_clients and a.grantee = v_auth and a.privilege_type = 'DELETE')
    ) fingerprints;
    if v_phase = 1 then
      v_before := v_after;
      if v_old then
        drop policy "clients by tenant" on public.clients;
        create policy "clients by tenant" on public.clients for select to authenticated
          using (tenant_id = (select public.get_user_tenant_id()));
        create policy "clients insert authorized" on public.clients for insert to authenticated
          with check (tenant_id = (select public.get_user_tenant_id())
            and public.document_entity_authorized('client', tenant_id, 'edit'));
        create policy "clients update authorized" on public.clients for update to authenticated
          using (tenant_id = (select public.get_user_tenant_id())
            and public.document_entity_authorized('client', tenant_id, 'edit'))
          with check (tenant_id = (select public.get_user_tenant_id())
            and public.document_entity_authorized('client', tenant_id, 'edit'));
        comment on policy "clients insert authorized" on public.clients is
          'SDD-0472/0456: tenant activo único + edición efectiva clients mediante contrato RBAC compartido 0444.';
        comment on policy "clients update authorized" on public.clients is
          'SDD-0472/0456: mismo permiso en USING/WITH CHECK; conserva UPDATE de soft-delete INVOKER y auditoría 0454/0455.';
      end if;
      revoke delete on public.clients from authenticated;
    else
      -- POSTFLIGHT: privilege efectivo incluye PUBLIC/herencia, no sólo ACL directo.
      if v_before is distinct from v_after then
        raise exception '0456: cambió catálogo fuera del alcance; rollback';
      end if;
      if pg_catalog.has_table_privilege('authenticated', v_clients, 'DELETE')
         or exists (select from pg_catalog.pg_policy where polrelid = v_clients and polcmd in ('*','d')) then
        raise exception '0456: DELETE efectivo o policy residual; rollback';
      end if;
      raise notice '0456: SELECT y catálogo dependiente preservados; huella %, INSERT/UPDATE RBAC y DELETE denegado', v_after;
    end if;
  end loop;
  perform pg_catalog.set_config('lock_timeout', v_lock_timeout, true);
end;
$migration$;
