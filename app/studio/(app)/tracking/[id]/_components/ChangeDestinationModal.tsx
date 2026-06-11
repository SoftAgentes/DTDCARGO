"use client";

/**
 * ChangeDestinationModal — SDD-0009
 *
 * Modal centrado para cambiar el destino de un envío activo.
 * - Form: nuevo destino + GPS opcional + fee + motivo
 * - Sugerencia automática del fee: on blur del destino llama
 *   lookupRateForNewDestination via server action
 * - Confirmación inline antes del submit real
 * - Cierre con Esc o backdrop
 */

import { useEffect, useState, useTransition } from "react";
import {
  changeDestination,
  lookupRateForNewDestination,
} from "../actions";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { formatRate } from "@/lib/studio/rate-types";
import type { Rate } from "@/lib/studio/rate-types";
import type { Shipment } from "@/lib/studio/shipment-types";
import { Icon } from "@/app/studio/_components/icons";

interface Props {
  shipment: Shipment;
  onClose: () => void;
}

type Phase = "form" | "confirm";

export function ChangeDestinationModal({ shipment, onClose }: Props) {
  const currentDest = shipment.destination ?? "—";

  const [newDest, setNewDest] = useState("");
  const [newGps, setNewGps] = useState("");
  const [fee, setFee] = useState<string>("");
  const [reason, setReason] = useState("");

  const [suggestedRate, setSuggestedRate] = useState<Rate | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  const [phase, setPhase] = useState<Phase>("form");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Cerrar con Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  // Lookup al blur o cambio del destino (debounce 400ms via key trick)
  useEffect(() => {
    if (!newDest.trim()) {
      setSuggestedRate(null);
      setLookupDone(false);
      return;
    }
    const t = setTimeout(async () => {
      setLookupPending(true);
      try {
        const { rate } = await lookupRateForNewDestination(
          shipment.shipment_service,
          newDest,
        );
        setSuggestedRate(rate);
        setLookupDone(true);
      } finally {
        setLookupPending(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [newDest, shipment.shipment_service]);

  const handleApplySuggestion = () => {
    if (!suggestedRate) return;
    // Sugerencia: el fee del cambio = price de la nueva rate (sin diferencia,
    // porque no sabemos el monto original facturado). Operador ajusta si quiere.
    const suggested = suggestedRate.per_cbm ?? suggestedRate.flat_rate ?? 0;
    setFee(String(suggested));
  };

  const handleGoConfirm = () => {
    setFieldErrors({});
    setServerError(null);

    const errors: Record<string, string> = {};
    if (!newDest.trim()) errors.newDestination = "Indicá el nuevo destino.";
    if (newDest.trim().toLowerCase() === currentDest.toLowerCase())
      errors.newDestination = "El nuevo destino es igual al actual.";
    const feeN = Number(fee);
    if (!Number.isFinite(feeN) || feeN < 0)
      errors.fee = "El fee debe ser 0 o un número positivo.";
    if (reason.trim().length < 5)
      errors.reason = "El motivo debe tener al menos 5 caracteres.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPhase("confirm");
  };

  const handleConfirm = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await changeDestination(shipment.id, {
        newDestination: newDest.trim(),
        newGps: newGps.trim() || null,
        fee: Number(fee),
        reason: reason.trim(),
      });
      if (result.error) {
        setServerError(result.error);
        setPhase("form");
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        setPhase("form");
      } else {
        onClose();
      }
    });
  };

  const feeN = Number(fee) || 0;
  const feeLabel = feeN > 0 ? `$${feeN.toFixed(2)}` : "sin costo";

  return (
    <div
      onClick={() => !isPending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-dest-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "grid",
        placeItems: "start center",
        paddingTop: "8vh",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 96vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "84vh",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            id="change-dest-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            {phase === "form" ? "Cambiar destino" : "Confirmar cambio"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: isPending ? "wait" : "pointer",
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            padding: "18px 20px",
            overflow: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {phase === "form" ? (
            <FormPhase
              currentDest={currentDest}
              newDest={newDest}
              setNewDest={setNewDest}
              newGps={newGps}
              setNewGps={setNewGps}
              fee={fee}
              setFee={setFee}
              reason={reason}
              setReason={setReason}
              suggestedRate={suggestedRate}
              lookupPending={lookupPending}
              lookupDone={lookupDone}
              onApplySuggestion={handleApplySuggestion}
              fieldErrors={fieldErrors}
              serverError={serverError}
            />
          ) : (
            <ConfirmPhase
              currentDest={currentDest}
              newDest={newDest}
              feeLabel={feeLabel}
              reason={reason}
              serverError={serverError}
            />
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-surface)",
          }}
        >
          {phase === "form" ? (
            <>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={onClose}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary studio-btn-sm"
                onClick={handleGoConfirm}
                disabled={isPending}
              >
                Continuar →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setPhase("form")}
                disabled={isPending}
              >
                ← Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary studio-btn-sm"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending ? "Aplicando…" : "Confirmar cambio"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

// ── Form phase ────────────────────────────────────────────────

function FormPhase({
  currentDest,
  newDest,
  setNewDest,
  newGps,
  setNewGps,
  fee,
  setFee,
  reason,
  setReason,
  suggestedRate,
  lookupPending,
  lookupDone,
  onApplySuggestion,
  fieldErrors,
  serverError,
}: {
  currentDest: string;
  newDest: string;
  setNewDest: (v: string) => void;
  newGps: string;
  setNewGps: (v: string) => void;
  fee: string;
  setFee: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  suggestedRate: Rate | null;
  lookupPending: boolean;
  lookupDone: boolean;
  onApplySuggestion: () => void;
  fieldErrors: Record<string, string>;
  serverError: string | null;
}) {
  return (
    <>
      {/* Contexto: destino actual */}
      <div
        style={{
          padding: "10px 12px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-sm)",
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        Destino actual:{" "}
        <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
          {currentDest}
        </strong>
      </div>

      {/* Nuevo destino */}
      <div>
        <label className="studio-label" htmlFor="cd-new-dest">
          Nuevo destino <span style={{ color: "var(--wine)" }}>*</span>
        </label>
        <input
          id="cd-new-dest"
          type="text"
          className="studio-input"
          value={newDest}
          onChange={(e) => setNewDest(e.target.value)}
          placeholder="Maracaibo, La Guaira…"
          autoFocus
        />
        {fieldErrors.newDestination && (
          <FieldError msg={fieldErrors.newDestination} />
        )}

        {/* Sugerencia del fee según rate */}
        {newDest.trim() && (
          <RateSuggestion
            rate={suggestedRate}
            pending={lookupPending}
            done={lookupDone}
            onApply={onApplySuggestion}
          />
        )}
      </div>

      {/* GPS opcional */}
      <div>
        <label className="studio-label" htmlFor="cd-gps">
          Nuevo GPS{" "}
          <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
            (opcional)
          </span>
        </label>
        <input
          id="cd-gps"
          type="text"
          className="studio-input"
          value={newGps}
          onChange={(e) => setNewGps(e.target.value)}
          placeholder="10.4806, -66.9036  o  https://maps.app.goo.gl/…"
          autoComplete="off"
        />
      </div>

      {/* Fee */}
      <div>
        <label className="studio-label" htmlFor="cd-fee">
          Fee del cambio <span style={{ color: "var(--wine)" }}>*</span>
        </label>
        <NumericInput
          id="cd-fee"
          type="currency"
          currency="USD"
          min={0}
          placeholder="0.00"
          value={fee === "" ? null : Number(fee)}
          onChange={(v) => setFee(v != null ? String(v) : "")}
        />
        {fieldErrors.fee && <FieldError msg={fieldErrors.fee} />}
        <p
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "4px 0 0",
          }}
        >
          Se cobra al cliente y queda en el timeline. Pon 0 si es corrección sin costo.
        </p>
      </div>

      {/* Motivo */}
      <div>
        <label className="studio-label" htmlFor="cd-reason">
          Motivo <span style={{ color: "var(--wine)" }}>*</span>
        </label>
        <textarea
          id="cd-reason"
          rows={3}
          className="studio-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="p. ej. ‘Cliente movió oficina a otra zona industrial’"
          style={{ resize: "vertical" }}
        />
        {fieldErrors.reason && <FieldError msg={fieldErrors.reason} />}
      </div>

      {serverError && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
            padding: "8px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {serverError}
        </p>
      )}
    </>
  );
}

// ── Rate suggestion ───────────────────────────────────────────

function RateSuggestion({
  rate,
  pending,
  done,
  onApply,
}: {
  rate: Rate | null;
  pending: boolean;
  done: boolean;
  onApply: () => void;
}) {
  if (pending) {
    return (
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: "6px 0 0",
        }}
      >
        Buscando tarifa…
      </p>
    );
  }

  if (!done) return null;

  if (!rate) {
    return (
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--warning)",
          margin: "6px 0 0",
        }}
      >
        Sin tarifa registrada para esta ruta. Define el fee manualmente.
      </p>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        background: "var(--success-bg)",
        border: "1px solid var(--success)",
        borderRadius: "var(--r-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        Tarifa registrada para esta ruta:{" "}
        <strong
          style={{
            font: "700 12px/1 var(--f-mono)",
            color: "var(--success)",
          }}
        >
          {formatRate(rate)}
        </strong>
        {" · "}
        {rate.origin} → {rate.destination}
      </span>
      <button
        type="button"
        onClick={onApply}
        className="studio-btn studio-btn-ghost studio-btn-xs"
        style={{ flexShrink: 0 }}
      >
        Usar
      </button>
    </div>
  );
}

// ── Confirm phase ─────────────────────────────────────────────

function ConfirmPhase({
  currentDest,
  newDest,
  feeLabel,
  reason,
  serverError,
}: {
  currentDest: string;
  newDest: string;
  feeLabel: string;
  reason: string;
  serverError: string | null;
}) {
  return (
    <>
      <p
        style={{
          font: "500 14px/1.5 var(--f-sans)",
          color: "var(--ink)",
          margin: 0,
        }}
      >
        Vas a cambiar el destino del envío:
      </p>

      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            font: "700 14px/1.3 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          {currentDest} → {newDest}
        </div>
        <div
          style={{
            font: "500 12.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Fee:{" "}
          <strong style={{ color: "var(--wine)", fontWeight: 700 }}>
            {feeLabel}
          </strong>
        </div>
        <div
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
            marginTop: 4,
          }}
        >
          <em style={{ fontStyle: "italic" }}>{reason}</em>
        </div>
      </div>

      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: 0,
        }}
      >
        El cambio queda registrado en el timeline del envío. Si quieres
        revertirlo después, agregas otro evento manual.
      </p>

      {serverError && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
            padding: "8px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {serverError}
        </p>
      )}
    </>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
