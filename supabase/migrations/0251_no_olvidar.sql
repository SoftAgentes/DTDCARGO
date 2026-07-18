-- ─────────────────────────────────────────────────────────────
-- SDD-0025 Fase 1 · Schema base del módulo No-Olvidar interno DTD-CARGO
--
-- (Renumerada 2026-07-18 a 0251: nunca se aplicó a prod. Su número previo 0250
--  colisionaba con 0250_referral_settings (SDD-0159) al traer main a la rama; el
--  0017 original quedaba por debajo del máximo aplicado. Set no_olvidar contiguo:
--  0251 crear → 0252 hardening → 0253 authz. Se edita en sitio — bytea→text del
--  material cripto — porque sigue SIN aplicar a prod.)
--
-- Contenido:
--   - 6 enums
--   - 6 tablas (no_olvidar_items, no_olvidar_user_keys, no_olvidar_access_log,
--     no_olvidar_recovery_requests, no_olvidar_kek_versions, no_olvidar_config)
--   - 3 RPCs (no_olvidar_get_active_kek_version, no_olvidar_rotate_kek,
--     no_olvidar_check_admin)
--   - Trigger auto-creación no_olvidar_user_keys en signup (con guard de
--     tenant metadata)
--   - RLS estricta por user_id (no por tenant — ver spec §4.8)
--   - Audit log IMMUTABLE (RLS bloquea UPDATE+DELETE para todos
--     incluido service_role — ver spec §4.7)
--   - Seed de no_olvidar_config con defaults
--
-- NO incluido en esta migración:
--   - KEK initial creation (manual post-deploy via vault.create_secret,
--     ver spec §7.1)
--   - Crypto code (Fase 2 con libsodium-wrappers)
--   - UI (Fase 3+)
--
-- Prereq:
--   - Extension `vault` de Supabase habilitada (confirmado founder).
--   - Tabla `auth.users` (provista por Supabase Auth).
-- ─────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────
create type no_olvidar_category as enum ('login', 'note', 'card', 'totp');

create type no_olvidar_audit_action as enum (
  'view',
  'copy',
  'edit',
  'create',
  'delete',
  'unlock',
  'recovery_requested',
  'recovery_approved',
  'recovery_executed',
  'kek_rotated'
);

create type no_olvidar_recovery_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'completed'
);

create type no_olvidar_user_role as enum ('member', 'admin');

create type no_olvidar_kek_status as enum ('active', 'legacy', 'revoked');

create type no_olvidar_alert_severity as enum ('info', 'warning', 'critical');

-- ─── Tabla: no_olvidar_items ──────────────────────────────────────
create table public.no_olvidar_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  category            no_olvidar_category not null,
  url                 text,
  username            text,                              -- NO encriptado (enable search)
  ciphertext          text not null,                     -- payload cifrado (base64)
  nonce               text not null,                     -- 24 bytes XChaCha20 (base64)
  dek_encrypted       text not null,                     -- DEK envuelto con KEK (base64)
  dek_nonce           text not null,                     -- (base64)
  key_version         int not null,                      -- versión de KEK usada
  notes_preview       text,                              -- primeros 60 chars en plaintext
  favorite            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.no_olvidar_items is
  'Items del No-Olvidar interno DTD-CARGO. RLS por user_id (spec §4.8). Soft delete via deleted_at.';

create index no_olvidar_items_user_id_active_idx
  on public.no_olvidar_items (user_id, category, favorite, updated_at desc)
  where deleted_at is null;
create index no_olvidar_items_user_id_search_idx
  on public.no_olvidar_items (user_id, name) where deleted_at is null;

