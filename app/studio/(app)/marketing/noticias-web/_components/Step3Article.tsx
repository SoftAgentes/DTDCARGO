/**
 * Step3Article · paso 3 del generador.
 *
 * Muestra el titular elegido arriba con un botón "Copiar" a la derecha
 * que copia el artículo completo en Markdown (con `# titular` prefijado).
 *
 * Render del Markdown vía MarkdownLite (parser propio sin deps). Tipografía
 * Georgia, párrafos grey-700, headings ink.
 *
 * Botón inferior "Regenerar artículo" con Icon.refresh (animated cuando
 * loading).
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { copyToClipboard } from "./copy";
import { MarkdownLite } from "./MarkdownLite";

const SERIF: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

interface Props {
  selectedHeadline: string;
  markdown: string;
  onRegenerate: () => void;
  onPublish: () => void;
  /** Si está set, el artículo ya fue publicado · botón "Publicar" pasa a link "Ver en /noticias" */
  publishedSlug?: string | null;
  loading: boolean;
  error: string | null;
}

export function Step3Article({
  selectedHeadline,
  markdown,
  onRegenerate,
  onPublish,
  publishedSlug,
  loading,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const full = `# ${selectedHeadline}\n\n${markdown}`;
    const ok = await copyToClipboard(full);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Titular elegido + botón copiar todo */}
      <div className="border-b border-grey-200 pb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="eyebrow">Titular elegido</span>
          <h2
            className="text-ink mt-2"
            style={{ ...SERIF, fontSize: 24, lineHeight: 1.2 }}
          >
            {selectedHeadline}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={loading || !markdown}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-grey-200 text-grey-700 hover:border-wine hover:text-wine text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          style={
            copied
              ? {
                  color: "var(--color-status-success)",
                  borderColor: "var(--color-status-success)",
                }
              : undefined
          }
        >
          <span className="inline-flex" aria-hidden>
            {copied ? Icon.check(14) : Icon.copy(14)}
          </span>
          {copied ? "Copiado" : "Copiar artículo"}
        </button>
      </div>

      {/* Render del artículo */}
      {loading ? (
        <div
          className="text-grey-500 text-[14px] py-12 text-center"
          aria-live="polite"
        >
          <span className="inline-flex animate-spin mr-2" aria-hidden>
            {Icon.refresh(16)}
          </span>
          Redactando artículo completo...
        </div>
      ) : markdown ? (
        <article className="bg-white card-shadow border border-grey-200 rounded-lg p-6 lg:p-8">
          <MarkdownLite source={markdown} />
        </article>
      ) : (
        <div className="text-grey-500 text-[14px] py-12 text-center">
          Sin artículo todavía. Generá uno con el botón de abajo.
        </div>
      )}

      {/* Botones publicar (primary) + regenerar (ghost) + error */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {publishedSlug ? (
            <a
              href={`/noticias/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-[14.5px] text-white transition-colors"
              style={{ background: "var(--color-status-success, #1F8A5B)" }}
            >
              <span className="inline-flex" aria-hidden>
                {Icon.check(16)}
              </span>
              Publicado · Ver en /noticias/{publishedSlug}
              <span className="inline-flex" aria-hidden>
                {Icon.external(12)}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={loading || !markdown}
              className="inline-flex items-center gap-2 bg-wine text-white px-5 py-3 rounded-lg font-semibold text-[14.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
            >
              <span className="inline-flex" aria-hidden>
                {Icon.upload(16)}
              </span>
              Publicar artículo
            </button>
          )}
          {!publishedSlug && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-white border border-grey-200 text-grey-700 px-5 py-3 rounded-lg font-semibold text-[14.5px] hover:border-wine hover:text-wine transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                className={loading ? "inline-flex animate-spin" : "inline-flex"}
                aria-hidden
              >
                {Icon.refresh(16)}
              </span>
              {loading ? "Regenerando…" : "Regenerar artículo"}
            </button>
          )}
        </div>
        {error && (
          <p className="text-[13px] text-[color:var(--color-status-danger)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
