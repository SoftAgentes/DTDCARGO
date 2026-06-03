/**
 * Queries server-side del módulo Comentarios + @menciones (SDD-0045).
 *
 * Funciones puras: reciben un SupabaseClient (server-side, con cookies del
 * user logueado) y devuelven data tipada. RLS filtra por tenant
 * (get_user_tenant_id) y, en la bandeja, por mentioned_user_id.
 *
 * El enriquecimiento (autor → {name, avatar, role}) se hace contra una lista de
 * usuarios del tenant que el caller pasa (resuelta en la page con user-queries),
 * para no acoplar este módulo a auth.users (que no es accesible vía RLS).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Comment,
  CommentEntityType,
  CommentTenantUser,
  CommentWithMeta,
  MentionInboxItem,
  ReactionEmoji,
} from "./types";
import { isReactionEmoji } from "./types";

const COMMENT_COLUMNS =
  "id, tenant_id, entity_type, entity_id, entity_code, author_id, body, " +
  "parent_id, edited_at, created_at, deleted_at";

type RawReaction = { comment_id: string; user_id: string; emoji: string };
type RawMention = { comment_id: string; mentioned_user_id: string };

function buildUserMap(
  users: CommentTenantUser[],
): Map<string, CommentTenantUser> {
  const m = new Map<string, CommentTenantUser>();
  for (const u of users) m.set(u.id, u);
  return m;
}

/**
 * Lista el hilo de comentarios de una entidad en orden cronológico (excluye
 * soft-deleted). Hace 2 queries auxiliares (reacciones + menciones) y arma el
 * shape enriquecido en memoria. `currentUserId` se usa para `myReactions`.
 */
export async function listComments(
  supabase: SupabaseClient,
  entityType: CommentEntityType,
  entityId: string,
  users: CommentTenantUser[],
  currentUserId: string,
): Promise<CommentWithMeta[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  const comments = (data as unknown as Comment[] | null) ?? [];
  if (comments.length === 0) return [];

  const commentIds = comments.map((c) => c.id);

  const [reactionsRes, mentionsRes] = await Promise.all([
    supabase
      .from("comment_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", commentIds),
    supabase
      .from("comment_mentions")
      .select("comment_id, mentioned_user_id")
      .in("comment_id", commentIds),
  ]);

  if (reactionsRes.error) throw reactionsRes.error;
  if (mentionsRes.error) throw mentionsRes.error;

  const rawReactions = (reactionsRes.data as RawReaction[] | null) ?? [];
  const rawMentions = (mentionsRes.data as RawMention[] | null) ?? [];

  // Agrupar reacciones por comment → { emoji: userIds[] }
  const reactionsByComment = new Map<
    string,
    Partial<Record<ReactionEmoji, string[]>>
  >();
  const myReactionsByComment = new Map<string, ReactionEmoji[]>();
  for (const r of rawReactions) {
    if (!isReactionEmoji(r.emoji)) continue;
    const emoji = r.emoji;
    const group = reactionsByComment.get(r.comment_id) ?? {};
    const arr = group[emoji] ?? [];
    arr.push(r.user_id);
    group[emoji] = arr;
    reactionsByComment.set(r.comment_id, group);
    if (r.user_id === currentUserId) {
      const mine = myReactionsByComment.get(r.comment_id) ?? [];
      if (!mine.includes(emoji)) mine.push(emoji);
      myReactionsByComment.set(r.comment_id, mine);
    }
  }

  const mentionsByComment = new Map<string, string[]>();
  for (const m of rawMentions) {
    const arr = mentionsByComment.get(m.comment_id) ?? [];
    arr.push(m.mentioned_user_id);
    mentionsByComment.set(m.comment_id, arr);
  }

  const userMap = buildUserMap(users);

  return comments.map((c) => {
    const u = c.author_id ? userMap.get(c.author_id) : undefined;
    return {
      ...c,
      author: u
        ? { name: u.name, avatar: u.avatar, role: u.role }
        : null,
      reactions: reactionsByComment.get(c.id) ?? {},
      myReactions: myReactionsByComment.get(c.id) ?? [],
      mentionedUserIds: mentionsByComment.get(c.id) ?? [],
    } as CommentWithMeta;
  });
}

/**
 * Bandeja "Menciones" del user logueado. Join comment + entidad. RLS de
 * comment_mentions filtra por tenant; el filtro por `mentioned_user_id`
 * (= caller) lo aplica esta query explícitamente.
 */
