"use client";

import { useState } from "react";
import Link from "next/link";
import { ShippingBoxLabel } from "@/app/portal/_components/ShippingBoxLabel";
import type { LabelPresentation } from "@/lib/shared/label-presentation";
import { ArrowIcon, CheckIcon, DownloadIcon } from "@/components/Icon";
import type { BoxLabel } from "@/lib/studio/prealertas/types";
import type { BrandContext } from "@/lib/shared/brand-context";
import { createDocumentClient,type DocumentClient } from "@/components/document-import/document-client";

/**
 * Vista de etiquetas imprimibles de una compra (SDD-0057 · Slice B · V1).
 *
 * Piel del portal (paper/wine), tokens `var(--*)`. Cada etiqueta = el code de la
 * compra + "Caja M/N" + nombre del cliente + QR escaneable. El botón "Descargar /
 * imprimir" usa `window.print()`; el CSS `@media print` oculta todo menos la
 * grilla (`.labels-print-area`), que pasa a una cuadrícula sin sombras lista para
 * hoja A4.
 *
 * SDD-0153: el QR es REAL (`qrcode.react` → /verificar). Si la caja ya está
 * pre-declarada, el QR lleva su `DTD-B-NNNNNN` en `&b=` y la etiqueta lo muestra
 * legible — así el operario en Yiwu la escanea para recibir y estibar. Si no,
 * el QR solo confirma el Shipping Mark del cliente (fallback de la etiqueta vieja).
 */
export function LabelsClient(props:Parameters<typeof LabelsView>[0]){
  const key=props.documentWorkspace?props.documentWorkspace.id+":"+props.documentWorkspace.revision:props.code;
  return <LabelsView key={key} {...props}/>;
}
function LabelsView({
  code,
  markbox,
  supplierName,
  description,
  labels,
  brand,
  presentation,
  documentWorkspace,
  documentClient,
}: {
  code: string;
  markbox: string;
  clientName: string;
  supplierName: string | null;
  description: string;
  labels: BoxLabel[];
  /** SDD-0255 · marca con la que se pinta. Obligatoria: sin default silencioso. */
  brand: BrandContext;
  presentation?: LabelPresentation;
  documentWorkspace?:{id:string;revision:number};
  documentClient?:DocumentClient;
}) {
  const [copied, setCopied] = useState(false);
  const [transport]=useState(()=>documentClient??createDocumentClient());
  const [currentLabels,setCurrentLabels]=useState(labels);
  const [printing,setPrinting]=useState(false);
  const [printError,setPrintError]=useState(false);
  async function printLabels(){
    if(printing)return;
    if(!documentWorkspace){window.print();return;}
    setPrinting(true);setPrintError(false);
    try{
      const result=await transport.get<{revision:number;labels:BoxLabel[]}>("labels",{workspaceId:documentWorkspace.id,expectedRevision:String(documentWorkspace.revision)});
      if(result.revision!==documentWorkspace.revision||!result.labels.length||result.labels.some(label=>!label.boxCode))throw new Error("Revision unavailable");
      setCurrentLabels(result.labels);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    }catch{setCurrentLabels([]);setPrintError(true);}
    finally{setPrinting(false);}
  }

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
              onClick={printLabels}
              disabled={printing||printError}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              {printing?"Comprobando etiquetas…":"Descargar / imprimir"} <DownloadIcon size={15} />
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

      {printError&&<div role="alert" className="no-print mt-6 rounded-xl border border-grey-200 bg-white p-6 text-base leading-relaxed"><p>No pudimos validar esta revisión para imprimir. El documento o sus cajas cambiaron; consulta la versión compartida antes de continuar.</p><Link href={`/portal/compras/${encodeURIComponent(code)}/documento`} className="btn btn-primary mt-4">Abrir Packing List + Factura</Link></div>}
      <div className="labels-print-area mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {currentLabels.map((l, i) => (
          <ShippingBoxLabel
            key={l.boxCode ?? `${l.code}-${l.boxN}-${i}`}
            label={l}
            markbox={markbox}
            brandName={brand.name}
            presentation={presentation}
          />
        ))}
      </div>
    </div>
  );
}
