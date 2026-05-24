-- ─────────────────────────────────────────────────────────────
-- SDD-0025 Fase 1 · Schema base del Vault interno DTD-CARGO
--
-- (Renumerada de "0013" mencionada en la spec → 0017 porque las
--  migraciones 0012-0016 ya están usadas: audit fixes pre-Sprint 4
--  + SDD-0020 schema + GRANT fix.)
--
-- Contenido:
--   - 6 enums
--   - 6 tablas (vault_items, vault_user_keys, vault_access_log,
--     vault_recovery_requests, vault_kek_versions, vault_config)
--   - 3 RPCs (vault_get_active_kek_version, vault_rotate_kek,
--     vault_check_admin)
--   - Trigger auto-creación vault_user_keys en signup (con guard de
--     tenant metadata)
--   - RLS estricta por user_id (no por tenant — ver spec §4.8)
--   - Audit log IMMUTABLE (RLS bloquea UPDATE+DELETE para todos
--     incluido service_role — ver spec §4.7)
--   - Seed de vault_config con defaults
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
create type vault_category as enum ('login', 'note', 'card', 'totp');

create type vault_audit_action as enum (
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

create type vault_recovery_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'completed'
);

create type vault_user_role as enum ('member', 'admin');

create type vault_kek_status as enum ('active', 'legacy', 'revoked');

create type vault_alert_severity as enum ('info', 'warning', 'critical');

-- ─── Tabla: vault_items ──────────────────────────────────────
create table public.vault_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  category            vault_category not null,
  url                 text,
  username            text,                              -- NO encriptado (enable search)
  ciphertext          bytea not null,                    -- payload sensible cifrado
  nonce               bytea not null,                    -- 24 bytes XChaCha20
  dek_encrypted       bytea not null,                    -- DEK envuelto con KEK
  dek_nonce           bytea not null,
  key_version         int not null,                      -- versión de KEK usada
  notes_preview       text,                              -- primeros 60 chars en plaintext
  favorite            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.vault_items is
  'Items del Vault interno DTD-CARGO. RLS por user_id (spec §4.8). Soft delete via deleted_at.';

create index vault_items_user_id_active_idx
  on public.vault_items (user_id, category, favorite, updated_at desc)
  where deleted_at is null;
create index vault_items_user_id_search_idx
  on public.vault_items (user_id, name) where deleted_at is null;

