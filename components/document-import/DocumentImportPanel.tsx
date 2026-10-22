"use client";

/**
 * SDD-0473 · La entrada del recorrido: primero los archivos.
 *
 * El cliente llega con una factura/PI y a veces un packing list. Antes tenía que
 * transcribirlos a mano y los archivos quedaban como adjuntos que nadie leía; acá
 * se cargan primero y el documento sale precargado.
 *
 * Tres reglas que este panel NO negocia:
 *  - Nunca inventa datos. Si la lectura falla o llega parcial, lo dice y deja la
 *    vía manual abierta; jamás rellena un hueco para que la pantalla se vea llena.
 *  - Nunca aplica solo. La extracción se muestra como propuesta y el cliente
 *    decide; `apply` es un clic explícito suyo.
 *  - El contenido de un documento son datos, no instrucciones. Acá sólo se
 *    muestran nombre de archivo y conteos, nunca texto del documento como aviso.
 *
 * Frontera: vive en `components/`, así que sólo puede importar de `lib/shared/`.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  computeDocumentTotals,
  type DocumentDraft,
} from "@/lib/shared/document-import";
import {
  createDocumentClient,
  documentText,
  DocumentRequestError,
  type DocumentClient,
  type DocumentLocale,
  type DocumentReceipt,
  type DocumentWorkspace,
} from "./document-client";
import s from "./document-import.module.css";
import { DocumentEditor } from "./DocumentEditor";

/** Lo que el servidor acepta hoy. Las fotos de WeChat hay que convertirlas antes. */
const ACCEPT = ".xlsx,.csv,.pdf";
const MAX_BYTES = 15 * 1024 * 1024;
/** Tope por workspace en `reserveUpload` (`upload:<id>`, 10 en 24 h). */
const MAX_FILES = 10;

type JobStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "review_required"
  | "ready"
  | "partial"
  | "applied"
  | "failed";

type DocumentKind = "unknown" | "invoice" | "proforma" | "packing_list" | "combined";

type FileEntry = {
  /** `requestKey` del contrato: hace idempotente el reintento del mismo archivo. */
  requestKey: string;
  file: File;
  kind: DocumentKind;
  jobId: string | null;
  status: JobStatus;
  /** Motivo legible del fallo. Nunca lleva texto del documento. */
  error: string | null;
  draft: DocumentDraft | null;
};

const TERMINAL: JobStatus[] = ["ready", "partial", "applied", "failed"];
const APPLICABLE: JobStatus[] = ["ready", "partial"];

export function documentKindLabel(kind: DocumentKind, locale: DocumentLocale): string {
  const t = (zh: string, es: string, en: string) => documentText(locale, zh, es, en);
  const known: Record<DocumentKind, string> = {
    unknown: t("自动识别", "Detectar solo", "Detect automatically"),
    invoice: t("发票", "Factura", "Invoice"),
    proforma: t("形式发票", "Factura proforma (PI)", "Proforma invoice (PI)"),
    packing_list: t("装箱单", "Packing list", "Packing list"),
    combined: t("发票加装箱单", "Factura y packing list juntos", "Invoice and packing list together"),
  };
  return known[kind];
}

export function documentStatusLabel(status: JobStatus, locale: DocumentLocale): string {
  const t = (zh: string, es: string, en: string) => documentText(locale, zh, es, en);
  const known: Record<JobStatus, string> = {
    uploading: t("上传中", "Enviando", "Uploading"),
    queued: t("排队中", "En cola", "Queued"),
    processing: t("读取中", "Leyendo", "Reading"),
    review_required: t("待人工核对", "Por revisar", "Needs review"),
    ready: t("已读取", "Leído", "Read"),
    partial: t("部分读取", "Leído en parte", "Partially read"),
    applied: t("已应用", "Aplicado", "Applied"),
    failed: t("读取失败", "No se pudo leer", "Could not read"),
  };
  return known[status];
}

/**
 * Motivo legible de un fallo. Se traduce por CÓDIGO, nunca se muestra el mensaje
 * crudo del servidor ni nada que venga del documento.
 */
