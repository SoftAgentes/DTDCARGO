"use client";

/**
 * Drawers del módulo Órdenes de venta (SDD-0072).
 *
 * OvDrawer              · detalle de una OV: provenance ("viene de EST-…") +
 *                         snapshot editable + transiciones de status + asignar/
 *                         quitar prealertas (cajas físicas).
 * NewOvDrawer           · alta manual de una OV (sin estimado · B2B/otros).
 * ConvertEstimateDrawer · convierte un estimado aceptado → OV (snapshot del quote).
 *
 * Las acciones usan ActionButton (anti-doble-submit) + las server actions del
 * módulo. Solo tokens var(--*).
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
import { SERVICE_OPTIONS, type ShipmentService } from "@/lib/studio/shipment-types";
import {
  prealertaStatusLabel,
  prealertaStatusTone,
} from "@/lib/studio/prealertas/types";
import {
  canTransition,
  isEditableStatus,
  salesOrderServiceLabel,
  salesOrderStatusLabel,
  salesOrderStatusTone,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/lib/studio/sales-orders/types";
import type { SalesOrderInvoiceRef } from "@/lib/studio/sales-orders/queries";
import {
  statusBadgeTone as invoiceTone,
  statusLabel as invoiceStatusLabel,
  type InvoiceStatus,
} from "@/lib/studio/invoice-types";
import {
  assignPrealertaToSalesOrder,
  convertEstimateToSalesOrder,
  createSalesOrder,
  setSalesOrderStatus,
  unassignPrealertaFromSalesOrder,
  updateSalesOrder,
} from "../actions";

/** Estimado (subset para el select de conversión). */
export type QuoteOption = {
  id: string;
  quote_code: string;
  client_name: string;
  client_markbox: string | null;
  total_usd: number;
  sales_order_id: string | null;
};

