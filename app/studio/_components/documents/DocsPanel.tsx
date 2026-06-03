"use client";

/**
 * <DocsPanel> · Panel de documentos EMBEBIBLE (DMS · SDD-0049 Slice B).
 *
 * Drop-in para cualquier detalle del Studio: `<DocsPanel entityType entityId>`.
 * Lista los documentos de esa entidad (vienen del server vía la prop `documents`,
 * que el page resuelve con listDocumentsByEntity), permite subir (form estándar →
 * uploadDocument), abrir por signed-URL (se firma on-demand server-side con TTL
 * corto — no se exponen URLs pre-firmadas en el HTML) y borrar con confirm inline.
 *
 * Convención de subida: `<button type="submit">` plano (no ActionButton) porque
 * el form lleva `<input type="file">` + useActionState; el anti-doble-submit lo
 * cubre `disabled={isPending}`. Espeja ShipmentDocsPanel (0086).
 *
 * Solo tokens var(--*) — cero hex. Primitivas del sistema (Badge/EmptyState).
 */

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadDocument,
  deleteDocument,
  signDocumentUrl,
  type DocActionState,
} from "@/app/studio/(app)/documentos/actions";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  DOC_STATUS,
  EXT_META,
  FOLDERS,
  DOCUMENT_STATUSES,
  deriveDocStatus,
  extFromMime,
  folderLabel,
  formatDocSize,
  type DocumentEntityType,
  type DocumentRow,
} from "@/lib/studio/documents/types";

const initial: DocActionState = {};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Extensión mostrada en el glifo (desde content_type, fallback al path). */
function extOf(doc: DocumentRow): string {
  if (doc.content_type) {
    const e = extFromMime(doc.content_type);
    if (e !== "bin") return e;
  }
  const m = /\.([a-z0-9]+)$/i.exec(doc.storage_path);
  return m ? m[1].toLowerCase() : "bin";
}

