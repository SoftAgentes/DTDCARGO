"use client";

/**
 * Orquestador client del módulo Facturación (SDD-0021).
 *
 * Header + 3 KPIs (Facturado YTD · Por cobrar · Vencido) + tabs (Todas ·
 * Por cobrar · Vencidas · Pagadas) + toolbar de búsqueda + tabla con link al
 * detalle + InvoiceDrawer para crear.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  computeBalance,
  displayStatus,
  isOverdue,
  statusBadgeTone,
  statusLabel,
  type Invoice,
  type InvoiceIvaMode,
} from "@/lib/studio/invoice-types";
import type {
  InvoiceFilters,
  InvoiceKpis,
  InvoiceTab,
} from "@/lib/studio/invoice-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { InvoiceDrawer } from "./InvoiceDrawer";

const TABS: { value: InvoiceTab; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Por cobrar" },
  { value: "overdue", label: "Vencidas" },
  { value: "paid", label: "Pagadas" },
];

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

export function FacturacionClient({
  invoices,
  filters,
  kpis,
  counts,
  ivaOn,
  fiscalModuleEnabled = false,
  defaultIvaMode = "sin_iva",
  ivaRateGeneral = 16,
}: {
  invoices: Invoice[];
  filters: InvoiceFilters;
  kpis: InvoiceKpis;
  counts: Record<InvoiceTab, number>;
  ivaOn: boolean;
  fiscalModuleEnabled?: boolean;
  defaultIvaMode?: InvoiceIvaMode;
  ivaRateGeneral?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  const [q, setQ] = useState(params.get("q") ?? "");
  const activeTab = (params.get("tab") as InvoiceTab) ?? "all";

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q, tab: activeTab }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: { q?: string; tab?: InvoiceTab }) => {
    const s = new URLSearchParams();
    if (next.q && next.q.trim()) s.set("q", next.q.trim());
    if (next.tab && next.tab !== "all") s.set("tab", next.tab);
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/facturacion?${qs}` : "/studio/facturacion");
    });
  };

  const rows = filterRowsByTab(invoices, activeTab);
  const hasFiltersApplied = !!filters.q || activeTab !== "all";

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
          <span className="studio-eyebrow">Operación financiera</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Facturación.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Emite facturas con código F-{new Date().getFullYear()}-NNNN, registra
            pagos que bajan el saldo y sigue los vencimientos.
            {ivaOn ? " IVA 16% discriminado." : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            disabled
            title="Próximamente"
          >
            Exportar
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + Nueva factura
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard
          value={`$${fmtMoney(kpis.billedYtd)}`}
          label="Facturado YTD"
          sub={`Año ${new Date().getFullYear()}`}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.outstanding)}`}
          label="Por cobrar"
          valueColor={kpis.outstanding > 0 ? "var(--wine-text)" : "var(--ink)"}
          sub={`${counts.pending + counts.overdue} factura(s) con saldo`}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.overdue)}`}
          label="Vencido"
          valueColor={kpis.overdue > 0 ? "var(--danger)" : "var(--ink)"}
          sub={kpis.overdue > 0 ? "Acción requerida" : "Al día"}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => {
          const active = activeTab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => pushFilters({ q, tab: t.value })}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                color: active ? "var(--wine)" : "var(--ink-soft)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}{" "}
              <span
                style={{
                  font: "700 11px/1 var(--f-mono)",
                  color: active ? "var(--wine)" : "var(--ink-soft)",
                }}
              >
                {counts[t.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="inv-q">
            Buscar
          </label>
          <input
            id="inv-q"
            type="search"
            className="studio-input"
            placeholder="Factura, cliente, Shipping Mark, embarque…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {(q || activeTab !== "all") && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={hasFiltersApplied ? "Sin resultados" : "Sin facturas"}
          title={
            hasFiltersApplied
              ? "Ninguna factura coincide con esta vista."
              : "Aún no hay facturas."
          }
          description={
            hasFiltersApplied
              ? "Prueba ajustar los filtros o limpia la búsqueda."
              : "Emite tu primera factura. El total se calcula a partir de las líneas que cargues."
          }
          action={
            !hasFiltersApplied ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setShowCreate(true)}
              >
                + Nueva factura
              </button>
            ) : null
          }
        />
      ) : (
        <InvoicesTable invoices={rows} />
      )}

      {showCreate && (
        <InvoiceDrawer
          mode="create"
          ivaOn={ivaOn}
          fiscalModuleEnabled={fiscalModuleEnabled}
          defaultIvaMode={defaultIvaMode}
          ivaRateGeneral={ivaRateGeneral}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function filterRowsByTab(rows: Invoice[], tab: InvoiceTab): Invoice[] {
  if (tab === "all") return rows;
  if (tab === "paid") return rows.filter((i) => i.status === "pagada");
  if (tab === "overdue") return rows.filter((i) => isOverdue(i));
  return rows.filter(
    (i) =>
      computeBalance(i) > 0 &&
      i.status !== "anulada" &&
      i.status !== "pagada" &&
      !isOverdue(i),
  );
}

function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const flashClassFor = useRowHighlight();
  const GRID =
    "130px 1.4fr 120px 96px 96px 100px 100px 96px";
  return (
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
          gridTemplateColumns: GRID,
          gap: 12,
          padding: "var(--s-3) var(--s-5)",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Factura</span>
        <span>Cliente</span>
        <span>Embarque</span>
        <span>Emitida</span>
        <span>Vence</span>
        <span style={{ textAlign: "right" }}>Total</span>
        <span style={{ textAlign: "right" }}>Saldo</span>
        <span>Estado</span>
      </div>

      {invoices.map((inv, i) => {
        const ds = displayStatus(inv);
        const overdue = isOverdue(inv);
        const balance = computeBalance(inv);
        return (
          <Link
            key={inv.id}
            href={`/studio/facturacion/${inv.invoice_code}`}
            data-row-id={inv.invoice_code}
            className={`studio-tracking-row ${flashClassFor(inv.invoice_code)}`.trim()}
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                font: "700 12px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {inv.invoice_code}
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
                {inv.client_name}
              </div>
              <div
                style={{
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--wine-text)",
                  marginTop: 3,
                }}
              >
                {inv.client_markbox}
              </div>
            </div>
            <span
              style={{
                font: "600 11.5px/1 var(--f-mono)",
                color: inv.shipment_code ? "var(--wine)" : "var(--ink-mute)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inv.shipment_code ?? "—"}
            </span>
            <span
              style={{ font: "500 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}
            >
              {inv.issued_at ?? "—"}
            </span>
            <span
              style={{
                font: "500 11px/1 var(--f-mono)",
                color: overdue ? "var(--danger)" : "var(--ink-soft)",
              }}
            >
              {inv.due_date ?? "—"}
            </span>
            <span
              style={{
                font: "800 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              ${fmtAmount(inv.total_amount)}
            </span>
            <span
              style={{
                font: "800 12.5px/1 var(--f-mono)",
                color: balance > 0 ? "var(--wine)" : "var(--ink-soft)",
                textAlign: "right",
              }}
            >
              ${fmtAmount(balance)}
            </span>
            <span>
              <Badge tone={statusBadgeTone(ds)} size="sm" dot>
                {statusLabel(ds)}
              </Badge>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
