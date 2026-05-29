/**
 * KeywordPanel · Plan v4 — Step 1.5 (sección expandible dentro de Step 1).
 *
 * Sin sumar un step extra al StepIndicator, ofrece un panel colapsable con:
 *  - Botón "Sugerir keywords con IA" → llama suggestKeywords via parent.
 *  - Focus keyword editable (text input).
 *  - Secondary keywords editables (chip input con Enter/coma para agregar).
 *  - Pain points sugeridos por IA (read-only · contexto para la generación).
 *
 * Por defecto está colapsado para no saturar Step 1. Cuando hay keywords
 * cargadas, el header muestra chips contadores ("1 focus · 3 sec") para
 * que el operador vea de un vistazo si ya configuró.
 *
 * Patrón Auto vs Manual: el panel emite `onRequestSuggest()` y NoticiasWebClient
 * decide si dispara la API (Auto) o abre ManualPromptModal (Manual o failover).
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";

interface Props {
  focusKeyword: string;
  secondaryKeywords: string[];
  painPoints: string[];
  onChangeFocus: (k: string) => void;
  onChangeSecondary: (ks: string[]) => void;
  onChangePain: (ps: string[]) => void;
  onRequestSuggest: () => void;
  suggesting: boolean;
  topicReady: boolean;
}

export function KeywordPanel({
  focusKeyword,
  secondaryKeywords,
  painPoints,
  onChangeFocus,
  onChangeSecondary,
  onChangePain,
  onRequestSuggest,
  suggesting,
  topicReady,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasFocus = focusKeyword.trim().length > 0;
  const hasContent = hasFocus || secondaryKeywords.length > 0;

  return (
    <div className="flex flex-col border border-grey-200 rounded-lg bg-white overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-grey-100 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-ink">
            Keywords SEO
          </span>
          {hasFocus && (
            <span className="inline-flex px-2 py-0.5 rounded-full bg-grey-100 text-wine text-[10.5px] font-semibold">
              1 focus
            </span>
          )}
          {secondaryKeywords.length > 0 && (
            <span className="inline-flex px-2 py-0.5 rounded-full bg-grey-100 text-wine text-[10.5px] font-semibold">
              {secondaryKeywords.length} secundarias
            </span>
          )}
          {!hasContent && (
            <span className="text-[11.5px] text-grey-500">
              opcional · mejora el SEO del artículo
            </span>
          )}
        </div>
        <span
          className={`text-grey-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          {Icon.chevD(14)}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-4 border-t border-grey-200">
          {/* Botón sugerir */}
          <div>
            <button
              type="button"
              onClick={onRequestSuggest}
              disabled={suggesting || !topicReady}
              className="inline-flex items-center gap-2 bg-wine text-white px-4 py-2 rounded-md text-[13px] font-semibold hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
            >
              <span
                className={
                  suggesting ? "inline-flex animate-spin" : "inline-flex"
                }
                aria-hidden
              >
                {suggesting ? Icon.refresh(14) : Icon.spark(14)}
              </span>
              {suggesting ? "Sugiriendo…" : "Sugerir keywords con IA"}
            </button>
            {!topicReady && (
              <p className="text-[11.5px] text-grey-500 mt-2">
                Tipea primero un tema base arriba.
              </p>
            )}
          </div>

          {/* Focus keyword */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="focus-keyword" className="eyebrow">
              Focus keyword
            </label>
            <input
              id="focus-keyword"
              type="text"
              value={focusKeyword}
              onChange={(e) => onChangeFocus(e.target.value)}
              placeholder='Ej "puerta a puerta china venezuela"'
              className="w-full bg-white border border-grey-200 rounded-md px-3 py-2 text-[14px] text-ink placeholder:text-grey-500 focus:outline-none focus:border-wine transition-colors"
            />
            <p className="text-[11.5px] text-grey-500 leading-snug">
              La keyword principal del post. Aparecerá en intro + 1 H2 + body
              (density 1-2%, sin stuffing).
            </p>
          </div>

          {/* Secondary keywords */}
          <div className="flex flex-col gap-1.5">
            <label className="eyebrow">Keywords secundarias</label>
            <KeywordChipInput
              values={secondaryKeywords}
              onChange={onChangeSecondary}
              placeholder="Agregar (Enter o coma)"
            />
            <p className="text-[11.5px] text-grey-500 leading-snug">
              Relacionadas con la focus. Se incorporan en titles de secciones y
              en el body de forma natural.
            </p>
          </div>

          {/* Pain points sugeridos */}
          {painPoints.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">Pain points que el post va a atacar</label>
              <ul className="flex flex-col gap-1">
                {painPoints.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] text-grey-700 leading-snug"
                  >
                    <span className="text-wine mt-0.5 flex-shrink-0" aria-hidden>
                      •
                    </span>
                    <span className="flex-1">{p}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangePain(painPoints.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Quitar pain point: ${p}`}
                      className="text-grey-300 hover:text-wine transition-colors flex-shrink-0"
                    >
                      {Icon.close(10)}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-grey-500 leading-snug">
                Sugerencias del bot · Claude va a orientar el contenido a
                resolverlos. Eliminá los que no apliquen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Chip input — helper local · agrega con Enter/coma, borra con Backspace.
// ──────────────────────────────────────────────────────────────

interface ChipProps {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

function KeywordChipInput({ values, onChange, placeholder }: ChipProps) {
  const [input, setInput] = useState("");

  const addChip = (raw: string) => {
    const clean = raw.trim();
    if (!clean || values.includes(clean)) {
      setInput("");
      return;
    }
    onChange([...values, clean]);
    setInput("");
  };

  const removeChip = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white border border-grey-200 rounded-md p-2 focus-within:border-wine transition-colors">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1.5 bg-grey-100 px-2 py-0.5 rounded-full text-[12px] font-semibold text-grey-700"
        >
          {v}
          <button
            type="button"
            onClick={() => removeChip(i)}
            aria-label={`Eliminar ${v}`}
            className="inline-flex w-4 h-4 items-center justify-center rounded-full text-grey-500 hover:text-wine"
          >
            {Icon.close(10)}
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addChip(input);
          } else if (e.key === "Backspace" && !input && values.length > 0) {
            removeChip(values.length - 1);
          }
        }}
        onBlur={() => {
          if (input.trim()) addChip(input);
        }}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] bg-transparent border-0 text-[13px] text-ink placeholder:text-grey-500 focus:outline-none"
      />
    </div>
  );
}