export async function listMyMentions(
  supabase: SupabaseClient,
  currentUserId: string,
  users: CommentTenantUser[],
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<MentionInboxItem[]> {
  let q = supabase
    .from("comment_mentions")
    .select(
      "id, comment_id, read_at, created_at, " +
        "comment:comments(entity_type, entity_id, entity_code, body, author_id)",
    )
    .eq("mentioned_user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.unreadOnly) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) throw error;

  const userMap = buildUserMap(users);

  type Row = {
    id: string;
    comment_id: string;
    read_at: string | null;
    created_at: string;
    comment:
      | {
          entity_type: CommentEntityType;
          entity_id: string;
          entity_code: string | null;
          body: string;
          author_id: string | null;
        }
      | Array<{
          entity_type: CommentEntityType;
          entity_id: string;
          entity_code: string | null;
          body: string;
          author_id: string | null;
        }>
      | null;
  };

  const rows = (data as unknown as Row[] | null) ?? [];

  return rows
    .map((r): MentionInboxItem | null => {
      const comment = Array.isArray(r.comment)
        ? (r.comment[0] ?? null)
        : r.comment;
      if (!comment) return null;
      const u = comment.author_id ? userMap.get(comment.author_id) : undefined;
      return {
        mention_id: r.id,
        comment_id: r.comment_id,
        read_at: r.read_at,
        created_at: r.created_at,
        entity_type: comment.entity_type,
        entity_id: comment.entity_id,
        entity_code: comment.entity_code,
        body: comment.body,
        author: u ? { name: u.name, avatar: u.avatar, role: u.role } : null,
      };
    })
    .filter((x): x is MentionInboxItem => x !== null);
}

/**
 * Carga los usuarios del tenant (id → name/avatar/role) para enriquecer los
 * comentarios y alimentar el autocomplete de @menciones. Usa el client regular
 * (RLS filtra por tenant). Combina user_tenants (rol) + user_profiles (nombre).
 *
 * El email de auth.users NO es accesible vía RLS, así que si el perfil no tiene
 * nombre cargado se cae a un placeholder legible ("Usuario").
 */
export async function loadTenantUsers(
  supabase: SupabaseClient,
): Promise<CommentTenantUser[]> {
  const { data, error } = await supabase
    .from("user_tenants")
    .select(
      "user_id, role, disabled_at, profile:user_profiles(first_name, last_name)",
    )
    .is("disabled_at", null)
    .limit(500);

  if (error) throw error;

  type Row = {
    user_id: string;
    role: string;
    profile:
      | { first_name: string | null; last_name: string | null }
      | Array<{ first_name: string | null; last_name: string | null }>
      | null;
  };

  const rows = (data as unknown as Row[] | null) ?? [];

  return rows.map((r) => {
    const profile = Array.isArray(r.profile)
      ? (r.profile[0] ?? null)
      : r.profile;
    const first = profile?.first_name?.trim() ?? "";
    const last = profile?.last_name?.trim() ?? "";
    const name = [first, last].filter(Boolean).join(" ").trim() || "Usuario";
    const avatar =
      (first && last
        ? `${first[0]}${last[0]}`
        : name.slice(0, 2)
      ).toUpperCase() || "??";
    return {
      id: r.user_id,
      name,
      avatar,
      role: ROLE_LABELS_ES[r.role] ?? r.role,
    } satisfies CommentTenantUser;
  });
}

/** Etiquetas de rol en es-VE (espejo de user-types ROLE_LABELS, sin acoplar). */
const ROLE_LABELS_ES: Record<string, string> = {
  admin: "Admin",
  commercial: "Comercial",
  operations: "Operaciones",
  accounting: "Contabilidad",
  warehouse: "Almacenista",
  support: "Soporte",
};

/** Conteo de menciones sin leer del user logueado (para el badge). */
export async function countUnreadMentions(
  supabase: SupabaseClient,
  currentUserId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("comment_mentions")
    .select("id", { count: "exact", head: true })
    .eq("mentioned_user_id", currentUserId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Lee un comentario crudo por id (para validar autoría en server actions).
 * RLS filtra por tenant. Devuelve también soft-deleted (el action decide).
 */
export async function getCommentById(
  supabase: SupabaseClient,
  commentId: string,
): Promise<Comment | null> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("id", commentId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Comment | null) ?? null;
}