/** Prealerta (subset para asignar cajas a la OV). */
export type PrealertaOption = {
  id: string;
  code: string;
  description: string;
  client_markbox: string;
  boxes: number;
  status: string;
  sales_order_id: string | null;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ════════════════════════════════════════════════════════════════
// Detalle de la OV
// ════════════════════════════════════════════════════════════════

export function OvDrawer({
  so,
  prealertas,
  invoices,
  allPrealertas,
  onClose,
}: {
  so: SalesOrder;
  prealertas: PrealertaOption[];
  invoices: SalesOrderInvoiceRef[];
  allPrealertas: PrealertaOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = () => router.refresh();

  const editable = isEditableStatus(so.status);
  // Transiciones manuales disponibles (excluye parcial/facturada, las pone el motor).
  const NEXT_STATES: SalesOrderStatus[] = ["cerrada", "cancelada"];
  const transitions = NEXT_STATES.filter((s) => canTransition(so.status, s));

  // Prealertas asignables = vivas, no canceladas, no atadas a OTRA OV.
  const assignable = allPrealertas.filter(
    (p) =>
      p.status !== "cancelada" &&
      (!p.sales_order_id || p.sales_order_id === so.id) &&
      !prealertas.some((x) => x.id === p.id),
  );

  if (editing) {
    return (
      <SalesOrderForm
        mode="edit"
        title={`Editar ${so.sales_order_code}`}
        initial={{
          clientMarkbox: so.client_markbox ?? "",
          clientName: so.client_name,
          service: so.service,
          origin: so.origin,
          destination: so.destination,
          subtotalUsd: so.subtotal_usd,
          totalUsd: so.total_usd,
          notes: so.notes ?? "",
        }}
        onClose={() => setEditing(false)}
        onSubmit={async (payload) => updateSalesOrder(so.id, payload)}
        onDone={() => {
          toast.success(`OV ${so.sales_order_code} actualizada`);
          setEditing(false);
          refresh();
        }}
      />
    );
  }

  return (
    <DrawerShell
      title={so.sales_order_code}
      subtitle={`${so.client_name || "Sin nombre"} · total $${fmt(so.total_usd)}`}
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
        {error && <ErrorBanner message={error} />}

        {/* Estado + total */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--r-md)",
            background: `var(--${salesOrderStatusTone(so.status)}-bg)`,
            borderLeft: `4px solid var(--${salesOrderStatusTone(so.status)})`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--s-4)",
            flexWrap: "wrap",
          }}
        >
          <Badge tone={salesOrderStatusTone(so.status)} dot>
            {salesOrderStatusLabel(so.status)}
          </Badge>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "700 9.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "var(--s-1)",
              }}
            >
              Total
            </div>
            <div
              style={{ font: "900 24px/1 var(--f-display)", color: "var(--ink)" }}
            >
              ${fmt(so.total_usd)}
            </div>
          </div>
        </div>

        {editable && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => setEditing(true)}
            style={{ alignSelf: "flex-start" }}
          >
            <span style={{ display: "inline-flex" }}>{Icon.edit?.(13)}</span>
            Editar datos
          </button>
        )}

        {/* Provenance */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Trazabilidad
          </div>
          {so.quote_id ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: "var(--info-bg)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink)",
                marginBottom: "var(--s-3)",
              }}
            >
              {so.quote_code ? (
                <>
                  Viene del estimado{" "}
                  <code
                    style={{
                      font: "700 12px/1.2 var(--f-mono)",
                      color: "var(--wine-text)",
                    }}
                  >
                    {so.quote_code}
                  </code>
                  .{" "}
                </>
              ) : (
                <>
                  Viene de un <strong>Estimado</strong> aceptado.{" "}
                </>
              )}
              El snapshot se copió al convertir y se puede editar mientras la OV
              esté confirmada.
            </div>
          ) : (
            <div
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                marginBottom: "var(--s-3)",
              }}
            >
              OV manual (sin estimado previo · B2B / otros servicios).
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Cliente" value={so.client_name || "—"} />
            <Field label="Shipping Mark" value={so.client_markbox ?? "—"} mono />
            <Field label="Servicio" value={salesOrderServiceLabel(so.service)} />
            <Field
              label="Ruta"
              value={`${so.origin || "—"} → ${so.destination || "—"}`}
            />
            <Field label="Subtotal" value={`$${fmt(so.subtotal_usd)}`} mono />
            <Field label="Total" value={`$${fmt(so.total_usd)}`} mono />
          </div>
          {so.notes && (
            <div
              style={{
                marginTop: "var(--s-3)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {so.notes}
            </div>
          )}
        </div>

        {/* Prealertas (cajas físicas) */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Cajas físicas (prealertas) · {prealertas.length}
          </div>
          {prealertas.length === 0 ? (
            <div
              style={{
                padding: "var(--s-4)",
                textAlign: "center",
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--r-md)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin cajas asignadas. Asigna 1+ prealertas para enlazar lo físico con
              esta venta.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              {prealertas.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 90px 90px",
                    gap: 10,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    alignItems: "center",
                  }}
                >
                  <code
                    style={{
                      font: "700 11px/1.2 var(--f-mono)",
                      color: "var(--wine-text)",
                    }}
                  >
                    {p.code}
                  </code>
                  <span
                    style={{
                      font: "500 12px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.description}
                  </span>
                  <Badge tone={prealertaStatusTone(p.status)} size="sm">
                    {prealertaStatusLabel(p.status)}
                  </Badge>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ActionButton
                      variant="ghost"
                      size="xs"
                      idleLabel="Quitar"
                      loadingLabel="…"
                      successLabel={null}
                      onAction={async () => {
                        setError(null);
                        const r = await unassignPrealertaFromSalesOrder(
                          so.id,
                          p.id,
                        );
                        if (r.error) return { error: r.error };
                        toast.info(`Caja ${p.code} desvinculada`);
                        refresh();
                        return undefined;
                      }}
                      onError={setError}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Asignar prealerta */}
          {so.status !== "cancelada" && assignable.length > 0 && (
            <AssignPrealerta
              options={assignable}
              onAssign={async (prealertaId) => {
                setError(null);
                const r = await assignPrealertaToSalesOrder(so.id, prealertaId);
                if (r.error) {
                  setError(r.error);
                  return;
                }
                toast.success("Caja asignada a la OV");
                refresh();
              }}
            />
          )}
        </div>

        {/* Facturas generadas (Fase 2 · provenance OV → Factura) */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Facturas · {invoices.length}
          </div>
          {invoices.length === 0 ? (
            <div
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin facturas todavía. Se generan automáticamente cuando el almacén
              confirma la recepción de las cajas con sus datos reales.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              {invoices.map((inv, i) => (
                <div
                  key={inv.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px 90px",
                    gap: 10,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    alignItems: "center",
                  }}
                >
                  <code
                    style={{
                      font: "700 11px/1.2 var(--f-mono)",
                      color: "var(--wine-text)",
                    }}
                  >
                    {inv.invoice_code}
                  </code>
                  <span
                    style={{
                      font: "700 12px/1 var(--f-mono)",
                      color: "var(--ink)",
                      textAlign: "right",
                    }}
                  >
                    ${fmt(inv.total_amount)}
                  </span>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Badge tone={invoiceTone(inv.status as InvoiceStatus)} size="sm">
                      {invoiceStatusLabel(inv.status as InvoiceStatus)}
                    </Badge>
                  </div>
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
                idleLabel={to === "cerrada" ? "Cerrar" : "Cancelar"}
                loadingLabel="Cambiando…"
                successLabel={null}
                onAction={async () => {
                  setError(null);
                  const r = await setSalesOrderStatus(so.id, to);
                  if (r.error) return { error: r.error };
                  toast.info(
                    `OV ${so.sales_order_code} → ${salesOrderStatusLabel(to)}`,
                  );
                  refresh();
                  onClose();
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

// ── Asignar prealerta (select + botón) ─────────────────────────

function AssignPrealerta({
  options,
  onAssign,
}: {
  options: PrealertaOption[];
  onAssign: (prealertaId: string) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(options[0]?.id ?? "");

  return (
    <div
      style={{
        marginTop: "var(--s-3)",
        display: "flex",
        gap: "var(--s-2)",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <label className="studio-label" htmlFor="ov-assign-prealerta">
          Asignar caja (prealerta)
        </label>
        <select
          id="ov-assign-prealerta"
          className="studio-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.description.slice(0, 40)} ({p.boxes})
            </option>
          ))}
        </select>
      </div>
      <ActionButton
        variant="dark"
        size="sm"
        idleLabel="Asignar"
        loadingLabel="Asignando…"
        successLabel={null}
        idleIcon={Icon.plus(13)}
        disabled={!value}
        onAction={async () => {
          await onAssign(value);
          return undefined;
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Form compartido (alta manual + edición)
// ════════════════════════════════════════════════════════════════

type FormValues = {
  clientMarkbox: string;
  clientName: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  subtotalUsd: number;
  totalUsd: number;
  notes: string;
};

const EMPTY_FORM: FormValues = {
  clientMarkbox: "",
  clientName: "",
  service: "consolidacion",
  origin: "",
  destination: "",
  subtotalUsd: 0,
  totalUsd: 0,
  notes: "",
};

function SalesOrderForm({
  mode,
  title,
  initial,
  onClose,
  onSubmit,
  onDone,
}: {
  mode: "create" | "edit";
  title: string;
  initial?: FormValues;
  onClose: () => void;
  onSubmit: (payload: {
    clientMarkbox: string | null;
    clientName: string;
    service: ShipmentService;
    origin: string;
    destination: string;
    subtotalUsd: number;
    totalUsd: number;
    notes: string | null;
  }) => Promise<{ ok?: boolean; error?: string; salesOrderCode?: string }>;
  onDone: (code?: string) => void;
}) {
  const [v, setV] = useState<FormValues>(initial ?? EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (patch: Partial<FormValues>) =>
    setV((prev) => ({ ...prev, ...patch }));

  const canSubmit =
    !!v.clientName.trim() &&
    !!v.origin.trim() &&
    !!v.destination.trim() &&
    v.totalUsd >= 0;

  const formId = `ov-form-${mode}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);
    const r = await onSubmit({
      clientMarkbox: v.clientMarkbox.trim() || null,
      clientName: v.clientName.trim(),
      service: v.service,
      origin: v.origin.trim(),
      destination: v.destination.trim(),
      subtotalUsd: v.subtotalUsd,
      totalUsd: v.totalUsd,
      notes: v.notes.trim() || null,
    });
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onDone(r.salesOrderCode);
  };

  return (
    <DrawerShell
      title={title}
      subtitle="El estimado confirmado y formal"
      onClose={onClose}
      pending={pending}
      width={660}
    >
      <form
        id={formId}
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
        {error && <ErrorBanner message={error} />}

        <div>
          <label className="studio-label" htmlFor="ov-client-name">
            Nombre del cliente
          </label>
          <input
            id="ov-client-name"
            type="text"
            className="studio-input"
            placeholder="Importadora Caracas C.A."
            value={v.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="ov-markbox">
            Shipping Mark del cliente{" "}
            <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="ov-markbox"
            type="text"
            className="studio-input studio-input-mono"
            placeholder="DTD-5532"
            value={v.clientMarkbox}
            onChange={(e) => set({ clientMarkbox: e.target.value })}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="ov-service">
            Servicio
          </label>
          <select
            id="ov-service"
            className="studio-input"
            value={v.service}
            onChange={(e) => set({ service: e.target.value as ShipmentService })}
          >
            {SERVICE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <div>
            <label className="studio-label" htmlFor="ov-origin">
              Origen
            </label>
            <input
              id="ov-origin"
              type="text"
              className="studio-input"
              placeholder="Yiwu"
              value={v.origin}
              onChange={(e) => set({ origin: e.target.value })}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ov-destination">
              Destino
            </label>
            <input
              id="ov-destination"
              type="text"
              className="studio-input"
              placeholder="Valencia"
              value={v.destination}
              onChange={(e) => set({ destination: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <div>
            <label className="studio-label" htmlFor="ov-subtotal">
              Subtotal USD
            </label>
            <NumericInput
              type="currency"
              currency="USD"
              min={0}
              placeholder="0.00"
              aria-label="Subtotal en USD"
              value={v.subtotalUsd}
              onChange={(n) => set({ subtotalUsd: n ?? 0 })}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ov-total">
              Total USD
            </label>
            <NumericInput
              type="currency"
              currency="USD"
              min={0}
              placeholder="0.00"
              aria-label="Total en USD"
              value={v.totalUsd}
              onChange={(n) => set({ totalUsd: n ?? 0 })}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="ov-notes">
            Notas <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <textarea
            id="ov-notes"
            className="studio-input"
            rows={2}
            placeholder="Condiciones de la venta, instrucciones…"
            value={v.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
      </form>

      <DrawerFooter
        formId={formId}
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={mode === "edit" ? "Guardar cambios" : "Crear orden de venta"}
        pendingLabel={mode === "edit" ? "Guardando…" : "Creando…"}
      />
    </DrawerShell>
  );
}

// ════════════════════════════════════════════════════════════════
// Alta manual
// ════════════════════════════════════════════════════════════════

export function NewOvDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <SalesOrderForm
      mode="create"
      title="Nueva orden de venta"
      onClose={onClose}
      onSubmit={async (payload) => createSalesOrder(payload)}
      onDone={(code) => {
        toast.success(`OV ${code ?? ""} creada`);
        onClose();
        router.refresh();
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════
// Convertir estimado → OV
// ════════════════════════════════════════════════════════════════

export function ConvertEstimateDrawer({
  quotes,
  onClose,
}: {
  quotes: QuoteOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [quoteId, setQuoteId] = useState<string>(quotes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const selected = quotes.find((q) => q.id === quoteId) ?? null;

  return (
    <DrawerShell
      title="Convertir estimado en orden de venta"
      subtitle="Snapshot del estimado aceptado · editable después"
      onClose={onClose}
      pending={false}
      width={620}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        {error && <ErrorBanner message={error} />}

        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Convierte un <strong>Estimado</strong> aceptado en orden de venta. Se
          copian los datos (cliente, totales, ruta, servicio) — luego puedes
          editarlos mientras la OV esté confirmada.
        </p>

        <div>
          <label className="studio-label" htmlFor="ov-convert-quote">
            Estimado a convertir
          </label>
          <select
            id="ov-convert-quote"
            className="studio-input"
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
          >
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quote_code} · {q.client_name} · ${fmt(q.total_usd)}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              padding: "14px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <Field label="Estimado" value={selected.quote_code} mono />
            <Field label="Cliente" value={selected.client_name} />
            <Field
              label="Shipping Mark"
              value={selected.client_markbox ?? "—"}
              mono
            />
            <Field label="Total" value={`$${fmt(selected.total_usd)}`} mono />
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "14px 22px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          idleLabel="Convertir en orden de venta"
          loadingLabel="Convirtiendo…"
          successLabel="Convertida"
          idleIcon={Icon.check(14)}
          successIcon={Icon.check(14)}
          disabled={!quoteId}
          onAction={async () => {
            setError(null);
            const r = await convertEstimateToSalesOrder(quoteId);
            if (r.error) return { error: r.error };
            toast.success(`OV ${r.salesOrderCode ?? ""} creada desde el estimado`);
            onClose();
            router.refresh();
            return undefined;
          }}
          onError={setError}
        />
      </div>
    </DrawerShell>
  );
}

// ── Helpers visuales ───────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </p>
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
