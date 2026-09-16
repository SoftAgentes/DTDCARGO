"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatProviderMoney, formatProviderNumber } from "./provider-format";
import { PackingListProductsStep } from "./PackingListProductsStep";
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
export type GuidedFieldOrigin = "prefilled" | "draft" | "edited";
type Props = {
  locale: ProviderLocale; code?: string; mark: string; fields: GuidedFields;
  fieldOrigins: Partial<Record<keyof GuidedFields, GuidedFieldOrigin>>; draftRestored: boolean;
  onField: <K extends keyof GuidedFields>(key: K, value: GuidedFields[K]) => void;
  rows: PackingListRowInput[]; rowsRevision: number;
  setRow: (index: number, field: keyof PackingListRowInput, value: string) => void;
  addGroup: () => void; addProduct: (index: number) => void; removeProduct: (index: number) => void;
  removeGroup: (index: number) => void;
  submit: Submit; onSubmit: () => void; onEdit: () => void;
  errors: Partial<Record<"contacto" | "rows" | "tooMany", string>>;
  saveStatus: string; saveFailed: boolean; saveIsManual: boolean; onSave: () => void; history: PacklistHistEntry[]; onRestore: (entry: PacklistHistEntry) => void;
  standardDocument: ReactNode; onCaptureChange: () => void; attachments: ReactNode; attachmentsSummary: ReactNode; delivery: ReactNode; onPrintLabels: () => void; onPreview: () => void; excelHref: string;
};
const fieldClass = "min-h-12 w-full rounded-lg border border-grey-300 bg-white px-3 py-2 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-wine-text disabled:opacity-60";

