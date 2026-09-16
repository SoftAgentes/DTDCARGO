"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";
import { PACKING_LIST_CURRENCIES, computeTotals, type PackingListCurrency, type PackingListRowInput } from "@/lib/studio/prealertas/packlist-form";
import { printDocument } from "@/lib/shared/print-document";
import type { PacklistHistEntry } from "@/lib/studio/prealertas/packlist-draft";

export type ProviderLocale = "zh" | "es" | "en";
export function providerText(locale: ProviderLocale, zh: string, es: string, en: string) {
  return locale === "zh" ? zh : locale === "en" ? en : es;
}
export type GuidedFields = {
  company: string; email: string; wechat: string; address: string; city: string;
  folio: string; docDate: string; currency: PackingListCurrency; note: string; lang: "es" | "en";
};
type Submit = { kind: "idle" | "sending" } | { kind: "error"; message: string } | { kind: "ok"; folio: string | null; versionNo: number; labelsNeedReview?: boolean };
type Props = {
  locale: ProviderLocale; code?: string; mark: string; fields: GuidedFields;
  onField: <K extends keyof GuidedFields>(key: K, value: GuidedFields[K]) => void;
  rows: PackingListRowInput[];
  setRow: (index: number, field: keyof PackingListRowInput, value: string) => void;
  addGroup: () => void; addProduct: (index: number) => void; removeProduct: (index: number) => void;
  removeGroup: (index: number) => void;
  submit: Submit; onSubmit: () => void; onEdit: () => void;
  errors: Partial<Record<"contacto" | "rows" | "tooMany", string>>;
  saveStatus: string; saveFailed: boolean; onSave: () => void; history: PacklistHistEntry[]; onRestore: (entry: PacklistHistEntry) => void;
  attachments: ReactNode; delivery: ReactNode; onPrintLabels: () => void; onPreview: () => void; excelHref: string;
};
const fieldClass = "min-h-12 w-full rounded-lg border border-grey-300 bg-white px-3 py-2 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-wine-text disabled:opacity-60";
const number = (value: number, decimals = 3) => value.toLocaleString("en-US", { maximumFractionDigits: decimals });

