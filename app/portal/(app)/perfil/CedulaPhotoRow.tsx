"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";
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
 * SDD-0145). Tres estados:
 *  - Pendiente → subida inline (picker + auto-submit, mismo patrón que
 *    AvatarEditor). La primera carga no usa cupo.
 *  - Cargada con cupo → check verde + "Ver" (signed URL server-side, 60 s) +
 *    "Cambiar foto" con confirmación: reemplazar usa 1 de los 3 cambios de
 *    perfil y tu asesor revisa la nueva (SDD-0481).
 *  - Cargada sin cupo (o cupo ilegible) → sin reemplazo; conduce a soporte.
 */
export function CedulaPhotoRow({
  label,
  hasExistingPhoto,
  viewUrl,
  quota,
}: {
  label: string;
  /** Existencia persistida; no depende de que la firma temporal haya servido. */
  hasExistingPhoto: boolean;
  /** Signed URL temporal, o null si no pudo firmarse. */
  viewUrl: string | null;
  /** Cupo compartido de 3 cambios. Ilegible → el reemplazo falla cerrado. */
  quota: ProfileEditQuota;
}) {
  const [state, action, pending] = useActionState(
    uploadCedulaPhotoAction,
    initial,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [lastWasReplacement, setLastWasReplacement] = useState(false);
  const done = hasExistingPhoto;
  const canReplace = done && quota.available && quota.remaining > 0;
  const canChoose = !done || canReplace;

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const openPicker = () => {
    // Limpiar el value antes de abrir el picker: re-elegir el MISMO archivo
    // tras un error no dispara onChange (browser estándar).
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  };

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
          {done && viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 rounded-[4px] px-1 inline-flex items-center text-[12.5px] font-bold text-wine-text hover:text-wine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Ver
            </a>
          ) : done ? (
            <span className="text-[11.5px] font-semibold text-grey-700">
              Vista temporal no disponible
            </span>
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
                if (e.currentTarget.files?.length) {
                  setLastWasReplacement(done);
                  setConfirming(false);
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              aria-expanded={done ? confirming : undefined}
              aria-controls={done && confirming ? "cedula-photo-confirm" : undefined}
              onClick={() => (done ? setConfirming(true) : openPicker())}
              className="min-h-11 rounded-[4px] px-1 text-[12.5px] font-semibold text-wine-text hover:text-wine-deep disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {pending ? "Subiendo…" : done ? "Cambiar foto" : "Subir foto"}
            </button>
          </form>
          ) : null}
        </div>
      </div>

      {/* Confirmación de 2 pasos: el reemplazo gasta un cambio de por vida y
          reinicia la verificación. Se dice ANTES de abrir el selector. */}
      {canReplace && confirming && !pending ? (
        <div
          id="cedula-photo-confirm"
          className="portal-aviso mt-2 rounded-[10px] p-4"
          data-tono="atencion"
        >
          <span className="portal-aviso-icono">
            <StatusIcon tone="warning" size={16} />
          </span>
          <div className="portal-aviso-cuerpo">
            <p className="text-[13px] text-grey-700 leading-[1.55]">
              Cambiar la foto usa 1 de tus {quota.remaining}{" "}
              {quota.remaining === 1 ? "cambio disponible" : "cambios disponibles"}.
              La foto actual deja de usarse y tu asesor revisa la nueva.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                ref={confirmRef}
                type="button"
                onClick={openPicker}
                className="btn btn-primary inline-flex items-center justify-center"
              >
                Elegir foto nueva
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn btn-ghost inline-flex items-center justify-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[12px] text-grey-500 leading-[1.5]">
        JPG, PNG, WebP o HEIC · máximo 8 MB. La foto queda privada y la usa el
        equipo de DTD para verificar tu identidad.{" "}
        {done
          ? `Cambiarla usa 1 de tus cambios de perfil (${profileEditQuotaLabel(quota)}).`
          : "La primera carga no usa tu cupo."}
      </p>
      {done && !canReplace ? (
        <div className="mt-1">
          <p className="text-[12px] text-grey-700 leading-[1.5]">
            {quota.available
              ? "Ya usaste tus 3 cambios de perfil."
              : "No pudimos consultar tu cupo de cambios en este momento."}
          </p>
          <Link
            href="/portal/soporte?tema=datos"
            className="min-h-11 rounded-[4px] inline-flex items-center text-[12px] font-semibold text-wine-text hover:text-wine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Pedir ayuda con el documento
          </Link>
        </div>
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
        // tomada. Su ícono es el slice que sigue. El éxito va en grey-700 y no
        // en status-success: el verde a 12px mide 4,33:1 sobre la card clara
        // (SDD-0481 · mismo criterio que DataChangeEditor).
        className={`text-[12px] leading-[1.4] ${state.error ? "mt-1.5 text-status-danger" : state.ok ? "mt-1.5 text-grey-700" : ""}`}
      >
        {state.error
          ? state.error
          : state.ok
            ? lastWasReplacement
              ? "Foto actualizada. Tu asesor revisa la nueva."
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
