/**
 * LLMModeToggle · Plan v5 — Switch Auto ↔ Manual del Generador.
 *
 * Auto:    el cliente llama a server actions que invocan Claude vía SDK.
 * Manual:  el cliente abre ManualPromptModal con el prompt pre-cargado
 *          para que el operador lo pegue en claude.ai y traiga la
 *          respuesta.
 *
 * Persistencia en localStorage('dtd:noticias:mode'). Default = "auto".
 * El hook `useLLMMode()` es SSR-safe (hidrata después de mount).
 *
 * v5: UI migrada a primitiva <SegmentedControl> compartida del Studio.
 * La implementación ad-hoc de pills inline se eliminó.
 */

"use client";

import React, { useSyncExternalStore } from "react";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";

export type LLMMode = "auto" | "manual";

const STORAGE_KEY = "dtd:noticias:mode";
const STORAGE_EVENT = "dtd:noticias:mode-change";

function readMode(): LLMMode {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "manual" ? "manual" : "auto";
}

function subscribeMode(onChange: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => window.removeEventListener(STORAGE_EVENT, onChange);
}

/** Hook que persiste el modo en localStorage. SSR-safe. */
export function useLLMMode(): [LLMMode, (m: LLMMode) => void] {
  const mode = useSyncExternalStore<LLMMode>(subscribeMode, readMode, () => "auto");

  const setMode = (m: LLMMode) => {
    window.localStorage.setItem(STORAGE_KEY, m);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  return [mode, setMode];
}

interface Props {
  mode: LLMMode;
  onChange: (m: LLMMode) => void;
  disabled?: boolean;
}

/**
 * @deprecated Usa `SegmentedControl` directamente en consumidores nuevos.
 * El único consumidor existente migra mediante el plan CMP-01 v1.1.
 */
export function LLMModeToggle({ mode, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1 items-end">
      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-grey-500">
        Modo
      </span>
      <SegmentedControl<LLMMode>
        value={mode}
        onChange={onChange}
        disabled={disabled}
        variant="pills"
        size="sm"
        ariaLabel="Modo de generación"
        options={[
          { value: "auto", label: "Auto" },
          { value: "manual", label: "Manual" },
        ]}
      />
    </div>
  );
}
