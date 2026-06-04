"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon, DownloadIcon } from "@/components/Icon";
import type { BoxLabel } from "@/lib/studio/prealertas/types";

/**
 * Vista de etiquetas imprimibles de una compra (SDD-0057 · Slice B · V1).
 *
 * Piel del portal (paper/wine), tokens `var(--*)`. Cada etiqueta = el MISMO code
 * de la compra + "Caja M/N" + nombre del cliente (+ placeholder de QR simple). El
 * botón "Descargar / imprimir" usa `window.print()`; el CSS `@media print` oculta
 * todo menos la grilla de etiquetas (`.labels-print-area`), que pasa a una
 * cuadrícula sin sombras lista para hoja A4.
 *
 * El QR real lo genera el almacén/SDD-0031; acá va un placeholder visual simple
 * para que el proveedor entienda dónde irá (no codifica datos).
 */
export function LabelsClient({
  code,
  clientName,
  supplierName,
  description,
  labels,
}: {
  code: string;
  clientName: string;
  supplierName: string | null;
  description: string;
  labels: BoxLabel[];
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — no rompemos */
    }
  }

  return (
    <div>
      {/* CSS de impresión: sólo la grilla de etiquetas sale en papel. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .labels-print-area, .labels-print-area * { visibility: visible !important; }
          .labels-print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8mm !important; padding: 8mm !important;
          }
          .label-card { break-inside: avoid; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print">
        <Link
          href="/portal/compras"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink"
        >
          <ArrowIcon size={14} className="rotate-180" /> Mis compras
        </Link>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="eyebrow">Etiquetas para el proveedor</span>
            <h1
              className="mt-3 text-[26px] sm:text-[32px] leading-none text-ink"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                letterSpacing: "-0.01em",
              }}
            >
              {code}
            </h1>
            <p className="mt-3 text-[13.5px] text-grey-700 leading-[1.5] max-w-[58ch]">
              {description}
              {supplierName ? ` · ${supplierName}` : ""}
            </p>
          </div>
          <div className="flex gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={copyCode}
              className="btn btn-ghost inline-flex items-center gap-2"
            >
              {copied ? <CheckIcon size={15} /> : null}
              {copied ? "Copiado" : "Copiar código"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              Descargar / imprimir <DownloadIcon size={15} />
            </button>
          </div>
        </div>

        <div
          className="mt-5 rounded-[12px] border-l-[3px] px-4 py-3.5 text-[13px] text-grey-700 leading-[1.5]"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-wine)",
          }}
        >
          El proveedor pega <strong className="text-ink">una etiqueta en cada
          caja</strong> (en una cara visible). Todas llevan el mismo código de la
          compra; cambia sólo el número de caja. Así el almacén de Yiwu las asocia
          a tu cuenta.
        </div>
      </div>

      {/* Grilla de etiquetas (vista pantalla + área de impresión) */}
      <div className="labels-print-area mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {labels.map((l) => (
          <LabelCard
            key={l.boxN}
            label={l}
            clientName={clientName}
          />
        ))}
      </div>
    </div>
  );
}

function LabelCard({
  label,
  clientName,
}: {
  label: BoxLabel;
  clientName: string;
}) {
  return (
    <div
      className="label-card bg-white border rounded-[10px] p-4 text-center"
      style={{ borderColor: "var(--color-grey-300)" }}
    >
      <div
        className="text-[8px] font-bold tracking-[0.14em] uppercase"
        style={{ color: "var(--color-grey-500)" }}
      >
        Shipping to DTD-Cargo
      </div>

      {/* Placeholder de QR (no codifica datos — el QR real lo genera el almacén). */}
      <div
        aria-hidden
        className="mx-auto my-3 grid place-items-center"
        style={{
          width: 56,
          height: 56,
          background: "var(--color-grey-100)",
          border: "1px solid var(--color-grey-200)",
          borderRadius: 6,
        }}
      >
        <span
          className="text-[7px] font-bold tracking-[0.1em] uppercase"
          style={{ color: "var(--color-grey-300)" }}
        >
          QR
        </span>
      </div>

      <div
        className="text-[12px] font-bold"
        style={{
          color: "var(--color-ink)",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        }}
      >
        {label.code}
      </div>
      <div
        className="mt-1 text-[10px] font-bold"
        style={{
          color: "var(--color-wine)",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        }}
      >
        Caja {label.boxN} / {label.totalBoxes}
      </div>
      <div
        className="mt-1 text-[8px] truncate"
        style={{ color: "var(--color-grey-700)" }}
      >
        {clientName}
      </div>
    </div>
  );
}
