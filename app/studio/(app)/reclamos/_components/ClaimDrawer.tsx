"use client";

/**
 * ClaimDrawer — crear / editar un reclamo (SDD-0101 · Slice A).
 *
 * DrawerShell + DrawerFooter compartidos. useActionState con
 * createClaimAction / updateClaimAction. En create, al éxito → toast +
 * navega al listado con highlight warm (regla de trazabilidad visual).
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLAIM_TYPE_OPTIONS,
  type ClaimActionState,
  type ClaimType,
  type ClientClaim,
} from "@/lib/studio/reclamos/claims-types";
import type {
  ClaimClientOption,
  ClaimShipmentOption,
} from "@/lib/studio/reclamos/claims-queries";
import { createClaimAction, updateClaimAction } from "../actions";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

const FORM_ID = "claim-drawer-form";
const initialState: ClaimActionState = {};

interface Props {
  mode: "create" | "edit";
  claim?: ClientClaim;
  clients: ClaimClientOption[];
  shipments: ClaimShipmentOption[];
  onClose: () => void;
}

export function ClaimDrawer({ mode, claim, clients, shipments, onClose }: Props) {
  const action =
    mode === "edit" && claim
      ? updateClaimAction.bind(null, claim.id)
      : createClaimAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const router = useRouter();
  const toast = useToast();

  const [claimType, setClaimType] = useState<ClaimType>(
    claim?.claim_type ?? "dano",
  );
  const [amount, setAmount] = useState<string>(
    claim?.amount_usd != null ? String(claim.amount_usd) : "",
  );

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "create" && state.createdCode) {
      const code = state.createdCode;
      toast.success(`Reclamo ${code} creado`, {
        link: {
          href: `/studio/reclamos?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      router.push(
        `/studio/reclamos?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
      );
    } else {
      toast.success("Reclamo actualizado");
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.createdCode]);

  const title = mode === "create" ? "Nuevo reclamo" : "Editar reclamo";
  const subtitle =
    mode === "edit" && claim ? claim.claim_code : "El código RC se asigna al crear.";

  const noClients = clients.length === 0;

  return (
    <DrawerShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      pending={isPending}
      width={580}
    >
      <form
        id={FORM_ID}
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
        {noClients && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "var(--warning-bg)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--r-sm)",
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            No hay clientes cargados. Crea un cliente antes de registrar un reclamo.
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="studio-label" htmlFor="cl-client">
            Cliente <span style={{ color: "var(--wine)" }}>*</span>
          </label>
          <select
            id="cl-client"
            name="client_id"
            className="studio-input"
            defaultValue={claim?.client_id ?? ""}
            required
            autoFocus
          >
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.markbox} · {c.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.client_id && (
            <FieldError msg={state.fieldErrors.client_id} />
          )}
        </div>

        {/* Embarque (opcional) + Contenedor */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="cl-shipment">
              Embarque{" "}
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <select
              id="cl-shipment"
              name="shipment_id"
              className="studio-input"
              defaultValue={claim?.shipment_id ?? ""}
            >
              <option value="">Sin embarque</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                  {s.client_markbox ? ` · ${s.client_markbox}` : ""}
                </option>
              ))}
            </select>
            {state.fieldErrors?.shipment_id && (
              <FieldError msg={state.fieldErrors.shipment_id} />
            )}
          </div>
          <div>
            <label className="studio-label" htmlFor="cl-container">
              Contenedor{" "}
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <input
              id="cl-container"
              name="container_code"
              type="text"
              className="studio-input studio-input-mono"
              defaultValue={claim?.container_code ?? ""}
              placeholder="DTDU-204815"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Tipo */}
        <div>
          <label className="studio-label" htmlFor="cl-type">
            Tipo de reclamo <span style={{ color: "var(--wine)" }}>*</span>
          </label>
          <select
            id="cl-type"
            name="claim_type"
            className="studio-input"
            value={claimType}
            onChange={(e) => setClaimType(e.target.value as ClaimType)}
            required
          >
            {CLAIM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.claim_type && (
            <FieldError msg={state.fieldErrors.claim_type} />
          )}
        </div>

        {/* Descripción */}
        <div>
          <label className="studio-label" htmlFor="cl-desc">
            Descripción <span style={{ color: "var(--wine)" }}>*</span>
          </label>
          <textarea
            id="cl-desc"
            name="description"
            rows={3}
            className="studio-input"
            defaultValue={claim?.description ?? ""}
            placeholder="Caja 12/30 con producto quebrado, 2 cajas faltantes, entrega fuera de ETA…"
            required
            style={{ resize: "vertical" }}
          />
          {state.fieldErrors?.description && (
            <FieldError msg={state.fieldErrors.description} />
          )}
        </div>

        {/* Monto + Seguro */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <div>
            <label className="studio-label" htmlFor="cl-amount">
              Monto reclamado
            </label>
            <NumericInput
              id="cl-amount"
              name="amount_usd"
              type="currency"
              min={0}
              placeholder="340"
              value={amount === "" ? null : Number(amount)}
              onChange={(v) => setAmount(v != null ? String(v) : "")}
            />
            {state.fieldErrors?.amount_usd && (
              <FieldError msg={state.fieldErrors.amount_usd} />
            )}
          </div>
          <div>
            <label className="studio-label">Cobertura</label>
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "9px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                font: "500 12.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              <input
                type="checkbox"
                name="insured"
                defaultChecked={claim?.insured ?? false}
              />
              Cubierto por seguro
            </label>
          </div>
        </div>

        {state.error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {state.error}
          </p>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={!noClients}
        submitLabel={mode === "create" ? "Crear reclamo" : "Guardar cambios"}
      />
    </DrawerShell>
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
