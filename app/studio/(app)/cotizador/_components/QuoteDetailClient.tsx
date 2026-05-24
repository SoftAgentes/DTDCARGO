"use client";

/**
 * Wrapper client del detalle de cotización.
 *
 * Maneja:
 * - Estado del drawer de edit (solo cuando status=draft)
 * - Acciones de transición de estado (Enviar, Aceptar, Rechazar)
 * - Convertir a embarque (con redirect al shipment creado)
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  canConvertToShipment,
  isEditable,
  type Quote,
} from "@/lib/studio/quote-types";
import {
  convertQuoteToShipment,
  markQuoteAccepted,
  markQuoteRejected,
  markQuoteSent,
} from "../actions";
import { QuoteDrawer } from "./QuoteDrawer";

export function QuoteDetailClient({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmConvert, setConfirmConvert] = useState(false);

  const handleSent = () => {
    setError(null);
    startTransition(async () => {
      const r = await markQuoteSent(quote.id);
      if (r.error) setError(r.error);
    });
  };

  const handleAccepted = () => {
    setError(null);
    startTransition(async () => {
      const r = await markQuoteAccepted(quote.id);
      if (r.error) setError(r.error);
    });
  };

  const handleRejected = () => {
    setError(null);
    startTransition(async () => {
      const r = await markQuoteRejected(quote.id);
      if (r.error) setError(r.error);
    });
  };

  const handleConvert = () => {
    setError(null);
    startTransition(async () => {
      const r = await convertQuoteToShipment(quote.id);
      if (r.error) {
        setError(r.error);
      } else if (r.shipmentId) {
        router.push(`/studio/tracking/${r.shipmentId}`);
      }
    });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {isEditable(quote.status) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => setEditing(true)}
            disabled={isPending}
          >
            Editar
          </button>
        )}

        {quote.status === "draft" && (
          <button
            type="button"
            className="studio-btn studio-btn-dark studio-btn-sm"
            onClick={handleSent}
            disabled={isPending}
            title="Marca como enviada (sin email real — SDD futuro)"
          >
            {isPending ? "Procesando…" : "Marcar enviada →"}
          </button>
        )}

        {quote.status === "sent" && (
          <>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
              onClick={handleRejected}
              disabled={isPending}
            >
              Rechazada
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={handleAccepted}
              disabled={isPending}
            >
              Aceptada ✓
            </button>
          </>
        )}

        {canConvertToShipment(quote) && (
          confirmConvert ? (
            <div
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <span
                style={{
                  font: "500 12px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                ¿Convertir ahora?
              </span>
              <button
                type="button"
                className="studio-btn studio-btn-primary studio-btn-sm"
                onClick={handleConvert}
                disabled={isPending}
              >
                {isPending ? "Convirtiendo…" : "Sí, convertir"}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setConfirmConvert(false)}
                disabled={isPending}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={() => setConfirmConvert(true)}
              disabled={isPending}
              title="Crea un embarque del Tracking con los datos de la cotización"
            >
              Convertir a embarque →
            </button>
          )
        )}

        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled
          title="Próximamente"
        >
          PDF
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled
          title="Próximamente"
        >
          Duplicar
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 12px",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </p>
      )}

      {editing && (
        <QuoteDrawer
          mode="edit"
          quote={quote}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
