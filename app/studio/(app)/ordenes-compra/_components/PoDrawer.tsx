"use client";

/**
 * Drawers del módulo Órdenes de compra (SDD-0071).
 *
 * PoDrawer    · detalle de una OC de DTD: datos + ítems + provenance (OV/Bill) +
 *               transiciones de status + "Recibir" → genera el Bill (0044).
 * NewPoDrawer · alta de una OC de DTD (proveedor + N ítems).
 *
 * El total se deriva client-side (computeTotalCost) y lo recalcula el server al
 * persistir. Las acciones usan ActionButton (anti-doble-submit) + las server
 * actions del módulo. Solo tokens var(--*).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  canReceive,
  canTransition,
  computeTotalCost,
  itemLineTotal,
  purchaseOrderStatusLabel,
  purchaseOrderStatusTone,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from "@/lib/studio/purchase-orders/types";
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
} from "../actions";
import type { SupplierCnOption } from "./OrdenesCompraClient";

/** Cuenta (subset para el select de gasto). */
export type AccountOption = { id: string; code: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Detalle de la OC ───────────────────────────────────────────

export function PoDrawer({
  po,
  items,
  supplierCnName,
  expenseAccounts,
  onClose,
}: {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  supplierCnName: string | null;
  expenseAccounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState(false);

  const refresh = () => router.refresh();

  const provName = po.supplier_name
    ? po.supplier_name
    : supplierCnName ?? "Sin proveedor";

  const receivable = canReceive(po);
  // Próximas transiciones manuales disponibles (excluye 'facturada', la pone el motor).
  const NEXT_STATES: PurchaseOrderStatus[] = [
    "confirmada",
    "recibida",
    "cerrada",
    "cancelada",
  ];
  const transitions = NEXT_STATES.filter((s) => canTransition(po.status, s));

  return (
    <DrawerShell
      title={po.purchase_order_code}
      subtitle={`${provName} · costo $${fmt(po.total_cost_usd)}`}
      onClose={onClose}
      pending={false}
      width={660}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
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

        {/* Estado + costo */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--r-md)",
            background: `var(--${purchaseOrderStatusTone(po.status)}-bg)`,
            borderLeft: `4px solid var(--${purchaseOrderStatusTone(po.status)})`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Badge tone={purchaseOrderStatusTone(po.status)} dot>
            {purchaseOrderStatusLabel(po.status)}
          </Badge>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "700 9.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Costo total
            </div>
            <div
              style={{ font: "900 24px/1 var(--f-display)", color: "var(--ink)" }}
            >
              ${fmt(po.total_cost_usd)}
            </div>
          </div>
        </div>

        {/* Recibir → Bill */}
        {receivable &&
          (!showReceive ? (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowReceive(true)}
              style={{ alignSelf: "flex-start" }}
            >
              <span style={{ display: "inline-flex" }}>{Icon.invoice(14)}</span>
              Recibir y generar Bill
            </button>
          ) : (
            <ReceiveForm
              po={po}
              expenseAccounts={expenseAccounts}
              onCancel={() => setShowReceive(false)}
              onError={setError}
              onDone={(billCode) => {
                toast.success(
                  `OC ${po.purchase_order_code} recibida · Bill ${billCode ?? ""} generado`,
                );
                setShowReceive(false);
                onClose();
                refresh();
              }}
            />
          ))}

        {/* Provenance */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Trazabilidad
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field
              label="Orden de venta"
              value={po.sales_order_id ? "Vinculada" : "Standalone"}
            />
            <Field
              label="Bill generado"
              value={po.bill_id ? "Sí" : "—"}
            />
            <Field label="Cliente" value={po.client_markbox ?? "—"} mono />
            <Field label="Proveedor" value={provName} />
          </div>
          {po.notes && (
            <div
              style={{
                marginTop: 12,
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {po.notes}
            </div>
          )}
        </div>

        {/* Ítems */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Ítems · {items.length}
          </div>
          {items.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--r-md)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Sin ítems cargados.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              {items.map((it, i) => (
                <div
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 70px 110px 110px",
                    gap: 10,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink)" }}
                  >
                    {it.description}
                  </span>
                  <span
                    style={{
                      font: "600 11.5px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      textAlign: "right",
                    }}
                  >
                    {it.qty}
                  </span>
                  <span
                    style={{
                      font: "600 11.5px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      textAlign: "right",
                    }}
                  >
                    ${fmt(it.unit_cost_usd)}
                  </span>
                  <span
                    style={{
                      font: "700 12px/1 var(--f-mono)",
                      color: "var(--ink)",
                      textAlign: "right",
                    }}
                  >
                    ${fmt(itemLineTotal(it))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transiciones de status */}
        {transitions.length > 0 && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {transitions.map((to) => (
              <ActionButton
                key={to}
                variant={to === "cancelada" ? "danger" : "dark"}
                size="sm"
                idleLabel={
                  to === "confirmada"
                    ? "Confirmar"
                    : to === "recibida"
                      ? "Marcar recibida"
                      : to === "cerrada"
                        ? "Cerrar"
                        : "Cancelar"
                }
                loadingLabel="Cambiando…"
                successLabel={null}
                onAction={async () => {
                  setError(null);
                  const r = await setPurchaseOrderStatus(po.id, to);
                  if (r.error) return { error: r.error };
                  toast.info(`OC ${po.purchase_order_code} → ${purchaseOrderStatusLabel(to)}`);
                  refresh();
                  if (to === "cancelada" || to === "cerrada") onClose();
                  return undefined;
                }}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

// ── Form de recepción → Bill ───────────────────────────────────

function ReceiveForm({
  po,
  expenseAccounts,
  onCancel,
  onError,
  onDone,
}: {
  po: PurchaseOrder;
  expenseAccounts: AccountOption[];
  onCancel: () => void;
  onError: (m: string) => void;
  onDone: (billCode: string | undefined) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  // Default a la 1ª cuenta COGS (code 5.*); si no hay, la 1ª disponible.
  const defaultAccount =
    expenseAccounts.find((a) => a.code.startsWith("5."))?.id ??
    expenseAccounts[0]?.id ??
    "";
  const [expenseAccountId, setExpenseAccountId] = useState<string>(defaultAccount);
  const [dueDate, setDueDate] = useState<string>(today);

  const noAccounts = expenseAccounts.length === 0;
  const valid = !!expenseAccountId && !noAccounts;

  return (
    <div
      style={{
        padding: "16px 16px 14px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="studio-eyebrow">Recibir mercancía · generar Bill</div>
      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Causa el Bill en Tesorería por ${fmt(po.total_cost_usd)} (lo que DTD le
        debe al proveedor). Elegí la cuenta de costo donde se imputa la compra.
      </p>

      <div>
        <label className="studio-label" htmlFor="po-rec-account">
          Cuenta de costo / gasto a imputar
        </label>
        {noAccounts ? (
          <p
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--warning)",
              margin: "4px 0 0",
            }}
          >
            No hay cuentas de costo/gasto en el plan. Sembrá el plan en
            Contabilidad para generar el Bill con asiento.
          </p>
        ) : (
          <select
            id="po-rec-account"
            className="studio-input"
            value={expenseAccountId}
            onChange={(e) => setExpenseAccountId(e.target.value)}
          >
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="studio-label" htmlFor="po-rec-due">
          Vencimiento del Bill
        </label>
        <input
          id="po-rec-due"
          type="date"
          className="studio-input studio-input-mono"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Recibir y generar Bill"
          loadingLabel="Generando…"
          successLabel="Bill generado"
          idleIcon={Icon.check(13)}
          successIcon={Icon.check(13)}
          disabled={!valid}
          onAction={async () => {
            onError("");
            const r = await receivePurchaseOrder(po.id, {
              expenseAccountId,
              dueDate,
            });
            if (r.error) return { error: r.error };
            onDone(r.billCode);
            return undefined;
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}

// ── Alta de OC ─────────────────────────────────────────────────

type DraftItem = { description: string; qty: string; unitCostUsd: string };

const EMPTY_ITEM: DraftItem = { description: "", qty: "1", unitCostUsd: "" };

export function NewPoDrawer({
  suppliersCn,
  onClose,
}: {
  suppliersCn: SupplierCnOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [supplierMode, setSupplierMode] = useState<"ficha" | "libre">(
    suppliersCn.length > 0 ? "ficha" : "libre",
  );
  const [supplierId, setSupplierId] = useState<string>(suppliersCn[0]?.id ?? "");
  const [supplierName, setSupplierName] = useState<string>("");
  const [clientMarkbox, setClientMarkbox] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = computeTotalCost(
    items.map((it) => ({
      qty: Number(it.qty) || 0,
      unit_cost_usd: Number(it.unitCostUsd) || 0,
    })),
  );

  const hasSupplier =
    supplierMode === "ficha" ? !!supplierId : !!supplierName.trim();
  const hasValidItem = items.some(
    (it) =>
      it.description.trim() &&
      Number(it.qty) > 0 &&
      Number(it.unitCostUsd) >= 0,
  );
  const canSubmit = hasSupplier && hasValidItem;

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  };
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) =>
    setItems((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);
    const r = await createPurchaseOrder({
      clientMarkbox: clientMarkbox.trim() || null,
      supplierId: supplierMode === "ficha" ? supplierId || null : null,
      supplierName: supplierMode === "libre" ? supplierName.trim() || null : null,
      salesOrderId: null,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        description: it.description.trim(),
        qty: Number(it.qty) || 0,
        unitCostUsd: Number(it.unitCostUsd) || 0,
      })),
    });
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(`OC ${r.purchaseOrderCode ?? ""} creada`);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title="Nueva orden de compra de DTD"
      subtitle="Lo que DTD le compra al proveedor por cuenta del cliente"
      onClose={onClose}
      pending={pending}
      width={660}
    >
      <form
        id="new-po-form"
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

        {/* Proveedor */}
        <div>
          <label className="studio-label">Proveedor</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              className={`studio-btn studio-btn-sm ${
                supplierMode === "ficha"
                  ? "studio-btn-primary"
                  : "studio-btn-ghost"
              }`}
              onClick={() => setSupplierMode("ficha")}
              disabled={suppliersCn.length === 0}
            >
              Ficha del cliente
            </button>
            <button
              type="button"
              className={`studio-btn studio-btn-sm ${
                supplierMode === "libre"
                  ? "studio-btn-primary"
                  : "studio-btn-ghost"
              }`}
              onClick={() => setSupplierMode("libre")}
            >
              Nombre libre
            </button>
          </div>
          {supplierMode === "ficha" ? (
            suppliersCn.length === 0 ? (
              <p
                style={{
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-mute)",
                  margin: 0,
                }}
              >
                No hay proveedores de clientes cargados. Usá nombre libre.
              </p>
            ) : (
              <select
                className="studio-input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliersCn.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.client_markbox} #{s.supplier_seq}
                  </option>
                ))}
              </select>
            )
          ) : (
            <input
              type="text"
              className="studio-input"
              placeholder="Nombre del proveedor (chino o local)"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="studio-label" htmlFor="po-markbox">
            MARKBOX del cliente{" "}
            <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <input
            id="po-markbox"
            type="text"
            className="studio-input studio-input-mono"
            placeholder="DTD-5532"
            value={clientMarkbox}
            onChange={(e) => setClientMarkbox(e.target.value)}
          />
        </div>

        {/* Ítems */}
        <div>
          <label className="studio-label">Ítems a comprar</label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 120px 32px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  className="studio-input"
                  placeholder="Descripción"
                  aria-label={`Descripción del ítem ${idx + 1}`}
                  value={it.description}
                  onChange={(e) =>
                    updateItem(idx, { description: e.target.value })
                  }
                />
                <NumericInput
                  type="decimal"
                  min={0}
                  placeholder="Cant."
                  aria-label={`Cantidad del ítem ${idx + 1}`}
                  value={it.qty === "" ? null : Number(it.qty)}
                  onChange={(v) =>
                    updateItem(idx, { qty: v != null ? String(v) : "" })
                  }
                />
                <NumericInput
                  type="currency"
                  currency="USD"
                  min={0}
                  placeholder="Costo unit."
                  aria-label={`Costo unitario del ítem ${idx + 1}`}
                  value={it.unitCostUsd === "" ? null : Number(it.unitCostUsd)}
                  onChange={(v) =>
                    updateItem(idx, {
                      unitCostUsd: v != null ? String(v) : "",
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Quitar ítem"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  style={{ padding: 0, height: 32 }}
                >
                  {Icon.trash(13)}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={addItem}
            style={{ marginTop: 8 }}
          >
            <span style={{ display: "inline-flex" }}>{Icon.plus(13)}</span>
            Agregar ítem
          </button>
        </div>

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            Costo total
          </span>
          <span
            style={{ font: "800 18px/1 var(--f-display)", color: "var(--ink)" }}
          >
            ${fmt(total)}
          </span>
        </div>

        <div>
          <label className="studio-label" htmlFor="po-notes">
            Notas <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <textarea
            id="po-notes"
            className="studio-input"
            rows={2}
            placeholder="Instrucciones de compra, condiciones del proveedor…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="new-po-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Crear OC"
        pendingLabel="Creando…"
      />
    </DrawerShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono
            ? "600 12.5px/1.3 var(--f-mono)"
            : "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
