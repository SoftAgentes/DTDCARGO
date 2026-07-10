/**
 * Step2Outlines · Plan v5 — 3 outlines alternativos (reemplaza Step2Structure).
 *
 * Cambio de modelo mental vs Plan v4 (bullets para destildar):
 *  - Antes: 1 lista de 8-10 bullets con checkbox para destildar las no
 *           queridas. Trabajo de checkbox sin ver la pieza como un todo.
 *  - Ahora: 3 arquitecturas narrativas distintas (pragmática / contextual /
 *           analítica). El editor compara arquitecturas completas y elige
 *           una. Refleja cómo decide un editor jefe.
 *
 * Cada outline propone:
 *  - thesis (nut graf — 1 oración que resume el ángulo central)
 *  - 5-7 secciones (title + desc)
 *  - closing_type (cómo cierra la pieza)
 *
 * Layout: grid 3-col en desktop, 1-col en mobile. Las 3 cards son radio
 * cards (mutually exclusive). Click en una la marca como seleccionada.
 * Edición inline del outline seleccionado (thesis + titles editables).
 */

"use client";

import React, { type CSSProperties } from "react";
import { Icon } from "@/app/studio/_components/icons";
import type { OutlineItem, OutlineClosingType } from "../actions";

const SERIF: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const CLOSING_LABELS: Record<OutlineClosingType, string> = {
  "conclusion-analitica": "Conclusión analítica",
  "llamada-a-la-accion": "Llamada a la acción",
  "pregunta-abierta": "Pregunta abierta",
};

const ENFOQUE_LABELS = [
  { label: "Pragmático", desc: "Cómo funciona / qué hacer" },
  { label: "Contextual", desc: "Por qué importa / historia detrás" },
  { label: "Analítico", desc: "Desafío al supuesto / posición editorial" },
];

interface Props {
  selectedHeadline: string;
  outlines: OutlineItem[];
  selectedOutlineIdx: number; // -1 si ninguno
  onSelectOutline: (idx: number) => void;
  onUpdateOutline: (idx: number, next: OutlineItem) => void;
  onGenerateArticle: () => void;
  loading: boolean;
  error: string | null;
}

