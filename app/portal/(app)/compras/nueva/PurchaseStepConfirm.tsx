"use client";

/**
 * SDD-0173 · Paso 3 del asistente — "Trazabilidad a tu logística".
 *
 * El handoff al proveedor: un link que le lleva el formulario de Packing List +
 * Factura y las etiquetas con su código. La idea del Norte es que el cliente NO
 * tenga que descargar ni reenviar nada — le pasa el link y el proveedor baja lo
 * que necesita.
 *
 * SDD-0468 · Menos es más: antes había dos listas numeradas (5 pasos y un
 * sub-listado a/b) que repetían lo mismo desde dos puntos de vista. Queda UNA
 * acción (el enlace) y UNA lista corta de lo que hará el proveedor.
 *
 * Reusa lo que ya existe: `ShareProviderButton` (+ `/p/[token]`, SDD-0096) y la
 * página de etiquetas `/portal/compras/[code]/etiquetas`.
 *
 * Sólo tokens `var(--*)`. Tema oscuro por default.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import { ShareProviderButton } from "../../../_components/ShareProviderButton";
import { PurchaseWizardSteps } from "./PurchaseWizardSteps";
import { PurchaseSummaryPanel } from "./PurchaseSummaryPanel";
import type { OrderRecap } from "./PurchaseSummaryPanel";

export function PurchaseStepConfirm({
  code,
  shareToken,
  checklist,
  order,
  onBack,
}: {
  code: string;
  shareToken?: string;
  checklist: { key: string; label: string; done: boolean }[];
  order?: OrderRecap;
  /** Volver al paso 2 — el detalle es opcional, pero no irreversible. */
  onBack?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const etiquetasHref = `/portal/compras/${encodeURIComponent(code)}/etiquetas`;

  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-3 text-[12.5px] font-semibold text-grey-500 hover:text-ink transition-colors"
        >
          <ArrowIcon size={13} className="rotate-180" /> Volver al paso 2
        </button>
      )}
      <PurchaseWizardSteps step={3} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-6">
          {shareToken ? (
            <ShareProviderButton token={shareToken} />
          ) : (
            <p className="text-base text-grey-700 leading-relaxed m-0">
              El enlace se está generando. Lo encuentras en el detalle de tu compra, en{" "}
              <Link href="/portal/compras" className="text-wine-text font-semibold underline">
                Mis compras
              </Link>.
            </p>
          )}

          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            aria-controls="provider-flow-preview"
            className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 border-t border-grey-200 pt-4 text-left text-sm font-semibold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Qué encontrará tu proveedor
            <span className="text-wine-text">{previewOpen ? "Ocultar" : "Ver pasos"}</span>
          </button>
          {previewOpen && (
            <div id="provider-flow-preview" className="mt-3 rounded-lg bg-grey-100 p-4 text-base leading-relaxed text-ink">
              <ol className="m-0 list-inside list-decimal space-y-2 p-0">
                <li>Datos del proveedor y moneda.</li>
                <li>Cajas y productos, con totales automáticos.</li>
                <li>Fotos y archivos opcionales.</li>
                <li>Revisión y envío del documento a DTD.</li>
              </ol>
              <p className="mt-4 mb-0 text-sm text-grey-700">
                También puede usar Excel. Al terminar, encuentra las etiquetas para
                cada caja y la dirección de nuestro almacén en China.
              </p>
            </div>
          )}

          <Link
            href={etiquetasHref}
            className="btn btn-ghost mt-4 w-full inline-flex items-center justify-center gap-2"
          >
            Ver mis etiquetas <ArrowIcon size={15} />
          </Link>
        </div>

        <div className="lg:sticky lg:top-[88px]">
          <PurchaseSummaryPanel code={code} checklist={checklist} order={order}>
            <Link
              href="/portal/compras"
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              Listo · ver mis compras <ArrowIcon size={15} />
            </Link>
          </PurchaseSummaryPanel>
        </div>
      </div>
    </div>
  );
}
