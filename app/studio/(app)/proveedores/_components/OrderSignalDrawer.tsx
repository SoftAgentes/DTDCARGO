"use client";

/**
 * SDD-0111 · Drawer de captura de señal de recepción (supplier_order_signals,
 * camino A). Extraído de ScorecardTab para adelgazarlo. El proveedor viene
 * pre-seleccionado desde la ficha del scorecard, así que no hay selector.
 *
 * Default optimista (§6.2): on-time / conforme arrancan en "sí" y el operador
 * solo destilda lo que salió mal. Usa el MISMO handler direct-call
 * (createOrderSignalAction) y la misma persistencia — es refactor de UI, no de
 * lógica (NO se migra a useActionState/FormData). Solo tokens var(--*).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { createOrderSignalAction } from "../scorecard-actions";

const FORM_ID = "order-signal-form";

export function OrderSignalDrawer({
  supplierCnId,
  supplierName,
  clientMarkbox,
  onClose,
}: {
  supplierCnId: string;
  supplierName: string;
  clientMarkbox: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [onTime, setOnTime] = useState(true);
  const [conforming, setConforming] = useState(true);
  const [expectedAt, setExpectedAt] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const r = await createOrderSignalAction({
      supplierCnId,
      clientMarkbox: clientMarkbox || null,
      onTime,
      conforming,
      expectedAt: expectedAt || null,
      receivedAt: receivedAt || null,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    toast.success("Recepción registrada");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title="Registrar recepción"
      subtitle={`${supplierName}${clientMarkbox ? ` · ${clientMarkbox}` : ""}`}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <form
        id={FORM_ID}
        onSubmit={submit}
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
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Toggle label="Llegó a tiempo" checked={onTime} onChange={setOnTime} />
          <Toggle
            label="Conforme a lo pedido"
            checked={conforming}
            onChange={setConforming}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sig-expected">
              Fecha prometida{" "}
              <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <input
              id="sig-expected"
              type="date"
              className="studio-input"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="sig-received">
              Fecha de recepción{" "}
              <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <input
              id="sig-received"
              type="date"
              className="studio-input"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="sig-notes">
            Nota <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="sig-notes"
            type="text"
            className="studio-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={pending}
        canSubmit={!pending}
        submitLabel="Guardar recepción"
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        font: "500 12px/1 var(--f-sans)",
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
