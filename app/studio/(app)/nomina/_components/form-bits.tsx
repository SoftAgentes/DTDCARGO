/**
 * Bits de formulario compartidos por los drawers de Nómina (SDD-0103).
 * Presentacional puro (sin estado) → reusable desde los client drawers.
 */

import { cloneElement, isValidElement, useId, type ReactNode } from "react";

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

const CONTROLES: unknown[] = ["input", "select", "textarea"];

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
  const baseId = useId();
  // Sólo un control nativo se asocia: un grupo (los radios de causa de terminación)
  // conserva su marcado. `aria-invalid` es lo que `useDialogA11y` usa para llevarle
  // el foco al primer campo con error.
  const control = isValidElement<ControlProps>(children) && CONTROLES.includes(children.type) ? children : null;
  const controlId = control?.props.id ?? baseId;
  const errorId = `${baseId}-error`;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="studio-label" htmlFor={control ? controlId : undefined}>
        {label}
        {required && <span style={{ color: "var(--wine-text)" }}> *</span>}
      </label>
      {control
        ? cloneElement(control, {
            id: controlId,
            ...(error && {
              "aria-invalid": true,
              "aria-describedby": [control.props["aria-describedby"], errorId].filter(Boolean).join(" "),
            }),
          })
        : children}
      {error && (
        <p id={errorId} style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "var(--s-1) 0 0" }}>
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
      tabIndex={-1}
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
