/**
 * Step0Tipo · Plan v4 — Selector inicial del tipo editorial.
 *
 * 4 cards visuales (Informativo / Curiosidad / Polémica / Especial).
 * Cada card muestra:
 *  - Label + descripción
 *  - Escritor responsable (Miguel / Adriana↔Claudia / Ernesto / DTD Cargo)
 *  - Categorías disponibles (preview)
 *  - Gradient stripe sutil del primer categoría del tipo
 *
 * Click selecciona el tipo → avanza a Step 1.
 */

"use client";

import React from "react";
import { Icon } from "@/app/studio/_components/icons";
import {
  ALL_TIPO_SLUGS,
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
  categoriasByTipo,
  gradientToCss,
  type NewsTipo,
} from "@/lib/news/categories";

const WRITERS_BY_TIPO: Record<NewsTipo, string> = {
  informativo: "Miguel Arriaga",
  curiosidad: "Adriana ↔ Claudia (rotación)",
  polemica: "Ernesto Piñérez",
  especial: "DTD Cargo (sin escritor externo)",
};

interface Props {
  onSelect: (tipo: NewsTipo) => void;
}

export function Step0Tipo({ onSelect }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow">¿Qué tipo de contenido vas a crear?</span>
        <h2
          className="mt-3 text-ink"
          style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}
        >
          Elegí el <span className="text-wine">tipo editorial</span> primero.
        </h2>
        <p className="mt-2 text-[13.5px] text-grey-500 max-w-[58ch]">
          El tipo define el tono general, el escritor externo asignado y el
          set de categorías disponibles. Lo podés cambiar en cualquier momento
          volviendo atrás.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALL_TIPO_SLUGS.map((tipo) => {
          const info = NEWS_TIPOS[tipo];
          const cats = categoriasByTipo(tipo);
          const firstCat = cats[0];
          const firstGrad = firstCat ? NEWS_CATEGORIES_V4[firstCat].gradient : { from: "#0F1E3D", to: "#7F0F1A" };
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => onSelect(tipo)}
              className="group card-shadow bg-white border border-grey-200 rounded-[14px] overflow-hidden text-left hover:border-wine transition-all hover:-translate-y-0.5"
            >
              {/* Stripe gradient sutil arriba */}
              <div
                className="h-[8px] w-full"
                style={{ background: gradientToCss(firstGrad) }}
                aria-hidden
              />
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-ink font-bold text-[16px] leading-tight">
                    {info.label}
                  </h3>
                  <span
                    className="inline-flex text-grey-300 group-hover:text-wine transition-colors"
                    aria-hidden
                  >
                    {Icon.chevR(16)}
                  </span>
                </div>
                <p className="text-[12.5px] text-grey-700 leading-snug">
                  {info.description}
                </p>
                <div className="border-t border-grey-200 pt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-grey-500 uppercase tracking-wider font-semibold">Escritor</span>
                    <span className="text-grey-700">{WRITERS_BY_TIPO[tipo]}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-grey-500 uppercase tracking-wider font-semibold">Categorías</span>
                    <span className="text-grey-700">{cats.length}</span>
                  </div>
                </div>
                {/* Categorías preview */}
                <div className="flex flex-wrap gap-1">
                  {cats.map((slug) => (
                    <span
                      key={slug}
                      className="inline-flex px-2 py-0.5 rounded-full bg-grey-100 text-[10.5px] font-semibold text-grey-700"
                    >
                      {NEWS_CATEGORIES_V4[slug].label}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
