"use client";

/**
 * EditarRecepcionClient — UI mobile del editor (Sprint 1 v3).
 *
 * Form simplificado: muestra los campos editables del receipt en un solo
 * paso (vs el flow de 5 pasos del /m/cn/nueva). El warehouse + is_orphan
 * NO son editables (cambios de scope = recepción nueva).
 *
 * Submit → editReceiptAction → revalidate → toast "Recepción editada" +
 * redirect a /m/cn home con highlight de la row.
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { CreateReceiptState, ReceiptItemInput } from "@/lib/studio/operario-types";
import { editReceiptAction } from "../actions";

interface ReceiptPreload {
  id: string;
  code: string;
  warehouseId: string;
  isOrphan: boolean;
  clientMarkbox: string;
  clientName: string;
  orphanMarks: string;
  orphanBroughtBy: string;
  supplierName: string;
  supplierNameTranslated: string;
  boxes: number;
  totalCbm: number | null;
  totalWeightKg: number | null;
  receivedAt: string;
  notes: string;
  destinationCity: string;
}

const INITIAL: CreateReceiptState = {};

export function EditarRecepcionClient({
  receipt,
  items: initialItems,
}: {
  receipt: ReceiptPreload;
  items: ReceiptItemInput[];
}) {
  const router = useRouter();
  const toast = useToast();

  // Bound editReceiptAction to the receipt id
  const editActionBound = editReceiptAction.bind(null, receipt.id);
  const [state, , isPending] = useActionState(editActionBound, INITIAL);

  // Campos editables (solo los relevantes V1)
  const [clientMarkbox, setClientMarkbox] = useState(receipt.clientMarkbox);
  const [clientName, setClientName] = useState(receipt.clientName);
  const [orphanMarks, setOrphanMarks] = useState(receipt.orphanMarks);
  const [orphanBroughtBy, setOrphanBroughtBy] = useState(receipt.orphanBroughtBy);
  const [supplierName, setSupplierName] = useState(receipt.supplierName);
  const [supplierTranslated, setSupplierTranslated] = useState(
    receipt.supplierNameTranslated,
  );
  const [boxes, setBoxes] = useState<number | null>(receipt.boxes);
  const [cbm, setCbm] = useState<number | null>(receipt.totalCbm ?? null);
  const [weight, setWeight] = useState<number | null>(receipt.totalWeightKg ?? null);
  const [notes, setNotes] = useState(receipt.notes);
  const [destinationCity, setDestinationCity] = useState(receipt.destinationCity);
  const [items, setItems] = useState<ReceiptItemInput[]>(initialItems);

  // Item helpers
  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        description_translated: null,
        hs_code: null,
        quantity: null,
        unit_value_usd: null,
        notes: null,
      },
    ]);
  }
  function updateItem(idx: number, patch: Partial<ReceiptItemInput>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildPayload() {
    return {
      warehouse_id: receipt.warehouseId,
      is_orphan: receipt.isOrphan,
      client_markbox: receipt.isOrphan ? null : clientMarkbox.trim() || null,
      client_name: receipt.isOrphan ? null : clientName.trim() || null,
      orphan_marks: receipt.isOrphan ? orphanMarks.trim() || null : null,
      orphan_brought_by: receipt.isOrphan ? orphanBroughtBy.trim() || null : null,
      supplier_name: supplierName.trim() || null,
      supplier_name_translated: supplierTranslated.trim() || null,
      boxes: boxes ?? 0,
      total_cbm: cbm,
      total_weight_kg: weight,
      received_at: receipt.receivedAt,
      notes: notes.trim() || null,
      destination_city: destinationCity.trim() || null,
      items: items
        .filter((it) => it.description.trim() !== "")
        .map((it) => ({
          ...it,
          description: it.description.trim(),
        })),
      incident: false,
      incident_note: null,
    };
  }

  // Effect-less: cuando state.ok llega, redirigimos via callback de
  // ActionButton.onSuccess en lugar de useEffect.
  if (state.ok && !isPending) {
    // Solo se llama una vez · useActionState mantiene el ok
    // mientras no se vuelva a dispatch. Defensive: chequeamos con flag.
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--bg-base)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          padding: "env(safe-area-inset-top) 16px 12px",
          paddingTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link
          href="/m/cn"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          style={{ color: "var(--ink-soft)", textDecoration: "none" }}
        >
          ← Volver
        </Link>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--wine)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Editar recepción
          </div>
          <code
            style={{
              font: "800 14px/1 var(--f-mono)",
              color: "var(--ink)",
              marginTop: 4,
              display: "block",
            }}
          >
            {receipt.code}
          </code>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Cliente · solo si no es huérfana */}
        {!receipt.isOrphan && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
              Cliente
            </div>
            <div>
              <label className="studio-label" htmlFor="ed-markbox">
                MARKBOX
              </label>
              <input
                id="ed-markbox"
                className="studio-input studio-input-mono"
                value={clientMarkbox}
                onChange={(e) => setClientMarkbox(e.target.value)}
                placeholder="DTD-1042"
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="ed-clientname">
                Nombre del cliente
              </label>
              <input
                id="ed-clientname"
                className="studio-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ferretería Maracay"
              />
            </div>
          </section>
        )}

        {/* Huérfana · marcas + traído por */}
        {receipt.isOrphan && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
              Caja huérfana
            </div>
            <div>
              <label className="studio-label" htmlFor="ed-orphan-marks">
                Marcas visibles
              </label>
              <input
                id="ed-orphan-marks"
                className="studio-input"
                value={orphanMarks}
                onChange={(e) => setOrphanMarks(e.target.value)}
                placeholder="ACINDAR-VLN-04 · ⌂ rojo"
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="ed-brought-by">
                Quien la trajo
              </label>
              <input
                id="ed-brought-by"
                className="studio-input"
                value={orphanBroughtBy}
                onChange={(e) => setOrphanBroughtBy(e.target.value)}
                placeholder="Nombre del courier / chofer"
              />
            </div>
          </section>
        )}

        {/* Supplier */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Proveedor
          </div>
          <div>
            <label className="studio-label" htmlFor="ed-supplier">
              Nombre (CN o ES)
            </label>
            <input
              id="ed-supplier"
              className="studio-input"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ed-supplier-tr">
              Traducción (opcional)
            </label>
            <input
              id="ed-supplier-tr"
              className="studio-input"
              value={supplierTranslated}
              onChange={(e) => setSupplierTranslated(e.target.value)}
            />
          </div>
        </section>

        {/* Totales · cajas + CBM + peso */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Totales
          </div>
          <NumLabel htmlFor="ed-boxes">Cajas</NumLabel>
          <NumericInput
            id="ed-boxes"
            type="count"
            unit="cajas"
            value={boxes}
            onChange={(v) => setBoxes(v)}
            min={1}
            required
          />
          <NumLabel htmlFor="ed-cbm">CBM (m³)</NumLabel>
          <NumericInput
            id="ed-cbm"
            type="volume"
            value={cbm}
            onChange={(v) => setCbm(v)}
            min={0}
          />
          <NumLabel htmlFor="ed-weight">Peso (kg)</NumLabel>
          <NumericInput
            id="ed-weight"
            type="weight"
            value={weight}
            onChange={(v) => setWeight(v)}
            min={0}
          />
        </section>

        {/* Destination city · Sprint 0.5 ya lo movió a inline */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Destino VE
          </div>
          <input
            className="studio-input"
            value={destinationCity}
            onChange={(e) => setDestinationCity(e.target.value)}
            placeholder="Maracay · Valencia · Caracas · etc."
          />
        </section>

        {/* Items */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
              Items · {items.length}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="studio-btn studio-btn-ghost studio-btn-xs"
            >
              + Item
            </button>
          </div>
          {items.map((it, idx) => (
            <div
              key={idx}
              style={{
                padding: 10,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                className="studio-input"
                value={it.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Descripción · ej Cargadores USB-C"
              />
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="studio-input studio-input-mono"
                  value={it.hs_code ?? ""}
                  onChange={(e) =>
                    updateItem(idx, { hs_code: e.target.value || null })
                  }
                  placeholder="HS 8517.12.10"
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="studio-input studio-input-mono"
                  value={it.quantity ?? ""}
                  onChange={(e) =>
                    updateItem(idx, {
                      quantity:
                        e.target.value === ""
                          ? null
                          : Math.max(0, Number(e.target.value)),
                    })
                  }
                  placeholder="Cant."
                  style={{ width: 80 }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="studio-btn studio-btn-ghost studio-btn-xs"
                style={{ alignSelf: "flex-end", color: "var(--danger)" }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>

        {/* Notas */}
        <section>
          <label className="studio-label" htmlFor="ed-notes">
            Notas
          </label>
          <textarea
            id="ed-notes"
            className="studio-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cualquier observación adicional"
            style={{ resize: "vertical" }}
          />
        </section>

        {/* Error */}
        {state?.error && (
          <div
            role="alert"
            style={{
              padding: 10,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-sm)",
              font: "600 12.5px/1.4 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}

        {/* Submit */}
        <ActionButton
          variant="primary"
          size="default"
          idleLabel="Guardar cambios"
          loadingLabel="Guardando…"
          successLabel="Cambios guardados"
          disabled={!boxes || boxes <= 0 || isPending}
          onAction={async () => {
            const fd = new FormData();
            fd.set("payload", JSON.stringify(buildPayload()));
            const result = await editActionBound({}, fd);
            if (result.error) return { error: result.error };
            // Defer redirect a onSuccess (después del flash verde)
            return undefined;
          }}
          onSuccess={() => {
            toast.success(`${receipt.code} editada`, {
              link: { href: "/m/cn", label: "Ver mis recepciones" },
            });
            // Redirect tras flash verde de 2.5s
            setTimeout(() => {
              router.push(`/m/cn?highlight=${receipt.code}&hl-tone=warm`);
            }, 2500);
          }}
        />
      </main>
    </div>
  );
}

function NumLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="studio-label"
      style={{ margin: 0 }}
    >
      {children}
    </label>
  );
}
