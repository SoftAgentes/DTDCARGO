"use client";

import { useActionState, useRef } from "react";
import { updateAvatarAction, type AvatarActionState } from "./avatar-actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initial: AvatarActionState = {};

/**
 * Avatar editable del cliente (SDD-0138 Slice D · Norte PortalProfile). Círculo
 * con la foto (signed URL server-side) o las iniciales; "Cambiar foto" abre el
 * picker y sube al elegir. La foto es cosmética — la cédula (verificación) vive
 * aparte en "Completa tu perfil".
 */
export function AvatarEditor({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateAvatarAction, initial);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      <span
        className="relative grid place-items-center h-14 w-14 rounded-full flex-shrink-0 overflow-hidden text-[18px]"
        style={{
          background: "var(--color-wine)",
          color: "var(--color-on-accent)",
          fontFamily: "var(--font-archivo-black)",
        }}
      >
        {avatarUrl ? (
          // Signed URL efímera del bucket privado — no cachea entre sesiones.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`Foto de perfil de ${name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          initials(name)
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className="text-[18px] leading-tight text-ink truncate"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          {name}
        </div>
        <form action={action} className="mt-1 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
            }}
          />
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => {
              // Limpiar el value antes de abrir el picker: si no, re-elegir el
              // MISMO archivo tras un error no dispara onChange (browser estándar).
              if (fileRef.current) fileRef.current.value = "";
              fileRef.current?.click();
            }}
            className="text-[12.5px] font-semibold text-wine hover:text-wine-deep disabled:opacity-60"
          >
            {pending ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto de perfil"}
          </button>
        </form>
        {/* role="status" (aria-live polite): el lector de pantalla anuncia el
            resultado de la subida (WCAG 4.1.3). */}
        {state.error ? (
          /* SDD-0261 · era `role="status"` para un ERROR, y status es el rol de
             lo no urgente: el lector no interrumpe. `PortalFieldError` usa
             `role="alert"`, que además sí se anuncia al insertarse. */
          <PortalFieldError>{state.error}</PortalFieldError>
        ) : state.ok ? (
          <p
            role="status"
            className="mt-1 text-[12px] leading-[1.4]"
            style={{ color: "var(--color-status-success)" }}
          >
            Foto actualizada
          </p>
        ) : (
          <div className="text-[12.5px] text-grey-500">Cliente DTD</div>
        )}
      </div>
    </div>
  );
}

/** Iniciales (1-2 letras) para el avatar sin foto. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
