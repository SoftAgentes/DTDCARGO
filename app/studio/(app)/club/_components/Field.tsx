"use client";

import {
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

/**
 * Field con label ASOCIADO al control (a11y). Espejo del helper de la Academia
 * (SDD-0093): inyecta un `id` al control hijo y enlaza `<label htmlFor>`. Deuda
 * Studio-wide conocida (estos helpers están duplicados por módulo); se unifica
 * aparte, cross-lane.
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
    <Aviso tono="error" compacto>
      {message}
    </Aviso>
  );
}
