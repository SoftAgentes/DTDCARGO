"use client";

import {
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";

/**
 * Field con label ASOCIADO al control (a11y, SDD-0093). Reemplaza el Field
 * compartido de naviera (que renderiza `<label>` sin `htmlFor` → el lector de
 * pantalla no nombra el campo y el clic en el label no enfoca el input).
 *
 * Misma API (`label`, `optional`, `children`) para swap directo. Inyecta un `id`
 * al control hijo (si no trae uno) y enlaza el `<label htmlFor>` — sin anidar
 * `<label>` y sin tocar los drawers ni el helper compartido de naviera (la deuda
 * Studio-wide se limpia aparte, cross-lane).
 */
export function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const autoId = useId();
  let control = children;
  let htmlFor: string | undefined;
  if (isValidElement(children)) {
    const el = children as ReactElement<{ id?: string }>;
    const id = el.props.id ?? autoId;
    htmlFor = id;
    if (!el.props.id) control = cloneElement(el, { id });
  }
  return (
    <div>
      <label className="studio-label" htmlFor={htmlFor}>
        {label}
        {optional && <span style={{ color: "var(--ink-soft)" }}> (opcional)</span>}
      </label>
      {control}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        margin: 0,
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
      }}
    >
      {message}
    </p>
  );
}
