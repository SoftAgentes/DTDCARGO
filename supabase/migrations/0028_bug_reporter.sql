-- ─────────────────────────────────────────────────────────────
-- SDD-0036 Fase 1: Bug Reporter · schema + RPCs + triggers + RLS
--
-- Contenido:
--   - 5 enums (category, severity, state, author_type, notif_type)
--   - 7 tablas (bug_reports, bug_attachments, bug_tech_data,
--               bug_messages, bug_timeline, user_notification_prefs,
--               bug_notifications)
--   - 3 RPCs (next_bug_folio, bug_advance_state, bug_increment_duplicate)
--   - 2 triggers (state transition guard + updated_at)
--   - RLS: reporter ve sus bugs, admin del tenant ve todos
--
-- Reportador NO sabe que se captura console/network/replay
-- (decisión D3 del handoff). bug_tech_data se llena al INSERT
-- desde el server action con datos del hook useBugTechCapture().
--
-- Dedup: el endpoint POST /api/studio/bugs computa
-- sha256(module || url || stack_signature) en TS, hace SELECT
-- buscando bug vivo con ese hash en el tenant. Si match,
-- incrementa duplicate_count del original (via RPC) y NO crea
-- nuevo. La lógica de redirección vive en el endpoint, no en
-- trigger (simplifica + permite return de id original).
-- ─────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────

create type bug_category as enum ('error', 'improve', 'suggest', 'question');

create type bug_severity as enum ('baja', 'media', 'alta', 'critica');

create type bug_state as enum (
  'nuevo',
  'triaje',
  'espera',
  'progreso',
  'resuelto',
  'descartado'
);

create type bug_author_type as enum ('user', 'admin', 'system');

create type bug_notif_type as enum (
  'new_reply',
  'state_change',
  'resolved',
  'critical_alert',
  'duplicate_detected'
);

-- ─────────────────────────────────────────────────────────────
-- 1. bug_reports · entidad central
-- ─────────────────────────────────────────────────────────────

create table public.bug_reports (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  folio            text not null,                                       -- BUG-XXXXX
  reporter_id      uuid not null references auth.users(id) on delete restrict,
  category         bug_category not null,
  severity         bug_severity,                                        -- solo si category='error'
  state            bug_state not null default 'nuevo',
  progress_pct     int generated always as (
                     case state
                       when 'nuevo' then 0
                       when 'triaje' then 25
                       when 'espera' then 40
                       when 'progreso' then 65
                       when 'resuelto' then 100
                       else 0
                     end
                   ) stored,
  title            text not null,
  description      text not null,
  module           text not null,                                       -- ruta o slug del módulo
  url              text,                                                -- URL donde ocurrió
  build_sha        text,                                                -- de NEXT_PUBLIC_BUILD_SHA / VERCEL_GIT_COMMIT_SHA
  browser_info     jsonb not null default '{}'::jsonb,                  -- { browser, os, viewport }
  duplicate_hash   text,                                                -- sha256 (module + url + stack_signature)
  duplicate_count  int not null default 0,
  duplicate_of_id  uuid references public.bug_reports(id) on delete set null,
  eta_days         int,
  admin_thanks     text,                                                -- mensaje custom del admin
  commit_url       text,                                                -- URL al PR/commit que cierra
  taken_by         uuid references auth.users(id) on delete set null,   -- admin que tomó
  taken_at         timestamptz,
  resolved_at      timestamptz,
  discarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, folio),

  -- Severity solo aplica a error
  constraint bug_reports_severity_only_error
    check (severity is null or category = 'error')
);

comment on table public.bug_reports is
  'Entidad central del Bug Reporter (SDD-0036). Folio BUG-XXXXX por tenant. State machine cerrada con progress_pct calculado. Dedup por hash en endpoint (no trigger).';

create index bug_reports_tenant_state_idx
  on public.bug_reports (tenant_id, state, created_at desc)
  where state not in ('resuelto', 'descartado');

create index bug_reports_tenant_all_idx
  on public.bug_reports (tenant_id, created_at desc);

