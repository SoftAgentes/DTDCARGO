"use client";

/**
 * SDD-0566 · Diálogo para asentar, anular o eliminar un asiento de período
 * cerrado. Muestra el aviso, pide la superclave (si el modo la pide) y el
 * motivo, y llama a la acción. Accesible como ConfirmDialog: role=dialog,
 * aria-modal, Esc cierra, foco atrapado y devuelto (useDialogA11y).
 *
 * La superclave vive solo en este estado local y se vacía después de cada
 * intento y al cerrar.
 */

import { useId, useRef, useState } from "react";
import {
  excepcionPosible,
  type AvisoCierre,
  type OperacionCierre,
} from "@/lib/studio/accounting/cierre-excepciones";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { CamposExcepcionCierre, excepcionCompleta } from "./CamposExcepcionCierre";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const TITULO: Record<Exclude<OperacionCierre, "crear">, string> = {
  asentar: "Asentar en período cerrado",
  anular: "Anular en período cerrado",
  eliminar: "Eliminar en período cerrado",
};

const BOTON: Record<Exclude<OperacionCierre, "crear">, string> = {
  asentar: "Asentar con excepción",
  anular: "Anular con excepción",
  eliminar: "Eliminar con excepción",
};

export function ExcepcionCierreDialog({
  aviso,
  operacion,
  entryCode,
  onCancel,
  onConfirm,
}: {
  aviso: AvisoCierre;
  operacion: Exclude<OperacionCierre, "crear">;
  entryCode: string;
  onCancel: () => void;
  /** Devuelve el error para mostrarlo, o null si salió bien. */
  onConfirm: (excepcion: { superclave: string | null; motivo: string }) => Promise<string | null>;
}) {
  const panelRef = useRef<HTMLFormElement | null>(null);
  const titleId = useId();
  const errorId = useId();
  const [superclave, setSuperclave] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posible = excepcionPosible(aviso);

  function cerrar() {
    setSuperclave("");
    onCancel();
  }

  // El foco, en lo primero que hay que llenar; sin excepción posible, en «Cerrar».
  const primerCampo = useRef<HTMLElement | null>(null);
  const cerrarRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y(panelRef, { onClose: cerrar, pending, initialFocusRef: posible ? primerCampo : cerrarRef });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !excepcionCompleta(aviso, superclave, motivo)) return;
    setPending(true);
    setError(null);
    const clave = superclave;
    setSuperclave("");
    const r = await onConfirm({ superclave: clave || null, motivo: motivo.trim() });
    setPending(false);
    if (r) setError(r);
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) cerrar();
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
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        onSubmit={submit}
        style={{
          background: "var(--bg-surface)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 460,
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
        }}
      >
        <h2
          id={titleId}
          className="studio-display"
          style={{ margin: 0, font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}
        >
          {TITULO[operacion]} · {entryCode}
        </h2>

        <CamposExcepcionCierre
          aviso={aviso}
          superclave={superclave}
          onSuperclave={setSuperclave}
          motivo={motivo}
          onMotivo={setMotivo}
          disabled={pending}
          primerCampoRef={primerCampo}
        />

        {error && (
          <Aviso tono="error" compacto id={errorId}>{error}</Aviso>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button ref={cerrarRef} type="button" className="studio-btn studio-btn-ghost" onClick={cerrar} disabled={pending}>
            {posible ? "Cancelar" : "Cerrar"}
          </button>
          {posible && (
            <button
              type="submit"
              className={`studio-btn ${operacion === "asentar" ? "studio-btn-primary" : "studio-btn-danger"}`}
              disabled={pending || !excepcionCompleta(aviso, superclave, motivo)}
            >
              {pending ? "Guardando…" : BOTON[operacion]}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
