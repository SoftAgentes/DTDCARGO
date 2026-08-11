"use client";

/**
 * Selector de socio (proveedor China) reusado por la cuenta corriente y los
 * cargos (SDD-0059 · Slice B2). Muestra código + nombre (+ nombre CN si lo hay).
 */

import type { SupplierOption } from "@/lib/studio/partner-finance/types";

export function SupplierPicker({
  suppliers,
  value,
  onChange,
  disabled,
  label = "Socio",
}: {
  suppliers: SupplierOption[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div style={{ minWidth: 280, maxWidth: 420 }}>
      <label className="studio-label" htmlFor="fc-supplier">
        {label}
      </label>
      <select
        id="fc-supplier"
        className="studio-input"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.name}
            {s.name_cn ? ` · ${s.name_cn}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