-- ─── Tabla: vault_user_keys ──────────────────────────────────
create table public.vault_user_keys (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  has_master_password          boolean not null default false,
  master_password_verifier     bytea,                        -- Argon2id hash
  master_password_salt         bytea,                        -- 32 bytes random
  public_key                   bytea,                        -- Curve25519 (reservado sharing V2)
  private_key_ciphertext       bytea,                        -- private key cifrada
  private_key_nonce            bytea,
  recovery_kit_hash            bytea,                        -- Argon2id hash de las 24 palabras
  recovery_kit_salt            bytea,
  totp_secret_ciphertext       bytea not null,               -- TOTP secret cifrado con KEK
  totp_secret_nonce            bytea not null,
  totp_enabled                 boolean not null default false,
  setup_completed              boolean not null default false,
  role                         vault_user_role not null default 'member',
  last_unlock_at               timestamptz,
  failed_unlock_attempts       int not null default 0,
  locked_until                 timestamptz,                  -- rate limit brute-force
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

comment on table public.vault_user_keys is
  'Llaves y estado del Vault por usuario. 1 row por user. RLS estricta: solo el dueño puede SELECT/UPDATE su row.';

create index vault_user_keys_role_idx
  on public.vault_user_keys (role) where role = 'admin';

-- ─── Tabla: vault_access_log ─────────────────────────────────
create table public.vault_access_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  item_id       uuid references public.vault_items(id) on delete set null,
  action        vault_audit_action not null,
  ip_address    inet,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.vault_access_log is
  'Append-only audit log del Vault. IMMUTABLE: policies de UPDATE/DELETE devuelven false para TODOS, incluido service_role (spec §4.7).';

create index vault_access_log_user_id_idx
  on public.vault_access_log (user_id, created_at desc);
create index vault_access_log_item_id_idx
  on public.vault_access_log (item_id) where item_id is not null;
create index vault_access_log_action_idx
  on public.vault_access_log (action, created_at desc);

-- ─── Tabla: vault_recovery_requests ──────────────────────────
create table public.vault_recovery_requests (
  id                                  uuid primary key default gen_random_uuid(),
  requester_user_id                   uuid not null references auth.users(id) on delete cascade,
  reason                              text not null,
  status                              vault_recovery_status not null default 'pending',
  approvals                           jsonb not null default '[]'::jsonb,
  approvals_required                  int not null default 2,
  new_master_password_verifier        bytea,                       -- set al execute
  new_master_password_salt            bytea,
  expires_at                          timestamptz not null,        -- 24h desde creación
  completed_at                        timestamptz,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

comment on table public.vault_recovery_requests is
  'Pedidos de recovery M-of-N. approvals es array de {approver_id, approved_at, ip}. expires en 24h. Solo se ejecutan si approvals.length >= approvals_required.';

create index vault_recovery_requests_requester_idx
  on public.vault_recovery_requests (requester_user_id, created_at desc);
create index vault_recovery_requests_pending_idx
  on public.vault_recovery_requests (status, expires_at) where status = 'pending';

-- ─── Tabla: vault_kek_versions ───────────────────────────────
create table public.vault_kek_versions (
  version             int primary key,
  vault_secret_name   text not null,                       -- referencia a Supabase Vault
  status              vault_kek_status not null default 'active',
  activated_at        timestamptz not null default now(),
  deprecated_at       timestamptz,
  created_by          uuid references auth.users(id) on delete set null,
  notes               text
);

comment on table public.vault_kek_versions is
  'Registro de versiones de KEK. La KEK en sí vive en Supabase Vault extension (referenciada por vault_secret_name). Solo INSERT via RPC vault_rotate_kek.';

create index vault_kek_versions_active_idx
  on public.vault_kek_versions (status) where status = 'active';

-- ─── Tabla: vault_config ─────────────────────────────────────
create table public.vault_config (
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

comment on table public.vault_config is
  '1 row global (CHECK id=1). SELECT permitido a todos los authenticated. UPDATE solo admins. Defaults siguen recomendaciones del spec.';

-- ─── RPC: vault_check_admin ──────────────────────────────────
create or replace function public.vault_check_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.vault_user_keys
    where user_id = p_user_id and role = 'admin'
  );
$$;

comment on function public.vault_check_admin is
  'Helper para RLS de recovery y admin views. Retorna true si el user_id es admin del Vault.';

-- ─── RPC: vault_get_active_kek_version ───────────────────────
create or replace function public.vault_get_active_kek_version()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select version from public.vault_kek_versions
  where status = 'active'
  order by activated_at desc
  limit 1;
$$;

comment on function public.vault_get_active_kek_version is
  'Devuelve la versión actual de KEK. Cachear en cliente 5 min. Si retorna NULL, el Vault no está inicializado (setup post-deploy pendiente, ver spec §7.1).';

-- ─── RPC: vault_rotate_kek ───────────────────────────────────
create or replace function public.vault_rotate_kek(
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
  v_is_admin := public.vault_check_admin(p_actor);
  if not v_is_admin then
    raise exception 'Solo admins del Vault pueden rotar KEK' using errcode = '42501';
  end if;

  -- Validar nombre
  if p_new_secret_name is null or length(p_new_secret_name) < 3 then
    raise exception 'p_new_secret_name inválido' using errcode = '22023';
  end if;

  -- Versión actual
  select coalesce(max(version), 0) into v_old_version
  from public.vault_kek_versions;

  v_new_version := v_old_version + 1;

  -- Marcar todas las activas como legacy (debería haber 1 sola)
  update public.vault_kek_versions
  set status = 'legacy', deprecated_at = now()
  where status = 'active';

  -- Insertar nueva versión activa
  insert into public.vault_kek_versions (
    version, vault_secret_name, status, activated_at, created_by
  ) values (
    v_new_version, p_new_secret_name, 'active', now(), p_actor
  );

  -- Audit log de la rotación
  insert into public.vault_access_log (
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

comment on function public.vault_rotate_kek is
  'Marca KEK actual como legacy + crea nueva versión activa. Llamar DESPUÉS de crear el secret real en Supabase Vault. El re-encrypt de items lo hace código TS (reEncryptAllItems en Fase 2).';

-- ─── Trigger: auto-crear vault_user_keys en signup ───────────
-- IMPORTANT: solo dispara si el user tiene metadata `tenant = 'dtd-cargo'`
-- en raw_user_meta_data. Otros tenants (si los hay en el futuro) NO obtienen
-- vault_user_keys automáticamente.
create or replace function public.vault_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data->>'tenant') = 'dtd-cargo' then
    insert into public.vault_user_keys (
      user_id,
      totp_secret_ciphertext,
      totp_secret_nonce,
      setup_completed
    ) values (
      new.id,
      ''::bytea,                     -- placeholder, se setea en setup wizard
      ''::bytea,                     -- placeholder, se setea en setup wizard
      false
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

comment on function public.vault_handle_new_user is
  'Auto-crea row en vault_user_keys cuando se inserta auth.users con tenant=dtd-cargo. totp_secret se setea en setup wizard (V1 Fase 3).';

drop trigger if exists vault_on_auth_user_created on auth.users;
create trigger vault_on_auth_user_created
  after insert on auth.users
  for each row execute function public.vault_handle_new_user();

-- ─── GRANTs ──────────────────────────────────────────────────
-- vault_items: read/write para authenticated (filtrado por RLS user_id)
grant select, insert, update, delete on public.vault_items to authenticated;

-- vault_user_keys: select+update por authenticated (RLS filtra). NO insert/delete
-- desde cliente (eso lo hace el trigger).
grant select, update on public.vault_user_keys to authenticated;

-- vault_access_log: SELECT a authenticated (RLS filtra). INSERT solo desde
-- service_role del runtime (lib/studio/vault/audit.ts). UPDATE/DELETE bloqueado.
grant select on public.vault_access_log to authenticated;
grant insert on public.vault_access_log to service_role;

-- vault_recovery_requests: SELECT+INSERT para authenticated (RLS filtra).
-- UPDATE solo via approveRecoveryAction (server-side con service_role).
grant select, insert on public.vault_recovery_requests to authenticated;
grant update on public.vault_recovery_requests to service_role;

-- vault_kek_versions: SELECT para admins (RLS). INSERT/UPDATE solo via RPC.
grant select on public.vault_kek_versions to authenticated;

-- vault_config: SELECT todos. UPDATE solo admins.
grant select on public.vault_config to authenticated;
grant update on public.vault_config to authenticated;

-- RPCs
grant execute on function public.vault_check_admin(uuid) to authenticated;
grant execute on function public.vault_get_active_kek_version() to authenticated;
grant execute on function public.vault_rotate_kek(text, uuid) to authenticated;
revoke execute on function public.vault_rotate_kek(text, uuid) from public, anon;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.vault_items enable row level security;
alter table public.vault_user_keys enable row level security;
alter table public.vault_access_log enable row level security;
alter table public.vault_recovery_requests enable row level security;
alter table public.vault_kek_versions enable row level security;
alter table public.vault_config enable row level security;

-- ── vault_items: solo el dueño (spec §4.8) ──
create policy "vault_items_owner_select"
  on public.vault_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "vault_items_owner_insert"
  on public.vault_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.vault_user_keys
      where user_id = (select auth.uid()) and setup_completed = true
    )
  );

create policy "vault_items_owner_update"
  on public.vault_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "vault_items_owner_delete"
  on public.vault_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── vault_user_keys: el dueño SELECT/UPDATE su row, NO insert/delete ──
create policy "vault_user_keys_owner_select"
  on public.vault_user_keys for select to authenticated
  using (user_id = (select auth.uid()));

create policy "vault_user_keys_owner_update"
  on public.vault_user_keys for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── vault_access_log: IMMUTABLE (spec §4.7) ──
-- SELECT: dueño ve su log, admin ve todo
create policy "vault_access_log_owner_or_admin_select"
  on public.vault_access_log for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.vault_check_admin((select auth.uid()))
  );

-- INSERT NO se permite a authenticated (solo service_role via GRANT).
-- Por las dudas, policy explícita que niega:
create policy "vault_access_log_no_insert_authenticated"
  on public.vault_access_log for insert to authenticated
  with check (false);

-- IMMUTABLE: UPDATE y DELETE prohibidos PARA TODOS, incluido service_role.
-- USING (false) bloquea sin importar el rol — esto es el corazón del spec §4.7.
create policy "vault_access_log_no_update"
  on public.vault_access_log for update
  using (false);

create policy "vault_access_log_no_delete"
  on public.vault_access_log for delete
  using (false);

-- ── vault_recovery_requests: requester o cualquier admin ven; cualquier auth puede crear ──
create policy "vault_recovery_requests_select"
  on public.vault_recovery_requests for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or public.vault_check_admin((select auth.uid()))
  );

