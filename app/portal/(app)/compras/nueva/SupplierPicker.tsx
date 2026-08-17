"use client";

/**
 * Selector de proveedor de "Nueva compra" — combobox único del Norte: escribes,
 * filtra por nombre; si no hay match exacto aparece "Crear «X»" DENTRO del
 * propio dropdown, sin toggles aparte de "existente"/"nuevo". Al elegir "Crear"
 * se abre la ficha mínima del proveedor nuevo, que se guarda con su propia
 * server action y queda seleccionado.
 *
 * Extraído de `NewPurchaseForm` (SDD-0173) para que el formulario largo y el
 * asistente de 3 pasos compartan exactamente el mismo selector — es la parte
 * con más estado de la pantalla y no admite dos copias divergentes.
 */

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import { FieldLabel } from "../../../_components/PortalFormField";
import {
  SUPPLIER_SOURCE_ORIGINS,
  SUPPLIER_SOURCE_ORIGIN_LABEL,
  SUPPLIER_ORIGINS_NEEDING_NOTE,
  SUPPLIER_PURCHASE_HISTORIES,
  SUPPLIER_PURCHASE_HISTORY_LABEL,
  SUPPLIER_COMM_METHODS,
  SUPPLIER_COMM_METHOD_LABEL,
  type SupplierSourceOrigin,
  type SupplierPurchaseHistory,
  type SupplierCommMethod,
  type SupplierView,
  type SupplierActionState,
} from "@/lib/studio/prealertas/types";
import { createSupplierAction } from "../../proveedores/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const supplierInitial: SupplierActionState = {};

