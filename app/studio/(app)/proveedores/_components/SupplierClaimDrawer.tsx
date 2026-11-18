"use client";

/**
 * SDD-0111 · Drawer de crear / editar un reclamo al proveedor + stepper de
 * estado (máquina abierto → en_revision → resuelto|rechazado).
 *
 * Sobre DrawerShell (form id + submit en el footer). Solo tokens var(--*).
 * Al crear/editar: highlight warm + toast. Al avanzar estado: ActionButton +
 * toast (las 3 reglas de trazabilidad del Studio).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import {
  SUPPLIER_CLAIM_KINDS,
  nextSupplierClaimStatuses,
  supplierClaimKindLabel,
  supplierClaimStatusLabel,
  supplierClaimStatusTone,
  type SupplierClaimStatus,
} from "@/lib/studio/proveedores/scorecard-types";
import {
  advanceSupplierClaimAction,
  createSupplierClaimAction,
  updateSupplierClaimAction,
} from "../scorecard-actions";
import type { SupplierClaimRow } from "@/lib/studio/proveedores/scorecard-queries";

/** Opción mínima de proveedor para el selector (viene del scorecard). */
export type SupplierOption = {
  supplier_cn_id: string;
  name: string;
  supplier_seq: number;
  client_markbox: string;
};

const STATUS_ORDER: SupplierClaimStatus[] = [
  "abierto",
  "en_revision",
  "resuelto",
];

export function SupplierClaimDrawer({
  claim,
  suppliers,
  presetSupplierId,
  onClose,
}: {
  /** Presente = editar; ausente = nuevo reclamo. */
  claim?: SupplierClaimRow;
  /** Proveedores del tenant (para el selector al crear). */
  suppliers: SupplierOption[];
  /** Prefija el proveedor al abrir desde el detalle de una ficha. */
  presetSupplierId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!claim;

  const [supplierCnId, setSupplierCnId] = useState(
    claim?.supplier_cn_id ?? presetSupplierId ?? "",
  );
  const [kind, setKind] = useState<string>(claim?.kind ?? "dano");
  const [amount, setAmount] = useState<number | null>(claim?.amount_usd ?? null);
  const [clientMarkbox, setClientMarkbox] = useState(
    claim?.client_markbox ?? "",
  );
  const [description, setDescription] = useState(claim?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit =
    supplierCnId.trim().length > 0 && description.trim().length > 0;

  const status = claim?.status ?? "abierto";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);

    const payload = {
      supplierCnId,
      clientMarkbox: clientMarkbox.trim() || null,
      kind,
      amountUsd: amount ?? 0,
      description: description.trim(),
    };

    const r = editing
      ? await updateSupplierClaimAction(claim!.id, payload)
      : await createSupplierClaimAction(payload);

    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    toast.success(
      editing ? "Reclamo actualizado" : `Reclamo ${r.claimCode ?? ""} creado`,
    );
    onClose();
    router.refresh();
  };

  const nextStatuses = editing ? nextSupplierClaimStatuses(status) : [];

  return (
    <DrawerShell
      title={editing ? claim!.claim_code : "Nuevo reclamo al proveedor"}
      subtitle={
        editing
          ? `${claim!.supplier_name ?? "Proveedor"} · ${supplierClaimKindLabel(claim!.kind)}`
          : "Incidencia operativa de desempeño (daño, faltante, calidad, retraso)"
      }
      titleAccessory={
        editing ? (
          <Badge tone={supplierClaimStatusTone(status)}>
            {supplierClaimStatusLabel(status)}
          </Badge>
        ) : undefined
      }
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="supplier-claim-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        )}

        {/* Stepper de estado (solo al editar) */}
        {editing && (
          <ClaimStepper
            claimId={claim!.id}
            current={status}
            nextStatuses={nextStatuses}
            onError={setError}
            onDone={() => {
              onClose();
              router.refresh();
            }}
          />
        )}

        <div>
          <label className="studio-label" htmlFor="scd-supplier">
            Proveedor reclamado
          </label>
          {editing ? (
            <div
              style={{
                font: "600 13px/1.4 var(--f-sans)",
                color: "var(--ink)",
                padding: "9px 11px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {claim!.supplier_name ?? "Proveedor"}
              {claim!.supplier_seq != null ? ` · #${claim!.supplier_seq}` : ""}
            </div>
          ) : (
            <select
              id="scd-supplier"
              className="studio-input"
              value={supplierCnId}
              onChange={(e) => setSupplierCnId(e.target.value)}
            >
              <option value="">Elige un proveedor…</option>
              {suppliers.map((s) => (
                <option key={s.supplier_cn_id} value={s.supplier_cn_id}>
                  #{s.supplier_seq} · {s.name} · {s.client_markbox}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="scd-kind">
              Tipo de reclamo
            </label>
            <select
              id="scd-kind"
              className="studio-input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {SUPPLIER_CLAIM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {supplierClaimKindLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="scd-amount">
              Monto expuesto{" "}
              <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <NumericInput
              id="scd-amount"
              type="currency"
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="scd-markbox">
            Shipping Mark afectado{" "}
            <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="scd-markbox"
            type="text"
            className="studio-input"
            placeholder="DTD-XXXX"
            value={clientMarkbox}
            onChange={(e) => setClientMarkbox(e.target.value)}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="scd-desc">
            Qué pasó con la mercancía
          </label>
          <textarea
            id="scd-desc"
            className="studio-input"
            rows={4}
            style={{ resize: "vertical", height: "auto", paddingTop: 8 }}
            placeholder="Ej. 3 de 30 cajas llegaron con producto quebrado."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="supplier-claim-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Abrir reclamo"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

/** Stepper visual + botones para avanzar el estado del reclamo. */
function ClaimStepper({
  claimId,
  current,
  nextStatuses,
  onError,
  onDone,
}: {
  claimId: string;
  current: SupplierClaimStatus;
  nextStatuses: SupplierClaimStatus[];
  onError: (m: string) => void;
  onDone: () => void;
}) {
  // Índice del estado actual en la línea feliz (rechazado = fuera de línea).
  const activeIdx =
    current === "rechazado" ? -1 : STATUS_ORDER.indexOf(current);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {STATUS_ORDER.map((st, i) => {
          const done = activeIdx >= 0 && i <= activeIdx;
          return (
            <div
              key={st}
              style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: done ? "var(--wine)" : "var(--border)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  font: done
                    ? "700 10.5px/1 var(--f-sans)"
                    : "500 10.5px/1 var(--f-sans)",
                  color: done ? "var(--ink)" : "var(--ink-soft)",
                }}
              >
                {supplierClaimStatusLabel(st)}
              </span>
              {i < STATUS_ORDER.length - 1 && (
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {current === "rechazado" && (
        <p
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Reclamo rechazado. Puedes reabrirlo si hubo un error.
        </p>
      )}

      {nextStatuses.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {nextStatuses.map((to) => (
            <ActionButton
              key={to}
              variant={
                to === "rechazado"
                  ? "danger"
                  : to === "abierto"
                    ? "ghost"
                    : "primary"
              }
              size="sm"
              idleLabel={
                to === "abierto"
                  ? "Reabrir"
                  : `Marcar ${supplierClaimStatusLabel(to).toLowerCase()}`
              }
              successLabel="Listo"
              onAction={async () => {
                const r = await advanceSupplierClaimAction(claimId, current, to);
                if (r.error) return { error: r.error };
              }}
              onError={onError}
              onSuccess={onDone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
