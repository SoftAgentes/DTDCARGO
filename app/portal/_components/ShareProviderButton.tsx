"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, WhatsAppIcon } from "@/components/Icon";
import { buildProviderLinkMessage } from "@/lib/portal/provider-link-message";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

// Mismo anillo de foco que `.btn:focus-visible` (globals.css): 3px ink, offset 2.
// Sin `outline-none` de base: en Tailwind v4 anula el estilo y el anillo no se ve.
const FOCUS_RING =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";

// Acciones secundarias como texto subrayado: se ven, pero no compiten con el
// botón principal. `min-h-11` da 44px de área táctil sin agrandar el texto.
const QUIET_ACTION = `inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-ink underline decoration-grey-500 underline-offset-4 hover:decoration-ink ${FOCUS_RING}`;

type Feedback = "link" | "message" | "failed-link" | "failed-message" | null;

const FAILED_TEXT = {
  "failed-link":
    "No se pudo copiar. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado.",
  "failed-message":
    "No se pudo copiar el mensaje. El enlace quedó seleccionado: cópialo con Ctrl+C o mantén presionado; la página ya está en chino.",
} as const;

/**
 * Enlace del proveedor (SDD-0057 ext · Fase 1, rediseño SDD-0468). Arma el link
 * público `/p/{token}` (Factura + Packing List, etiquetas y dirección del
 * almacén, sin login) para que el cliente lo pegue en el chat con su proveedor.
 *
 * Jerarquía: UNA acción principal. El campo muestra el enlace y el botón lo
 * copia tal cual —la función de siempre, un clic—. Debajo, en texto, las dos
 * alternativas: copiarlo con el mensaje en chino (WeChat, donde está el
 * proveedor) o mandarlo por WhatsApp con ese mismo mensaje.
 *
 * El origin se resuelve en el cliente con `useSyncExternalStore` y snapshot SSR
 * vacío (contrato SDD-0206: evita mismatch de hidratación).
 */
export function ShareProviderButton({ token }: { token: string }) {
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const url = origin ? `${origin}/p/${token}` : "";
  const message = url ? buildProviderLinkMessage(url) : "";
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy(kind: "link" | "message") {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(kind === "link" ? url : message);
      setFeedback(kind);
      window.setTimeout(
        () => setFeedback((current) => (current === kind ? null : current)),
        2000,
      );
    } catch {
      // Sin portapapeles: el enlace queda enfocado Y seleccionado. Sin focus()
      // la selección vive en un campo sin foco y Ctrl+C copia desde el botón.
      // Aun sin el mensaje, el enlace sirve: la página del proveedor está en chino.
      inputRef.current?.focus();
      inputRef.current?.select();
      setFeedback(kind === "link" ? "failed-link" : "failed-message");
    }
  }

  const failed = feedback === "failed-link" || feedback === "failed-message";

  return (
    <section aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="m-0 text-lg font-bold leading-snug text-ink">
        Solicita la factura y el packing list a tu proveedor
      </h2>
      <p id={`${inputId}-description`} className="mt-2 mb-4 max-w-prose text-base leading-relaxed text-grey-700">
        Comparte este enlace en su chat. Tu proveedor completa los datos de la
        mercancía, adjunta archivos y encuentra sus etiquetas y dirección de entrega.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Enlace para tu proveedor
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          readOnly
          value={url}
          aria-describedby={`${inputId}-description ${inputId}-feedback`}
          placeholder="Preparando enlace…"
          onFocus={(e) => e.currentTarget.select()}
          className={`h-12 min-w-0 flex-1 truncate rounded-lg border border-grey-200 bg-grey-100 px-4 text-base text-ink ${FOCUS_RING}`}
          style={{ fontFamily: MONO }}
        />
        <button
          type="button"
          onClick={() => copy("link")}
          disabled={!url}
          className="btn btn-primary inline-flex flex-shrink-0 items-center gap-2 disabled:opacity-60"
        >
          {feedback === "link" ? (
            <>
              Enlace copiado <CheckIcon size={15} />
            </>
          ) : (
            "Copiar enlace"
          )}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-grey-700">
        Se abre sin crear una cuenta. Comienza en chino y permite elegir español o inglés.
      </p>

      <div className="flex flex-wrap items-center gap-x-5">
        <button
          type="button"
          onClick={() => copy("message")}
          disabled={!url}
          className={`${QUIET_ACTION} disabled:opacity-60`}
        >
          {feedback === "message" ? (
            <>
              Mensaje copiado <CheckIcon size={13} />
            </>
          ) : (
            "Copiar mensaje en chino"
          )}
        </button>
        <a
          href={url ? waLink : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          className={`${QUIET_ACTION} ${url ? "" : "pointer-events-none opacity-60"}`}
        >
          <WhatsAppIcon size={14} /> Enviar por WhatsApp
        </a>
      </div>

      <p
        id={`${inputId}-feedback`}
        role="status"
        aria-live="polite"
        className={failed ? "mt-2 text-sm leading-relaxed text-ink" : "sr-only"}
      >
        {feedback === "failed-link" || feedback === "failed-message"
          ? FAILED_TEXT[feedback]
          : feedback === "link"
            ? "Enlace copiado"
            : feedback === "message"
              ? "Mensaje copiado"
              : ""}
      </p>
    </section>
  );
}
