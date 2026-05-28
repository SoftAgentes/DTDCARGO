/**
 * PublishModal · Plan v4 · Phase E — Modal de publicación del artículo.
 *
 * Carga al abrir el preview del writer auto-asignado (LRU) + opciones para
 * override + texto del disclaimer. Permite al operador:
 *  - Editar el slug autogenerado (default = slugify(headline))
 *  - Elegir un writer distinto si hay más de uno activo en el tipo
 *  - Confirmar y publicar → INSERT en news_posts vía publishPost action
 *
 * Para tipo='especial' no hay writer ni disclaimer (autor = "DTD Cargo").
 *
 * Patrón submit:
 *  - Loading durante publishPost
 *  - Success → onPublished({slug, postId, authorName}) — el padre cierra +
 *    toast + reset state
 *  - Error → setError + modal queda abierto para reintento
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { NEWS_CATEGORIES_V4, type NewsCategoria, type NewsTipo } from "@/lib/news/categories";
import { slugify } from "@/lib/news/slugify";
import {
  getPublishPreview,
  publishPost,
  type WriterOption,
} from "../actions";

interface Props {
  tipo: NewsTipo;
  categoria: NewsCategoria;
  headline: string;
  articleMarkdown: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  painPoints: string[];
  /** Si viene, el draft se marca como published al insertar */
  draftId?: string;
  onClose: () => void;
  onPublished: (result: {
    slug: string;
    postId: string;
    authorName: string;
  }) => void;
}

interface PreviewState {
  loading: boolean;
  error: string | null;
  proposed: { name: string; role: string | null } | null;
  options: WriterOption[];
  disclaimer: string | null;
}

