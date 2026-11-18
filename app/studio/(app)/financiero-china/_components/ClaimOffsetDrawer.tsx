"use client";

/**
 * Drawer de alta de un cruce reclamo→proveedor→china→cliente (SDD-0115 sub-slice 2).
 * Reusa addClaimOffsetAction (valida, persiste en estado `reclamado`, cabla el
 * asiento de neutralización vía SDD-0110). V1: proveedor (opcional) + monto USD +
 * fecha. El shipment/client/evidencia se enriquecen en una iteración posterior.
 */

import { useState, useTransition } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import type { SupplierOption } from "@/lib/studio/partner-finance/types";
import { addClaimOffsetAction } from "../actions";

export function ClaimOffsetDrawer({
  suppliers,
  onClose,
}: {
  suppliers: SupplierOption[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [supplierId, setSupplierId] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(null);
  const [claimedOn, setClaimedOn] = useState("");

  const canSubmit = (amount ?? 0) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addClaimOffsetAction({
        supplier_id: supplierId || null,
        amount_usd: amount,
        claimed_on: claimedOn || null,
        client_id: null,
        shipment_id: null,
        evidence_document_id: null,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Cruce registrado");
      onClose();
    });
  };

  return (
    <DrawerShell
      title="Nuevo cruce"
      subtitle="Reclamo al proveedor que se cobra de China y se aplica al cliente"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="fc-claim-form"
        onSubmit={onSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {error && (
          <Aviso tono="error" compacto>{error}</Aviso>
        )}

        <div>
          <label className="studio-label" htmlFor="fc-claim-supplier">
            Proveedor <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <select
            id="fc-claim-supplier"
            className="studio-input"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">— Sin proveedor —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-claim-amount">
            Monto del cruce (USD)
          </label>
          <NumericInput
            id="fc-claim-amount"
            type="currency"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            min={0}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-claim-date">
            Fecha del reclamo <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="fc-claim-date"
            type="date"
            className="studio-input"
            value={claimedOn}
            onChange={(e) => setClaimedOn(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="fc-claim-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Registrar cruce"
      />
    </DrawerShell>
  );
}
