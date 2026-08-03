"use client";

/**
 * Error boundary del Portal del cliente.
 *
 * Mismo motivo que el del Studio (ronda /GOLD 2026-07-14: el repo no tenía ningún
 * error.tsx → un throw en un Server Component = 500 crudo). Dos diferencias con
 * el del Studio, a propósito:
 *
 *  - **Copy de cara al cliente**: nada de jerga ni nombres de tablas. Qué pasó,
 *    que su información está a salvo, y una salida. Tampoco mostramos el digest:
 *    a un cliente no le sirve y ensucia; el error igual queda en los logs.
 *  - **Tokens del portal, no del Studio**: esta superficie usa la paleta de marca
 *    (`--color-wine` / `--color-ink` / `--color-paper`) y las fuentes que el
 *    wrapper `.portal-sys` remapea a Sora/Nunito. Los tokens del Studio
 *    (`--bg-surface`, `--s-4`, `.studio-btn`) NO existen acá.
 */

import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal/error-boundary]", error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "16px",
        maxWidth: "520px",
        margin: "48px auto",
        padding: "32px",
        background: "var(--color-paper)",
        border: "1px solid var(--color-grey-200)",
        borderRadius: "12px",
      }}
    >
      <h1
        style={{
          margin: 0,
          font: "700 20px/1.3 var(--font-archivo-black)",
          color: "var(--color-ink)",
        }}
      >
        Esta página no cargó
      </h1>

      <p
        style={{
          margin: 0,
          font: "400 14px/1.6 var(--font-archivo)",
          color: "var(--color-ink)",
          opacity: 0.75,
        }}
      >
        Tuvimos un problema al mostrar esta sección. Tu información está a salvo y
        no se perdió nada. Volvé a intentar en un momento; si sigue igual,
        escríbenos y lo resolvemos.
      </p>

      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            font: "600 13.5px/1 var(--font-archivo)",
            color: "var(--color-on-accent)",
            background: "var(--color-wine)",
            border: "none",
            borderRadius: "8px",
            padding: "11px 18px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        <a
          href="/portal"
          style={{
            font: "600 13.5px/1 var(--font-archivo)",
            color: "var(--color-ink)",
            background: "transparent",
            border: "1px solid var(--color-grey-200)",
            borderRadius: "8px",
            padding: "11px 18px",
            textDecoration: "none",
          }}
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
