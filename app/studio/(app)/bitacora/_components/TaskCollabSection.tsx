"use client";

/**
 * TaskCollabSection · colaboración de una tarea (SDD-0146 · Fase 4).
 *
 * Sección compartida por el drawer desktop (TaskDrawer) y el detalle móvil
 * (TareaDetailClient):
 *   1. "Prueba de avance" — galería de adjuntos (foto/video/doc) con signed URL
 *      1h + subida directa browser→bucket `bitacora` (USER client) → fila en
 *      `documents` (aparece en /studio/documentos). ≤50 MB, rechazo antes de subir.
 *   2. Comentarios + @menciones — REUSA <CommentsThread> (SDD-0045). Como el
 *      contenedor carga el hilo en el cliente, pasamos `onAfterChange` para
 *      re-fetchear tras cada mutación (router.refresh recarga la page, no el
 *      fetch del cliente).
 *
 * Los comentarios son inmutables en identidad (trigger freeze de 0090); la
 * escritura/edición/borrado la maneja 0045. Solo tokens var(--*).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createClient as createBrowserSupabase } from "@/lib/db/client";
import { CommentsThread } from "@/app/studio/(app)/_components/comments/CommentsThread";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  ATTACH_MAX_BYTES,
  BITACORA_BUCKET,
  attachmentContentTypeForExt,
  attachmentExtFromFile,
  attachmentKindLabel,
  buildTaskAttachmentPath,
} from "@/lib/studio/bitacora/storage";
import {
  deleteTaskAttachmentAction,
  getTaskCommentsAction,
  listTaskAttachmentsAction,
  registerTaskAttachmentAction,
  type TaskAttachment,
  type TaskCommentsPayload,
} from "../collab-actions";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,application/pdf";

interface Props {
  taskId: string;
  /** Título de la tarea → pista de contexto en la bandeja de menciones. */
  taskTitulo: string;
  canEdit: boolean;
  tenantId: string;
  /** Móvil: agrega un input con `capture` para abrir la cámara directo. */
  allowCamera?: boolean;
}

