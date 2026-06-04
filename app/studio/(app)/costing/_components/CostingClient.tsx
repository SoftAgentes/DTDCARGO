"use client";

/**
 * Orquestador client del módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * Estructura del Norte (erp/modules/costing.jsx), anclada a datos reales y
 * traducida a tokens var(--*) + primitivas del sistema:
 *  - Header con KPIs (revenue/costo/margen/embarques OK) + toggle USD/VES.
 *  - Tabs: Overview · Ranking · Breakdown · Routes (Templates/Forecast = Slice C).
 *  - Cost Editor drawer (guardar costos) abierto desde Ranking o "Editar costos".
 *
 * El toggle USD/VES es DISPLAY-ONLY: convierte cada monto USD con la tasa BCV
 * (de la última factura en VES, o el fallback). Nunca persiste VES. Todos los
 * agregados llegan ya calculados desde el server (page.tsx).
 */

import { useMemo, useState } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  COST_CATEGORIES,
  fmtMoney,
  marginTone,
  type DisplayCurrency,
} from "@/lib/studio/costing/types";
import type {
  CostingRow,
  CostingTotals,
  RouteMarginRow,
} from "@/lib/studio/costing/queries";
import {
  asRankingSort,
  breakdownRows,
  costPctOfRevenue,
  RANKING_SORTS,
  resolveDisplayRate,
  sortRanking,
  topAndWorst,
  type RankingSort,
} from "@/lib/studio/costing/ui";
import { CostEditorDrawer } from "./CostEditorDrawer";

type Tab = "overview" | "ranking" | "breakdown" | "routes";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "ranking", label: "Ranking de embarques" },
  { value: "breakdown", label: "Desglose por categoría" },
  { value: "routes", label: "Margen por ruta" },
];

