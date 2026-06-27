"use client";

/**
 * GenerarInvitacionDrawer — el admin crea un link de invitación para que un
 * candidato se auto-registre (SDD-0113 Slice A). Al generar, NO cierra: muestra
 * el link `/m/emp/registro?inv=<token>` con un botón para copiarlo y compartirlo
 * por WhatsApp. useActionState + createdToken.
 */

import { useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { createInviteAction } from "../actions";
import { Field, ErrorBox } from "./form-bits";

const FORM_ID = "generar-invitacion-form";
const initial: NominaActionState = {};

export function GenerarInvitacionDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createInviteAction, initial);
  const [copied, setCopied] = useState(false);

  const link =
    state.ok && state.createdToken && typeof window !== "undefined"
      ? `${window.location.origin}/m/emp/registro?inv=${state.createdToken}`
      : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el usuario puede seleccionar el texto */
    }
  };

  return (
    <DrawerShell
      title="Generar invitación"
      subtitle="Link de auto-registro para un candidato"
      onClose={onClose}
      pending={isPending}
      width={540}
    >
      {link ? (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            Invitación lista
          </div>
          <p style={{ font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Comparte este link con el candidato (WhatsApp). Vence en 14 días y sirve para un solo
            registro. La solicitud que envíe queda pendiente de tu aprobación.
          </p>
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              padding: "10px 12px",
              font: "600 12px/1.5 var(--f-mono)",
              color: "var(--ink)",
              wordBreak: "break-all",
            }}
          >
            {link}
          </div>
          <button type="button" className="studio-btn studio-btn-primary" onClick={copy}>
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      ) : (
        <form
          id={FORM_ID}
          action={formAction}
          style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
        >
          <Field label="Cargo sugerido" error={state.fieldErrors?.cargo}>
            <input name="cargo" type="text" className="studio-input" placeholder="Operario de almacén" maxLength={80} />
          </Field>
          <Field label="Área / departamento" error={state.fieldErrors?.department}>
            <input name="department" type="text" className="studio-input" placeholder="Almacén" maxLength={80} />
          </Field>
          <p style={{ font: "400 11px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: "-8px 0 0" }}>
            El cargo y el área solo <strong>precargan</strong> el formulario del candidato. El sueldo
            lo defines tú al aprobar la solicitud, no el candidato.
          </p>
          {state.error && <ErrorBox>{state.error}</ErrorBox>}
        </form>
      )}

      {link ? (
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      ) : (
        <DrawerFooter formId={FORM_ID} onClose={onClose} isPending={isPending} canSubmit submitLabel="Generar link" />
      )}
    </DrawerShell>
  );
}
