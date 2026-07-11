"use client";

/**
 * PackingListsTab — bandeja de PACKING LISTS que los proveedores enviaron desde
 * /p/{token} (SDD-0096 · PORT-2). Cierra el gap: antes estos envíos quedaban en
 * la DB (packing_list_submissions) y el equipo no los veía en el Studio, aunque
 * el correo de aviso apuntaba acá.
 *
 * Lista la versión VIGENTE de cada compra → click → drawer con el documento
 * completo (solo lectura). Solo tokens var(--*).
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { PackingListSubmission } from "@/lib/studio/prealertas/packlist-form";
import { PackingListDrawer } from "./PackingListDrawer";
import type { PrealertaLite } from "./ServiceRequestsTab";

const GRID = "minmax(110px,1fr) 140px minmax(120px,1fr) 66px 108px 88px";

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", RMB: "¥", EUR: "€" };

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function PackingListsTab({
  submissions,
  prealertaById,
}: {
  submissions: PackingListSubmission[];
  prealertaById: Record<string, PrealertaLite>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PackingListSubmission | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => {
      const p = prealertaById[s.prealerta_id];
      return (
        s.client_markbox.toLowerCase().includes(q) ||
        (p?.code ?? "").toLowerCase().includes(q) ||
        (s.folio ?? "").toLowerCase().includes(q) ||
        (s.supplier_company ?? "").toLowerCase().includes(q)
      );
    });
  }, [submissions, search, prealertaById]);

  if (submissions.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin packing lists"
        title="Ningún proveedor ha enviado su packing list todavía."
        description="Cuando un proveedor llene y envíe el packing list + factura desde el enlace /p/… que le compartió el cliente, aparecerá acá para que el equipo lo revise. Cada envío te avisa por correo y Telegram."
      />
    );
  }

  return (
    <>
      {/* Toolbar: búsqueda */}
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
            placeholder="Buscar cliente, compra, folio o proveedor…"
            aria-label="Buscar packing lists"
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
        <span
          style={{
            font: "500 11.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Versión vigente de cada compra
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin resultados"
          title="Nada coincide con tu búsqueda."
          description="Prueba con el Shipping Mark del cliente, el código de la compra, el folio o el proveedor."
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
              gridTemplateColumns: GRID,
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
            <span>Cliente</span>
            <span>Compra</span>
            <span>Folio</span>
            <span style={{ textAlign: "right" }}>Cajas</span>
            <span style={{ textAlign: "right" }}>Monto</span>
            <span style={{ textAlign: "right" }}>Recibido</span>
          </div>

          {rows.map((s, i) => {
            const p = prealertaById[s.prealerta_id] ?? null;
            const sym = CURRENCY_SYMBOL[s.currency] ?? "";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className="studio-tracking-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: "var(--s-3)",
                  padding: "14px 20px",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopStyle: "solid",
                  borderTopColor: i > 0 ? "var(--border)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    font: "600 11.5px/1.2 var(--f-mono)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.client_markbox || "—"}
                </span>
                <code
                  style={{
                    font: "700 11.5px/1.2 var(--f-mono)",
                    color: "var(--wine)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p?.code ?? "—"}
                </code>
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      font: "600 11.5px/1.3 var(--f-mono)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.folio ?? "—"}
                  </div>
                  {s.version_no > 1 && (
                    <div
                      style={{
                        font: "500 10px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 2,
                      }}
                    >
                      v{s.version_no} · corregido
                    </div>
                  )}
                </div>
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {s.totals.ctns.toLocaleString("es-VE")}
                </span>
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: s.totals.amount > 0 ? "var(--ink)" : "var(--ink-mute)",
                    textAlign: "right",
                  }}
                >
                  {sym}
                  {s.totals.amount.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  style={{
                    font: "500 11px/1.2 var(--f-mono)",
                    color: "var(--ink-soft)",
                    textAlign: "right",
                  }}
                >
                  {shortDate(s.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <PackingListDrawer
          submission={selected}
          prealertaCode={prealertaById[selected.prealerta_id]?.code ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
