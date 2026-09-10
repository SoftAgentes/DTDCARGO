"use client";

/**
 * SDD-0111 · Tab "Reclamos" — reclamos operativos al proveedor (supplier_claims).
 * Tabla + drawer de crear/editar con stepper de estado. Solo tokens var(--*).
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  supplierClaimKindLabel,
  supplierClaimStatusLabel,
  supplierClaimStatusTone,
  type SupplierClaimStatus,
} from "@/lib/studio/proveedores/scorecard-types";
import type { SupplierClaimRow } from "@/lib/studio/proveedores/scorecard-queries";
import {
  SupplierClaimDrawer,
  type SupplierOption,
} from "./SupplierClaimDrawer";

const GRID = "128px minmax(140px,1.3fr) 96px 96px 96px 120px";

// Filtros por estado (chips + contador). "abiertos" = abierto + en_revision.
type ClaimFilter = "todos" | "abiertos" | SupplierClaimStatus;
const CLAIM_FILTERS: { value: ClaimFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abiertos", label: "Abiertos" },
  { value: "abierto", label: "Abierto" },
  { value: "en_revision", label: "En revisión" },
  { value: "resuelto", label: "Resuelto" },
  { value: "rechazado", label: "Rechazado" },
];

function matchesClaimFilter(c: SupplierClaimRow, f: ClaimFilter): boolean {
  if (f === "todos") return true;
  if (f === "abiertos")
    return c.status === "abierto" || c.status === "en_revision";
  return c.status === f;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function ReclamosTab({
  claims,
  suppliers,
}: {
  claims: SupplierClaimRow[];
  suppliers: SupplierOption[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimFilter>("todos");
  const [drawer, setDrawer] = useState<"new" | SupplierClaimRow | null>(null);

  const counts = useMemo(() => {
    const m = {} as Record<ClaimFilter, number>;
    for (const f of CLAIM_FILTERS) {
      m[f.value] = claims.filter((c) => matchesClaimFilter(c, f.value)).length;
    }
    return m;
  }, [claims]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (!matchesClaimFilter(c, statusFilter)) return false;
      if (!q) return true;
      return (
        c.claim_code.toLowerCase().includes(q) ||
        (c.supplier_name ?? "").toLowerCase().includes(q) ||
        (c.client_markbox ?? "").toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [claims, search, statusFilter]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
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
            placeholder="Buscar reclamo, proveedor o cliente…"
            aria-label="Buscar reclamos"
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
        <button
          type="button"
          onClick={() => setDrawer("new")}
          className="studio-btn studio-btn-primary"
          style={{ marginLeft: "auto" }}
          disabled={suppliers.length === 0}
          title={
            suppliers.length === 0
              ? "Necesitas al menos un proveedor cargado"
              : undefined
          }
        >
          + Nuevo reclamo
        </button>
      </div>

      {/* Filtros por estado (chips + contador) */}
      {claims.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: "var(--s-3)",
          }}
        >
          {CLAIM_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={
                statusFilter === f.value
                  ? "studio-btn studio-btn-dark studio-btn-xs"
                  : "studio-btn studio-btn-ghost studio-btn-xs"
              }
            >
              {f.label}
              <span
                style={{
                  marginLeft: 6,
                  font: "700 10px/1 var(--f-mono)",
                  opacity: 0.7,
                }}
              >
                {counts[f.value]}
              </span>
            </button>
          ))}
        </div>
      )}

      {claims.length === 0 ? (
        <EmptyState
          eyebrow="Sin reclamos"
          title="Todavía no hay reclamos al proveedor."
          description="Cuando una recepción tenga daño, faltante, problema de calidad o retraso de origen, ábrele un reclamo al proveedor — cuenta como señal negativa en su scorecard."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin resultados"
          title="Nada coincide con el filtro o la búsqueda."
          description="Cambia el estado seleccionado o prueba con el código del reclamo, el proveedor o el Shipping Mark del cliente."
        />
      ) : (
        <TableShell>
          <HeaderRow grid={GRID}>
            <span>Reclamo</span>
            <span>Proveedor · cliente</span>
            <span>Tipo</span>
            <span style={{ textAlign: "right" }}>Monto</span>
            <span>Fecha</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </HeaderRow>
          {rows.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setDrawer(c)}
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
              <code
                style={{
                  font: "700 12px/1.2 var(--f-mono)",
                  color: "var(--wine-text)",
                }}
              >
                {c.claim_code}
              </code>
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    font: "600 12.5px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.supplier_name ?? "Proveedor"}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginTop: 3,
                  }}
                >
                  {c.client_markbox || "—"}
                </div>
              </div>
              <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {supplierClaimKindLabel(c.kind)}
              </span>
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: c.amount_usd > 0 ? "var(--ink)" : "var(--ink-mute)",
                  textAlign: "right",
                  display: "block",
                }}
              >
                {c.amount_usd > 0 ? `$${c.amount_usd.toLocaleString("en-US")}` : "—"}
              </span>
              <span
                style={{
                  font: "500 11px/1.2 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {shortDate(c.created_at)}
              </span>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Badge tone={supplierClaimStatusTone(c.status)} size="sm">
                  {supplierClaimStatusLabel(c.status)}
                </Badge>
              </div>
            </button>
          ))}
        </TableShell>
      )}

      {drawer && (
        <SupplierClaimDrawer
          claim={drawer === "new" ? undefined : drawer}
          suppliers={suppliers}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}

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
