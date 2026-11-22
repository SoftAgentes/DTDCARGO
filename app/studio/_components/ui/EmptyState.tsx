/**
 * EmptyState primitive · DTD Studio
 *
 * Usado en placeholder pages de módulos no implementados, listados vacíos,
 * y resultados de filtros sin matches. Mantiene branding del sistema.
 *
 * Portado parcialmente desde components.jsx — versión mínima para SDD-0007.
 */

import type { ReactNode } from "react";

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ eyebrow, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-10) var(--s-8)",
        textAlign: "center",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      {eyebrow && (
        <div style={{ marginBottom: "var(--s-3)" }}>
          {/* Patrón de eyebrow del Studio: guión de identidad y texto neutro (SDD-0686). */}
          <span className="studio-eyebrow">{eyebrow}</span>
        </div>
      )}
      <div
        style={{
          font: "900 22px/1.15 var(--f-display)",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
          marginBottom: "var(--s-3)",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            font: "500 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            maxWidth: "56ch",
            margin: "0 auto var(--s-6)",
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: "var(--s-4)" }}>{action}</div>}
    </div>
  );
}
