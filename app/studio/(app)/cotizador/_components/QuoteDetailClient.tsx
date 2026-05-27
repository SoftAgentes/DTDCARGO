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
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
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

const SENT_SUCCESS_MS = 2500;

export function QuoteDetailClient({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmConvert, setConfirmConvert] = useState(false);
  // Lifteo del flag "recién envié" para extender la visibilidad del botón
  // durante el flash verde · sin esto, el revalidatePath del server
  // cambia quote.status a "sent" y el botón se desmonta antes de que el
  // operador vea la confirmación.
  const [justSent, setJustSent] = useState(false);

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

        {(quote.status === "draft" || justSent) && (
          <ActionButton
            variant="primary"
            size="sm"
            idleLabel="Enviar cotización"
            loadingLabel="Enviando…"
            successLabel="Enviado al cliente"
            idleIcon={Icon.mail(14)}
            successIcon={Icon.check(14)}
            successMs={SENT_SUCCESS_MS}
            disabled={isPending}
            title={(s) =>
              s === "success"
                ? "Email enviado al cliente y cotización marcada como enviada"
                : "Manda el email al cliente con la cotización y la marca como enviada"
            }
            onAction={async () => {
              setError(null);
              return markQuoteSent(quote.id);
            }}
            onSuccess={() => {
              setJustSent(true);
              setTimeout(() => setJustSent(false), SENT_SUCCESS_MS);
            }}
            onError={setError}
          />
        )}

        {quote.status === "sent" && !justSent && (
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
