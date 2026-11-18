"use client";

/**
 * Drawer "Configurar referidos" (SDD-0159). Edita los dos montos del programa
 * —crédito al referidor + descuento al referido— que viven en `referral_settings`.
 * Al guardar bajan al portal del cliente, al correo de invitación y a la
 * acreditación (fallback $80/$60 si el tenant nunca guardó config).
 *
 * Form HTML5 estándar + useActionState(saveReferralSettingsAction); mismo patrón
 * que RegisterReferralDrawer. Los campos arrancan poblados con los montos vigentes.
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  REFERRAL_SETTINGS_FIELDS,
  type ReferralSettingsActionState,
  type ReferralSettingsInput,
} from "@/lib/studio/fidelizacion/referral-settings-types";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { saveReferralSettingsAction } from "../actions";

const INITIAL: ReferralSettingsActionState = {};

export function ReferralSettingsDrawer({
  settings,
  onClose,
}: {
  settings: ReferralSettingsInput;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, pending] = useActionState(
    saveReferralSettingsAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Montos de referidos guardados");
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router, toast]);

  return (
    <DrawerShell
      title="Configurar referidos"
      subtitle="Estos montos bajan al portal del cliente, al correo de invitación y a la acreditación"
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <form
        id="referral-settings-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {state.error && <FormError message={state.error} />}

        {REFERRAL_SETTINGS_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            hint={f.hint}
            error={state.fieldErrors?.[f.key]}
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 12,
                  font: "600 13px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  pointerEvents: "none",
                }}
              >
                $
              </span>
              <input
                name={f.key}
                type="number"
                min={f.min}
                step="1"
                inputMode="decimal"
                className="studio-input studio-input-mono"
                style={{ paddingLeft: 24 }}
                defaultValue={String(settings[f.key])}
                required
              />
            </div>
          </Field>
        ))}

        {/* Aviso: solo afecta a futuros; los ya acreditados quedan congelados. */}
        <Aviso tono="info" compacto>
          Cambiar estos montos afecta solo a los referidos <strong>nuevos</strong>.
          Los que ya se acreditaron conservan el monto con el que se registraron.
        </Aviso>
      </form>

      <DrawerFooter
        formId="referral-settings-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={!pending}
        submitLabel="Guardar montos"
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

// ── Helpers de form (locales del módulo) ───────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="studio-label">{label}</label>
      {hint && (
        <p
          style={{
            font: "500 11.5px/1.45 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 7px",
          }}
        >
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            margin: "5px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <Aviso tono="error" compacto>
      {message}
    </Aviso>
  );
}