-- ─── Tabla: no_olvidar_user_keys ──────────────────────────────────
create table public.no_olvidar_user_keys (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  has_master_password          boolean not null default false,
  master_password_verifier     text,                         -- Argon2id verifier (base64)
  master_password_salt         text,                         -- salt (base64)
  public_key                   text,                         -- Curve25519 (reservado sharing V2, base64)
  private_key_ciphertext       text,                         -- private key cifrada (base64)
  private_key_nonce            text,                         -- (base64)
  recovery_kit_hash            text,                         -- Argon2id hash de las 24 palabras (base64)
  recovery_kit_salt            text,                         -- (base64)
  totp_secret_ciphertext       text not null,                -- TOTP secret cifrado con KEK (base64)
  totp_secret_nonce            text not null,                -- (base64)
  totp_enabled                 boolean not null default false,
  setup_completed              boolean not null default false,
  role                         no_olvidar_user_role not null default 'member',
  last_unlock_at               timestamptz,
  failed_unlock_attempts       int not null default 0,
  locked_until                 timestamptz,                  -- rate limit brute-force
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

comment on table public.no_olvidar_user_keys is
  'Llaves y estado del No-Olvidar por usuario. 1 row por user. RLS estricta: solo el dueño puede SELECT/UPDATE su row.';

create index no_olvidar_user_keys_role_idx
  on public.no_olvidar_user_keys (role) where role = 'admin';

-- ─── Tabla: no_olvidar_access_log ─────────────────────────────────
create table public.no_olvidar_access_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  item_id       uuid references public.no_olvidar_items(id) on delete set null,
  action        no_olvidar_audit_action not null,
  ip_address    inet,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.no_olvidar_access_log is
  'Append-only audit log del No-Olvidar. IMMUTABLE: policies de UPDATE/DELETE devuelven false para TODOS, incluido service_role (spec §4.7).';

create index no_olvidar_access_log_user_id_idx
  on public.no_olvidar_access_log (user_id, created_at desc);
create index no_olvidar_access_log_item_id_idx
  on public.no_olvidar_access_log (item_id) where item_id is not null;
create index no_olvidar_access_log_action_idx
  on public.no_olvidar_access_log (action, created_at desc);

-- ─── Tabla: no_olvidar_recovery_requests ──────────────────────────
create table public.no_olvidar_recovery_requests (
  id                                  uuid primary key default gen_random_uuid(),
  requester_user_id                   uuid not null references auth.users(id) on delete cascade,
  reason                              text not null,
  status                              no_olvidar_recovery_status not null default 'pending',
  approvals                           jsonb not null default '[]'::jsonb,
  approvals_required                  int not null default 2,
  new_master_password_verifier        text,                        -- set al execute (base64)
  new_master_password_salt            text,                        -- (base64)
  expires_at                          timestamptz not null,        -- 24h desde creación
  completed_at                        timestamptz,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

comment on table public.no_olvidar_recovery_requests is
  'Pedidos de recovery M-of-N. approvals es array de {approver_id, approved_at, ip}. expires en 24h. Solo se ejecutan si approvals.length >= approvals_required.';

create index no_olvidar_recovery_requests_requester_idx
  on public.no_olvidar_recovery_requests (requester_user_id, created_at desc);
create index no_olvidar_recovery_requests_pending_idx
  on public.no_olvidar_recovery_requests (status, expires_at) where status = 'pending';

-- ─── Tabla: no_olvidar_kek_versions ───────────────────────────────
create table public.no_olvidar_kek_versions (
  version             int primary key,
  kek_secret_name   text not null,                       -- referencia a Supabase Vault
  status              no_olvidar_kek_status not null default 'active',
  activated_at        timestamptz not null default now(),
  deprecated_at       timestamptz,
  created_by          uuid references auth.users(id) on delete set null,
  notes               text
);

comment on table public.no_olvidar_kek_versions is
  'Registro de versiones de KEK. La KEK en sí vive en Supabase Vault extension (referenciada por kek_secret_name). Solo INSERT via RPC no_olvidar_rotate_kek.';

create index no_olvidar_kek_versions_active_idx
  on public.no_olvidar_kek_versions (status) where status = 'active';

-- ─── Tabla: no_olvidar_config ─────────────────────────────────────
create table public.no_olvidar_config (
  id                              int primary key default 1 check (id = 1),
  recovery_approvals_required     int not null default 2,
  session_timeout_minutes         int not null default 30,
  failed_attempts_lockout         int not null default 5,
  lockout_minutes                 int not null default 15,
  require_2fa                     boolean not null default true,
  clipboard_clear_seconds         int not null default 30,
  reveal_auto_hide_seconds        int not null default 3,
  hold_to_reveal                  boolean not null default true,
  blur_on_window_blur             boolean not null default true,
  forensic_watermark              boolean not null default true,
  block_copy_event                boolean not null default true,
  char_by_char_reveal             boolean not null default false,
  updated_at                      timestamptz not null default now(),
  updated_by                      uuid references auth.users(id) on delete set null
);

comment on table public.no_olvidar_config is
  '1 row global (CHECK id=1). SELECT permitido a todos los authenticated. UPDATE solo admins. Defaults siguen recomendaciones del spec.';

-- ─── RPC: no_olvidar_check_admin ──────────────────────────────────
create or replace function public.no_olvidar_check_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.no_olvidar_user_keys
    where user_id = p_user_id and role = 'admin'
  );
$$;

comment on function public.no_olvidar_check_admin is
  'Helper para RLS de recovery y admin views. Retorna true si el user_id es admin del No-Olvidar.';

-- ─── RPC: no_olvidar_get_active_kek_version ───────────────────────
create or replace function public.no_olvidar_get_active_kek_version()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select version from public.no_olvidar_kek_versions
  where status = 'active'
  order by activated_at desc
  limit 1;
$$;

comment on function public.no_olvidar_get_active_kek_version is
  'Devuelve la versión actual de KEK. Cachear en cliente 5 min. Si retorna NULL, el No-Olvidar no está inicializado (setup post-deploy pendiente, ver spec §7.1).';

-- ─── RPC: no_olvidar_rotate_kek ───────────────────────────────────
create or replace function public.no_olvidar_rotate_kek(
  p_new_secret_name text,
  p_actor uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_version int;
  v_new_version int;
  v_is_admin boolean;
begin
  -- Solo admins
  v_is_admin := public.no_olvidar_check_admin(p_actor);
  if not v_is_admin then
    raise exception 'Solo admins del No-Olvidar pueden rotar KEK' using errcode = '42501';
  end if;

  -- Validar nombre
  if p_new_secret_name is null or length(p_new_secret_name) < 3 then
    raise exception 'p_new_secret_name inválido' using errcode = '22023';
  end if;

  -- Versión actual
  select coalesce(max(version), 0) into v_old_version
  from public.no_olvidar_kek_versions;

  v_new_version := v_old_version + 1;

  -- Marcar todas las activas como legacy (debería haber 1 sola)
  update public.no_olvidar_kek_versions
  set status = 'legacy', deprecated_at = now()
  where status = 'active';

  -- Insertar nueva versión activa
  insert into public.no_olvidar_kek_versions (
    version, kek_secret_name, status, activated_at, created_by
  ) values (
    v_new_version, p_new_secret_name, 'active', now(), p_actor
  );

  -- Audit log de la rotación
  insert into public.no_olvidar_access_log (
    user_id, action, metadata
  ) values (
    p_actor,
    'kek_rotated',
    jsonb_build_object(
      'from_version', v_old_version,
      'to_version', v_new_version,
      'new_secret_name', p_new_secret_name
    )
  );

  return true;
end;
$$;

comment on function public.no_olvidar_rotate_kek is
  'Marca KEK actual como legacy + crea nueva versión activa. Llamar DESPUÉS de crear el secret real en Supabase Vault. El re-encrypt de items lo hace código TS (reEncryptAllItems en Fase 2).';

-- ─── Trigger: auto-crear no_olvidar_user_keys en signup ───────────
-- IMPORTANT: solo dispara si el user tiene metadata `tenant = 'dtd-cargo'`
-- en raw_user_meta_data. Otros tenants (si los hay en el futuro) NO obtienen
-- no_olvidar_user_keys automáticamente.
create or replace function public.no_olvidar_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data->>'tenant') = 'dtd-cargo' then
    insert into public.no_olvidar_user_keys (
      user_id,
      totp_secret_ciphertext,
      totp_secret_nonce,
      setup_completed
    ) values (
      new.id,
      '',                            -- placeholder base64, se setea en setup wizard
      '',                            -- placeholder base64, se setea en setup wizard
      false
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

comment on function public.no_olvidar_handle_new_user is
  'Auto-crea row en no_olvidar_user_keys cuando se inserta auth.users con tenant=dtd-cargo. totp_secret se setea en setup wizard (V1 Fase 3).';

drop trigger if exists no_olvidar_on_auth_user_created on auth.users;
create trigger no_olvidar_on_auth_user_created
  after insert on auth.users
  for each row execute function public.no_olvidar_handle_new_user();

-- ─── GRANTs ──────────────────────────────────────────────────
-- no_olvidar_items: read/write para authenticated (filtrado por RLS user_id)
grant select, insert, update, delete on public.no_olvidar_items to authenticated;

-- no_olvidar_user_keys: select+update por authenticated (RLS filtra). NO insert/delete
-- desde cliente (eso lo hace el trigger).
grant select, update on public.no_olvidar_user_keys to authenticated;

-- no_olvidar_access_log: SELECT a authenticated (RLS filtra). INSERT solo desde
-- service_role del runtime (lib/studio/no-olvidar/audit.ts). UPDATE/DELETE bloqueado.
grant select on public.no_olvidar_access_log to authenticated;
grant insert on public.no_olvidar_access_log to service_role;

-- no_olvidar_recovery_requests: SELECT+INSERT para authenticated (RLS filtra).
-- UPDATE solo via approveRecoveryAction (server-side con service_role).
grant select, insert on public.no_olvidar_recovery_requests to authenticated;
grant update on public.no_olvidar_recovery_requests to service_role;

-- no_olvidar_kek_versions: SELECT para admins (RLS). INSERT/UPDATE solo via RPC.
grant select on public.no_olvidar_kek_versions to authenticated;

-- no_olvidar_config: SELECT todos. UPDATE solo admins.
grant select on public.no_olvidar_config to authenticated;
grant update on public.no_olvidar_config to authenticated;

-- RPCs
grant execute on function public.no_olvidar_check_admin(uuid) to authenticated;
grant execute on function public.no_olvidar_get_active_kek_version() to authenticated;
grant execute on function public.no_olvidar_rotate_kek(text, uuid) to authenticated;
revoke execute on function public.no_olvidar_rotate_kek(text, uuid) from public, anon;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.no_olvidar_items enable row level security;
alter table public.no_olvidar_user_keys enable row level security;
alter table public.no_olvidar_access_log enable row level security;
alter table public.no_olvidar_recovery_requests enable row level security;
alter table public.no_olvidar_kek_versions enable row level security;
alter table public.no_olvidar_config enable row level security;

-- ── no_olvidar_items: solo el dueño (spec §4.8) ──
create policy "no_olvidar_items_owner_select"
  on public.no_olvidar_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "no_olvidar_items_owner_insert"
  on public.no_olvidar_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.no_olvidar_user_keys
      where user_id = (select auth.uid()) and setup_completed = true
    )
  );

