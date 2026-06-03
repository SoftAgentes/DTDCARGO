"use server";

/**
 * Server actions de Comentarios + @menciones (SDD-0045).
 *
 * Convención Studio: parsing manual de inputs, validación propia (no Zod),
 * `revalidatePath`. Tenant via getUserTenantId(). RLS filtra por tenant en cada
 * tabla (migración 0090).
 *
 * Notificación de menciones: la fila de `comment_mentions` ES la notificación
 * in-app (badge + bandeja /studio/menciones). Email/push quedan como TODO
 * best-effort para no tocar archivos del carril finanzas/portal en esta sesión.
 *
 * Acciones:
 *  - postComment      · inserta comment + parsea menciones + inserta filas
 *  - toggleReaction   · toggle idempotente por (comment, user, emoji)
 *  - editComment      · solo autor; re-parsea menciones (agrega, no quita)
 *  - deleteComment    · autor o admin; soft-delete
 *  - markMentionsRead · set read_at = now() a mis menciones (todas o por entidad)
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import {
  COMMENT_ENTITY_TYPES,
  isReactionEmoji,
  validateCommentInput,
  type CommentActionState,
  type CommentEntityType,
} from "@/lib/studio/comments/types";
import {
  getCommentById,
  loadTenantUsers,
} from "@/lib/studio/comments/comments-queries";
import { parseMentions } from "@/lib/studio/comments/mention-parse";
import { entityHref } from "@/lib/studio/comments/types";

function isEntityType(v: string): v is CommentEntityType {
  return (COMMENT_ENTITY_TYPES as string[]).includes(v);
}

/**
 * Inserta menciones para un comentario (idempotente vía unique).
 * Resuelve los tokens del body contra los usuarios reales del tenant.
 */
async function insertMentions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    commentId: string;
    tenantId: string;
    body: string;
  },
): Promise<string[]> {
  const users = await loadTenantUsers(supabase);
  const mentionedIds = parseMentions(params.body, users);
  if (mentionedIds.length === 0) return [];

  const rows = mentionedIds.map((uid) => ({
    comment_id: params.commentId,
    tenant_id: params.tenantId,
    mentioned_user_id: uid,
  }));

  // onConflict ignora duplicados (unique comment_id+mentioned_user_id).
  const { error } = await supabase
    .from("comment_mentions")
    .upsert(rows, { onConflict: "comment_id,mentioned_user_id", ignoreDuplicates: true });

  // best-effort: si falla el fan-out, el comentario ya quedó. No rompemos.
  if (error) return [];
  return mentionedIds;
}

export async function postComment(
  entityType: string,
  entityId: string,
  entityCode: string | null,
  _prev: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const user = await getUser();
  const tenantId = await getUserTenantId();
  if (!user || !tenantId) return { error: "No autenticado." };

  if (!isEntityType(entityType)) return { error: "Tipo de entidad inválido." };
  if (!entityId) return { error: "Entidad inválida." };

  const { input, fieldErrors } = validateCommentInput({
    body: String(formData.get("body") ?? ""),
  });
  if (fieldErrors || !input) return { fieldErrors };

  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const parentId = parentIdRaw === "" ? null : parentIdRaw;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      entity_code: entityCode,
      author_id: user.id,
      body: input.body,
      parent_id: parentId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo publicar el comentario." };

  await insertMentions(supabase, {
    commentId: data.id as string,
    tenantId,
    body: input.body,
  });

  // TODO(best-effort): email/push a los mencionados reusando lib/studio/mail
  // y push existente. Diferido para no tocar archivos del carril finanzas/portal.

  revalidatePath(entityHref(entityType, entityId, entityCode));
  return { ok: true, commentId: data.id as string };
}

export async function toggleReaction(
  commentId: string,
  emoji: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  const tenantId = await getUserTenantId();
  if (!user || !tenantId) return { ok: false, error: "No autenticado." };
  if (!commentId) return { ok: false, error: "Comentario inválido." };
  if (!isReactionEmoji(emoji)) return { ok: false, error: "Emoji inválido." };

  const supabase = await createClient();

  // ¿Ya reaccioné con este emoji? → toggle off.
  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: "No se pudo quitar la reacción." };
  } else {
    const { error } = await supabase.from("comment_reactions").insert({
      comment_id: commentId,
      tenant_id: tenantId,
      user_id: user.id,
      emoji,
    });
    if (error) return { ok: false, error: "No se pudo reaccionar." };
  }

  // El detalle revalida vía router.refresh() en cliente tras el optimistic.
  return { ok: true };
}

export async function editComment(
  commentId: string,
  _prev: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const user = await getUser();
  const tenantId = await getUserTenantId();
  if (!user || !tenantId) return { error: "No autenticado." };

  const { input, fieldErrors } = validateCommentInput({
    body: String(formData.get("body") ?? ""),
  });
  if (fieldErrors || !input) return { fieldErrors };

  const supabase = await createClient();
  const current = await getCommentById(supabase, commentId);
  if (!current) return { error: "Comentario no encontrado." };
  if (current.author_id !== user.id) {
    return { error: "Solo el autor puede editar su comentario." };
  }
  if (current.deleted_at) return { error: "Comentario eliminado." };

  const { error } = await supabase
    .from("comments")
    .update({ body: input.body, edited_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) return { error: "No se pudo editar el comentario." };

  // Re-parsea menciones: agrega nuevas (upsert ignora las que ya existen).
  await insertMentions(supabase, {
    commentId,
    tenantId,
    body: input.body,
  });

  revalidatePath(
    entityHref(current.entity_type, current.entity_id, current.entity_code),
  );
  return { ok: true, commentId };
}

export async function deleteComment(
  commentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const supabase = await createClient();
  const current = await getCommentById(supabase, commentId);
  if (!current) return { ok: false, error: "Comentario no encontrado." };

  // RLS permite UPDATE al autor o admin; aplicamos soft-delete.
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) return { ok: false, error: "No se pudo eliminar (¿sos el autor o admin?)." };

  revalidatePath(
    entityHref(current.entity_type, current.entity_id, current.entity_code),
  );
  return { ok: true };
}

/**
 * Marca como leídas las menciones del user logueado.
 * - scope undefined: todas mis menciones sin leer.
 * - scope = { mentionId }: una mención puntual (al abrirla en la bandeja).
 */
export async function markMentionsRead(scope?: {
  mentionId?: string;
}): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };

  const supabase = await createClient();
  let q = supabase
    .from("comment_mentions")
    .update({ read_at: new Date().toISOString() })
    .eq("mentioned_user_id", user.id)
    .is("read_at", null);

  if (scope?.mentionId) q = q.eq("id", scope.mentionId);

  await q;

  revalidatePath("/studio/menciones");
  return { ok: true };
}
