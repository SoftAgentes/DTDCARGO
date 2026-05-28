/**
 * Step1Headlines · paso 1 del generador.
 *
 * Input textarea para el tema base + 3 pills de tono (Informativo /
 * Curiosidad / Polémico) + botón "Generar 5 alternativas".
 *
 * Cuando hay resultados, renderiza 5 cards numeradas (serif wine) con
 * textarea editable + botones Copy y ChevronRight (avanzar al paso 2).
 *
 * Feedback de copia: icono Check verde durante 1.5s por card.
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { copyToClipboard } from "./copy";
import { CategorySelector } from "./CategorySelector";
import {
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
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
  {
    value: "informativo",
    label: "Informativo",
    description: "Claro y directo",
  },
  {
    value: "curiosidad",
    label: "Curiosidad",
    description: "Despierta interés",
  },
  {
    value: "polemico",
    label: "Polémico",
    description: "Provocador",
  },
];

interface Props {
  tipo: NewsTipo;
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
  /** Slot: chip "Sugerido por IA" — se renderiza debajo del CategorySelector */
  categoryDetectorSlot?: React.ReactNode;
  /** Slot: panel "Keywords SEO" expandible — se renderiza debajo del input de topic */
  keywordPanelSlot?: React.ReactNode;
}

export function Step1Headlines({
  tipo,
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
  categoryDetectorSlot,
  keywordPanelSlot,
}: Props) {
  const tipoInfo = NEWS_TIPOS[tipo];
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  // catInfo se usa abajo para mostrar el prefix esperado en los titulares
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const hasResults = headlines.length > 0;
  const selectedTone = TONE_OPTIONS.find((t) => t.value === tone);

  const handleCopy = async (idx: number, value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Chip de tipo seleccionado */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-grey-100 text-[11.5px] font-semibold text-grey-700">
          <span className="text-grey-500">Tipo:</span> {tipoInfo.label}
        </span>
        <span className="text-[11.5px] text-grey-500">
          ({tipoInfo.description})
        </span>
      </div>

      {/* Selector de categoría */}
      <CategorySelector
        tipo={tipo}
        selected={categoria}
        onChange={onCategoriaChange}
      />

      {/* Slot: CategoryDetector (chip "Sugerido por IA") */}
      {categoryDetectorSlot}

      {/* Input tema */}
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
          className="w-full bg-white border border-grey-200 rounded-lg p-4 text-[15px] text-ink placeholder:text-grey-500 focus:outline-none focus:border-wine transition-colors resize-none card-shadow"
          disabled={loading}
        />
        <p className="text-[11.5px] text-grey-500">
          Los 5 titulares generados arrancarán con: <code className="text-wine font-semibold">{catInfo.titlePrefix}</code>
        </p>
      </div>

      {/* Slot: KeywordPanel (Step 1.5 — keywords SEO expandible) */}
      {keywordPanelSlot}

      {/* Pills tono */}
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Tono</span>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((opt) => {
            const active = tone === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToneChange(opt.value)}
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 rounded-full text-[13px] font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? "bg-wine text-white border-wine"
                    : "bg-white text-grey-700 border-grey-200 hover:border-wine"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {selectedTone && (
          <p className="text-[12px] text-grey-500 mt-1">
            {selectedTone.description}
          </p>
        )}
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
            {loading ? Icon.refresh(16) : hasResults ? Icon.refresh(16) : Icon.spark(16)}
          </span>
          {loading
            ? "Generando 5 titulares..."
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

      {/* Lista de titulares */}
      {hasResults && (
        <div className="flex flex-col gap-3 mt-2">
          <span className="eyebrow">5 alternativas — editá y elegí una</span>
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
                      ? { color: "var(--color-status-success)", borderColor: "var(--color-status-success)" }
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
