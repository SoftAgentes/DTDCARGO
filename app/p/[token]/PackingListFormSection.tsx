"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CloseIcon, DownloadIcon } from "@/components/Icon";
import { CONTACT } from "@/lib/design-tokens";
import {
  PACKING_LIST_CURRENCIES,
  computeTotals,
  type PackingListCurrency,
  type PackingListRowInput,
} from "@/lib/studio/prealertas/packlist-form";
import {
  packlistDraftKey,
  packlistHistoryKey,
  pushHistory,
  type PacklistHistEntry,
} from "@/lib/studio/prealertas/packlist-draft";

// Latin → Archivo (marca); CJK → Noto Sans SC (Archivo no trae hanzi). El
// proveedor lee chino → es crítico que el CJK caiga en Noto SC.
const BRAND_CJK = "var(--font-archivo), var(--font-noto-sc)";
// Mono + CJK: dígitos/códigos en mono tabular, hanzi en Noto SC.
const MONO_CJK =
  "var(--font-jetbrains-mono), var(--font-noto-sc), ui-monospace, monospace";

// ── i18n: ZH SIEMPRE visible; la columna latina togglea ES/EN. Default es. ──
type Lang = "es" | "en";

/** Hoy local (YYYY-MM-DD) para el <input type="date"> por default. */
function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Fecha en formato chino 年/月/日 (portado de packlist.js · renderDateCN). */
function renderDateCN(iso: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length !== 3) return "";
  return `${+p[0]}年${+p[1]}月${+p[2]}日`;
}

// ── Reglas de ingreso a bodega (método nuevo, SIN grupo WeChat) · trilingüe.
// rule.contact → renderiza la línea de contacto (吴小姐 · tel · WeChat). ──
const WAREHOUSE_RULES: {
  zh: string;
  es: string;
  en: string;
  contact?: boolean;
}[] = [
  {
    zh: "每个箱子写客户唛头；缺唛头会延误出口。",
    es: "Marca cada caja con el Shipping Mark del cliente. Sin él, esto generará retraso en la exportación.",
    en: "Mark every carton with the client's Shipping Mark. Without it, the export will be delayed.",
  },
  {
    zh: "发货前填写本单，随货发送，或在你的 DTD 链接上传。",
    es: "Llena este documento antes de enviar y mándalo con la carga, o súbelo en tu link de DTD.",
    en: "Fill this document before shipping and send it with the cargo, or upload it on your DTD link.",
  },
  {
    zh: "在你的 DTD 链接上传公司原始单据：商业发票和装箱单原件。",
    es: "Sube a tu link de DTD los documentos originales de tu empresa: tu factura comercial y tu packing list originales.",
    en: "Upload your company's original documents to your DTD link: your original commercial invoice and packing list.",
  },
  {
    zh: '品牌货请如实填写品牌名；否则填"无"。',
    es: 'Si la mercancía es de marca, declara la marca real; si no, escribe "无 / ninguna". Ocultar la marca es riesgo en aduana a cargo del proveedor.',
    en: 'If the goods are branded, declare the real brand; otherwise write "无 / none". Hiding the brand is a customs risk borne by the supplier.',
  },
  {
    zh: "卸货由供应商安排并承担费用。",
    es: "La descarga la organiza y paga el proveedor (si la hace nuestra bodega, se cobra por volumen/peso).",
    en: "Unloading is arranged and paid by the supplier (if our warehouse does it, it's charged by volume/weight).",
  },
  {
    zh: "违禁品、危险品禁止入仓。",
    es: "Prohibido enviar mercancía peligrosa o restringida.",
    en: "Hazardous or restricted goods are prohibited.",
  },
  {
    zh: "中国联系人（如有疑问）：",
    es: "Contacto en China (dudas):",
    en: "Contact in China (questions):",
    contact: true,
  },
];

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

/** Marca de tiempo corta para el estado de autoguardado / historial. */
function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; folio: string | null; versionNo: number }
  | { kind: "error"; message: string };

type FieldErrors = Partial<Record<"contacto" | "rows" | "tooMany", string>>;

// ── Borrador persistido en localStorage (POR TOKEN, no global) ──────────
type Draft = {
  folio: string;
  company: string;
  email: string;
  wechat: string;
  address: string;
  city: string;
  mark: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  docDate: string;
  currency: PackingListCurrency;
  note: string;
  lang: Lang;
  rows: PackingListRowInput[];
};

type HistEntry = PacklistHistEntry;

/**
 * SDD-0097 (extiende SDD-0096) · Editor del packing list/factura v4.4 que el
 * proveedor llena y ENVÍA desde /p/{token}. Documento completo (identidad de la
 * bodega CN + SUPPLIER/CLIENT con todos los campos + tabla de mercancía +
 * totales en vivo) con autoguardado + historial en localStorage POR TOKEN y
 * trilingüe EN/ES/ZH (ZH siempre visible, la columna latina togglea ES/EN).
 *
 * Estilo del sitio público (Archivo + var(--color-*)), no los tokens del Norte.
 * Los computados por fila + totales se derivan con `computeTotals` (misma fuente
 * que el route POST, que re-suma de forma autoritativa). Los campos nuevos
 * (dirección/ciudad del proveedor, fecha, folio, datos del cliente) enriquecen
 * el DOCUMENTO + el borrador local; el SUBMIT mantiene su payload de SDD-0096.
 */
