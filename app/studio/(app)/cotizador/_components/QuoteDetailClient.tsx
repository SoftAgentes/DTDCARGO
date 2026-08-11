"use client";

/**
 * Wrapper client del detalle de un estimado.
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
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  buildQuoteWhatsappText,
  canConvertToShipment,
  isEditable,
  isUnlinkedWebEstimate,
  quoteWhatsappHref,
  type Quote,
} from "@/lib/studio/quote-types";
import type { KommoContactPick } from "@/lib/studio/kommo-convert";
import {
  convertQuoteToShipment,
  linkEstimateToClientAction,
  markQuoteAccepted,
  markQuoteRejected,
  markQuoteSent,
} from "../actions";
import { QuoteDrawer } from "./QuoteDrawer";

const SENT_SUCCESS_MS = 2500;

export function QuoteDetailClient({
  quote,
  kommoMatches = [],
  contactPhone = null,
}: {
  quote: Quote;
  kommoMatches?: KommoContactPick[];
  contactPhone?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  // Lifteo del flag "recién envié" para extender la visibilidad del botón
  // durante el flash verde · sin esto, el revalidatePath del server
  // cambia quote.status a "sent" y el botón se desmonta antes de que el
  // operador vea la confirmación.
  const [justSent, setJustSent] = useState(false);

  // SDD-0061 Slice 3 — vínculo manual del estimado web a un cliente por MARKBOX.
  const [markboxInput, setMarkboxInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, startLinking] = useTransition();
  const canLink = isUnlinkedWebEstimate(quote);

  function handleLink() {
    const markbox = markboxInput.trim();
    if (!markbox) {
      setLinkError("Indica el Shipping Mark del cliente.");
      return;
    }
    setLinkError(null);
    startLinking(async () => {
      const r = await linkEstimateToClientAction(quote.id, markbox);
      if (r.error) {
        setLinkError(r.error);
        return;
      }
      toast.success(`Estimado ${quote.quote_code} vinculado a ${markbox.toUpperCase()}`);
      router.refresh();
    });
  }

  return (
    <>
      {canLink && (
        <section
          style={{
            marginBottom: 16,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--wine)",
            borderRadius: "var(--r-lg)",
            padding: 20,
          }}
        >
          <div className="studio-eyebrow" style={{ marginBottom: 6 }}>
            Vincular a cliente
          </div>
          <p
            style={{
              font: "400 12.5px/1.45 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "0 0 12px",
              maxWidth: "64ch",
            }}
          >
            Este estimado se capturó de la web y aún no tiene cliente. Ingresa el
            Shipping Mark del cliente ya registrado para vincularlo.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              className="studio-input"
              placeholder="DTD-0001"
              value={markboxInput}
              onChange={(e) => setMarkboxInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLink();
              }}
              disabled={linking}
              style={{ width: 200, textTransform: "uppercase", fontFamily: "var(--f-mono)" }}
              aria-label="Shipping Mark del cliente"
            />
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              style={{ height: 38 }}
              onClick={handleLink}
              disabled={linking}
            >
              {linking ? "Vinculando…" : "Vincular"}
            </button>
          </div>

          {kommoMatches.length > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              <strong style={{ color: "var(--ink)" }}>
                Coincide con el CRM:
              </strong>{" "}
              este teléfono ya figura en {kommoMatches.length} contacto
              {kommoMatches.length > 1 ? "s" : ""} del CRM
              {" ("}
              {kommoMatches.slice(0, 3).map((c) => c.name).join(", ")}
              {kommoMatches.length > 3 ? "…" : ""}
              {"). "}
              Revisa antes de crear un cliente duplicado.
            </div>
          )}

          {linkError && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: "var(--s-3) 0 0",
              }}
            >
              {linkError}
            </p>
          )}
        </section>
      )}

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
          >
            Editar
          </button>
        )}

        {(quote.status === "draft" || justSent) && (
          <ActionButton
            variant="primary"
            size="sm"
            idleLabel="Enviar estimado"
            loadingLabel="Enviando…"
            successLabel="Enviado al cliente"
            idleIcon={Icon.mail(14)}
            successIcon={Icon.check(14)}
            successMs={SENT_SUCCESS_MS}
            title={(s) =>
              s === "success"
                ? "Email enviado al cliente y estimado marcado como enviado"
                : "Manda el email al cliente con el estimado y lo marca como enviado"
            }
            onAction={async () => {
              setError(null);
              return markQuoteSent(quote.id);
            }}
            onSuccess={() => {
              setJustSent(true);
              setTimeout(() => setJustSent(false), SENT_SUCCESS_MS);
              toast.success(
                `Estimado ${quote.quote_code} enviado al cliente`,
                {
                  link: {
                    href: `/studio/cotizador?status=sent&highlight=${encodeURIComponent(quote.quote_code)}`,
                    label: "Ver en Enviadas",
                  },
                },
              );
            }}
            onError={setError}
          />
        )}

        {quote.status === "sent" && !justSent && (
          <>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Rechazada"
              loadingLabel="Marcando…"
              successLabel={null}
              onAction={async () => {
                setError(null);
                return markQuoteRejected(quote.id);
              }}
              onSuccess={() =>
                toast.info(`Estimado ${quote.quote_code} marcado como rechazado`, {
                  link: {
                    href: `/studio/cotizador?status=rejected&highlight=${encodeURIComponent(quote.quote_code)}`,
                    label: "Ver en Rechazadas",
                  },
                })
              }
              onError={setError}
            />
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel="Aceptada"
              loadingLabel="Marcando…"
              successLabel="Estimado aceptado"
              successIcon={Icon.check(14)}
              onAction={async () => {
                setError(null);
                return markQuoteAccepted(quote.id);
              }}
              onSuccess={() =>
                toast.success(
                  `Estimado ${quote.quote_code} aceptado · listo para convertir`,
                  {
                    link: {
                      href: `/studio/cotizador?status=accepted&highlight=${encodeURIComponent(quote.quote_code)}`,
                      label: "Ver en Aceptadas",
                    },
                  },
                )
              }
              onError={setError}
            />
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
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel="Sí, convertir"
                loadingLabel="Convirtiendo…"
                successLabel={null}
                onAction={async () => {
                  setError(null);
                  const r = await convertQuoteToShipment(quote.id);
                  if (r.error) return { error: r.error };
                  if (r.shipmentId) {
                    toast.success(
                      `Estimado ${quote.quote_code} convertido a embarque`,
                      {
                        link: {
                          href: `/studio/tracking/${r.shipmentId}`,
                          label: "Ver embarque",
                        },
                      },
                    );
                    // Navega al detalle del shipment · highlight no aplica
                    // acá porque no estamos en el listado.
                    router.push(`/studio/tracking/${r.shipmentId}`);
                  }
                  return undefined;
                }}
                onError={setError}
              />
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setConfirmConvert(false)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={() => setConfirmConvert(true)}
              title="Crea un embarque del Tracking con los datos del estimado"
            >
              Convertir a embarque →
            </button>
          )
        )}

        <a
          href={quoteWhatsappHref(contactPhone, buildQuoteWhatsappText(quote))}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          title={
            contactPhone
              ? "Abre WhatsApp con el desglose del estimado listo para enviar"
              : "Abre WhatsApp con el desglose (elige el contacto al enviar)"
          }
        >
          WhatsApp
        </a>
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
