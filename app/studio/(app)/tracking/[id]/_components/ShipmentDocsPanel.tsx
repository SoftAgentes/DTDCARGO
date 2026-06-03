"use client";

/**
 * Panel de Documentos del envío (SDD-0042 Fase 3b · Studio).
 *
 * El equipo sube BL / POD / otros archivos al envío; el cliente los ve read-only
 * en su portal. Lista + subida (form estándar, espeja ShipmentDataPanel) +
 * borrado por documento con CONFIRM INLINE (Regla 5/8: destructivo irreversible
 * → doble-check, porque borra un BL/POD que el cliente podría estar viendo). Las
 * signed URLs las resuelve el server (page.tsx) y se pasan acá.
 *
 * Nota de convención: la subida usa `<button type="submit">` plano (no
 * ActionButton) porque el form lleva `<input type="file">` + useActionState;
 * el anti-doble-submit lo cubre `disabled={isPending}`. Espeja ShipmentDataPanel.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  uploadShipmentDocumentAction,
  deleteShipmentDocumentAction,
  type DocActionState,
} from "../document-actions";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import {
  SHIPMENT_DOC_TYPE_OPTIONS,
  shipmentDocTypeShort,
  formatDocSize,
  type ShipmentDocType,
  type ShipmentDocument,
} from "@/lib/studio/shipment-document-types";

const initial: DocActionState = {};

const DOC_TONE: Record<ShipmentDocType, BadgeTone> = {
  bl: "info",
  pod: "success",
  otro: "neutral",
};

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

export function ShipmentDocsPanel({
  shipmentId,
  documents,
  signedUrls,
}: {
  shipmentId: string;
  documents: ShipmentDocument[];
  signedUrls: Record<string, string>;
}) {
  const upload = uploadShipmentDocumentAction.bind(null, shipmentId);
  const [state, formAction, isPending] = useActionState(upload, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Limpiar el form tras una subida exitosa (evita re-subir el mismo archivo).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

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
        <span className="studio-eyebrow">Documentos del cliente · portal</span>
        <Badge tone="info" size="sm">
          Portal
        </Badge>
      </div>
      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
        }}
      >
        BL, POD u otros archivos del envío. El cliente los ve en su portal.
      </p>

      {documents.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "0 0 16px",
          }}
        >
          Todavía no hay documentos cargados.
        </p>
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
            const url = signedUrls[doc.storage_path];
            const meta = [formatDocSize(doc.size_bytes), formatDate(doc.created_at)]
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
                  borderRadius: 8,
                }}
              >
                <Badge tone={DOC_TONE[doc.doc_type]} size="sm">
                  {shipmentDocTypeShort(doc.doc_type)}
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
                    {doc.file_name}
                  </div>
                  {meta && (
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-mute)",
                      }}
                    >
                      {meta}
                    </div>
                  )}
                </div>

                {!confirming && url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    style={{ flexShrink: 0 }}
                  >
                    Ver
                  </a>
                )}

                {confirming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <ActionButton
                      variant="danger"
                      size="xs"
                      idleLabel="Confirmar"
                      loadingLabel="Eliminando…"
                      successLabel={null}
                      onAction={async () =>
                        deleteShipmentDocumentAction(shipmentId, doc.id)
                      }
                      onSuccess={() => setConfirmingId(null)}
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
        <div>
          <label className="studio-label" htmlFor="doc_type">
            Tipo
          </label>
          <select
            id="doc_type"
            name="doc_type"
            className="studio-input"
            defaultValue="bl"
          >
            {SHIPMENT_DOC_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="studio-label" htmlFor="doc_file">
            Archivo (PDF o imagen)
          </label>
          <input
            id="doc_file"
            name="file"
            type="file"
            accept="application/pdf,image/*"
            className="studio-input"
            required
          />
        </div>

        {state.fieldErrors?.file && (
          <p
            style={{
              color: "var(--danger)",
              font: "500 11px/1.3 var(--f-sans)",
              margin: 0,
            }}
          >
            {state.fieldErrors.file}
          </p>
        )}
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
            Documento subido
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
