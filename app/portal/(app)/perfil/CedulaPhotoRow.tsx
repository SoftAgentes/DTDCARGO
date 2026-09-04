"use client";

import { useActionState, useRef } from "react";
import { CheckIcon } from "@/components/Icon";
import {
  uploadCedulaPhotoAction,
  type CedulaPhotoActionState,
} from "./actions";
import Link from "next/link";
import {
  profileEditQuotaLabel,
  type ProfileEditQuota,
} from "@/lib/portal/profile-edit-quota";

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
  quota,
}: {
  label: string;
  /** Signed URL de la foto ya cargada, o null si falta. */
  viewUrl: string | null;
  quota: ProfileEditQuota;
}) {
  const [state, action, pending] = useActionState(
    uploadCedulaPhotoAction,
    initial,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const done = !!viewUrl;
  const canChoose = !done || (quota.available && quota.remaining > 0);

  return (
    <div>
      {/* Pendiente → borde izquierdo ámbar (SDD-0151): que la fila resalte, no
          solo el punto tenue. Cargada → borde neutro. */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-[10px] bg-paper border border-grey-200 px-4 py-3 sm:flex-nowrap"
        style={
          done
            ? undefined
            : {
                borderLeftWidth: "3px",
                borderLeftColor: "var(--color-status-warning)",
              }
        }
      >
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

        <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
          {done ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 px-1 inline-flex items-center text-[12.5px] font-bold text-wine-text hover:text-wine-deep"
            >
              Ver
            </a>
          ) : (
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-grey-700">
              Pendiente
            </span>
          )}

          {canChoose ? (
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
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={() => {
                // Limpiar el value antes de abrir el picker: re-elegir el MISMO
                // archivo tras un error no dispara onChange (browser estándar).
                if (fileRef.current) fileRef.current.value = "";
                fileRef.current?.click();
              }}
              className="min-h-11 px-1 text-[12.5px] font-semibold text-wine-text hover:text-wine-deep disabled:opacity-60"
            >
              {pending ? "Subiendo…" : done ? "Cambiar foto" : "Subir foto"}
            </button>
          </form>
          ) : done ? (
            <span className="text-[11.5px] font-semibold text-grey-500">
              {quota.available ? "Cupo agotado" : "No disponible"}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-[12px] text-grey-500 leading-[1.5]">
        JPG, PNG, WebP o HEIC · máximo 8 MB. La foto queda privada y la usa el
        equipo de DTD para verificar tu identidad. {done ? profileEditQuotaLabel(quota) + "." : "La primera carga no usa tu cupo."}
      </p>
      {done && (!quota.available || quota.remaining === 0) ? (
        <Link
          href="/portal/soporte?tema=datos"
          className="min-h-11 inline-flex items-center text-[12px] font-semibold text-wine-text hover:text-wine-deep"
        >
          Solicitar ayuda para corregir el documento
        </Link>
      ) : null}

      {/* role="status" SIEMPRE montado (texto condicional adentro): varios
          lectores de pantalla no anuncian regiones que nacen junto con su
          contenido (WCAG 4.1.3 · mismo patrón que CopyCodeButton). */}
      <p
        role="status"
        // SDD-0261 · `text-status-danger` y no `text-wine-text` (3,00:1 sobre card en
        // oscuro · BTN-01 §2: el vino no sustituye danger). Éste NO usa
        // `<PortalFieldError>` a propósito: partirlo en un nodo condicional
        // reintroduciría justo el bug que el comentario de arriba evita —la
        // región debe nacer montada—. Queda sin el ícono que pide ERR-01, con el
        // motivo declarado, en vez de romper una decisión de accesibilidad ya
        // tomada. Su ícono es el slice que sigue.
        className={`text-[12px] leading-[1.4] ${state.error ? "mt-1.5 text-status-danger" : state.ok && !done ? "mt-1.5" : ""}`}
        style={
          !state.error && state.ok && !done
            ? { color: "var(--color-status-success)" }
            : undefined
        }
      >
        {state.error
          ? state.error
          : state.ok
            ? done
              ? "Foto actualizada."
              : "Foto recibida. Tu asesor la revisa antes de tu primera carga."
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
