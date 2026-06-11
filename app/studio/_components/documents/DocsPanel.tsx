"use client";

/**
 * <DocsPanel> · Panel de documentos EMBEBIBLE (DMS · SDD-0049 Slice B + 0060 Slice B).
 *
 * Drop-in para cualquier detalle del Studio: `<DocsPanel entityType entityId>`.
 * Lista los documentos VIGENTES de esa entidad (vienen del server vía la prop
 * `documents`, que el page resuelve con listDocumentsByEntity — ya filtra is_current),
 * permite subir (form estándar → uploadDocument), abrir por signed-URL (se firma
 * on-demand server-side con TTL corto), borrar con confirm inline, y —SDD-0060—
 * SUBIR UNA NUEVA VERSIÓN + ver el HISTORIAL de versiones de cada documento.
 *
 * Convención de subida (alta nueva): `<button type="submit">` plano (no ActionButton)
 * porque el form lleva `<input type="file">` + useActionState; el anti-doble-submit lo
 * cubre `disabled={isPending}`. La SUBIDA DE VERSIÓN sí usa <ActionButton> (no es
 * idempotente y dispara la cadena append-only) + toast de trazabilidad.
 *
 * Solo tokens var(--*) — cero hex. Primitivas del sistema (Badge/EmptyState/ActionButton/
 * DrawerShell). Exporta <VersionHistoryDrawer> para reuso desde el hub.
 */

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  uploadDocument,
  deleteDocument,
  addDocumentVersion,
  listDocumentVersionsAction,
  signDocumentUrl,
  type DocActionState,
} from "@/app/studio/(app)/documentos/actions";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import {
  DrawerShell,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import {
  DOC_STATUS,
  EXT_META,
  FOLDERS,
  DOCUMENT_STATUSES,
  deriveDocStatus,
  extFromMime,
  folderLabel,
  formatDocSize,
  versionLabel,
  type DocumentEntityType,
  type DocumentRow,
  type DocumentVersionRow,
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
function extOf(doc: { content_type: string | null; storage_path: string }): string {
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
  const [historyFor, setHistoryFor] = useState<DocumentRow | null>(null);

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
          Sin documentos adjuntos. Usa el formulario de abajo para subir el BL,
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
                  flexDirection: "column",
                  gap: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Badge tone={extMeta.tone} size="sm">
                    {extMeta.label}
                  </Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          font: "600 13px/1.3 var(--f-sans)",
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.name}
                      </span>
                      <VersionChip n={doc.version_no} />
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
                    <>
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        onClick={() => open(doc.storage_path)}
                        disabled={opening}
                        style={{ flexShrink: 0 }}
                      >
                        {opening ? "Abriendo…" : "Ver"}
                      </button>
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        onClick={() => setHistoryFor(doc)}
                        style={{ flexShrink: 0 }}
                        title="Versiones de este documento"
                      >
                        Historial
                      </button>
                    </>
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
                </div>

                {!confirming && <VersionUpload doc={doc} />}
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
                Elige una carpeta…
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

      {historyFor && (
        <VersionHistoryDrawer
          rootId={historyFor.root_id}
          docName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

/** Chip neutral discreto con la versión vigente (v{n}). Se muestra siempre (§4.5). */
export function VersionChip({ n }: { n: number }) {
  return (
    <span
      title={`Versión ${n}`}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        height: 16,
        padding: "0 5px",
        borderRadius: "var(--r-sm)",
        background: "var(--neutral-bg)",
        color: "var(--ink-soft)",
        font: "700 9.5px/1 var(--f-mono)",
        letterSpacing: "0.02em",
      }}
    >
      {versionLabel(n)}
    </span>
  );
}

/**
 * Normaliza el resultado de addDocumentVersion para <ActionButton>.
 *
 * addDocumentVersion puede rechazar la subida con `{ fieldErrors }` (mime/size/
 * nombre/nota) SIN `error`. <ActionButton> solo inspecciona `result.error`, así
 * que un fieldError-only se trataría como ÉXITO (toast "Versión subida" + cierre
 * del form) aunque el server rechazó. Acá colapsamos un `{ fieldErrors }` (sin
 * `error`) al primer mensaje de campo → `{ error }`, para que el botón dispare
 * onError (banner) y NO el flash de éxito. Es subir un archivo + nota (no un form
 * multi-campo), así que un único mensaje en el banner es suficiente.
 */
export function versionResultToActionResult(
  res: DocActionState,
): { error?: string } | DocActionState {
  if (!res.error && res.fieldErrors) {
    const first = Object.values(res.fieldErrors)[0];
    return { error: first ?? "No se pudo subir la versión." };
  }
  return res;
}

/**
 * Subir una NUEVA versión de un documento existente (append-only). Input file +
 * nota opcional → addDocumentVersion(root_id, fd). Usa <ActionButton> (la subida
 * NO es idempotente y dispara la cadena) + toast de trazabilidad.
 */
function VersionUpload({ doc }: { doc: DocumentRow }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        style={{ alignSelf: "flex-start", color: "var(--wine)" }}
      >
        + Subir nueva versión
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          font: "700 10.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Nueva versión de “{doc.name}”
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.xlsx,.docx,.zip"
        className="studio-input"
      />
      <input
        ref={noteRef}
        type="text"
        className="studio-input"
        placeholder="Nota de la revisión (opcional · ej. corregido el monto)"
        maxLength={280}
      />
      {error && (
        <p
          style={{
            color: "var(--danger)",
            font: "500 11px/1.3 var(--f-sans)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="xs"
          idleLabel="Subir versión"
          loadingLabel="Subiendo…"
          successLabel="Versión subida"
          idleIcon={Icon.upload(13)}
          successIcon={Icon.check(13)}
          onAction={async () => {
            setError(null);
            const file = fileRef.current?.files?.[0];
            if (!file) return { error: "Elige un archivo." };
            const fd = new FormData();
            fd.set("file", file);
            const note = noteRef.current?.value ?? "";
            if (note.trim()) fd.set("version_note", note.trim());
            const res = await addDocumentVersion(doc.root_id, fd);
            // Colapsa un { fieldErrors } (rechazo de validación de la subida) a
            // { error } para que ActionButton NO lo trate como éxito (ver el
            // jsdoc de versionResultToActionResult). Sin esto, un mime/size
            // rechazado dispararía el toast "Versión subida" falso-positivo.
            return versionResultToActionResult(res);
          }}
          onSuccess={() => {
            toast.success(
              `Nueva versión de “${doc.name}” subida · ${versionLabel(
                doc.version_no + 1,
              )}`,
            );
            setOpen(false);
          }}
          onError={setError}
        />
      </div>
    </div>
  );
}

/**
 * Drawer del HISTORIAL de versiones de una cadena (SDD-0060). Carga
 * listDocumentVersionsAction(rootId) on-open (server action read-only) y lista
 * v{n} · nombre · tamaño · estado · nota · quién · cuándo con "Ver" por versión
 * (signed-URL TTL 60s). La versión vigente queda marcada. Reusado por el hub.
 */
export function VersionHistoryDrawer({
  rootId,
  docName,
  onClose,
}: {
  rootId: string;
  docName: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<DocumentVersionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opening, startOpen] = useTransition();

  useEffect(() => {
    let alive = true;
    listDocumentVersionsAction(rootId)
      .then((rows) => {
        if (alive) setVersions(rows);
      })
      .catch(() => {
        if (alive) setLoadError("No se pudo cargar el historial.");
      });
    return () => {
      alive = false;
    };
  }, [rootId]);

  function open(storagePath: string) {
    startOpen(async () => {
      const url = await signDocumentUrl(storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <DrawerShell
      title="Historial de versiones"
      subtitle={docName}
      onClose={onClose}
      pending={false}
      width={560}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "18px 22px" }}>
        {loadError ? (
          <p
            style={{
              color: "var(--danger)",
              font: "500 13px/1.4 var(--f-sans)",
            }}
          >
            {loadError}
          </p>
        ) : versions === null ? (
          <p
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            Cargando historial…
          </p>
        ) : versions.length === 0 ? (
          <EmptyState
            title="Sin versiones"
            description="Este documento todavía no tiene revisiones."
          />
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {versions.map((v) => {
              const ext = extOf(v);
              const extMeta = EXT_META[ext] ?? {
                tone: "neutral" as const,
                label: ext.toUpperCase(),
              };
              const st = DOC_STATUS[v.status];
              const sub = [formatDocSize(v.size_bytes), formatDate(v.created_at)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={v.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "11px 13px",
                    border: v.is_current
                      ? "1px solid var(--wine)"
                      : "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    background: v.is_current
                      ? "var(--wine-tint)"
                      : "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <VersionChip n={v.version_no} />
                    <Badge tone={extMeta.tone} size="sm">
                      {extMeta.label}
                    </Badge>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: "600 12.5px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.name}
                    </span>
                    {v.is_current && (
                      <Badge tone="wine" size="sm">
                        Vigente
                      </Badge>
                    )}
                    <Badge tone={st.tone} size="sm" dot>
                      {st.label}
                    </Badge>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => open(v.storage_path)}
                      disabled={opening}
                      style={{ flexShrink: 0 }}
                    >
                      {opening ? "Abriendo…" : "Ver"}
                    </button>
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {sub}
                    {v.uploaded_by ? " · subió un miembro del equipo" : ""}
                  </div>
                  {v.version_note && (
                    <div
                      style={{
                        font: "500 11.5px/1.4 var(--f-sans)",
                        color: "var(--ink-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      “{v.version_note}”
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DrawerShell>
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