export function Step2Outlines({
  selectedHeadline,
  outlines,
  selectedOutlineIdx,
  onSelectOutline,
  onUpdateOutline,
  onGenerateArticle,
  loading,
  error,
}: Props) {
  const hasSelection = selectedOutlineIdx >= 0 && selectedOutlineIdx < outlines.length;

  const updateThesis = (idx: number, thesis: string) => {
    const next = { ...outlines[idx], thesis };
    onUpdateOutline(idx, next);
  };
  const updateSection = (
    idx: number,
    secIdx: number,
    field: "title" | "desc",
    value: string,
  ) => {
    const out = outlines[idx];
    const sections = out.sections.map((s, i) =>
      i === secIdx ? { ...s, [field]: value } : s,
    );
    onUpdateOutline(idx, { ...out, sections });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Titular elegido */}
      <div className="border-b border-grey-200 pb-5">
        <span className="eyebrow">Titular elegido</span>
        <h2
          className="text-ink mt-2"
          style={{ ...SERIF, fontSize: 24, lineHeight: 1.2 }}
        >
          {selectedHeadline}
        </h2>
      </div>

      {/* Instrucción */}
      <div>
        <span className="eyebrow">
          Elige una arquitectura — 3 enfoques alternativos
        </span>
        <p className="text-[12.5px] text-grey-500 mt-1.5 max-w-[80ch]">
          Claude propuso 3 maneras distintas de estructurar el artículo. Cada
          una arranca de la misma idea pero la organiza con un ángulo distinto.
          Elige la que mejor calza con lo que quieres transmitir. Puedes editar
          la elegida inline.
        </p>
      </div>

      {/* Grid 3-col de outlines */}
      <div className="grid gap-4 lg:grid-cols-3">
        {outlines.map((outline, idx) => {
          const isSelected = idx === selectedOutlineIdx;
          const enfoque = ENFOQUE_LABELS[idx] ?? {
            label: `Opción ${idx + 1}`,
            desc: "",
          };
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectOutline(idx)}
              aria-pressed={isSelected}
              className="text-left transition-colors"
              style={{
                background: isSelected
                  ? "var(--wine-tint, rgba(127,15,26,0.06))"
                  : "var(--bg-surface, #FFFFFF)",
                border: `2px solid ${
                  isSelected
                    ? "var(--wine, #7F0F1A)"
                    : "var(--border, rgba(15,30,61,0.12))"
                }`,
                borderRadius: "var(--r-lg, 12px)",
                padding: "var(--s-4)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                cursor: "pointer",
                boxShadow: isSelected
                  ? "var(--shadow-md)"
                  : "var(--shadow-xs)",
                minHeight: 320,
                outline: "none",
              }}
            >
              {/* Header: radio + enfoque + closing */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${
                        isSelected
                          ? "var(--wine, #7F0F1A)"
                          : "var(--border, rgba(15,30,61,0.30))"
                      }`,
                      background: isSelected
                        ? "var(--wine, #7F0F1A)"
                        : "transparent",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#FFFFFF",
                        }}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: isSelected
                          ? "var(--wine, #7F0F1A)"
                          : "var(--ink-soft, #4B5563)",
                      }}
                    >
                      Enfoque {enfoque.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-soft, #6B6B6B)",
                        marginTop: 1,
                        lineHeight: 1.3,
                      }}
                    >
                      {enfoque.desc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thesis · editable si seleccionado */}
              <div className="flex flex-col gap-1.5">
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--ink-soft, #6B6B6B)",
                  }}
                >
                  Tesis (nut graf)
                </span>
                {isSelected ? (
                  <textarea
                    value={outline.thesis}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateThesis(idx, e.target.value)}
                    rows={3}
                    maxLength={250}
                    className="w-full bg-white border border-grey-200 rounded p-2 text-[13px] text-ink leading-snug focus:outline-none focus:border-wine resize-y"
                    style={SERIF}
                  />
                ) : (
                  <p
                    className="text-[13px] text-ink leading-snug"
                    style={SERIF}
                  >
                    {outline.thesis || (
                      <em className="text-grey-500">Sin tesis</em>
                    )}
                  </p>
                )}
              </div>

              {/* Sections list */}
              <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--ink-soft, #6B6B6B)",
                  }}
                >
                  {outline.sections.length} secciones
                </span>
                <ol
                  className="flex flex-col gap-1.5 list-none m-0 p-0"
                  style={{ counterReset: "section" }}
                >
                  {outline.sections.map((sec, secIdx) => (
                    <li
                      key={secIdx}
                      className="flex items-start gap-2 text-[12.5px]"
                    >
                      <span
                        style={{
                          color: "var(--wine, #7F0F1A)",
                          fontWeight: 700,
                          flexShrink: 0,
                          minWidth: 18,
                        }}
                      >
                        {secIdx + 1}.
                      </span>
                      {isSelected ? (
                        <input
                          type="text"
                          value={sec.title}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            updateSection(idx, secIdx, "title", e.target.value)
                          }
                          className="flex-1 bg-transparent text-ink font-semibold border-none focus:outline-none focus:border-b focus:border-wine"
                          style={{ minWidth: 0 }}
                        />
                      ) : (
                        <span className="text-ink font-semibold leading-snug">
                          {sec.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Footer: closing type */}
              <div
                className="flex items-center gap-1.5 pt-2 mt-auto"
                style={{
                  borderTop: "1px solid var(--border, rgba(15,30,61,0.10))",
                }}
              >
                <span style={{ color: "var(--ink-soft, #6B6B6B)" }} aria-hidden>
                  {Icon.check(11)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-soft, #6B6B6B)",
                    fontWeight: 500,
                  }}
                >
                  Cierre: {CLOSING_LABELS[outline.closing_type]}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: CTA */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onGenerateArticle}
          disabled={loading || !hasSelection}
          className="inline-flex items-center gap-2 bg-wine text-white px-5 py-3 rounded-lg font-semibold text-[14.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed self-start"
        >
          <span
            className={loading ? "inline-flex animate-spin" : "inline-flex"}
            aria-hidden
          >
            {loading ? Icon.refresh(16) : Icon.doc(16)}
          </span>
          {loading
            ? "Redactando artículo completo…"
            : hasSelection
              ? `Redactar artículo con ${outlines[selectedOutlineIdx].sections.length} secciones`
              : "Elige una arquitectura primero"}
        </button>
        {error && (
          <p className="text-[13px] text-[color:var(--color-status-danger)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
