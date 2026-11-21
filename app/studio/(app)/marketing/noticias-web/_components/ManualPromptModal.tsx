/**
 * ManualPromptModal · Plan v4 — Modal de failover + modo Manual.
 *
 * Casos de uso:
 *  1. Failover automático: una server action falla (API caída, sin API key,
 *     rate limit, formato inválido) → el caller abre este modal con el
 *     prompt ya construido para que el operador lo lleve a claude.ai.
 *  2. Modo Manual explícito: el operador eligió Manual en LLMModeToggle, así
 *     que cada "Generar" abre directo este modal sin pegarle a la API.
 *
 * El modal es genérico: NO conoce de qué paso viene (detect / suggest /
 * headlines / bullets / article). Solo muestra prompt + textarea + cierra.
 * El parsing y persistencia los hace el caller en `onSubmit(text)`.
 *
 * SSR-safe: renderiza inline (no portal). Inherita el `data-theme="light"`
 * wrapper de page.tsx. Click en backdrop o Escape cierran.
 */

"use client";

import React, { useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { copyToClipboard } from "./copy";

interface Props {
  /** Título del modal (ej "Generar 5 titulares manualmente") */
  title: string;
  /** Subtítulo opcional (1 línea de contexto) */
  subtitle?: string;
  /** El prompt completo ya armado (single source = lib/news/prompts.ts) */
  prompt: string;
  /** Placeholder de la textarea (ej "Pega el JSON de Claude...") */
  placeholder?: string;
  /** Hint visible sobre la textarea (ej "Esperamos {headlines:[...]}") */
  inputHint?: string;
  /** Texto del botón submit. Default "Cargar respuesta" */
  submitLabel?: string;
  /** Error de parsing del último submit — se muestra debajo de la textarea */
  error?: string | null;
  /** Loading mientras el caller procesa el submit */
  loading?: boolean;
  onClose: () => void;
  onSubmit: (rawResponse: string) => void;
}

export function ManualPromptModal({
  title,
  subtitle,
  prompt,
  placeholder,
  inputHint,
  submitLabel,
  error,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Foco inicial en textarea + focus-trap + Escape + restauración de foco.
  useDialogA11y(panelRef, {
    onClose,
    pending: !!loading,
    initialFocusRef: textareaRef,
  });

  const handleCopy = async () => {
    const ok = await copyToClipboard(prompt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSubmit = () => {
    const value = text.trim();
    if (!value || loading) return;
    onSubmit(value);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-theme="light"
    >
      {/* Backdrop · click cierra */}
      <button
        type="button"
        onClick={loading ? undefined : onClose}
        aria-label="Cerrar"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "var(--scrim, rgba(15,30,61,0.55))" }}
      />

      {/* Card */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-paper border border-grey-200 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-grey-200">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="eyebrow">Modo Manual</span>
            <h2 className="text-ink text-[19px] font-bold leading-tight mt-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12.5px] text-grey-500 mt-1 leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar modal"
            className="w-9 h-9 grid place-items-center rounded-md border border-grey-200 text-grey-500 hover:border-wine hover:text-wine transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {Icon.close(14)}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
          {/* Prompt block */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="eyebrow">Prompt para Claude</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-grey-200 text-[12px] font-semibold text-grey-700 hover:border-wine hover:text-wine transition-colors"
                  style={
                    copied
                      ? {
                          color: "var(--color-status-success)",
                          borderColor: "var(--color-status-success)",
                        }
                      : undefined
                  }
                >
                  <span className="inline-flex" aria-hidden>
                    {copied ? Icon.check(12) : Icon.copy(12)}
                  </span>
                  {copied ? "Copiado" : "Copiar prompt"}
                </button>
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-grey-200 text-[12px] font-semibold text-grey-700 hover:border-wine hover:text-wine transition-colors"
                >
                  Abrir claude.ai
                  <span className="inline-flex" aria-hidden>
                    {Icon.external(11)}
                  </span>
                </a>
              </div>
            </div>
            <pre className="bg-grey-100 border border-grey-200 rounded-lg p-4 text-[12.5px] text-ink leading-relaxed overflow-auto max-h-64 whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
          </div>

          {/* Textarea para respuesta */}
          <div className="flex flex-col gap-2">
            <label htmlFor="manual-response" className="eyebrow">
              Respuesta de Claude
            </label>
            {inputHint && (
              <p className="text-[12px] text-grey-500 leading-snug">
                {inputHint}
              </p>
            )}
            <textarea
              ref={textareaRef}
              id="manual-response"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              disabled={loading}
              placeholder={placeholder ?? "Pega acá la respuesta de Claude..."}
              className="w-full bg-white border border-grey-200 rounded-lg p-3 text-[13px] text-ink placeholder:text-grey-500 focus:outline-none focus:border-wine transition-colors resize-y font-mono leading-relaxed disabled:opacity-60"
            />
            {error && (
              <p className="text-[12.5px] text-[color:var(--color-status-danger)]">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-grey-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 rounded-md border border-grey-200 text-grey-700 hover:border-wine hover:text-wine text-[13px] font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 bg-wine text-white px-5 py-2 rounded-md font-semibold text-[13.5px] hover:bg-wine-deep transition-colors disabled:bg-grey-100 disabled:text-grey-300 disabled:cursor-not-allowed"
          >
            {loading && (
              <span className="inline-flex animate-spin" aria-hidden>
                {Icon.refresh(14)}
              </span>
            )}
            {loading ? "Cargando…" : submitLabel ?? "Cargar respuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
