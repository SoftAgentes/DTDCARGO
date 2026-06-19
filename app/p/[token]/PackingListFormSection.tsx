"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/Icon";
import {
  PACKING_LIST_CURRENCIES,
  computeTotals,
  type PackingListCurrency,
  type PackingListRowInput,
} from "@/lib/studio/prealertas/packlist-form";

// Latin → Archivo (marca); CJK → Noto Sans SC (Archivo no trae hanzi). El
// proveedor lee chino → es crítico que el CJK caiga en Noto SC.
const BRAND_CJK = "var(--font-archivo), var(--font-noto-sc)";
// Mono + CJK: dígitos/códigos en mono tabular, hanzi en Noto SC.
const MONO_CJK =
  "var(--font-jetbrains-mono), var(--font-noto-sc), ui-monospace, monospace";

/** Hoy local (YYYY-MM-DD) para el <input type="date"> por default. */
function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function emptyRow(): PackingListRowInput {
  return {
    brand: "",
    code: "",
    zh: "",
    es: "",
    hs: "",
    carton: "",
    ctns: "",
    perctn: "",
    unit: "",
    wkg: "",
    cbm: "",
  };
}

// Formateadores (solo display de los computados + totales en vivo).
const fmtInt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtW = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmtCbm = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 });

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; folio: string | null; versionNo: number }
  | { kind: "error"; message: string };

type FieldErrors = Partial<Record<"contacto" | "rows" | "tooMany", string>>;

/**
 * SDD-0096 · Form online del packing list/factura que el proveedor llena y ENVÍA
 * desde /p/{token}. Bilingüe ZH/ES, estilo del sitio público (no los tokens del
 * Norte). Los computados por fila + los totales en vivo se derivan con
 * `computeTotals` (misma fuente que el server, que re-suma de forma autoritativa).
 * Submit → POST /p/{token}/packlist. Versionado: el proveedor puede corregir y
 * reenviar las veces que necesite.
 */
