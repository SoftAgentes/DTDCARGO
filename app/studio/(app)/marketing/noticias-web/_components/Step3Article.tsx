/**
 * Step3Article · Plan v5 — artículo + panel SEO lateral.
 *
 * Layout:
 *  - Izq (1fr): titular + render Markdown del artículo con MarkdownLite.
 *               Los `[VERIFICAR:...]` markers se resaltan inline (visual hint
 *               para el editor: dato sin verificar, resolvelo antes de
 *               publicar).
 *  - Der (340px, sticky desktop): panel "Score SEO" con métricas computadas
 *               por `computeArticleScore`. Density del focus_keyword vs
 *               target 1-2%, cuenta de H2, longitud, pain points cubiertos,
 *               nut graf detectado, lista de markers VERIFICAR pendientes.
 *
 * Plan v5 enforcement:
 *  - Botón "Publicar" queda DISABLED si quedan `[VERIFICAR:...]` markers sin
 *    resolver en el body (decisión editorial: no publicar datos inventados).
 *
 * Mobile: panel SEO va arriba del artículo (no sticky).
 */

"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { copyToClipboard } from "./copy";
import { MarkdownLite } from "./MarkdownLite";
import {
  computeArticleScore,
  densityTone,
  isPublishReady,
  TARGET_DENSITY_MIN,
  TARGET_DENSITY_MAX,
} from "@/lib/news/score";

const SERIF: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

interface Props {
  selectedHeadline: string;
  markdown: string;
  focusKeyword?: string;
  painPoints?: string[];
  onRegenerate: () => void;
  onPublish: () => void;
  publishedSlug?: string | null;
  loading: boolean;
  error: string | null;
}

export function Step3Article({
  selectedHeadline,
  markdown,
  focusKeyword = "",
  painPoints = [],
  onRegenerate,
  onPublish,
  publishedSlug,
  loading,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);

  const score = useMemo(
    () => computeArticleScore(markdown, focusKeyword, painPoints),
    [markdown, focusKeyword, painPoints],
  );
  const publishReady = isPublishReady(score);
  const dTone = densityTone(score.focusKeywordDensity);

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
      {/* Header titular + copiar */}
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

      {/* Layout 2-col: artículo + panel SEO */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        {/* ─── Artículo ─── */}
        <div className="min-w-0">
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
              Sin artículo todavía. Genera uno con el botón de abajo.
            </div>
          )}
        </div>

        {/* ─── Panel SEO sticky ─── */}
        {markdown && !loading && (
          <aside
            className="lg:sticky lg:top-4 min-w-0"
            style={{
              background: "var(--bg-surface, #FFFFFF)",
              border: "1px solid var(--border, rgba(15,30,61,0.12))",
              borderRadius: "var(--r-lg, 12px)",
              padding: "16px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft, #6B6B6B)",
                  marginBottom: 4,
                }}
              >
                Score SEO
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-soft, #6B6B6B)",
                  lineHeight: 1.4,
                }}
              >
                Métricas computadas en cliente — el panel se actualiza si
                editas el markdown.
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <ScoreStat
                label="Palabras"
                value={String(score.wordCount)}
                hint={`${score.readTimeMin} min de lectura`}
              />
              <ScoreStat label="H2 (secciones)" value={String(score.h2Count)} />
              <ScoreStat
                label="Nut graf"
                value={score.hasNutGraf ? "Detectado" : "Falta"}
                tone={score.hasNutGraf ? "ok" : "warn"}
              />
              <ScoreStat
                label="Densidad focus"
                value={
                  focusKeyword
                    ? `${score.focusKeywordDensity.toFixed(2)}%`
                    : "—"
                }
                hint={
                  focusKeyword
                    ? `${score.focusKeywordOccurrences}× · target ${TARGET_DENSITY_MIN}-${TARGET_DENSITY_MAX}%`
                    : "Sin focus keyword"
                }
                tone={
                  dTone === "ok"
                    ? "ok"
                    : dTone === "missing"
                      ? "muted"
                      : "warn"
                }
              />
            </div>

            {/* Pain points cubiertos */}
            {painPoints.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink-soft, #6B6B6B)",
                    marginBottom: 6,
                  }}
                >
                  Pain points cubiertos · {score.painPointsCovered.length} /{" "}
                  {painPoints.length}
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {score.painPointsCovered.map((p) => (
                    <li
                      key={`covered-${p}`}
                      style={{
                        fontSize: 12,
                        color: "var(--color-status-success, #1F8A5B)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                      }}
                    >
                      <span style={{ flexShrink: 0 }} aria-hidden>
                        {Icon.check(12)}
                      </span>
                      <span style={{ lineHeight: 1.35 }}>{p}</span>
                    </li>
                  ))}
                  {score.painPointsMissed.map((p) => (
                    <li
                      key={`missed-${p}`}
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft, #6B6B6B)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        opacity: 0.75,
                      }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 1 }} aria-hidden>
                        {Icon.close(11)}
                      </span>
                      <span style={{ lineHeight: 1.35 }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Markers VERIFICAR */}
            {score.verifyMarkers.length > 0 && (
              <div
                style={{
                  background: "var(--warning-bg, rgba(184,137,58,0.10))",
                  border: "1px solid var(--warning, #B8893A)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--warning, #B8893A)",
                  }}
                >
                  ⚠ {score.verifyMarkers.length} dato
                  {score.verifyMarkers.length === 1 ? "" : "s"} sin verificar
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {score.verifyMarkers.slice(0, 5).map((m, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "var(--ink, #0F1E3D)",
                        lineHeight: 1.35,
                      }}
                    >
                      • {m.length > 60 ? `${m.slice(0, 60)}…` : m}
                    </li>
                  ))}
                  {score.verifyMarkers.length > 5 && (
                    <li
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-soft, #6B6B6B)",
                      }}
                    >
                      +{score.verifyMarkers.length - 5} más
                    </li>
                  )}
                </ul>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-soft, #6B6B6B)",
                    margin: "4px 0 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  Resuélvelos en el artículo (edita el markdown) antes de
                  publicar.
                </p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Botones publicar (primary) + regenerar (ghost) + error */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {publishedSlug ? (
            <a
              href={`/noticias/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-[14.5px] text-white transition-colors"
              style={{ background: "var(--color-status-success)" }}
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
              disabled={loading || !markdown || !publishReady}
              title={
                !publishReady && score.verifyMarkers.length > 0
                  ? `Resuelve los ${score.verifyMarkers.length} marcadores [VERIFICAR] antes de publicar`
                  : undefined
              }
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

// ── ScoreStat helper ─────────────────────────────────────────

interface ScoreStatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "muted";
}

function ScoreStat({ label, value, hint, tone }: ScoreStatProps) {
  const valueColor =
    tone === "ok"
      ? "var(--color-status-success, #1F8A5B)"
      : tone === "warn"
        ? "var(--warning, #B8893A)"
        : tone === "muted"
          ? "var(--ink-mute, #9CA3AF)"
          : "var(--ink, #0F1E3D)";
  return (
    <div
      style={{
        background: "var(--bg-elevated, rgba(15,30,61,0.03))",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft, #6B6B6B)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 10.5,
            color: "var(--ink-mute, #9CA3AF)",
            lineHeight: 1.2,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
