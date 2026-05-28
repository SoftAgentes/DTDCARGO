/**
 * CategoryDetector · Plan v4 — Chip "Sugerido por IA" con override.
 *
 * Cuando el operador tipea un tema y está en modo Auto, después de 900ms
 * idle dispara `detectCategory` action y, si la sugerencia es distinta de
 * la categoría ya seleccionada, muestra un chip con:
 *  - Label de la categoría sugerida + color dot del gradient.
 *  - Confianza % + reason (1 oración explicando por qué).
 *  - 2 botones: "Aceptar sugerencia" / "Mantener mi elección".
 *
 * En modo Manual NO se dispara — el operador elige solo via CategorySelector.
 *
 * Una vez el operador decide (aceptar o mantener), se oculta el chip hasta
 * que cambie el topic. Cambiar el tipo resetea todo el estado.
 *
 * Falla del API: error discreto inline (no bloqueante). El operador puede
 * seleccionar manualmente vía CategorySelector — el detector es ayuda, no
 * bloqueo.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import {
  NEWS_CATEGORIES_V4,
  gradientToCss,
  type NewsCategoria,
  type NewsTipo,
} from "@/lib/news/categories";
import { detectCategory } from "../actions";
import type { LLMMode } from "./LLMModeToggle";

interface Props {
  topic: string;
  tipo: NewsTipo;
  selectedCategoria: NewsCategoria;
  mode: LLMMode;
  onAccept: (categoria: NewsCategoria, reason: string) => void;
}

interface Suggestion {
  categoria: NewsCategoria;
  reason: string;
  confidence: number;
}

const DEBOUNCE_MS = 900;
const MIN_TOPIC_LENGTH = 20;

export function CategoryDetector({
  topic,
  tipo,
  selectedCategoria,
  mode,
  onAccept,
}: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastAnalyzedRef = useRef("");
  const timerRef = useRef<number | null>(null);

  // Reset cuando cambia tipo
  useEffect(() => {
    setSuggestion(null);
    setError(null);
    setDismissed(false);
    lastAnalyzedRef.current = "";
  }, [tipo]);

  // Detección con debounce
  useEffect(() => {
    if (mode !== "auto") return;

    const trimmed = topic.trim();
    if (trimmed.length < MIN_TOPIC_LENGTH) {
      setSuggestion(null);
      setError(null);
      return;
    }
    if (trimmed === lastAnalyzedRef.current) return;

    setDismissed(false);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      lastAnalyzedRef.current = trimmed;
      setLoading(true);
      setError(null);
      detectCategory(trimmed, tipo)
        .then((res) => {
          setLoading(false);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          if (res.categoria === selectedCategoria) {
            setSuggestion(null);
            return;
          }
          setSuggestion({
            categoria: res.categoria,
            reason: res.reason,
            confidence: res.confidence,
          });
        })
        .catch((e) => {
          setLoading(false);
          setError(e instanceof Error ? e.message : "Error desconocido");
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [topic, tipo, mode, selectedCategoria]);

  if (mode === "manual") return null;

  if (loading) {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-[12px] text-grey-500"
      >
        <span className="inline-flex animate-spin" aria-hidden>
          {Icon.refresh(12)}
        </span>
        Detectando categoría sugerida…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[11.5px] text-grey-500">
        No se pudo sugerir categoría ({error}). Seleccioná manualmente arriba.
      </div>
    );
  }

  if (!suggestion || dismissed) return null;

  const info = NEWS_CATEGORIES_V4[suggestion.categoria];

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 bg-grey-100 border border-grey-200 rounded-lg p-3"
    >
      <div className="flex items-start gap-3">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
          style={{ background: gradientToCss(info.gradient) }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-wine">
              Sugerido por IA
            </span>
            <span className="text-[11px] text-grey-500">
              {suggestion.confidence}% confianza
            </span>
          </div>
          <p className="text-[13.5px] font-semibold text-ink mt-0.5">
            {info.label}
          </p>
          {suggestion.reason && (
            <p className="text-[12px] text-grey-700 mt-1 leading-snug">
              {suggestion.reason}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            onAccept(suggestion.categoria, suggestion.reason);
            setDismissed(true);
          }}
          className="inline-flex items-center gap-1.5 bg-wine text-white px-3 py-1.5 rounded-md text-[12px] font-semibold hover:bg-wine-deep transition-colors"
        >
          <span className="inline-flex" aria-hidden>
            {Icon.check(12)}
          </span>
          Aceptar sugerencia
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center px-3 py-1.5 rounded-md border border-grey-200 text-grey-700 hover:border-wine hover:text-wine text-[12px] font-semibold transition-colors"
        >
          Mantener mi elección
        </button>
      </div>
    </div>
  );
}