export function PackingListFormSection({
  token,
  supplierName,
  supplierWechat,
  markbox,
  clientName,
}: {
  token: string;
  supplierName?: string | null;
  supplierWechat?: string | null;
  markbox?: string | null;
  clientName?: string | null;
}) {
  const cn = CONTACT.cn;

  const [lang, setLang] = useState<Lang>("es");

  // Header / folio + SUPPLIER.
  const [folio, setFolio] = useState("");
  const [company, setCompany] = useState(supplierName ?? "");
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState(supplierWechat ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  // CLIENT — el 唛头 (mark) viene prefilled de la orden.
  const [mark, setMark] = useState(markbox ?? "DTD-");
  const [client, setClient] = useState(clientName ?? "");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
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

  // Caja Padre (SDD-0097): líderes con su grupo EXPANDIDO. Default colapsado;
  // al agregar un hijo expandimos su líder para que el proveedor lo vea.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  // Autoguardado / historial. `tone`: "steady" para el autoguardado pasivo
  // (gris, no llama la atención); "pulse" (wine) SOLO para acciones manuales
  // ("Versión guardada / restaurada").
  const [saveStatus, setSaveStatus] = useState<{
    text: string;
    tone: "steady" | "pulse";
  }>({ text: "", tone: "steady" });
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [copiedWh, setCopiedWh] = useState(false);
  // Bandera: ya restauramos (o decidimos no restaurar) el borrador. Antes de
  // esto NO autoguardamos para no pisar lo guardado con los defaults iniciales.
  const hydrated = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Snapshot serializable del estado actual (para localStorage + historial).
  const draft = useMemo<Draft>(
    () => ({
      folio,
      company,
      email,
      wechat,
      address,
      city,
      mark,
      clientName: client,
      clientPhone,
      clientEmail,
      docDate,
      currency,
      note,
      lang,
      rows,
    }),
    [
      folio,
      company,
      email,
      wechat,
      address,
      city,
      mark,
      client,
      clientPhone,
      clientEmail,
      docDate,
      currency,
      note,
      lang,
      rows,
    ],
  );

  const applyDraft = useCallback((d: Partial<Draft>) => {
    if (typeof d.folio === "string") setFolio(d.folio);
    if (typeof d.company === "string") setCompany(d.company);
    if (typeof d.email === "string") setEmail(d.email);
    if (typeof d.wechat === "string") setWechat(d.wechat);
    if (typeof d.address === "string") setAddress(d.address);
    if (typeof d.city === "string") setCity(d.city);
    if (typeof d.mark === "string") setMark(d.mark);
    if (typeof d.clientName === "string") setClient(d.clientName);
    if (typeof d.clientPhone === "string") setClientPhone(d.clientPhone);
    if (typeof d.clientEmail === "string") setClientEmail(d.clientEmail);
    if (typeof d.docDate === "string") setDocDate(d.docDate);
    if (d.currency === "USD" || d.currency === "RMB" || d.currency === "EUR")
      setCurrency(d.currency);
    if (typeof d.note === "string") setNote(d.note);
    if (d.lang === "es" || d.lang === "en") setLang(d.lang);
    if (Array.isArray(d.rows) && d.rows.length > 0) setRows(d.rows);
  }, []);

  // ── Montaje: restaurar el borrador de ESTE token (precede al prefill) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(packlistDraftKey(token));
      if (raw) applyDraft(JSON.parse(raw) as Partial<Draft>);
      const h = localStorage.getItem(packlistHistoryKey(token));
      if (h) setHistory(JSON.parse(h) as HistEntry[]);
    } catch {
      /* localStorage no disponible / corrupto → seguimos con el prefill */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Autosave debounced (al editar) + cada ~8s ──────────────────────────
  const persist = useCallback(() => {
    try {
      localStorage.setItem(packlistDraftKey(token), JSON.stringify(draft));
      setSaveStatus({
        text: `${tr(lang, "Autoguardado", "Autosaved")} · 已保存 ${fmtTs(Date.now())}`,
        tone: "steady",
      });
    } catch {
      /* cuota llena / modo privado → el form sigue usable en memoria */
    }
  }, [token, draft, lang]);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(persist, 600); // debounce al editar
    return () => window.clearTimeout(id);
  }, [persist]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (hydrated.current) persist();
    }, 8000);
    return () => window.clearInterval(id);
  }, [persist]);

  // ── Historial (snapshots, cap 12) ──────────────────────────────────────
  const snapshot = useCallback(
    (label: string) => {
      try {
        const data = JSON.stringify(draft);
        setHistory((prev) => {
          const next = pushHistory(prev, { t: Date.now(), label, data });
          if (next === prev) return prev; // sin cambios → no toca localStorage
          try {
            localStorage.setItem(packlistHistoryKey(token), JSON.stringify(next));
          } catch {
            /* sin persistencia → al menos queda en memoria de la sesión */
          }
          return next;
        });
      } catch {
        /* serialización imposible (raro) → ignorar */
      }
    },
    [draft, token],
  );

  function saveVersion() {
    persist();
    snapshot(tr(lang, "manual", "manual"));
    setSaveStatus({
      text: `${tr(lang, "Versión guardada", "Version saved")} · 已保存 ${fmtTs(Date.now())}`,
      tone: "pulse",
    });
  }

  function restore(entry: HistEntry) {
    try {
      const parsed = JSON.parse(entry.data) as Partial<Draft>;
      // Reversible: guardamos el estado ACTUAL antes de pisarlo, así Restaurar
      // tiene vuelta atrás (otra entrada en el historial).
      snapshot(tr(lang, "antes de restaurar", "before restore") + " / 恢复前");
      applyDraft(parsed);
      setShowHistory(false);
      setSaveStatus({
        text: `${tr(lang, "Versión restaurada", "Version restored")} · 已恢复`,
        tone: "pulse",
      });
    } catch {
      /* entrada corrupta → no hacemos nada */
    }
  }

  // Al confirmar el envío llevamos el foco/scroll al panel de éxito.
  const okRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submit.kind === "ok" && okRef.current) {
      okRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      okRef.current.focus();
    }
  }, [submit.kind]);

  // Totales — fuente única `computeTotals` (descarta filas vacías y re-suma).
  const { totals } = useMemo(() => computeTotals(rows), [rows]);
  // N.º de caja automático (Caja Padre): rango por fila, index-aligned con `rows`.
  const cartons = useMemo(() => cartonRanges(rows), [rows]);

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
    // Reindexar el estado de colapso: las filas > i se corren una posición.
    setExpanded((prev) => shiftExpanded(prev, i, -1));
  }

  /** Agrega un ítem en la MISMA caja que `i` (sub-ítem `same`) justo después suyo. */
  function addChild(i: number) {
    const lead = leadOf(rows, i);
    // El hijo se inserta en i+1 → las filas > i se corren +1 (incluido el líder
    // solo si i<lead, lo que no ocurre acá: i siempre ≥ lead).
    setExpanded((prev) => {
      const shifted = shiftExpanded(prev, i + 1, +1);
      shifted.add(lead);
      return shifted;
    });
    setRows((prev) => {
      const next = prev.slice();
      next.splice(i + 1, 0, { ...emptyRow(), same: true, qtyDirect: "" });
      return next;
    });
  }

  /** Colapsa/expande el grupo cuyo líder es `lead`. */
  function toggleGroup(lead: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lead)) next.delete(lead);
      else next.add(lead);
      return next;
    });
  }

  // ── Excel vacío (CSV UTF-8 con BOM, abre en Excel) — portado de downloadXls ──
  function downloadEmptyCsv() {
    const headers = [
      "品牌/Marca",
      "货号/Código",
      "中文品名",
      "英文品名/Nombre",
      "材质HS/Material",
      "箱号/N.caja",
      "件数/Cajas",
      "每箱装量/Uds caja",
      "单价/P.unit",
      "每箱重 kg",
      "每箱体积 CBM",
    ];
    const lines = [headers.join(",")];
    for (let i = 0; i < 15; i++) lines.push(headers.map(() => "").join(","));
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "DTD-PackingList-vacio.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  // ── Footer de bodega: texto canónico desde CONTACT.cn ──────────────────
  const whText = [
    `${cn.companyCjk} (DTD)`,
    `仓库地址: ${cn.addressCjk.replace(/\s+/g, "")}`,
    `仓库电话: ${cn.contactPersonCjk} ${cn.phoneCjk}`,
    `电话: ${cn.phoneLandline} · ${cn.phone}`,
    `收货时间: ${cn.hoursCjk}`,
    `邮箱: ${cn.warehouseEmail}`,
  ].join("\n");

  async function copyWarehouse() {
    try {
      await navigator.clipboard.writeText(whText);
      setCopiedWh(true);
      setTimeout(() => setCopiedWh(false), 1800);
    } catch {
      /* clipboard no disponible — el texto está visible para copiar a mano */
    }
  }

  async function handleSubmit() {
    setFieldErrors({});
    setSubmit({ kind: "sending" });
    try {
      const res = await fetch(`/p/${token}/packlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // El payload del submit mantiene su forma de SDD-0096; los campos
          // nuevos (address/city/cliente/folio) viven en el documento + el
          // borrador local hasta que el server-side los acepte (slice futuro).
          supplierCompany: company,
          supplierContact: client,
          supplierEmail: email,
          supplierWechat: wechat,
          supplierPhone: clientPhone,
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
      className="pl-doc mt-3 bg-white border border-grey-200 rounded-[16px] p-6 sm:p-7"
      style={{ fontFamily: BRAND_CJK }}
    >
      {/* ── Barra de herramientas (no imprime) ── */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="text-[15px] font-bold text-ink" lang="zh">
            装箱单 + 发票{" "}
            <span lang="es" className="text-grey-500 font-semibold">
              · {tr(lang, "Packing List + Factura", "Packing List + Invoice")}
            </span>
          </div>
          <div
            role="status"
            aria-live="polite"
            className={`mt-0.5 text-[12px] ${
              saveStatus.tone === "pulse" ? "text-wine" : "text-grey-700"
            }`}
            style={{ fontFamily: MONO_CJK }}
          >
            {saveStatus.text}
          </div>
        </div>

        {/* Idioma de la columna latina (el ZH SIEMPRE se muestra) → radiogroup. */}
        <div
          className="lang-seg"
          role="radiogroup"
          aria-label="Idioma de la columna latina · 中文常显"
        >
          <button
            type="button"
            className={lang === "es" ? "on" : ""}
            onClick={() => setLang("es")}
            role="radio"
            aria-checked={lang === "es"}
          >
            ES
          </button>
          <button
            type="button"
            className={lang === "en" ? "on" : ""}
            onClick={() => setLang("en")}
            role="radio"
            aria-checked={lang === "en"}
          >
            EN
          </button>
        </div>

        <select
          aria-label="Moneda / 货币"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as PackingListCurrency)}
          className="h-9 px-2.5 rounded-[8px] bg-white border border-grey-200 outline-none text-[12.5px] font-semibold text-ink focus:border-wine"
          style={{ fontFamily: MONO_CJK }}
        >
          {PACKING_LIST_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button type="button" onClick={saveVersion} className="tbtn tbtn-primary">
          <SaveGlyph /> {tr(lang, "Guardar", "Save")} / 保存
        </button>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="tbtn"
          aria-expanded={showHistory}
        >
          {tr(lang, "Historial", "History")} / 历史
        </button>
        <button type="button" onClick={downloadEmptyCsv} className="tbtn">
          <DownloadIcon size={14} /> {tr(lang, "Excel vacío", "Empty Excel")} / 空表
        </button>
        <button type="button" onClick={() => window.print()} className="tbtn tbtn-print">
          <PrintGlyph /> PDF · 打印
        </button>
      </div>

      {/* Panel de historial (no imprime) */}
      {showHistory && (
        <div className="no-print mt-3 rounded-[12px] border border-grey-200 bg-grey-100 p-3">
          <div className="text-[12px] font-bold text-ink">
            {tr(lang, "Versiones guardadas", "Saved versions")} · 历史版本 ({history.length})
          </div>
          {history.length === 0 ? (
            <p className="mt-2 text-[12px] text-grey-500">
              {tr(lang, "Sin versiones aún", "No versions yet")} · 暂无
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {history.map((h, i) => (
                <li
                  key={`${h.t}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-[12px] text-grey-700"
                >
                  <span style={{ fontFamily: MONO_CJK }}>
                    {fmtTs(h.t)}
                    {h.label ? ` · ${h.label}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => restore(h)}
                    className="pl-hist-restore text-[11px] font-bold text-wine rounded-[6px] border border-grey-200 bg-white px-2.5 py-1 hover:bg-grey-100"
                  >
                    {tr(lang, "Restaurar", "Restore")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {submit.kind === "ok" ? (
        <div
          ref={okRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="no-print mt-5 rounded-[12px] border border-grey-200 bg-grey-100 p-5 outline-none"
        >
          <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <CheckIcon size={16} />
            <span lang="zh">
              已提交 ·{" "}
              <span lang="es" className="font-semibold">
                {tr(lang, "Enviado", "Sent")}
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
              {tr(
                lang,
                "Puedes corregir y reenviar las veces que necesites.",
                "You can fix it and resend as many times as you need.",
              )}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSubmit({ kind: "idle" })}
            className="btn btn-ghost mt-4"
          >
            修改 · {tr(lang, "Corregir / reenviar", "Edit / resend")}
          </button>
        </div>
      ) : (
        <>
          {/* ── Encabezado del documento: identidad CN + teléfonos + folio ── */}
          <header className="pl-head mt-5">
            <div className="pl-phones" style={{ fontFamily: MONO_CJK }}>
              <span lang="zh" className="text-wine font-bold">
                电话
              </span>
              <b>{cn.phoneLandline}</b>
              <b>{cn.phone}</b>
              <b className="text-wine">{cn.warehouseEmail}</b>
            </div>
            <div className="pl-company">
              <span lang="zh">{cn.companyCjk}</span>
              {" · "}
              <span className="pl-wm">
                <span className="d">DTD</span> <span className="g">Cargo</span>
              </span>
            </div>
            <div className="pl-doctitle">
              <span lang="zh">装箱单 + 商业发票 · 入仓单</span>{" "}
              <span lang="es">
                {tr(lang, "Packing List + Factura", "Packing List + Invoice")}
              </span>
            </div>
            <div className="pl-headmeta">
              <span lang="zh">仓库地址</span> {cn.addressCjk.replace(/\s+/g, "")}
              <span className="pl-folio">
                {" · "}
                <span lang="zh">编号</span> N.º{" "}
                <input
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  placeholder="DTD-2026-…"
                  aria-label="Folio / 编号"
                />
              </span>
            </div>
          </header>

          {/* ── SUPPLIER / CLIENT split ── */}
          <div className="pl-info2 mt-3">
            {/* Proveedor */}
            <div className="pl-igroup">
              <div className="pl-ighead">
                <span lang="zh">供应商</span>{" "}
                <span lang="es">{tr(lang, "Proveedor", "Supplier")}</span>
              </div>
              <InfoRow
                labelZh="公司/个人名称"
                labelLat={tr(lang, "Empresa / Persona", "Company / Person")}
                value={company}
                onChange={setCompany}
                placeholder={tr(lang, "公司名称 / Empresa", "公司名称 / Company")}
                autoComplete="organization"
              />
              <InfoRow
                labelZh="邮箱"
                labelLat="Email"
                value={email}
                onChange={setEmail}
                placeholder="email@..."
                type="email"
                autoComplete="email"
              />
              <InfoRow
                labelZh="电话/微信"
                labelLat="Tel / WeChat"
                value={wechat}
                onChange={setWechat}
                placeholder="+86 138... / WeChat"
                autoComplete="off"
              />
              <div className="pl-irow pl-irow-addr">
                <span className="pl-il">
                  <span lang="zh">地址</span>{" "}
                  <span lang="es">{tr(lang, "Dirección", "Address")}</span>
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={tr(lang, "供应商地址 / Dirección", "供应商地址 / Address")}
                  aria-label={tr(lang, "Dirección del proveedor", "Supplier address")}
                  autoComplete="street-address"
                />
                <span className="pl-il pl-il-city">
                  <span lang="zh">城市</span>{" "}
                  <span lang="es">{tr(lang, "Ciudad", "City")}</span>
                </span>
                <input
                  className="pl-in-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={tr(lang, "城市 / Ciudad", "城市 / City")}
                  aria-label={tr(lang, "Ciudad del proveedor", "Supplier city")}
                />
              </div>
            </div>

            {/* Cliente */}
            <div className="pl-igroup">
              <div className="pl-ighead">
                <span lang="zh">客户</span>{" "}
                <span lang="es">{tr(lang, "Cliente", "Client")}</span>
              </div>
              <InfoRow
                labelZh="唛头"
                labelLat="Mark"
                value={mark}
                onChange={setMark}
                placeholder="DTD-XXXX"
                mono
                autoComplete="off"
              />
              <InfoRow
                labelZh="客户名"
                labelLat={tr(lang, "Nombre", "Name")}
                value={client}
                onChange={setClient}
                placeholder={tr(lang, "客户名 / Nombre", "客户名 / Name")}
                autoComplete="name"
              />
              <div className="pl-irow pl-irow-addr">
                <span className="pl-il">
                  <span lang="zh">客户电话</span>{" "}
                  <span lang="es">{tr(lang, "Tel.", "Phone")}</span>
                </span>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+58... / 客户电话"
                  aria-label={tr(lang, "Teléfono del cliente", "Client phone")}
                  type="tel"
                  autoComplete="tel"
                  style={{ fontFamily: MONO_CJK }}
                />
                <span className="pl-il pl-il-city">
                  <span lang="zh">邮箱</span> Email
                </span>
                <input
                  className="pl-in-city"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="email@..."
                  aria-label={tr(lang, "Email del cliente", "Client email")}
                  type="email"
                />
              </div>
              <div className="pl-irow">
                <span className="pl-il">
                  <span lang="zh">日期</span>{" "}
                  <span lang="es">{tr(lang, "Fecha", "Date")}</span>
                </span>
                <div className="pl-date-row">
                  <span className="pl-date-cn" lang="zh">
                    {renderDateCN(docDate)}
                  </span>
                  <button
                    type="button"
                    className="pl-datebtn"
                    onClick={() => {
                      const el = dateInputRef.current;
                      if (!el) return;
                      try {
                        el.showPicker();
                      } catch {
                        el.focus();
                      }
                    }}
                    aria-label={tr(lang, "Elegir fecha", "Pick date")}
                  >
                    <CalendarGlyph />
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="pl-date-hidden"
                    aria-label={tr(lang, "Fecha", "Date")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Detalle de mercancía ── */}
          <div className="pl-sect-t mt-4">
            <span lang="zh">货物明细</span>{" "}
            <span lang="es">{tr(lang, "Detalle de mercancía", "Goods detail")}</span>
          </div>
          <div className="mt-1.5 overflow-x-auto rounded-[12px] border border-grey-200">
            <table className="w-full border-collapse" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <Th className="c-idx">#</Th>
                  <Th className="c-mk" zh="品牌" lat={tr(lang, "Marca", "Brand")} />
                  <Th zh="货号" lat={tr(lang, "Código", "Code")} />
                  <Th zh="中文品名" lat={tr(lang, "Nombre 中文", "Name 中文")} />
                  <Th zh="英文品名" lat={tr(lang, "Nombre ES", "Name EN")} />
                  <Th zh="材质 / HS" lat="Material / HS" />
                  <Th zh="箱号" lat={tr(lang, "Nº caja", "Carton no.")} />
                  <Th zh="件数" lat={tr(lang, "Cajas", "Cartons")} />
                  <Th zh="每箱装量" lat={tr(lang, "Uds/caja", "PCS/ctn")} />
                  <Th zh="总数量" lat={tr(lang, "Total uds", "Total PCS")} calc />
                  <Th zh="单价" lat={tr(lang, "P. unit", "Unit price")} />
                  <Th zh="总金额" lat="Total" calc />
                  <Th zh="每箱重" lat={tr(lang, "kg/caja", "kg/ctn")} />
                  <Th zh="总重量" lat={tr(lang, "Peso", "Weight")} calc />
                  <Th zh="每箱体积" lat={tr(lang, "CBM/caja", "CBM/ctn")} />
                  <Th zh="总体积" lat="CBM" calc />
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isChild = r.same === true;
                  const lead = isChild ? leadOf(rows, i) : i;
                  // El hijo se oculta cuando su líder está colapsado (applyCollapse).
                  const hidden = isChild && !expanded.has(lead);
                  const kids = isChild ? 0 : childCountOf(rows, i);
                  const c = calcRow(r); // computados de ESTA fila (display)
                  // Líder: qty/amount = sumatorio del grupo (líder + hijos `same`).
                  const gsum = isChild ? null : groupSum(rows, i);
                  // Filas vacías muestran em-dash en las celdas calc (display); un
                  // líder con hijos que aportan cantidad NO se considera vacío.
                  const blank = rowIsBlank(r) && (gsum ? gsum.q === 0 : true);
                  const dash = "—";
                  const offTitle = "Va en la fila líder de la caja / 填在本箱首行";
                  return (
                    <tr
                      key={i}
                      className={`row${isChild ? " child" : ""}`}
                      style={hidden ? { display: "none" } : undefined}
                    >
                      <td className="c-idx">
                        {isChild ? (
                          <span className="grp" aria-hidden>
                            ⤷
                          </span>
                        ) : (
                          <>
                            {i + 1}
                            {kids > 0 && (
                              <button
                                type="button"
                                className={`grpTog no-print${
                                  expanded.has(i) ? " open" : ""
                                }`}
                                onClick={() => toggleGroup(i)}
                                aria-expanded={expanded.has(i)}
                                aria-label={
                                  expanded.has(i)
                                    ? `Cerrar ítems de la caja ${i + 1} / 收起本箱`
                                    : `Abrir ítems de la caja ${i + 1} / 展开本箱`
                                }
                                title="Abrir / cerrar ítems de esta caja / 展开 / 收起本箱"
                              >
                                <span className="chev" aria-hidden />
                                <span className="cnt">+{kids}</span>
                              </button>
                            )}
                          </>
                        )}
                      </td>
                      <Td className="c-mk">
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
                      {/* Nº de caja: automático (rango consecutivo); el hijo espeja el del líder. */}
                      <CalcTd
                        label={tr(lang, "Nº caja", "Carton no.")}
                        value={cartons[i] || dash}
                      />
                      <Td>
                        {isChild ? (
                          <CellOff ariaLabel={`Cajas, fila ${i + 1}`} value={asStr(r.ctns)} title={offTitle} />
                        ) : (
                          <CellInput
                            num
                            ariaLabel={`Cajas, fila ${i + 1}`}
                            value={asStr(r.ctns)}
                            onChange={(v) => setRow(i, "ctns", v)}
                          />
                        )}
                      </Td>
                      <Td>
                        {isChild ? (
                          <CellOff ariaLabel={`Uds/caja, fila ${i + 1}`} value={asStr(r.perctn)} title={offTitle} />
                        ) : (
                          <CellInput
                            num
                            ariaLabel={`Uds/caja, fila ${i + 1}`}
                            value={asStr(r.perctn)}
                            onChange={(v) => setRow(i, "perctn", v)}
                          />
                        )}
                      </Td>
                      {/* Total uds: hijo = input qtyDirect editable; líder = sumatorio del grupo. */}
                      {isChild ? (
                        <Td>
                          <CellInput
                            num
                            ariaLabel={`Cantidad, fila ${i + 1}`}
                            value={asStr(r.qtyDirect)}
                            onChange={(v) => setRow(i, "qtyDirect", v)}
                          />
                        </Td>
                      ) : (
                        <CalcTd
                          label={tr(lang, "Total uds", "Total PCS")}
                          value={blank ? dash : fmtInt(gsum?.q ?? 0)}
                        />
                      )}
                      <Td>
                        <CellInput
                          num
                          ariaLabel={`P. unit, fila ${i + 1}`}
                          value={asStr(r.unit)}
                          onChange={(v) => setRow(i, "unit", v)}
                        />
                      </Td>
                      {/* Total: hijo = su propio importe; líder = sumatorio del grupo. */}
                      <CalcTd
                        label={`Total ${currency}`}
                        value={
                          isChild
                            ? fmtMoney(c.amount)
                            : blank
                              ? dash
                              : fmtMoney(gsum?.a ?? 0)
                        }
                      />
                      <Td>
                        {isChild ? (
                          <CellOff ariaLabel={`kg/caja, fila ${i + 1}`} value={asStr(r.wkg)} title={offTitle} />
                        ) : (
                          <CellInput
                            num
                            ariaLabel={`kg/caja, fila ${i + 1}`}
                            value={asStr(r.wkg)}
                            onChange={(v) => setRow(i, "wkg", v)}
                          />
                        )}
                      </Td>
                      {/* Peso/CBM: van en la fila líder (el hijo aporta 0). */}
                      <CalcTd
                        label={tr(lang, "Peso", "Weight")}
                        value={isChild ? dash : blank ? dash : fmtW(c.weight)}
                      />
                      <Td>
                        {isChild ? (
                          <CellOff ariaLabel={`CBM/caja, fila ${i + 1}`} value={asStr(r.cbm)} title={offTitle} />
                        ) : (
                          <CellInput
                            num
                            ariaLabel={`CBM/caja, fila ${i + 1}`}
                            value={asStr(r.cbm)}
                            onChange={(v) => setRow(i, "cbm", v)}
                          />
                        )}
                      </Td>
                      <CalcTd
                        label="CBM"
                        value={isChild ? dash : blank ? dash : fmtCbm(c.vol)}
                      />
                      <td className="c-act">
                        <button
                          type="button"
                          onClick={() => addChild(i)}
                          className="rowadd no-print"
                          aria-label={`Agregar ítem en la caja de la fila ${i + 1} / 同箱加货`}
                          title="Agregar ítem en esta caja / 同箱加货"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="rowdel no-print"
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
                    <span lang="zh">总计</span> · {tr(lang, "Totales", "Totals")}
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

          {/* Totales en vivo, sticky SOLO en móvil. Live region: el lector anuncia
              los totales mientras el proveedor edita las filas. */}
          <div
            className="no-print sm:hidden sticky bottom-0 z-10 -mx-6 mt-4 border-t border-grey-200 bg-white/95 px-6 py-2.5 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label="Totales en vivo / 实时总计"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-grey-700">
              <span lang="zh" className="font-semibold text-ink">
                总计 · {tr(lang, "Totales", "Totals")}
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
            <button type="button" onClick={() => addRows(1)} className="addbtn">
              + 1 {tr(lang, "fila", "row")} / 加一行
            </button>
            <button type="button" onClick={() => addRows(5)} className="addbtn">
              + 5 {tr(lang, "filas", "rows")} / 加五行
            </button>
          </div>

          {/* Nota opcional */}
          <div className="no-print mt-5 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.04em] text-grey-500">
              <span lang="zh">备注 (可选)</span>
              <span lang="es"> · {tr(lang, "Nota (opcional)", "Note (optional)")}</span>
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
          <div role="status" aria-live="polite" className="no-print">
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

          {/* Honeypot: viaja en el body del POST (`empresa_web: ""`), no en el DOM. */}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="btn btn-primary no-print mt-5 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {sending
              ? "提交中… · " + tr(lang, "Enviando…", "Sending…")
              : "提交 · " + tr(lang, "Enviar a DTD", "Send to DTD")}
          </button>

          {/* ── Reglas de ingreso a bodega (trilingüe, parte del documento) ── */}
          <section className="pl-rules mt-6">
            <div className="pl-rules-head">
              <span lang="zh">入仓注意事项</span>{" "}
              <span lang="es">
                · {tr(lang, "Reglas de ingreso a bodega", "Warehouse intake rules")}
              </span>
            </div>
            <ol className="pl-rules-list">
              {WAREHOUSE_RULES.map((rule, i) => (
                <li key={i} className="pl-rule">
                  <span className="pl-rule-n">{i + 1}</span>
                  <span className="pl-rule-body">
                    <span lang="zh" className="pl-rule-zh">
                      {rule.zh}
                    </span>{" "}
                    <span lang="es" className="pl-rule-lat">
                      {tr(lang, rule.es, rule.en)}
                    </span>
                    {rule.contact && (
                      <b className="pl-rule-contact" style={{ fontFamily: MONO_CJK }}>
                        {" "}
                        吴小姐 · {cn.phoneCjk} · WeChat {cn.wechatId}
                      </b>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Footer de bodega: dirección de recepción (copy-paste) ── */}
          <section className="pl-wh mt-6">
            <div className="pl-wh-head">
              <button
                type="button"
                onClick={copyWarehouse}
                className={`pl-wh-copy${copiedWh ? " done" : ""}`}
              >
                {copiedWh ? (
                  <>
                    <CheckIcon size={13} /> {tr(lang, "Copiado", "Copied")} / 已复制
                  </>
                ) : (
                  <>
                    <DownloadIcon size={13} /> {tr(lang, "Copiar", "Copy")} / 复制
                  </>
                )}
              </button>
              <span>
                <span lang="zh">收货信息</span> ·{" "}
                <span lang="es">{tr(lang, "Dirección de recepción", "Warehouse address")}</span>
              </span>
            </div>
            <pre className="pl-wh-body" style={{ fontFamily: MONO_CJK }}>
              {whText}
            </pre>
          </section>
        </>
      )}

      {/* Estilos del documento (clases locales, tokens de marca pública). */}
      <style>{`
        /* ── Foco de teclado visible (todos los controles custom anulan el outline
              nativo con outline:0/border:0 → sin esto el tabbing es invisible). ── */
        .pl-doc :is(input,button,select,textarea):focus-visible {
          outline: 2px solid var(--color-ink); outline-offset: -1px; border-radius: 4px;
        }
        .pl-doc .pl-cell:focus-visible { outline-offset: -2px; }

        /* ── Toolbar buttons ── */
        .pl-doc .tbtn {
          appearance: none; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          font: 600 12.5px/1 var(--font-archivo), system-ui, sans-serif;
          border: 1px solid var(--color-grey-200); background: var(--color-white);
          color: var(--color-grey-700); border-radius: 8px;
          padding: 8px 12px; min-height: 36px;
        }
        .pl-doc .tbtn:hover { border-color: var(--color-wine); color: var(--color-wine); }
        .pl-doc .tbtn svg { width: 14px; height: 14px; }
        .pl-doc .tbtn-primary {
          background: var(--color-wine); border-color: var(--color-wine); color: var(--color-white);
        }
        .pl-doc .tbtn-primary:hover { background: var(--color-wine-deep); border-color: var(--color-wine-deep); color: var(--color-white); }
        .pl-doc .tbtn-print {
          background: var(--color-ink); border-color: var(--color-ink); color: var(--color-white);
        }
        .pl-doc .tbtn-print:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-white); opacity: 0.9; }
        .pl-doc .lang-seg {
          display: inline-flex; border: 1px solid var(--color-grey-200);
          border-radius: 8px; overflow: hidden;
        }
        .pl-doc .lang-seg button {
          appearance: none; border: 0; background: var(--color-white);
          color: var(--color-grey-700); cursor: pointer;
          font: 700 12px/1 var(--font-archivo), system-ui, sans-serif;
          padding: 9px 12px; min-height: 36px;
        }
        .pl-doc .lang-seg button.on { background: var(--color-wine); color: var(--color-white); }

        /* ── Document header ── */
        .pl-head {
          position: relative; text-align: center;
          border-bottom: 2px solid var(--color-ink); padding-bottom: 12px;
        }
        .pl-phones {
          position: absolute; top: 0; right: 0; text-align: right;
          display: flex; flex-direction: column;
          font: 600 10px/1.5 var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-grey-700);
        }
        .pl-phones b { color: var(--color-ink); font-weight: 600; }
        .pl-company {
          font: 700 20px/1.25 var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink);
        }
        .pl-wm { font-weight: 900; letter-spacing: -0.02em; }
        .pl-wm .d { color: var(--color-wine); }
        .pl-wm .g { color: var(--color-ink); }
        .pl-doctitle {
          font: 700 14px/1.2 var(--font-archivo), system-ui, sans-serif;
          color: var(--color-grey-700); margin-top: 4px;
        }
        .pl-doctitle [lang="zh"] { color: var(--color-wine); font-size: 13px; margin-right: 6px; }
        .pl-headmeta {
          font: 600 10px/1.4 var(--font-archivo), system-ui, sans-serif;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-grey-500); margin-top: 5px;
        }
        .pl-headmeta [lang="zh"] { text-transform: none; letter-spacing: 0; }
        .pl-folio { color: var(--color-wine); }
        .pl-folio input {
          border: 0; outline: 0; background: transparent;
          font: 600 11px/1 var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-wine); width: 130px; text-transform: none; letter-spacing: 0;
        }
        .pl-folio input:focus { background: rgba(127,15,26,0.06); }

        /* ── SUPPLIER / CLIENT ── */
        .pl-info2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0;
          border: 1px solid var(--color-grey-200); border-radius: 8px; overflow: hidden;
        }
        .pl-igroup { border-right: 1px solid var(--color-grey-200); }
        .pl-igroup:last-child { border-right: 0; }
        .pl-ighead {
          font: 700 9px/1 var(--font-archivo), system-ui, sans-serif;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-wine); background: var(--color-grey-100);
          padding: 7px 11px; border-bottom: 1px solid var(--color-grey-200);
        }
        .pl-ighead [lang="zh"] { letter-spacing: 0; }
        .pl-irow {
          display: flex; align-items: center;
          border-bottom: 1px solid var(--color-grey-200); min-height: 32px;
        }
        .pl-irow:last-child { border-bottom: 0; }
        .pl-il {
          flex: 0 0 28%;
          font: 600 9.5px/1.25 var(--font-archivo), system-ui, sans-serif;
          color: var(--color-grey-500); padding: 4px 9px;
        }
        .pl-il [lang="zh"] { color: var(--color-grey-700); font-weight: 700; }
        .pl-irow input {
          flex: 1; border: 0; outline: 0; background: transparent;
          font: 500 12px var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink); padding: 6px 9px;
          border-left: 1px dotted var(--color-grey-200); min-width: 0;
        }
        .pl-irow input:focus { background: rgba(127,15,26,0.06); }
        .pl-irow input::placeholder { color: var(--color-grey-500); }
        .pl-irow-addr .pl-il { flex: 0 0 17%; }
        .pl-irow-addr .pl-il-city { flex: 0 0 auto; padding-left: 6px; padding-right: 3px; }
        .pl-irow-addr .pl-in-city { flex: 0 0 18%; }
        .pl-date-row {
          flex: 1; display: flex; align-items: center; gap: 9px;
          border-left: 1px dotted var(--color-grey-200); padding: 4px 9px;
        }
        .pl-date-cn {
          font: 700 13px/1.2 var(--font-noto-sc), 'Noto Sans SC', sans-serif;
          color: var(--color-wine); white-space: nowrap;
        }
        .pl-datebtn {
          appearance: none; border: 0; background: transparent; cursor: pointer;
          color: var(--color-ink); padding: 2px; display: inline-flex; margin-left: auto;
        }
        .pl-datebtn svg { width: 17px; height: 17px; }
        .pl-date-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

        /* ── Goods table ── */
        .pl-sect-t {
          font: 700 12px/1 var(--font-archivo), system-ui, sans-serif;
          color: var(--color-wine); letter-spacing: 0.04em;
          display: flex; align-items: baseline; justify-content: center; gap: 8px;
        }
        .pl-sect-t [lang="zh"] { color: var(--color-ink); font-size: 13px; letter-spacing: 0; }
        .pl-doc .row td { border-top: 1px solid var(--color-grey-200); }
        .pl-doc thead th {
          background: var(--color-grey-100);
          color: var(--color-ink);
          font: 700 9.5px/1.25 var(--font-archivo), system-ui, sans-serif;
          padding: 7px 5px;
          border-bottom: 1px solid var(--color-grey-200);
          text-align: center;
          vertical-align: middle;
        }
        .pl-doc thead th .th-zh { display: block; font-size: 10px; }
        .pl-doc thead th .th-lat {
          display: block; font-size: 8.5px; font-weight: 600;
          color: var(--color-grey-500); text-transform: uppercase;
          letter-spacing: 0.02em; margin-top: 1px;
        }
        .pl-doc tbody td { padding: 0; height: 32px; }
        .pl-doc td.c-idx {
          width: 26px; text-align: center;
          font: 600 11px var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-grey-500); background: var(--color-grey-100);
        }
        .pl-doc td.calc {
          text-align: right; padding: 0 7px;
          font: 600 11.5px var(--font-jetbrains-mono), ui-monospace, monospace;
          color: var(--color-ink); background: rgba(127,15,26,0.06); white-space: nowrap;
        }
        .pl-doc td.c-del, .pl-doc td.c-act { width: 64px; text-align: center; white-space: nowrap; }
        .pl-doc .pl-cell {
          width: 100%; height: 100%; border: 0; outline: 0; background: transparent;
          font: 500 12px var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink); padding: 4px 7px;
        }
        .pl-doc .pl-cell:focus { background: rgba(127,15,26,0.06); }
        .pl-doc .pl-cell.mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .pl-doc .pl-cell.num { text-align: right; font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .pl-doc .pl-cell.zh { font-family: var(--font-noto-sc), 'Noto Sans SC', sans-serif; }
        /* ── Caja Padre (SDD-0097): sub-ítem readonly + fila hija + toggle grupo ── */
        .pl-doc .pl-cell.off {
          color: var(--color-grey-500); cursor: not-allowed;
          background: repeating-linear-gradient(45deg,
            var(--color-grey-100), var(--color-grey-100) 4px,
            var(--color-white) 4px, var(--color-white) 8px);
        }
        .pl-doc tr.child > td { background: var(--color-grey-100); }
        .pl-doc tr.child > td:first-child { border-left: 3px solid var(--color-wine); }
        .pl-doc td.c-idx .grp { color: var(--color-wine); font-size: 14px; font-weight: 700; line-height: 1; }
        .pl-doc .grpTog {
          display: inline-flex; align-items: center; gap: 3px; margin-top: 3px;
          appearance: none; border: 0; cursor: pointer;
          background: rgba(127,15,26,0.06); color: var(--color-wine);
          font: 700 8.5px/1 var(--font-jetbrains-mono), ui-monospace, monospace;
          border-radius: 999px; padding: 3px 7px; min-height: 0;
        }
        .pl-doc .grpTog:hover { background: rgba(127,15,26,0.12); }
        .pl-doc .grpTog .chev {
          width: 0; height: 0; border-left: 4px solid currentColor;
          border-top: 3px solid transparent; border-bottom: 3px solid transparent;
          transition: transform .12s;
        }
        .pl-doc .grpTog.open .chev { transform: rotate(90deg); }
        .pl-doc .rowadd {
          appearance: none; cursor: pointer; border: 0; background: transparent;
          color: var(--color-wine); font: 700 17px/1 var(--font-archivo), system-ui, sans-serif;
          display: inline-grid; place-items: center;
          min-width: 30px; min-height: 32px; border-radius: 8px;
        }
        .pl-doc .rowadd:hover { background: rgba(127,15,26,0.06); }
        .pl-doc .rowdel {
          appearance: none; cursor: pointer; border: 0; background: transparent;
          color: var(--color-grey-500); line-height: 1;
          display: inline-grid; place-items: center;
          min-width: 30px; min-height: 32px; border-radius: 8px;
        }
        .pl-doc .rowdel:hover { color: var(--color-wine); background: rgba(127,15,26,0.06); }
        .pl-doc tfoot td {
          border-top: 1px solid var(--color-grey-200);
          font: 700 11.5px var(--font-jetbrains-mono), ui-monospace, monospace;
          padding: 8px 7px; background: var(--color-grey-100);
        }
        .pl-doc tfoot .tfoot-lab {
          text-align: right;
          font-family: var(--font-archivo), system-ui, sans-serif;
          color: var(--color-ink);
        }
        .pl-doc tfoot .tfoot-v { text-align: right; color: var(--color-wine); white-space: nowrap; }
        .pl-doc .addbtn {
          appearance: none; cursor: pointer;
          display: inline-flex; align-items: center;
          font: 600 12px/1 var(--font-archivo), system-ui, sans-serif;
          border: 1px dashed var(--color-grey-300); background: var(--color-white);
          color: var(--color-grey-700); border-radius: 8px;
          padding: 8px 14px; min-height: 36px;
        }
        .pl-doc .addbtn:hover { border-color: var(--color-wine); color: var(--color-wine); }

        /* ── Warehouse footer ── */
        /* ── Reglas de ingreso a bodega (número único de color, sin el gris del <ol>) ── */
        .pl-rules { border: 1px solid var(--color-grey-200); border-radius: 8px; padding: 13px 15px; }
        .pl-rules-head { font: 700 11px/1.2 var(--font-archivo); color: var(--color-wine); margin-bottom: 9px; }
        .pl-rules-head [lang="zh"] { color: var(--color-ink); }
        .pl-rules-list { list-style: none; margin: 0; padding: 0; }
        .pl-rule { display: flex; gap: 7px; margin-bottom: 5px; font: 400 10.5px/1.5 var(--font-archivo); color: var(--color-grey-700); }
        .pl-rule:last-child { margin-bottom: 0; }
        .pl-rule-n { flex-shrink: 0; font-weight: 700; color: var(--color-wine); }
        .pl-rule-zh { font-family: var(--font-noto-sc), var(--font-archivo); }
        .pl-rule-lat { color: var(--color-grey-700); }
        .pl-rule-contact { color: var(--color-ink); }
        @media (max-width: 720px) { .pl-rule { font-size: 11.5px; } }
        .pl-wh { border: 1px solid var(--color-grey-200); border-radius: 8px; overflow: hidden; }
        .pl-wh-head {
          display: flex; align-items: center; gap: 9px;
          background: var(--color-grey-100); padding: 6px 11px;
          border-bottom: 1px solid var(--color-grey-200);
          font: 700 9.5px/1.3 var(--font-archivo), system-ui, sans-serif;
          letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-wine);
        }
        .pl-wh-head [lang="zh"] { letter-spacing: 0; }
        .pl-wh-copy {
          appearance: none; cursor: pointer;
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid var(--color-wine); background: var(--color-white);
          color: var(--color-wine);
          font: 700 10px/1 var(--font-archivo), system-ui, sans-serif;
          border-radius: 999px; padding: 5px 10px;
          text-transform: none; letter-spacing: 0;
        }
        .pl-wh-copy:hover { background: rgba(127,15,26,0.06); }
        .pl-wh-copy.done { background: var(--color-wine); color: var(--color-white); border-color: var(--color-wine); }
        .pl-wh-copy svg { width: 13px; height: 13px; }
        .pl-wh-body {
          margin: 0; padding: 10px 12px;
          font: 500 11.5px/1.7 var(--font-noto-sc), var(--font-jetbrains-mono), monospace;
          color: var(--color-ink); white-space: pre-wrap; word-break: break-word;
        }

        /* ── Móvil: SUPPLIER/CLIENT a 1 columna; filas compuestas se parten ── */
        @media (max-width: 720px) {
          .pl-info2 { grid-template-columns: 1fr; }
          .pl-igroup { border-right: 0; border-bottom: 1px solid var(--color-grey-200); }
          .pl-igroup:last-child { border-bottom: 0; }
          .pl-phones { position: static; text-align: center; flex-direction: row; flex-wrap: wrap; gap: 4px 10px; justify-content: center; margin-bottom: 6px; }
          .pl-irow-addr { flex-wrap: wrap; }
          .pl-irow-addr .pl-il { flex: 0 0 28% !important; }
          .pl-irow-addr input { flex: 1 1 60% !important; }
          .pl-irow-addr .pl-il-city { flex: 0 0 28% !important; border-top: 1px dotted var(--color-grey-200); }
          .pl-irow-addr .pl-in-city { flex: 1 1 60% !important; border-top: 1px dotted var(--color-grey-200); }
          .pl-irow input { font-size: 14px; min-height: 34px; }
          .pl-cell { font-size: 14px !important; padding: 7px !important; }

          /* P11 · legibilidad de labels en pantallas chicas (contraste + tamaño). */
          .pl-il { font-size: 11px; }
          .pl-doc thead th .th-lat { font-size: 10px; color: var(--color-grey-700); }

          /* P10 · inputs editables con afordancia (se ven "rellenables", no texto). */
          .pl-irow input, .pl-folio input { background: var(--color-grey-100); border-radius: 4px; }

          /* P8 · targets de toque ≥40px en móvil. */
          .pl-datebtn svg { width: 22px; height: 22px; }
          .pl-datebtn { padding: 8px; }
          .pl-wh-copy { padding: 9px 13px; }
          .pl-hist-restore { min-height: 40px; padding: 9px 14px; }

          /* P4 · congelar identidad de fila (#, Marca) al scrollear los números:
                la tabla mide min-width:1000px → sin freeze el proveedor pierde
                en qué producto está. Solo móvil; no afecta impresión ni desktop. */
          .pl-doc thead th.c-idx, .pl-doc td.c-idx {
            position: sticky; left: 0; z-index: 3;
            background: var(--color-grey-100);
          }
          .pl-doc thead th.c-mk, .pl-doc td.c-mk {
            position: sticky; left: 26px; z-index: 3;
            min-width: 84px;
            background: var(--color-white);
            box-shadow: inset -1px 0 0 var(--color-grey-200);
          }
          .pl-doc thead th.c-mk { background: var(--color-grey-100); }
        }

        /* ── Impresión: 1 página A4 horizontal, sin chrome ni columna borrar. ── */
        @media print {
          .no-print { display: none !important; }
          .pl-doc { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          @page { size: A4 landscape; margin: 8mm; }
          .pl-doc td.c-del, .pl-doc td.c-act,
          .pl-doc .rowdel, .pl-doc .rowadd, .pl-doc .grpTog { display: none !important; }
          /* Caja Padre: en papel TODOS los sub-ítems se imprimen (aunque estén colapsados). */
          .pl-doc tr.child { display: table-row !important; }
          .pl-doc tbody td { height: 26px; }
          .pl-doc thead { display: table-header-group; }
          .pl-doc tr { page-break-inside: avoid; }
          .pl-doc td.calc { background: rgba(127,15,26,0.06) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pl-doc .pl-cell, .pl-doc td.calc, .pl-doc tfoot td { font-size: 10px; }
          .pl-date-hidden { display: none !important; }
          .pl-datebtn { display: none !important; }
          .pl-wh { page-break-inside: avoid; }
        }
      `}</style>
    </section>
  );
}

// ── Helpers / subcomponentes ─────────────────────────────────────

/** i18n mínimo: elige la columna latina según `lang` (ZH va aparte, siempre). */
function tr(lang: Lang, es: string, en: string): string {
  return lang === "en" ? en : es;
}

function asStr(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}

// ── Caja Padre (SDD-0097) · agrupación por caja, portado de packlist.js ──────
// Display-only en el form (el server re-suma con computeTotals, fuente única).
// Estos helpers operan sobre `rows` SIN filtrar (index-aligned con la tabla),
// a diferencia de computeTotals que descarta filas vacías.

/** Coerción numérica tolerante a coma decimal (espejo del num() del módulo puro). */
function rowNum(v: string | number | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Computados de UNA fila (mismas fórmulas que rowCalc del módulo puro). */
type RowCalc = { qty: number; amount: number; weight: number; vol: number };
function calcRow(r: PackingListRowInput): RowCalc {
  const unit = rowNum(r.unit);
  if (r.same === true) {
    const qty = rowNum(r.qtyDirect);
    return { qty, amount: qty * unit, weight: 0, vol: 0 };
  }
  const ctns = rowNum(r.ctns);
  const perctn = rowNum(r.perctn);
  const wkg = rowNum(r.wkg);
  const cbm = rowNum(r.cbm);
  const qty = ctns * perctn;
  return { qty, amount: qty * unit, weight: ctns * wkg, vol: ctns * cbm };
}

/**
 * Reindexa el Set de líderes expandidos cuando una fila entra/sale en `at`.
 * delta=+1 (inserción) / -1 (borrado). Los índices ≥ `at` se desplazan; un líder
 * borrado (delta=-1, lead===at) deja de estar expandido.
 */
function shiftExpanded(prev: Set<number>, at: number, delta: 1 | -1): Set<number> {
  const next = new Set<number>();
  for (const lead of prev) {
    if (delta === -1 && lead === at) continue; // el líder borrado se descarta
    next.add(lead >= at ? lead + delta : lead);
  }
  return next;
}

/** Índice de la fila LÍDER de la caja a la que pertenece `i` (sube por las `same`). */
function leadOf(rows: PackingListRowInput[], i: number): number {
  let k = i;
  while (k > 0 && rows[k] && rows[k].same === true) k--;
  return k;
}

/** Suma del grupo (líder + sus hijos `same` consecutivos): qty + amount. */
function groupSum(rows: PackingListRowInput[], lead: number): { q: number; a: number } {
  const c0 = calcRow(rows[lead]);
  let q = c0.qty;
  let a = c0.amount;
  let j = lead + 1;
  while (j < rows.length && rows[j]?.same === true) {
    const c = calcRow(rows[j]);
    q += c.qty;
    a += c.amount;
    j++;
  }
  return { q, a };
}

/** Nº de hijos `same` consecutivos que cuelgan del líder en `i` (0 si no es líder). */
function childCountOf(rows: PackingListRowInput[], i: number): number {
  if (rows[i]?.same === true) return 0;
  let n = 0;
  let k = i + 1;
  while (k < rows.length && rows[k]?.same === true) {
    n++;
    k++;
  }
  return n;
}

/**
 * N.º de caja automático (espejo de recalcCartons): rangos consecutivos. El líder
 * con n=round(ctns) cajas toma `start..start+n-1` (o `start` si n=1); los hijos
 * `same` espejan el rango de su líder; `start` avanza. Devuelve un string por fila,
 * index-aligned con `rows`.
 */
function cartonRanges(rows: PackingListRowInput[]): string[] {
  const out = new Array<string>(rows.length).fill("");
  let start = 1;
  let lastRange = "";
  rows.forEach((r, i) => {
    if (r.same === true) {
      out[i] = lastRange; // el hijo espeja el rango del líder
      return;
    }
    const n = Math.round(rowNum(r.ctns));
    if (n > 0) {
      lastRange = n === 1 ? String(start) : `${start}-${start + n - 1}`;
      start += n;
    } else {
      lastRange = "";
    }
    out[i] = lastRange;
  });
  return out;
}

/**
 * ¿La fila editable está totalmente vacía? (todos sus campos en blanco/0). Para
 * mostrar em-dash en las celdas calculadas de filas sin datos → la tabla se ve
 * "lista para llenar", no "con ceros". Solo display; no afecta `computeTotals`.
 */
function rowIsBlank(r: PackingListRowInput): boolean {
  const vals = [
    r.brand,
    r.code,
    r.zh,
    r.es,
    r.hs,
    r.carton,
    r.ctns,
    r.perctn,
    r.unit,
    r.wkg,
    r.cbm,
  ];
  return vals.every((v) => asStr(v).trim() === "");
}

function InfoRow({
  labelZh,
  labelLat,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  autoComplete,
}: {
  labelZh: string;
  labelLat: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="pl-irow">
      <span className="pl-il">
        <span lang="zh">{labelZh}</span> <span lang="es">{labelLat}</span>
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={labelLat}
        style={mono ? { fontFamily: MONO_CJK } : undefined}
      />
    </div>
  );
}

function Th({
  zh,
  lat,
  calc = false,
  className,
  children,
}: {
  zh?: string;
  lat?: string;
  calc?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  if (children !== undefined) return <th className={className}>{children}</th>;
  return (
    <th className={className}>
      {zh && (
        <span className="th-zh" lang="zh">
          {zh}
        </span>
      )}
      {lat && (
        <span className="th-lat" lang="es">
          {lat}
          {calc ? " ▸" : ""}
        </span>
      )}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={className}>{children}</td>;
}

/**
 * Celda calculada (read-only) de una fila. El número visible se oculta al lector
 * (`aria-hidden`) y se expone una etiqueta semántica `label: valor` vía `.sr-only`
 * para que sea legible sin contexto visual de la columna.
 */
function CalcTd({ label, value }: { label: string; value: string }) {
  return (
    <td className="calc">
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">
        {label}: {value}
      </span>
    </td>
  );
}

/**
 * Celda READONLY de un sub-ítem (Caja Padre): cajas/uds-caja/kg/cbm van en la
 * fila LÍDER, así que en el hijo se muestran apagadas (rayado diagonal, fuera de
 * tab) con un title bilingüe explicando que se editan en la fila líder.
 */
function CellOff({
  value,
  ariaLabel,
  title,
}: {
  value: string;
  ariaLabel?: string;
  title?: string;
}) {
  return (
    <input
      className="pl-cell num off"
      value={value}
      readOnly
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-readonly="true"
      title={title}
    />
  );
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

// Glifos inline propios del editor (no están en components/Icon).
function SaveGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}
function PrintGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