create policy "no_olvidar_items_owner_update"
  on public.no_olvidar_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "no_olvidar_items_owner_delete"
  on public.no_olvidar_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── no_olvidar_user_keys: el dueño SELECT/UPDATE su row, NO insert/delete ──
create policy "no_olvidar_user_keys_owner_select"
  on public.no_olvidar_user_keys for select to authenticated
  using (user_id = (select auth.uid()));

create policy "no_olvidar_user_keys_owner_update"
  on public.no_olvidar_user_keys for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── no_olvidar_access_log: IMMUTABLE (spec §4.7) ──
-- SELECT: dueño ve su log, admin ve todo
create policy "no_olvidar_access_log_owner_or_admin_select"
  on public.no_olvidar_access_log for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.no_olvidar_check_admin((select auth.uid()))
  );

-- INSERT NO se permite a authenticated (solo service_role via GRANT).
-- Por las dudas, policy explícita que niega:
create policy "no_olvidar_access_log_no_insert_authenticated"
  on public.no_olvidar_access_log for insert to authenticated
  with check (false);

-- IMMUTABLE: UPDATE y DELETE prohibidos PARA TODOS, incluido service_role.
-- USING (false) bloquea sin importar el rol — esto es el corazón del spec §4.7.
create policy "no_olvidar_access_log_no_update"
  on public.no_olvidar_access_log for update
  using (false);

