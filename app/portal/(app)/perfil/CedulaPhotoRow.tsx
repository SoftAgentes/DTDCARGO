"use client";

import { useActionState, useRef } from "react";
import { CheckIcon } from "@/components/Icon";
import {
  uploadCedulaPhotoAction,
  type CedulaPhotoActionState,
} from "./actions";

const initial: CedulaPhotoActionState = {};

/**
 * Fila de documento "Cédula / RIF" de Identidad y documentos (Norte docRow ·
 * SDD-0145). Dos estados:
 *  - Cargada  → check verde + "Ver" (signed URL server-side, 1h).
 *  - Pendiente → subida inline (picker + auto-submit, mismo patrón que
 *    AvatarEditor). Reemplaza al form "Completa tu perfil" para la foto.
 */
export function CedulaPhotoRow({
  label,
  viewUrl,
}: {
  label: string;
  /** Signed URL de la foto ya cargada, o null si falta. */
  viewUrl: string | null;
}) {
  const [state, action, pending] = useActionState(
    uploadCedulaPhotoAction,
    initial,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const done = !!viewUrl;

  return (
    <div>
      <div className="flex items-center gap-3 rounded-[10px] bg-paper border border-grey-200 px-4 py-3">
        <span
          className="flex-shrink-0"
          style={{
            color: done
              ? "var(--color-status-success)"
              : "var(--color-status-warning)",
          }}
          aria-hidden
        >
          {done ? <CheckIcon size={16} /> : <DotIcon />}
        </span>
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-ink">
          {label}
        </span>

        {done ? (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[12.5px] font-bold text-wine hover:text-wine-deep"
          >
            Ver
          </a>
        ) : (
          <form action={action} className="flex items-center gap-3 flex-shrink-0">
            <input
              ref={fileRef}
              type="file"
              name="cedula_photo"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                if (e.currentTarget.files?.length)
                  e.currentTarget.form?.requestSubmit();
              }}
            />
            {/* grey-700: --color-status-warning sobre paper no llega a 4.5:1
                en tema claro (AA texto pequeño); el ámbar queda en el punto. */}
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-grey-700">
              Pendiente
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // Limpiar el value antes de abrir el picker: re-elegir el MISMO
                // archivo tras un error no dispara onChange (browser estándar).
                if (fileRef.current) fileRef.current.value = "";
                fileRef.current?.click();
              }}
              className="text-[12.5px] font-semibold text-wine hover:text-wine-deep disabled:opacity-60"
            >
              {pending ? "Subiendo…" : "Subir foto"}
            </button>
          </form>
        )}
      </div>

      {/* role="status" SIEMPRE montado (texto condicional adentro): varios
          lectores de pantalla no anuncian regiones que nacen junto con su
          contenido (WCAG 4.1.3 · mismo patrón que CopyCodeButton). */}
      <p
        role="status"
        className={`text-[12px] leading-[1.4] ${state.error ? "mt-1.5 text-wine" : state.ok && !done ? "mt-1.5" : ""}`}
        style={
          !state.error && state.ok && !done
            ? { color: "var(--color-status-success)" }
            : undefined
        }
      >
        {state.error
          ? state.error
          : state.ok && !done
            ? "Foto recibida. Tu asesor la revisa antes de tu primera carga."
            : ""}
      </p>
    </div>
  );
}

/** Punto "pendiente" (sin dependencia de icon set — círculo relleno 8px). */
function DotIcon() {
  return (
    <span
      className="block h-2 w-2 rounded-full"
      style={{ background: "currentColor" }}
    />
  );
}
