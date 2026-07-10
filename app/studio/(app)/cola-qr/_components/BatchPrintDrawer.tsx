"use client";

/**
 * BatchPrintDrawer — selección de impresora para órdenes en lote (SDD-0033).
 */

import { useActionState, useState } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { batchAssignPrinterAction } from "../actions";
import { MOCK_PRINTERS, type QrQueueActionState } from "@/lib/studio/qr-queue-types";

const FORM_ID = "batch-print-form";
const INITIAL: QrQueueActionState = {};

export function BatchPrintDrawer({
  ids,
  onClose,
  onSuccess,
}: {
  ids: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [printerId, setPrinterId] = useState<string>(
    MOCK_PRINTERS.find((p) => p.online)?.id ?? MOCK_PRINTERS[0].id,
  );
  const [state, formAction, isPending] = useActionState(
    batchAssignPrinterAction,
    INITIAL,
  );

  if (state?.ok) {
    setTimeout(onSuccess, 100);
  }

  const selectedPrinter = MOCK_PRINTERS.find((p) => p.id === printerId);
  const printerLabel = selectedPrinter?.label ?? "";

  const canSubmit = ids.length > 0 && !!selectedPrinter?.online;

  return (
    <DrawerShell
      title="Asignar impresora"
      subtitle={`${ids.length} orden${ids.length === 1 ? "" : "es"} a procesar`}
      onClose={onClose}
      pending={isPending}
      width={520}
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
        {ids.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <input type="hidden" name="printer_label" value={printerLabel} />

        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Las órdenes seleccionadas pasarán a estado <strong>imprimiendo</strong>
          con esta impresora asignada. Marcalas como <strong>impresas</strong>
          cuando salga el papel.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {MOCK_PRINTERS.map((p) => {
            const active = printerId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!p.online}
                onClick={() => setPrinterId(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-3)",
                  padding: 14,
                  background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                  border: `1.5px solid ${active ? "var(--wine)" : "var(--border)"}`,
                  borderRadius: "var(--r-md)",
                  textAlign: "left",
                  cursor: p.online ? "pointer" : "not-allowed",
                  opacity: p.online ? 1 : 0.5,
                }}
              >
                <input
                  type="radio"
                  checked={active}
                  readOnly
                  disabled={!p.online}
                  style={{ accentColor: "var(--wine)" }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      font: "700 13px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      display: "flex",
                      gap: "var(--s-2)",
                      font: "500 11px/1.2 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    <span>{p.type}</span>
                    <span style={{ color: p.online ? "var(--success)" : "var(--danger)" }}>
                      {p.online ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {state?.error && (
          <div
            style={{
              padding: "var(--s-3)",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-sm)",
              font: "600 12.5px/1.4 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel={`Imprimir ${ids.length} orden${ids.length === 1 ? "" : "es"}`}
      />
    </DrawerShell>
  );
}
