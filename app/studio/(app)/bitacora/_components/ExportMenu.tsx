"use client";

/**
 * ExportMenu · descarga de la Vista Lista (SDD-0146 · Fase 7).
 *
 * Menú de 2 opciones — "Reporte (HTML)" y "Datos (CSV)" — que descarga desde la
 * route `/api/studio/bitacora/export?tipo=tareas`. Respeta los filtros activos de
 * la Lista (llegan por `filterParams`). Descarga vía fetch+blob para poder
 * mostrar spinner mientras genera y un toast si algo falla (la route devuelve
 * `{ error }` con status ≠ 200).
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

interface Props {
  /** Filtros activos de la Lista → query params (ej. `{ tipoTarea: "entregable_cliente" }`). */
  filterParams: Record<string, string>;
}

export function ExportMenu({ filterParams }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "html" | "csv">(null);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al click afuera / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(formato: "html" | "csv") {
    setOpen(false);
    setBusy(formato);
    try {
      const qs = new URLSearchParams({ tipo: "tareas", formato, ...filterParams });
      const res = await fetch(`/api/studio/bitacora/export?${qs.toString()}`);
      if (!res.ok) {
        let msg = "No se pudo generar la descarga.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* respuesta no-JSON */
        }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const filename =
        filenameFromDisposition(res.headers.get("Content-Disposition")) ??
        (formato === "csv" ? "tareas.csv" : "tareas.html");
      triggerDownload(blob, filename);
    } catch {
      toast.error("No se pudo generar la descarga. Reintenta.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="studio-btn studio-btn-ghost"
        onClick={() => setOpen((o) => !o)}
        disabled={busy != null}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy != null ? (
          <span
            className="studio-spin"
            aria-hidden
            style={{
              width: 13,
              height: 13,
              border: "2px solid var(--border-strong)",
              borderTopColor: "var(--wine)",
              borderRadius: "50%",
            }}
          />
        ) : (
          Icon.download(14)
        )}
        {busy != null ? "Generando…" : "Exportar"}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Exportar tareas"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 30,
            minWidth: 208,
            padding: 6,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <MenuItem
            label="Reporte (HTML)"
            hint="Para ver o imprimir"
            onClick={() => run("html")}
          />
          <MenuItem
            label="Datos (CSV)"
            hint="Abre en Excel"
            onClick={() => run("csv")}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="studio-tracking-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: "var(--r-sm)",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <span style={{ color: "var(--ink-soft)", flexShrink: 0 }}>
        {Icon.download(14)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "700 12.5px/1.3 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}

/** Extrae el filename del header Content-Disposition (o null). */
function filenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m ? m[1] : null;
}

/** Dispara la descarga de un Blob en el cliente (sin lib externa). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
