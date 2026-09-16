"use client";

import { useId, useRef, useState } from "react";
import { StatusIcon } from "@/components/StatusIcon";
import { computeTotals, type PackingListCurrency, type PackingListRowInput } from "@/lib/studio/prealertas/packlist-form";
import { formatProviderMoney, formatProviderNumber } from "./provider-format";
import type { ProviderLocale } from "./PackingListGuidedForm";

type Props = {
  locale: ProviderLocale; currency: PackingListCurrency; rows: PackingListRowInput[];
  setRow: (index: number, field: keyof PackingListRowInput, value: string) => void;
  addGroup: () => void; addProduct: (index: number) => void;
  removeProduct: (index: number) => void; removeGroup: (index: number) => void;
  error?: string;
};
const inputClass = "min-h-12 w-full min-w-0 rounded-lg border border-grey-300 bg-white px-3 py-2 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-wine-text disabled:opacity-60";
const actionClass = "min-h-11 min-w-11 rounded px-2 text-sm font-semibold underline underline-offset-4 hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-text disabled:opacity-60";
const invoiceGrid = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:gap-3";
const hasName = (row: PackingListRowInput) => [row.zh, row.es, row.brand].some(value => value?.trim());

/** Presentation only. Editing writes to the existing owner, so autosave and print
 * never lose a partially entered product. Acceptance folds a row; it does not POST. */
