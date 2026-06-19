"use client";

import { useState } from "react";
import { CheckIcon, DownloadIcon } from "@/components/Icon";
import { CONTACT } from "@/lib/design-tokens";
import type { BoxLabel } from "@/lib/studio/prealertas/types";
import { PackingListFormSection } from "./PackingListFormSection";
import { SupplierUploadSection } from "./SupplierUploadSection";

// Latin → Archivo (marca); CJK → Noto Sans SC (fallback por-glifo, Archivo no
// trae hanzi). El proveedor lee chino → es crítico que el CJK use Noto SC.
const BRAND_CJK = "var(--font-archivo), var(--font-noto-sc)";
// Códigos latinos puros (mono tabular).
const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
// Mono + CJK: dígitos/códigos en mono, hanzi en Noto SC.
const MONO_CJK =
  "var(--font-jetbrains-mono), var(--font-noto-sc), ui-monospace, monospace";

/**
 * Página pública del proveedor (SDD-0057 ext · Fase 1). Bilingüe 中文/Español: el
 * proveedor chino abre el link, copia la dirección de la bodega CN (con el shipping
 * mark del cliente) e imprime las etiquetas. Sin login, sin chrome del portal.
 * (Fase 2: + descarga del template de packing list/factura.)
 */
export function ProviderShareClient({
  token,
  code,
  description,
  markbox,
  clientName,
  supplierName,
  supplierWechat,
  labels,
}: {
  token: string;
  code: string;
  description: string;
  markbox: string;
  clientName: string | null;
  supplierName: string | null;
  supplierWechat: string | null;
  labels: BoxLabel[];
}) {
  const [copied, setCopied] = useState(false);

  const cn = CONTACT.cn;
  const addressText = [
    `收货人 / Destinatario: DTD Cargo - ${markbox}`,
    `电话 / Teléfono: ${cn.phone}`,
    `地址 / Dirección: 浙江省${cn.addressCjk}`,
    `邮编 / Código postal: ${cn.postalCode}`,
    `仓库联系人 / Contacto: ${cn.contactPersonCjk}`,
  ].join("\n");

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(addressText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el texto está visible para copiar a mano */
    }
  }

  return (
    <div className="min-h-screen bg-paper" style={{ fontFamily: BRAND_CJK }}>
      {/* Solo la grilla de etiquetas sale en papel. */}
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

      <div className="mx-auto w-full max-w-[680px] px-5 py-10">
        {/* Header */}
        <div className="no-print">
          <div className="text-[13px] font-bold tracking-[0.04em] text-ink">
            DTD <span className="text-wine">Cargo</span>
          </div>
          <h1 className="mt-4 text-[24px] sm:text-[28px] font-bold text-ink leading-tight">
            <span lang="zh">给供应商的资料</span>
            <span
              lang="es"
              className="block text-[15px] font-semibold text-grey-500 mt-1"
            >
              Información para el proveedor
            </span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className="text-[14px] font-bold text-ink" style={{ fontFamily: MONO }}>
              {code}
            </span>
            <span className="text-[13px] text-grey-500">
              {description}
              {supplierName ? ` · ${supplierName}` : ""}
            </span>
          </div>

          {/* Dirección de la bodega CN */}
          <section className="mt-7 bg-white border border-grey-200 rounded-[16px] p-6">
            <div className="text-[15px] font-bold text-ink" lang="zh">
              收货地址{" "}
              <span lang="es" className="text-grey-500 font-semibold">
                · Dirección de entrega
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55]" lang="zh">
              请把货物寄到这个地址，并把 Shipping Mark（{markbox}）写在每个箱子上。
              <span lang="es" className="block text-grey-500 mt-1">
                Envía la mercancía a esta dirección y escribe el Shipping Mark
                ({markbox}) en cada caja.
              </span>
            </p>
            <pre
              className="mt-4 rounded-[12px] bg-grey-100 px-4 py-3.5 text-[12.5px] text-ink leading-[1.7] overflow-x-auto"
              style={{ fontFamily: MONO_CJK }}
            >
              {addressText}
            </pre>
            <button
              type="button"
              onClick={copyAddress}
              className="btn btn-ghost mt-3 inline-flex items-center gap-2"
            >
              {copied ? "已复制 · Copiado" : "复制地址 · Copiar dirección"}
              {copied && <CheckIcon size={15} />}
            </button>
          </section>

          {/* Etiquetas */}
          <section className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="text-[15px] font-bold text-ink" lang="zh">
                  箱子标签{" "}
                  <span lang="es" className="text-grey-500 font-semibold">
                    · Etiquetas
                  </span>
                </div>
                <p
                  className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55] max-w-[52ch]"
                  lang="zh"
                >
                  每个箱子贴一张标签（贴在能看到的一面）。
                  <span lang="es" className="block text-grey-500 mt-1">
                    Pega una etiqueta en cada caja, en una cara visible.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary inline-flex items-center gap-2 flex-shrink-0"
              >
                打印标签 · Imprimir etiquetas <DownloadIcon size={15} />
              </button>
            </div>
          </section>
        </div>

        {/* Grilla de etiquetas (pantalla + impresión) */}
        <div className="labels-print-area mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {labels.map((l) => (
            <LabelCard key={l.boxN} label={l} clientName={clientName ?? markbox} />
          ))}
        </div>

        {/* (a) PASO 1 — Packing list / factura ONLINE (SDD-0096): llenar + enviar */}
        <div className="no-print mt-8">
          <StepEyebrow n={1} zh="第一步" es="Paso 1" />
        </div>
        <PackingListFormSection
          token={token}
          supplierName={supplierName}
          supplierWechat={supplierWechat}
        />

        {/* (b) PASO 2 — Fallback: descargar el Excel pre-llenado (GET, se mantiene).
            Secundario respecto al online → título con menos peso + botón ghost. */}
        <div className="no-print mt-8">
          <StepEyebrow n={2} zh="第二步" es="Paso 2" />
        </div>
        <section className="no-print mt-3 bg-white border border-grey-200 rounded-[16px] p-6">
          <div className="text-[14px] font-bold text-grey-700" lang="zh">
            下载 Excel{" "}
            <span lang="es" className="text-grey-500 font-semibold">
              · Descargar el Excel
            </span>
          </div>
          <p
            className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55] max-w-[52ch]"
            lang="zh"
          >
            如果在线填写有问题，可下载已填好唛头和参考号的 Excel，填好后从下方上传。
            <span lang="es" className="block text-grey-500 mt-1">
              Si tienes problemas online, descarga el Excel (ya viene con el
              Shipping Mark y la referencia), llénalo y súbelo abajo.
            </span>
          </p>
          <a
            href={`/p/${token}/packlist`}
            download
            className="btn btn-ghost mt-3 inline-flex items-center gap-2"
          >
            下载 Excel · Descargar el Excel <DownloadIcon size={15} />
          </a>
        </section>

        {/* (c) PASO 3 — Subir fotos del producto + Excel llenado + otros documentos */}
        <div className="no-print mt-8">
          <StepEyebrow n={3} zh="第三步" es="Paso 3" />
        </div>
        <SupplierUploadSection token={token} />
      </div>
    </div>
  );
}

/** Eyebrow numerado que da secuencia a las 3 partes (llenar → descargar → subir). */
function StepEyebrow({ n, zh, es }: { n: number; zh: string; es: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-wine text-[12px] font-bold text-white"
        style={{ fontFamily: MONO }}
        aria-hidden
      >
        {n}
      </span>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-grey-500"
        lang="zh"
      >
        {zh}
        <span lang="es"> · {es}</span>
      </span>
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
        style={{ color: "var(--color-ink)", fontFamily: MONO }}
      >
        {label.code}
      </div>
      <div
        className="mt-1 text-[9px] font-bold leading-tight"
        style={{ color: "var(--color-wine)", fontFamily: MONO_CJK }}
      >
        第 {label.boxN}/{label.totalBoxes} 箱 · Caja {label.boxN}/{label.totalBoxes}
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
