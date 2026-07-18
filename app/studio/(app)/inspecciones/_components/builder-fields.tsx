"use client";

/**
 * Campos compartidos de los builders de inspección (SDD-0066 · Fase 2/3).
 * Inputs sencillos del Studio (clase `studio-input` + `studio-label`), sin estado
 * propio (defaultValue) — el form se serializa al submit (FormData).
 */

import type { ReactNode } from "react";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  mono = false,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: "text" | "number" | "date";
  placeholder?: string;
  mono?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div>
      <label className="studio-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={`studio-input${mono ? " studio-input-mono" : ""}`}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoComplete="off"
      />
    </div>
  );
}

/** Select tri-estado Sí / No / (sin determinar). value "true"/"false"/"". */
export function TriSelect({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: boolean | null | undefined;
}) {
  const dv = value === true ? "true" : value === false ? "false" : "";
  return (
    <div>
      <label className="studio-label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} className="studio-input" defaultValue={dv}>
        <option value="">Sin determinar</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

export function Grid({
  cols,
  children,
}: {
  cols: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      className="studio-display"
      style={{
        font: "700 14px/1.2 var(--f-display)",
        color: "var(--ink)",
        margin: "var(--s-2) 0 var(--s-1)",
        paddingBottom: 6,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </h3>
  );
}
