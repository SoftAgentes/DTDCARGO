"use client";

/**
 * SDD-0173 · Paso 2 del asistente — "Sigue tus compras".
 *
 * La compra ya existe (el paso 1 la registró). Acá el cliente adelanta lo que
 * sepa: descripción, cajas, valor, tracking y adjuntos. TODO es opcional, y el
 * copy lo dice — el Norte lo encuadra como "adelanta lo que ya sabes", no como
 * un formulario que hay que llenar.
 *
 * Sólo tokens `var(--*)`. Tema oscuro por default.
 */

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "@/components/Icon";
import { FieldLabel, FileField } from "../../../_components/PortalFormField";
import { PurchaseWizardSteps } from "./PurchaseWizardSteps";
import { PurchaseSummaryPanel } from "./PurchaseSummaryPanel";
import type { ChecklistItem, OrderRecap } from "./PurchaseSummaryPanel";
import type { PrealertaActionState } from "@/lib/studio/prealertas/types";
import { PREALERTA_DESCRIPCION_PENDIENTE } from "@/lib/studio/prealertas/types";
import { updatePrealertaDetalleAction } from "../../proveedores/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

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

/** Lo ya guardado de esta compra, para precargar el formulario. */
export type DetalleGuardado = {
  description: string | null;
  boxes: number | null;
  estValueUsd: number | null;
  trackingCn: string | null;
};

