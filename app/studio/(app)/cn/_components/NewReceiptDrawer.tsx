"use client";

/**
 * NewReceiptDrawer — drawer lateral para crear una nueva recepción CN.
 *
 * Secciones:
 *  1. Almacén (select de hubs)
 *  2. Cliente · MARKBOX (con toggle "caja huérfana")
 *  3. Supplier (bilingüe CN/ES con auto-detección)
 *  4. Items (repeater 1..10 — multi-HS por caja)
 *  5. Totales (cajas, CBM, peso) + fecha recepción
 *  6. Notas
 *
 * Submit via server action createReceiptAction.
 * Items se serializan como JSON en hidden field `items_json`.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { createReceiptAction } from "../actions";
import { SupplierBilingualInput } from "./SupplierBilingualInput";
import type {
  WarehouseCN,
  WarehouseReceiptActionState,
  WarehouseReceiptItemInput,
} from "@/lib/studio/warehouse-cn-types";
import type { Client } from "@/lib/studio/client-types";

interface Props {
  warehouses: WarehouseCN[];
  clients: Client[];
  onClose: () => void;
}

interface ItemRow extends WarehouseReceiptItemInput {
  _key: string;
}

const initialState: WarehouseReceiptActionState = {};
const MAX_ITEMS = 10;

function newItem(): ItemRow {
  return {
    _key: Math.random().toString(36).slice(2, 10),
    description: "",
    description_translated: null,
    hs_code: null,
    quantity: null,
    unit_value_usd: null,
    notes: null,
  };
}

export function NewReceiptDrawer({ warehouses, clients, onClose }: Props) {
  const [state, formAction, isPending] = useActionState(
    createReceiptAction,
    initialState,
  );

  // Form state
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [isOrphan, setIsOrphan] = useState(false);
  const [clientMarkbox, setClientMarkbox] = useState("");
  const [orphanMarks, setOrphanMarks] = useState("");
  const [orphanBroughtBy, setOrphanBroughtBy] = useState("");
  const [orphanSuspected, setOrphanSuspected] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierTranslated, setSupplierTranslated] = useState("");
  const [boxes, setBoxes] = useState("");
  const [totalCbm, setTotalCbm] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [receivedAt, setReceivedAt] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>(() => [newItem()]);

  // Cliente seleccionado → snapshot del nombre
  const selectedClient = clients.find((c) => c.markbox === clientMarkbox);
  const clientName = selectedClient?.name ?? "";

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, newItem()]);
  };

  const removeItem = (key: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((i) => i._key !== key),
    );
  };

  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, ...patch } : i)),
    );
  };

  // Serialized items (sin _key) para hidden field
  const itemsJson = JSON.stringify(
    items.map(({ _key: _, ...it }) => it),
  );

  // Validación cliente para habilitar el submit antes de tocar el server.
  // El server valida igual como red de seguridad (validateReceiptInput).
  const canSubmit = useMemo(() => {
    if (!warehouseId) return false;
    if (!isOrphan && !clientMarkbox) return false;
    if (!isOrphan && !supplierName.trim()) return false;
    if (!items.some((i) => i.description.trim())) return false;
    const boxesNum = Number(boxes);
    if (!Number.isFinite(boxesNum) || boxesNum <= 0) return false;
    if (!receivedAt) return false;
    return true;
  }, [
    warehouseId,
    isOrphan,
    clientMarkbox,
    supplierName,
    items,
    boxes,
    receivedAt,
  ]);

  return (
    <div
      onClick={() => !isPending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              id="receipt-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              Nueva recepción CN
            </h2>
            <p
              style={{
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "4px 0 0",
              }}
            >
              Registro de mercadería recibida en almacén origen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: isPending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="receipt-drawer-form"
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Hidden inputs para que el server lea los valores controlados */}
          <input type="hidden" name="warehouse_id" value={warehouseId} />
          <input
            type="hidden"
            name="is_orphan"
            value={isOrphan ? "true" : "false"}
          />
          <input
            type="hidden"
            name="client_markbox"
            value={isOrphan ? "" : clientMarkbox}
          />
          <input
            type="hidden"
            name="client_name"
            value={isOrphan ? "" : clientName}
          />
          <input type="hidden" name="supplier_name" value={supplierName} />
          <input
            type="hidden"
            name="supplier_name_translated"
            value={supplierTranslated}
          />
          <input type="hidden" name="items_json" value={itemsJson} />

          {/* ── 1. Almacén ──────────────────────────── */}
          <div>
            <label htmlFor="rd-warehouse" className="studio-label">
              Almacén <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <select
              id="rd-warehouse"
              className="studio-input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">Seleccioná el hub que recibió la caja…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.hub_name_es} · {w.hub_name_cn}
                  {w.warehouse_name ? ` — ${w.warehouse_name}` : ""}
                </option>
              ))}
            </select>
            {state.fieldErrors?.warehouse_id && (
              <FieldError msg={state.fieldErrors.warehouse_id} />
            )}
          </div>

          {/* ── 2. Cliente · MARKBOX ────────────────── */}
          <div>
            {!isOrphan ? (
              <>
                <label htmlFor="rd-client" className="studio-label">
                  Cliente · MARKBOX{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <select
                  id="rd-client"
                  className="studio-input studio-input-mono"
                  value={clientMarkbox}
                  onChange={(e) => setClientMarkbox(e.target.value)}
                  required={!isOrphan}
                >
                  <option value="">Seleccioná cliente…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.markbox}>
                      {c.markbox} · {c.name}
                    </option>
                  ))}
                </select>
                {state.fieldErrors?.client_markbox && (
                  <FieldError msg={state.fieldErrors.client_markbox} />
                )}
                <button
                  type="button"
                  onClick={() => setIsOrphan(true)}
                  style={{
                    marginTop: 6,
                    font: "600 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    padding: "2px 0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--wine)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--ink-soft)")
                  }
                >
                  {Icon.box(11)} ¿Sin código MARKBOX? · marcar como caja huérfana
                </button>
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--warning-bg)",
                  border: "1px solid var(--warning)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <span style={{ color: "var(--warning)" }}>
                  {Icon.box(14)}
                </span>
                <div
                  style={{
                    flex: 1,
                    font: "700 12px/1.4 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  Caja huérfana
                  <span
                    style={{
                      font: "500 11px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginLeft: 4,
                    }}
                  >
                    · se asignará{" "}
                    <code
                      style={{
                        font: "700 11px/1 var(--f-mono)",
                        color: "var(--warning)",
                      }}
                    >
                      SIN-CODIGO-NNNN
                    </code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOrphan(false);
                    setOrphanMarks("");
                    setOrphanBroughtBy("");
                    setOrphanSuspected("");
                  }}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                >
                  Desactivar
                </button>
              </div>
            )}
          </div>

          {/* Campos huérfana */}
          {isOrphan && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingLeft: 12,
                borderLeft: "2px solid var(--warning)",
              }}
            >
              <div>
                <label htmlFor="rd-marks" className="studio-label">
                  Marcas / identificación visible
                </label>
                <input
                  id="rd-marks"
                  name="orphan_marks"
                  type="text"
                  className="studio-input"
                  value={orphanMarks}
                  onChange={(e) => setOrphanMarks(e.target.value)}
                  placeholder="Ej: ACINDAR-VLN-04 · ⌂ rojo · etiqueta china"
                />
                <p
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    margin: "4px 0 0",
                  }}
                >
                  Cualquier texto, color, símbolo o marca visible. Sirve
                  para que el cliente reclame la caja después.
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label htmlFor="rd-brought" className="studio-label">
                    ¿Quién la trajo?
                  </label>
                  <input
                    id="rd-brought"
                    name="orphan_brought_by"
                    type="text"
                    className="studio-input"
                    value={orphanBroughtBy}
                    onChange={(e) => setOrphanBroughtBy(e.target.value)}
                    placeholder="Chofer / transportista"
                  />
                </div>
                <div>
                  <label htmlFor="rd-suspected" className="studio-label">
                    Posible cliente (sospecha)
                  </label>
                  <input
                    id="rd-suspected"
                    name="orphan_suspected_client"
                    type="text"
                    className="studio-input"
                    value={orphanSuspected}
                    onChange={(e) => setOrphanSuspected(e.target.value)}
                    placeholder="Si tenés idea…"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Supplier ─────────────────────────── */}
          <SupplierBilingualInput
            value={supplierName}
            onChange={setSupplierName}
            translated={supplierTranslated}
            onTranslatedChange={setSupplierTranslated}
            required={!isOrphan}
            error={state.fieldErrors?.supplier_name}
          />

          {/* ── 4. Items repeater ──────────────────── */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div>
                <div className="studio-eyebrow" style={{ margin: 0 }}>
                  Items en la caja
                </div>
                <p
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-mute)",
                    margin: "4px 0 0",
                  }}
                >
                  Multi-HS soportado · entre 1 y {MAX_ITEMS} items.
                </p>
              </div>
              <button
                type="button"
                onClick={addItem}
                disabled={items.length >= MAX_ITEMS}
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{
                  opacity: items.length >= MAX_ITEMS ? 0.5 : 1,
                  cursor:
                    items.length >= MAX_ITEMS ? "not-allowed" : "pointer",
                }}
              >
                {Icon.plus(12)} Agregar item
              </button>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {items.map((it, idx) => (
                <ItemEditor
                  key={it._key}
                  item={it}
                  index={idx}
                  canRemove={items.length > 1}
                  onChange={(patch) => updateItem(it._key, patch)}
                  onRemove={() => removeItem(it._key)}
                />
              ))}
            </div>

            {state.fieldErrors?.items && (
              <FieldError msg={state.fieldErrors.items} />
            )}
          </div>

          {/* ── 5. Totales + fecha ──────────────────── */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
              Totales de la caja
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <label htmlFor="rd-boxes" className="studio-label">
                  Cajas <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <input
                  id="rd-boxes"
                  name="boxes"
                  type="number"
                  min="0"
                  step="1"
                  className="studio-input studio-input-mono"
                  value={boxes}
                  onChange={(e) => setBoxes(e.target.value)}
                  placeholder="0"
                  required
                />
                {state.fieldErrors?.boxes && (
                  <FieldError msg={state.fieldErrors.boxes} />
                )}
              </div>
              <div>
                <label htmlFor="rd-cbm" className="studio-label">
                  CBM (m³)
                </label>
                <input
                  id="rd-cbm"
                  name="total_cbm"
                  type="number"
                  min="0"
                  step="0.001"
                  className="studio-input studio-input-mono"
                  value={totalCbm}
                  onChange={(e) => setTotalCbm(e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div>
                <label htmlFor="rd-weight" className="studio-label">
                  Peso (kg)
                </label>
                <input
                  id="rd-weight"
                  name="total_weight_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  className="studio-input studio-input-mono"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label htmlFor="rd-received" className="studio-label">
                  Recibido <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <input
                  id="rd-received"
                  name="received_at"
                  type="date"
                  className="studio-input"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  required
                />
                {state.fieldErrors?.received_at && (
                  <FieldError msg={state.fieldErrors.received_at} />
                )}
              </div>
            </div>
          </div>

          {/* ── 6. Notas ────────────────────────────── */}
          <div>
            <label htmlFor="rd-notes" className="studio-label">
              Notas internas
            </label>
            <textarea
              id="rd-notes"
              name="notes"
              rows={3}
              className="studio-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Estado de la mercadería, observaciones, daños visibles…"
              style={{ resize: "vertical" }}
            />
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

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="receipt-drawer-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
          >
            {isPending ? "Registrando…" : "Registrar recepción"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componente: editor de un item del repeater
// ─────────────────────────────────────────────────────────────
function ItemEditor({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  item: ItemRow;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<ItemRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Item {index + 1}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar item ${index + 1}`}
            style={{
              width: 26,
              height: 26,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              borderRadius: "var(--r-sm)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--danger)";
              e.currentTarget.style.background = "var(--danger-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ink-soft)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {Icon.trash(13)}
          </button>
        )}
      </div>

      <div>
        <label
          className="studio-label"
          htmlFor={`item-desc-${item._key}`}
        >
          Descripción <span style={{ color: "var(--wine)" }}>*</span>
        </label>
        <input
          id={`item-desc-${item._key}`}
          type="text"
          className="studio-input"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Cargadores USB-C · 充电器"
          required
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 100px 1fr",
          gap: 10,
        }}
      >
        <div>
          <label
            className="studio-label"
            htmlFor={`item-hs-${item._key}`}
          >
            HS code
          </label>
          <input
            id={`item-hs-${item._key}`}
            type="text"
            className="studio-input studio-input-mono"
            value={item.hs_code ?? ""}
            onChange={(e) =>
              onChange({ hs_code: e.target.value || null })
            }
            placeholder="8517.12.10"
          />
        </div>
        <div>
          <label
            className="studio-label"
            htmlFor={`item-qty-${item._key}`}
          >
            Cantidad
          </label>
          <input
            id={`item-qty-${item._key}`}
            type="number"
            min="0"
            step="1"
            className="studio-input studio-input-mono"
            value={item.quantity ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                quantity: v === "" ? null : Math.round(Number(v)),
              });
            }}
            placeholder="0"
          />
        </div>
        <div>
          <label
            className="studio-label"
            htmlFor={`item-val-${item._key}`}
          >
            Valor unit. USD
          </label>
          <input
            id={`item-val-${item._key}`}
            type="number"
            min="0"
            step="0.01"
            className="studio-input studio-input-mono"
            value={item.unit_value_usd ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                unit_value_usd: v === "" ? null : Number(v),
              });
            }}
            placeholder="0.00"
          />
        </div>
      </div>
    </div>
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
