-- ─────────────────────────────────────────────────────────────
-- SDD-0045 · Comentarios + @menciones transversales
--
-- Hilo de colaboración interna del equipo, embebible en el detalle
-- de cualquier entidad (embarque, cliente, factura, cotización…).
-- Generaliza bug_messages (SDD-0036, acotado a bugs) a un sistema
-- polimórfico (entity_type + entity_id, calca entity_audit_log de 0066).
--
-- Contenido:
--   1. comments            · hilo plano (parent_id nullable para futuro)
--   2. comment_mentions    · mencionado + read_at (= bandeja/badge)
--   3. comment_reactions   · emoji (5 fijos), toggle idempotente
--   - RLS de las 3 por tenant (get_user_tenant_id), patrón entity_audit_log
--   - CHECKs (entity_type, emoji, body no vacío), uniques, índices, grants
--
-- INTERNO: el portal del cliente NO lee estos comentarios.
-- Número de migración: 0090 (gap 0089 cedido al carril finanzas a propósito).
-- NO se aplica a prod desde acá (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. COMMENTS · hilo polimórfico                            ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  entity_type  text not null check (entity_type in (
                 'shipment',
                 'client',
                 'invoice',
                 'quote',
                 'dispatch_order',
                 'supplier_bill',
                 'warehouse_receipt_cn',
                 'warehouse_receipt_ve'
               )),
  entity_id    uuid not null,                                  -- PK real de la entidad comentada
  entity_code  text,                                           -- snapshot legible (DTDU-…, DTD-…, F-2026-…)
  author_id    uuid references auth.users(id) on delete set null,
  body         text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  parent_id    uuid references public.comments(id) on delete cascade,  -- reply 1 nivel · se guarda, V1 renderiza plano
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz                                     -- soft-delete (auditable)
);

comment on table public.comments is
  'SDD-0045: comentarios internos del equipo, polimórficos por (entity_type, entity_id) — calca entity_audit_log de 0066. Hilo plano (parent_id se guarda para threading futuro). soft-delete via deleted_at. NO expuesto al portal del cliente.';

create index if not exists comments_entity_idx
  on public.comments (tenant_id, entity_type, entity_id, created_at)
  where deleted_at is null;

create index if not exists comments_author_idx
  on public.comments (author_id, created_at desc)
  where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. COMMENT_MENTIONS · mencionado + read_at (bandeja)      ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.comment_mentions (
  id                uuid primary key default gen_random_uuid(),
  comment_id        uuid not null references public.comments(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,  -- denormalizado para RLS
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

comment on table public.comment_mentions is
  'SDD-0045: fila por (comment, usuario mencionado). La fila ES la notificación in-app: read_at null → mención sin leer → badge + bandeja /studio/menciones. tenant_id denormalizado para RLS sin join.';

-- "mis menciones sin leer" — el filtro de la bandeja
create index if not exists comment_mentions_inbox_idx
  on public.comment_mentions (mentioned_user_id, read_at);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. COMMENT_REACTIONS · emoji (5 fijos), toggle           ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null check (emoji in ('👍','✓','👀','🔥','❓')),
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

comment on table public.comment_reactions is
  'SDD-0045: reacción de un usuario a un comentario. 5 emojis fijos (CHECK). unique (comment, user, emoji) → toggle idempotente.';

create index if not exists comment_reactions_comment_idx
  on public.comment_reactions (comment_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS · tenant_id = get_user_tenant_id() (patrón 0066)  ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.comments          enable row level security;
alter table public.comment_mentions  enable row level security;
alter table public.comment_reactions enable row level security;

-- ── comments ────────────────────────────────────────────────
-- SELECT: cualquier miembro del tenant ve los comentarios del tenant.
create policy "comments_tenant_select"
  on public.comments for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT: el autor es el caller, dentro de su tenant.
create policy "comments_author_insert"
  on public.comments for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and author_id = (select auth.uid())
  );

-- UPDATE (edit + soft-delete): solo el autor, o admin del tenant.
create policy "comments_author_or_admin_update"
  on public.comments for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (
      author_id = (select auth.uid())
      or exists (
        select 1 from public.user_tenants ut
        where ut.user_id = (select auth.uid())
          and ut.tenant_id = comments.tenant_id
          and ut.role = 'admin'
          and ut.disabled_at is null
      )
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- DELETE real: bloqueado para authenticated (se usa soft-delete via UPDATE).
create policy "comments_no_hard_delete"
  on public.comments for delete to authenticated using (false);

-- service_role full access (workers, migraciones de datos)
create policy "comments_service_role_all"
  on public.comments for all to service_role using (true) with check (true);

-- ── comment_mentions ────────────────────────────────────────
-- SELECT: dentro del tenant (la bandeja filtra por mentioned_user_id en query).
create policy "comment_mentions_tenant_select"
  on public.comment_mentions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT: solo si el comentario padre pertenece al caller (autor) en su tenant.
create policy "comment_mentions_author_insert"
  on public.comment_mentions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.comments c
      where c.id = comment_mentions.comment_id
        and c.author_id = (select auth.uid())
        and c.tenant_id = comment_mentions.tenant_id
    )
  );

-- UPDATE (marcar leído): solo el propio mencionado, sobre su read_at.
create policy "comment_mentions_owner_update"
  on public.comment_mentions for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
  );

