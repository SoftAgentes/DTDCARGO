"use client";

/**
 * SDD-0173 · Paso 3 del asistente — "Trazabilidad a tu logística".
 *
 * El handoff al proveedor: un link que le lleva el formulario de Packing List +
 * Factura y las etiquetas con su código. La idea del Norte es que el cliente NO
 * tenga que descargar ni reenviar nada — le pasa el link y el proveedor baja lo
 * que necesita.
 *
 * Reusa lo que ya existe: `ShareProviderButton` (+ `/p/[token]`, SDD-0096) y la
 * página de etiquetas `/portal/compras/[code]/etiquetas`.
 *
 * Sólo tokens `var(--*)`. Tema oscuro por default: sobre relleno wine va
 * `--color-on-accent`, nunca `text-white`.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowIcon, DocIcon } from "@/components/Icon";
import { ShareProviderButton } from "../../../_components/ShareProviderButton";
import { PurchaseWizardSteps } from "./PurchaseWizardSteps";
import { PurchaseSummaryPanel } from "./PurchaseSummaryPanel";
import type { OrderRecap } from "./PurchaseSummaryPanel";

/** Un paso numerado de la lista de instrucciones. */
function NumberedStep({
  n,
  tone,
  children,
}: {
  n: number;
  tone: "wine" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 items-start">
      <span
        className="flex-shrink-0 grid place-items-center rounded-full text-[11px] font-bold"
        style={{
          width: 22,
          height: 22,
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          background:
            tone === "wine" ? "var(--color-wine)" : "var(--color-grey-100)",
          // Sobre relleno wine SIEMPRE --color-on-accent: el token "white" del
          // portal vale navy en oscuro y el número se perdería.
          color:
            tone === "wine" ? "var(--color-on-accent)" : "var(--color-ink)",
          border:
            tone === "wine" ? "none" : "1px solid var(--color-grey-200)",
        }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

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
          <div className="flex items-center gap-2.5">
            <span
              className="grid place-items-center rounded-[10px] flex-shrink-0"
              style={{
                width: 30,
                height: 30,
                background: "var(--color-paper)",
                color: "var(--color-wine-text)",
              }}
            >
              <DocIcon size={15} />
            </span>
            <h2 className="text-[15px] font-bold text-ink m-0">
              Que tu proveedor lo confirme
            </h2>
          </div>
          <p className="mt-2 text-[12.5px] text-grey-700 leading-[1.55]">
            Así tu proveedor te envía la mercancía{" "}
            <strong className="text-ink">bien identificada, sin retrasos</strong>.
          </p>

          <div className="mt-5 text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--color-wine-text)" }}>
            Tus pasos · seguimiento con tu proveedor
          </div>
          <ol className="mt-2.5 flex flex-col gap-3.5 list-none p-0 m-0">
            <NumberedStep n={1} tone="wine">
              <p className="text-[12.5px] text-ink leading-[1.5] m-0">
                Cópiale el link y envíaselo por chat a tu proveedor.
              </p>
              {shareToken ? (
                <div className="mt-2">
                  <ShareProviderButton token={shareToken} />
                </div>
              ) : (
                <p className="mt-2 text-[11.5px] text-grey-700 leading-[1.5] m-0">
                  El link se está generando. Lo encuentras en el detalle de tu
                  compra, en{" "}
                  <Link href="/portal/compras" className="text-wine font-semibold">
                    Mis compras
                  </Link>
                  .
                </p>
              )}
            </NumberedStep>
            <NumberedStep n={2} tone="wine">
              <p className="text-[12.5px] text-ink leading-[1.5] m-0">
                Hazle seguimiento para asegurarte de que cumpla con lo
                siguiente:
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
                <span className="text-[12px] text-grey-700 leading-[1.5]">
                  <strong className="text-ink">a.</strong> Que llene el
                  formulario del link.
                </span>
                <span className="text-[12px] text-grey-700 leading-[1.5]">
                  <strong className="text-ink">b.</strong> Que le ponga a cada
                  caja la etiqueta con tu código.
                </span>
              </div>
            </NumberedStep>
          </ol>

          <div className="mt-6 text-[10px] font-bold tracking-[0.08em] uppercase text-grey-500">
            Tu proveedor · sus confirmaciones
          </div>
          <ol className="mt-2.5 flex flex-col gap-3 list-none p-0 m-0">
            {[
              "Abre el link y llena los datos.",
              "Sube su factura final, su packing list final y las fotos del producto terminado.",
              "Nos envía el producto.",
            ].map((t, i) => (
              <NumberedStep key={t} n={i + 1} tone="neutral">
                <p className="text-[12.5px] text-ink leading-[1.5] m-0">{t}</p>
              </NumberedStep>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            className="mt-5 pt-4 w-full flex items-center justify-between gap-3 text-left"
            style={{ borderTop: "1px dashed var(--color-grey-200)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-grey-500">
              Así se ve lo que recibe tu proveedor
            </span>
            <span
              className="text-[11px] font-bold"
              style={{ color: "var(--color-wine-text)" }}
            >
              {previewOpen ? "Achicar" : "Ver ejemplo"}
            </span>
          </button>

          {previewOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="rounded-[10px] border border-grey-200 p-3 bg-grey-100">
                  <div
                    className="text-[9px] font-bold uppercase tracking-[0.06em]"
                    style={{ color: "var(--color-wine-text)" }}
                  >
                    Packing list + factura
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {["Artículo · Cant. · Precio", "Lote A", "Lote B", "Total"].map(
                      (r) => (
                        <div
                          key={r}
                          className="h-[7px] rounded-[2px]"
                          style={{
                            background: "var(--color-grey-200)",
                            width: r === "Total" ? "40%" : "100%",
                          }}
                        />
                      ),
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-grey-700 leading-[1.4] text-center m-0">
                  El formulario que tu proveedor llena.
                </p>
              </div>

              <div>
                <div className="rounded-[10px] border border-grey-200 p-3 bg-grey-100 flex flex-col items-center gap-1.5">
                  {/* grey-500 sobre grey-100 mide 4.24:1 a este tamaño — no
                      llega a AA. grey-700 sí (medido). */}
                  <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-grey-700">
                    Shipping to DTD Cargo
                  </div>
                  {/* Recuadro del QR, no un QR dibujado: un código falso invita
                      a escanearlo. El real vive en la página de etiquetas. */}
                  <div
                    className="grid place-items-center rounded-[4px]"
                    style={{
                      width: 52,
                      height: 52,
                      border: "1px dashed var(--color-grey-500)",
                    }}
                  >
                    <span className="text-[7px] font-bold uppercase text-grey-700">
                      QR
                    </span>
                  </div>
                  <code
                    className="text-[11px] font-bold text-ink"
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                    }}
                  >
                    {code}
                  </code>
                </div>
                <p className="mt-2 text-[11px] text-grey-700 leading-[1.4] text-center m-0">
                  La etiqueta que va en cada caja.
                </p>
              </div>
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
