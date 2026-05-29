/**
 * CategorySelector · Plan v4 — Dropdown de categorías dentro de un tipo.
 *
 * En Step 1, después de elegir tipo, el usuario ve un chip con la categoría
 * seleccionada y puede cambiarla. v4 base: manual select (sin AI auto-detect).
 * Phase D próxima iteración sumará AI suggestion automática.
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import {
  NEWS_CATEGORIES_V4,
  categoriasByTipo,
  gradientToCss,
  type NewsCategoria,
  type NewsTipo,
} from "@/lib/news/categories";

interface Props {
  tipo: NewsTipo;
  selected: NewsCategoria;
  onChange: (categoria: NewsCategoria) => void;
}

export function CategorySelector({ tipo, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const cats = categoriasByTipo(tipo);
  const selectedInfo = NEWS_CATEGORIES_V4[selected];

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">Categoría</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 bg-white border border-grey-200 rounded-lg px-4 py-3 hover:border-wine transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Color dot del gradient */}
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: gradientToCss(selectedInfo.gradient) }}
              aria-hidden
            />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-[14px] font-semibold text-ink leading-tight">
                {selectedInfo.label}
              </span>
              <span className="text-[11.5px] text-grey-500 leading-tight truncate max-w-full">
                Titulares arrancarán con: "{selectedInfo.titlePrefix}..."
              </span>
            </div>
          </div>
          <span
            className={`text-grey-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            {Icon.chevD(14)}
          </span>
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-grey-200 rounded-lg shadow-xl z-10 overflow-hidden">
            {cats.map((slug) => {
              const info = NEWS_CATEGORIES_V4[slug];
              const isSelected = slug === selected;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    onChange(slug);
                    setOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-grey-100 transition-colors ${
                    isSelected ? "bg-grey-100" : "bg-white"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                    style={{ background: gradientToCss(info.gradient) }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">
                      {info.label}
                    </div>
                    <div className="text-[11.5px] text-grey-500 mt-0.5">
                      {info.description}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-wine flex-shrink-0 mt-1" aria-hidden>
                      {Icon.check(14)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
