"use client";

/**
 * Selector de proveedor de "Nueva compra" — combobox único del Norte: escribes,
 * filtra por nombre; si no hay match exacto aparece "Crear «X»" DENTRO del
 * propio dropdown, sin toggles aparte de "existente"/"nuevo". Al elegir "Crear"
 * se abre la ficha mínima del proveedor nuevo, que se guarda con su propia
 * server action y queda seleccionado.
 *
 * Extraído de `NewPurchaseForm` (SDD-0172) para que el formulario largo y el
 * asistente de 3 pasos compartan exactamente el mismo selector — es la parte
 * con más estado de la pantalla y no admite dos copias divergentes.
 */

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import { FieldLabel } from "../../../_components/PortalFormField";
import type {
  SupplierView,
  SupplierActionState,
} from "@/lib/studio/prealertas/types";
import { createSupplierAction } from "../../proveedores/actions";

const supplierInitial: SupplierActionState = {};

export function SupplierPicker({
  suppliers,
  preselected,
  supplierId,
  onSelect,
}: {
  suppliers: SupplierView[];
  preselected: SupplierView | null;
  supplierId: string;
  onSelect: (id: string) => void;
}) {
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState(preselected?.name ?? "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [newSupplierState, newSupplierAction, newSupplierPending] =
    useActionState(createSupplierAction, supplierInitial);
  const newFormRef = useRef<HTMLFormElement>(null);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);

  // Sin match exacto por nombre → el dropdown ofrece "Crear «X»".
  const hasExactMatch = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return true;
    return suppliers.some((s) => s.name.toLowerCase() === q);
  }, [suppliers, supplierQuery]);

  // Si el alta inline del proveedor nuevo termina OK, lo dejamos elegido — la
  // página revalidó, pero el id nuevo lo conocemos por el state.
  useEffect(() => {
    if (newSupplierState.ok && newSupplierState.supplierId) {
      onSelect(newSupplierState.supplierId);
      setNewSupplierName(null);
    }
    // `onSelect` es estable en los dos callers (setState / setter propio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSupplierState.ok, newSupplierState.supplierId]);

  return (
    <>
      <FieldLabel>Proveedor</FieldLabel>
      <div className="relative mt-1.5">
        <input
          type="text"
          value={supplierQuery}
          onChange={(e) => {
            setSupplierQuery(e.target.value);
            onSelect("");
            setNewSupplierName(null);
            setSupplierOpen(true);
          }}
          onFocus={() => setSupplierOpen(true)}
          onBlur={() => setTimeout(() => setSupplierOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (filteredSuppliers.length === 1 && supplierQuery.trim()) {
              const s = filteredSuppliers[0];
              onSelect(s.id);
              setNewSupplierName(null);
              setSupplierQuery(s.name);
              setSupplierOpen(false);
            } else if (!hasExactMatch && supplierQuery.trim()) {
              setNewSupplierName(supplierQuery.trim());
              onSelect("");
              setSupplierOpen(false);
            }
          }}
          placeholder="Escribe para buscar tu proveedor…"
          aria-label="Buscar o crear proveedor"
          className="w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
        {supplierOpen &&
          (supplierQuery.trim() !== "" || filteredSuppliers.length > 0) && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-grey-200 bg-white card-shadow">
              {filteredSuppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(s.id);
                    setNewSupplierName(null);
                    setSupplierQuery(s.name);
                    setSupplierOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-[14px] text-ink border-b border-grey-100 last:border-b-0 hover:bg-grey-100"
                >
                  <span className="font-bold">#{s.supplierSeq}</span> {s.name}
                </button>
              ))}
              {supplierQuery.trim() !== "" && !hasExactMatch && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewSupplierName(supplierQuery.trim());
                    onSelect("");
                    setSupplierOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] font-bold text-wine"
                  style={{ background: "var(--color-paper)" }}
                >
                  + Crear &ldquo;{supplierQuery.trim()}&rdquo;
                </button>
              )}
              {filteredSuppliers.length === 0 && supplierQuery.trim() === "" && (
                <p className="px-3.5 py-2.5 text-[13px] text-grey-700">
                  Escribe el nombre de tu proveedor.
                </p>
              )}
            </div>
          )}
      </div>

      {newSupplierName === null && supplierId && (
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--color-status-success)" }}
        >
          <CheckIcon size={13} /> Proveedor listo para esta compra.
        </p>
      )}

      {newSupplierName !== null && (
        <form
          ref={newFormRef}
          action={newSupplierAction}
          className="mt-3 rounded-[12px] p-4 border"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-wine)",
          }}
        >
          <input type="hidden" name="name" value={newSupplierName} />
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-wine">
            Datos del proveedor nuevo
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">
            + Se creará &ldquo;{newSupplierName}&rdquo;
          </p>
          {newSupplierState.fieldErrors?.name && (
            <p className="mt-1 text-[12px] text-wine">
              {newSupplierState.fieldErrors.name}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={newSupplierPending}
              className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {newSupplierPending ? "Guardando…" : "Guardar proveedor"}
              {!newSupplierPending && <CheckIcon size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewSupplierName(null);
                setSupplierOpen(true);
              }}
              disabled={newSupplierPending}
              className="btn btn-ghost disabled:opacity-60"
            >
              Cambiar
            </button>
          </div>
        </form>
      )}
    </>
  );
}