create policy "no_olvidar_access_log_no_delete"
  on public.no_olvidar_access_log for delete
  using (false);

-- ── no_olvidar_recovery_requests: requester o cualquier admin ven; cualquier auth puede crear ──
create policy "no_olvidar_recovery_requests_select"
  on public.no_olvidar_recovery_requests for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or public.no_olvidar_check_admin((select auth.uid()))
  );

create policy "no_olvidar_recovery_requests_insert"
  on public.no_olvidar_recovery_requests for insert to authenticated
  with check (requester_user_id = (select auth.uid()));

-- UPDATE solo via service_role (server actions hacen approve/reject/execute).
-- Para authenticated bloqueamos explícito:
create policy "no_olvidar_recovery_requests_no_update_authenticated"
  on public.no_olvidar_recovery_requests for update to authenticated
  using (false);

create policy "no_olvidar_recovery_requests_no_delete"
  on public.no_olvidar_recovery_requests for delete
  using (false);

-- ── no_olvidar_kek_versions: admins SELECT, INSERT/UPDATE solo via RPC ──
create policy "no_olvidar_kek_versions_admin_select"
  on public.no_olvidar_kek_versions for select to authenticated
  using (public.no_olvidar_check_admin((select auth.uid())));

create policy "no_olvidar_kek_versions_no_direct_insert"
  on public.no_olvidar_kek_versions for insert to authenticated
  with check (false);

