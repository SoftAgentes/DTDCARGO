"use client";

import { useId, useRef, useState } from "react";
import { StatusIcon } from "@/components/StatusIcon";

/** Formatos y límites del endpoint existente /p/{token}/upload. */
const ACCEPT = "image/*,.xlsx,.xls,.csv,.pdf,.doc,.docx";
const MAX_FILES = 12;
const MAX_BYTES = 15 * 1024 * 1024;
const FOCUS_RING = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";

export type SupplierUploadLocale = "zh" | "es" | "en";
export type SupplierUploadError = "failed" | "network" | "limit" | "size" | "unconfirmed" | "throttled";
export type SupplierUploadStatus = {
  /** Cantidad confirmada para el último intento; nunca se infiere de la selección. */
  uploaded: number;
  selected: number;
} & ({ kind: "idle" | "sending" | "received" | "partial" } | { kind: "error"; error: SupplierUploadError });
type UploadState = SupplierUploadStatus;

const COPY = {
  zh: {
    title: "照片和文件", optional: "选填", description: "添加产品照片或 DTD 要求的文件。也可上传填好的 Excel，无需再次在线填写。",
    choose: "选择文件", empty: "尚未选择文件。可以跳过此步骤。", limits: "每次最多 12 个文件，每个不超过 15 MB。支持图片、Excel、CSV、PDF 和 Word。",
    remove: "移除", clear: "全部移除", upload: "上传文件", retry: "重新上传所选文件", sending: "正在上传…",
    selected: (n: number) => `已选择 ${n} 个文件，尚未上传`,
    selectedUnknown: (n: number) => `当前选择 ${n} 个文件；上次接收情况不确定`,
    received: (n: number) => `已收到 ${n} 个文件`,
    partial: (n: number, total: number) => `部分上传完成：已收到 ${total} 个文件中的 ${n} 个`,
    partialHelp: "当前选择已保留。系统尚未提供具体成功文件的名单。再次上传可能产生重复文件，请先与 DTD 确认。",
    distinction: "文件已接收。文件接收与在线表单提交是两个独立状态。使用 Excel 的无需重复填写。",
    failed: "上传失败。请检查文件格式和大小后重试。", network: "连接中断，无法确认文件是否收到。请先与 DTD 确认，再尝试重新上传。",
    limit: "每次最多上传 12 个文件。请移除多余文件后再试。", size: "文件不能为空，且每个文件不超过 15 MB。请移除不符合要求的文件。",
    unconfirmed: "无法确认已收到多少个文件。当前选择已保留，请先与 DTD 确认，再尝试重新上传。", throttled: "上传次数过多，请稍后重试。",
  },
  es: {
    title: "Fotos y archivos", optional: "Opcional", description: "Agrega fotos o documentos solicitados por DTD. También puedes subir tu Excel completo sin llenar el formulario online.",
    choose: "Elegir archivos", empty: "Todavía no has seleccionado archivos. Puedes continuar sin adjuntos.", limits: "Máximo 12 archivos por carga y 15 MB por archivo. Imágenes, Excel, CSV, PDF o Word.",
    remove: "Quitar", clear: "Quitar todo", upload: "Subir archivos", retry: "Reenviar selección", sending: "Subiendo archivos…",
    selected: (n: number) => `${n} archivo${n === 1 ? "" : "s"} seleccionado${n === 1 ? "" : "s"}, sin subir`,
    selectedUnknown: (n: number) => `${n} archivo${n === 1 ? "" : "s"} en la selección actual; recepción anterior sin confirmar por archivo`,
    received: (n: number) => `${n} archivo${n === 1 ? " recibido" : "s recibidos"}`,
    partial: (n: number, total: number) => `Carga parcial: ${n} de ${total} archivos recibidos`,
    partialHelp: "Conservamos tu selección. No tenemos el detalle de cuáles llegaron. Reenviar puede duplicar archivos; confirma con DTD antes de intentarlo.",
    distinction: "Los archivos fueron recibidos. La recepción de archivos es independiente del envío del formulario online. Si usaste Excel, no necesitas llenarlo de nuevo.",
    failed: "No pudimos subir tus archivos. Revisa su formato y tamaño e intenta de nuevo.", network: "La conexión se interrumpió y no pudimos confirmar la recepción. Confirma con DTD antes de reenviar.",
    limit: "Puedes subir hasta 12 archivos por carga. Quita los que exceden el límite y vuelve a intentar.", size: "Los archivos deben tener contenido y pesar hasta 15 MB cada uno. Quita los que no cumplen este límite.",
    unconfirmed: "No pudimos confirmar cuántos archivos fueron recibidos. Conservamos tu selección; confirma con DTD antes de reenviar.", throttled: "Se hicieron demasiadas cargas. Intenta de nuevo más tarde.",
  },
  en: {
    title: "Photos and files", optional: "Optional", description: "Add photos or files requested by DTD. You can also upload your completed Excel without filling in the online form.",
    choose: "Choose files", empty: "No files selected yet. You can continue without attachments.", limits: "Up to 12 files per upload, 15 MB each. Images, Excel, CSV, PDF or Word.",
    remove: "Remove", clear: "Remove all", upload: "Upload files", retry: "Upload selection again", sending: "Uploading files…",
    selected: (n: number) => `${n} file${n === 1 ? "" : "s"} selected, not uploaded`,
    selectedUnknown: (n: number) => `${n} file${n === 1 ? "" : "s"} in the current selection; previous receipt unconfirmed per file`,
    received: (n: number) => `${n} file${n === 1 ? "" : "s"} received`,
    partial: (n: number, total: number) => `Partial upload: ${n} of ${total} files received`,
    partialHelp: "Your selection is preserved. We cannot identify which files arrived. Uploading again may create duplicates; check with DTD before trying again.",
    distinction: "The files have been received. File receipt is independent of online form submission. If you used Excel, there is no need to fill it in again.",
    failed: "We could not upload your files. Check their format and size, then try again.", network: "The connection was interrupted and receipt could not be confirmed. Check with DTD before uploading again.",
    limit: "You can upload up to 12 files at a time. Remove the extra files and try again.", size: "Files must not be empty or larger than 15 MB each. Remove files that do not meet this limit.",
    unconfirmed: "We could not confirm how many files were received. Your selection is preserved; check with DTD before uploading again.", throttled: "Too many uploads. Please try again later.",
  },
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * SDD-0468 etapa 2. Adjuntos opcionales con recepción independiente del envío
 * del documento. El endpoint solo confirma una cantidad: no inventar nombres,
 * tipos recibidos ni éxito total a partir de la selección del navegador.
 */
export function SupplierUploadSection({
  token,
  locale = "zh",
  request = fetch,
  onUploadState,
  showHeading = true,
}: {
  token: string;
  locale?: SupplierUploadLocale;
  /** Transporte inyectable para la vista local con datos ficticios. */
  request?: typeof fetch;
  onUploadState?: (status: SupplierUploadStatus) => void;
  showHeading?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>({ kind: "idle", uploaded: 0, selected: 0 });
  const text = COPY[locale];
  const sending = state.kind === "sending";
  const uncertain = state.kind === "partial" || (state.kind === "error" && (state.error === "network" || state.error === "unconfirmed"));

  function updateState(next: UploadState) {
    setState(next);
    onUploadState?.(next);
  }

  function selectFiles(next: File[]) {
    setFiles(next);
    // Editing a residual selection cannot identify which files the server received.
    if (!uncertain || next.length === 0) updateState({ kind: "idle", uploaded: 0, selected: next.length });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (sending || files.length === 0) return;
    const selected = files.length;
    if (selected > MAX_FILES || files.some((file) => file.size === 0 || file.size > MAX_BYTES)) {
      updateState({ kind: "error", uploaded: 0, selected, error: selected > MAX_FILES ? "limit" : "size" });
      return;
    }
    updateState({ kind: "sending", uploaded: 0, selected });
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      body.append("empresa_web", "");
      const response = await request(`/p/${token}/upload`, { method: "POST", body });
      if (!response.ok) {
        updateState({ kind: "error", uploaded: 0, selected, error: response.status === 429 ? "throttled" : "failed" });
        return;
      }
      let data: unknown = null;
      try { data = await response.json(); } catch { /* HTTP 2xx sin recibo verificable. */ }

      // Un HTTP exitoso sin recibo válido no prueba que la carga haya fallado.
      // Conservamos la selección y advertimos antes de un posible reenvío duplicado.
      if (
        !data || typeof data !== "object" || !("ok" in data) || data.ok !== true ||
        !("uploaded" in data) || typeof data.uploaded !== "number" ||
        !Number.isInteger(data.uploaded) || data.uploaded <= 0 || data.uploaded > selected
      ) {
        updateState({ kind: "error", uploaded: 0, selected, error: "unconfirmed" });
        return;
      }
      if (data.uploaded < selected) {
        updateState({ kind: "partial", uploaded: data.uploaded, selected });
        return;
      }
      updateState({ kind: "received", uploaded: data.uploaded, selected });
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      updateState({ kind: "error", uploaded: 0, selected, error: "network" });
    }
  }

  return (
    <section
      className="no-print space-y-4 text-ink"
      lang={locale === "zh" ? "zh-CN" : locale}
      aria-labelledby={showHeading ? `${id}-title` : undefined}
      aria-label={showHeading ? undefined : COPY[locale].title}
      aria-busy={sending}
      style={locale === "zh" ? { fontFamily: "var(--f-cn-ui)" } : undefined}
    >
      <div>
        {showHeading && <div className="flex flex-wrap items-center gap-3">
          <h3 id={`${id}-title`} className="m-0 text-lg font-bold">{text.title}</h3>
          <span className="rounded-full border border-grey-200 px-3 py-1 text-sm text-grey-700">{text.optional}</span>
        </div>}
        <p className="mb-0 max-w-prose text-base leading-relaxed text-grey-700">{text.description}</p>
      </div>
      <div className="rounded-lg border border-grey-200 bg-grey-100 p-4">
        <p id={`${id}-limits`} className="mt-0 mb-4 text-sm leading-relaxed text-grey-700">{text.limits}</p>
        <input
          id={`${id}-files`}
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={sending}
          onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
          aria-label={text.choose}
          aria-describedby={`${id}-limits`}
          hidden aria-hidden="true" tabIndex={-1}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={sending} className="btn btn-ghost disabled:opacity-60">
            {text.choose}
          </button>
          {files.length > 0 && (
            <button type="button" onClick={() => selectFiles([])} disabled={sending} className={`min-h-11 rounded-sm px-2 text-sm font-semibold underline underline-offset-4 disabled:opacity-60 ${FOCUS_RING}`}>
              {text.clear}
            </button>
          )}
        </div>
        {files.length === 0 && state.kind !== "received" && <p className="mt-4 mb-0 text-base text-grey-700">{text.empty}</p>}
        {files.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-sm font-semibold">{uncertain ? text.selectedUnknown(files.length) : text.selected(files.length)}</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-grey-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 break-words text-base">{file.name}</p>
                    <p className="m-0 text-sm text-grey-700">{fmtSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => selectFiles(files.filter((_, i) => i !== index))}
                    aria-label={`${text.remove} ${file.name}`}
                    className={`min-h-11 shrink-0 rounded-sm px-2 text-sm font-semibold underline underline-offset-4 disabled:opacity-60 ${FOCUS_RING}`}
                  >{text.remove}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.kind === "sending" && <p className="m-0 text-base">{text.sending}</p>}
        {(state.kind === "received" || state.kind === "partial" || state.kind === "error") && (
          <div className="flex items-start gap-3 rounded-lg border border-grey-200 bg-white p-4">
            <StatusIcon
              tone={state.kind === "received" ? "success" : state.kind === "error" ? "danger" : "info"}
              size={20}
              style={{ color: state.kind === "received" ? "var(--color-status-success)" : state.kind === "error" ? "var(--color-status-danger)" : "var(--color-ink)", marginTop: "var(--spacing)" }}
            />
            <div className="min-w-0 text-base leading-relaxed">
              <p className="m-0 font-semibold">
                {state.kind === "received" ? text.received(state.uploaded) : state.kind === "partial" ? text.partial(state.uploaded, state.selected) : state.kind === "error" ? text[state.error] : null}
              </p>
              {state.kind !== "error" && <p className="mt-2 mb-0 text-grey-700">{state.kind === "partial" ? text.partialHelp : text.distinction}</p>}
            </div>
          </div>
        )}
      </div>
      {files.length > 0 && (
        <button type="button" onClick={handleUpload} disabled={sending} className="btn btn-primary disabled:opacity-60">
          {sending ? text.sending : state.kind === "partial" ? text.retry : text.upload}
        </button>
      )}
    </section>
  );
}
/** Receipt-only presentation; File objects stay in the mounted upload component. */
export function SupplierUploadSummary({ locale, status }: { locale: SupplierUploadLocale; status: SupplierUploadStatus }) {
  const text = COPY[locale];
  const summary = status.kind === "received" ? text.received(status.uploaded)
    : status.kind === "partial" ? text.partial(status.uploaded, status.selected)
    : status.kind === "sending" ? text.sending
    : status.kind === "error" ? text[status.error]
    : status.selected ? text.selected(status.selected) : text.empty;
  return <p role="status" className="text-sm leading-relaxed text-grey-700">{summary}</p>;
}