create index bug_reports_reporter_idx
  on public.bug_reports (reporter_id, created_at desc);

create index bug_reports_duplicate_hash_idx
  on public.bug_reports (tenant_id, duplicate_hash)
  where duplicate_hash is not null and state not in ('resuelto', 'descartado');

create index bug_reports_module_idx
  on public.bug_reports (tenant_id, module, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 2. bug_attachments · fotos del reportador (max 5 por bug)
-- ─────────────────────────────────────────────────────────────

create table public.bug_attachments (
  id              uuid primary key default gen_random_uuid(),
  bug_id          uuid not null references public.bug_reports(id) on delete cascade,
  storage_path    text not null,                              -- bug/<tenant>/<bug_id>/<ts>.<ext>
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  width_px        int,
  height_px       int,
  uploaded_by     uuid not null references auth.users(id) on delete cascade,
  uploaded_at     timestamptz not null default now()
);

comment on table public.bug_attachments is
  'Adjuntos del reportador (fotos). Max 5MB por archivo (CHECK). Max 5 por bug enforced en endpoint. Bucket receipt-photos con prefijo bug/<tenant>/<bug_id>/.';

create index bug_attachments_bug_idx on public.bug_attachments (bug_id, uploaded_at);

-- ─────────────────────────────────────────────────────────────
-- 3. bug_tech_data · auto-captura técnica (invisible al user)
-- ─────────────────────────────────────────────────────────────

create table public.bug_tech_data (
  bug_id              uuid primary key references public.bug_reports(id) on delete cascade,
  console_logs        jsonb not null default '[]'::jsonb,         -- [{level, message, stack, ts}]
  network_requests    jsonb not null default '[]'::jsonb,         -- [{url, method, status, ms, ts}]
  session_replay_url  text,                                        -- bucket path al .json.gz de rrweb
  environment         jsonb not null default '{}'::jsonb,         -- { browser, os, viewport, locale, tz }
  captured_at         timestamptz not null default now()
);

comment on table public.bug_tech_data is
  'Auto-captura técnica (D3 del handoff). console_logs últimos 3, network_requests últimos 5, replay 30s. Datos sanitizados (Authorization headers + tokens redacted) en sanitizer client-side Fase 4.';

-- ─────────────────────────────────────────────────────────────
-- 4. bug_messages · conversación admin ↔ reportador
-- ─────────────────────────────────────────────────────────────

create table public.bug_messages (
  id            uuid primary key default gen_random_uuid(),
  bug_id        uuid not null references public.bug_reports(id) on delete cascade,
  author_id     uuid references auth.users(id) on delete set null,
  author_type   bug_author_type not null,
  body          text not null check (length(trim(body)) > 0),
  created_at    timestamptz not null default now()
);

comment on table public.bug_messages is
  'Hilo de conversación del bug. author_type=system para mensajes automáticos (state changes, commit detected).';

create index bug_messages_bug_idx on public.bug_messages (bug_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 5. bug_timeline · activity log
-- ─────────────────────────────────────────────────────────────

create table public.bug_timeline (
  id            uuid primary key default gen_random_uuid(),
  bug_id        uuid not null references public.bug_reports(id) on delete cascade,
  event_type    text not null check (event_type in (
                  'created',
                  'state_change',
                  'message',
                  'attachment',
                  'taken',
                  'eta_set',
                  'commit',
                  'resolved',
                  'discarded',
                  'duplicate_detected'
                )),
  actor_id      uuid references auth.users(id) on delete set null,
  actor_type    bug_author_type not null default 'system',
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.bug_timeline is
  'Activity log append-only. payload contiene contexto (from_state/to_state, message_id, etc.).';

create index bug_timeline_bug_idx on public.bug_timeline (bug_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 6. user_notification_prefs · 4 canales × eventos por user
-- ─────────────────────────────────────────────────────────────

create table public.user_notification_prefs (
  user_id                    uuid primary key references auth.users(id) on delete cascade,
  channel_inapp              boolean not null default true,
  channel_push               boolean not null default false,
  channel_email              boolean not null default true,
  channel_telegram           boolean not null default false,
  telegram_chat_id           text,
  push_subscription          jsonb,                          -- Web Push subscription object
  notify_on_state_change     boolean not null default true,
  notify_on_admin_reply      boolean not null default true,
  notify_on_resolved         boolean not null default true,
  notify_on_critical         boolean not null default true,
  sound_enabled              boolean not null default true,
  updated_at                 timestamptz not null default now()
);

comment on table public.user_notification_prefs is
  'Preferencias de notificación por user (no por tenant: vive con auth.uid). Default in-app+email ON, push+Telegram OFF.';

-- ─────────────────────────────────────────────────────────────
-- 7. bug_notifications · outbox de notificaciones
-- ─────────────────────────────────────────────────────────────

create table public.bug_notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  bug_id        uuid references public.bug_reports(id) on delete cascade,
  type          bug_notif_type not null,
  payload       jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  delivered_inapp_at      timestamptz,
  delivered_push_at       timestamptz,
  delivered_email_at      timestamptz,
  delivered_telegram_at   timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.bug_notifications is
  'Outbox de notificaciones. Una fila por (user, evento). delivered_*_at se setean por el worker de cada canal en Fase 5.';

create index bug_notifications_user_unread_idx
  on public.bug_notifications (user_id, created_at desc)
  where read_at is null;

create index bug_notifications_user_all_idx
  on public.bug_notifications (user_id, created_at desc);

create index bug_notifications_bug_idx
  on public.bug_notifications (bug_id) where bug_id is not null;

-- ─────────────────────────────────────────────────────────────
-- RPC 1: next_bug_folio · genera BUG-XXXXX (5 dígitos) por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_bug_folio(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(folio from 'BUG-(\d+)$'))::int), 0)
    into v_max
  from public.bug_reports
  where tenant_id = p_tenant_id
    and folio like 'BUG-%';

  return 'BUG-' || lpad((v_max + 1)::text, 5, '0');
end;
$$;

comment on function public.next_bug_folio(uuid) is
  'Próximo folio BUG-XXXXX (5 dígitos) por tenant. Capacidad 99,999 bugs antes de overflow (V2 expandir a 6 dígitos).';

grant execute on function public.next_bug_folio(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC 2: bug_advance_state · transición + auto-stamp + timeline
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_advance_state(
  p_bug_id      uuid,
  p_new_state   bug_state,
  p_note        text default null
)
returns public.bug_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor        uuid := auth.uid();
  v_tenant_id    uuid;
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  -- Lock + leer bug
  select * into v_row
    from public.bug_reports
   where id = p_bug_id
   for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  -- Validar tenant del caller
  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  -- Solo admin puede mover estados (excepto si el reportador responde a 'espera')
  if v_actor_role <> 'admin' then
    -- Reportador puede mover de 'espera' a 'triaje' al responder (vía mensaje, hace la RPC)
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  -- State machine guards
  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  -- Whitelist de transiciones
  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  -- Update
  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case
                           when p_new_state = 'triaje' and taken_by is null then v_actor
                           else taken_by
                         end,
         taken_at      = case
                           when p_new_state = 'triaje' and taken_at is null then now()
                           else taken_at
                         end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- Timeline entry
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id,
    'state_change',
    v_actor,
    case when v_actor_role = 'admin' then 'admin' else 'user' end,
    jsonb_build_object(
      'from_state', v_old_state,
      'to_state',   p_new_state,
      'note',       p_note
    )
  );

  return v_row;
end;
$$;

comment on function public.bug_advance_state(uuid, bug_state, text) is
  'Transición de estado con validación. Auto-stamp taken_at/resolved_at/discarded_at. Inserta timeline entry. Solo admin (excepto reportador respondiendo a espera).';

grant execute on function public.bug_advance_state(uuid, bug_state, text) to authenticated;
revoke execute on function public.bug_advance_state(uuid, bug_state, text) from public, anon;

-- ─────────────────────────────────────────────────────────────
-- RPC 3: bug_increment_duplicate · al detectar match de hash
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_increment_duplicate(
  p_original_id  uuid
)
returns public.bug_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_tenant_id  uuid;
  v_row        public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  -- Validar tenant
  select tenant_id into v_tenant_id
    from public.bug_reports
   where id = p_original_id;

  if v_tenant_id is null then
    raise exception 'Bug original no encontrado' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.user_tenants
    where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null
  ) then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  update public.bug_reports
     set duplicate_count = duplicate_count + 1,
         updated_at      = now()
   where id = p_original_id
   returning * into v_row;

  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (p_original_id, 'duplicate_detected', v_actor, 'system',
          jsonb_build_object('new_count', v_row.duplicate_count));

  return v_row;
end;
$$;

comment on function public.bug_increment_duplicate(uuid) is
  'Incrementa duplicate_count del bug original cuando el endpoint POST /api/studio/bugs detecta hash match. Inserta timeline entry.';

grant execute on function public.bug_increment_duplicate(uuid) to authenticated;
revoke execute on function public.bug_increment_duplicate(uuid) from public, anon;

-- ─────────────────────────────────────────────────────────────
-- Trigger: updated_at auto en bug_reports
-- ─────────────────────────────────────────────────────────────

create or replace function public.bug_reports_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bug_reports_updated_at_trigger
  before update on public.bug_reports
  for each row execute function public.bug_reports_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.bug_reports             enable row level security;
alter table public.bug_attachments         enable row level security;
alter table public.bug_tech_data           enable row level security;
alter table public.bug_messages            enable row level security;
alter table public.bug_timeline            enable row level security;
alter table public.user_notification_prefs enable row level security;
alter table public.bug_notifications       enable row level security;

-- Helper inline para no repetir: caller es admin del tenant del bug
-- (no creamos function aparte porque no_olvidar_check_admin no aplica)

-- ── bug_reports: reporter ve sus bugs, admin del tenant ve todos ──
create policy "bug_reports_reporter_or_admin_select"
  on public.bug_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = bug_reports.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

-- INSERT: el reporter es el caller, tenant_id matchea su membership
create policy "bug_reports_reporter_insert"
  on public.bug_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and tenant_id in (
      select tenant_id from public.user_tenants
      where user_id = (select auth.uid()) and disabled_at is null
    )
  );

