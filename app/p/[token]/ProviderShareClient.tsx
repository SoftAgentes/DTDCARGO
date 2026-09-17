"use client";

import { useRef, useState } from "react";
import { printDocument } from "@/lib/shared/print-document";
import { ShippingBoxLabel } from "@/app/portal/_components/ShippingBoxLabel";
import type { LabelPresentation } from "@/lib/shared/label-presentation";
import { StatusIcon } from "@/components/StatusIcon";
import { CONTACT } from "@/lib/design-tokens";
import type { BoxLabel } from "@/lib/studio/prealertas/types";
import { PackingListFormSection, WAREHOUSE_RULES } from "./PackingListFormSection";
import { SupplierUploadSection, SupplierUploadSummary, type SupplierUploadStatus } from "./SupplierUploadSection";
import { providerText, type ProviderLocale } from "./PackingListGuidedForm";
import type { BrandContext } from "@/lib/shared/brand-context";
import { printMarkbox } from "@/lib/shared/markbox-chain";

/** Public capability page. Receives only the data already scoped to this purchase. */
export function ProviderShareClient({ token, code, markbox, supplierName, supplierWechat, labels, brand, presentation, request = fetch, excelHref }: {
  token: string; code: string; description?: string; markbox: string; supplierName: string | null; supplierWechat: string | null;
  labels: BoxLabel[]; brand: BrandContext; presentation?: LabelPresentation;
  /** Local review fixture injects a transport; real page keeps existing endpoints. */
  request?: typeof fetch; excelHref?: string;
}) {
  const [uploads, setUploads] = useState<SupplierUploadStatus>({ kind: "idle", uploaded: 0, selected: 0 });
  const [locale, setLocale] = useState<ProviderLocale>("zh");
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");
  const [showPrintNotice, setShowPrintNotice] = useState(false);
  const [printNoticed, setPrintNoticed] = useState(false);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const t = (zh: string, es: string, en: string) => providerText(locale, zh, es, en);
  const cn = CONTACT.cn;
  const addressText = [
    `${t("收货人", "Destinatario", "Recipient")}: ${brand.name} - ${printMarkbox(markbox)}`,
    `${t("电话", "Teléfono", "Phone")}: ${cn.phone}`,
    `${t("地址", "Dirección", "Address")}: ${cn.addressCjk}`,
    `${t("邮编", "Código postal", "Postal code")}: ${cn.postalCode}`,
    `${t("仓库联系人", "Contacto del almacén", "Warehouse contact")}: ${cn.contactPersonCjk}`,
    `${t("收货时间", "Horario", "Hours")}: ${cn.hoursCjk}`,
  ].join("\n");
  function printLabels() {
    if (!printNoticed) { setShowPrintNotice(true); return; }
    printDocument("labels");
  }
  async function copyAddress() {
    try { await navigator.clipboard.writeText(addressText); setCopied("ok"); }
    catch { setCopied("error"); addressRef.current?.focus(); addressRef.current?.select(); }
  }
  const delivery = <details className="rounded-xl border border-grey-200 bg-white p-5" id="delivery">
    <summary className="min-h-11 cursor-pointer text-lg font-bold">{t("仓库地址与送货说明", "Dirección del almacén e instrucciones de entrega", "Warehouse address and delivery instructions")}</summary>
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div><label htmlFor="supplier-warehouse-address" className="font-semibold">{t("收货地址", "Dirección de entrega", "Delivery address")}</label><textarea ref={addressRef} id="supplier-warehouse-address" readOnly value={addressText} rows={8} className="mt-3 w-full resize-y rounded-lg border border-grey-300 bg-paper p-4 text-sm leading-relaxed text-ink outline-none focus-visible:ring-2 focus-visible:ring-wine-text"/><button type="button" className="btn btn-ghost mt-3" onClick={copyAddress}>{copied === "ok" ? t("地址已复制", "Dirección copiada", "Address copied") : t("复制地址", "Copiar dirección", "Copy address")}</button>{copied === "error" && <p role="status" className="mt-2 text-sm text-grey-700">{t("无法复制。地址已选中，请长按或按 Ctrl+C 复制。", "No se pudo copiar. La dirección quedó seleccionada: usa Ctrl+C o mantén presionado.", "Copy failed. The address is selected: press Ctrl+C or long-press to copy.")}</p>}</div>
      <div><h2 className="font-semibold">{t("发货前核对", "Antes de entregar", "Before delivery")}</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-grey-700">{WAREHOUSE_RULES.filter(rule => !rule.contact).map((rule, index) => <li key={index}>{rule[locale]}</li>)}</ol><p className="mt-5 text-sm text-grey-700">{cn.contactPersonCjk} · {cn.phone}<br/>WeChat: {cn.wechatId}</p></div>
    </div>
  </details>;
  return <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-archivo), var(--font-noto-sc)" }}>
    <style>{`
      .provider-page :is(button,a,input,select,textarea,summary):focus-visible { outline: 3px solid var(--color-wine-text); outline-offset: 3px; }
      @media print {
        body * { visibility: hidden !important; }
        .no-print { display: none !important; }
        html[data-print-surface="packing-list"] .labels-print-area { display: none !important; }
        html[data-print-surface="packing-list"] .pl-doc, html[data-print-surface="packing-list"] .pl-doc * { visibility: visible !important; }
        html[data-print-surface="packing-list"] .pl-doc { position: absolute; left: 0; top: 0; width: 100%; }
        html:not([data-print-surface="packing-list"]) .pl-print-only { display: none !important; }
        html:not([data-print-surface="packing-list"]) .labels-print-area,
        html:not([data-print-surface="packing-list"]) .labels-print-area * { visibility: visible !important; }
        html:not([data-print-surface="packing-list"]) .labels-print-area { position: absolute; left: 0; top: 0; width: 100%; display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 8mm !important; padding: 8mm !important; }
        .label-card { break-inside: avoid; box-shadow: none !important; }
      }
    `}</style>
    <div className="provider-page mx-auto w-full max-w-7xl px-4 py-4 sm:px-8 sm:py-6" lang={locale === "zh" ? "zh-CN" : locale}>
      <header className="no-print mb-4 border-b border-grey-200 pb-4 sm:mb-5 sm:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-lg font-bold">{brand.name}</p><label className="flex items-center gap-2 text-sm font-semibold"><span className="sr-only">语言 / Idioma / Language</span><select aria-label="语言 / Idioma / Language" value={locale} onChange={event => setLocale(event.target.value as ProviderLocale)} className="min-h-11 rounded-lg border border-grey-300 bg-white px-3 text-ink"><option value="zh">简体中文</option><option value="es">Español</option><option value="en">English</option></select></label></div>
        <h1 className="mt-4 text-2xl font-bold leading-tight sm:mt-5 sm:text-4xl">{t("装箱单与商业发票", "Factura y packing list", "Invoice and packing list")}</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-grey-700">{t("填写货物资料，核对后提交。无需注册账号。", "Completa los datos de tu mercancía, revísalos y envíalos. No necesitas crear una cuenta.", "Enter your shipment details, review and send them. No account needed.")}</p>
      </header>
      {showPrintNotice && <section role="region" aria-label={t("打印前核对", "Antes de imprimir", "Before printing")} className="no-print mb-6 rounded-xl border border-grey-200 bg-white p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><StatusIcon tone="info" size={20}/>{t("请确认箱数和标签", "Revisa las cajas y sus etiquetas", "Check cartons and labels")}</h2><p className="mt-3 text-grey-700">{t("修改箱数或装箱内容后，请核对并重新打印受影响的标签。可以先打印现有标签。", "Si cambias las cajas o su contenido, revisa y vuelve a imprimir las etiquetas afectadas. Puedes imprimir las disponibles ahora.", "After changing cartons or contents, review and reprint affected labels. You can print the available labels now.")}</p><div className="mt-4 flex flex-wrap gap-3"><button autoFocus type="button" className="btn btn-primary" onClick={() => { setPrintNoticed(true); setShowPrintNotice(false); printDocument("labels"); }}>{t("继续打印", "Continuar e imprimir", "Continue and print")}</button><button type="button" className="btn btn-ghost" onClick={() => setShowPrintNotice(false)}>{t("返回核对", "Volver a revisar", "Back to review")}</button></div></section>}
      <div id="packing-list"><PackingListFormSection token={token} supplierName={supplierName} supplierWechat={supplierWechat} markbox={markbox} code={code} locale={locale} request={request} onPrintLabels={printLabels} excelHref={excelHref} attachments={<SupplierUploadSection token={token} locale={locale} request={request} showHeading={false} onUploadState={setUploads}/>} attachmentsSummary={<SupplierUploadSummary locale={locale} status={uploads}/>} delivery={delivery}/></div>
      {/* Las etiquetas se ven en pantalla, no sólo al imprimir: el proveedor tiene que
          poder cotejar los códigos antes de pegarlos, y en el navegador de WeChat
          `window.print()` a menudo no existe — dejarlas sólo para impresión lo dejaba
          sin ninguna vía a los códigos de sus cajas. El CSS de impresión las reformatea
          a dos columnas; el resto de la página se oculta con `visibility`. */}
      {labels.length > 0 && <section className="no-print mt-6" aria-labelledby="labels-heading">
        <h2 id="labels-heading" className="text-[15px] font-bold">{t("箱子标签", "Etiquetas de las cajas", "Carton labels")}</h2>
        <p className="mt-1.5 max-w-[52ch] text-[12.5px] leading-[1.55] text-grey-700">{t("每个箱子贴一张标签，贴在能看到的一面。", "Pega una etiqueta en cada caja, en una cara visible.", "Stick one label on each carton, on a visible side.")}</p>
      </section>}
      <div className="labels-print-area mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{labels.map(label => <ShippingBoxLabel key={label.boxN} label={label} markbox={markbox} brandName={brand.name} presentation={presentation}/>)}</div>
    </div>
  </div>;
}
