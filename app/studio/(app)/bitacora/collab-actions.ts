"use server";

/**
 * Server actions de COLABORACIÓN de Bitácora (SDD-0146 · Fase 4).
 *
 * REUSA los sistemas existentes (no reconstruye):
 *  - Comentarios + @menciones (SDD-0045): listComments/loadTenantUsers. La fila
 *    de comment_mentions ES la notificación in-app (bandeja /studio/menciones).
 *    La escritura/edición/borrado/reacciones las hacen las actions de 0045
 *    (postComment, etc.) — acá solo se CARGA el hilo para el drawer/detalle (que
 *    lo pintan en el cliente, así que necesitan un fetch, no un server-render).
 *  - Hub de documentos (SDD-0049): la fila de metadata del adjunto vive en
 *    `documents` (entity_type='bitacora_task', enum de 0215) → aparece en
 *    /studio/documentos. El BINARIO vive en el bucket `bitacora` (privado, 50 MB,
 *    acepta imagen/video/pdf) — signed URLs 1h con el USER client (respeta RLS).
 *
 * Mutaciones (register/delete) pasan moduleEditDenial PRIMERO (SDD-0085). Las
 * lecturas confían en la RLS por tenant (patrón de la casa en comments/documents).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import {
  getStudioRole,
  moduleEditDenial,
  moduleViewDenial,
} from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import {
  listComments,
  loadTenantUsers,
} from "@/lib/studio/comments/comments-queries";
import type {
  CommentTenantUser,
  CommentWithMeta,
} from "@/lib/studio/comments/types";
import { listDocumentsByEntity } from "@/lib/studio/documents/queries";
import { documentObjectBucket } from "@/lib/studio/documents/object-bucket";
import {
  ATTACH_MAX_BYTES,
  BITACORA_BUCKET,
  attachmentKindFromMime,
  attachmentKindLabel,
  isAllowedAttachmentMime,
  isValidTaskAttachmentPath,
  type AttachmentKind,
} from "@/lib/studio/bitacora/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** TTL de las signed URLs de la galería: 1 hora (spec Fase 4). */
const SIGNED_URL_TTL_SECONDS = 3600;

// ─── Comentarios del hilo (carga para el drawer/detalle client) ──

export type TaskCommentsPayload = {
  comments: CommentWithMeta[];
  users: CommentTenantUser[];
  currentUser: CommentTenantUser;
  canModerateComments: boolean;
  canRestoreComments: boolean;
};

/**
 * Carga el hilo de comentarios de una tarea + los usuarios del tenant (para el
 * autocomplete de @menciones y resolver autores) + el usuario actual. La RLS de
 * `comments` filtra por tenant; una tarea de otro tenant devuelve [] (no filtra
 * por permiso de módulo: comentarios/tareas son tenant-wide, regla SDD-0085).
 */
export async function getTaskCommentsAction(
  taskId: string,
): Promise<TaskCommentsPayload | { error: string }> {
  const supabase = await createClient();
  // SDD-0624: gate del módulo además de la sesión y el tenant.
  const denial = await moduleViewDenial(supabase, "bitacora");
  if (denial) return { error: denial };

  const user = await getUser();
  const tenantId = await getUserTenantId();
  if (!user || !tenantId) return { error: "No autenticado." };
  if (!UUID_RE.test(taskId)) return { error: "Tarea inválida." };

  const users = await loadTenantUsers(tenantId);
  const comments = await listComments(
    supabase,
    "bitacora_task",
    taskId,
    users,
    user.id,
  );
  const currentUser: CommentTenantUser =
    users.find((u) => u.id === user.id) ?? {
      id: user.id,
      name: "Yo",
      avatar: "YO",
      role: "Equipo",
    };
  const role = await getStudioRole(supabase);

  return {
    comments,
    users,
    currentUser,
    canModerateComments: canSpecial(role, "moderate_comments"),
    canRestoreComments: canSpecial(role, "restore_comments"),
  };
}

// ─── Adjuntos "prueba de avance" ─────────────────────────────

export type TaskAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
  storagePath: string;
  /** Signed URL (1h) contra el bucket de la fila (`bitacora`). null si no se pudo firmar. */
  signedUrl: string | null;
};

/**
 * Lista los adjuntos de una tarea (desde `documents`, filtrando la entidad) y
 * firma cada uno contra el bucket `bitacora` con el USER client (Storage RLS por
 * tenant → un path de otro tenant no firma). Degrada a [] sin romper.
 */