-- UPDATE: solo admin del tenant (las transiciones de estado pasan por RPC)
create policy "bug_reports_admin_update"
  on public.bug_reports for update to authenticated
  using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = bug_reports.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

-- DELETE: bloqueado (soft-delete con state='descartado')
create policy "bug_reports_no_delete"
  on public.bug_reports for delete using (false);

-- ── bug_attachments: SELECT si tiene acceso al bug ──
create policy "bug_attachments_select"
  on public.bug_attachments for select to authenticated
  using (
    exists (
      select 1 from public.bug_reports b
      where b.id = bug_attachments.bug_id
        and (
          b.reporter_id = (select auth.uid())
          or exists (
            select 1 from public.user_tenants ut
            where ut.user_id = (select auth.uid())
              and ut.tenant_id = b.tenant_id
              and ut.role = 'admin'
              and ut.disabled_at is null
          )
        )
    )
  );

-- INSERT: solo el reporter (sube fotos de su propio bug)
create policy "bug_attachments_reporter_insert"
  on public.bug_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.bug_reports b
      where b.id = bug_attachments.bug_id
        and b.reporter_id = (select auth.uid())
    )
  );

create policy "bug_attachments_no_update"
  on public.bug_attachments for update using (false);

create policy "bug_attachments_no_delete"
  on public.bug_attachments for delete using (false);

