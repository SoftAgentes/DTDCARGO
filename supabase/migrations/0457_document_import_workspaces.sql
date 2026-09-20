-- SDD-0473. Prepared for review; NOT applied to production.
-- All capabilities are resolved by the trusted HTTP boundary. No browser SQL access.
-- A heterogeneous quantity (e.g. sets + meters) has no scalar sum.
alter table public.packing_list_submissions alter column total_qty drop not null;
create table public.document_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  client_id uuid references public.clients(id),
  prealerta_id uuid unique references public.prealertas(id),
  anonymous_hash text unique,
  expires_at timestamptz,
  draft jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  confirmed_revision integer,
  confirmed_submission_id uuid references public.packing_list_submissions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 2000000),
  check ((anonymous_hash is not null and expires_at is not null and tenant_id is null and client_id is null and prealerta_id is null)
    or (anonymous_hash is null and expires_at is null and tenant_id is not null and client_id is not null))
);
create index document_workspaces_client_idx on public.document_workspaces(tenant_id,client_id);
create index document_workspaces_expiry_idx on public.document_workspaces(expires_at) where expires_at is not null;

create table public.document_workspace_versions (
  workspace_id uuid not null references public.document_workspaces(id) on delete cascade,
  revision integer not null,
  draft jsonb not null,
  actor_kind text not null check (actor_kind in ('client','supplier','anonymous')),
  actor_id text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (workspace_id, revision)
);
create table public.document_workspace_commands (
  workspace_id uuid not null references public.document_workspaces(id) on delete cascade,
  command_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id,command_id)
);
create table public.document_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.document_workspaces(id) on delete cascade,
  request_key uuid not null,
  file_name text not null check (length(file_name) between 1 and 200),
  file_kind text not null check (file_kind in ('packing_list','invoice','proforma','combined','unknown')),
  storage_path text not null unique,
  content_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  sha256 text,
  status text not null default 'uploading' check (status in ('uploading','queued','processing','ready','partial','failed','cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,request_key)
);
create unique index document_import_content_idx on public.document_import_jobs(workspace_id,sha256) where sha256 is not null and status <> 'cancelled';
create index document_import_queue_idx on public.document_import_jobs(status,available_at);
create table public.document_import_limits (
  scope text not null,
  window_start timestamptz not null,
  used integer not null check (used >= 0),
  primary key(scope,window_start)
);
create table public.document_group_boxes (
  workspace_id uuid not null references public.document_workspaces(id),
  group_id text not null,
  box_id uuid primary key references public.warehouse_boxes(id),
  revision integer not null,
  contents jsonb not null,
  created_at timestamptz not null default now()
);
create index document_group_boxes_workspace_idx on public.document_group_boxes(workspace_id,group_id);
create table public.document_estimate_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  created_by uuid not null references auth.users(id),
  inputs jsonb not null,
  rates jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS is defense in depth: API clients never receive table privileges.
do $$ declare t text; begin
  foreach t in array array['document_workspaces','document_workspace_versions','document_workspace_commands','document_import_jobs','document_import_limits','document_group_boxes','document_estimate_snapshots'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select, insert, update, delete on public.%I to service_role',t);
  end loop;
end $$;
-- Versions/commands are append-only except whole expired anonymous workspace cleanup.
revoke update, delete on public.document_workspace_versions, public.document_workspace_commands from service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('document-imports','document-imports',false,15728640,array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- Initial legacy snapshot and workspace are created together, before any edits.
create function public.create_document_workspace(p_tenant_id uuid,p_client_id uuid,p_prealerta_id uuid,
  p_draft jsonb,p_anonymous_hash text,p_expires_at timestamptz,p_submission_id uuid)
returns public.document_workspaces language plpgsql security invoker set search_path = '' as $$
declare w public.document_workspaces%rowtype; begin
  if p_submission_id is not null and not exists(select 1 from public.packing_list_submissions s
    where s.id=p_submission_id and s.prealerta_id=p_prealerta_id and s.tenant_id=p_tenant_id and s.is_current and s.deleted_at is null) then
    raise exception 'legacy_submission_changed' using errcode='40001'; end if;
  insert into public.document_workspaces(tenant_id,client_id,prealerta_id,draft,anonymous_hash,expires_at,confirmed_revision,confirmed_submission_id)
    values(p_tenant_id,p_client_id,p_prealerta_id,p_draft,p_anonymous_hash,p_expires_at,case when p_submission_id is not null then 0 end,p_submission_id) returning * into w;
  if p_submission_id is not null then
    insert into public.document_workspace_versions(workspace_id,revision,draft,actor_kind,actor_id,confirmed)
      values(w.id,0,p_draft,'supplier','legacy-submission:'||p_submission_id::text,true);
  end if;
  return w;
end $$;

-- Atomic quotas and reserved token budget. A request rejected by either limit performs no work.
create function public.reserve_document_import_limit(p_scope text,p_window timestamptz,p_units integer,p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer; begin
  if p_units < 1 or p_limit < p_units or length(p_scope) > 200 then return false; end if;
  insert into public.document_import_limits(scope,window_start,used) values(p_scope,p_window,p_units)
  on conflict(scope,window_start) do update set used = public.document_import_limits.used + excluded.used
    where public.document_import_limits.used + excluded.used <= p_limit
  returning used into n;
  return n is not null;
end $$;

-- Claim and fencing token prevent a late worker from overwriting a retry.
create function public.claim_document_import_job(p_job_id uuid default null)
returns setof public.document_import_jobs language plpgsql security invoker set search_path = '' as $$
declare j uuid; begin
  select x.id into j from public.document_import_jobs x join public.document_workspaces w on w.id=x.workspace_id
  where (p_job_id is null or x.id=p_job_id) and (w.expires_at is null or w.expires_at > now())
    and x.attempts < 3 and x.available_at <= now()
    and (x.status='queued' or (x.status='processing' and x.lease_until < now()))
  order by x.created_at for update of x skip locked limit 1;
  if j is null then return; end if;
  return query update public.document_import_jobs set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
    where id=j returning *;
end $$;

-- Atomic draft CAS + audit + optional submission + exact physical box association.
-- Existing submit_packing_list remains the authoritative versioned submission contract.
create function public.save_document_workspace(
  p_workspace_id uuid,p_expected_revision integer,p_draft jsonb,p_actor_kind text,p_actor_id text,
  p_command_id uuid,p_confirmation jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.document_workspaces%rowtype; pr public.prealertas%rowtype;
  receipt jsonb; old_command public.document_workspace_commands%rowtype;
  payload_hash text; submission public.packing_list_submissions%rowtype;
  g jsonb; v_box uuid; box_ids uuid[]; box_cursor integer := 1; group_size integer;
  has_received boolean; expected_boxes integer; actual_boxes integer;
begin
  select * into w from public.document_workspaces where id=p_workspace_id for update;
  if w.id is null or (w.expires_at is not null and w.expires_at <= now()) then raise exception 'workspace_not_found' using errcode='P0002'; end if;
  if p_actor_kind not in ('client','supplier','anonymous') or p_actor_id is null then raise exception 'actor_required' using errcode='22023'; end if;
  if jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text)>2000000 then raise exception 'invalid_document' using errcode='22023'; end if;
  payload_hash := md5(p_draft::text || coalesce(p_confirmation::text,'') || p_actor_kind || p_actor_id);
  select * into old_command from public.document_workspace_commands where workspace_id=w.id and command_id=p_command_id;
  if found then
    if old_command.payload_hash <> payload_hash then raise exception 'idempotency_conflict' using errcode='40001'; end if;
    return old_command.result;
  end if;
  if w.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
  if w.prealerta_id is not null then
    select * into pr from public.prealertas where id=w.prealerta_id and tenant_id=w.tenant_id and deleted_at is null for update;
    if pr.id is null or pr.status='cancelada' then raise exception 'purchase_unavailable' using errcode='P0002'; end if;
    if not exists(select 1 from public.clients c where c.id=w.client_id and c.tenant_id=w.tenant_id and c.markbox=pr.client_markbox and c.deleted_at is null) then
      raise exception 'purchase_owner_changed' using errcode='42501'; end if;
  end if;
  if p_confirmation is not null then
    if p_actor_kind <> 'supplier' or pr.id is null then raise exception 'supplier_confirmation_required' using errcode='42501'; end if;
    expected_boxes := (p_confirmation->'totals'->>'ctns')::integer;
    if expected_boxes < 1 or expected_boxes > 1000 or (p_confirmation->'totals'->>'weight')::numeric <= 0
      or (p_confirmation->'totals'->>'cbm')::numeric <= 0 then raise exception 'missing_logistics' using errcode='22023'; end if;
    select exists(select 1 from public.warehouse_boxes where prealerta_id=pr.id and tenant_id=w.tenant_id
      and deleted_at is null and (receipt_id is not null or status <> 'esperada')) into has_received;
    if has_received and (w.confirmed_revision is null or
       (select v.draft->'groups' from public.document_workspace_versions v where v.workspace_id=w.id and v.revision=w.confirmed_revision) is distinct from p_draft->'groups') then
      raise exception 'received_boxes_require_operations' using errcode='22023'; end if;
    select * into submission from public.submit_packing_list(
      p_prealerta_id=>pr.id,p_tenant_id=>w.tenant_id,p_client_markbox=>pr.client_markbox,
      p_currency=>(p_confirmation->>'currency')::public.packing_list_currency,
      p_doc_date=>nullif(p_confirmation->>'docDate','')::date,
      p_supplier_company=>p_confirmation->>'supplierCompany',p_supplier_contact=>p_confirmation->>'supplierContact',
      p_supplier_email=>p_confirmation->>'supplierEmail',p_supplier_wechat=>p_confirmation->>'supplierWechat',
      p_supplier_phone=>p_confirmation->>'supplierPhone',p_supplier_note=>p_confirmation->>'supplierNote',
      p_supplier_address=>p_confirmation->>'supplierAddress',p_supplier_city=>p_confirmation->>'supplierCity',
      p_rows=>p_confirmation->'rows',p_total_ctns=>(p_confirmation->'totals'->>'ctns')::numeric,
      p_total_qty=>(p_confirmation->'totals'->>'qty')::numeric,p_total_amount=>(p_confirmation->'totals'->>'amount')::numeric,
      p_total_weight=>(p_confirmation->'totals'->>'weight')::numeric,p_total_cbm=>(p_confirmation->'totals'->>'cbm')::numeric,
      p_submit_ip=>null,p_user_agent=>'SDD-0473 shared document');
    if (select count(distinct coalesce(value->>'uom','pcs')) from jsonb_array_elements(p_confirmation->'rows')) > 1 then
      update public.packing_list_submissions set total_qty=null where id=submission.id;
    end if;
    if not has_received then
      select array_agg(id order by seq,id),count(*) into box_ids,actual_boxes from public.warehouse_boxes
        where prealerta_id=pr.id and tenant_id=w.tenant_id and deleted_at is null and status='esperada';
      if actual_boxes <> expected_boxes then raise exception 'physical_box_count_mismatch' using errcode='22023'; end if;
      delete from public.document_group_boxes where workspace_id=w.id;
      for g in select value from jsonb_array_elements(p_draft->'groups') loop
        group_size := (g->>'cartons')::integer;
        if group_size < 1 then raise exception 'invalid_group_count' using errcode='22023'; end if;
        for i in 1..group_size loop
          v_box := box_ids[box_cursor];
          if v_box is null then raise exception 'group_box_count_mismatch' using errcode='22023'; end if;
          insert into public.document_group_boxes(workspace_id,group_id,box_id,revision,contents)
            values(w.id,g->>'id',v_box,w.revision+1,jsonb_build_object('scope','group_total','cartons',group_size,'items',g->'items'));
          box_cursor := box_cursor+1;
        end loop;
      end loop;
      if box_cursor <> actual_boxes+1 then raise exception 'group_box_count_mismatch' using errcode='22023'; end if;
    end if;
  end if;
  update public.document_workspaces set draft=p_draft,revision=revision+1,updated_at=now(),
    confirmed_revision=case when p_confirmation is not null then revision+1 else confirmed_revision end,
    confirmed_submission_id=coalesce(submission.id,confirmed_submission_id) where id=w.id;
  insert into public.document_workspace_versions(workspace_id,revision,draft,actor_kind,actor_id,confirmed)
    values(w.id,w.revision+1,p_draft,p_actor_kind,p_actor_id,p_confirmation is not null);
  receipt:=jsonb_build_object('revision',w.revision+1,'confirmed',p_confirmation is not null,
    'folio',submission.folio,'versionNo',submission.version_no,'submissionId',submission.id);
  insert into public.document_workspace_commands(workspace_id,command_id,payload_hash,result) values(w.id,p_command_id,payload_hash,receipt);
  return receipt;
end $$;

revoke all on function public.reserve_document_import_limit(text,timestamptz,integer,integer),
  public.claim_document_import_job(uuid), public.save_document_workspace(uuid,integer,jsonb,text,text,uuid,jsonb),
  public.create_document_workspace(uuid,uuid,uuid,jsonb,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.reserve_document_import_limit(text,timestamptz,integer,integer),
  public.claim_document_import_job(uuid), public.save_document_workspace(uuid,integer,jsonb,text,text,uuid,jsonb),
  public.create_document_workspace(uuid,uuid,uuid,jsonb,text,timestamptz,uuid) to service_role;