create policy "no_olvidar_kek_versions_no_direct_update"
  on public.no_olvidar_kek_versions for update to authenticated
  using (false);

create policy "no_olvidar_kek_versions_no_delete"
  on public.no_olvidar_kek_versions for delete
  using (false);

-- ── no_olvidar_config: SELECT a todos, UPDATE solo admins ──
create policy "no_olvidar_config_all_select"
  on public.no_olvidar_config for select to authenticated
  using (true);

create policy "no_olvidar_config_admin_update"
  on public.no_olvidar_config for update to authenticated
  using (public.no_olvidar_check_admin((select auth.uid())))
  with check (public.no_olvidar_check_admin((select auth.uid())));

create policy "no_olvidar_config_no_insert"
  on public.no_olvidar_config for insert to authenticated
  with check (false);

create policy "no_olvidar_config_no_delete"
  on public.no_olvidar_config for delete
  using (false);

-- ─── Seed: no_olvidar_config con defaults ─────────────────────────
insert into public.no_olvidar_config (id) values (1)
on conflict (id) do nothing;

-- ─── NO se siembra KEK aquí ──────────────────────────────────
-- La KEK inicial se crea manualmente UNA vez post-deploy:
--
--   1) Conectar al SQL editor de Supabase con superuser
--   2) select vault.create_secret(
--        encode(gen_random_bytes(32), 'base64'),
--        'no_olvidar_kek_v1',
--        'KEK inicial del No-Olvidar DTD-CARGO · created YYYY-MM-DD by founder'
--      );
--   3) insert into public.no_olvidar_kek_versions (version, kek_secret_name, status, created_by)
--      values (1, 'no_olvidar_kek_v1', 'active', '<founder-user-id>');
--   4) Hacer BACKUP OFFLINE de la KEK (USB físico + caja fuerte).
--
-- Ver spec §7.1 y memoria sdd-0025-no-olvidar-pending.
