/**
 * LLMModeToggle · Plan v4 — Switch Auto ↔ Manual del Generador.
 *
 * Auto:    el cliente llama a server actions que invocan Claude vía SDK.
 * Manual:  el cliente abre ManualPromptModal con el prompt pre-cargado para
 *          que el operador lo pegue en claude.ai y traiga la respuesta.
 *
 * Persistencia en localStorage('dtd:noticias:mode'). Default = "auto".
 *
 * El hook `useLLMMode()` es SSR-safe (hidrata después de mount).
 */

"use client";

import React, { useEffect, useState } from "react";

export type LLMMode = "auto" | "manual";

const STORAGE_KEY = "dtd:noticias:mode";

/** Hook que persiste el modo en localStorage. SSR-safe. */
export function useLLMMode(): [LLMMode, (m: LLMMode) => void] {
  const [mode, setModeState] = useState<LLMMode>("auto");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "manual") {
      setModeState(stored);
    }
  }, []);

  const setMode = (m: LLMMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  };

  return [mode, setMode];
}

const OPTIONS: Array<{ value: LLMMode; label: string; hint: string }> = [
  {
    value: "auto",
    label: "Auto",
    hint: "Genera con Claude vía API (rápido, 3-15s)",
  },
  {
    value: "manual",
    label: "Manual",
    hint: "Te muestra el prompt para pegarlo en claude.ai",
  },
];

interface Props {
  mode: LLMMode;
  onChange: (m: LLMMode) => void;
  disabled?: boolean;
}

export function LLMModeToggle({ mode, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1 items-end">
      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-grey-500">
        Modo
      </span>
      <div
        role="radiogroup"
        aria-label="Modo de generación"
        className="inline-flex items-center bg-grey-100 rounded-full p-1 border border-grey-200"
      >
        {OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              title={opt.hint}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "bg-white text-wine card-shadow"
                  : "text-grey-700 hover:text-wine"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
