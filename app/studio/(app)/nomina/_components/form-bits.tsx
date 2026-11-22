/**
 * Bits de formulario compartidos por los drawers de Nómina (SDD-0103).
 * Presentacional puro (sin estado) → reusable desde los client drawers.
 */

import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { DateField } from "@/app/studio/_components/ui/DateField";

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

// SDD-0660: <DateField> acepta id, aria-invalid y aria-describedby como un control nativo.
const CONTROLES: unknown[] = ["input", "select", "textarea", DateField];

export function Field({
  label,
  error,
  required,
  ayuda,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  /** Texto visible junto al campo (p. ej. «Sin configurar · propuesta: 9»); queda enlazado con `aria-describedby`. */
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  const baseId = useId();
  // Sólo un control nativo se asocia: un grupo (los radios de causa de terminación)
  // conserva su marcado. `aria-invalid` es lo que `useDialogA11y` usa para llevarle
  // el foco al primer campo con error.
  const control = isValidElement<ControlProps>(children) && CONTROLES.includes(children.type) ? children : null;
  const controlId = control?.props.id ?? baseId;
  const errorId = `${baseId}-error`;
  const ayudaId = `${baseId}-ayuda`;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="studio-label" htmlFor={control ? controlId : undefined}>
        {label}
        {required && <span style={{ color: "var(--ink-soft)" }}> *</span>}
      </label>
      {control
        ? cloneElement(control, {
            id: controlId,
            ...(error && { "aria-invalid": true }),
            ...((error || ayuda) && {
              "aria-describedby": [control.props["aria-describedby"], ayuda ? ayudaId : null, error ? errorId : null]
                .filter(Boolean)
                .join(" "),
            }),
          })
        : children}
      {ayuda && (
        <p id={ayudaId} style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", margin: "var(--s-1) 0 0" }}>
          {ayuda}
        </p>
      )}
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

/**
 * Error del formulario entero. SDD-0603 (menores del Studio): es el aviso
 * canónico, sin contorno. `tabIndex={-1}` lo deja enfocable sin entrar en el
 * orden de Tab: `useDialogA11y` le lleva el foco al terminar el envío (ERR-01).
 */
export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <Aviso tono="error" compacto tabIndex={-1}>
      {children}
    </Aviso>
  );
}
