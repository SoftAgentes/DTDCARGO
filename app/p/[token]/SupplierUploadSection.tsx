"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/Icon";

const BRAND_CJK = "var(--font-archivo), var(--font-noto-sc)";

/** Formatos aceptados (matchea el bucket ampliado en migr 0147). */
const ACCEPT = "image/*,.xlsx,.xls,.csv,.pdf,.doc,.docx";

type UploadState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; uploaded: number }
  | { kind: "error"; message: string };

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * SDD-0096 · Zona de subida de archivos del PROVEEDOR en /p/{token}: fotos del
 * producto + (si tuvo problemas online) el Excel llenado + cualquier otro
 * documento. POST multipart a /p/{token}/upload (cada archivo en el campo
 * "files"). Estilo del sitio público. Bilingüe ZH/ES.
 */
export function SupplierUploadSection({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  // Al confirmar la subida llevamos foco/scroll al panel de éxito para anunciarlo.
  useEffect(() => {
    if (state.kind === "ok" && okRef.current) {
      okRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      okRef.current.focus();
    }
  }, [state.kind]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    setFiles(picked);
    if (state.kind !== "idle") setState({ kind: "idle" });
  }

  function clearAll() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    setState({ kind: "idle" });
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setState({ kind: "sending" });
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("empresa_web", ""); // honeypot

      const res = await fetch(`/p/${token}/upload`, {
        method: "POST",
        body: fd,
      });

      let data: { ok?: boolean; uploaded?: number; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        /* sin JSON → genérico abajo */
      }

      if (res.ok && data.ok) {
        setState({ kind: "ok", uploaded: data.uploaded ?? files.length });
        clearInput();
        return;
      }

      setState({
        kind: "error",
        message:
          data.error ??
          "No pudimos subir tus archivos. Revisa el formato y el tamaño (máx. 15 MB). / 上传失败，请检查格式和大小（最大 15 MB）。",
      });
    } catch {
      setState({
        kind: "error",
        message:
          "No pudimos conectar. Revisa tu conexión e intenta de nuevo. / 网络连接失败，请重试。",
      });
    }
  }

  function clearInput() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const sending = state.kind === "sending";

  return (
    <section
      className="no-print mt-3 bg-white border border-grey-200 rounded-[16px] p-6"
      style={{ fontFamily: BRAND_CJK }}
    >
      <div className="text-[15px] font-bold text-ink" lang="zh">
        上传照片和文件{" "}
        <span lang="es" className="text-grey-500 font-semibold">
          · Subir fotos de productos y documentos
        </span>
      </div>
      <p
        className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.55] max-w-[58ch]"
        lang="zh"
      >
        上传产品照片；如在线填写有问题，可在此上传填好的 Excel 或其他文件。
        <span lang="es" className="block text-grey-500 mt-1">
          Sube fotos de tus productos y, si tuviste problemas online, el Excel
          llenado o cualquier otro documento aquí.
        </span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label
          htmlFor="supplier-files"
          className="btn btn-ghost cursor-pointer inline-flex items-center gap-2"
        >
          选择文件 · Elegir archivos
          <input
            id="supplier-files"
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={onPick}
            aria-label="Elegir archivos para subir / 选择文件"
            className="sr-only"
          />
        </label>
        {files.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[12.5px] font-semibold text-grey-500 underline underline-offset-2 hover:text-ink"
          >
            清空 · Quitar todo
          </button>
        )}
      </div>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-grey-200 bg-grey-100 px-3 py-2"
            >
              <span className="text-[12.5px] text-ink truncate">{f.name}</span>
              <span className="text-[11px] text-grey-500 flex-shrink-0">
                {fmtSize(f.size)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={okRef}
        tabIndex={state.kind === "ok" ? -1 : undefined}
        role="status"
        aria-live="polite"
        className="outline-none"
      >
        {state.kind === "ok" && (
          <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <CheckIcon size={15} />
            <span lang="zh">
              已上传 {state.uploaded} 个文件 ·{" "}
              <span lang="es" className="font-semibold">
                Subimos {state.uploaded} archivo{state.uploaded === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        )}
        {state.kind === "error" && (
          <p className="mt-4 text-[12.5px] leading-[1.55] text-wine">
            {state.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={sending || files.length === 0}
        className="btn btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-60"
      >
        {sending ? "上传中… · Subiendo…" : "上传 · Subir"}
      </button>
    </section>
  );
}