export function PublishModal({
  tipo,
  categoria,
  headline,
  articleMarkdown,
  focusKeyword,
  secondaryKeywords,
  painPoints,
  draftId,
  onClose,
  onPublished,
}: Props) {
  const [slug, setSlug] = useState(() => slugify(headline));
  const [selectedWriterId, setSelectedWriterId] = useState<string | "auto">(
    "auto",
  );
  const [preview, setPreview] = useState<PreviewState>({
    loading: true,
    error: null,
    proposed: null,
    options: [],
    disclaimer: null,
  });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const catInfo = NEWS_CATEGORIES_V4[categoria];

  // ── Cargar preview al montar ────────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getPublishPreview({ tipo, headline })
      .then((res) => {
        if (!res.ok) {
          setPreview({
            loading: false,
            error: res.error,
            proposed: null,
            options: [],
            disclaimer: null,
          });
          return;
        }
        setPreview({
          loading: false,
          error: null,
          proposed: res.proposed,
          options: res.options,
          disclaimer: res.disclaimerPreview,
        });
      })
      .catch((e) => {
        setPreview({
          loading: false,
          error: e instanceof Error ? e.message : "Error desconocido",
          proposed: null,
          options: [],
          disclaimer: null,
        });
      });
  }, [tipo, headline]);

  // ── Escape cierra ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !publishing) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, publishing]);

  // Derivar writer efectivo (auto o override)
  const selectedWriter: { name: string; role: string | null } | null = (() => {
    if (selectedWriterId === "auto") return preview.proposed;
    const opt = preview.options.find((o) => o.id === selectedWriterId);
    return opt ? { name: opt.name, role: opt.role } : preview.proposed;
  })();

  // Disclaimer dinámico según writer elegido (re-deriva en cliente del proposed)
  const effectiveDisclaimer = (() => {
    if (!selectedWriter) return null;
    if (selectedWriter.name === preview.proposed?.name) return preview.disclaimer;
    // Si el user eligió override, re-construimos el disclaimer reemplazando el nombre
    if (!preview.disclaimer || !preview.proposed) return null;
    return preview.disclaimer.replace(preview.proposed.name, selectedWriter.name);
  })();

  const handlePublish = async () => {
    if (!slug.trim()) {
      setError("El slug no puede estar vacío");
      return;
    }
    setError(null);
    setPublishing(true);

    const overrides =
      selectedWriterId !== "auto" && selectedWriter
        ? { name: selectedWriter.name, role: selectedWriter.role }
        : undefined;

    const res = await publishPost({
      tipo,
      categoria,
      headline,
      article_markdown: articleMarkdown,
      focus_keyword: focusKeyword || null,
      secondary_keywords: secondaryKeywords,
      pain_points: painPoints,
      slug: slug.trim(),
      author_override: overrides,
      draft_id: draftId,
    });

    setPublishing(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    onPublished({
      slug: res.slug,
      postId: res.postId,
      authorName: res.authorName,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Publicar artículo"
      data-theme="light"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={publishing ? undefined : onClose}
        aria-label="Cerrar"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "var(--scrim, rgba(15,30,61,0.55))" }}
      />

      {/* Card */}
      <div className="relative bg-paper border border-grey-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-grey-200">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="eyebrow">Publicar a /noticias</span>
            <h2 className="text-ink text-[19px] font-bold leading-tight mt-1">
              Confirmar publicación
            </h2>
            <p className="text-[12.5px] text-grey-500 mt-1 leading-snug">
              Una vez publicado, el artículo aparece en{" "}
              <span className="font-semibold text-ink">dtdcargo.com/noticias</span>{" "}
              y es indexable por buscadores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            aria-label="Cerrar modal"
            className="w-9 h-9 grid place-items-center rounded-md border border-grey-200 text-grey-500 hover:border-wine hover:text-wine transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {Icon.close(14)}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
          {/* Categoría + titular */}
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Categoría</span>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                style={{ background: "var(--color-wine, #7F0F1A)" }}
              >
                {catInfo.label}
              </span>
              <span className="text-[12px] text-grey-500">
                ({tipo})
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Titular</span>
            <p
              className="text-[18px] text-ink font-bold leading-snug"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {headline}
            </p>
          </div>

          {/* Slug editable */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="publish-slug" className="eyebrow">
              Slug URL
            </label>
            <div className="flex items-center gap-2 bg-white border border-grey-200 rounded-md px-3 py-2 focus-within:border-wine transition-colors">
              <span className="text-[12px] text-grey-500 font-mono select-none">
                /noticias/
              </span>
              <input
                id="publish-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="flex-1 bg-transparent border-0 text-[14px] text-ink font-mono placeholder:text-grey-500 focus:outline-none"
                disabled={publishing}
              />
            </div>
            <p className="text-[11.5px] text-grey-500">
              Solo lowercase, dashes, sin tildes. Si el slug ya existe, se le
              sufija -2, -3, etc. automáticamente.
            </p>
          </div>

          {/* Writer (solo si no es especial) */}
          {tipo !== "especial" && (
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Escritor asignado</span>
              {preview.loading && (
                <div className="flex items-center gap-2 text-[12px] text-grey-500">
                  <span className="inline-flex animate-spin" aria-hidden>
                    {Icon.refresh(12)}
                  </span>
                  Cargando…
                </div>
              )}
              {preview.error && (
                <p className="text-[12.5px] text-[color:var(--color-status-danger)]">
                  {preview.error}
                </p>
              )}
              {!preview.loading && !preview.error && preview.proposed && (
                <>
                  {preview.options.length > 1 ? (
                    <select
                      value={selectedWriterId}
                      onChange={(e) => setSelectedWriterId(e.target.value)}
                      disabled={publishing}
                      className="w-full bg-white border border-grey-200 rounded-md px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-wine transition-colors"
                    >
                      <option value="auto">
                        Auto (rotación LRU) — {preview.proposed.name}
                      </option>
                      {preview.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-white border border-grey-200 rounded-md px-3 py-2 text-[14px] text-ink">
                      {preview.proposed.name}
                      {preview.proposed.role && (
                        <span className="text-[12px] text-grey-500 ml-2">
                          · {preview.proposed.role}
                        </span>
                      )}
                    </div>
                  )}
                  {preview.options.length > 1 && (
                    <p className="text-[11.5px] text-grey-500">
                      Por default rotamos LRU entre los activos del tipo (sale
                      la que hace más tiempo no publica). Podés forzar otra.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tipo === "especial" && (
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Autor</span>
              <div className="bg-white border border-grey-200 rounded-md px-3 py-2 text-[14px] text-ink">
                DTD Cargo
                <span className="text-[12px] text-grey-500 ml-2">
                  · sin disclaimer (anuncio oficial)
                </span>
              </div>
            </div>
          )}

          {/* Disclaimer preview */}
          {effectiveDisclaimer && (
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Disclaimer al pie del artículo</span>
              <div className="bg-grey-100 border border-grey-200 rounded-md px-3 py-3 text-[12.5px] text-grey-700 leading-relaxed italic">
                {effectiveDisclaimer}
              </div>
            </div>
          )}

          {/* Resumen meta */}
          <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-grey-500 pt-2 border-t border-grey-200">
            <span>
              <strong className="text-grey-700">
                {articleMarkdown.trim().split(/\s+/).filter(Boolean).length}
              </strong>{" "}
              palabras
            </span>
            <span>·</span>
            <span>
              <strong className="text-grey-700">
                {Math.max(
                  1,
                  Math.round(
                    articleMarkdown.trim().split(/\s+/).filter(Boolean).length /
                      200,
                  ),
                )}
              </strong>{" "}
              min lectura
            </span>
            {focusKeyword && (
              <>
                <span>·</span>
                <span>
                  focus:{" "}
                  <strong className="text-grey-700">{focusKeyword}</strong>
                </span>
              </>
            )}
            {secondaryKeywords.length > 0 && (
              <>
                <span>·</span>
                <span>
                  <strong className="text-grey-700">
                    {secondaryKeywords.length}
                  </strong>{" "}
                  keywords sec
                </span>
              </>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-[color:var(--color-status-danger)]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-grey-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="inline-flex items-center px-4 py-2 rounded-md border border-grey-200 text-grey-700 hover:border-wine hover:text-wine text-[13px] font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || preview.loading || !slug.trim()}
            className="inline-flex items-center gap-2 bg-wine text-white px-5 py-2 rounded-md font-semibold text-[13.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
          >
            {publishing && (
              <span className="inline-flex animate-spin" aria-hidden>
                {Icon.refresh(14)}
              </span>
            )}
            {publishing ? "Publicando…" : "Publicar artículo"}
          </button>
        </div>
      </div>
    </div>
  );
}
