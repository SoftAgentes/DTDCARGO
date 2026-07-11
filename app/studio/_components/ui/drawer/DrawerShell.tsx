"use client";

/**
 * DrawerShell + DrawerFooter — scaffolding compartido para drawers y modales.
 *
 * Extraído de TMS (SDD-0019) para que cualquier módulo lo use con el mismo
 * patrón: backdrop scrim, panel (lateral o centrado), header con título +
 * cerrar, footer con form="..." HTML5 estándar (sin requestSubmit hacks).
 *
 * A11y (Fase C · rediseño ERP): focus-trap (Tab cicla dentro), Escape para
 * cerrar, foco inicial al panel, restauración de foco al desmontar,
 * `overscroll-behavior:contain`. Cualquier modal `role="dialog"` del Studio
 * debe usar este shell en vez de hand-rollear scrim + stopPropagation.
 */

import { useId, useRef } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { useT } from "@/lib/i18n";
import { useDialogA11y } from "./useDialogA11y";

export function DrawerShell({
  title,
  subtitle,
  onClose,
  pending,
  children,
  width = 620,
  closeLabel,
  variant = "drawer",
  titleAccessory,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  pending: boolean;
  children: React.ReactNode;
  width?: number;
  /** aria-label del botón cerrar. Default: traducido `chrome.action.close`. */
  closeLabel?: string;
  /** `drawer` = panel lateral derecho (default). `centered` = modal centrado. */
  variant?: "drawer" | "centered";
  /** Nodo inline a la derecha del título (ej. un badge de estado). */
  titleAccessory?: React.ReactNode;
}) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useDialogA11y(panelRef, { onClose, pending });

  const centered = variant === "centered";

  return (
    <div
      onClick={() => !pending && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: centered ? "center" : "flex-end",
        alignItems: centered ? "center" : "stretch",
        padding: centered ? "var(--s-4)" : 0,
        overscrollBehavior: "contain",
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 96vw)`,
          height: centered ? "auto" : "100vh",
          maxHeight: centered ? "90vh" : undefined,
          background: "var(--bg-surface)",
          border: centered ? "1px solid var(--border)" : undefined,
          borderLeft: centered ? undefined : "1px solid var(--border)",
          borderRadius: centered ? "var(--r-lg)" : undefined,
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2
                id={titleId}
                className="studio-display"
                style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
              >
                {title}
              </h2>
              {titleAccessory}
            </div>
            {subtitle && (
              <div
                style={{
                  font: "500 11.5px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "4px 0 0",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={closeLabel ?? t("chrome.action.close")}
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            {Icon.close(14)}
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

export function DrawerFooter({
  formId,
  onClose,
  isPending,
  canSubmit,
  submitLabel,
  cancelLabel,
  pendingLabel,
}: {
  formId: string;
  onClose: () => void;
  isPending: boolean;
  canSubmit: boolean;
  submitLabel: string;
  /** Texto del botón cancelar. Default: traducido `chrome.action.cancel`. */
  cancelLabel?: string;
  /** Texto del submit mientras isPending. Default: traducido `chrome.drawer.submitting`. */
  pendingLabel?: string;
}) {
  const t = useT();
  return (
    <footer
      style={{
        padding: "14px 22px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        className="studio-btn studio-btn-ghost"
        onClick={onClose}
        disabled={isPending}
      >
        {cancelLabel ?? t("chrome.action.cancel")}
      </button>
      <button
        type="submit"
        form={formId}
        className="studio-btn studio-btn-primary"
        disabled={isPending || !canSubmit}
      >
        {isPending ? (pendingLabel ?? t("chrome.drawer.submitting")) : submitLabel}
      </button>
    </footer>
  );
}
