"use client";

/**
 * BugFABButton · botón flotante para reportar bug (SDD-0036 Fase 2).
 *
 * Visible bottom-right en todo el Studio. Click abre BugReportModal.
 * Solo se monta si el user es uno de los roles internos (admin, commercial,
 * operations, accounting, warehouse, support). El check de rol lo hace el
 * server (no se monta en layout si no aplica) — este componente asume rol válido.
 *
 * Brand: 56px circle wine. Hover: lift sutil + shadow. Sin emojis.
 */

import { useState } from "react";
import { BugReportModal } from "./BugReportModal";

interface BugFABButtonProps {
  /** Build SHA del deploy actual · NEXT_PUBLIC_BUILD_SHA o VERCEL_GIT_COMMIT_SHA */
  buildSha?: string | null;
}

export function BugFABButton({ buildSha }: BugFABButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar un bug, mejora o sugerencia"
        title="Reportar un bug"
        style={{
          position: "fixed",
          bottom: "var(--s-6, 24px)",
          right: "var(--s-6, 24px)",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--wine)",
          color: "var(--ink-inv, #FBFAF7)",
          border: "none",
          cursor: "pointer",
          boxShadow:
            "0 4px 12px rgba(127, 15, 26, 0.25), 0 2px 4px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          transition: "transform var(--dur, 180ms) var(--ease, ease-out), box-shadow var(--dur, 180ms) var(--ease, ease-out)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow =
            "0 6px 16px rgba(127, 15, 26, 0.32), 0 3px 6px rgba(0,0,0,0.10)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow =
            "0 4px 12px rgba(127, 15, 26, 0.25), 0 2px 4px rgba(0,0,0,0.08)";
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = "2px solid var(--wine-soft, #C2747F)";
          e.currentTarget.style.outlineOffset = "2px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        <BugIcon size={26} />
      </button>

      {open && (
        <BugReportModal
          onClose={() => setOpen(false)}
          buildSha={buildSha ?? null}
        />
      )}
    </>
  );
}

/** Outline bug icon · 24×24 · matches Icon set stroke style (1.6) */
function BugIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Body */}
      <rect x="8" y="8" width="8" height="11" rx="4" />
      {/* Head antennae */}
      <path d="M9 5l1.5 3M15 5l-1.5 3" />
      {/* Legs */}
      <path d="M8 13H4M16 13h4M8 18l-3 2M16 18l3 2M8 8l-3-2M16 8l3-2" />
    </svg>
  );
}
