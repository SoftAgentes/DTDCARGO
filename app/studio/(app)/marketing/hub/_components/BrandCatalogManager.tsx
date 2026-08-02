"use client";

/**
 * Administración del catálogo de marca (SDD-0238) — Studio › Marketing › HUB.
 *
 * Subir un archivo y que aparezca en `/marca` sin desplegar nada. Antes los
 * 4 logos estaban hardcodeados en el .tsx de esta misma página: agregar una
 * plantilla era un commit.
 *
 * La subida usa un `<form>` con `enctype` multipart implícito (Server Action con
 * FormData) — no hay fetch a mano ni estado de progreso: para archivos de marca,
 * que se suben de a uno y de vez en cuando, un spinner honesto alcanza.
 */

import { useActionState, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  BRAND_ASSET_KINDS,
  extensionOf,
  formatBytes,
  kindLabel,
  type BrandSection,
} from "@/lib/marca/catalog-types";
import {
  deleteBrandAssetAction,
  uploadBrandAssetAction,
  type BrandAdminState,
} from "../actions";

export function BrandCatalogManager({ sections }: { sections: BrandSection[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadState, uploadAction, isUploading] = useActionState<
    BrandAdminState,
    FormData
  >(async (prev, formData) => {
    const result = await uploadBrandAssetAction(prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  const [deleteState, deleteAction, isDeleting] = useActionState<
    BrandAdminState,
    FormData
  >(deleteBrandAssetAction, {});

  const [openSection, setOpenSection] = useState<string | null>(
    sections.find((s) => s.assets.length > 0)?.slug ?? sections[0]?.slug ?? null,
  );

  const total = sections.reduce((n, s) => n + s.assets.length, 0);

  return (
    <>
      {/* ── Subir ─────────────────────────────────────────────── */}
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--bg-surface)",
          padding: "20px 22px",
          marginBottom: 28,
        }}
      >
        <h2 className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
          Agregar un archivo
        </h2>

        <form
          ref={formRef}
          action={uploadAction}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <label className="studio-label" htmlFor="ba-file">
              Archivo
            </label>
            <input
              id="ba-file"
              name="file"
              type="file"
              required
              className="studio-input"
              style={{ padding: "8px 10px" }}
            />
          </div>

          <div style={{ flex: "0 1 190px" }}>
            <label className="studio-label" htmlFor="ba-section">
              Sección
            </label>
            <select id="ba-section" name="sectionId" required className="studio-input">
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "0 1 160px" }}>
            <label className="studio-label" htmlFor="ba-kind">
              Tipo
            </label>
            <select id="ba-kind" name="kind" className="studio-input" defaultValue="documento">
              {BRAND_ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "1 1 200px" }}>
            <label className="studio-label" htmlFor="ba-title">
              Nombre visible
            </label>
            <input
              id="ba-title"
              name="title"
              className="studio-input"
              placeholder="Se usa el del archivo si lo dejas vacío"
              maxLength={120}
            />
          </div>

          <div style={{ flex: "1 1 200px" }}>
            <label className="studio-label" htmlFor="ba-subtitle">
              Detalle
            </label>
            <input
              id="ba-subtitle"
              name="subtitle"
              className="studio-input"
              placeholder="Ej: 1080×1080 · Instagram"
              maxLength={120}
            />
          </div>

          <button
            type="submit"
            className="studio-btn studio-btn-primary studio-btn-sm"
            disabled={isUploading}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            {Icon.upload(14)}
            {isUploading ? "Subiendo…" : "Subir"}
          </button>
        </form>

        {(uploadState.error || uploadState.message) && (
          <p
            role="status"
            style={{
              font: "600 13px/1.4 var(--f-sans)",
              color: uploadState.error ? "var(--danger-web)" : "var(--ink)",
              margin: "12px 0 0",
            }}
          >
            {uploadState.error ?? uploadState.message}
          </p>
        )}
      </section>

      {/* ── Catálogo por sección ──────────────────────────────── */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: "var(--s-3)",
          }}
        >
          <h2 className="studio-eyebrow" style={{ margin: 0 }}>
            Catálogo
          </h2>
          <span style={{ font: "400 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            {total === 1 ? "1 archivo" : `${total} archivos`}
          </span>
        </div>

        {(deleteState.error || deleteState.message) && (
          <p
            role="status"
            style={{
              font: "600 13px/1.4 var(--f-sans)",
              color: deleteState.error ? "var(--danger-web)" : "var(--ink)",
              margin: "0 0 12px",
            }}
          >
            {deleteState.error ?? deleteState.message}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sections.map((section) => {
            const isOpen = openSection === section.slug;
            return (
              <div
                key={section.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  background: "var(--bg-surface)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenSection(isOpen ? null : section.slug)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "14px 18px",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      font: "700 14px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "var(--ink-soft)", display: "inline-flex" }}>
                      {isOpen ? Icon.chevD(16) : Icon.chevR(16)}
                    </span>
                    {section.title}
                  </span>
                  <Badge tone={section.assets.length > 0 ? "info" : "neutral"} size="sm">
                    {section.assets.length}
                  </Badge>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {section.assets.length === 0 ? (
                      <p
                        style={{
                          font: "400 13px/1.5 var(--f-sans)",
                          color: "var(--ink-soft)",
                          margin: 0,
                          padding: "16px 18px",
                        }}
                      >
                        Vacía. Lo que subas acá aparece en /marca#{section.slug}.
                      </p>
                    ) : (
                      section.assets.map((asset) => {
                        const meta = [
                          extensionOf(asset.storagePath),
                          formatBytes(asset.bytes),
                          kindLabel(asset.kind),
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <div
                            key={asset.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "12px 18px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  font: "600 13.5px/1.3 var(--f-sans)",
                                  color: "var(--ink)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={asset.title}
                              >
                                {asset.title}
                              </div>
                              <div
                                style={{
                                  font: "400 11.5px/1.4 var(--f-mono)",
                                  color: "var(--ink-soft)",
                                  marginTop: 2,
                                }}
                              >
                                {meta}
                              </div>
                            </div>

                            <form action={deleteAction} style={{ flexShrink: 0 }}>
                              <input type="hidden" name="assetId" value={asset.id} />
                              <button
                                type="submit"
                                className="studio-btn studio-btn-ghost studio-btn-xs"
                                disabled={isDeleting}
                                aria-label={`Quitar ${asset.title} del catálogo`}
                                style={{ display: "inline-flex", gap: 5, alignItems: "center" }}
                              >
                                {Icon.trash(13)} Quitar
                              </button>
                            </form>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