/** Píldora seleccionable — el "chip" del Norte, como radio accesible. */
function Chip({
  name,
  value,
  label,
  checked,
  onSelect,
  disabled,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border cursor-pointer text-[12.5px] font-bold transition-colors"
      style={{
        borderColor: checked ? "var(--color-wine)" : "var(--color-grey-200)",
        background: checked ? "var(--color-paper)" : "transparent",
        color: checked ? "var(--color-wine-text)" : "var(--color-grey-700)",
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      {/* El tilde no es decoración: sin él, "elegido" se distinguiría SÓLO por
          color, que es lo que prohíbe WCAG 1.4.1. */}
      {checked && <CheckIcon size={11} />}
      {label}
    </label>
  );
}

/**
 * Ficha extendida del proveedor nuevo (SDD-0173 · migr 0266).
 *
 * Las 3 preguntas del Norte. El copy las encuadra como lo que son: datos DEL
 * CLIENTE para su propio control, no un trámite para DTD. Todas opcionales —
 * en el Norte eran obligatorias, pero acá bloquear el alta por "¿de dónde lo
 * sacaste?" costaría compras; la respuesta se pide, no se exige.
 */
function SupplierProfileFields({ disabled }: { disabled?: boolean }) {
  const uid = useId();
  const [origin, setOrigin] = useState<SupplierSourceOrigin | "">("");
  const [history, setHistory] = useState<SupplierPurchaseHistory | "">("");
  const [comm, setComm] = useState<SupplierCommMethod | "">("");
  const needsNote =
    origin !== "" && SUPPLIER_ORIGINS_NEEDING_NOTE.includes(origin);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-[11.5px] text-grey-700 leading-[1.5] m-0">
        Lo de abajo es para <strong className="text-ink">tu control</strong>: te
        ayuda a reconocer a este proveedor cuando tengas varios. Todo opcional.
      </p>

      <div>
        <FieldLabel htmlFor={`${uid}-industry`}>¿Qué vende?</FieldLabel>
        <input
          id={`${uid}-industry`}
          type="text"
          name="industry"
          disabled={disabled}
          placeholder="Ej. calzado deportivo, iluminación LED…"
          className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
      </div>

      <div>
        <FieldLabel>¿De dónde lo sacaste?</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SUPPLIER_SOURCE_ORIGINS.map((o) => (
            <Chip
              key={o}
              name="sourceOrigin"
              value={o}
              label={SUPPLIER_SOURCE_ORIGIN_LABEL[o]}
              checked={origin === o}
              onSelect={() => setOrigin(o)}
              disabled={disabled}
            />
          ))}
        </div>
        {needsNote && (
          <input
            type="text"
            name="sourceOriginNote"
            disabled={disabled}
            placeholder={
              origin === "recomendado"
                ? "¿Quién te lo recomendó?"
                : "¿Dónde lo encontraste?"
            }
            className="mt-2 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          />
        )}
      </div>

      <div>
        <FieldLabel>¿Ya le habías comprado?</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SUPPLIER_PURCHASE_HISTORIES.map((h) => (
            <Chip
              key={h}
              name="purchaseHistory"
              value={h}
              label={SUPPLIER_PURCHASE_HISTORY_LABEL[h]}
              checked={history === h}
              onSelect={() => setHistory(h)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {history !== "" && (
        <div>
          <FieldLabel>¿Por dónde hablas con él hoy?</FieldLabel>
          <p className="mt-1 text-[11px] text-grey-700 leading-[1.45]">
            Ayuda a tu proveedor a entender con qué cliente y por qué canal está
            hablando.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SUPPLIER_COMM_METHODS.map((c) => (
              <Chip
                key={c}
                name="commMethod"
                value={c}
                label={SUPPLIER_COMM_METHOD_LABEL[c]}
                checked={comm === c}
                onSelect={() => setComm(c)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SupplierPicker({
  suppliers,
  preselected,
  supplierId,
  onSelect,
  showProfile = false,
}: {
  suppliers: SupplierView[];
  preselected: SupplierView | null;
  supplierId: string;
  onSelect: (id: string) => void;
  /**
   * ¿Pedir la ficha extendida del Norte al crear un proveedor? (SDD-0173).
   *
   * Es una PROP y no un flag global a propósito: la ficha se diseñó para el
   * paso 1 del asistente, y el formulario largo al que reemplaza tiene los días
   * contados. Con un flag aparte, prenderlo antes que el asistente le habría
   * cambiado el alta de proveedor a TODO cliente en un formulario que se va a
   * borrar. Así la ficha no puede existir fuera del asistente aunque alguien se
   * distraiga: viaja con él, sin un segundo interruptor que coordinar.
   */
  showProfile?: boolean;
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

  const selected = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  /**
   * Atajos (Norte, `chipList`): con un proveedor ya elegido se muestran TODOS
   * los demás — el elegido llenó el buscador, y filtrar por ese texto dejaría la
   * fila vacía justo cuando el cliente podría querer cambiar. Sin selección, se
   * filtran por lo que va escribiendo.
   */
  const chipSuppliers = useMemo(
    () =>
      (supplierId
        ? suppliers.filter((s) => s.id !== supplierId)
        : filteredSuppliers
      ).slice(0, 6),
    [suppliers, filteredSuppliers, supplierId],
  );

  // Si el alta inline del proveedor nuevo termina OK, lo dejamos elegido — la
  // página revalidó, pero el id nuevo lo conocemos por el state.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && newSupplierState.ok && newSupplierState.supplierId) {
        onSelect(newSupplierState.supplierId);
        setNewSupplierName(null);
      }
    });
    return () => {
      cancelled = true;
    };
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

      {/* Atajos a los proveedores de siempre. Al Norte le importan porque la
          re-compra al MISMO proveedor es el caso normal: verlos ahí ahorra
          escribir. Se ocultan los ya elegidos. */}
      {newSupplierName === null && chipSuppliers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {chipSuppliers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect(s.id);
                setSupplierQuery(s.name);
                setSupplierOpen(false);
              }}
              className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-grey-200 text-[12px] font-bold text-ink hover:bg-grey-100 transition-colors"
            >
              <span
                className="grid place-items-center rounded-[6px] text-[10px] font-bold"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--color-paper)",
                  color: "var(--color-wine-text)",
                }}
              >
                #{s.supplierSeq}
              </span>
              {s.name}
              <span className="font-medium text-grey-700">
                · {s.orderCount} compra{s.orderCount === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      )}

      {newSupplierName === null && selected && (
        <div
          className="mt-3 flex items-center gap-3 rounded-[10px] p-3 border"
          style={{
            borderColor: "var(--color-status-success)",
            background: "var(--color-paper)",
          }}
        >
          <span
            className="flex-shrink-0"
            style={{ color: "var(--color-status-success)" }}
          >
            <CheckIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink truncate">
              {selected.name}
            </div>
            <div className="mt-0.5 text-[11.5px] text-grey-700">
              Proveedor seleccionado
              {selected.orderCount > 0
                ? ` · ${selected.orderCount} compra${selected.orderCount === 1 ? "" : "s"} anterior${selected.orderCount === 1 ? "" : "es"}`
                : " · primera compra"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setSupplierQuery("");
              setSupplierOpen(true);
            }}
            className="flex-shrink-0 text-[12px] font-semibold"
            style={{ color: "var(--color-wine-text)" }}
          >
            Cambiar
          </button>
        </div>
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
          {/* `text-wine` crudo mide 3.70:1 en el portal oscuro (medido): el wine
              como TEXTO va por --color-wine-text, que sí alcanza en ambos temas. */}
          <p
            className="text-[10px] font-bold tracking-[0.08em] uppercase"
            style={{ color: "var(--color-wine-text)" }}
          >
            Datos del proveedor nuevo
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">
            + Se creará &ldquo;{newSupplierName}&rdquo;
          </p>
          {newSupplierState.fieldErrors?.name && (
            <PortalFieldError>{newSupplierState.fieldErrors.name}</PortalFieldError>
          )}

          {showProfile && <SupplierProfileFields disabled={newSupplierPending} />}

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