export async function listTaskAttachmentsAction(
  taskId: string,
): Promise<TaskAttachment[]> {
  const supabase = await createClient();
  // SDD-0624: esta acción FIRMA URLs del bucket; exige ver la bitácora.
  if (await moduleViewDenial(supabase, "bitacora")) return [];

  const tenantId = await getUserTenantId();
  if (!tenantId || !UUID_RE.test(taskId)) return [];

  const docs = await listDocumentsByEntity(supabase, "bitacora_task", taskId);

  return Promise.all(
    docs.map(async (d) => {
      let signedUrl: string | null = null;
      // Solo firmamos paths que matchean el shape del tenant+tarea (defensa; los
      // paths vienen de filas RLS-scoped, pero validamos igual antes de firmar),
      // en el bucket que dice la fila (SDD-0508).
      const bucket = documentObjectBucket(d);
      if (bucket && isValidTaskAttachmentPath(d.storage_path, tenantId, taskId)) {
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(d.storage_path, SIGNED_URL_TTL_SECONDS);
        signedUrl = data?.signedUrl ?? null;
      }
      return {
        id: d.id,
        name: d.name,
        kind: attachmentKindFromMime(d.content_type),
        mime: d.content_type,
        sizeBytes: d.size_bytes,
        createdAt: d.created_at,
        storagePath: d.storage_path,
        signedUrl,
      } satisfies TaskAttachment;
    }),
  );
}

/**
 * Registra un adjunto ya subido al bucket `bitacora` (upload directo browser→
 * Storage con el USER client). Inserta la fila en `documents`
 * (entity_type='bitacora_task') → el trigger DB `documents_validate_entity`
 * valida que la tarea exista y sea del tenant (via document_entity_in_tenant de
 * 0215). El path se re-valida contra el tenant del caller + la tarea (defensa en
 * profundidad). Rollback del object si el insert falla.
 */
export async function registerTaskAttachmentAction(
  taskId: string,
  storagePath: string,
  meta: { name?: string; mime?: string; sizeBytes?: number },
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "bitacora");
  if (denial) return { error: denial };

  const user = await getUser();
  const tenantId = await getUserTenantId();
  if (!user || !tenantId) return { error: "No autenticado." };
  if (!UUID_RE.test(taskId)) return { error: "Tarea inválida." };

  if (!isValidTaskAttachmentPath(storagePath, tenantId, taskId)) {
    return { error: "Ruta de archivo inválida." };
  }

  const mime = meta.mime ?? null;
  if (!isAllowedAttachmentMime(mime)) {
    return { error: "Formato no permitido (imagen, video o PDF)." };
  }

  const size =
    typeof meta.sizeBytes === "number" && Number.isFinite(meta.sizeBytes)
      ? meta.sizeBytes
      : null;
  if (size != null && (size < 0 || size > ATTACH_MAX_BYTES)) {
    return { error: "El archivo supera 50 MB." };
  }

  const kind = attachmentKindFromMime(mime);
  const name =
    ((meta.name ?? "").trim() || attachmentKindLabel(kind)).slice(0, 200);

  // id + root_id = id → cadena v1 del versionado (SDD-0060). Explícito para no
  // depender de un default/trigger de root_id (root_id es NOT NULL en 0116).
  const docId = crypto.randomUUID();
  const { error } = await supabase.from("documents").insert({
    id: docId,
    tenant_id: tenantId,
    entity_type: "bitacora_task",
    entity_id: taskId,
    folder: "otr-internos",
    doc_type: attachmentKindLabel(kind),
    name,
    storage_path: storagePath,
    // SDD-0508: el objeto está en `bitacora`. Sin esto la columna toma el
    // default 'documents' (0307) y el hub borraría/firmaría en el bucket ajeno.
    bucket_id: BITACORA_BUCKET,
    content_type: mime,
    size_bytes: size,
    status: "vigente",
    uploaded_by: user.id,
    root_id: docId,
  });
  if (error) {
    // Rollback del object si no se pudo indexar (incluye el rechazo del trigger
    // ante un taskId forjado/ajeno). El USER client borra su propio object.
    await supabase.storage.from(BITACORA_BUCKET).remove([storagePath]);
    return { error: `No se pudo registrar el adjunto: ${error.message}` };
  }

  revalidatePath("/studio/bitacora");
  revalidatePath("/studio/documentos");
  revalidatePath(`/m/erp/bitacora/tarea/${taskId}`);
  return { ok: true };
}

/**
 * Elimina un adjunto de una tarea: soft-delete de la fila `documents`
 * (deleted_at) + borrado best-effort del object del bucket. moduleEditDenial
 * primero. Acota a entity_type='bitacora_task' (no toca otros adjuntos del hub).
 */
export async function deleteTaskAttachmentAction(
  docId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "bitacora");
  if (denial) return { error: denial };

  if (!UUID_RE.test(docId)) return { error: "Adjunto inválido." };

  const { data: doc } = await supabase
    .from("documents")
    .select("id, tenant_id, storage_path, bucket_id, entity_type, entity_id")
    .eq("id", docId)
    .eq("entity_type", "bitacora_task")
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      storage_path: string;
      bucket_id: string;
      entity_type: string;
      entity_id: string | null;
    }>();
  if (!doc?.id) return { error: "Adjunto no encontrado." };

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // Best-effort: el soft-delete ya lo oculta (RLS + queries filtran deleted_at).
  // El objeto se borra en el bucket que dice la fila (SDD-0508).
  const bucket = documentObjectBucket(doc);
  if (bucket) await supabase.storage.from(bucket).remove([doc.storage_path]);

  revalidatePath("/studio/bitacora");
  revalidatePath("/studio/documentos");
  if (doc.entity_id) revalidatePath(`/m/erp/bitacora/tarea/${doc.entity_id}`);
  return { ok: true };
}