create policy "comment_mentions_no_delete"
  on public.comment_mentions for delete to authenticated using (false);

create policy "comment_mentions_service_role_all"
  on public.comment_mentions for all to service_role using (true) with check (true);

-- ── comment_reactions ───────────────────────────────────────
create policy "comment_reactions_tenant_select"
  on public.comment_reactions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT: el reactor es el caller, dentro de su tenant, sobre un comment del tenant.
create policy "comment_reactions_owner_insert"
  on public.comment_reactions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
      where c.id = comment_reactions.comment_id
        and c.tenant_id = comment_reactions.tenant_id
    )
  );

-- DELETE: el dueño de la reacción la quita (toggle off).
create policy "comment_reactions_owner_delete"
  on public.comment_reactions for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
  );

create policy "comment_reactions_service_role_all"
  on public.comment_reactions for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4b. INMUTABILIDAD · congelar columnas de identidad en UPDATE║
-- ╚═══════════════════════════════════════════════════════════╝
-- RLS no puede comparar contra OLD (no hay referencia al valor previo), por eso
-- el WITH CHECK de comments_author_or_admin_update no impide que un UPDATE mueva
-- el comentario a otra entidad, cambie su autor o su tenant. El grant de UPDATE
-- es sobre toda la fila. Este trigger BEFORE UPDATE congela las columnas de
-- identidad/estructura: SOLO body, edited_at y deleted_at son mutables (lo que
-- editComment/deleteComment necesitan). (Hardening SDD-0045 · finding #3.)
create or replace function public.comments_freeze_immutable()
returns trigger
language plpgsql
as $$
begin
  new.tenant_id   := old.tenant_id;
  new.entity_type := old.entity_type;
  new.entity_id   := old.entity_id;
  new.entity_code := old.entity_code;
  new.author_id   := old.author_id;
  new.parent_id   := old.parent_id;
  new.created_at  := old.created_at;
  return new;
end;
$$;

drop trigger if exists comments_freeze_immutable_trg on public.comments;
create trigger comments_freeze_immutable_trg
  before update on public.comments
  for each row execute function public.comments_freeze_immutable();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS                                                 ║
-- ╚═══════════════════════════════════════════════════════════╝

grant select, insert, update on public.comments          to authenticated;
grant select, insert, update on public.comment_mentions  to authenticated;
grant select, insert, delete on public.comment_reactions to authenticated;

grant all on public.comments          to service_role;
grant all on public.comment_mentions  to service_role;
grant all on public.comment_reactions to service_role;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0090_comments.sql
-- Aplicar con: supabase migration apply 0090 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
