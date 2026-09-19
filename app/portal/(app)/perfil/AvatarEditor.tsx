"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  removeAvatarAction,
  updateAvatarAction,
  type AvatarActionState,
} from "./avatar-actions";
import { prepareAvatar } from "@/lib/portal/avatar-image";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initial: AvatarActionState = {};

/**
 * Avatar editable del cliente (SDD-0138 Slice D · SDD-0487 · mockup aprobado
 * por Sam el 2026-09-19). Antes era un texto de 12,5 px al lado de un círculo
 * de 56 px que no se podía tocar, y Sam no encontraba dónde cambiar la foto.
 * Ahora el círculo es grande, lleva un botón de cámara de 44 px y debajo un
 * botón «Cambiar foto» de 48 px. La foto se prepara en el navegador
 * (`prepareAvatar`: JPEG reducido, sin EXIF) antes de subirla. «Quitar foto»
 * pide confirmación. La foto es cosmética: no gasta cupo ni toca la cédula.
 */
export function AvatarEditor({
  name,
  avatarUrl,
  children,
}: {
  name: string;
  avatarUrl: string | null;
  /** Chip del tipo de cuenta, debajo del nombre. */
  children?: React.ReactNode;
}) {
  const [updateState, updateAction, uploading] = useActionState(updateAvatarAction, initial);
  const [removeState, removeAction, removing] = useActionState(removeAvatarAction, initial);
  const [preparing, startPreparing] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Última acción que pidió el cliente: decide qué resultado se anuncia.
  const [last, setLast] = useState<"update" | "remove" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = preparing || uploading || removing;
  const error = localError ?? (last === "remove" ? removeState.error : last === "update" ? updateState.error : null) ?? null;

  function pick() {
    // Limpiar el value: re-elegir el MISMO archivo tras un error no dispara onChange.
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    setConfirmRemove(false);
    setLast("update");
    startPreparing(async () => {
      const prepared = await prepareAvatar(file);
      if (!prepared.ok) {
        setLocalError(prepared.error);
        return;
      }
      const fd = new FormData();
      fd.set("avatar", prepared.file);
      // Después de un await el dispatch necesita su propia transición.
      startPreparing(() => updateAction(fd));
    });
  }

  const status = preparing
    ? "Preparando tu foto…"
    : uploading
      ? "Subiendo tu foto…"
      : removing
        ? "Quitando tu foto…"
        : last === "update" && updateState.ok && !error
          ? "Foto actualizada"
          : last === "remove" && removeState.ok && !error
            ? "Foto quitada"
            : "";

  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      <div className="relative h-28 w-28 lg:h-32 lg:w-32">
        <span
          className="grid h-full w-full place-items-center overflow-hidden rounded-full text-[38px] lg:text-[44px]"
          style={{
            background: "var(--color-wine)",
            color: "var(--color-on-accent)",
            fontFamily: "var(--font-archivo-black)",
          }}
        >
          {avatarUrl ? (
            // Signed URL efímera del bucket privado — no cachea entre sesiones.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`Foto de perfil de ${name}`} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{initials(name)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-label="Cambiar foto de perfil"
          className="absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border-[3px] disabled:opacity-60"
          style={{
            background: "var(--color-wine)",
            color: "var(--color-on-accent)",
            // Anillo del color de la card: se ve igual en claro y en oscuro.
            borderColor: "var(--color-white)",
          }}
        >
          <CameraIcon size={20} />
        </button>
      </div>

      <div>
        <div
          className="text-[21px] leading-tight text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          {name}
        </div>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>

      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-busy={busy}
        className="btn btn-ghost inline-flex w-full items-center justify-center gap-2 disabled:opacity-60"
      >
        <CameraIcon size={18} />
        {avatarUrl ? "Cambiar foto" : "Subir foto de perfil"}
      </button>
      <p className="-mt-1 text-[13px] leading-[1.45] text-grey-500">
        Tómala o elígela de tu galería. JPG, PNG o foto del iPhone: la ajustamos por ti.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => onFile(e.currentTarget.files?.[0])}
      />

      {/* Anuncio accesible del progreso y del resultado (WCAG 4.1.3). */}
      <p role="status" className="min-h-[1lh] text-[13px] font-semibold text-ink">
        {status}
      </p>
      {error ? <PortalFieldError>{error}</PortalFieldError> : null}

      {avatarUrl && !confirmRemove ? (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          disabled={busy}
          className="min-h-11 px-3 text-[14px] font-semibold text-wine-text hover:text-wine-deep disabled:opacity-60"
        >
          Quitar foto
        </button>
      ) : null}
      {avatarUrl && confirmRemove ? (
        <div className="w-full rounded-[12px] border border-grey-200 bg-paper p-3 text-left">
          <p className="text-[14px] font-semibold text-ink">¿Quitar tu foto de perfil?</p>
          <p className="mt-1 text-[13px] text-grey-700">Se borra de nuestros archivos. Puedes subir otra cuando quieras.</p>
          <div className="mt-3 flex gap-2">
            <form action={removeAction} onSubmit={() => setLast("remove")}>
              <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">
                Sí, quitar
              </button>
            </form>
            <button type="button" onClick={() => setConfirmRemove(false)} className="btn btn-ghost">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Iniciales (1-2 letras) para el avatar sin foto. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function CameraIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