export function documentErrorLabel(code: string, locale: DocumentLocale): string {
  const t = (zh: string, es: string, en: string) => documentText(locale, zh, es, en);
  const known: Record<string, string> = {
    legacy_xls: t(
      "请将 XLS 另存为 XLSX 或 PDF 后再导入。",
      "Guarda el XLS como XLSX o PDF para importarlo. El original puede quedar como adjunto.",
      "Save the XLS as XLSX or PDF to import it. The original can stay as an attachment.",
    ),
    unsupported_format: t("仅支持 XLSX、CSV 和 PDF。", "Solo admitimos XLSX, CSV y PDF.", "Only XLSX, CSV and PDF are supported."),
    file_too_large: t("文件不得超过 15 MB。", "El archivo debe pesar hasta 15 MB.", "The file must be 15 MB or less."),
    xlsx_limits: t("该 Excel 过大或已加密。", "El Excel es demasiado grande o está cifrado.", "The Excel file is too large or encrypted."),
    xlsx_external_content: t(
      "请另存为不含宏和外部链接的 XLSX。",
      "Guarda una copia sin macros ni vínculos externos.",
      "Save a copy without macros or external links.",
    ),
    invalid_xlsx: t("无法打开该 Excel。", "No pudimos abrir el Excel.", "We could not open the Excel file."),
    invalid_pdf: t("该文件不是有效的 PDF。", "El archivo no es un PDF válido.", "The file is not a valid PDF."),
    invalid_csv: t("请将 CSV 保存为 UTF-8 文本。", "Guarda el CSV como texto UTF-8.", "Save the CSV as UTF-8 text."),
    csv_encoding: t("请将 CSV 保存为 UTF-8 编码。", "Guarda el CSV con codificación UTF-8.", "Save the CSV with UTF-8 encoding."),
    signature_mismatch: t("文件内容与扩展名不符。", "El contenido no corresponde a la extensión del archivo.", "The content does not match the file extension."),
    size_mismatch: t("上传不完整，请重新上传。", "La carga quedó incompleta. Vuelve a cargar el archivo.", "The upload was incomplete. Upload the file again."),
    upload_session_expiring: t(
      "本次会话即将过期，请重新开始导入。",
      "Esta sesión está por vencer. Abre una importación nueva.",
      "This session is about to expire. Start a new import.",
    ),
    configuration_missing: t(
      "文档读取暂不可用，可手动填写。",
      "La lectura de documentos no está disponible. Puedes completar los datos a mano.",
      "Document reading is unavailable. You can fill in the data manually.",
    ),
    not_configured: t(
      "文档读取暂不可用，可手动填写。",
      "La lectura de documentos no está disponible. Puedes completar los datos a mano.",
      "Document reading is unavailable. You can fill in the data manually.",
    ),
  };
  return (
    known[code] ??
    t(
      "无法读取该文件。可手动填写，原件仍可作为附件保留。",
      "No pudimos leer este archivo. Puedes completar los datos a mano; el original queda como adjunto.",
      "We could not read this file. You can fill in the data manually; the original stays as an attachment.",
    )
  );
}

export function DocumentImportPanel(props: Parameters<typeof DocumentImportSession>[0]) {
  const workspaceId = props.workspace?.id ?? null;
  const [identity, setIdentity] = useState(() => ({
    workspaceId,
    openedId: null as string | null,
    generation: 0,
  }));
  if (workspaceId !== identity.workspaceId) {
    // Abrir desde null pertenece a esta carga; cambiar de compra crea otra sesión.
    const openedHere = identity.workspaceId === null && workspaceId !== null && workspaceId === identity.openedId;
    setIdentity({ workspaceId, openedId: null, generation: identity.generation + (openedHere ? 0 : 1) });
  }
  const onWorkspace = props.onWorkspace;
  const publishWorkspace = useCallback((next: DocumentWorkspace) => {
    setIdentity((current) => current.workspaceId === null ? { ...current, openedId: next.id } : current);
    onWorkspace(next);
  }, [onWorkspace]);
  return <DocumentImportSession key={identity.generation} {...props} onWorkspace={publishWorkspace} />;
}