export function TaskCollabSection({
  taskId,
  taskTitulo,
  canEdit,
  tenantId,
  allowCamera = false,
}: Props) {
  const toast = useToast();
  const [collab, setCollab] = useState<TaskCommentsPayload | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const refetchComments = useCallback(async () => {
    const res = await getTaskCommentsAction(taskId);
    if (!("error" in res)) setCollab(res);
  }, [taskId]);

  const refetchAttachments = useCallback(async () => {
    setAttachments(await listTaskAttachmentsAction(taskId));
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getTaskCommentsAction(taskId),
      listTaskAttachmentsAction(taskId),
    ]).then(([comments, taskAttachments]) => {
      if (cancelled) return;
      if (!("error" in comments)) setCollab(comments);
      setAttachments(taskAttachments);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function uploadOne(file: File): Promise<boolean> {
    const ext = attachmentExtFromFile(file);
    if (!ext) {
      setUploadError(`"${file.name}": formato no soportado (imagen, video o PDF).`);
      return false;
    }
    if (file.size > ATTACH_MAX_BYTES) {
      setUploadError(`"${file.name}" supera 50 MB. Sube uno más liviano.`);
      return false;
    }
    const contentType = attachmentContentTypeForExt(ext);
    const path = buildTaskAttachmentPath({
      tenantId,
      taskId,
      uuid: crypto.randomUUID(),
      ext,
    });
    const supabase = createBrowserSupabase();
    const { error: upErr } = await supabase.storage
      .from(BITACORA_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (upErr) {
      setUploadError(`No se pudo subir "${file.name}": ${upErr.message}`);
      return false;
    }
    const res = await registerTaskAttachmentAction(taskId, path, {
      name: file.name,
      mime: contentType,
      sizeBytes: file.size,
    });
    if (res?.error) {
      setUploadError(res.error);
      // El registro falló → limpiar el object huérfano (best-effort).
      await supabase.storage.from(BITACORA_BUCKET).remove([path]);
      return false;
    }
    return true;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !canEdit) return;
    setUploadError(null);
    setUploading(true);
    // Subida secuencial a propósito (una tras otra) para no saturar la conexión
    // del teléfono y dar feedback ordenado.
    const results: boolean[] = [];
    try {
      for (const file of Array.from(files)) {
        results.push(await uploadOne(file));
      }
    } finally {
      setUploading(false);
    }
    const uploaded = results.filter(Boolean).length;
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Adjunto subido" : `${uploaded} adjuntos subidos`);
      await refetchAttachments();
    }
  }

  function onDelete(id: string) {
    startDelete(async () => {
      const res = await deleteTaskAttachmentAction(id);
      setConfirmDeleteId(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setAttachments((xs) => (xs ? xs.filter((a) => a.id !== id) : xs));
      toast.success("Adjunto eliminado");
    });
  }

  const list = attachments ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* ── Prueba de avance ─────────────────────────────── */}
      <section>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--wine-text)", marginBottom: 10 }}
        >
          Prueba de avance
          {list.length > 0 && (
            <span style={{ color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>
              {list.length}
            </span>
          )}
        </div>

        {attachments === null ? (
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "0 0 12px",
            }}
          >
            Cargando adjuntos…
          </p>
        ) : list.length === 0 ? (
          <p
            style={{
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "0 0 12px",
            }}
          >
            Sin fotos ni documentos todavía.
            {canEdit ? " Sube una foto del avance." : ""}
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: "0 0 12px",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
            }}
          >
            {list.map((a) => (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-3)",
                  padding: "var(--s-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--bg-surface)",
                }}
              >
                <Thumb attachment={a} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12.5px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: "var(--s-1)",
                    }}
                  >
                    <Badge tone={kindTone(a.kind)} size="sm">
                      {attachmentKindLabel(a.kind)}
                    </Badge>
                    <span
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {formatSize(a.sizeBytes)}
                    </span>
                  </div>
                </div>

                {a.signedUrl && (
                  <a
                    href={a.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    style={{ flexShrink: 0 }}
                  >
                    Ver
                  </a>
                )}

                {canEdit &&
                  (confirmDeleteId === a.id ? (
                    <div style={{ display: "flex", gap: "var(--s-1)", flexShrink: 0 }}>
                      <button
                        type="button"
                        className="studio-btn studio-btn-danger studio-btn-xs"
                        onClick={() => onDelete(a.id)}
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Eliminar ${a.name}`}
                      onClick={() => setConfirmDeleteId(a.id)}
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        padding: 6,
                        color: "var(--ink-mute)",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      {Icon.trash(14)}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {Icon.upload(13)} {uploading ? "Subiendo…" : "Subir foto o documento"}
            </button>

            {allowCamera && (
              <>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                >
                  {Icon.camera(13)} Tomar foto
                </button>
              </>
            )}
          </div>
        )}

        {uploadError && (
          <div style={{ marginTop: 8 }}>
            <Aviso tono="error" compacto>
              {uploadError}
            </Aviso>
          </div>
        )}
      </section>

      {/* ── Comentarios + @menciones (SDD-0045) ──────────── */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 18,
        }}
      >
        {collab ? (
          <CommentsThread
            entityType="bitacora_task"
            entityId={taskId}
            entityCode={taskTitulo.slice(0, 120)}
            entityLabel="tarea"
            users={collab.users}
            currentUser={collab.currentUser}
            initialComments={collab.comments}
            canEditComments={canEdit}
            canModerateComments={collab.canModerateComments}
            canRestoreComments={collab.canRestoreComments}
            onAfterChange={refetchComments}
          />
        ) : (
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            Cargando comentarios…
          </p>
        )}
      </section>
    </div>
  );
}

/** Miniatura: imagen firmada para fotos; glifo para video/doc. */
function Thumb({ attachment }: { attachment: TaskAttachment }) {
  const box: React.CSSProperties = {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: "var(--r-sm)",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-elevated)",
    color: "var(--ink-mute)",
  };
  if (attachment.kind === "foto" && attachment.signedUrl) {
    return (
      <span style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.signedUrl}
          alt={attachment.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return <span style={box}>{attachment.kind === "video" ? Icon.camera(18) : Icon.download(18)}</span>;
}

function kindTone(kind: TaskAttachment["kind"]): "info" | "wine" | "neutral" {
  return kind === "foto" ? "info" : kind === "video" ? "wine" : "neutral";
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
