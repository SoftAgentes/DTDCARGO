"use client";

/**
 * PhotoManager — fotos de un reporte (SDD-0066 · Fase 2/3). Listado con miniaturas
 * (signed URLs) + subida (categoría opcional + multiple) + borrado. Bucket privado
 * `inspections`. Su propio <form> (no anida en el form del builder).
 */

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  uploadInspectionPhotosAction,
  deleteInspectionPhotoAction,
} from "../actions";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Spinner } from "@/app/studio/_components/ui/EtiquetaEstable";

export function PhotoManager({
  reportId,
  photos,
}: {
  reportId: string;
  photos: InspectionPhotoItem[];
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(
    uploadInspectionPhotosAction.bind(null, reportId),
    {} as { ok?: boolean; error?: string },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success("Fotos subidas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {photos.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Sin fotos todavía. Sube producto, defectos, embalaje, caja máster,
          Shipping Mark (PSI) o planta, maquinaria, almacén (fábrica).
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {photos.map((p) => (
            <PhotoThumb
              key={p.id}
              item={p}
              onDeleted={() => toast.success("Foto eliminada")}
              onError={(m) => toast.error(`No se pudo eliminar la foto: ${m}`)}
            />
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={action}
        style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="photo-category">
            Categoría (opcional)
          </label>
          <input
            id="photo-category"
            name="category"
            type="text"
            className="studio-input"
            placeholder="Producto / Embalaje / Planta…"
            autoComplete="off"
          />
        </div>
        <input
          type="file"
          name="photos"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          className="studio-file"
          style={{ flex: "1 1 240px" }}
        />
        <button
          type="submit"
          className="studio-btn studio-btn-dark studio-btn-sm"
          disabled={pending}
        >
          {pending ? "Subiendo…" : "Subir fotos"}
        </button>
        {state.error && (
          <div style={{ flexBasis: "100%" }}>
            <Aviso tono="error" compacto>
              {state.error}
            </Aviso>
          </div>
        )}
      </form>
    </div>
  );
}

function PhotoThumb({
  item,
  onDeleted,
  onError,
}: {
  item: InspectionPhotoItem;
  onDeleted: () => void;
  onError: (mensaje: string) => void;
}) {
  // SDD-0678 · BTN-01 §5 y LOD-01: mientras borra, la × queda deshabilitada (sin doble clic), con spinner y
  // `aria-busy`; si falla, lo dice (antes el error se perdía en silencio).
  const [borrando, startBorrar] = useTransition();
  return (
    <div style={{ position: "relative" }}>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.caption ?? ""}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.caption ?? "Foto"}
            loading="lazy"
            style={{
              width: 82,
              height: 82,
              objectFit: "cover",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
        </a>
      ) : (
        <div
          style={{
            width: 82,
            height: 82,
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            font: "500 10px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
          }}
        >
          sin vista
        </div>
      )}
      {item.category && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            left: 4,
            font: "600 9px/1 var(--f-sans)",
            color: "var(--ink-inv)",
            background: "var(--scrim)",
            borderRadius: "var(--r-xs)",
            padding: "2px 5px",
          }}
        >
          {item.category}
        </span>
      )}
      <button
        type="button"
        disabled={borrando}
        aria-busy={borrando}
        onClick={() => {
          if (borrando) return;
          startBorrar(async () => {
            // Una promesa rechazada (red caída, acción que lanza) NO puede salir de la transición: en React 19 llegaría
            // al límite de errores y tumbaría la pantalla. Se captura y se dice con un mensaje genérico.
            try {
              const r = await deleteInspectionPhotoAction(item.id);
              if (r.error) onError(r.error);
              else onDeleted();
            } catch {
              onError("Error de conexión. Intenta de nuevo.");
            }
          });
        }}
        aria-label={borrando ? "Eliminando foto…" : "Eliminar foto"}
        title={borrando ? "Eliminando…" : "Eliminar"}
        style={{
          position: "absolute",
          top: -7,
          right: -7,
          width: 24,
          height: 24,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          color: "var(--danger)",
          font: "700 11px/1 var(--f-sans)",
          cursor: borrando ? "progress" : "pointer",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {borrando ? (
          <span className="studio-spin" style={{ display: "inline-flex" }}>
            <Spinner size={12} />
          </span>
        ) : (
          "×"
        )}
      </button>
    </div>
  );
}