export function PurchaseStepDetalle({
  code,
  order,
  onDone,
  onProgress,
  guardado,
  modo = "asistente",
}: {
  code: string;
  /** La orden armada en el paso 1, para no perderla de vista. */
  order?: OrderRecap;
  /** El paso 2 terminó (con o sin datos) → seguimos al 3. Sólo en el asistente. */
  onDone?: () => void;
  /** Lo llenado sube al padre para que el paso 3 muestre el mismo checklist. */
  onProgress?: (items: ChecklistItem[]) => void;
  /**
   * Valores ya guardados (modo `suelto`). Precargar NO es un lujo: la action
   * cae a `PREALERTA_DESCRIPCION_PENDIENTE` y `boxes = 1` cuando los campos
   * llegan vacíos, así que abrir esta pantalla con los campos en blanco y
   * guardar PISARÍA lo que el cliente ya había puesto.
   */
  guardado?: DetalleGuardado;
  /**
   * `asistente` = paso 2 de 3 recién registrada la compra.
   * `suelto`    = se abrió después desde la compra, por su propia ruta.
   */
  modo?: "asistente" | "suelto";
}) {
  const router = useRouter();
  const suelto = modo === "suelto";
  // La descripción "Pendiente — el cliente la completa" es un relleno del
  // servidor, no algo que el cliente escribió: en el campo va vacía.
  const descGuardada =
    guardado?.description && guardado.description !== PREALERTA_DESCRIPCION_PENDIENTE
      ? guardado.description
      : "";
  const [state, action, pending] = useActionState(
    updatePrealertaDetalleAction,
    initial,
  );
  const uid = useId();
  const [touched, setTouched] = useState({
    // Lo ya guardado cuenta como hecho: el checklist tiene que decir la verdad
    // de la compra, no sólo lo tecleado en esta visita.
    description: descGuardada !== "",
    boxes: guardado?.boxes != null,
    estValueUsd: guardado?.estValueUsd != null,
    trackingCn: !!guardado?.trackingCn,
    packing: false,
    factura: false,
    fotos: false,
  });
  const mark = (k: keyof typeof touched) =>
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  /**
   * ¿El cliente ya puso ALGO? De esto depende que "Lo lleno después" siga
   * existiendo: era un `type="button"` que sólo cambiaba de fase, así que el
   * form nunca se enviaba y todo lo escrito y adjuntado se perdía en silencio
   * (SGE-00.02). Con algo tocado ya no hay nada que "saltar": lo único honesto
   * es guardar, y eso ya lo hace el botón principal.
   */
  const algoTocado = Object.values(touched).some(Boolean);

  const checklist: ChecklistItem[] = CAMPOS.map((c) => ({
    key: c.key,
    label: c.label,
    done: touched[c.key],
  }));

  // El paso 3 muestra el mismo checklist: se sube cada vez que cambia.
  useEffect(() => {
    onProgress?.(checklist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  // El guardado salió bien → al paso 3. En efecto, no en el render: avanzar es
  // un efecto sobre el padre, y hacerlo mientras se renderiza es un bug latente.
  useEffect(() => {
    if (!state.ok) return;
    // Suelto no tiene paso 3: se vuelve a la compra, que es de donde se vino y
    // donde el detalle recién guardado ya se ve (la action revalida esa ruta).
    if (suelto) router.push(`/portal/compras/${encodeURIComponent(code)}`);
    else onDone?.();
    // `onDone` viene memorizado del padre (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div>
      {suelto ? (
        <div className="mb-6">
          <Link
            href={`/portal/compras/${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-700 hover:text-ink transition-colors"
          >
            <ArrowIcon size={15} className="rotate-180" /> Volver a la compra
          </Link>
        </div>
      ) : (
        <PurchaseWizardSteps step={2} />
      )}

      <form
        action={action}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
      >
        <input type="hidden" name="prealertaCode" value={code} />

        <div className="min-w-0 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-6">
          <h2 className="text-[15px] font-bold text-ink m-0">
            {suelto ? "Completa el detalle de tu compra" : "Adelanta lo que ya sabes"}
          </h2>
          <p className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55]">
            {suelto
              ? "Lo que ya habías guardado está cargado abajo. Cambia lo que quieras y guarda."
              : "Por si nos atoramos con tu proveedor. Nada de esto es obligatorio, pero ayuda a avanzar."}
          </p>

          <div className="mt-4">
            <FieldLabel htmlFor={`${uid}-description`}>
              Descripción de la compra
            </FieldLabel>
            <textarea
              id={`${uid}-description`}
              name="description"
              rows={2}
              defaultValue={descGuardada}
              onChange={() => mark("description")}
              placeholder="Ej. 3 cajas de zapatos deportivos"
              disabled={pending}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
            {state.fieldErrors?.description && (
              <PortalFieldError>{state.fieldErrors.description}</PortalFieldError>
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
                defaultValue={guardado?.boxes ?? ""}
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
                <PortalFieldError>{state.fieldErrors.boxes}</PortalFieldError>
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
                defaultValue={guardado?.estValueUsd ?? ""}
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
                <PortalFieldError>{state.fieldErrors.estValueUsd}</PortalFieldError>
              )}
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor={`${uid}-tracking`}>Tracking China</FieldLabel>
            <input
              id={`${uid}-tracking`}
              type="text"
              name="trackingCn"
              defaultValue={guardado?.trackingCn ?? ""}
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
            <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
          )}
        </div>

        <div className="lg:sticky lg:top-[88px]">
          <PurchaseSummaryPanel code={code} checklist={checklist} order={order}>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending
                ? "Guardando…"
                : suelto
                  ? "Guardar el detalle"
                  : "Guardar y avanzar al paso 3"}
              {!pending && <ArrowIcon size={15} />}
            </button>
            {suelto ? (
              <Link
                href={`/portal/compras/${encodeURIComponent(code)}`}
                className="-mx-3 px-3 py-2 min-h-[44px] inline-flex items-center justify-center text-[12px] font-semibold text-grey-700 hover:text-ink transition-colors"
              >
                Cancelar
              </Link>
            ) : algoTocado ? (
              <p className="text-[11.5px] text-grey-700 leading-[1.5] text-center m-0">
                Lo que pusiste se guarda al avanzar.
              </p>
            ) : (
              /* `min-h-[44px]` + relleno: como texto pelado medía ~17 px de
                 alto, por debajo del mínimo de 24×24 de WCAG 2.2 §2.5.8 —
                 siendo la única salida del paso. El `-mx-3` compensa el
                 relleno para que no se corra la alineación. */
              <button
                type="button"
                onClick={onDone}
                disabled={pending}
                className="-mx-3 px-3 py-2 min-h-[44px] text-[12px] font-semibold text-grey-700 hover:text-ink transition-colors disabled:opacity-60"
              >
                Lo lleno después — ir al paso 3
              </button>
            )}
          </PurchaseSummaryPanel>
        </div>
      </form>
    </div>
  );
}
