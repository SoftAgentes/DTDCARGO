"use client";

/**
 * ServiceRequestDrawer — el asesor ATIENDE una solicitud de servicio de
 * recepción (SDD-0098, PORT-1). Muestra el contexto (compra, cliente, notas,
 * trackings, consentimiento) en solo-lectura y deja cambiar el estado + cargar
 * el monto cotizado (advisory) vía `updateServiceRequestAction`.
 *
 * DrawerShell + `<form id>` en el cuerpo + DrawerFooter con submit HTML5.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  PSR_STATUSES,
  defaultAddon,
  psrStatusLabel,
  type PrealertaServiceRequest,
} from "@/lib/studio/prealertas/addons";
import {
  updateServiceRequestAction,
  type ServiceRequestManageState,
} from "../actions";

const FORM_ID = "psr-manage-form";

export type ServiceRequestContext = {
  request: PrealertaServiceRequest;
  /** Código de la compra (prealerta) — para que el operador sepa cuál es. */
  prealertaCode: string | null;
  prealertaDescription: string | null;
};

const fieldLabel: React.CSSProperties = {
  font: "700 10px/1 var(--f-sans)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  marginBottom: 6,
  display: "block",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ServiceRequestDrawer({
  ctx,
  onClose,
  onSaved,
}: {
  ctx: ServiceRequestContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, prealertaCode, prealertaDescription } = ctx;
  const [state, formAction, pending] = useActionState<
    ServiceRequestManageState,
    FormData
  >(updateServiceRequestAction, {});

  // Cierra al guardar OK (el server ya revalidó /studio/proveedores).
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  const addon = defaultAddon(request.addon_code);

  return (
    <DrawerShell
      title={addon?.label ?? request.addon_code}
      subtitle={`Solicitud del cliente ${request.client_markbox}`}
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        {/* Contexto en solo-lectura */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <ReadField label="Compra">
            <code
              style={{ font: "700 12px/1.3 var(--f-mono)", color: "var(--wine-text)" }}
            >
              {prealertaCode ?? "—"}
            </code>
          </ReadField>
          <ReadField label="Pedido">
            {request.timing === "tardia" ? (
              <Badge tone="warning" size="sm">
                Pedido tarde
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                A tiempo
              </Badge>
            )}
          </ReadField>
        </div>

        {prealertaDescription && (
          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>Descripción de la compra</span>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {prealertaDescription}
            </p>
          </div>
        )}

        {request.notes && (
          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>Indicación del cliente</span>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink)",
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                padding: "10px 12px",
              }}
            >
              {request.notes}
            </p>
          </div>
        )}

        {request.trackings && request.trackings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>Trackings ({request.trackings.length})</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {request.trackings.map((t) => (
                <code
                  key={t}
                  style={{
                    font: "600 11px/1 var(--f-mono)",
                    color: "var(--ink)",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-sm)",
                    padding: "5px 8px",
                  }}
                >
                  {t}
                </code>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            font: "500 11px/1.5 var(--f-mono)",
            color: "var(--ink-soft)",
            marginBottom: 22,
          }}
        >
          Solicitado {fmtDate(request.created_at)}
          {request.processed_at ? ` · resuelto ${fmtDate(request.processed_at)}` : ""}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 20,
          }}
        >
          {/* Form de gestión */}
          <form id={FORM_ID} action={formAction}>
            <input type="hidden" name="id" value={request.id} />

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="psr-status" style={fieldLabel}>
                Estado
              </label>
              <select
                id="psr-status"
                name="status"
                defaultValue={request.status}
                className="studio-input"
                style={{ width: "100%" }}
              >
                {PSR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {psrStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="psr-quoted" style={fieldLabel}>
                Monto cotizado (USD) · opcional
              </label>
              <input
                id="psr-quoted"
                name="quoted_amount_usd"
                type="text"
                inputMode="decimal"
                defaultValue={
                  request.quoted_amount_usd != null
                    ? String(request.quoted_amount_usd)
                    : ""
                }
                placeholder="0.00"
                className="studio-input"
                style={{ width: "100%" }}
              />
              <p
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "6px 0 0",
                }}
              >
                Referencia interna del cobro advisory. El cliente lo ve como
                cotizado por su asesor.
              </p>
            </div>

            {state.error && (
              <div style={{ marginTop: 14 }}>
                <Aviso tono="error" compacto>
                  {state.error}
                </Aviso>
              </div>
            )}
          </form>
        </div>
      </div>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={pending}
        canSubmit={!pending}
        submitLabel="Guardar"
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

function ReadField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <div>{children}</div>
    </div>
  );
}
