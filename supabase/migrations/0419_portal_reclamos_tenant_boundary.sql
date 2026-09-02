-- 0419 · SDD-0363 · Reclamos/evidencias Portal ligados al principal y tenant.
-- Dos policies SELECT. Sin DML, ACL, funciones, triggers ni Storage.
-- Requiere 0080/0152/0153/0155. Aplicación Cloud transaccional y nominal;
-- no requiere nueva RPC ni despliegue previo de la aplicación.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0419: requiere auth.uid()';
  end if;
  foreach v_table in array array[
    'client_users', 'clients', 'client_claims', 'client_claim_evidence'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0419: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(tablename, policyname, cmd) as (values
      ('client_claims', 'client_claims by tenant', 'ALL'),
      ('client_claims', 'client_claims portal self read', 'SELECT'),
      ('client_claim_evidence', 'client_claim_evidence by tenant', 'ALL'),
      ('client_claim_evidence', 'client_claim_evidence portal self read', 'SELECT')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename in ('client_claims', 'client_claim_evidence')
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0419: inventario de policies ausente o con drift; revisar antes de aplicar';
  end if;
end;
$preflight$;

-- La FK de cliente es opcional (snapshot histórico de 0152); si existe,
-- debe coincidir. Archivar/eliminar un embarque no retira el reclamo propio.
alter policy "client_claims portal self read" on public.client_claims
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = client_claims.tenant_id
        and c.markbox = client_claims.client_markbox
        and (client_claims.client_id is null or client_claims.client_id = c.id)
    )
  );

-- La fila hija es la autorización previa a firmar su archivo en Portal:
-- no basta un snapshot coincidente sin padre vivo y coherente.
alter policy "client_claim_evidence portal self read" on public.client_claim_evidence
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.client_claims claim
        on claim.id = client_claim_evidence.claim_id and claim.tenant_id = cu.tenant_id
          and claim.client_markbox = c.markbox and claim.deleted_at is null
          and (claim.client_id is null or claim.client_id = c.id)
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = client_claim_evidence.tenant_id
        and c.markbox = client_claim_evidence.client_markbox
    )
  );

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename in ('client_claims', 'client_claim_evidence')
        and policyname like '% portal %' and cmd = 'SELECT'
        and roles = array['authenticated']::name[] and permissive = 'PERMISSIVE'
        and qual like '%client_users%' and qual like '%auth.uid()%'
        and qual like '%tenant_id%' and qual like '%client_id%'
        and qual like '%client_markbox%' and with_check is null
    ) <> 2 then
    raise exception '0419: frontera Portal final inválida';
  end if;
end;
$postflight$;
