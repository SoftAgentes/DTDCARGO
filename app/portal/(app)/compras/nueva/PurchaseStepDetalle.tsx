"use client";

/**
 * SDD-0172 · Paso 2 del asistente — "Sigue tus compras".
 *
 * La compra ya existe (el paso 1 la registró). Acá el cliente adelanta lo que
 * sepa: descripción, cajas, valor, tracking y adjuntos. TODO es opcional, y el
 * copy lo dice — el Norte lo encuadra como "adelanta lo que ya sabes", no como
 * un formulario que hay que llenar.
 *
 * Sólo tokens `var(--*)`. Tema oscuro por default.
 */

import { useActionState, useEffect, useId, useState } from "react";
import { ArrowIcon } from "@/components/Icon";
import { FieldLabel, FileField } from "../../../_components/PortalFormField";
import { PurchaseWizardSteps } from "./PurchaseWizardSteps";
import { PurchaseSummaryPanel } from "./PurchaseSummaryPanel";
import type { ChecklistItem } from "./PurchaseSummaryPanel";
import type { PrealertaActionState } from "@/lib/studio/prealertas/types";
import { updatePrealertaDetalleAction } from "../../proveedores/actions";

const initial: PrealertaActionState = {};

const CAMPOS = [
  { key: "description", label: "Descripción" },
  { key: "boxes", label: "Cajas" },
  { key: "estValueUsd", label: "Valor estimado" },
  { key: "trackingCn", label: "Tracking China" },
  { key: "packing", label: "Packing list" },
  { key: "factura", label: "Factura del proveedor" },
  { key: "fotos", label: "Fotos del producto" },
] as const;

export function PurchaseStepDetalle({
  code,
  onDone,
  onProgress,
}: {
  code: string;
  /** El paso 2 terminó (con o sin datos) → seguimos al 3. */
  onDone: () => void;
  /** Lo llenado sube al padre para que el paso 3 muestre el mismo checklist. */
  onProgress: (items: ChecklistItem[]) => void;
}) {
  const [state, action, pending] = useActionState(
    updatePrealertaDetalleAction,
    initial,
  );
  const uid = useId();
  const [touched, setTouched] = useState({
    description: false,
    boxes: false,
    estValueUsd: false,
    trackingCn: false,
    packing: false,
    factura: false,
    fotos: false,
  });
  const mark = (k: keyof typeof touched) =>
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const checklist: ChecklistItem[] = CAMPOS.map((c) => ({
    key: c.key,
    label: c.label,
    done: touched[c.key],
  }));

  // El paso 3 muestra el mismo checklist: se sube cada vez que cambia.
  useEffect(() => {
    onProgress(checklist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  // El guardado salió bien → al paso 3. En efecto, no en el render: avanzar es
  // un efecto sobre el padre, y hacerlo mientras se renderiza es un bug latente.
  useEffect(() => {
    if (state.ok) onDone();
    // `onDone` viene memorizado del padre (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div>
      <PurchaseWizardSteps step={2} />

      <form
        action={action}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
      >
        <input type="hidden" name="prealertaCode" value={code} />

        <div className="min-w-0 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-6">
          <h2 className="text-[15px] font-bold text-ink m-0">
            Adelanta lo que ya sabes
          </h2>
          <p className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55]">
            Por si nos atoramos con tu proveedor. Nada de esto es obligatorio,
            pero ayuda a avanzar.
          </p>

          <div className="mt-4">
            <FieldLabel htmlFor={`${uid}-description`}>
              Descripción de la compra
            </FieldLabel>
            <textarea
              id={`${uid}-description`}
              name="description"
              rows={2}
              onChange={() => mark("description")}
              placeholder="Ej. 3 cajas de zapatos deportivos"
              disabled={pending}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
            {state.fieldErrors?.description && (
              <p className="mt-1 text-[12px] text-wine">
                {state.fieldErrors.description}
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor={`${uid}-boxes`}>
                Total de cajas / bultos
              </FieldLabel>
              <input
                id={`${uid}-boxes`}
                type="number"
                name="boxes"
                min={1}
                step={1}
                onChange={() => mark("boxes")}
                placeholder="1"
                disabled={pending}
                className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              />
              {state.fieldErrors?.boxes && (
                <p className="mt-1 text-[12px] text-wine">
                  {state.fieldErrors.boxes}
                </p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor={`${uid}-est-value`}>
                Valor estimado USD
              </FieldLabel>
              <input
                id={`${uid}-est-value`}
                type="number"
                name="estValueUsd"
                min={0}
                step="0.01"
                onChange={() => mark("estValueUsd")}
                placeholder="—"
                disabled={pending}
                className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              />
              {state.fieldErrors?.estValueUsd && (
                <p className="mt-1 text-[12px] text-wine">
                  {state.fieldErrors.estValueUsd}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor={`${uid}-tracking`}>Tracking China</FieldLabel>
            <input
              id={`${uid}-tracking`}
              type="text"
              name="trackingCn"
              onChange={() => mark("trackingCn")}
              placeholder="Ej. SF1234567890"
              disabled={pending}
              className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
              }}
            />
          </div>

          <div className="mt-5 rounded-[12px] border border-grey-200 p-4">
            <FieldLabel>Adjuntos</FieldLabel>
            <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.45]">
              Si los subes nos ayudas a saber qué traes y cuánto vale, y te
              quedan de recordatorio en tu portal.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <div onChange={() => mark("packing")}>
                <FileField
                  name="doc_packing"
                  label="Packing list"
                  accept="image/*,application/pdf"
                  disabled={pending}
                />
              </div>
              <div onChange={() => mark("factura")}>
                <FileField
                  name="doc_factura"
                  label="Factura del proveedor"
                  accept="image/*,application/pdf"
                  disabled={pending}
                />
              </div>
              <div onChange={() => mark("fotos")}>
                <FileField
                  name="doc_fotos"
                  label="Fotos del producto"
                  accept="image/*"
                  multiple
                  disabled={pending}
                />
              </div>
            </div>
          </div>

          {state.error && (
            <p className="mt-3 text-[12.5px] text-wine">{state.error}</p>
          )}
        </div>

        <div className="lg:sticky lg:top-[88px]">
          <PurchaseSummaryPanel code={code} checklist={checklist}>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending ? "Guardando…" : "Guardar y avanzar al paso 3"}
              {!pending && <ArrowIcon size={15} />}
            </button>
            <button
              type="button"
              onClick={onDone}
              disabled={pending}
              className="text-[12px] font-semibold text-grey-500 hover:text-ink transition-colors disabled:opacity-60"
            >
              Lo lleno después — ir al paso 3
            </button>
          </PurchaseSummaryPanel>
        </div>
      </form>
    </div>
  );
}
