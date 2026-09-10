"use client";
import { QRCodeSVG } from "qrcode.react";
import { labelVerifyUrl } from "@/lib/studio/etiquetas-qr";
import type { BoxLabel } from "@/lib/studio/prealertas/types";
import { printMarkbox } from "@/lib/shared/markbox-chain";
import { DEFAULT_LABEL_PRESENTATION, type LabelPresentation } from "@/lib/shared/label-presentation";

/** Immutable operational fields; administrators can only adjust presentation. */
export function ShippingBoxLabel({ label, markbox, brandName, presentation = DEFAULT_LABEL_PRESENTATION }: {
  label: BoxLabel; markbox: string; brandName: string; presentation?: LabelPresentation;
}) {
  return <div className="label-card bg-white border border-grey-300 rounded-[10px] p-4 text-center text-ink" style={{ fontFamily: "var(--font-jetbrains-mono), var(--font-noto-sc), monospace" }}>
    <div className="text-sm font-bold">Shipping Mark</div>
    <strong className="block text-lg">{printMarkbox(markbox)}</strong>
    <div className="mx-auto my-3 flex justify-center">
      <QRCodeSVG value={labelVerifyUrl(markbox, label.boxN, label.totalBoxes, label.boxCode)}
        size={presentation.size === "large" ? 112 : 80} fgColor="var(--color-ink)" bgColor="var(--color-white)" level="M" marginSize={4}
        aria-label={`QR ${label.boxCode ?? label.code}`} />
    </div>
    <div className="text-sm font-bold">{label.code}</div>
    <div className="text-sm">第 {label.boxN}/{label.totalBoxes} 箱 · {presentation.language === "zh-en" ? "Box" : "Caja"} {label.boxN}/{label.totalBoxes}</div>
    {label.boxCode && <div className="text-xs mt-1 font-bold">{label.boxCode}</div>}
    {presentation.showBrand && <div className="text-xs mt-2">{brandName}</div>}
  </div>;
}
