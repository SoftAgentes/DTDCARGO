"use client";

/**
 * Botón de descarga de un .zip del centro de marca (SDD-0238).
 *
 * POR QUÉ NO ES UN `<a download>`: el servidor arma el paquete al vuelo bajando
 * los archivos de Storage uno por uno. Con el Brand Book adentro (13,5 MB) eso
 * tarda varios segundos EN SILENCIO — el usuario clickea, no pasa nada visible,
 * y vuelve a clickear. Bajando por `fetch` sabemos cuándo empezó y cuándo
 * terminó, y podemos decirlo.
 *
 * Si algo falla, el servidor responde texto plano legible (413 = muy pesado,
 * 404 = ya no está) y se muestra tal cual, en vez de dejar al usuario mirando
 * un botón que no hizo nada.
 */

import { useRef, useState } from "react";
import { CheckIcon, DownloadIcon } from "@/components/Icon";

type Props = {
  /** Ruta del endpoint que devuelve el .zip. */
  href: string;
  /** Nombre con el que se guarda (sin `.zip`). */
  filename: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** `aria-label` cuando el contenido visible no alcanza. */
  ariaLabel?: string;
};

export function ZipButton({
  href,
  filename,
  children,
  className = "btn btn-primary",
  style,
  disabled,
  ariaLabel,
}: Props) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  // Se limpia al desmontar y entre descargas: un objectURL vivo retiene el blob
  // entero en memoria.
  const urlRef = useRef<string | null>(null);

  async function download() {
    if (state === "working") return;
    setError(null);
    setState("working");
    try {
      const response = await fetch(href);
      if (!response.ok) {
        setError((await response.text()) || "No se pudo preparar la descarga.");
        setState("idle");
        return;
      }
      const blob = await response.blob();

      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = urlRef.current;
      a.download = `${filename}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setState("done");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setError("Se cortó la descarga. Prueba otra vez.");
      setState("idle");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={download}
        disabled={disabled || state === "working"}
        aria-busy={state === "working"}
        aria-label={ariaLabel}
        className={`${className} disabled:opacity-60`}
        style={style}
      >
        {state === "working" ? (
          <>
            <Spinner /> Preparando…
          </>
        ) : state === "done" ? (
          <>
            <CheckIcon size={16} /> Descargado
          </>
        ) : (
          <>
            {children} <DownloadIcon size={16} />
          </>
        )}
      </button>

      {error && (
        <span role="alert" className="text-[12.5px] leading-[1.4] max-w-[42ch]"
          style={{ color: "var(--color-status-danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        display: "inline-block",
        animation: "marca-spin 0.7s linear infinite",
      }}
    />
  );
}
