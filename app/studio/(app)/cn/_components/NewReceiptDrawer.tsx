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
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { createReceiptAction } from "../actions";
import { SupplierBilingualInput } from "./SupplierBilingualInput";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import type {
  WarehouseCN,
  WarehouseReceiptActionState,
  WarehouseReceiptItemInput,
} from "@/lib/studio/warehouse-cn-types";
import type { Client } from "@/lib/studio/client-types";
import { useT } from "@/lib/i18n";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";

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
  const t = useT();
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

  const router = useRouter();
  const toast = useToast();
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  /** Reset de campos para "Crear y empezar otra". */
  const resetFormFields = () => {
    const formEl = document.getElementById(
      "receipt-drawer-form",
    ) as HTMLFormElement | null;
    formEl?.reset();
    setIsOrphan(false);
    setClientMarkbox("");
    setOrphanMarks("");
    setOrphanBroughtBy("");
    setOrphanSuspected("");
    setSupplierName("");
    setSupplierTranslated("");
    setBoxes("");
    setTotalCbm("");
    setTotalWeight("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setNotes("");
    setItems([newItem()]);
    // Mantenemos `warehouseId` igual · el operario suele recibir paquetes
    // del mismo almacén toda la mañana, evitamos reseleccionar cada vez.
  };

  /**
   * Crea recibo llamando createReceiptAction directo + ejecuta el
   * comportamiento `postAction` según opción del SplitActionButton.
   */
  const createWithPostAction = async (
    postAction: "close" | "open" | "reset",
  ): Promise<void | { error?: string }> => {
    setCreateError(null);
    const formEl = document.getElementById(
      "receipt-drawer-form",
    ) as HTMLFormElement | null;
    if (!formEl) return { error: "No se encontró el formulario." };
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return { error: "Hay campos requeridos sin completar." };
    }
    const formData = new FormData(formEl);
    const result = await createReceiptAction(
      {} as WarehouseReceiptActionState,
      formData,
    );
    if (result.error) {
      setCreateError(result.error);
      return { error: result.error };
    }
    if (!result.ok || !result.createdReceiptCode) {
      const m = "No se pudo registrar la recepción.";
      setCreateError(m);
      return { error: m };
    }
    const code = result.createdReceiptCode;
    if (postAction === "close") {
      toast.success(`Recepción ${code} registrada`, {
        link: { href: `/studio/cn/${code}`, label: "Abrir recibo" },
      });
      router.push(
        `/studio/cn?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
      );
      onClose();
    } else if (postAction === "open") {
      toast.success(`Recepción ${code} · abriendo recibo`);
      router.push(`/studio/cn/${code}`);
      onClose();
    } else if (postAction === "reset") {
      toast.success(`Recepción ${code} registrada · siguiente paquete`, {
        link: {
          href: `/studio/cn?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      resetFormFields();
    }
    return undefined;
  };

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
    <DrawerShell
      title={t("warehouse_cn.drawer.title")}
      subtitle={t("warehouse_cn.drawer.subtitle")}
      onClose={onClose}
      pending={isPending}
      width={680}
    >
        <form
          id="receipt-drawer-form"
          onSubmit={(e) => e.preventDefault()}
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
              {t("warehouse_cn.drawer.section_warehouse")}{" "}
              <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <select
              id="rd-warehouse"
              className="studio-input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">{t("warehouse_cn.drawer.warehouse_placeholder")}</option>
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
                  {t("warehouse_cn.drawer.client_label")}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <select
                  id="rd-client"
                  className="studio-input studio-input-mono"
                  value={clientMarkbox}
                  onChange={(e) => setClientMarkbox(e.target.value)}
                  required={!isOrphan}
                >
                  <option value="">{t("warehouse_cn.drawer.client_placeholder")}</option>
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
                  {Icon.box(11)} {t("warehouse_cn.drawer.orphan_toggle")}
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
                  {t("warehouse_cn.drawer.orphan_badge")}
                  <span
                    style={{
                      font: "500 11px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginLeft: "var(--s-1)",
                    }}
                  >
                    {t("warehouse_cn.drawer.orphan_code_note")}{" "}
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
                  {t("warehouse_cn.drawer.orphan_disable")}
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
                gap: "var(--s-3)",
                paddingLeft: "var(--s-3)",
                borderLeft: "2px solid var(--warning)",
              }}
            >
              <div>
                <label htmlFor="rd-marks" className="studio-label">
                  {t("warehouse_cn.drawer.orphan_marks_label")}
                </label>
                <input
                  id="rd-marks"
                  name="orphan_marks"
                  type="text"
                  className="studio-input"
                  value={orphanMarks}
                  onChange={(e) => setOrphanMarks(e.target.value)}
                  placeholder={t("warehouse_cn.drawer.orphan_marks_placeholder")}
                />
                <p
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "var(--s-1) 0 0",
                  }}
                >
                  {t("warehouse_cn.drawer.orphan_marks_hint")}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--s-3)",
                }}
              >
                <div>
                  <label htmlFor="rd-brought" className="studio-label">
                    {t("warehouse_cn.drawer.orphan_brought_label")}
                  </label>
                  <input
                    id="rd-brought"
                    name="orphan_brought_by"
                    type="text"
                    className="studio-input"
                    value={orphanBroughtBy}
                    onChange={(e) => setOrphanBroughtBy(e.target.value)}
                    placeholder={t("warehouse_cn.drawer.orphan_brought_placeholder")}
                  />
                </div>
                <div>
                  <label htmlFor="rd-suspected" className="studio-label">
                    {t("warehouse_cn.drawer.orphan_suspected_label")}
                  </label>
                  <input
                    id="rd-suspected"
                    name="orphan_suspected_client"
                    type="text"
                    className="studio-input"
                    value={orphanSuspected}
                    onChange={(e) => setOrphanSuspected(e.target.value)}
                    placeholder={t("warehouse_cn.drawer.orphan_suspected_placeholder")}
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
                marginBottom: "var(--s-2)",
              }}
            >
              <div>
                <div className="studio-eyebrow" style={{ margin: 0 }}>
                  {t("warehouse_cn.drawer.items_title")}
                </div>
                <p
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "var(--s-1) 0 0",
                  }}
                >
                  {t("warehouse_cn.drawer.items_hint", { max: MAX_ITEMS })}
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
                {Icon.plus(12)} {t("warehouse_cn.drawer.items_add_btn")}
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
              {t("warehouse_cn.drawer.totals_title")}
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
                  {t("warehouse_cn.drawer.boxes_field_label")}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <NumericInput
                  id="rd-boxes"
                  name="boxes"
                  type="count"
                  unit={t("warehouse_cn.drawer.boxes_unit")}
                  required
                  min={0}
                  placeholder="0"
                  value={boxes === "" ? null : Number(boxes)}
                  onChange={(v) => setBoxes(v != null ? String(v) : "")}
                />
                {state.fieldErrors?.boxes && (
                  <FieldError msg={state.fieldErrors.boxes} />
                )}
              </div>
              <div>
                <label htmlFor="rd-cbm" className="studio-label">
                  {t("warehouse_cn.drawer.cbm_field_label")}
                </label>
                <NumericInput
                  id="rd-cbm"
                  name="total_cbm"
                  type="volume"
                  min={0}
                  placeholder="0.000"
                  value={totalCbm === "" ? null : Number(totalCbm)}
                  onChange={(v) =>
                    setTotalCbm(v != null ? String(v) : "")
                  }
                />
              </div>
              <div>
                <label htmlFor="rd-weight" className="studio-label">
                  {t("warehouse_cn.drawer.weight_field_label")}
                </label>
                <NumericInput
                  id="rd-weight"
                  name="total_weight_kg"
                  type="weight"
                  min={0}
                  placeholder="0"
                  value={totalWeight === "" ? null : Number(totalWeight)}
                  onChange={(v) =>
                    setTotalWeight(v != null ? String(v) : "")
                  }
                />
              </div>
              <div>
                <label htmlFor="rd-received" className="studio-label">
                  {t("warehouse_cn.drawer.received_label")}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
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
              {t("warehouse_cn.drawer.notes_label")}
            </label>
            <textarea
              id="rd-notes"
              name="notes"
              rows={3}
              className="studio-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("warehouse_cn.drawer.notes_placeholder_long")}
              style={{ resize: "vertical" }}
            />
          </div>

          <ErrorAlert state={state} />

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
            {t("chrome.action.cancel")}
          </button>
          <SplitActionButton
            memoryKey="cn-receipt-drawer-create"
            variant="primary"
            size="default"
            disabled={isPending || !canSubmit}
            onError={setCreateError}
            actions={[
              {
                key: "create-and-close",
                idleLabel: t("warehouse_cn.drawer.submit_close"),
                loadingLabel: t("warehouse_cn.drawer.submitting"),
                successLabel: t("warehouse_cn.drawer.success_close"),
                successIcon: Icon.check(14),
                description: t("warehouse_cn.drawer.submit_close_desc"),
                onAction: () => createWithPostAction("close"),
              },
              {
                key: "create-and-open",
                idleLabel: t("warehouse_cn.drawer.submit_open"),
                loadingLabel: t("warehouse_cn.drawer.submitting"),
                successLabel: t("warehouse_cn.drawer.success_open"),
                successIcon: Icon.check(14),
                description: t("warehouse_cn.drawer.submit_open_desc"),
                onAction: () => createWithPostAction("open"),
              },
              {
                key: "create-and-new",
                idleLabel: t("warehouse_cn.drawer.submit_next"),
                loadingLabel: t("warehouse_cn.drawer.submitting"),
                successLabel: t("warehouse_cn.drawer.success_next"),
                successIcon: Icon.check(14),
                description: t("warehouse_cn.drawer.submit_next_desc"),
                onAction: () => createWithPostAction("reset"),
              },
            ]}
          />
        </footer>
    </DrawerShell>
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
  const t = useT();
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
          {t("warehouse_cn.drawer.item_label", { index: index + 1 })}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("warehouse_cn.drawer.item_remove_aria", { index: index + 1 })}
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
          {t("warehouse_cn.drawer.item_desc_label")}{" "}
          <span style={{ color: "var(--wine)" }}>*</span>
        </label>
        <input
          id={`item-desc-${item._key}`}
          type="text"
          className="studio-input"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t("warehouse_cn.drawer.item_desc_placeholder")}
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
            {t("warehouse_cn.drawer.item_hs_label")}
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
            {t("warehouse_cn.drawer.item_qty_label")}
          </label>
          <NumericInput
            id={`item-qty-${item._key}`}
            type="count"
            min={0}
            placeholder="0"
            value={item.quantity}
            onChange={(v) =>
              onChange({ quantity: v == null ? null : Math.round(v) })
            }
          />
        </div>
        <div>
          <label
            className="studio-label"
            htmlFor={`item-val-${item._key}`}
          >
            {t("warehouse_cn.drawer.item_val_label")}
          </label>
          <NumericInput
            id={`item-val-${item._key}`}
            type="currency"
            currency="USD"
            min={0}
            placeholder="0.00"
            value={item.unit_value_usd}
            onChange={(v) => onChange({ unit_value_usd: v })}
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
