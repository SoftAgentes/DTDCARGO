"use client";

/**
 * DrawerShell + DrawerFooter — scaffolding compartido para drawers laterales.
 *
 * Extraído de TMS (SDD-0019) para que cualquier módulo lo use con el mismo
 * patrón: backdrop scrim, panel a la derecha, header con título + cerrar,
 * footer con form="..." HTML5 estándar (sin requestSubmit hacks).
 */

import { Icon } from "@/app/studio/_components/icons";
import { useT } from "@/lib/i18n";

export function DrawerShell({
  title,
  subtitle,
  onClose,
  pending,
  children,
  width = 620,
  closeLabel,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  pending: boolean;
  children: React.ReactNode;
  width?: number;
  /** aria-label del botón cerrar. Default: traducido `chrome.action.close`. */
  closeLabel?: string;
}) {
  const t = useT();
  return (
    <div
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 96vw)`,
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
          <div>
            <h2
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  font: "500 11.5px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "4px 0 0",
                }}
              >
                {subtitle}
              </p>
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