export function CostingClient({
  rows,
  totals,
  routes,
  vesRate,
}: {
  rows: CostingRow[];
  totals: CostingTotals;
  routes: RouteMarginRow[];
  vesRate: number | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [editor, setEditor] = useState<CostingRow | null>(null);

  const rate = resolveDisplayRate(vesRate);
  // Formateador de display según el toggle (USD passthrough · VES × tasa).
  const money = (usd: number) => fmtMoney(usd, currency, rate);

  const profitable = useMemo(
    () => rows.filter((r) => r.eco.margin > 0).length,
    [rows],
  );
  const losing = useMemo(
    () => rows.filter((r) => r.eco.margin < 0).length,
    [rows],
  );

  if (rows.length === 0) {
    return (
      <div style={{ maxWidth: 1280 }}>
        <Header
          currency={currency}
          onCurrency={setCurrency}
          rate={rate}
          hasRows={false}
          onEdit={undefined}
        />
        <EmptyState
          eyebrow="Costing & Margen"
          title="Todavía no hay embarques para costear"
          description="Cuando registres embarques vas a poder cargar sus costos por categoría y ver el margen real contra la facturación."
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280 }}>
      <Header
        currency={currency}
        onCurrency={setCurrency}
        rate={rate}
        hasRows
        onEdit={() => setEditor(rows[0])}
      />

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
          value={money(totals.revenue)}
          label="Revenue total"
          sub={currency === "USD" ? "facturado · USD canónico" : "facturado · en Bs."}
          valueColor="var(--wine)"
        />
        <KpiCard
          value={money(totals.cost)}
          label="Costo total"
          sub={`${Math.round(costPctOfRevenue(totals))}% del revenue`}
          valueColor="var(--warning)"
        />
        <KpiCard
          value={money(totals.margin)}
          label="Margen bruto"
          sub={`${totals.avgMarginPct.toFixed(1)}% promedio`}
          valueColor={totals.margin < 0 ? "var(--danger)" : "var(--success)"}
        />
        <KpiCard
          value={`${profitable}/${rows.length}`}
          label="Embarques OK"
          sub={losing > 0 ? `${losing} en pérdida` : "ninguno en pérdida"}
          valueColor={losing > 0 ? "var(--danger)" : "var(--success)"}
        />
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => {
          const on = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.value)}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${on ? "var(--wine)" : "transparent"}`,
                padding: "8px 14px",
                cursor: "pointer",
                font: `${on ? "700" : "500"} 13px/1 var(--f-sans)`,
                color: on ? "var(--ink)" : "var(--ink-soft)",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OverviewView rows={rows} totals={totals} money={money} />
      )}
      {tab === "ranking" && (
        <RankingView rows={rows} money={money} onEdit={setEditor} />
      )}
      {tab === "breakdown" && <BreakdownView totals={totals} money={money} />}
      {tab === "routes" && <RoutesView routes={routes} money={money} />}

      {editor && (
        <CostEditorDrawer
          key={editor.shipment.id}
          row={editor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────
function Header({
  currency,
  onCurrency,
  rate,
  hasRows,
  onEdit,
}: {
  currency: DisplayCurrency;
  onCurrency: (c: DisplayCurrency) => void;
  rate: number;
  hasRows: boolean;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 24,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">Finanzas</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Costing &amp; Margen.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          Rentabilidad real por embarque: desglose de costos vs revenue
          facturado. Identificá los rentables y los que dejan plata sobre la
          mesa.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-mute)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Moneda · BCV {rate}
          </span>
          <SegmentedControl<DisplayCurrency>
            variant="pills"
            ariaLabel="Moneda de display"
            value={currency}
            onChange={onCurrency}
            options={[
              { value: "USD", label: "USD" },
              { value: "VES", label: "VES" },
            ]}
          />
        </div>
        {hasRows && onEdit && (
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Editar costos"
            idleIcon={Icon.edit(14)}
            successLabel={null}
            onAction={async () => {
              onEdit();
            }}
          />
        )}
      </div>
    </div>
  );
}

type Money = (usd: number) => string;

// ── Card helper ────────────────────────────────────────────────
function Card({
  eyebrow,
  children,
  style,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        ...style,
      }}
    >
      {eyebrow && (
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "18px 20px 0",
          }}
        >
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────
function OverviewView({
  rows,
  totals,
  money,
}: {
  rows: CostingRow[];
  totals: CostingTotals;
  money: Money;
}) {
  const { top, worst } = topAndWorst(rows, 3);
  const costPct = Math.round(costPctOfRevenue(totals));
  const marginPctRound = 100 - costPct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card eyebrow="Composición · Revenue vs Costo" style={{ padding: "0 0 18px" }}>
        <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          <CompositionBar
            label="Revenue"
            value={money(totals.revenue)}
            pct={100}
            tone="var(--wine)"
          />
          <CompositionBar
            label="Costo total"
            value={money(totals.cost)}
            pct={costPctOfRevenue(totals)}
            tone="var(--warning)"
          />
          <CompositionBar
            label="Margen bruto"
            value={money(totals.margin)}
            pct={Math.max(0, 100 - costPctOfRevenue(totals))}
            tone={totals.margin < 0 ? "var(--danger)" : "var(--success)"}
          />
        </div>
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "16px 20px 0",
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}
        >
          Por cada <strong style={{ color: "var(--ink)" }}>$100</strong>{" "}
          facturados,{" "}
          <strong style={{ color: "var(--warning)" }}>${costPct}</strong> se van
          en costos y{" "}
          <strong style={{ color: "var(--success)" }}>${marginPctRound}</strong>{" "}
          quedan de margen bruto.
        </p>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <Card eyebrow="Top 3 más rentables" style={{ padding: "0 0 16px" }}>
          <RankList rows={top} money={money} tone="success" emptyLabel="Sin embarques rentables todavía." />
        </Card>
        <Card eyebrow="3 peores márgenes" style={{ padding: "0 0 16px" }}>
          <RankList rows={worst} money={money} tone="danger" emptyLabel="Sin embarques en pérdida." />
        </Card>
      </div>
    </div>
  );
}

function CompositionBar({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink)" }}>{label}</span>
        <span style={{ font: "800 13px/1 var(--f-mono)", color: tone }}>{value}</span>
      </div>
      <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: tone, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function RankList({
  rows,
  money,
  tone,
  emptyLabel,
}: {
  rows: CostingRow[];
  money: Money;
  tone: "success" | "danger";
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "12px 20px", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const isLoss = r.eco.margin < 0;
        const c = isLoss ? "var(--danger)" : tone === "success" ? "var(--success)" : "var(--warning)";
        return (
          <div
            key={r.shipment.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px",
              gap: 10,
              alignItems: "center",
              padding: "8px 10px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <code style={{ font: "800 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                {r.shipment.code}
              </code>
              <div
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.shipment.client_name ?? "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "800 13px/1 var(--f-mono)", color: c }}>{money(r.eco.margin)}</div>
              <div style={{ font: "600 10px/1 var(--f-mono)", color: "var(--ink-mute)", marginTop: 3 }}>
                {r.eco.marginPct.toFixed(0)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ranking ────────────────────────────────────────────────────
function RankingView({
  rows,
  money,
  onEdit,
}: {
  rows: CostingRow[];
  money: Money;
  onEdit: (row: CostingRow) => void;
}) {
  const [sort, setSort] = useState<RankingSort>("margin-pct-desc");
  const sorted = useMemo(() => sortRanking(rows, sort), [rows, sort]);
  const cols = "140px 1fr 110px 110px 110px 110px 80px";

  return (
    <Card style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {sorted.length} embarques
        </span>
        <select
          className="studio-input"
          aria-label="Ordenar ranking"
          value={sort}
          onChange={(e) => setSort(asRankingSort(e.target.value))}
          style={{ width: 240 }}
        >
          {RANKING_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          padding: "10px 18px",
          gap: 14,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {["ID", "Cliente · Ruta", "Revenue", "Costo", "Margen", "Margen %", ""].map((h, i) => (
          <span
            key={h || i}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: i >= 2 ? "right" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {sorted.map((r) => {
        const isLoss = r.eco.margin < 0;
        const tone = marginTone(r.eco.marginPct);
        const routeLabel =
          r.shipment.origin && r.shipment.destination
            ? `${r.shipment.origin} → ${r.shipment.destination}`
            : "—";
        return (
          <div
            key={r.shipment.id}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              padding: "12px 18px",
              gap: 14,
              alignItems: "center",
              borderTop: "1px solid var(--border)",
              transition: "background 120ms",
            }}
          >
            <code style={{ font: "800 12px/1 var(--f-mono)", color: "var(--ink)" }}>
              {r.shipment.code}
            </code>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: "600 12.5px/1.2 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.shipment.client_name ?? "—"}
              </div>
              <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                {routeLabel}
              </div>
            </div>
            <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
              {money(r.eco.revenue)}
            </span>
            <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--warning)", textAlign: "right" }}>
              {money(r.eco.totalCost)}
            </span>
            <span
              style={{
                font: "800 13px/1 var(--f-mono)",
                color: isLoss ? "var(--danger)" : "var(--success)",
                textAlign: "right",
              }}
            >
              {money(r.eco.margin)}
            </span>
            <div style={{ textAlign: "right" }}>
              <Badge tone={tone} size="md">
                {r.eco.marginPct.toFixed(1)}%
              </Badge>
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                onClick={() => onEdit(r)}
                title="Editar costos"
                aria-label={`Editar costos de ${r.shipment.code}`}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wine)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                  padding: 6,
                  display: "inline-flex",
                }}
              >
                {Icon.edit(13)}
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── Breakdown ──────────────────────────────────────────────────
function BreakdownView({ totals, money }: { totals: CostingTotals; money: Money }) {
  const rows = breakdownRows(totals);
  const labelByKey = Object.fromEntries(COST_CATEGORIES.map((c) => [c.key, c]));

  if (totals.cost === 0) {
    return (
      <EmptyState
        eyebrow="Desglose por categoría"
        title="Sin costos cargados"
        description="Cargá los costos de tus embarques desde el Cost Editor para ver el desglose por categoría."
      />
    );
  }

  return (
    <Card eyebrow={`Desglose de costos · ${rows.length} categorías`} style={{ padding: "0 0 20px" }}>
      <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => {
          const cat = labelByKey[r.key];
          return (
            <div key={r.key}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    aria-hidden
                    style={{ width: 14, height: 14, borderRadius: 3, background: cat.colorToken, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{cat.label}</div>
                    <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                      {cat.desc}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>{money(r.amount)}</div>
                  <div style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)", marginTop: 3 }}>
                    {r.pct.toFixed(1)}% del total
                  </div>
                </div>
              </div>
              <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, r.pct))}%`,
                    height: "100%",
                    background: cat.colorToken,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Routes ─────────────────────────────────────────────────────
function RoutesView({ routes, money }: { routes: RouteMarginRow[]; money: Money }) {
  if (routes.length === 0) {
    return (
      <EmptyState
        eyebrow="Margen por ruta"
        title="Sin rutas para agrupar"
        description="Cuando tus embarques tengan origen y destino vas a ver acá el margen agregado por corredor."
      />
    );
  }
  const cols = "1.4fr 70px 110px 110px 110px 110px";

  return (
    <Card eyebrow={`${routes.length} rutas · ordenadas por margen %`} style={{ overflow: "hidden", padding: "18px 0 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          padding: "10px 18px",
          gap: 14,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          marginTop: 14,
        }}
      >
        {["Ruta", "Envíos", "Revenue", "Costo", "Margen", "Margen %"].map((h, i) => (
          <span
            key={h}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: i >= 1 ? "right" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>
      {routes.map((r) => (
        <div
          key={`${r.origin}→${r.destination}`}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            padding: "14px 18px",
            gap: 14,
            alignItems: "center",
            borderTop: "1px solid var(--border)",
            transition: "background 120ms",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {r.origin || "—"}
            </span>
            <span style={{ color: "var(--wine)" }}>→</span>
            <span style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {r.destination || "—"}
            </span>
          </div>
          <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
            {r.count}
          </span>
          <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
            {money(r.revenue)}
          </span>
          <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--warning)", textAlign: "right" }}>
            {money(r.cost)}
          </span>
          <span
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: r.margin < 0 ? "var(--danger)" : "var(--success)",
              textAlign: "right",
            }}
          >
            {money(r.margin)}
          </span>
          <div style={{ textAlign: "right" }}>
            <Badge tone={r.tone} size="md">
              {r.marginPct.toFixed(1)}%
            </Badge>
          </div>
        </div>
      ))}
    </Card>
  );
}