/** Capture UI only: business state, local history and wire payload stay in the owner. */
export function PackingListGuidedForm(p: Props) {
  const number = (value: number, decimals = 3) => formatProviderNumber(value, p.locale, decimals);
  const money = (value: number) => formatProviderMoney(value, p.fields.currency, p.locale);
  const t = (zh: string, es: string, en: string) => providerText(p.locale, zh, es, en);
  const [step, setStep] = useState(0);
  const [standard, setStandard] = useState(false);
  const standardTitle = useRef<HTMLHeadingElement>(null);
  const filesTitle = useRef<HTMLHeadingElement>(null);
  const standardError = useRef<HTMLDivElement>(null);
  function changeCapture(next: boolean) {
    p.onCaptureChange();
    setStandard(next);
    window.requestAnimationFrame(() => (next ? standardTitle.current : title.current)?.focus({ preventScroll: true }));
  }
  const id = useId();
  const [reviewSentFiles, setReviewSentFiles] = useState(false);
  const [mode, setMode] = useState<"online" | "excel">("online");
  const [historyOpen, setHistoryOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const lastError = useRef(p.errors);
  const sending = p.submit.kind === "sending";
  const sent = p.submit.kind === "ok";
  const submitError = p.submit.kind === "error" ? p.submit.message : null;
  const { totals, rows: calculated } = computeTotals(p.rows);
  const steps = [t("供应商资料", "Datos del proveedor", "Supplier details"), t("箱子与产品", "Cajas y productos", "Cartons and products"), t("照片与附件", "Fotos y archivos", "Photos and files"), t("核对并提交", "Revisar y enviar", "Review and send")];
  function go(next: number) { setStep(next); window.requestAnimationFrame(() => { (standard ? standardTitle.current : title.current)?.focus({ preventScroll: true }); (standard ? standardTitle.current : title.current)?.scrollIntoView?.({ block: "start" }); }); }
  useEffect(() => {
    if (p.errors !== lastError.current && Object.keys(p.errors).length) {
      lastError.current = p.errors;
      if (standard) { window.requestAnimationFrame(() => standardError.current?.focus()); return; }
      queueMicrotask(() => { setStep(p.errors.contacto ? 0 : 1); window.requestAnimationFrame(() => title.current?.focus()); });
    }
  }, [p.errors, standard]);
  useEffect(() => { if (standard && submitError) standardError.current?.focus(); }, [standard, submitError]);
  useEffect(() => { if (sent) { success.current?.focus(); success.current?.scrollIntoView?.({ block: "center" }); } }, [sent]);
  const placeholders: Partial<Record<keyof GuidedFields, string>> = {
    company: t("例如：深圳 ABC 贸易公司", "Ej. Shenzhen ABC Trading", "e.g. Shenzhen ABC Trading"),
    wechat: t("例如：wechat_id 或 +86…", "Ej. wechat_id o +86…", "e.g. wechat_id or +86…"),
    email: t("例如：sales@example.com", "Ej. sales@example.com", "e.g. sales@example.com"),
    address: t("例如：深圳市福田区…", "Ej. calle, edificio y número", "e.g. street, building and number"),
    city: t("例如：深圳", "Ej. Shenzhen", "e.g. Shenzhen"),
    folio: t("例如：INV-001", "Ej. INV-001", "e.g. INV-001"),
  };
  const field = (key: keyof GuidedFields, label: string, type = "text", optional = false) => {
    const origin = String(p.fields[key]).trim() ? p.fieldOrigins[key] : undefined;
    const help = origin === "prefilled" ? t("已预填，可修改。", "Prellenado; puedes corregirlo", "Prefilled; you can edit it") : origin === "draft" ? t("已从此设备的草稿恢复。", "Restaurado del borrador de este dispositivo", "Restored from this device’s draft") : origin === "edited" ? t("已在此草稿中修改。", "Editado en este borrador", "Edited in this draft") : undefined;
    const invalid = key === "wechat" && !!p.errors.contacto;
    return <div className="grid content-start gap-1.5 text-sm text-ink">
      <label htmlFor={id + "-" + key} className="font-semibold">{label}{optional && <span className="ml-2 font-normal text-grey-700">{t("选填", "Opcional", "Optional")}</span>}</label>
      <input id={id + "-" + key} className={fieldClass} type={type} value={p.fields[key]} placeholder={placeholders[key]} aria-invalid={invalid || undefined} aria-describedby={[help ? id + "-" + key + "-origin" : "", invalid ? "guided-contact-error" : ""].filter(Boolean).join(" ") || undefined} onChange={event => p.onField(key, event.target.value as never)} />
      {help && <p id={id + "-" + key + "-origin"} className="text-xs leading-relaxed text-grey-700">{help}</p>}
    </div>;
  };
  const summary = <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
    <dt className="text-grey-700">{t("箱数", "Cajas", "Cartons")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.ctns)}</dd>
    <dt className="text-grey-700">{t("总数量", "Unidades", "Units")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.qty)}</dd>
    <dt className="text-grey-700">{t("总重量", "Peso", "Weight")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.weight)} kg</dd>
    <dt className="text-grey-700">{t("总体积", "Volumen", "Volume")}</dt><dd className="text-right font-semibold tabular-nums">{number(totals.cbm, 4)} m³</dd>
    <dt className="border-t border-grey-200 pt-3 font-bold">{t("总金额", "Importe", "Amount")}</dt><dd className="border-t border-grey-200 pt-3 text-right font-bold tabular-nums">{money(totals.amount)}</dd>
  </dl>;
  return <section className="provider-capture min-w-0 text-ink" lang={p.locale === "zh" ? "zh-CN" : p.locale} aria-label={t("装箱单与发票", "Factura y packing list", "Invoice and packing list")}>
    <div className="no-print mb-3">
      <div role="group" aria-label={t("填写方式", "Forma de llenar el documento", "How to fill the document")} className="grid grid-cols-2 gap-2 sm:inline-flex">
        <button type="button" disabled={sending} aria-pressed={!standard} className={"min-h-12 rounded-lg border px-3 py-2 text-sm font-semibold " + (!standard ? "border-wine-text bg-wine text-on-accent" : "border-grey-300 bg-white")} onClick={() => changeCapture(false)}>{t("分步填写", "Llenado guiado", "Guided entry")}</button>
        <button type="button" disabled={sending} aria-pressed={standard} className={"min-h-12 rounded-lg border px-3 py-2 text-sm font-semibold " + (standard ? "border-wine-text bg-wine text-on-accent" : "border-grey-300 bg-white")} onClick={() => changeCapture(true)}>{t("标准表格", "Formato estándar", "Standard format")}</button>
      </div>
      <p className="mt-2 text-xs text-grey-700">{t("两种方式使用同一份草稿，随时切换，无需重复填写。", "Ambas opciones usan el mismo borrador. Puedes cambiar sin volver a llenar.", "Both options use the same draft. Switch without entering your data again.")}</p>
    </div>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0 flex-1 py-2 text-sm text-grey-700" role={p.saveFailed ? "alert" : undefined}>
        <p className="font-semibold">{sent ? t("文件已提交", "Documento enviado", "Document sent") : p.draftRestored ? t("本地草稿已恢复 · 尚未提交", "Borrador local restaurado · aún no enviado", "Local draft restored · not sent yet") : t("本地草稿 · 尚未提交", "Borrador local · aún no enviado", "Local draft · not sent yet")}</p>
        {p.saveStatus && <p className="mt-1 flex items-start gap-2">{p.saveFailed && <StatusIcon tone="danger" size={16}/>}<span>{p.saveStatus}</span></p>}
      </div>
      <details className="min-w-0 rounded-lg border border-grey-200 bg-white px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t("草稿与工具", "Borrador y herramientas", "Draft and tools")}</summary><div className="flex flex-wrap gap-2 pb-3 pt-1">
        <button className="btn btn-ghost" type="button" onClick={p.onSave} disabled={sending}>{t("保存草稿", "Guardar borrador", "Save draft")}</button>
        <button className="btn btn-ghost" type="button" onClick={p.onPreview}>{t("查看文件", "Ver documento", "View document")}</button>
        <button className="btn btn-ghost" type="button" aria-expanded={historyOpen} disabled={sending} onClick={() => setHistoryOpen(!historyOpen)}>{t("历史版本", "Historial", "History")}</button>
      </div></details>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" aria-label={t("草稿通知", "Avisos del borrador", "Draft notifications")} className="sr-only">{p.saveIsManual && !p.saveFailed ? p.saveStatus : ""}</p>
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
      <div className="mt-4 border-t border-grey-200 pt-3">{p.attachmentsSummary}<button type="button" className="min-h-11 text-sm font-semibold underline underline-offset-4" aria-expanded={reviewSentFiles} onClick={() => setReviewSentFiles(!reviewSentFiles)}>{t("查看附件", "Revisar archivos", "Review files")}</button></div>
    </div> : <>
      <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-b border-grey-200 text-sm">
        <p className="text-grey-700">{mode === "online" ? t("更喜欢 Excel？", "¿Prefieres Excel?", "Prefer Excel?") : t("正在使用 Excel", "Estás usando Excel", "Using Excel")}</p>
        <button type="button" className="min-h-11 rounded px-2 font-semibold underline underline-offset-4" onClick={() => setMode(mode === "online" ? "excel" : "online")} disabled={sending}>{mode === "online" ? t("使用 Excel", "Usar Excel", "Use Excel") : t("返回在线填写", "Volver al formulario", "Back to the form")}</button>
      </div>
      {!standard && mode === "online" && <nav className="mb-3 sm:mb-4" aria-label={t("填写步骤", "Pasos del documento", "Document steps")}><ol className="grid grid-cols-4 gap-2">{steps.map((label, index) => <li key={index}><button className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border p-1.5 text-left text-sm font-semibold sm:min-h-12 sm:justify-start sm:px-3 ${step === index ? "border-wine-text bg-white text-ink" : "border-grey-200 bg-paper text-grey-700 hover:bg-grey-100"}`} type="button" aria-label={`${index + 1} ${label}`} aria-current={step === index ? "step" : undefined} onClick={() => go(index)} disabled={sending}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${step === index ? "bg-wine text-on-accent" : "border border-grey-300"}`}>{index + 1}</span><span className="hidden sm:inline">{label}</span></button></li>)}</ol></nav>}
    </>}
    <div hidden={!standard || sent || mode !== "online"} className="pl-print-only min-w-0">
      <div className="no-print mb-3">
        <h2 ref={standardTitle} tabIndex={-1} className="text-2xl font-bold outline-none">{t("标准表格", "Formato estándar", "Standard format")}</h2>
        <p className="mt-2 text-sm text-grey-700">{t("直接填写表格，合计自动计算。手机可左右滑动产品表；也可以使用分步填写。", "Llena la hoja directamente; los totales se calculan solos. En el teléfono puedes desplazar la tabla o usar el llenado guiado.", "Fill the sheet directly; totals calculate automatically. On a phone, scroll the table or use guided entry.")}</p>
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn btn-ghost" onClick={() => { filesTitle.current?.focus(); filesTitle.current?.scrollIntoView?.({block:"start"}); }}>{t("照片与附件", "Fotos y archivos", "Photos and files")}</button><button type="button" className="btn btn-ghost" onClick={p.onPrintLabels}>{t("打印标签", "Imprimir etiquetas", "Print labels")}</button><button type="button" className="btn btn-ghost" onClick={() => printDocument("packing-list")}>{t("打印文件 / PDF", "Imprimir documento / PDF", "Print document / PDF")}</button></div>
        {standard && p.submit.kind === "error" && <div ref={standardError} tabIndex={-1} role="alert" className="mt-3 rounded-lg border border-status-danger p-3"><p>{p.submit.message}</p>{Object.values(p.errors).map(error => <p key={error} className="mt-2">{error}</p>)}</div>}
      </div>
      {p.standardDocument}
    </div>
    <div className={"no-print grid items-start gap-4 " + (standard ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]")}>
      <div className="min-w-0">
        <div hidden={sent && !reviewSentFiles} className="rounded-xl border border-grey-200 bg-white p-4 sm:p-5">
          {!standard && !sent && mode === "online" && <>
          <p className="text-sm font-semibold text-grey-700">{t("第", "Paso", "Step")} {step + 1} / 4</p>
          <h2 ref={title} tabIndex={-1} className="mt-1 text-2xl font-bold outline-none">{steps[step]}{step === 2 && <>{" "}<span className="text-base font-normal text-grey-700"> · {t("选填", "Opcional", "Optional")}</span></>}</h2>
          {p.submit.kind === "error" && <div role="alert" className="mt-4 rounded-lg border border-status-danger p-4 text-grey-700"><p className="flex items-start gap-2"><StatusIcon tone="danger" size={20}/>{p.submit.message}</p></div>}
          <fieldset disabled={sending} className="mt-4 min-w-0">
          {step === 0 && <>
            <p className="mb-4 text-grey-700">{t("请至少留下一个联系方式。", "Deja al menos un contacto para verificar la mercancía.", "Leave a contact to check the goods with you.")}</p>
            {p.errors.contacto && <p className="mb-4 flex gap-2 text-grey-700" id="guided-contact-error"><StatusIcon tone="danger" size={20}/>{p.errors.contacto}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("company", t("公司 / 姓名", "Empresa / Persona", "Company / Person"))}
              <label className="grid gap-2 text-sm font-semibold"><span>{t("币种", "Moneda", "Currency")}</span><select className={fieldClass} value={p.fields.currency} onChange={event => p.onField("currency", event.target.value as PackingListCurrency)}>{PACKING_LIST_CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
              {field("wechat", t("微信 / 电话", "WeChat / Teléfono", "WeChat / Phone"))}
              {field("email", t("邮箱", "Email", "Email"), "email")}
            </div>
            <details className="mt-4 border-t border-grey-200 pt-3"><summary className="min-h-11 cursor-pointer font-semibold">{t("地址、日期和文件信息", "Dirección, fecha y datos del documento", "Address, date and document details")}</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{field("address", t("供应商地址", "Dirección del proveedor", "Supplier address"), "text", true)}{field("city", t("城市", "Ciudad", "City"), "text", true)}{field("docDate", t("日期", "Fecha", "Date"), "date")}{field("folio", t("供应商文件编号", "Referencia propia del documento", "Your document reference"), "text", true)}<label className="grid gap-2 text-sm font-semibold"><span>{t("打印文件的第二语言", "Segundo idioma del documento impreso", "Second language of printed document")}</span><select className={fieldClass} value={p.fields.lang} onChange={event => p.onField("lang", event.target.value as "es" | "en")}><option value="es">中文 + Español</option><option value="en">中文 + English</option></select></label></div></details>
          </>}
          {step === 3 && <div className="grid gap-6">
            <p className="text-grey-700">{t("请核对资料。确认后，文件会发送给 DTD。", "Revisa los datos. Al confirmar, el documento se enviará a DTD.", "Review the details. Confirming sends the document to DTD.")}</p>
            <section><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{steps[0]}</h3><button type="button" className="btn btn-ghost" onClick={() => go(0)}>{t("修改资料", "Editar datos", "Edit details")}</button></div><p>{p.fields.company || "—"}</p><p className="break-words text-grey-700">{[p.fields.wechat, p.fields.email].filter(Boolean).join(" · ") || t("尚未填写联系方式", "Falta un contacto", "Contact missing")}</p></section>
            <section className="border-t border-grey-200 pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{steps[1]}</h3><button type="button" className="btn btn-ghost" onClick={() => go(1)}>{t("修改产品", "Editar productos", "Edit products")}</button></div>{calculated.length ? <ul className="divide-y divide-grey-200">{calculated.map((row, index) => <li key={index} className="flex flex-wrap justify-between gap-2 py-3"><span className="min-w-0 break-words">{row.zh || row.es || row.brand || "—"}{row.same ? ` · ${t("同箱产品", "Mismas cajas", "Same cartons")}` : ""}</span><span className="tabular-nums">{number(row.qty)} {t("件", "uds.", "units")} · {money(row.amount)}</span></li>)}</ul> : <p>{t("尚未添加产品。", "Todavía no hay productos.", "No products yet.")}</p>}</section>
            <section className="border-t border-grey-200 pt-3" aria-label={steps[2]}><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{steps[2]}</h3><button type="button" className="min-h-11 rounded px-2 text-sm font-semibold underline underline-offset-4" onClick={() => go(2)}>{t("查看", "Revisar", "Review")}</button></div>{p.attachmentsSummary}</section>
            <label className="grid gap-2 text-sm font-semibold"><span>{t("备注（选填）", "Observaciones (opcional)", "Notes (optional)")}</span><textarea rows={3} className={fieldClass} value={p.fields.note} onChange={event => p.onField("note", event.target.value)} /></label>
            <button type="button" className="btn btn-ghost justify-self-start" onClick={() => printDocument("packing-list")}>{t("打印文件 / PDF", "Imprimir documento / PDF", "Print document / PDF")}</button>
          </div>}
          </fieldset>
          </>}
        <fieldset hidden={standard || sent || mode !== "online" || step !== 1} disabled={sending} className="min-w-0"><PackingListProductsStep key={p.rowsRevision} locale={p.locale} currency={p.fields.currency} rows={p.rows} setRow={p.setRow} addGroup={p.addGroup} addProduct={p.addProduct} removeProduct={p.removeProduct} removeGroup={p.removeGroup} error={p.errors.rows || p.errors.tooMany}/></fieldset>
        {!sent && mode === "excel" && <section><h2 className="text-2xl font-bold">{t("下载、填写并上传 Excel", "Descarga, completa y sube el Excel", "Download, complete and upload Excel")}</h2><p className="mt-3 text-grey-700">{t("填写白色单元格，合计自动计算。上传后 DTD 会收到文件；它不会自动导入在线表格。无需再在线填写。", "Llena las celdas blancas; los totales se calculan solos. DTD recibirá el archivo: no se importa automáticamente al formulario. No necesitas llenar el formulario también.", "Fill the white cells; totals calculate automatically. DTD receives the file; it is not imported into the online form. You do not need to fill the form too.")}</p><a href={p.excelHref} download className="btn btn-primary mt-5">{t("下载 Excel", "Descargar Excel", "Download Excel")}</a></section>}
        {/* Keep uploads mounted: step navigation must preserve File objects and receipt state. */}
        <div hidden={!standard && !sent && mode === "online" && step !== 2} className={!sent && mode === "excel" ? "mt-4 border-t border-grey-200 pt-4" : "mt-3"}>{standard && <h2 ref={filesTitle} tabIndex={-1} className="mb-3 text-xl font-bold outline-none">{t("照片与附件", "Fotos y archivos", "Photos and files")} <span className="text-base font-normal text-grey-700">· {t("选填", "Opcional", "Optional")}</span></h2>}{p.attachments}</div>
        </div>
        {!standard && !sent && mode === "online" && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-grey-200 pt-4"><button className="btn btn-ghost" type="button" disabled={step === 0 || sending} onClick={() => go(step - 1)}>{t("上一步", "Anterior", "Back")}</button>{step < 3 ? <button className="btn btn-primary" type="button" onClick={() => go(step + 1)} disabled={sending}>{t("下一步", "Continuar", "Continue")}</button> : <button className="btn btn-primary" type="button" onClick={p.onSubmit} disabled={sending}>{sending ? t("正在提交…", "Enviando…", "Sending…") : t("提交文件给 DTD", "Enviar documento a DTD", "Send document to DTD")}</button>}</div>}
      </div>
      {standard && !sent && mode === "online" && <div className="rounded-xl border border-grey-200 bg-white p-4"><p className="mb-3 text-sm text-grey-700">{t("请检查表格。提交将把在线文件发送给 DTD；附件单独上传。", "Revisa la hoja. Este botón envía el documento online a DTD; los archivos se cargan por separado.", "Review the sheet. This sends the online document to DTD; files are uploaded separately.")}</p><button type="button" className="btn btn-primary" disabled={sending} onClick={p.onSubmit}>{sending ? t("正在提交…", "Enviando…", "Sending…") : t("提交文件给 DTD", "Enviar documento a DTD", "Send document to DTD")}</button></div>}
      <aside hidden={standard} className="min-w-0 rounded-xl border border-grey-200 bg-white p-4 lg:sticky lg:top-6">
        <section className="hidden lg:block"><h2 className="mb-3 font-bold">{t("本次货物", "Resumen de la mercancía", "Shipment summary")}</h2>{summary}</section>
        <details className="lg:hidden"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold"><span className="min-w-0">{number(totals.ctns)} {t("箱", "cajas", "cartons")} · {number(totals.qty)} {t("件", "uds.", "units")} · {money(totals.amount)}</span><span aria-hidden="true">⌄</span></summary><div className="pt-3">{summary}</div></details>
        {mode === "excel" && <p className="mt-3 text-sm text-grey-700">{t("这些是在线表格中的数据，不包括 Excel 文件。", "Estos son los datos del formulario; no incluyen el archivo Excel.", "These are the form totals; they do not include the Excel file.")}</p>}
        <section className="mt-3 border-t border-grey-200 pt-3"><p className="text-sm text-grey-700">Shipping Mark · 唛头</p><p className="mt-1 break-all font-mono text-xl font-bold">{p.mark}</p><div className="mt-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm text-grey-700">{t("订单参考号", "Referencia de compra", "Purchase reference")}</p><p className="mt-1 break-all font-mono font-semibold">{p.code}</p></div><button className="min-h-11 rounded px-2 text-sm font-semibold underline underline-offset-4" type="button" onClick={p.onPrintLabels}>{t("打印标签", "Imprimir etiquetas", "Print labels")}</button></div><p className="mt-2 text-sm text-grey-700">{t("请勿更改唛头。每箱贴一张标签。", "Conserva este Shipping Mark. Pega una etiqueta en cada caja.", "Keep this Shipping Mark. Attach one label to every carton.")}</p></section>
      </aside>
    </div>
    <div hidden={standard && !sent && mode === "online"} className="mt-5">{p.delivery}</div>
    <style>{"@media print { .provider-capture > :not(.pl-print-only) { display:none !important; } .provider-capture > .pl-print-only { display:block !important; } }"}</style>
  </section>;
}
