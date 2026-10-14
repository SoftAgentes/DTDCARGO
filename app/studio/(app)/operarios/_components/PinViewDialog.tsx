"use client";

/**
 * PinViewDialog — «Ver PIN» de un operario (SDD-0515).
 *
 * Dos pasos:
 *  1. el motivo, con el `ConfirmDialog` del Studio (motivo obligatorio); la
 *     action lo valida y la base lo guarda en el evento `pin_visto`;
 *  2. el PIN, en un modal con «Copiar PIN» y «Cerrar».
 *
 * El PIN vive sólo en el estado de este componente: al cerrar (Cerrar, Escape o
 * clic afuera) el padre lo desmonta y desaparece. No va a localStorage,
 * sessionStorage, la URL ni la consola. Si el PIN es anterior a 0475 no hay
 * copia que mostrar y el modal lo explica.
 */

import { useId, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { StatusIcon } from "@/components/StatusIcon";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import { OPERARIO_PIN_LEGACY_MESSAGE } from "@/lib/studio/operario-pin";
import { viewOperarioPinAction } from "../actions";
import { PinRevealBlock } from "./PinRevealBlock";

type Shown = { pin: string | null };

export function PinViewDialog({
  operario,
  onClose,
}: {
  operario: OperarioRow;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [shown, setShown] = useState<Shown | null>(null);

  if (shown) {
    return <PinShown operario={operario} pin={shown.pin} onClose={onClose} />;
  }

  return (
    <ConfirmDialog
      open
      title={`Ver PIN de ${operario.display_name}`}
      message="Quien ve el PIN puede entrar a la app del teléfono como este operario. Cada consulta queda en la auditoría con tu nombre y el motivo."
      reason
      reasonRequired
      reasonLabel="Motivo"
      reasonPlaceholder="Ej.: no recuerda su PIN y está en el turno"
      confirmLabel="Ver PIN"
      pending={pending}
      error={error}
      onCancel={onClose}
      onConfirm={(motivo) => {
        setError(undefined);
        startTransition(async () => {
          const result = await viewOperarioPinAction(operario.id, motivo);
          if (result.ok) setShown({ pin: result.pin });
          else setError(result.error);
        });
      }}
    />
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
      style={{
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
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={{
          background: "var(--bg-surface)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 440,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
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
            <PinRevealBlock pin={pin} />
          </>
        ) : (
          <div
            id={descriptionId}
            style={{
              alignSelf: "stretch",
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--s-2)",
              padding: "var(--s-3) var(--s-4)",
              background: "var(--bg-surface)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--r-md)",
              font: "600 13px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            <StatusIcon tone="warning" size={16} style={{ color: "var(--warning)", marginTop: 1 }} />
            <span>{OPERARIO_PIN_LEGACY_MESSAGE}</span>
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