export function DocsPanel({
  entityType,
  entityId,
  documents,
  title = "Documentos",
  badge,
  subtitle = "Adjuntos clasificados que también aparecen en el hub de Documentos.",
}: {
  entityType: DocumentEntityType;
  entityId: string;
  documents: DocumentRow[];
  /** Eyebrow del panel (qué clase de documentos son). Default "Documentos". */
  title?: string;
  /** Badge distintivo al lado del eyebrow (ej. Interno/Portal). Opcional. */
  badge?: { tone: BadgeTone; label: string };
  /** Subtítulo distintivo (quién los ve). Default genérico. */
  subtitle?: string;
}) {
  const [state, formAction, isPending] = useActionState(uploadDocument, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [opening, startOpen] = useTransition();

  // Limpiar el form tras una subida exitosa (evita re-subir el mismo archivo).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Abrir un documento: firma la URL on-demand y la abre en pestaña nueva.
  function open(storagePath: string) {
    startOpen(async () => {
      const url = await signDocumentUrl(storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  const folderOptions = FOLDERS.flatMap((g) =>
    g.children.map((c) => ({ id: c.id, label: `${g.label} · ${c.label}` })),
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span className="studio-eyebrow">
          {title}
          {documents.length > 0 && (
            <span style={{ color: "var(--ink-mute)", marginLeft: 8 }}>
              {documents.length}
            </span>
          )}
        </span>
        {badge && (
          <Badge tone={badge.tone} size="sm">
            {badge.label}
          </Badge>
        )}
      </div>
      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
        }}
      >
        {subtitle}
      </p>

      {documents.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--r-md)",
            padding: "18px",
            textAlign: "center",
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
            marginBottom: 16,
          }}
        >
          Sin documentos adjuntos. Usá el formulario de abajo para subir el BL,
          packing, factura, certificado, etc.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 16px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {documents.map((doc) => {
            const ext = extOf(doc);
            const extMeta = EXT_META[ext] ?? { tone: "neutral", label: ext.toUpperCase() };
            const display = deriveDocStatus(doc);
            const st = DOC_STATUS[display];
            const meta = [
              folderLabel(doc.folder),
              formatDocSize(doc.size_bytes),
              formatDate(doc.created_at),
            ]
              .filter(Boolean)
              .join(" · ");
            const confirming = confirmingId === doc.id;
            return (
              <li
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <Badge tone={extMeta.tone} size="sm">
                  {extMeta.label}
                </Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 13px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {doc.name}
                  </div>
                  {meta && (
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-mute)",
                      }}
                    >
                      {doc.doc_type ? `${doc.doc_type} · ${meta}` : meta}
                    </div>
                  )}
                </div>

                <Badge tone={st.tone} size="sm" dot>
                  {st.label}
                </Badge>

                {!confirming && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    onClick={() => open(doc.storage_path)}
                    disabled={opening}
                    style={{ flexShrink: 0 }}
                  >
                    {opening ? "Abriendo…" : "Ver"}
                  </button>
                )}

                {confirming ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <DeleteConfirm
                      docId={doc.id}
                      onDone={() => setConfirmingId(null)}
                    />
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    onClick={() => setConfirmingId(doc.id)}
                    style={{ flexShrink: 0, color: "var(--danger)" }}
                  >
                    Eliminar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {/* entity_type / entity_id van fijos: el panel SIEMPRE adjunta a SU
            entidad. El servidor igual valida con el trigger DB. */}
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor={`doc_folder_${entityId}`}>
              Carpeta
            </label>
            <select
              id={`doc_folder_${entityId}`}
              name="folder"
              className="studio-input"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Elegí una carpeta…
              </option>
              {folderOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor={`doc_status_${entityId}`}>
              Estado
            </label>
            <select
              id={`doc_status_${entityId}`}
              name="status"
              className="studio-input"
              defaultValue="vigente"
            >
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DOC_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor={`doc_type_${entityId}`}>
              Tipo (opcional)
            </label>
            <input
              id={`doc_type_${entityId}`}
              name="doc_type"
              type="text"
              className="studio-input"
              placeholder="BL marítimo, RIF, factura…"
              maxLength={120}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor={`doc_valid_${entityId}`}>
              Vence (opcional)
            </label>
            <input
              id={`doc_valid_${entityId}`}
              name="valid_until"
              type="date"
              className="studio-input"
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor={`doc_name_${entityId}`}>
            Nombre (opcional · usa el del archivo)
          </label>
          <input
            id={`doc_name_${entityId}`}
            name="name"
            type="text"
            className="studio-input"
            placeholder="Nombre visible del documento"
            maxLength={200}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor={`doc_file_${entityId}`}>
            Archivo (PDF, imagen, xlsx, docx o zip)
          </label>
          <input
            id={`doc_file_${entityId}`}
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.xlsx,.docx,.zip"
            className="studio-input"
            required
          />
        </div>

        {state.fieldErrors &&
          Object.values(state.fieldErrors).map((msg) => (
            <p
              key={msg}
              style={{
                color: "var(--danger)",
                font: "500 11px/1.3 var(--f-sans)",
                margin: 0,
              }}
            >
              {msg}
            </p>
          ))}
        {state.error && (
          <p
            style={{
              color: "var(--danger)",
              font: "500 12px/1.4 var(--f-sans)",
              margin: 0,
            }}
          >
            {state.error}
          </p>
        )}
        {state.ok && (
          <p
            style={{
              color: "var(--success)",
              font: "500 12px/1.4 var(--f-sans)",
              margin: 0,
            }}
          >
            Documento subido.
          </p>
        )}

        <div>
          <button
            type="submit"
            className="studio-btn studio-btn-primary studio-btn-sm"
            disabled={isPending}
            style={{ opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Subiendo…" : "Subir documento"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Botón "Confirmar" del borrado (transición + cierre tras éxito). */
function DeleteConfirm({
  docId,
  onDone,
}: {
  docId: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="studio-btn studio-btn-danger studio-btn-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteDocument(docId);
          onDone();
        })
      }
    >
      {pending ? "Eliminando…" : "Confirmar"}
    </button>
  );
}

/** Estado vacío reutilizable (no usado por defecto; expuesto por consistencia). */
export function DocsEmpty() {
  return (
    <EmptyState
      title="Sin documentos"
      description="Todavía no hay documentos adjuntos a esta transacción."
    />
  );
}