export function PackingListProductsStep(p: Props) {
  const t = (zh: string, es: string, en: string) => p.locale === "zh" ? zh : p.locale === "en" ? en : es;
  const [editor, setEditor] = useState<{ index: number; isNew: boolean } | null>(() => {
    const index = p.rows.findIndex(row => !hasName(row));
    return index < 0 ? null : { index, isNew: true };
  });
  const [nameError, setNameError] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const [notice, setNotice] = useState<"added" | "saved" | "removed" | null>(null);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const number = (value: number, decimals = 3) => formatProviderNumber(value, p.locale, decimals);
  const money = (value: number) => formatProviderMoney(value, p.currency, p.locale);
  const unitPrice = (value: number) => formatProviderMoney(value, p.currency, p.locale, 20);
  const groups: { lead: number; indices: number[] }[] = [];
  p.rows.forEach((row, index) => {
    if (!row.same || !groups.length) groups.push({ lead: index, indices: [index] });
    else groups[groups.length - 1].indices.push(index);
  });
  function focusName() {
    window.requestAnimationFrame(() => { nameInput.current?.focus({ preventScroll: true }); nameInput.current?.scrollIntoView?.({ block: "center" }); });
  }
  function open(index: number, isNew = false) {
    setEditor({ index, isNew }); setNameError(false); setNotice(null); focusName();
  }
  function save() {
    if (!editor) return;
    if (!hasName(p.rows[editor.index])) { setNameError(true); focusName(); return; }
    const index = editor.index;
    setNotice(editor.isNew ? "added" : "saved"); setNameError(false); setEditor(null);
    window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-edit-product="${index}"]`)?.focus());
  }
  function removeProduct(index: number) {
    p.removeProduct(index);
    setEditor(current => !current || current.index === index ? null : { ...current, index: current.index > index ? current.index - 1 : current.index });
    setNameError(false); setNotice("removed");
    window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[data-add-product]")?.focus());
  }
  function removeGroup(lead: number, indices: number[]) {
    p.removeGroup(lead); setRemove(null); setNameError(false); setNotice("removed");
    setEditor(current => {
      if (indices.length === p.rows.length) return { index: 0, isNew: true };
      if (!current || indices.includes(current.index)) return null;
      return { ...current, index: current.index > lead ? current.index - indices.length : current.index };
    });
    window.requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>("input")?.focus());
  }
  function confirmGroup(lead: number) {
    setRemove(lead);
    window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[data-confirm-group]")?.focus());
  }
  const rowField = (index: number, key: keyof PackingListRowInput, label: string, numeric = false, name = false) => <label className="grid min-w-0 content-start gap-2 text-sm font-semibold">
    <span>{label}</span><input ref={name ? nameInput : undefined} aria-label={`${label} · ${index + 1}`} className={inputClass} inputMode={numeric ? "decimal" : undefined} value={String(p.rows[index][key] ?? "")} placeholder={name ? t("例如：陶瓷杯", "Ej. tazas de cerámica", "e.g. ceramic cups") : undefined} aria-invalid={name && nameError || undefined} aria-describedby={name && nameError ? `${id}-name-error` : undefined} onChange={event => { p.setRow(index, key, event.target.value); if (name) setNameError(false); }} />
  </label>;
  const quantityText = (index: number) => {
    const row = computeTotals([p.rows[index]]).rows[0];
    if (p.rows[index].same) return `${number(row?.qty ?? 0)} ${t("件（整组总量）", "uds. en todo el grupo", "units in the whole group")}`;
    return `${number(row?.perctn ?? 0)} ${t("件/箱", "uds./caja", "units/carton")} × ${number(row?.ctns ?? 0)} ${t("箱", "cajas", "cartons")} = ${number(row?.qty ?? 0)} ${t("件", "uds.", "units")}`;
  };
  return <div ref={root}>
    <p className="mb-4 text-sm text-grey-700">{t("先填写箱组，再逐项保存产品。共享这些箱子的产品放在同一组。", "Completa las cajas y guarda cada producto. Los productos que comparten esas cajas van en el mismo grupo.", "Enter the cartons, then save each product. Products sharing those cartons belong in the same group.")}</p>
    {p.error && <p role="alert" className="mb-4 flex gap-2 text-grey-700"><StatusIcon tone="danger" size={20}/>{p.error}</p>}
    <p className="sr-only" role="status" aria-live="polite">{notice === "added" ? t("产品已加入清单。", "Producto agregado a la lista.", "Product added to the list.") : notice === "saved" ? t("产品已保存。", "Producto guardado.", "Product saved.") : notice === "removed" ? t("已从草稿中移除。", "Eliminado del borrador.", "Removed from the draft.") : ""}</p>
    <div className="grid gap-4">{groups.map((group, groupIndex) => {
      const groupTotals = computeTotals(group.indices.map(index => p.rows[index])).totals;
      const productCount = group.indices.filter(index => hasName(p.rows[index])).length;
      return <section key={group.lead} aria-label={`${t("箱组", "Grupo de cajas", "Carton group")} ${groupIndex + 1}`} className="min-w-0 rounded-xl border border-grey-300">
        <header className="rounded-t-xl bg-grey-100 px-4 pb-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">{t("箱组", "Grupo de cajas", "Carton group")} {groupIndex + 1}</h3><p className="text-xs text-grey-700">{productCount} {t("种产品", productCount === 1 ? "producto" : "productos", productCount === 1 ? "product" : "products")} · {number(groupTotals.ctns)} {t("箱", "cajas", "cartons")}</p></div><button type="button" className={actionClass} data-remove-group={group.lead} onClick={() => confirmGroup(group.lead)}>{t("删除组", "Eliminar grupo", "Remove group")}</button></div>
          {remove === group.lead && <div className="my-3 rounded-lg border border-grey-300 bg-white p-3" role="region" aria-label={t("确认删除组", "Confirmar eliminación del grupo", "Confirm group removal")}><p>{t("基础产品包含箱数和尺寸。删除它将删除整个箱组及所有产品。", "El producto base contiene los datos de las cajas. Al quitarlo se elimina este grupo con todos sus productos.", "The base product holds the carton details. Removing it removes this whole group and all its products.")}</p><div className="mt-2 flex flex-wrap gap-2"><button data-confirm-group className="btn btn-ghost" type="button" onClick={() => removeGroup(group.lead, group.indices)}>{t("确认删除", "Eliminar grupo completo", "Remove entire group")}</button><button className="btn btn-ghost" type="button" onClick={() => { setRemove(null); window.requestAnimationFrame(() => (root.current?.querySelector<HTMLButtonElement>(`[data-edit-product="${group.lead}"]`) ?? root.current?.querySelector<HTMLButtonElement>(`[data-remove-group="${group.lead}"]`))?.focus()); }}>{t("取消", "Cancelar", "Cancel")}</button></div></div>}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">{rowField(group.lead, "ctns", t("箱数", "Cajas", "Cartons"), true)}{rowField(group.lead, "wkg", t("kg/箱", "kg/caja", "kg/carton"), true)}{rowField(group.lead, "cbm", t("m³/箱", "m³/caja", "m³/carton"), true)}</div>
        </header>
        {group.indices.some(index => index !== editor?.index) && <>
          <div aria-hidden="true" className={`hidden border-y border-grey-200 px-4 py-2 text-xs font-semibold text-grey-700 ${invoiceGrid}`}><span>{t("产品", "Producto", "Product")}</span><span>{t("数量", "Cantidad", "Quantity")}</span><span>{t("单价", "P. unitario", "Unit price")}</span><span>{t("金额", "Importe", "Amount")}</span><span>{t("操作", "Acciones", "Actions")}</span></div>
          <ul aria-label={t("产品清单", "Productos del grupo", "Group products")} className="divide-y divide-grey-200">{group.indices.filter(index => index !== editor?.index).map(index => {
            const raw = p.rows[index]; const row = computeTotals([raw]).rows[0];
            const name = (p.locale === "zh" ? raw.zh || raw.es : raw.es || raw.zh) || raw.brand || t("尚未填写名称", "Sin nombre; pendiente", "Name missing; pending");
            return <li key={index} className={`min-w-0 px-4 py-3 ${invoiceGrid}`}>
              <div className="min-w-0"><p className="break-words font-semibold" lang={!raw.es && raw.zh ? "zh-CN" : undefined}>{name}</p><p className="mt-1 break-words text-xs text-grey-700">{t("货号", "Código de producto", "Product code")}: <span className="font-mono">{raw.code || "—"}</span></p><p className="mt-1 text-xs text-grey-700">{quantityText(index)}</p></div>
              <div className="mt-2 flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 tabular-nums md:contents"><p className="break-words text-sm md:mt-0"><span className="sr-only">{t("数量", "Cantidad", "Quantity")}: </span>{number(row?.qty ?? 0)} {t("件", "uds.", "units")}<span className="md:hidden"> × {unitPrice(row?.unit ?? 0)}</span></p><p className="hidden min-w-0 break-words text-sm md:block"><span className="sr-only">{t("单价", "P. unitario", "Unit price")}: </span>{unitPrice(row?.unit ?? 0)}</p><p className="min-w-0 break-words text-sm font-bold"><span className="sr-only">{t("金额", "Importe", "Amount")}: </span>{money(row?.amount ?? 0)}</p></div>
              <div className="mt-1 flex gap-1 md:-mt-3"><button type="button" data-edit-product={index} className={actionClass} aria-label={`${t("编辑", "Editar", "Edit")} ${name}`} aria-describedby={editor ? `${id}-finish-product` : undefined} disabled={editor !== null} onClick={() => open(index)}>{t("编辑", "Editar", "Edit")}</button><button type="button" className={actionClass} aria-label={`${t("移除", "Quitar", "Remove")} ${name}`} onClick={() => index === group.lead ? confirmGroup(group.lead) : removeProduct(index)}>{t("移除", "Quitar", "Remove")}</button></div>
            </li>;
          })}</ul>
        </>}
        {editor && group.indices.includes(editor.index) && <section aria-label={t("产品编辑器", "Editor del producto", "Product editor")} className="border-t border-grey-200 p-4" onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); save(); } }}>
          <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-bold">{editor.isNew ? t("新产品", "Nuevo producto", "New product") : t("编辑产品", "Editar producto", "Edit product")}</h4>{p.rows[editor.index].same && <button type="button" className={actionClass} onClick={() => removeProduct(editor.index)}>{t("移除产品", "Quitar producto", "Remove product")}</button>}</div>
          {nameError && <p id={`${id}-name-error`} role="alert" className="mb-3 flex gap-2 text-sm text-grey-700"><StatusIcon tone="danger" size={18}/>{t("请填写产品名称，可使用任一语言。", "Escribe el nombre del producto en cualquiera de los idiomas.", "Enter the product name in either language.")}</p>}
          <div className="grid gap-3 sm:grid-cols-2">{rowField(editor.index, p.locale === "zh" ? "zh" : "es", t("中文品名", "Nombre del producto", "Product name"), false, true)}{rowField(editor.index, "code", t("货号", "Código del producto", "Product code"))}<div className="grid grid-cols-2 gap-3 sm:col-span-2">{rowField(editor.index, p.rows[editor.index].same ? "qtyDirect" : "perctn", p.rows[editor.index].same ? t("整组总数量", "Unidades del grupo", "Units in group") : t("每箱装量", "Unidades por caja", "Units per carton"), true)}{rowField(editor.index, "unit", t("单价", "Precio unitario", "Unit price") + ` (${p.currency})`, true)}</div></div>
          <p className="mt-3 text-sm text-grey-700">{quantityText(editor.index)}{p.rows[editor.index].same && <> · {t("不乘箱数。", "No se multiplica por cajas.", "Not multiplied by cartons.")}</>}</p>
          <details className="mt-2"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t("品牌及其他资料", "Marca y más detalles", "Brand and more details")}</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{rowField(editor.index, "brand", t("品牌（无品牌填“无”）", "Marca (sin marca: ninguna)", "Brand (unbranded: none)"))}{rowField(editor.index, p.locale === "zh" ? "es" : "zh", t("西文品名（选填）", "Nombre en chino (opcional)", "Chinese name (optional)"))}{rowField(editor.index, "hs", t("材质 / HS（选填）", "Material / HS (opcional)", "Material / HS (optional)"))}{rowField(editor.index, "carton", t("箱号备注（选填）", "Referencia de cajas (opcional)", "Carton reference (optional)"))}</div><p className="mt-3 text-sm text-grey-700">{t("不知道 HS 编码时，请说明材质并联系仓库确认，不要猜测。", "Si desconoces el código HS, describe el material y pide confirmación al almacén; no inventes el código.", "If you do not know the HS code, describe the material and ask the warehouse to confirm it; do not guess.")}</p></details>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-grey-700">{t("此产品金额", "Importe del producto", "Product amount")}: <strong className="text-ink tabular-nums">{money(computeTotals([p.rows[editor.index]]).totals.amount)}</strong></p><button type="button" className="btn btn-primary min-h-12" onClick={save}>{t("保存产品", "Guardar producto", "Save product")}</button></div>
          <p id={`${id}-finish-product`} className="mt-2 text-xs text-grey-700">{t("保存当前产品后，可添加或编辑其他产品。", "Guarda este producto para agregar o editar otro.", "Save this product before adding or editing another.")}</p>
        </section>}
        <div className="border-t border-grey-200 px-4 py-2"><button type="button" data-add-product className={actionClass} aria-describedby={editor ? `${id}-finish-product` : undefined} disabled={editor !== null || p.rows.length >= 500} onClick={() => { const last = group.indices[group.indices.length - 1]; p.addProduct(last); open(last + 1, true); }}>{t("添加另一产品", "Agregar otro producto", "Add another product")}</button></div>
        <footer className="rounded-b-xl border-t border-grey-200 bg-grey-100 px-4 py-3 text-sm"><p className="font-semibold">{t("本组总计", "Total del grupo", "Group total")}</p><p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 tabular-nums"><span>{number(groupTotals.ctns)} {t("箱", "cajas", "cartons")}</span><span>· {number(groupTotals.qty)} {t("件", "uds.", "units")}</span><span>· {number(groupTotals.weight)} kg</span><span>· {number(groupTotals.cbm, 4)} m³</span><strong>· {money(groupTotals.amount)}</strong></p></footer>
      </section>;
    })}</div>
    <button type="button" className={`${actionClass} mt-3`} aria-describedby={editor ? `${id}-finish-product` : undefined} disabled={editor !== null || p.rows.length >= 500} onClick={() => { p.addGroup(); open(p.rows.length, true); }}>{t("添加另一组箱子", "Agregar otro grupo de cajas", "Add another group of cartons")}</button>
  </div>;
}
