/**
 * Step1Headlines · Plan v5 — Titular elegido (layout 2 columnas).
 *
 * Layout:
 *  - Izq (60%): SegmentedControl Tipo + Categoría + Topic textarea +
 *               SegmentedControl Tono + botón "Generar 5 titulares" +
 *               lista de 5 headlines (full-width debajo).
 *  - Der (40%, sticky): KeywordPanel (focus + secundarias + pain points).
 *
 * Plan v5: el Tipo + Categoría llegan pre-poblados por `detectBriefIntent`
 * (paso 0 Brief). El operador puede editarlos acá si Claude se equivocó.
 *
 * Cambios vs v4:
 *  - Eliminado el "chip de tipo" display-only — ahora es editable.
 *  - CategorySelector dropdown → SegmentedControl pills.
 *  - Tone pills ad-hoc → SegmentedControl pills.
 *  - Layout 1-col → 2-col con KeywordPanel sticky.
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { copyToClipboard } from "./copy";
import {
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
  ALL_TIPO_SLUGS,
  categoriasByTipo,
  type NewsCategoria,
  type NewsTipo,
} from "@/lib/news/categories";
import type { Tone } from "../actions";

const SERIF: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const TONE_OPTIONS: Array<{
  value: Tone;
  label: string;
  description: string;
}> = [
  { value: "informativo", label: "Informativo", description: "Claro y directo" },
  { value: "curiosidad", label: "Curiosidad", description: "Despierta interés" },
  { value: "polemico", label: "Polémico", description: "Provocador" },
];

interface Props {
  tipo: NewsTipo;
  onTipoChange: (t: NewsTipo) => void;
  categoria: NewsCategoria;
  onCategoriaChange: (c: NewsCategoria) => void;
  topic: string;
  onTopicChange: (v: string) => void;
  tone: Tone;
  onToneChange: (v: Tone) => void;
  headlines: string[];
  onHeadlinesChange: (next: string[]) => void;
  onGenerate: () => void;
  onSelect: (headline: string) => void;
  loading: boolean;
  error: string | null;
  /** Reason por la cual Claude sugirió este tipo+categoría desde el brief (Plan v5). */
  aiSuggestionReason?: string | null;
  /** Slot: chip "Sugerido por IA" — se renderiza debajo del CategorySelector (modo Auto manual de re-detect) */
  categoryDetectorSlot?: React.ReactNode;
  /** Slot: panel "Keywords SEO" expandible — col derecha sticky */
  keywordPanelSlot?: React.ReactNode;
}

