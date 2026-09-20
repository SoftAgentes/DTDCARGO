"use client";

import { useEffect, useRef } from "react";
import { CONTACT } from "@/lib/design-tokens";
import { computeTotals, type PackingListRowInput } from "@/lib/studio/prealertas/packlist-form";
import { printDocument } from "@/lib/shared/print-document";
import { providerText, type GuidedFields, type ProviderLocale } from "./PackingListGuidedForm";

/** Read-only document view. Printing uses the full, always-mounted original print surface. */
export function PackingListDocumentPreview({ fields, rows, mark, code, locale, onClose }: {
  fields: GuidedFields; rows: PackingListRowInput[]; mark: string; code?: string; locale: ProviderLocale; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const t = (zh: string, es: string, en: string) => providerText(locale, zh, es, en);
  const bi = (zh: string, es: string, en: string) => `${zh} · ${fields.lang === "es" ? es : en}`;
  const calculated = computeTotals(rows);
  const headers = [bi("品名", "Producto", "Product"), bi("品牌 / 货号", "Marca / Código", "Brand / Code"), bi("箱数", "Cajas", "Cartons"), bi("数量", "Unidades", "Units"), bi("单价", "Precio", "Price"), bi("金额", "Importe", "Amount"), bi("重量", "Peso kg", "Weight kg"), bi("体积", "Volumen m³", "Volume m³")];
  return <dialog ref={dialog} onCancel={onClose} className="no-print m-auto max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl border border-grey-300 bg-white p-0 text-ink backdrop:bg-ink/50" aria-labelledby="packing-document-preview-title">
    <header className="sticky top-0 flex flex-wrap items-center justify-between gap-3 border-b border-grey-200 bg-white p-4"><h2 id="packing-document-preview-title" className="text-lg font-bold">{t("文件预览（只读）", "Vista del documento (solo lectura)", "Document preview (read only)")}</h2><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-primary" onClick={() => printDocument("packing-list")}>{t("打印 / PDF", "Imprimir / PDF", "Print / PDF")}</button><button autoFocus type="button" className="btn btn-ghost" onClick={onClose}>{t("返回", "Volver", "Back")}</button></div></header>
    <article className="p-4 sm:p-8"><p lang="zh-CN" className="font-bold">{CONTACT.cn.companyCjk} · DTD Cargo</p><h3 className="mt-3 text-2xl font-bold" lang="zh-CN">{bi("装箱单 + 商业发票", "Packing list + Factura", "Packing list + Invoice")}</h3><p className="mt-2 text-grey-700">{CONTACT.cn.addressCjk}</p><dl className="my-6 grid gap-4 sm:grid-cols-2">
      <div><dt className="text-sm text-grey-700">{bi("供应商", "Proveedor", "Supplier")}</dt><dd className="font-semibold">{fields.company || "—"}</dd><dd>{[fields.wechat, fields.email].filter(Boolean).join(" · ") || "—"}</dd><dd>{[fields.address, fields.city].filter(Boolean).join(" · ")}</dd></div>
      <div><dt className="text-sm text-grey-700">Shipping Mark · 唛头</dt><dd className="font-mono font-bold">{mark}</dd><dd className="font-mono">{code}</dd><dd>{bi("日期", "Fecha", "Date")}: {fields.docDate} · {fields.currency}</dd><dd>{bi("编号", "Referencia", "Reference")}: {fields.folio || "—"}</dd></div>
    </dl>
    <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={t("文件中的产品表", "Tabla de productos del documento", "Document product table")}><table className="w-full min-w-[48rem] border-collapse text-left text-sm"><thead className="bg-grey-100"><tr>{headers.map(header => <th className="border border-grey-300 p-3" key={header}>{header}</th>)}</tr></thead><tbody>{calculated.rows.map((row, index) => <tr key={index}><td className="border border-grey-300 p-3"><span lang="zh-CN">{row.zh}</span><span className="block">{row.es}</span><span className="mt-2 block text-grey-700">{bi("材质 / HS", "Material / HS", "Material / HS")}: {row.hs || "—"}</span><span className="block text-grey-700">{bi("箱号", "Referencia de cajas", "Carton reference")}: {row.carton || "—"}</span>{!row.same && <span className="block text-grey-700">{bi("每箱", "Por caja", "Per carton")}: {row.perctn} {bi("件", "uds.", "units")} · {row.wkg} kg · {row.cbm} m³</span>}{row.same && <span className="text-grey-700">{bi("同箱", "Mismas cajas", "Same cartons")}</span>}</td>{[`${row.brand} ${row.code}`, row.same ? "—" : row.ctns, row.qty, String(row.unit), row.amount.toFixed(2), row.same ? "—" : row.weight, row.same ? "—" : row.vol].map((value, cell) => <td key={cell} className="border border-grey-300 p-3 tabular-nums">{value}</td>)}</tr>)}</tbody><tfoot><tr className="bg-grey-100 font-bold"><td colSpan={2} className="border border-grey-300 p-3">{bi("合计", "Totales", "Totals")}</td>{[calculated.totals.ctns, calculated.totals.qty, "—", calculated.totals.amount.toFixed(2), calculated.totals.weight, calculated.totals.cbm].map((value, index) => <td key={index} className="border border-grey-300 p-3">{value}</td>)}</tr></tfoot></table></div>
    {fields.note && <p className="mt-6 whitespace-pre-wrap">{bi("备注", "Observaciones", "Notes")}: {fields.note}</p>}<p className="mt-6 text-sm text-grey-700">{t("此视图展示当前草稿。打印不会提交文件。", "Esta vista muestra el borrador actual. Imprimir no envía el documento.", "This view shows the current draft. Printing does not send the document.")}</p></article>
  </dialog>;
}