/** Capture UI only: business state, local history and wire payload stay in the owner. */
export function PackingListGuidedForm(p: Props) {
  const t = (zh: string, es: string, en: string) => providerText(p.locale, zh, es, en);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"online" | "excel">("online");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const lastError = useRef(p.errors);
  const sending = p.submit.kind === "sending";
  const sent = p.submit.kind === "ok";
  const { totals, rows: calculated } = computeTotals(p.rows);
  const steps = [t("供应商资料", "Datos del proveedor", "Supplier details"), t("箱子与产品", "Cajas y productos", "Cartons and products"), t("照片与附件", "Fotos y archivos", "Photos and files"), t("核对并提交", "Revisar y enviar", "Review and send")];
  const groups: { lead: number; indices: number[] }[] = [];
  p.rows.forEach((row, index) => {
    if (!row.same || !groups.length) groups.push({ lead: index, indices: [index] });
    else groups[groups.length - 1].indices.push(index);
  });
  function go(next: number) { setStep(next); window.requestAnimationFrame(() => { title.current?.focus({ preventScroll: true }); title.current?.scrollIntoView?.({ block: "start" }); }); }
  useEffect(() => {
    if (p.errors !== lastError.current && Object.keys(p.errors).length) {
      lastError.current = p.errors;
      queueMicrotask(() => { setStep(p.errors.contacto ? 0 : 1); window.requestAnimationFrame(() => title.current?.focus()); });
    }
  }, [p.errors]);
  useEffect(() => { if (sent) { success.current?.focus(); success.current?.scrollIntoView?.({ block: "center" }); } }, [sent]);
  const field = (key: keyof GuidedFields, label: string, type = "text", optional = false) => <label className="grid gap-2 text-sm font-semibold text-ink">
    <span>{label}{optional && <span className="ml-2 font-normal text-grey-700">{t("选填", "Opcional", "Optional")}</span>}</span>
    <input className={fieldClass} type={type} value={p.fields[key]} onChange={event => p.onField(key, event.target.value as never)} />
  </label>;
  const rowField = (index: number, key: keyof PackingListRowInput, label: string, numeric = false) => <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
    <span>{label}</span><input aria-label={`${label} · ${index + 1}`} className={fieldClass} inputMode={numeric ? "decimal" : undefined} value={String(p.rows[index][key] ?? "")} onChange={event => p.setRow(index, key, event.target.value)} />
  </label>;
  const summary = <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
    <dt className="text-grey-700">{t("箱数", "Cajas", "Cartons")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.ctns)}</dd>
    <dt className="text-grey-700">{t("总数量", "Unidades", "Units")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.qty)}</dd>
    <dt className="text-grey-700">{t("总重量", "Peso", "Weight")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.weight)} kg</dd>
    <dt className="text-grey-700">{t("总体积", "Volumen", "Volume")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.cbm, 4)} m³</dd>
    <dt className="border-t border-grey-200 pt-3 font-bold">{t("总金额", "Importe", "Amount")}</dt><dd className="border-t border-grey-200 pt-3 text-right font-bold tabular-nums">{p.fields.currency} {totals.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
  </dl>;
  return <section className="no-print text-ink" lang={p.locale === "zh" ? "zh-CN" : p.locale} aria-label={t("装箱单与发票", "Factura y packing list", "Invoice and packing list")}>
    {p.saveFailed && <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-status-danger bg-white p-4 text-grey-700"><StatusIcon tone="danger" size={20}/>{p.saveStatus}</p>}
    <details className="mb-4 rounded-lg border border-grey-200 bg-white px-4"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t("草稿与文件工具", "Borrador y herramientas", "Draft and document tools")}</summary><div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-2">
      {!p.saveFailed && <p role="status" className="max-w-prose text-sm text-grey-700">{p.saveStatus || t("草稿仅保存在此设备；提交后才会发送给 DTD。", "El borrador se guarda en este dispositivo. Se envía a DTD al finalizar.", "The draft stays on this device. Send it to DTD when ready.")}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" type="button" onClick={p.onSave} disabled={sending}>{t("保存草稿", "Guardar borrador", "Save draft")}</button>
        <button className="btn btn-ghost" type="button" onClick={p.onPreview}>{t("查看文件", "Ver documento", "View document")}</button>
        <button className="btn btn-ghost" type="button" aria-expanded={historyOpen} disabled={sending} onClick={() => setHistoryOpen(!historyOpen)}>{t("历史版本", "Historial", "History")}</button>
      </div>
    </div>
    </details>
    {historyOpen && <section className="mb-6 rounded-xl border border-grey-200 bg-white p-4" aria-label={t("本地历史版本", "Historial local", "Local history")}>
      <h2 className="font-bold">{t("此设备上的草稿版本", "Versiones del borrador en este dispositivo", "Draft versions on this device")}</h2>
      {p.history.length === 0 ? <p className="mt-2 text-grey-700">{t("暂无已保存版本。", "Todavía no hay versiones guardadas.", "No saved versions yet.")}</p> : <ul>{p.history.map((entry, index) => <li key={`${entry.t}-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-200 py-3"><span>{new Date(entry.t).toLocaleString(p.locale === "zh" ? "zh-CN" : p.locale)} {entry.label}</span><button className="btn btn-ghost" type="button" disabled={sending} onClick={() => { p.onEdit(); p.onRestore(entry); setHistoryOpen(false); go(0); }}>{t("恢复", "Restaurar", "Restore")}</button></li>)}</ul>}
    </section>}
    {sent ? <div ref={success} tabIndex={-1} role="status" className="mb-6 rounded-xl border border-grey-200 bg-white p-6 outline-none">
      <div className="flex items-center gap-3"><CheckIcon size={24}/><h2 className="text-2xl font-bold">{t("文件已提交", "Documento enviado", "Document sent")}</h2></div>
      <p className="mt-3 font-mono">{t("编号", "Folio", "Reference")}: {p.submit.kind === "ok" && (p.submit.folio || "—")} · {t("版本", "Versión", "Version")} {p.submit.kind === "ok" && p.submit.versionNo}</p>
      <p className="mt-3 text-grey-700">{t("请打印标签，每箱贴一张，再按下方地址送货。附件有独立的上传状态。", "Imprime las etiquetas, pega una en cada caja y entrega en la dirección indicada. Los adjuntos tienen su propio estado de carga.", "Print the labels, attach one to every carton and deliver to the address below. Attachments have their own upload status.")}</p>
      {p.submit.kind === "ok" && p.submit.labelsNeedReview && <p className="mt-4 flex gap-2 text-grey-700"><StatusIcon tone="warning" size={20}/>{t("箱数与现有标签不同，请联系仓库核对。", "Las cajas no coinciden con las etiquetas actuales. Contacta al almacén para revisarlas.", "Carton count differs from the current labels. Contact the warehouse to review them.")}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button className="btn btn-primary" type="button" onClick={p.onPrintLabels}>{t("打印标签", "Imprimir etiquetas", "Print labels")}</button><button className="btn btn-ghost" type="button" onClick={() => printDocument("packing-list")}>{t("打印文件 / PDF", "Imprimir documento / PDF", "Print document / PDF")}</button><button className="btn btn-ghost" type="button" onClick={() => { p.onEdit(); go(0); }}>{t("修改并重新提交", "Corregir y reenviar", "Edit and resend")}</button></div>
    </div> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-grey-200 pb-3 sm:mb-6 sm:gap-4 sm:rounded-xl sm:border sm:bg-white sm:p-4">
        <div><p className="hidden font-semibold sm:block">{mode === "online" ? t("在线填写", "Completar en línea", "Complete online") : t("使用 Excel", "Completar con Excel", "Complete with Excel")}</p><p className="mt-1 text-sm text-grey-700">{t("也可以用 Excel 填写。", "También puedes usar Excel.", "You can also use Excel.")}</p></div>
        <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === "online" ? "excel" : "online")} disabled={sending}>{mode === "online" ? t("使用 Excel", "Usar Excel", "Use Excel") : t("返回在线填写", "Volver al formulario", "Back to the form")}</button>
      </div>
      {mode === "online" && <nav className="mb-4 sm:mb-6" aria-label={t("填写步骤", "Pasos del documento", "Document steps")}><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((label, index) => <li key={index}><button className={`flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold ${step === index ? "border-wine-text bg-white text-ink" : "border-grey-200 bg-paper text-grey-700 hover:bg-grey-100"}`} type="button" aria-label={`${index + 1} ${label}`} aria-current={step === index ? "step" : undefined} onClick={() => go(index)} disabled={sending}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${step === index ? "bg-wine text-on-accent" : "border border-grey-300"}`}>{index + 1}</span>{label}</button></li>)}</ol></nav>}
    </>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="min-w-0">
        {!sent && mode === "online" && <div className="rounded-xl border border-grey-200 bg-white p-4 sm:p-6">
          <p className="text-sm font-semibold text-grey-700">{t("第", "Paso", "Step")} {step + 1} / 4</p>
          <h2 ref={title} tabIndex={-1} className="mt-2 text-2xl font-bold outline-none">{steps[step]}</h2>
          {p.submit.kind === "error" && <div role="alert" className="mt-4 rounded-lg border border-status-danger p-4 text-grey-700"><p className="flex items-start gap-2"><StatusIcon tone="danger" size={20}/>{p.submit.message}</p></div>}
          <fieldset disabled={sending} className="mt-4 min-w-0 sm:mt-6">
          {step === 0 && <>
            <p className="mb-5 text-grey-700">{t("请至少留下一个联系方式。", "Deja al menos un contacto para verificar la mercancía.", "Leave a contact to check the goods with you.")}</p>
            {p.errors.contacto && <p className="mb-4 flex gap-2 text-grey-700" id="guided-contact-error"><StatusIcon tone="danger" size={20}/>{p.errors.contacto}</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("company", t("公司 / 姓名", "Empresa / Persona", "Company / Person"))}
              <label className="grid gap-2 text-sm font-semibold"><span>{t("币种", "Moneda", "Currency")}</span><select className={fieldClass} value={p.fields.currency} onChange={event => p.onField("currency", event.target.value as PackingListCurrency)}>{PACKING_LIST_CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-semibold"><span>{t("微信 / 电话", "WeChat / Teléfono", "WeChat / Phone")}</span><input className={fieldClass} value={p.fields.wechat} aria-invalid={!!p.errors.contacto} aria-describedby={p.errors.contacto ? "guided-contact-error" : undefined} onChange={event => p.onField("wechat", event.target.value)} /></label>
              {field("email", t("邮箱", "Email", "Email"), "email")}
            </div>
            <details className="mt-6 border-t border-grey-200 pt-4"><summary className="min-h-11 cursor-pointer font-semibold">{t("地址、日期和文件信息", "Dirección, fecha y datos del documento", "Address, date and document details")}</summary><div className="mt-3 grid gap-5 sm:grid-cols-2">{field("address", t("供应商地址", "Dirección del proveedor", "Supplier address"), "text", true)}{field("city", t("城市", "Ciudad", "City"), "text", true)}{field("docDate", t("日期", "Fecha", "Date"), "date")}{field("folio", t("供应商文件编号", "Referencia propia del documento", "Your document reference"), "text", true)}<label className="grid gap-2 text-sm font-semibold"><span>{t("打印文件的第二语言", "Segundo idioma del documento impreso", "Second language of printed document")}</span><select className={fieldClass} value={p.fields.lang} onChange={event => p.onField("lang", event.target.value as "es" | "en")}><option value="es">中文 + Español</option><option value="en">中文 + English</option></select></label></div></details>
          </>}
          {step === 1 && <>
            <p className="mb-5 text-grey-700">{t("每组填写包装相同的箱子。一个箱子有多种产品？把产品加在同一组。", "Agrupa las cajas que tienen el mismo contenido. Si comparten varios productos, agrégalos dentro del mismo grupo.", "Group cartons with the same contents. Add any products sharing those cartons within the same group.")}</p>
            {(p.errors.rows || p.errors.tooMany) && <p role="alert" className="mb-4 flex gap-2 text-grey-700"><StatusIcon tone="danger" size={20}/>{p.errors.rows || p.errors.tooMany}</p>}
            <div className="grid gap-6">{groups.map((group, groupIndex) => <section key={group.lead} className="min-w-0 rounded-xl border border-grey-300" aria-label={`${t("箱组", "Grupo de cajas", "Carton group")} ${groupIndex + 1}`}>
              <div className="rounded-t-xl bg-grey-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{t("箱组", "Grupo de cajas", "Carton group")} {groupIndex + 1}</h3><button type="button" className="min-h-11 rounded px-2 text-sm underline underline-offset-4 hover:bg-white" onClick={() => setRemove(group.lead)}>{t("删除组", "Eliminar grupo", "Remove group")}</button></div>
              {remove === group.lead && <div className="my-3 rounded-lg border border-grey-300 bg-white p-3"><p>{t("删除此组及其中所有产品？", "¿Eliminar este grupo y todos sus productos?", "Remove this group and all its products?")}</p><div className="mt-2 flex flex-wrap gap-3"><button className="btn btn-ghost" type="button" onClick={() => { p.removeGroup(group.lead); setRemove(null); }}>{t("确认删除", "Eliminar grupo completo", "Remove entire group")}</button><button className="btn btn-ghost" type="button" onClick={() => setRemove(null)}>{t("取消", "Cancelar", "Cancel")}</button></div></div>}
              <div className="mt-3 grid gap-4 sm:grid-cols-3">{rowField(group.lead, "ctns", t("箱数", "Cantidad de cajas", "Number of cartons"), true)}{rowField(group.lead, "wkg", t("每箱重量 (kg)", "Peso por caja (kg)", "Weight per carton (kg)"), true)}{rowField(group.lead, "cbm", t("每箱体积 (m³)", "Volumen por caja (m³)", "Volume per carton (m³)"), true)}</div></div>
              <div className="divide-y divide-grey-200">{group.indices.map((index, productIndex) => <div key={index} className="p-4">
                <div className="mb-4 flex items-center justify-between gap-2"><h4 className="text-sm font-bold">{t("产品", "Producto", "Product")} {productIndex + 1}</h4>{productIndex > 0 && <button type="button" className="min-h-11 rounded px-2 text-sm underline underline-offset-4 hover:bg-grey-100" onClick={() => p.removeProduct(index)}>{t("移除产品", "Quitar producto", "Remove product")}</button>}</div>
                <div className="grid gap-4 sm:grid-cols-2">{rowField(index, p.locale === "zh" ? "zh" : "es", t("中文品名", "Nombre del producto", "Product name"))}{rowField(index, p.rows[index].same ? "qtyDirect" : "perctn", p.rows[index].same ? t("此产品在整组中的总数量", "Unidades de este producto en todo el grupo", "Total units of this product in the group") : t("每箱装量", "Unidades por caja", "Units per carton"), true)}{rowField(index, "unit", `${t("单价", "Precio por unidad", "Unit price")} (${p.fields.currency})`, true)}</div>
                {p.rows[index].same && <p className="mt-3 text-sm text-grey-700">{t("这是整组总数量，不会再乘箱数。重量和体积只在组里计算一次。", "Esta cantidad es el total del grupo: no se multiplica por cajas. Peso y volumen se cuentan una sola vez.", "This is the total for the group; it is not multiplied by cartons. Weight and volume are counted once.")}</p>}
                <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{t("品牌、货号及其他资料", "Marca, código y más detalles", "Brand, code and more details")}</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{rowField(index, "brand", t("品牌（无品牌填“无”）", "Marca (sin marca: ninguna)", "Brand (unbranded: none)"))}{rowField(index, "code", t("货号", "Código del producto", "Product code"))}{rowField(index, p.locale === "zh" ? "es" : "zh", t("西文品名（选填）", "Nombre en chino (opcional)", "Chinese name (optional)"))}{rowField(index, "hs", t("材质 / HS（选填）", "Material / HS (opcional)", "Material / HS (optional)"))}{rowField(index, "carton", t("箱号备注（选填）", "Referencia de cajas (opcional)", "Carton reference (optional)"))}</div><p className="mt-3 text-sm font-normal text-grey-700">{t("不知道 HS 编码时，请说明材质并联系仓库确认，不要猜测。", "Si desconoces el código HS, describe el material y pide confirmación al almacén; no inventes el código.", "If you do not know the HS code, describe the material and ask the warehouse to confirm it; do not guess.")}</p></details>
              </div>)}</div>
              <div className="border-t border-grey-200 p-4"><button type="button" className="btn btn-ghost w-full" onClick={() => p.addProduct(group.indices[group.indices.length - 1])} disabled={p.rows.length >= 500}>{t("在这些箱子中添加产品", "Agregar otro producto en estas cajas", "Add another product in these cartons")}</button></div>
            </section>)}</div>
            <button className="btn btn-ghost mt-5 w-full" type="button" onClick={p.addGroup} disabled={p.rows.length >= 500}>{t("添加另一组箱子", "Agregar otro grupo de cajas", "Add another group of cartons")}</button>
          </>}
          {step === 2 && <p className="text-grey-700">{t("可选：添加产品照片或 DTD 要求的原始文件。附件单独上传，不会替你提交装箱单。", "Opcional: agrega fotos del producto o documentos que DTD te haya solicitado. Subir archivos no envía el packing list.", "Optional: add product photos or documents requested by DTD. Uploading files does not send the packing list.")}</p>}
          {step === 3 && <div className="grid gap-6">
            <p className="text-grey-700">{t("请核对资料。确认后，文件会发送给 DTD。", "Revisa los datos. Al confirmar, el documento se enviará a DTD.", "Review the details. Confirming sends the document to DTD.")}</p>
            <section><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{steps[0]}</h3><button type="button" className="btn btn-ghost" onClick={() => go(0)}>{t("修改资料", "Editar datos", "Edit details")}</button></div><p>{p.fields.company || "—"}</p><p className="break-words text-grey-700">{[p.fields.wechat, p.fields.email].filter(Boolean).join(" · ") || t("尚未填写联系方式", "Falta un contacto", "Contact missing")}</p></section>
            <section className="border-t border-grey-200 pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{steps[1]}</h3><button type="button" className="btn btn-ghost" onClick={() => go(1)}>{t("修改产品", "Editar productos", "Edit products")}</button></div>{calculated.length ? <ul className="divide-y divide-grey-200">{calculated.map((row, index) => <li key={index} className="flex flex-wrap justify-between gap-2 py-3"><span className="min-w-0 break-words">{row.zh || row.es || row.brand || "—"}{row.same ? ` · ${t("同箱产品", "Mismas cajas", "Same cartons")}` : ""}</span><span className="tabular-nums">{number(row.qty)} {t("件", "uds.", "units")} · {p.fields.currency} {number(row.amount, 2)}</span></li>)}</ul> : <p>{t("尚未添加产品。", "Todavía no hay productos.", "No products yet.")}</p>}</section>
            <div className="border-t border-grey-200 pt-4"><button type="button" className="btn btn-ghost" onClick={() => go(2)}>{t("查看照片与附件", "Revisar fotos y archivos", "Review photos and files")}</button></div>
            <label className="grid gap-2 text-sm font-semibold"><span>{t("备注（选填）", "Observaciones (opcional)", "Notes (optional)")}</span><textarea rows={3} className={fieldClass} value={p.fields.note} onChange={event => p.onField("note", event.target.value)} /></label>
            <button type="button" className="btn btn-ghost justify-self-start" onClick={() => printDocument("packing-list")}>{t("打印文件 / PDF", "Imprimir documento / PDF", "Print document / PDF")}</button>
          </div>}
          </fieldset>
        </div>}
        {!sent && mode === "excel" && <section className="rounded-xl border border-grey-200 bg-white p-6"><h2 className="text-2xl font-bold">{t("下载、填写并上传 Excel", "Descarga, completa y sube el Excel", "Download, complete and upload Excel")}</h2><p className="mt-3 text-grey-700">{t("填写白色单元格，合计自动计算。上传后 DTD 会收到文件；它不会自动导入在线表格。无需再在线填写。", "Llena las celdas blancas; los totales se calculan solos. DTD recibirá el archivo: no se importa automáticamente al formulario. No necesitas llenar el formulario también.", "Fill the white cells; totals calculate automatically. DTD receives the file; it is not imported into the online form. You do not need to fill the form too.")}</p><a href={p.excelHref} download className="btn btn-primary mt-5">{t("下载 Excel", "Descargar Excel", "Download Excel")}</a></section>}
        {/* Keep uploads mounted: step navigation must preserve File objects and receipt state. */}
        <div hidden={!sent && mode === "online" && step !== 2 && step !== 3} className="mt-6">{p.attachments}</div>
        {!sent && mode === "online" && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-grey-200 pt-5"><button className="btn btn-ghost" type="button" disabled={step === 0 || sending} onClick={() => go(step - 1)}>{t("上一步", "Anterior", "Back")}</button>{step < 3 ? <button className="btn btn-primary" type="button" onClick={() => go(step + 1)} disabled={sending}>{t("下一步", "Continuar", "Continue")}</button> : <button className="btn btn-primary" type="button" onClick={p.onSubmit} disabled={sending}>{sending ? t("正在提交…", "Enviando…", "Sending…") : t("提交文件给 DTD", "Enviar documento a DTD", "Send document to DTD")}</button>}</div>}
      </div>
      <aside className="grid min-w-0 gap-4 lg:sticky lg:top-6">
        <section className="rounded-xl border border-grey-200 bg-white p-5"><h2 className="mb-4 font-bold">{t("本次货物", "Resumen de la mercancía", "Shipment summary")}</h2>{summary}<p className="mt-4 text-sm text-grey-700">{mode === "excel" ? t("这些是在线表格中的数据，不包括 Excel 文件。", "Estos son los datos del formulario; no incluyen el archivo Excel.", "These are the form totals; they do not include the Excel file.") : t("根据填写内容自动计算。", "Se calcula con los datos del formulario.", "Calculated from the form entries.")}</p></section>
        <section className="rounded-xl border border-grey-200 bg-paper p-5"><p className="text-sm text-grey-700">Shipping Mark · 唛头</p><p className="mt-1 break-all font-mono text-xl font-bold">{p.mark}</p><p className="mt-4 text-sm text-grey-700">{t("订单参考号", "Referencia de compra", "Purchase reference")}</p><p className="mt-1 break-all font-mono font-semibold">{p.code}</p><p className="mt-4 text-sm text-grey-700">{t("请勿更改唛头。每箱贴一张标签。", "Conserva este Shipping Mark. Pega una etiqueta en cada caja.", "Keep this Shipping Mark. Attach one label to every carton.")}</p><button className="btn btn-ghost mt-3 w-full" type="button" onClick={p.onPrintLabels}>{t("打印标签", "Imprimir etiquetas", "Print labels")}</button></section>
      </aside>
    </div>
    <div className="mt-8">{p.delivery}</div>
  </section>;
}
