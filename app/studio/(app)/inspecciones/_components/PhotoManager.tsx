"use client";

/**
 * PhotoManager — fotos de un reporte (SDD-0066 · Fase 2/3). Listado con miniaturas
 * (signed URLs) + subida (categoría opcional + multiple) + borrado. Bucket privado
 * `inspections`. Su propio <form> (no anida en el form del builder).
 */

import { useActionState, useEffect, useRef } from "react";
import {
  uploadInspectionPhotosAction,
  deleteInspectionPhotoAction,
} from "../actions";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

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
            <PhotoThumb key={p.id} item={p} onDeleted={() => toast.success("Foto eliminada")} />
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
}: {
  item: InspectionPhotoItem;
  onDeleted: () => void;
}) {
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
        onClick={async () => {
          const r = await deleteInspectionPhotoAction(item.id);
          if (!r.error) onDeleted();
        }}
        aria-label="Eliminar foto"
        title="Eliminar"
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
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        ×
      </button>
    </div>
  );
}
