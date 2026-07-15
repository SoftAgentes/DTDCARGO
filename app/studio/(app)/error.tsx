"use client";

/**
 * Error boundary de los módulos del Studio.
 *
 * El porqué (ronda /GOLD 2026-07-14): hasta hoy el repo NO tenía ni un error.tsx.
 * Cualquier `throw` en un Server Component salía sin atrapar y Next servía un 500
 * crudo — la ruta entera en blanco, sin marca, sin salida y sin decirle al staff
 * qué hacer. Pasó de verdad: con las migr 0234/0237 sin aplicar, /studio/marketing
 * y /studio/fidelizacion quedaron caídas.
 *
 * Esto NO esconde el error (el throw sigue llegando a los logs del server): lo
 * convierte en una pantalla honesta con salida. Preferimos "no pudimos cargar
 * esto" antes que una lista vacía que miente diciendo "no hay nada".
 *
 * Sin i18n a propósito: si el módulo reventó, el provider de traducción puede ser
 * justamente lo que falta. El boundary tiene que sostenerse solo.
 */

import { useEffect } from "react";

export default function StudioModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[studio/error-boundary]", error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "var(--s-4)",
        maxWidth: "560px",
        margin: "var(--s-12) auto",
        padding: "var(--s-8)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <h1
        style={{
          margin: 0,
          font: `700 18px/1.3 var(--f-display)`,
          color: "var(--ink)",
        }}
      >
        No pudimos cargar este módulo
      </h1>

      <p
        style={{
          margin: 0,
          font: `400 13.5px/1.55 var(--f-sans)`,
          color: "var(--ink-soft)",
        }}
      >
        El módulo falló al leer sus datos. El resto del Studio sigue funcionando —
        podés volver a intentar o irte al dashboard. Si se repite, avisá al equipo
        técnico con el código de abajo.
      </p>

      {error.digest ? (
        <code
          style={{
            font: `500 11.5px/1.4 var(--f-mono)`,
            color: "var(--ink-mute)",
            padding: "var(--s-2) var(--s-3)",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error.digest}
        </code>
      ) : null}

      <div style={{ display: "flex", gap: "var(--s-3)", marginTop: "var(--s-2)" }}>
        <button type="button" className="studio-btn studio-btn-primary" onClick={reset}>
          Reintentar
        </button>
        <a href="/studio/dashboard" className="studio-btn studio-btn-ghost">
          Ir al dashboard
        </a>
      </div>
    </div>
  );
}