export function PackingListFormSection({
  token,
  supplierName,
  supplierWechat,
}: {
  token: string;
  supplierName?: string | null;
  supplierWechat?: string | null;
}) {
  const [company, setCompany] = useState(supplierName ?? "");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState(supplierWechat ?? "");
  const [phone, setPhone] = useState("");
  const [docDate, setDocDate] = useState(isoToday());
  const [currency, setCurrency] = useState<PackingListCurrency>("USD");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PackingListRowInput[]>(() => [
    emptyRow(),
    emptyRow(),
    emptyRow(),
  ]);

  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Al confirmar el envío, llevamos el foco/scroll al panel de éxito (queda
  // arriba, fuera de vista tras una tabla larga) para anunciarlo a todos.
  const okRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submit.kind === "ok" && okRef.current) {
      okRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      okRef.current.focus();
    }
  }, [submit.kind]);

  // Totales + computados por fila — fuente única `computeTotals` (no se evalúa
  // expresión acá; el server recomputa igual al recibir).
  const { rows: calcRows, totals } = useMemo(() => computeTotals(rows), [rows]);

  function setRow(i: number, field: keyof PackingListRowInput, value: string) {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }
  function addRows(n: number) {
    setRows((prev) => [...prev, ...Array.from({ length: n }, emptyRow)]);
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, k) => k !== i)));
  }

  async function handleSubmit() {
    setFieldErrors({});
    setSubmit({ kind: "sending" });
    try {
      const res = await fetch(`/p/${token}/packlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierCompany: company,
          supplierContact: contact,
          supplierEmail: email,
          supplierWechat: wechat,
          supplierPhone: phone,
          currency,
          docDate,
          supplierNote: note,
          rows,
          empresa_web: "", // honeypot — vacío para humanos.
        }),
      });

      let data: {
        ok?: boolean;
        folio?: string | null;
        versionNo?: number;
        error?: string;
        fieldErrors?: FieldErrors;
      } = {};
      try {
        data = await res.json();
      } catch {
        /* sin JSON (raro) → cae al mensaje genérico abajo */
      }

      if (res.ok && data.ok) {
        setSubmit({
          kind: "ok",
          folio: data.folio ?? null,
          versionNo: data.versionNo ?? 1,
        });
        return;
      }

      if (res.status === 400 && data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
        setSubmit({
          kind: "error",
          message:
            data.error ??
            "Revisa los datos del packing list. / 请检查装箱单的资料。",
        });
        return;
      }

      // 429 / 503 / 404 / otros → mensaje genérico bilingüe.
      setSubmit({
        kind: "error",
        message:
          data.error ??
          "No pudimos enviar tu packing list. Intenta de nuevo. / 提交失败，请稍后再试。",
      });
    } catch {
      setSubmit({
        kind: "error",
        message:
          "No pudimos conectar. Revisa tu conexión e intenta de nuevo. / 网络连接失败，请重试。",
      });
    }
  }

  const sending = submit.kind === "sending";

  return (
    <section
      className="no-print mt-3 bg-white border border-grey-200 rounded-[16px] p-6"
      style={{ fontFamily: BRAND_CJK }}
    >
      <div className="text-[15px] font-bold text-ink" lang="zh">
        在线填写装箱单 / 发票{" "}
        <span lang="es" className="text-grey-500 font-semibold">
          · Llenar el packing list online
        </span>
      </div>
      <p
        className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55] max-w-[58ch]"
        lang="zh"
      >
        填好货物明细并提交给我们；可多次修改并重新提交。
        <span lang="es" className="block text-grey-500 mt-1">
          Completa el detalle de la mercancía y envíalo. Puedes corregir y
          reenviar las veces que necesites.
        </span>
      </p>

      {submit.kind === "ok" ? (
        <div
          ref={okRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="mt-5 rounded-[12px] border border-grey-200 bg-grey-100 p-5 outline-none"
        >
          <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <CheckIcon size={16} />
            <span lang="zh">
              已提交 ·{" "}
              <span lang="es" className="font-semibold">
                Enviado
              </span>
            </span>
          </div>
          {submit.folio && (
            <div
              className="mt-2 text-[13px] text-grey-700"
              style={{ fontFamily: MONO_CJK }}
            >
              Folio: {submit.folio}
              {submit.versionNo > 1 ? ` · v${submit.versionNo}` : ""}
            </div>
          )}
          <p className="mt-2 text-[12.5px] text-grey-700 leading-[1.55]" lang="zh">
            可多次修改并重新提交
            <span lang="es" className="block text-grey-500 mt-1">
              Puedes corregir y reenviar las veces que necesites.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSubmit({ kind: "idle" })}
            className="btn btn-ghost mt-4"
          >
            修改 · Corregir / reenviar
          </button>
        </div>
      ) : (
        <>
          {/* Cabecera editable del documento */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <HeaderField
              id="pl-company"
              labelZh="公司名称 / 供应商"
              labelEs="Empresa / Proveedor"
              value={company}
              onChange={setCompany}
              placeholder="公司名称 / Nombre"
              autoComplete="organization"
            />
            <HeaderField
              id="pl-contact"
              labelZh="联系人"
              labelEs="Contacto"
              value={contact}
              onChange={setContact}
              placeholder="联系人 / Nombre"
              autoComplete="name"
            />
            <HeaderField
              id="pl-email"
              labelZh="邮箱"
              labelEs="Email"
              value={email}
              onChange={setEmail}
              placeholder="email@..."
              type="email"
              autoComplete="email"
            />
            <HeaderField
              id="pl-wechat"
              labelZh="微信"
              labelEs="WeChat"
              value={wechat}
              onChange={setWechat}
              placeholder="WeChat ID"
              autoComplete="off"
            />
            <HeaderField
              id="pl-phone"
              labelZh="电话"
              labelEs="Teléfono"
              value={phone}
              onChange={setPhone}
              placeholder="+86..."
              type="tel"
              autoComplete="tel"
              mono
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pl-date"
                className="text-[11px] font-semibold tracking-[0.04em] text-grey-500"
              >
                <span lang="zh">日期</span>
                <span lang="es"> · Fecha</span>
              </label>
              <input
                id="pl-date"
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="h-10 px-3 rounded-[8px] bg-white border border-grey-200 outline-none text-[13.5px] text-ink focus:border-wine"
                style={{ fontFamily: MONO_CJK }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pl-currency"
                className="text-[11px] font-semibold tracking-[0.04em] text-grey-500"
              >
                <span lang="zh">货币</span>
                <span lang="es"> · Moneda</span>
              </label>
              <select
                id="pl-currency"
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as PackingListCurrency)
                }
                className="h-10 px-3 rounded-[8px] bg-white border border-grey-200 outline-none text-[13.5px] font-semibold text-ink focus:border-wine"
                style={{ fontFamily: MONO_CJK }}
              >
                {PACKING_LIST_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de mercancía (scroll-x en móvil) */}
          <div className="mt-6 overflow-x-auto rounded-[12px] border border-grey-200">
            <table className="w-full border-collapse" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th zh="品牌" es="Marca" />
                  <Th zh="货号" es="Código" />
                  <Th zh="中文品名" es="Nombre 中文" />
                  <Th zh="英文品名" es="Nombre ES" />
                  <Th zh="材质 / HS" es="Material / HS" />
                  <Th zh="箱号" es="Nº caja" />
                  <Th zh="件数" es="Cajas" />
                  <Th zh="每箱装量" es="Uds/caja" />
                  <Th zh="总数量" es="Total uds" calc />
                  <Th zh="单价" es="P. unit" />
                  <Th zh="总金额" es="Total" calc />
                  <Th zh="每箱重" es="kg/caja" />
                  <Th zh="总重量" es="Peso" calc />
                  <Th zh="每箱体积" es="CBM/caja" />
                  <Th zh="总体积" es="CBM" calc />
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = calcRows[i];
                  return (
                    <tr key={i} className="row">
                      <td className="c-idx">{i + 1}</td>
                      <Td>
                        <CellInput
                          ariaLabel={`Marca, fila ${i + 1}`}
                          value={r.brand ?? ""}
                          onChange={(v) => setRow(i, "brand", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          mono
                          ariaLabel={`Código, fila ${i + 1}`}
                          value={r.code ?? ""}
                          onChange={(v) => setRow(i, "code", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          zh
                          ariaLabel={`Nombre 中文, fila ${i + 1}`}
                          value={r.zh ?? ""}
                          onChange={(v) => setRow(i, "zh", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          ariaLabel={`Nombre ES, fila ${i + 1}`}
                          value={r.es ?? ""}
                          onChange={(v) => setRow(i, "es", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          mono
                          ariaLabel={`Material / HS, fila ${i + 1}`}
                          value={r.hs ?? ""}
                          onChange={(v) => setRow(i, "hs", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`Nº caja, fila ${i + 1}`}
                          value={asStr(r.carton)}
                          onChange={(v) => setRow(i, "carton", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`Cajas, fila ${i + 1}`}
                          value={asStr(r.ctns)}
                          onChange={(v) => setRow(i, "ctns", v)}
                        />
                      </Td>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`Uds/caja, fila ${i + 1}`}
                          value={asStr(r.perctn)}
                          onChange={(v) => setRow(i, "perctn", v)}
                        />
                      </Td>
                      <CalcTd>{fmtInt(c?.qty ?? 0)}</CalcTd>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`P. unit, fila ${i + 1}`}
                          value={asStr(r.unit)}
                          onChange={(v) => setRow(i, "unit", v)}
                        />
                      </Td>
                      <CalcTd>{fmtMoney(c?.amount ?? 0)}</CalcTd>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`kg/caja, fila ${i + 1}`}
                          value={asStr(r.wkg)}
                          onChange={(v) => setRow(i, "wkg", v)}
                        />
                      </Td>
                      <CalcTd>{fmtW(c?.weight ?? 0)}</CalcTd>
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`CBM/caja, fila ${i + 1}`}
                          value={asStr(r.cbm)}
                          onChange={(v) => setRow(i, "cbm", v)}
                        />
                      </Td>
                      <CalcTd>{fmtCbm(c?.vol ?? 0)}</CalcTd>
                      <td className="c-del">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="rowdel"
                          aria-label={`Quitar fila ${i + 1} / 删除行`}
                          title="Quitar fila / 删除行"
                        >
                          <CloseIcon size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} className="tfoot-lab">
                    <span lang="zh">总计</span> · Totales
                  </td>
                  <td className="tfoot-v">{fmtInt(totals.ctns)}</td>
                  <td />
                  <td className="tfoot-v">{fmtInt(totals.qty)}</td>
                  <td className="tfoot-lab" style={{ textAlign: "right" }}>
                    {currency}
                  </td>
                  <td className="tfoot-v">{fmtMoney(totals.amount)}</td>
                  <td />
                  <td className="tfoot-v">{fmtW(totals.weight)} kg</td>
                  <td />
                  <td className="tfoot-v">{fmtCbm(totals.cbm)} m³</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Totales en vivo, sticky SOLO en móvil — la tabla scrollea en x y el
              tfoot queda fuera de vista mientras el proveedor llena. Fondo
              semi-opaco por legibilidad sobre el scroll (funcional, no deco). */}
          <div
            className="sm:hidden sticky bottom-0 z-10 -mx-6 mt-4 border-t border-grey-200 bg-white/95 px-6 py-2.5 backdrop-blur-sm"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-grey-700">
              <span lang="zh" className="font-semibold text-ink">
                总计 · Totales
              </span>
              <div
                className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-wine"
                style={{ fontFamily: MONO_CJK }}
              >
                <span>{fmtInt(totals.qty)} uds</span>
                <span>
                  {currency} {fmtMoney(totals.amount)}
                </span>
                <span>{fmtW(totals.weight)} kg</span>
                <span>{fmtCbm(totals.cbm)} m³</span>
              </div>
            </div>
          </div>

          {/* Agregar / quitar filas */}
          <div className="no-print mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addRows(1)}
              className="addbtn"
            >
              + 1 fila / 加一行
            </button>
            <button
              type="button"
              onClick={() => addRows(5)}
              className="addbtn"
            >
              + 5 filas / 加五行
            </button>
          </div>

          {/* Nota opcional */}
          <div className="mt-5 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.04em] text-grey-500">
              <span lang="zh">备注 (可选)</span>
              <span lang="es"> · Nota (opcional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="备注… / Observaciones…"
              className="px-3 py-2 rounded-[8px] bg-white border border-grey-200 outline-none text-[13px] text-ink leading-[1.5] focus:border-wine resize-y"
            />
          </div>

          {/* Errores + envío (anunciados a lectores de pantalla) */}
          <div role="status" aria-live="polite">
            {(fieldErrors.rows || fieldErrors.contacto || fieldErrors.tooMany) && (
              <ul className="mt-4 list-disc pl-5 text-[12.5px] leading-[1.55] text-wine">
                {fieldErrors.rows && <li>{fieldErrors.rows}</li>}
                {fieldErrors.contacto && <li>{fieldErrors.contacto}</li>}
                {fieldErrors.tooMany && <li>{fieldErrors.tooMany}</li>}
              </ul>
            )}
            {submit.kind === "error" &&
              !fieldErrors.rows &&
              !fieldErrors.contacto &&
              !fieldErrors.tooMany && (
                <p className="mt-4 text-[12.5px] leading-[1.55] text-wine">
                  {submit.message}
                </p>
              )}
          </div>

          {/* Honeypot: viaja en el body del POST (`empresa_web: ""`), no en el
              DOM — un input `aria-hidden` enfocable viola WCAG y traba lectores. */}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="btn btn-primary mt-5 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {sending ? "提交中… · Enviando…" : "提交 · Enviar a DTD"}
          </button>
        </>
      )}

      {/* Estilos de la tabla (clases locales, tokens de marca pública). */}
      <style>{`
        .row td { border-top: 1px solid var(--color-grey-200); }
        thead th {
          background: var(--color-grey-100);
          color: var(--color-ink);
          font: 700 9.5px/1.25 var(--font-archivo), system-ui, sans-serif;
          padding: 7px 5px;
          border-bottom: 1px solid var(--color-grey-200);
          text-align: center;
          vertical-align: middle;
        }
        thead th .th-zh { display: block; font-size: 10px; }
        thead th .th-es {
          display: block; font-size: 9px; font-weight: 600;
          color: var(--color-grey-500); text-transform: uppercase;
          letter-spacing: 0.02em; margin-top: 1px;
        }
        tbody td { padding: 0; height: 32px; }
        td.c-idx {
          width: 26px; text-align: center;
          font: 600 11px var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-grey-500); background: var(--color-grey-100);
        }
        td.calc {
          text-align: right; padding: 0 7px;
          font: 600 11.5px var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-ink); background: rgba(127,15,26,0.06); white-space: nowrap;
        }
        td.c-del { width: 40px; text-align: center; }
        .pl-cell {
          width: 100%; height: 100%; border: 0; outline: 0; background: transparent;
          font: 500 12px var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink); padding: 4px 7px;
        }
        .pl-cell:focus { background: rgba(127,15,26,0.06); }
        .pl-cell.mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .pl-cell.num { text-align: right; font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .pl-cell.zh { font-family: var(--font-noto-sc), 'Noto Sans SC', sans-serif; }
        .rowdel {
          appearance: none; cursor: pointer; border: 0; background: transparent;
          color: var(--color-grey-500); line-height: 1;
          display: inline-grid; place-items: center;
          min-width: 32px; min-height: 32px; border-radius: 8px;
          margin: 0 auto;
        }
        .rowdel:hover { color: var(--color-wine); background: rgba(127,15,26,0.06); }
        tfoot td {
          border-top: 1px solid var(--color-grey-200);
          font: 700 11.5px var(--font-jetbrains-mono), ui-monospace, monospace;
          padding: 8px 7px; background: var(--color-grey-100);
        }
        tfoot .tfoot-lab {
          text-align: right;
          font-family: var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink);
        }
        tfoot .tfoot-v { text-align: right; color: var(--color-wine); white-space: nowrap; }
        .addbtn {
          appearance: none; cursor: pointer;
          display: inline-flex; align-items: center;
          font: 600 12px/1 var(--font-archivo), system-ui, sans-serif;
          border: 1px dashed var(--color-grey-300); background: var(--color-white);
          color: var(--color-grey-700); border-radius: 8px;
          padding: 8px 14px; min-height: 32px;
        }
        .addbtn:hover { border-color: var(--color-wine); color: var(--color-wine); }

        /* Impresión: 1 página A4 horizontal, sin chrome ni columna de borrar. */
        @media print {
          .no-print { display: none !important; }
          td.c-del, .rowdel { display: none !important; }
          tbody td { height: 26px; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          td.calc { background: rgba(127,15,26,0.06) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pl-cell, td.calc, tfoot td { font-size: 10px; }
        }
      `}</style>
    </section>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────

function asStr(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}

function HeaderField({
  id,
  labelZh,
  labelEs,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  autoComplete,
}: {
  id: string;
  labelZh: string;
  labelEs: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold tracking-[0.04em] text-grey-500"
      >
        <span lang="zh">{labelZh}</span>
        <span lang="es"> · {labelEs}</span>
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-10 px-3 rounded-[8px] bg-white border border-grey-200 outline-none text-[13.5px] text-ink placeholder:text-grey-500 focus:border-wine"
        style={
          mono
            ? { fontFamily: MONO_CJK }
            : { fontFamily: BRAND_CJK }
        }
      />
    </div>
  );
}

function Th({
  zh,
  es,
  calc = false,
  children,
}: {
  zh?: string;
  es?: string;
  calc?: boolean;
  children?: React.ReactNode;
}) {
  if (children !== undefined) return <th>{children}</th>;
  return (
    <th>
      {zh && (
        <span className="th-zh" lang="zh">
          {zh}
        </span>
      )}
      {es && (
        <span className="th-es" lang="es">
          {es}
          {calc ? " ▸" : ""}
        </span>
      )}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td>{children}</td>;
}

function CalcTd({ children }: { children: React.ReactNode }) {
  return <td className="calc">{children}</td>;
}

function CellInput({
  value,
  onChange,
  ariaLabel,
  mono = false,
  num = false,
  zh = false,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  mono?: boolean;
  num?: boolean;
  zh?: boolean;
}) {
  const cls = ["pl-cell", mono && "mono", num && "num", zh && "zh"]
    .filter(Boolean)
    .join(" ");
  return (
    <input
      className={cls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      inputMode={num ? "decimal" : undefined}
      lang={zh ? "zh" : undefined}
    />
  );
}
