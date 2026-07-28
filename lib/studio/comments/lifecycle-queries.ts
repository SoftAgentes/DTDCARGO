import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveCommentLifecycleState,
  type DeletedComment,
  type DeletedCommentsCursor,
  type DeletedCommentsPage,
} from "./lifecycle-types";
import type { CommentEntityType, CommentTenantUser } from "./types";

const LIFECYCLE_COLUMNS =
  "id, tenant_id, entity_type, entity_id, entity_code, author_id, body, " +
  "parent_id, edited_at, created_at, deleted_at, deleted_by, deletion_mode, " +
  "deletion_reason, lifecycle_correlation_id, last_lifecycle_operation_id, " +
  "lifecycle_contract_version";

const MAX_PAGE_SIZE = 50;

export async function listDeletedComments(
  supabase: SupabaseClient,
  entityType: CommentEntityType,
  entityId: string,
  users: CommentTenantUser[],
  cursor?: DeletedCommentsCursor | null,
  nowMs = Date.now(),
): Promise<DeletedCommentsPage> {
  let query = supabase
    .from("comments")
    .select(LIFECYCLE_COLUMNS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `deleted_at.lt.${cursor.deletedAt},and(deleted_at.eq.${cursor.deletedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  type RawDeletedComment = Omit<DeletedComment, "author" | "reactions" | "myReactions" | "mentionedUserIds" | "lifecycleState">;
  const rows = ((data as unknown as RawDeletedComment[] | null) ?? []).slice(
    0,
    MAX_PAGE_SIZE,
  );
  const userMap = new Map(users.map((user) => [user.id, user]));
  const comments = rows.map((comment): DeletedComment => {
    const author = comment.author_id ? userMap.get(comment.author_id) : undefined;
    return {
      ...comment,
      author: author
        ? { name: author.name, avatar: author.avatar, role: author.role }
        : null,
      reactions: {},
      myReactions: [],
      mentionedUserIds: [],
      lifecycleState: deriveCommentLifecycleState(comment.deleted_at, nowMs) as DeletedComment["lifecycleState"],
    };
  });
  const hasMore = ((data as unknown as unknown[] | null) ?? []).length > MAX_PAGE_SIZE;
  const last = comments.at(-1);

  return {
    comments,
    nextCursor:
      hasMore && last?.deleted_at
        ? { deletedAt: last.deleted_at, id: last.id }
        : null,
  };
}
