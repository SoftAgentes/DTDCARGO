"use client";

/**
 * Panel de acciones contextuales para cambiar el estado del envio.
 *
 * Muestra botones segun lib/studio/shipment-actions.ts → getNextActions().
 * Cada click llama a transitionShipment() server action.
 *
 * Caso especial: "Marcar excepcion" abre un modal pidiendo tipo + nota
 * antes de cambiar el estado. La nota queda en el timeline y se muestra
 * en un banner rojo arriba del detalle (ver page.tsx).
 *
 * Para estados terminales (delivered, cancelled) muestra mensaje de cierre.
 */

import { useEffect, useState, useTransition } from "react";
import { transitionShipment } from "../actions";
import {
  getNextActions,
  isTerminalStatus,
} from "@/lib/studio/shipment-actions";
import { STATUS_LABELS } from "@/lib/studio/shipment-types";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";

/** Tipos de excepcion sugeridos. */
const EXCEPTION_TYPES = [
  { value: "aduana", label: "Aduana — retención / inspección" },
  { value: "documentacion", label: "Documentación faltante" },
  { value: "dano", label: "Daño / avería en mercadería" },
  { value: "pago", label: "Pago pendiente del cliente" },
  { value: "cliente", label: "Cliente no responde" },
  { value: "operativa", label: "Problema operativo (camión, ruta, etc.)" },
  { value: "otro", label: "Otro" },
] as const;
type ExceptionTypeValue = (typeof EXCEPTION_TYPES)[number]["value"];

const TYPE_LABEL_MAP: Record<ExceptionTypeValue, string> = {
  aduana: "Aduana",
  documentacion: "Documentación",
  dano: "Daño",
  pago: "Pago",
  cliente: "Cliente",
  operativa: "Operativa",
  otro: "Otro",
};

const MODAL_BACKDROP: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 30, 61, 0.55)",
  display: "grid",
  placeItems: "center",
  zIndex: 50,
  padding: 20,
};

const MODAL_BOX: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: 24,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 12px 40px rgba(15, 30, 61, 0.25)",
};

/**
 * Mapeo variant del action → clase del sistema de botones del Studio.
 * Garantiza consistencia con el resto de botones de la app.
 */
const VARIANT_CLASS: Record<"primary" | "warning" | "neutral", string> = {
  primary: "studio-btn studio-btn-dark studio-btn-sm",
  warning: "studio-btn studio-btn-warning studio-btn-sm",
  neutral: "studio-btn studio-btn-ghost studio-btn-sm",
};

export function StateActionsPanel({
  shipmentId,
  service,
  status,
}: {
  shipmentId: string;
  service: ShipmentService;
  status: ShipmentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Modal de excepcion
  const [excModal, setExcModal] = useState(false);
  const [excType, setExcType] = useState<ExceptionTypeValue>("aduana");
  const [excNote, setExcNote] = useState("");

  const actions = getNextActions(service, status);
  const terminal = isTerminalStatus(status);

  // Cerrar modal con Escape
  useEffect(() => {
    if (!excModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setExcModal(false);
        setExcNote("");
        setError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [excModal, isPending]);

  const handleTransition = (newStatus: ShipmentStatus) => {
    // Caso especial: excepcion abre modal pidiendo tipo + nota
    if (newStatus === "exception") {
      setExcType("aduana");
      setExcNote("");
      setError(null);
      setExcModal(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await transitionShipment(shipmentId, newStatus);
      if (result.error) setError(result.error);
    });
  };

  const handleExceptionConfirm = () => {
    setError(null);
    // Formato del note: "[Tipo] descripción del operador"
    const typeLabel = TYPE_LABEL_MAP[excType];
    const cleanNote = excNote.trim();
    const composedNote = cleanNote
      ? `[${typeLabel}] ${cleanNote}`
      : `[${typeLabel}]`;

    startTransition(async () => {
      const result = await transitionShipment(
        shipmentId,
        "exception",
        composedNote,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setExcModal(false);
        setExcNote("");
      }
    });
  };

  if (terminal) {
    return (
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Acciones
        </div>
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            borderRadius: 6,
            border: "1px dashed var(--border-strong)",
          }}
        >
          Envío {status === "delivered" ? "entregado" : "cancelado"}. Operación cerrada.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
        Acciones
      </div>

      {actions.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Sin acciones sugeridas. Usá "Agregar evento manual" abajo.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {actions.map((a) => (
            <button
              key={a.status}
              type="button"
              onClick={() => handleTransition(a.status)}
              disabled={isPending}
              className={VARIANT_CLASS[a.variant]}
              style={{
                justifyContent: "flex-start",
                opacity: isPending ? 0.6 : 1,
              }}
              title={`Cambia estado a "${STATUS_LABELS[a.status]}"`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {error && !excModal && (
        <p
          style={{
            marginTop: 10,
            color: "var(--danger)",
            font: "500 11.5px/1.4 var(--f-sans)",
          }}
        >
          {error}
        </p>
      )}

      {/* Modal de excepcion — pide tipo + nota antes de cambiar el estado */}
      {excModal && (
        <div
          style={MODAL_BACKDROP}
          onClick={() => {
            if (!isPending) {
              setExcModal(false);
              setExcNote("");
              setError(null);
            }
          }}
        >
          <div
            style={MODAL_BOX}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exc-modal-title"
          >
            <h3
              id="exc-modal-title"
              className="studio-display"
              style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}
            >
              ⚠ Marcar excepción
            </h3>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "0 0 16px",
              }}
            >
              Una excepción es un problema activo que requiere acción humana
              antes de continuar el envío. Queda registrada en el timeline y
              visible en un banner arriba del detalle.
            </p>

            <label className="studio-label" htmlFor="exc-type">
              Tipo de excepción *
            </label>
            <select
              id="exc-type"
              className="studio-input"
              value={excType}
              onChange={(e) => setExcType(e.target.value as ExceptionTypeValue)}
              autoFocus
              style={{ marginBottom: 12 }}
            >
              {EXCEPTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="studio-label" htmlFor="exc-note">
              Descripción{" "}
              <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                (opcional pero recomendado)
              </span>
            </label>
            <textarea
              id="exc-note"
              className="studio-input"
              rows={3}
              value={excNote}
              onChange={(e) => setExcNote(e.target.value)}
              placeholder="p. ej. ‘Aduana pide factura comercial, contactando cliente para que la envíe’"
              style={{ resize: "vertical", marginBottom: 12 }}
            />

            {error && (
              <p
                style={{
                  color: "var(--danger)",
                  font: "500 12px/1.4 var(--f-sans)",
                  marginBottom: 12,
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => {
                  setExcModal(false);
                  setExcNote("");
                  setError(null);
                }}
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-warning studio-btn-sm"
                onClick={handleExceptionConfirm}
                disabled={isPending}
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? "Marcando…" : "Marcar excepción"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
