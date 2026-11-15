"use client";

/**
 * Drawer de alta de referido (SDD-0051, Slice B).
 *
 * Form HTML5 estándar: `<form id="register-referral-form" action={formAction}>`
 * en el cuerpo + `<button type="submit" form="...">` en el footer (DrawerShell /
 * DrawerFooter). NO requestSubmit hack. Usa useActionState(registerReferral).
 *
 * El crédito es ADVISORY: el referido arranca en estado "invitado"; el crédito
 * al referidor se acredita a mano más tarde (botón "Acreditar"). El drawer lo
 * deja claro.
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { type ReferralActionState } from "@/lib/studio/fidelizacion/types";
import { fmtUsd } from "@/lib/money";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { registerReferral } from "../actions";

const INITIAL: ReferralActionState = {};

export function RegisterReferralDrawer({
  referrerReward,
  onClose,
}: {
  /** Crédito al referidor vigente (SDD-0159 · config) para el aviso advisory. */
  referrerReward: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, pending] = useActionState(
    registerReferral,
    INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(
        `Referido ${state.createdCode ?? ""} registrado · estado Invitado`,
      );
      onClose();
      router.refresh();
    }
  }, [state.ok, state.createdCode, onClose, router, toast]);

  return (
    <DrawerShell
      title="Registrar referido"
      subtitle="Quien refiere es un cliente existente · el referido aún no es cliente"
      onClose={onClose}
      pending={pending}
      width={600}
    >
      <form
        id="register-referral-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {state.error && <FormError message={state.error} />}

        <Field
          label="Shipping Mark del cliente que refiere"
          error={state.fieldErrors?.referrer_markbox}
        >
          <input
            name="referrer_markbox"
            className="studio-input studio-input-mono"
            placeholder="DTD-5452"
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label="Nombre del referido"
          error={state.fieldErrors?.referred_name}
        >
          <input
            name="referred_name"
            className="studio-input"
            placeholder="Importadora La Guaira"
            autoComplete="off"
            required
          />
        </Field>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <Field label="Empresa" optional>
            <input
              name="referred_company"
              className="studio-input"
              placeholder="Razón social"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Correo"
            optional
            error={state.fieldErrors?.referred_email}
          >
            <input
              name="referred_email"
              type="email"
              className="studio-input"
              placeholder="contacto@empresa.com"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Teléfono" optional>
          <input
            name="referred_phone"
            className="studio-input"
            placeholder="+58 412 000 0000"
            autoComplete="off"
          />
        </Field>

        <Field label="Notas" optional>
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            placeholder="Cómo llegó el referido, contexto…"
          />
        </Field>

        {/* Aviso advisory: el crédito no se aplica solo. */}
        <Aviso tono="info" compacto>
          El referido arranca en <strong>Invitado</strong>. Cuando haga su primer
          embarque, acreditá el crédito de {fmtUsd(referrerReward)}{" "}
          al referidor — se aplica a mano en su próxima factura (crédito advisory,
          no se postea solo a Facturación).
        </Aviso>
      </form>

      <DrawerFooter
        formId="register-referral-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={!pending}
        submitLabel="Registrar referido"
        pendingLabel="Registrando…"
      />
    </DrawerShell>
  );
}

// ── Helpers de form (locales del módulo) ───────────────────────

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="studio-label">
        {label}
        {optional && (
          <span style={{ color: "var(--ink-soft)" }}> (opcional)</span>
        )}
      </label>
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