function DocumentImportSession({
  workspace,
  openParams,
  onWorkspace,
  onManual,
  onReview,
  locale = "es",
  client,
  pollMs = 2500,
  canReview = true,
}: {
  /** Workspace ya abierto. Si falta, el panel lo abre con la primera carga. */
  workspace: DocumentWorkspace | null;
  /**
   * Con qué compra se abre el workspace: `purchaseCode` o `purchaseId` desde el
   * portal. Sin esto el servidor abre uno ANÓNIMO, que expira en 24 h y no queda
   * ligado a la compra — el documento se perdería.
   */
  openParams?: Record<string, unknown>;
  /** Cada cambio de revisión sube al dueño del estado; el panel no lo posee. */
  onWorkspace: (workspace: DocumentWorkspace) => void;
  /** "Prefiero llenarlo a mano": la alternativa manual nunca se cierra. */
  onManual?: () => void;
  /** "Revisar documento": el dueño decide a qué pantalla lleva. */
  onReview?: () => void;
  locale?: DocumentLocale;
  /** Inyección explícita sólo para pruebas y fixtures. */
  client?: DocumentClient;
  pollMs?: number;
  canReview?: boolean;
}) {
  const t = (zh: string, es: string, en: string) => documentText(locale, zh, es, en);
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [over, setOver] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Inicializador perezoso en vez de un ref: crea el transporte UNA sola vez sin
  // leer `.current` durante el render, que es lo que React desaconseja.
  const [transport] = useState<DocumentClient>(() => client ?? createDocumentClient());
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const patch = useCallback(
    (requestKey: string, next: Partial<FileEntry>) => {
      if (!active.current) return;
      setEntries((prev) =>
        prev.map((e) => (e.requestKey === requestKey ? { ...e, ...next } : e)),
      );
    },
    [],
  );

  /** Traduce cualquier fallo a un motivo legible, sin filtrar el mensaje crudo. */
  const reason = useCallback(
    (error: unknown) =>
      error instanceof DocumentRequestError
        ? documentErrorLabel(error.code, locale)
        : documentErrorLabel("unknown", locale),
    [locale],
  );

  async function ensureWorkspace(): Promise<DocumentWorkspace | null> {
    if (workspace) return workspace;
    const opened = await transport.post<{
      workspace: DocumentWorkspace;
      anonymousToken?: string;
    }>("open", { ...openParams });
    if (!active.current) return null;
    if (opened.anonymousToken) transport.setAnonymousToken(opened.anonymousToken);
    onWorkspace(opened.workspace);
    return opened.workspace;
  }

  async function send(entry: FileEntry, target: DocumentWorkspace) {
    if (!active.current) return;
    const reserved = await transport.post<{
      jobId: string;
      status: JobStatus;
      uploadUrl?: string;
      contentType?: string;
    }>("upload", {
      workspaceId: target.id,
      requestKey: entry.requestKey,
      fileName: entry.file.name,
      sizeBytes: entry.file.size,
      kind: entry.kind,
    });
    if (!active.current) return;
    patch(entry.requestKey, { jobId: reserved.jobId, status: reserved.status });
    // Sin uploadUrl el archivo ya estaba recibido: reintento idempotente.
    if (reserved.uploadUrl && reserved.contentType) {
      await transport.upload(reserved.uploadUrl, entry.file, reserved.contentType);
    }
    if (!active.current) return;
    const finished = await transport.post<{ jobId: string; status: JobStatus }>(
      "uploaded",
      { workspaceId: target.id, jobId: reserved.jobId },
    );
    patch(entry.requestKey, { status: finished.status });
  }

  async function add(files: FileList | File[]) {
    if (!active.current) return;
    setPanelError(null);
    const chosen = Array.from(files);
    if (!chosen.length) return;
    if (entries.length + chosen.length > MAX_FILES) {
      setPanelError(
        t(
          `每次导入最多 ${MAX_FILES} 个文件。`,
          `Puedes importar hasta ${MAX_FILES} archivos por compra.`,
          `You can import up to ${MAX_FILES} files per purchase.`,
        ),
      );
      return;
    }
    const tooBig = chosen.find((f) => f.size > MAX_BYTES || f.size === 0);
    if (tooBig) {
      setPanelError(documentErrorLabel("file_too_large", locale));
      return;
    }
    const nuevos: FileEntry[] = chosen.map((file) => ({
      requestKey: transport.id(),
      file,
      kind: "unknown",
      jobId: null,
      status: "uploading",
      error: null,
      draft: null,
    }));
    setEntries((prev) => [...prev, ...nuevos]);
    setBusy(true);
    try {
      const target = await ensureWorkspace();
      if (!active.current || !target) return;
      for (const entry of nuevos) {
        if (!active.current) return;
        try {
          await send(entry, target);
        } catch (error) {
          patch(entry.requestKey, { status: "failed", error: reason(error) });
        }
      }
    } catch (error) {
      if (!active.current) return;
      setPanelError(reason(error));
      setEntries((prev) =>
        prev.map((e) =>
          nuevos.some((n) => n.requestKey === e.requestKey)
            ? { ...e, status: "failed", error: reason(error) }
            : e,
        ),
      );
    } finally {
      if (active.current) {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  /** Sondeo de los trabajos en vuelo. Se detiene solo cuando no queda ninguno. */
  useEffect(() => {
    const pendientes = entries.filter(
      (e) => e.jobId && (!TERMINAL.includes(e.status) || (APPLICABLE.includes(e.status) && !e.draft)),
    );
    if (!pendientes.length || !workspace) return;
    let vivo = true;
    async function poll() {
      for (const entry of pendientes) {
        if (!vivo) return;
        try {
          const { job } = await transport.get<{
            job: { status: JobStatus; result: DocumentDraft | null; errorCode: string | null };
          }>("job", { workspaceId: workspace.id, jobId: entry.jobId! });
          if (!vivo) return;
          patch(entry.requestKey, {
            status: job.status,
            draft: job.result,
            error:
              job.status === "failed"
                ? documentErrorLabel(job.errorCode ?? "unknown", locale)
                : null,
          });
        } catch {
          // No invalida el archivo. El siguiente tick se programa también tras el fallo.
        }
      }
      if (vivo) timer = setTimeout(poll, pollMs);
    }
    let timer = setTimeout(poll, pollMs);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [entries, workspace, transport, patch, locale, pollMs]);

  async function apply(entry: FileEntry) {
    if (!active.current || !workspace || !entry.jobId) return;
    setBusy(true);
    setPanelError(null);
    try {
      // `apply` devuelve un RECIBO (revisión, folio), NO el workspace: la
      // extracción se fusiona del lado del servidor y el borrador resultante
      // sólo vive allá. Tipar la respuesta como workspace era mentira — subía
      // un objeto sin `id` ni `draft`, y el editor de arriba se quedaba vacío.
      await transport.post<DocumentReceipt>("apply", {
        workspaceId: workspace.id,
        jobId: entry.jobId,
        expectedRevision: workspace.revision,
        commandId: transport.id(),
      });
      if (!active.current) return;
      patch(entry.requestKey, { status: "applied" });
      // Aplicado ya está: se marca antes de releer para no perder ese hecho si
      // la relectura falla. Sin el borrador nuevo no hay nada que subir.
      const fresco = await transport.get<{ workspace: DocumentWorkspace }>("workspace", {
        workspaceId: workspace.id,
      });
      if (active.current) onWorkspace(fresco.workspace);
    } catch (error) {
      if (active.current) setPanelError(reason(error));
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const listos = entries.filter((e) => APPLICABLE.includes(e.status));
  const enVuelo = entries.some((e) => !TERMINAL.includes(e.status) || (APPLICABLE.includes(e.status) && !e.draft));

  return (
    <section
      className={[s.root, s.stack].join(" ")}
      lang={locale === "zh" ? "zh-CN" : locale}
      aria-labelledby={`${uid}-title`}
    >
      <div className={s.stack}>
        <h2 id={`${uid}-title`}>
          {t("上传文件，我们来填写", "Carga tus documentos y los llenamos", "Upload your documents and we fill them in")}
        </h2>
        <p className={s.muted}>
          {t(
            "上传形式发票或装箱单，我们会读取产品、箱数、重量和体积，供你核对后再发送给供应商。",
            "Sube la factura, el PI o el packing list. Leemos productos, cajas, peso y volumen para que los revises antes de enviarle el enlace a tu proveedor.",
            "Upload the invoice, PI or packing list. We read products, cartons, weight and volume for you to review before sharing the link with your supplier.",
          )}
        </p>
      </div>

      <p className={s.notice}>
        {t(
          "文件将保密保存，用于填写本次采购资料。如需辅助读取，会将文件内容发送至 Anthropic。请勿上传银行账号、身份证件或与货物无关的数据。",
          "Guardamos estos archivos de forma privada para preparar tu Packing List + Factura. Si requieren lectura asistida, enviamos su contenido a Anthropic. Evita incluir datos bancarios, documentos de identidad o información ajena a la mercancía.",
          "Files are stored privately to prepare your Packing List + Invoice. If assisted reading is needed, their content is sent to Anthropic. Avoid including bank details, identity documents or information unrelated to the goods.",
        )}
      </p>

      <div
        className={s.drop}
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
        }}
      >
        <label className={s.dropTitle} htmlFor={`${uid}-file`}>
          {t("选择文件或拖放到此处", "Elige tus archivos o suéltalos aquí", "Choose your files or drop them here")}
        </label>
        <input
          ref={inputRef}
          id={`${uid}-file`}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {t("选择文件", "Elegir archivos", "Choose files")}
        </button>
        <p className={s.chips} aria-label={t("支持的格式", "Formatos admitidos", "Supported formats")}>
          <span className={s.chip}>XLSX</span>
          <span className={s.chip}>CSV</span>
          <span className={s.chip}>PDF</span>
          <span className={s.chip}>15 MB</span>
        </p>
        <p className={s.muted}>
          {t(
            "扫描件也可以读取。微信里的照片请先转成 PDF。",
            "Los PDF escaneados también se leen. Si el proveedor te mandó fotos por WeChat, conviértelas a PDF antes de subirlas.",
            "Scanned PDFs work too. If your supplier sent photos over WeChat, convert them to PDF first.",
          )}
        </p>
      </div>

      <p className={s.notice}>
        {t(
          "读取需要一点时间。期间你可以继续填写其他内容。",
          "La lectura tarda un momento. Mientras tanto puedes seguir con el resto de la compra.",
          "Reading takes a moment. Meanwhile you can continue with the rest of the purchase.",
        )}
      </p>

      {panelError && (
        <p className={[s.notice, s.error].join(" ")} role="alert">
          {panelError}
        </p>
      )}

      {entries.length > 0 && (
        <section className={[s.card, s.stack].join(" ")} aria-label={t("文件", "Archivos", "Files")}>
          <div aria-live="polite">
            {entries.map((entry) => {
              const totals = entry.draft ? computeDocumentTotals(entry.draft) : null;
              return (
                <div key={entry.requestKey} className={s.file}>
                  <div className={s.fileRow}>
                    <span className={s.fileName}>{entry.file.name}</span>
                    <span className={s.badge}>{documentStatusLabel(entry.status, locale)}</span>
                  </div>

                  {entry.status === "uploading" && !entry.jobId && (
                    <label className={s.field}>
                      <span>{t("文件类型", "Tipo de documento", "Document type")}</span>
                      <select
                        value={entry.kind}
                        disabled={busy}
                        onChange={(e) =>
                          patch(entry.requestKey, { kind: e.target.value as DocumentKind })
                        }
                      >
                        {(
                          ["unknown", "proforma", "invoice", "packing_list", "combined"] as const
                        ).map((kind) => (
                          <option key={kind} value={kind}>
                            {documentKindLabel(kind, locale)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {totals && (
                    <p className={s.muted}>
                      {entry.draft!.products.length} {t("个产品", "productos", "products")} ·{" "}
                      {totals.cartons ?? t("待补充", "pendiente", "pending")}{" "}
                      {t("箱", "cajas", "cartons")} ·{" "}
                      {totals.grossWeightKg ?? t("待补充", "pendiente", "pending")} kg ·{" "}
                      {totals.cbm ?? t("待补充", "pendiente", "pending")} m³
                    </p>
                  )}
                  {entry.draft&&<details className={s.card}><summary>{t("查看提取的数据","Ver datos detectados","View detected data")}</summary><DocumentEditor draft={entry.draft} locale={locale} readOnly/></details>}

                  {entry.status === "partial" && (
                    <p className={s.muted}>
                      {t(
                        "部分数据未能读取，请逐项核对后补充。",
                        "Parte del documento no se pudo leer. Revisa y completa lo que falte.",
                        "Part of the document could not be read. Review and complete what is missing.",
                      )}
                    </p>
                  )}

                  {entry.error && (
                    <p className={[s.notice, s.error].join(" ")} role="alert">
                      {entry.error}
                    </p>
                  )}

                  {APPLICABLE.includes(entry.status) && (
                    <div className={s.actions}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || !entry.draft}
                        onClick={() => { if(entry.draft)void apply(entry); }}
                      >
                        {t("应用到文件", "Aplicar al documento", "Apply to the document")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className={s.muted}>
            {t(
              "读取结果仅为建议，需你确认后才会写入文件。",
              "Lo extraído es una propuesta: no se escribe en tu documento hasta que lo apliques.",
              "Extracted data is a proposal: nothing is written to your document until you apply it.",
            )}
          </p>
        </section>
      )}

      <div className={s.actions}>
        {onReview && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || enVuelo || !canReview || (!workspace && listos.length === 0)}
            onClick={onReview}
          >
            {t("查看文件", "Revisar documento", "Review document")}
          </button>
        )}
        {onManual && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onManual}>
            {t("手动填写", "Prefiero llenarlo a mano", "I would rather fill it in manually")}
          </button>
        )}
      </div>
    </section>
  );
}
