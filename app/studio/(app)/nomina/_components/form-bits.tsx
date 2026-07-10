/**
 * Bits de formulario compartidos por los drawers de Nómina (SDD-0103).
 * Presentacional puro (sin hooks) → reusable desde los client drawers.
 */

import type { ReactNode } from "react";

export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="studio-label">
        {label}
        {required && <span style={{ color: "var(--wine)" }}> *</span>}
      </label>
      {children}
      {error && (
        <p style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "var(--s-1) 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap" }}>{children}</div>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}