-- ── bug_tech_data: SELECT igual que reports (admin ve todo) ──
create policy "bug_tech_data_select"
  on public.bug_tech_data for select to authenticated
  using (
    exists (
      select 1 from public.bug_reports b
      where b.id = bug_tech_data.bug_id
        and (
          b.reporter_id = (select auth.uid())
          or exists (
            select 1 from public.user_tenants ut
            where ut.user_id = (select auth.uid())
              and ut.tenant_id = b.tenant_id
              and ut.role = 'admin'
              and ut.disabled_at is null
          )
        )
    )
  );

-- INSERT: solo via service_role (server action al crear bug)
create policy "bug_tech_data_no_insert_authenticated"
  on public.bug_tech_data for insert to authenticated with check (false);

create policy "bug_tech_data_no_update"
  on public.bug_tech_data for update using (false);

create policy "bug_tech_data_no_delete"
  on public.bug_tech_data for delete using (false);

-- ── bug_messages: SELECT igual que reports ──
create policy "bug_messages_select"
  on public.bug_messages for select to authenticated
  using (
    exists (
      select 1 from public.bug_reports b
      where b.id = bug_messages.bug_id
        and (
          b.reporter_id = (select auth.uid())
          or exists (
            select 1 from public.user_tenants ut
            where ut.user_id = (select auth.uid())
              and ut.tenant_id = b.tenant_id
              and ut.role = 'admin'
              and ut.disabled_at is null
          )
        )
    )
  );