export function Step1Headlines({
  tipo,
  onTipoChange,
  categoria,
  onCategoriaChange,
  topic,
  onTopicChange,
  tone,
  onToneChange,
  headlines,
  onHeadlinesChange,
  onGenerate,
  onSelect,
  loading,
  error,
  aiSuggestionReason,
  categoryDetectorSlot,
  keywordPanelSlot,
}: Props) {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const hasResults = headlines.length > 0;

  // Tipos como SegmentedControl cards (4 opciones)
  const tipoOptions = ALL_TIPO_SLUGS.map((t) => ({
    value: t,
    label: NEWS_TIPOS[t].label,
    description: NEWS_TIPOS[t].description,
  }));

  // Categorías del tipo actual como SegmentedControl pills
  const catsForTipo = categoriasByTipo(tipo);
  const catOptions = catsForTipo.map((c) => ({
    value: c,
    label: NEWS_CATEGORIES_V4[c].label,
  }));

  const handleCopy = async (idx: number, value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedIdx(idx);
      window.setTimeout(
        () => setCopiedIdx((cur) => (cur === idx ? null : cur)),
        1500,
      );
    }
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Banner sugerencia IA · solo si vino del brief */}
      {aiSuggestionReason && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg border"
          style={{
            background: "var(--wine-tint, rgba(127,15,26,0.06))",
            borderColor: "var(--wine, #7F0F1A)",
          }}
        >
          <span
            className="inline-flex flex-shrink-0 mt-0.5"
            style={{ color: "var(--wine, #7F0F1A)" }}
            aria-hidden
          >
            {Icon.info(16)}
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12.5px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--wine, #7F0F1A)" }}
            >
              Sugerencia editorial de Claude
            </div>
            <p className="text-[13px] text-ink mt-1 leading-snug">
              {aiSuggestionReason}
            </p>
          </div>
        </div>
      )}

      {/* Layout 2 columnas */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        {/* ─── Columna izquierda: clasificación + tema + tono + generar ─── */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Tipo editorial */}
          <div className="flex flex-col gap-2">
            <label className="eyebrow">Tipo editorial</label>
            <SegmentedControl<NewsTipo>
              value={tipo}
              onChange={onTipoChange}
              options={tipoOptions}
              variant="cards"
              columns={2}
              ariaLabel="Tipo editorial"
            />
          </div>

          {/* Categoría */}
          <div className="flex flex-col gap-2">
            <label className="eyebrow">Categoría</label>
            <SegmentedControl<NewsCategoria>
              value={categoria}
              onChange={onCategoriaChange}
              options={catOptions}
              variant="pills"
              ariaLabel="Categoría"
            />
            {categoryDetectorSlot}
          </div>

          {/* Tema base */}
          <div className="flex flex-col gap-2">
            <label className="eyebrow" htmlFor="seo-topic">
              Tema base
            </label>
            <textarea
              id="seo-topic"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              rows={3}
              placeholder={`Ej tema para ${catInfo.label}: "Logística China-Venezuela se detiene por X"`}
              className="w-full bg-white border border-grey-200 rounded-lg p-4 text-[15px] text-ink placeholder:text-grey-500 focus:outline-none focus:border-wine transition-colors resize-y"
              disabled={loading}
            />
            <p className="text-[11.5px] text-grey-500">
              Los 5 titulares arrancarán con:{" "}
              <code className="text-wine font-semibold">
                {catInfo.titlePrefix}
              </code>
            </p>
          </div>

          {/* Tono */}
          <div className="flex flex-col gap-2">
            <label className="eyebrow">Tono</label>
            <SegmentedControl<Tone>
              value={tone}
              onChange={onToneChange}
              options={TONE_OPTIONS.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
              variant="pills"
              ariaLabel="Tono editorial"
              disabled={loading}
            />
            <p className="text-[12px] text-grey-500 mt-1">
              {TONE_OPTIONS.find((t) => t.value === tone)?.description}
            </p>
          </div>

          {/* Botón generar */}
          <div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading || !topic.trim()}
              className="inline-flex items-center gap-2 bg-wine text-white px-5 py-3 rounded-lg font-semibold text-[14.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
            >
              <span
                className={loading ? "inline-flex animate-spin" : "inline-flex"}
                aria-hidden
              >
                {loading
                  ? Icon.refresh(16)
                  : hasResults
                    ? Icon.refresh(16)
                    : Icon.spark(16)}
              </span>
              {loading
                ? "Generando 5 titulares…"
                : hasResults
                  ? "Regenerar 5 alternativas"
                  : "Generar 5 alternativas"}
            </button>
            {error && (
              <p className="mt-3 text-[13px] text-[color:var(--color-status-danger)]">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* ─── Columna derecha: KeywordPanel sticky ─── */}
        {keywordPanelSlot && (
          <div className="lg:sticky lg:top-4 min-w-0">{keywordPanelSlot}</div>
        )}
      </div>

      {/* Lista de titulares · full-width debajo del 2-col */}
      {hasResults && (
        <div className="flex flex-col gap-3 mt-2">
          <span className="eyebrow">5 alternativas — edita y elige una</span>
          {headlines.map((h, idx) => (
            <div
              key={idx}
              className="card-shadow group bg-white border border-grey-200 rounded-lg p-4 flex items-start gap-4 hover:border-wine transition-colors"
            >
              <span
                className="text-[28px] font-bold leading-none text-wine select-none flex-shrink-0 pt-1"
                style={SERIF}
                aria-hidden
              >
                {idx + 1}
              </span>
              <textarea
                value={h}
                onChange={(e) => {
                  const next = [...headlines];
                  next[idx] = e.target.value;
                  onHeadlinesChange(next);
                }}
                rows={2}
                className="flex-1 bg-transparent text-ink text-[18px] leading-snug border-none focus:outline-none resize-none"
                style={SERIF}
              />
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(idx, h)}
                  title="Copiar"
                  aria-label="Copiar titular"
                  className={`w-9 h-9 grid place-items-center rounded-md border transition-colors ${
                    copiedIdx === idx
                      ? "border-wine text-wine"
                      : "border-grey-200 text-grey-500 hover:border-wine hover:text-wine"
                  }`}
                  style={
                    copiedIdx === idx
                      ? {
                          color: "var(--color-status-success)",
                          borderColor: "var(--color-status-success)",
                        }
                      : undefined
                  }
                >
                  {copiedIdx === idx ? Icon.check(14) : Icon.copy(14)}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(h)}
                  title="Usar este titular"
                  aria-label="Usar este titular y avanzar"
                  className="w-9 h-9 grid place-items-center rounded-md border border-grey-200 text-grey-500 hover:border-wine hover:text-wine transition-colors"
                >
                  {Icon.chevR(14)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
