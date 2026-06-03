"use client";

/**
 * Orquestador client del módulo Tesorería (SDD-0044) — espejo de Cobranzas.
 *
 * Header + 4 KPIs (Por pagar · Vencido · Pagado mes · Proveedores activos) +
 * 3 tabs: Cuentas por pagar (cola CxP con aging) · Pagos (historial de órdenes
 * + remesas a China) · Proveedores (alta/edición supplier-lite).
 *
 * La cola se deriva de las CxP con saldo (no es una tabla). El stage
 * (vencida/por_vencer/parcial/pagada) se calcula server-side.
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  isChinaRemittance,
  paymentMethodLabel,
  supplierTypeLabel,
  SUPPLIER_TYPE_OPTIONS,
  type Supplier,
  type SupplierPayment,
} from "@/lib/studio/treasury/types";
import type {
  Payable,
  TreasuryKpis,
} from "@/lib/studio/treasury/bill-queries";
import {
  BillDrawer,
  NewBillDrawer,
  type AccountOption,
} from "./BillDrawer";
import { SupplierDrawer } from "./SupplierDrawer";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Tab = "payables" | "payments" | "suppliers";

const TABS: { value: Tab; label: string }[] = [
  { value: "payables", label: "Cuentas por pagar" },
  { value: "payments", label: "Pagos" },
  { value: "suppliers", label: "Proveedores" },
];

export function TesoreriaClient({
  payables,
  kpis,
  payments,
  suppliers,
  expenseAccounts,
  cashAccounts,
}: {
  payables: Payable[];
  kpis: TreasuryKpis;
  payments: SupplierPayment[];
  suppliers: Supplier[];
  expenseAccounts: AccountOption[];
  cashAccounts: AccountOption[];
}) {
  const [tab, setTab] = useState<Tab>("payables");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [showNewBill, setShowNewBill] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  const selectedPayable =
    selectedBillId != null
      ? payables.find((p) => p.bill.id === selectedBillId) ?? null
      : null;

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Finanzas · Cuentas por pagar</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Tesorería.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Cola de pagos sobre las cuentas por pagar a proveedores. Causá la CxP
            (con asiento), registrá la orden de pago (que baja el saldo y asienta
            la salida de caja) y seguí las remesas a China.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNewBill(true)}
            disabled={suppliers.length === 0}
            title={
              suppliers.length === 0
                ? "Primero agregá un proveedor en el tab Proveedores"
                : undefined
            }
          >
            + Nueva CxP
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard
          value={`$${fmtMoney(kpis.porPagar)}`}
          label="Por pagar"
          valueColor={kpis.porPagar > 0 ? "var(--wine)" : "var(--ink)"}
          sub={`${kpis.proveedoresActivos} proveedor(es) con saldo`}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.vencido)}`}
          label="Vencido"
          valueColor={kpis.vencido > 0 ? "var(--danger)" : "var(--ink)"}
          sub={kpis.vencido > 0 ? "Requiere pago" : "Sin vencidos"}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.pagadoMes)}`}
          label="Pagado en el mes"
          valueColor={kpis.pagadoMes > 0 ? "var(--success)" : "var(--ink)"}
          sub="Órdenes de pago del mes en curso"
        />
        <KpiCard
          value={`${kpis.proveedoresActivos}`}
          label="Proveedores activos"
          sub="Con CxP con saldo abierto"
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          return (
            <button
              key={tDef.value}
              type="button"
              onClick={() => setTab(tDef.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: active
                  ? "700 13px/1 var(--f-sans)"
                  : "500 13px/1 var(--f-sans)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tDef.label}
            </button>
          );
        })}
      </div>

      {tab === "payables" && (
        <PayablesTab
          payables={payables}
          onSelect={(id) => setSelectedBillId(id)}
          selectedId={selectedBillId}
        />
      )}

      {tab === "payments" && <PaymentsTab payments={payments} />}

      {tab === "suppliers" && (
        <SuppliersTab
          suppliers={suppliers}
          onNew={() => setShowNewSupplier(true)}
          onEdit={(s) => setEditSupplier(s)}
        />
      )}

      {/* Drawers */}
      {selectedPayable && (
        <BillDrawer
          payable={selectedPayable}
          supplier={supplierById.get(selectedPayable.bill.supplier_id) ?? null}
          cashAccounts={cashAccounts}
          onClose={() => setSelectedBillId(null)}
        />
      )}

      {showNewBill && (
        <NewBillDrawer
          suppliers={suppliers}
          expenseAccounts={expenseAccounts}
          onClose={() => setShowNewBill(false)}
        />
      )}

      {showNewSupplier && (
        <SupplierDrawer onClose={() => setShowNewSupplier(false)} />
      )}

      {editSupplier && (
        <SupplierDrawer
          supplier={editSupplier}
          onClose={() => setEditSupplier(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Cuentas por pagar (cola) ──────────────────────────────

const PAYABLE_GRID = "130px 1.4fr 1fr 130px 130px 110px";

function PayablesTab({
  payables,
  onSelect,
  selectedId,
}: {
  payables: Payable[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [stageFilter, setStageFilter] = useState<"all" | Payable["stage"]>(
    "all",
  );

  // El filtro habla el mismo idioma que la columna Estado: el `stage` derivado
  // (vencida/por vencer/parcial), no el `status` crudo de la CxP — espejo de
  // Cobranzas, para que filtro y columna no usen vocabularios distintos.
  const rows = payables.filter((p) =>
    stageFilter === "all" ? true : p.stage === stageFilter,
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 200 }}>
          <label className="studio-label" htmlFor="tes-status">
            Estado
          </label>
          <select
            id="tes-status"
            className="studio-input"
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(e.target.value as "all" | Payable["stage"])
            }
          >
            <option value="all">Todas</option>
            {(["vencida", "por_vencer", "parcial"] as Payable["stage"][]).map(
              (s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={payables.length === 0 ? "Sin saldos" : "Sin resultados"}
          title={
            payables.length === 0
              ? "No hay cuentas por pagar abiertas."
              : "Ninguna CxP coincide con este estado."
          }
          description={
            payables.length === 0
              ? "Cuando crees una CxP con saldo aparecerá acá para gestionar el pago."
              : "Probá cambiar el filtro de estado."
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: PAYABLE_GRID,
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>CxP</span>
            <span>Proveedor</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Saldo</span>
            <span>Vencimiento</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </div>

          {rows.map((p, i) => {
            const bill = p.bill;
            const isSel = selectedId === bill.id;
            // Tinte rojo persistente de fila solo para lo realmente crítico
            // (>30d), como Cobranzas. El "vencido Xd" en --danger ya avisa el
            // atraso temprano sin pintar toda la cola de rojo.
            const veryOverdue = (p.daysOverdue ?? 0) > 30 && p.stage !== "pagada";
            const rowClass = isSel
              ? "studio-tracking-row studio-row-selected"
              : veryOverdue
                ? "studio-tracking-row studio-row-overdue"
                : "studio-tracking-row";
            return (
              <div
                key={bill.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(bill.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(bill.id);
                  }
                }}
                className={rowClass}
                style={{
                  display: "grid",
                  gridTemplateColumns: PAYABLE_GRID,
                  gap: 12,
                  padding: "14px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {bill.bill_code}
                </span>
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      font: "700 12px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bill.supplier_name}
                  </div>
                  {bill.currency !== "USD" && (
                    <div
                      style={{
                        font: "600 10.5px/1 var(--f-mono)",
                        color: "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {bill.currency}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    font: "500 12px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bill.concept ?? "—"}
                </div>
                <span
                  style={{
                    font: "800 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  ${fmtAmount(p.balance)}
                </span>
                <div>
                  <div
                    style={{
                      font: "500 11px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {bill.due_date}
                  </div>
                  {p.daysOverdue != null && (
                    <div
                      style={{
                        font: "700 10px/1 var(--f-sans)",
                        color:
                          p.daysOverdue > 0 ? "var(--danger)" : "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {p.daysOverdue > 0
                        ? `vencido ${p.daysOverdue}d`
                        : p.daysOverdue === 0
                          ? "vence hoy"
                          : `en ${Math.abs(p.daysOverdue)}d`}
                    </div>
                  )}
                </div>
                <span style={{ textAlign: "right" }}>
                  <Badge tone={stageTone(p.stage)} size="sm" dot>
                    {stageLabel(p.stage)}
                  </Badge>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Tab: Pagos ─────────────────────────────────────────────────

const PAYMENT_GRID = "130px 100px 1.4fr 120px 130px 120px 70px";

function PaymentsTab({ payments }: { payments: SupplierPayment[] }) {
  const remesas = payments.filter((p) =>
    isChinaRemittance(p.method, p.currency),
  );
  const remesasTotal = remesas.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <KpiCard
          value={`$${fmtMoney(payments.reduce((s, p) => s + Number(p.amount), 0))}`}
          label="Pagado (histórico)"
          sub={`${payments.length} orden(es) de pago`}
        />
        <KpiCard
          value={`$${fmtMoney(remesasTotal)}`}
          label="Remesas a China"
          valueColor={remesasTotal > 0 ? "var(--wine)" : "var(--ink)"}
          sub={`${remesas.length} orden(es) USDT / CNY / Alipay`}
        />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          eyebrow="Sin pagos"
          title="Todavía no se registraron órdenes de pago."
          description="Registrá un pago desde una CxP (tab Cuentas por pagar) para que aparezca acá."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: PAYMENT_GRID,
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Orden</span>
            <span>Fecha</span>
            <span>Proveedor</span>
            <span>Método</span>
            <span style={{ textAlign: "right" }}>Monto</span>
            <span>CxP origen</span>
            <span style={{ textAlign: "right" }}>Asiento</span>
          </div>

          {payments.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: PAYMENT_GRID,
                gap: 12,
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span
                style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}
              >
                {p.payment_code}
              </span>
              <span
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {p.paid_at}
              </span>
              <span
                style={{
                  font: "600 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.supplier_name}
              </span>
              <span>
                {isChinaRemittance(p.method, p.currency) ? (
                  <Badge tone="wine" size="sm">
                    {paymentMethodLabel(p.method)}
                  </Badge>
                ) : (
                  <span
                    style={{
                      font: "500 11.5px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {paymentMethodLabel(p.method)}
                  </span>
                )}
              </span>
              <span
                style={{
                  font: "800 12.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                ${fmtAmount(p.amount)}
                {p.currency !== "USD" && (
                  <span
                    style={{
                      display: "block",
                      font: "500 9.5px/1 var(--f-mono)",
                      color: "var(--ink-mute)",
                      marginTop: 2,
                    }}
                  >
                    {p.currency}
                  </span>
                )}
              </span>
              <span
                style={{
                  font: "500 10.5px/1 var(--f-mono)",
                  color: "var(--ink-mute)",
                }}
              >
                {p.bill_id ? "vinculada" : "—"}
              </span>
              <span style={{ textAlign: "right" }}>
                {p.journal_entry_id ? (
                  <Badge tone="success" size="sm">
                    Sí
                  </Badge>
                ) : (
                  <span
                    style={{
                      font: "500 11px/1 var(--f-sans)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    —
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Tab: Proveedores ───────────────────────────────────────────

const SUPPLIER_GRID = "120px 1.4fr 130px 90px 1fr 100px";

function SuppliersTab({
  suppliers,
  onNew,
  onEdit,
}: {
  suppliers: Supplier[];
  onNew: () => void;
  onEdit: (s: Supplier) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const rows =
    typeFilter === "all"
      ? suppliers
      : suppliers.filter((s) => s.type === typeFilter);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 200 }}>
          <label className="studio-label" htmlFor="tes-sup-type">
            Tipo
          </label>
          <select
            id="tes-sup-type"
            className="studio-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {SUPPLIER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onNew}
        >
          + Nuevo proveedor
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={suppliers.length === 0 ? "Sin proveedores" : "Sin resultados"}
          title={
            suppliers.length === 0
              ? "Todavía no hay proveedores."
              : "Ningún proveedor coincide con este tipo."
          }
          description={
            suppliers.length === 0
              ? "Agregá tu primer proveedor (naviera, agente, proveedor CN) para empezar a cargar cuentas por pagar."
              : "Probá cambiar el filtro de tipo."
          }
          action={
            suppliers.length === 0 ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={onNew}
              >
                + Nuevo proveedor
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: SUPPLIER_GRID,
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Código</span>
            <span>Nombre</span>
            <span>Tipo</span>
            <span>País</span>
            <span>Canal de pago</span>
            <span style={{ textAlign: "right" }}></span>
          </div>

          {rows.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: SUPPLIER_GRID,
                gap: 12,
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span
                style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}
              >
                {s.supplier_code}
              </span>
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    font: "700 12px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
                {s.name_cn && (
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-cn)",
                      color: "var(--ink-mute)",
                      marginTop: 2,
                    }}
                  >
                    {s.name_cn}
                  </div>
                )}
              </div>
              <span>
                <Badge tone="neutral" size="sm">
                  {supplierTypeLabel(s.type)}
                </Badge>
              </span>
              <span
                style={{
                  font: "600 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {s.country}
              </span>
              <span
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.payment_channel ?? "—"}
              </span>
              <span style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => onEdit(s)}
                >
                  Editar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Helpers de stage (cola CxP) ────────────────────────────────

const STAGE_META: Record<
  Payable["stage"],
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  vencida: { label: "Vencida", tone: "danger" },
  por_vencer: { label: "Por vencer", tone: "warning" },
  parcial: { label: "Parcial", tone: "info" },
  pagada: { label: "Pagada", tone: "success" },
};

function stageLabel(stage: Payable["stage"]): string {
  return STAGE_META[stage].label;
}
function stageTone(
  stage: Payable["stage"],
): "success" | "danger" | "warning" | "info" | "neutral" {
  return STAGE_META[stage].tone;
}