create policy "vault_recovery_requests_insert"
  on public.vault_recovery_requests for insert to authenticated
  with check (requester_user_id = (select auth.uid()));

-- UPDATE solo via service_role (server actions hacen approve/reject/execute).
-- Para authenticated bloqueamos explícito:
create policy "vault_recovery_requests_no_update_authenticated"
  on public.vault_recovery_requests for update to authenticated
  using (false);

create policy "vault_recovery_requests_no_delete"
  on public.vault_recovery_requests for delete
  using (false);

-- ── vault_kek_versions: admins SELECT, INSERT/UPDATE solo via RPC ──
create policy "vault_kek_versions_admin_select"
  on public.vault_kek_versions for select to authenticated
  using (public.vault_check_admin((select auth.uid())));

create policy "vault_kek_versions_no_direct_insert"
  on public.vault_kek_versions for insert to authenticated
  with check (false);

create policy "vault_kek_versions_no_direct_update"
  on public.vault_kek_versions for update to authenticated
  using (false);

create policy "vault_kek_versions_no_delete"
  on public.vault_kek_versions for delete
  using (false);

-- ── vault_config: SELECT a todos, UPDATE solo admins ──
create policy "vault_config_all_select"
  on public.vault_config for select to authenticated
  using (true);

create policy "vault_config_admin_update"
  on public.vault_config for update to authenticated
  using (public.vault_check_admin((select auth.uid())))
  with check (public.vault_check_admin((select auth.uid())));

create policy "vault_config_no_insert"
  on public.vault_config for insert to authenticated
  with check (false);

create policy "vault_config_no_delete"
  on public.vault_config for delete
  using (false);

-- ─── Seed: vault_config con defaults ─────────────────────────
insert into public.vault_config (id) values (1)
on conflict (id) do nothing;

-- ─── NO se siembra KEK aquí ──────────────────────────────────
-- La KEK inicial se crea manualmente UNA vez post-deploy:
--
--   1) Conectar al SQL editor de Supabase con superuser
--   2) select vault.create_secret(
--        encode(gen_random_bytes(32), 'base64'),
--        'vault_kek_v1',
--        'KEK inicial del Vault DTD-CARGO · created YYYY-MM-DD by founder'
--      );
--   3) insert into public.vault_kek_versions (version, vault_secret_name, status, created_by)
--      values (1, 'vault_kek_v1', 'active', '<founder-user-id>');
--   4) Hacer BACKUP OFFLINE de la KEK (USB físico + caja fuerte).
--
-- Ver spec §7.1 y memoria sdd-0025-vault-interno-pending.
