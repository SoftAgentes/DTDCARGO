"use client";

/**
 * SDD-0111 · Tab "Scorecard" — tabla de fichas de proveedor rankeada por grade
 * A/B/C/D (derivado en vivo desde supplier_scorecard_v) + KPIs. Click en una
 * fila abre el detalle (barras de puntualidad/calidad/rechazo + reclamos de esa
 * ficha + captura de señal de recepción).
 *
 * Scorecard POR FICHA (§6.4): la misma identidad física puede aparecer varias
 * veces, una por cada cliente que le compra. Solo tokens var(--*).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  gradeBadgeTone,
  supplierClaimKindLabel,
  supplierClaimStatusLabel,
  supplierClaimStatusTone,
  type SupplierGrade,
} from "@/lib/studio/proveedores/scorecard-types";
import type {
  SupplierClaimRow,
  SupplierScorecard,
  SupplierScorecardStats,
} from "@/lib/studio/proveedores/scorecard-queries";
import { createOrderSignalAction } from "../scorecard-actions";

const GRID = "minmax(160px,1.4fr) 1fr 70px 78px 78px 82px 96px";

function gradeLabel(g: SupplierGrade): string {
  return g ?? "—";
}

export function ScorecardTab({
  scorecards,
  claims,
  stats,
}: {
  scorecards: SupplierScorecard[];
  claims: SupplierClaimRow[];
  stats: SupplierScorecardStats;
}) {
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<SupplierScorecard | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scorecards;
    return scorecards.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.client_markbox.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q),
    );
  }, [scorecards, search]);

  const claimsBySupplier = useMemo(() => {
    const m: Record<string, SupplierClaimRow[]> = {};
    for (const c of claims) {
      (m[c.supplier_cn_id] ??= []).push(c);
    }
    return m;
  }, [claims]);

  return (
    <>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.supplierCount}
          label="Proveedores"
          sub="con historial evaluable"
        />
        <KpiCard
          value={stats.avgScore ?? "—"}
          label="Rating prom."
          valueColor={stats.avgScore != null ? "var(--wine)" : "var(--ink)"}
          sub="sobre 100"
        />
        <KpiCard
          value={stats.avgOnTime != null ? `${stats.avgOnTime}%` : "—"}
          label="On-time prom."
          sub="entregas a tiempo"
        />
        <KpiCard
          value={stats.openClaims}
          label="Reclamos"
          valueColor={stats.openClaims > 0 ? "var(--warning)" : "var(--ink)"}
          sub="abiertos / en revisión"
        />
      </div>

      {/* Búsqueda */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          flex: "1 1 220px",
          minWidth: 180,
          maxWidth: 380,
          height: 32,
          padding: "0 10px",
          marginBottom: "var(--s-3)",
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-sm)",
        }}
      >
        <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
          {Icon.search(13)}
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor, cliente o ciudad…"
          aria-label="Buscar en el scorecard"
          style={{
            flex: 1,
            height: "100%",
            border: 0,
            background: "transparent",
            font: "500 12px/1 var(--f-sans)",
            color: "var(--ink)",
          }}
        />
      </div>

      {scorecards.length === 0 ? (
        <EmptyState
          eyebrow="Sin proveedores"
          title="Todavía no hay proveedores para evaluar."
          description="Cuando haya fichas de proveedor y señales de recepción, su rating A/B/C/D aparecerá acá, rankeado por desempeño."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin resultados"
          title="Nada coincide con tu búsqueda."
          description="Prueba con el nombre del proveedor, el Shipping Mark del cliente o la ciudad."
        />
      ) : (
        <TableShell>
          <HeaderRow grid={GRID}>
            <span>Proveedor · cliente</span>
            <span>Ciudad</span>
            <span style={{ textAlign: "right" }}>Órdenes</span>
            <span style={{ textAlign: "right" }}>On-time</span>
            <span style={{ textAlign: "right" }}>Calidad</span>
            <span style={{ textAlign: "right" }}>Rechazo</span>
            <span style={{ textAlign: "right" }}>Rating</span>
          </HeaderRow>
          {rows.map((s, i) => (
            <button
              key={s.supplier_cn_id}
              type="button"
              onClick={() => setDetail(s)}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: "var(--s-3)",
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                width: "100%",
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    font: "700 12.5px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginTop: 3,
                  }}
                >
                  {s.client_markbox || "—"}
                </div>
              </div>
              <span
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: s.city ? "var(--ink)" : "var(--ink-mute)",
                }}
              >
                {s.city || "—"}
              </span>
              <NumCell value={String(s.orders_count)} />
              <NumCell value={s.on_time_pct != null ? `${fmtPct(s.on_time_pct)}%` : "—"} />
              <NumCell value={s.quality_pct != null ? `${fmtPct(s.quality_pct)}%` : "—"} />
              <NumCell value={s.defect_pct != null ? `${fmtPct(s.defect_pct)}%` : "—"} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <Badge tone={gradeBadgeTone(s.grade)} dot={s.grade != null}>
                  {gradeLabel(s.grade)}
                </Badge>
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    minWidth: 22,
                    textAlign: "right",
                  }}
                >
                  {s.score ?? "—"}
                </span>
              </div>
            </button>
          ))}
        </TableShell>
      )}

      {detail && (
        <ScorecardDetailDrawer
          card={detail}
          claims={claimsBySupplier[detail.supplier_cn_id] ?? []}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function NumCell({ value }: { value: string }) {
  return (
    <span
      style={{
        font: "600 12px/1 var(--f-mono)",
        color: value === "—" ? "var(--ink-mute)" : "var(--ink)",
        textAlign: "right",
        display: "block",
      }}
    >
      {value}
    </span>
  );
}

// ── Detalle de una ficha: barras + reclamos + captura de señal ──────

function ScorecardDetailDrawer({
  card,
  claims,
  onClose,
}: {
  card: SupplierScorecard;
  claims: SupplierClaimRow[];
  onClose: () => void;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <DrawerShell
      title={card.name}
      subtitle={`${card.city ? `${card.city}, China · ` : ""}${card.client_markbox}`}
      titleAccessory={
        <Badge tone={gradeBadgeTone(card.grade)} dot={card.grade != null}>
          {gradeLabel(card.grade)}
          {card.score != null ? ` · ${card.score}` : ""}
        </Badge>
      }
      onClose={onClose}
      pending={false}
      width={600}
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
        <div
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {card.orders_count} órdenes evaluadas · {claims.length} reclamos
        </div>

        {card.orders_count === 0 ? (
          <div
            style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Sin datos todavía. Registra la primera recepción para empezar a
            medir su desempeño.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MetricBar
              label="Puntualidad de entrega"
              pct={card.on_time_pct ?? 0}
              tone={
                (card.on_time_pct ?? 0) >= 90
                  ? "var(--success)"
                  : (card.on_time_pct ?? 0) >= 80
                    ? "var(--info)"
                    : "var(--warning)"
              }
            />
            <MetricBar
              label="Calidad / conformidad"
              pct={card.quality_pct ?? 0}
              tone={
                (card.quality_pct ?? 0) >= 92
                  ? "var(--success)"
                  : (card.quality_pct ?? 0) >= 85
                    ? "var(--info)"
                    : "var(--warning)"
              }
            />
            <MetricBar
              label="Tasa de rechazo"
              pct={Math.min(100, (card.defect_pct ?? 0) * 12)}
              display={`${fmtPct(card.defect_pct ?? 0)}%`}
              tone={
                (card.defect_pct ?? 0) <= 2
                  ? "var(--success)"
                  : (card.defect_pct ?? 0) <= 4
                    ? "var(--warning)"
                    : "var(--danger)"
              }
            />
          </div>
        )}

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <h3
              style={{
                font: "700 13px/1 var(--f-sans)",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Reclamos del proveedor
            </h3>
          </div>
          {claims.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin reclamos registrados. Buen historial.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              {claims.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        font: "700 11.5px/1.2 var(--f-mono)",
                        color: "var(--wine-text)",
                      }}
                    >
                      {c.claim_code}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 2,
                      }}
                    >
                      {supplierClaimKindLabel(c.kind)}
                      {c.amount_usd > 0
                        ? ` · $${c.amount_usd.toLocaleString("en-US")}`
                        : ""}
                    </div>
                  </div>
                  <Badge tone={supplierClaimStatusTone(c.status)} size="sm" dot>
                    {supplierClaimStatusLabel(c.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {capturing ? (
          <SignalCaptureForm
            supplierCnId={card.supplier_cn_id}
            clientMarkbox={card.client_markbox}
            onClose={() => setCapturing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCapturing(true)}
            className="studio-btn studio-btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            + Registrar recepción
          </button>
        )}
      </div>
    </DrawerShell>
  );
}

function MetricBar({
  label,
  pct,
  display,
  tone,
}: {
  label: string;
  pct: number;
  display?: string;
  tone: string;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
          {label}
        </span>
        <span style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
          {display ?? `${fmtPct(pct)}%`}
        </span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 4,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${width}%`, height: "100%", background: tone }} />
      </div>
    </div>
  );
}

/** Captura de una señal de recepción (on-time / conforme) para la ficha. */
function SignalCaptureForm({
  supplierCnId,
  clientMarkbox,
  onClose,
}: {
  supplierCnId: string;
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

  const submit = async () => {
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
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ font: "700 12px/1 var(--f-sans)", color: "var(--ink)" }}>
        Registrar recepción
      </div>
      {error && (
        <p
          role="alert"
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Toggle
          label="Llegó a tiempo"
          checked={onTime}
          onChange={setOnTime}
        />
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

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          className="studio-btn studio-btn-ghost"
          disabled={pending}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          className="studio-btn studio-btn-primary"
          disabled={pending}
        >
          {pending ? "Guardando…" : "Guardar recepción"}
        </button>
      </div>
    </div>
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

// ── Shell de tabla (mismo patrón que el módulo) ─────────────────

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function HeaderRow({
  grid,
  children,
}: {
  grid: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: grid,
        gap: "var(--s-3)",
        padding: "var(--s-3) var(--s-5)",
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        font: "700 10px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
      }}
    >
      {children}
    </div>
  );
}