-- INSERT: reporter o admin del tenant del bug
create policy "bug_messages_insert"
  on public.bug_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.bug_reports b
      where b.id = bug_messages.bug_id
        and (
          b.reporter_id = (select auth.uid())
          or exists (
            select 1 from public.user_tenants ut
            where ut.user_id = (select auth.uid())
              and ut.tenant_id = b.tenant_id
              and ut.role = 'admin'
              and ut.disabled_at is null
          )
        )
    )
  );

create policy "bug_messages_no_update"
  on public.bug_messages for update using (false);

create policy "bug_messages_no_delete"
  on public.bug_messages for delete using (false);

-- ── bug_timeline: SELECT igual; INSERT solo via RPC/service_role ──
create policy "bug_timeline_select"
  on public.bug_timeline for select to authenticated
  using (
    exists (
      select 1 from public.bug_reports b
      where b.id = bug_timeline.bug_id
        and (
          b.reporter_id = (select auth.uid())
          or exists (
            select 1 from public.user_tenants ut
            where ut.user_id = (select auth.uid())
              and ut.tenant_id = b.tenant_id
              and ut.role = 'admin'
              and ut.disabled_at is null
          )
        )
    )
  );

create policy "bug_timeline_no_direct_insert"
  on public.bug_timeline for insert to authenticated with check (false);

create policy "bug_timeline_no_update"
  on public.bug_timeline for update using (false);

create policy "bug_timeline_no_delete"
  on public.bug_timeline for delete using (false);

-- ── user_notification_prefs: solo el dueño ──
create policy "user_notification_prefs_owner_select"
  on public.user_notification_prefs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_notification_prefs_owner_insert"
  on public.user_notification_prefs for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_notification_prefs_owner_update"
  on public.user_notification_prefs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_notification_prefs_no_delete"
  on public.user_notification_prefs for delete using (false);

-- ── bug_notifications: solo el dueño ──
create policy "bug_notifications_owner_select"
  on public.bug_notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "bug_notifications_owner_update"
  on public.bug_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "bug_notifications_no_direct_insert"
  on public.bug_notifications for insert to authenticated with check (false);

create policy "bug_notifications_no_delete"
  on public.bug_notifications for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- GRANTs
-- ─────────────────────────────────────────────────────────────

grant select, insert on public.bug_reports             to authenticated;
grant update         on public.bug_reports             to authenticated;     -- RLS filtra admin
grant select, insert on public.bug_attachments         to authenticated;
grant select         on public.bug_tech_data           to authenticated;
grant insert         on public.bug_tech_data           to service_role;
grant select, insert on public.bug_messages            to authenticated;
grant select         on public.bug_timeline            to authenticated;
grant insert         on public.bug_timeline            to service_role;
grant select, insert, update on public.user_notification_prefs to authenticated;
grant select, update on public.bug_notifications       to authenticated;
grant insert         on public.bug_notifications       to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (in-app notif via subscribe en Fase 5)
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.bug_notifications';
    execute 'alter publication supabase_realtime add table public.bug_reports';
  end if;
exception when others then
  raise notice 'No se pudo agregar a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
