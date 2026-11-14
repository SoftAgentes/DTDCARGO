"use client";

/**
 * PinViewDialog — «Ver PIN» de un operario (SDD-0515).
 *
 * Dos pasos:
 *  1. el motivo (la lista fija, con texto sólo para «Otro») y la contraseña del
 *     Studio otra vez (decisión de Sam). La action confirma la contraseña con
 *     Supabase Auth y la base exige esa confirmación reciente: sin ella no hay
 *     PIN, aunque se llame a la RPC desde la consola;
 *  2. el PIN, en un modal con «Copiar PIN», la app por la que entra el operario
 *     según su región y «Cerrar».
 *
 * La contraseña no pasa por el estado de React: el campo no es controlado, se
 * lee del formulario al enviar y se borra del campo en cuanto vuelve la
 * respuesta, sea cual sea. No va a localStorage, sessionStorage, la URL ni la
 * consola.
 *
 * El PIN vive sólo en el estado de este componente: al cerrar (Cerrar, Escape o
 * clic afuera) el padre lo desmonta y desaparece. Si el PIN es anterior a 0475
 * no hay copia que mostrar y el modal lo explica.
 */

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { StatusIcon } from "@/components/StatusIcon";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import { OPERARIO_PIN_LEGACY_MESSAGE, type ViewPinResult } from "@/lib/studio/operario-pin";
import { viewOperarioPinAction } from "../actions";
import { MOTIVO_VACIO, MotivoField, motivoListo, type MotivoValue } from "./MotivoField";
import { PinRevealBlock } from "./PinRevealBlock";

type Shown = { pin: string | null };
type Failure = Extract<ViewPinResult, { error: string }>;

const SCRIM_STYLE = {
  position: "fixed",
  inset: 0,
  background: "var(--scrim, rgba(15, 30, 61, 0.45))",
  backdropFilter: "var(--scrim-blur)",
  WebkitBackdropFilter: "var(--scrim-blur)",
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
} as const;

const PANEL_STYLE = {
  background: "var(--bg-surface)",
  color: "var(--ink)",
  width: "100%",
  maxWidth: 440,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  overflowWrap: "anywhere",
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--border)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
  padding: 22,
  display: "flex",
  flexDirection: "column",
  gap: 14,
} as const;

export function PinViewDialog({
  operario,
  onClose,
}: {
  operario: OperarioRow;
  onClose: () => void;
}) {
  const [shown, setShown] = useState<Shown | null>(null);

  if (shown) {
    return <PinShown operario={operario} pin={shown.pin} onClose={onClose} />;
  }
  return <PinRequest operario={operario} onClose={onClose} onShown={setShown} />;
}

function PinRequest({
  operario,
  onClose,
  onShown,
}: {
  operario: OperarioRow;
  onClose: () => void;
  onShown: (shown: Shown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [motivo, setMotivo] = useState<MotivoValue>(MOTIVO_VACIO);
  const panelRef = useRef<HTMLFormElement | null>(null);
  const motivoRef = useRef<HTMLDivElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const passwordId = useId();
  const passwordHintId = useId();
  useDialogA11y(panelRef, { onClose, pending });

  const passwordError = failure?.fieldError === "password" ? failure.error : undefined;
  const motivoError = failure?.fieldError === "motivo" ? failure.error : undefined;
  const generalError = failure && !failure.fieldError ? failure.error : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !motivoListo(motivo)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFailure(null);
    startTransition(async () => {
      let result: ViewPinResult;
      try {
        result = await viewOperarioPinAction(formData);
      } catch {
        result = { error: "No se pudo mostrar el PIN. Revisa tu conexión e inténtalo otra vez." };
      } finally {
        // Pase lo que pase, la contraseña no se queda en el campo ni en el FormData.
        formData.delete("password");
        if (passwordRef.current) passwordRef.current.value = "";
      }
      if (result.ok) {
        onShown({ pin: result.pin });
        return;
      }
      setFailure(result);
    });
  };

  // Tras un rechazo, el foco va al campo a corregir. Va en un efecto porque
  // durante la llamada los campos están deshabilitados y no reciben foco.
  useEffect(() => {
    if (pending || !failure?.fieldError) return;
    if (failure.fieldError === "password") passwordRef.current?.focus();
    else motivoRef.current?.querySelector<HTMLElement>("select, input")?.focus();
  }, [pending, failure]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      style={SCRIM_STYLE}
    >
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={generalError ? `${descriptionId} ${errorId}` : descriptionId}
        tabIndex={-1}
        onSubmit={submit}
        style={PANEL_STYLE}
      >
        <h2
          id={titleId}
          className="studio-display"
          style={{ margin: 0, font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}
        >
          Ver PIN de {operario.display_name}
        </h2>
        <p id={descriptionId} style={{ margin: 0, font: "400 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Quien ve el PIN puede entrar a la app del teléfono como este operario. Cada consulta queda en la
          auditoría con tu nombre y el motivo.
        </p>

        <input type="hidden" name="operario_id" value={operario.id} />

        <div ref={motivoRef}>
          <MotivoField
            id="ver-pin-motivo"
            value={motivo}
            onChange={(next) => {
              setMotivo(next);
              if (failure?.fieldError === "motivo") setFailure(null);
            }}
            serverError={motivoError}
            disabled={pending}
            placeholder="Ej.: no recuerda su PIN y está en el turno"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="studio-label">
            Tu contraseña del Studio <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type="password"
            className="studio-input"
            autoComplete="current-password"
            spellCheck={false}
            disabled={pending}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordHintId}
            onInput={() => {
              if (failure?.fieldError === "password") setFailure(null);
            }}
            required
          />
          <p
            id={passwordHintId}
            role={passwordError ? "alert" : undefined}
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: passwordError ? "var(--ink)" : "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {passwordError ? (
              <>
                <StatusIcon
                  tone="danger"
                  style={{
                    color: "var(--danger-text)",
                    display: "inline",
                    marginRight: "var(--s-1)",
                    verticalAlign: "middle",
                  }}
                />
                {passwordError}
              </>
            ) : (
              "La pedimos otra vez para confirmar que eres tú. No se guarda."
            )}
          </p>
        </div>

        {generalError && (
          <Aviso id={errorId} tono="error" compacto>
            {generalError}
          </Aviso>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="studio-btn studio-btn-primary studio-btn-sm"
            disabled={pending || !motivoListo(motivo)}
            aria-busy={pending || undefined}
          >
            {pending ? "Confirmando…" : "Ver PIN"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PinShown({
  operario,
  pin,
  onClose,
}: {
  operario: OperarioRow;
  pin: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogA11y(panelRef, { onClose, pending: false, initialFocusRef: closeRef });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={SCRIM_STYLE}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={{ ...PANEL_STYLE, alignItems: "center" }}
      >
        <h2
          id={titleId}
          className="studio-display"
          style={{ alignSelf: "stretch", margin: 0, font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}
        >
          PIN de {operario.display_name}
        </h2>

        {pin ? (
          <>
            <p
              id={descriptionId}
              style={{ alignSelf: "stretch", margin: 0, font: "400 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}
            >
              La consulta quedó en la auditoría. Al cerrar, el PIN se borra de la pantalla.
            </p>
            <PinRevealBlock pin={pin} region={operario.region} />
          </>
        ) : (
          <div style={{ alignSelf: "stretch" }}>
            <Aviso id={descriptionId} tono="atencion">
              {OPERARIO_PIN_LEGACY_MESSAGE}
            </Aviso>
          </div>
        )}

        <div style={{ alignSelf: "stretch", display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            ref={closeRef}
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
