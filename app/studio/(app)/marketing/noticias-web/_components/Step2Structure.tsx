/**
 * Step2Structure · paso 2 del generador.
 *
 * Muestra el titular elegido arriba (serif Georgia text-xl) con border-b.
 * Lista 8-10 bullets con:
 *  - Checkbox custom 16px (vacío → bg-white border-grey-300; marcado →
 *    bg-wine con Icon.check blanco). Default: todos marcados.
 *  - Input editable del title (transparente, sans-serif).
 *  - Desc en text-[12.5px] grey-500.
 *  - Click en la card togglea selección; click dentro del input solo edita
 *    (stopPropagation).
 *  - Bullets deseleccionados → opacity 0.5, sin border wine.
 *
 * Botón inferior: "Generar artículo con X secciones" (X dinámico) con Icon.doc.
 */

"use client";

import React from "react";
import { Icon } from "@/app/studio/_components/icons";

const SERIF: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

export interface BulletState {
  id: string;
  title: string;
  desc: string;
  selected: boolean;
}

interface Props {
  selectedHeadline: string;
  bullets: BulletState[];
  onBulletsChange: (next: BulletState[]) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
}

export function Step2Structure({
  selectedHeadline,
  bullets,
  onBulletsChange,
  onGenerate,
  loading,
  error,
}: Props) {
  const selectedCount = bullets.filter((b) => b.selected).length;

  const toggle = (id: string) => {
    onBulletsChange(
      bullets.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b)),
    );
  };

  const editTitle = (id: string, value: string) => {
    onBulletsChange(
      bullets.map((b) => (b.id === id ? { ...b, title: value } : b)),
    );
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

      {/* Lista de bullets */}
      <div className="flex flex-col gap-2">
        <span className="eyebrow">
          Estructura — destildá las secciones que no querés
        </span>
        {bullets.map((b) => {
          const isOff = !b.selected;
          return (
            <div
              key={b.id}
              onClick={() => toggle(b.id)}
              className={`card-shadow cursor-pointer bg-white border rounded-lg p-4 flex items-start gap-3 transition-all ${
                isOff
                  ? "border-grey-200 opacity-50"
                  : "border-grey-200 hover:border-wine"
              }`}
            >
              {/* Checkbox custom */}
              <div
                className={`flex-shrink-0 w-4 h-4 rounded-[3px] border-2 mt-1 grid place-items-center transition-colors ${
                  b.selected ? "bg-wine border-wine" : "bg-white border-grey-300"
                }`}
                aria-hidden
              >
                {b.selected && (
                  <span className="text-white inline-flex">
                    {Icon.check(10)}
                  </span>
                )}
              </div>

              {/* Title editable + desc */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={b.title}
                  onChange={(e) => editTitle(b.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent text-ink font-semibold text-[15px] leading-snug border-none focus:outline-none"
                />
                <p className="text-[12.5px] leading-snug text-grey-500 mt-1">
                  {b.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón generar artículo */}
      <div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || selectedCount === 0}
          className="inline-flex items-center gap-2 bg-wine text-white px-5 py-3 rounded-lg font-semibold text-[14.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
        >
          <span
            className={loading ? "inline-flex animate-spin" : "inline-flex"}
            aria-hidden
          >
            {loading ? Icon.refresh(16) : Icon.doc(16)}
          </span>
          {loading
            ? "Redactando artículo completo..."
            : `Generar artículo con ${selectedCount} ${
                selectedCount === 1 ? "sección" : "secciones"
              }`}
        </button>
        {error && (
          <p className="mt-3 text-[13px] text-[color:var(--color-status-danger)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
