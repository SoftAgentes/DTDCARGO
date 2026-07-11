"use client";

/**
 * ServiceRequestsTab — bandeja de SERVICIOS DE RECEPCIÓN que los clientes piden
 * desde su portal sobre una compra/prealerta (SDD-0098, PORT-1). Cierra el gap:
 * antes estos pedidos quedaban solo en la DB y el asesor no los veía.
 *
 * Lista (pendientes primero) → click en la fila → drawer para atender (cambiar
 * estado + cargar monto cotizado). Solo tokens var(--*).
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  defaultAddon,
  psrStatusLabel,
  psrStatusTone,
  type PrealertaServiceRequest,
} from "@/lib/studio/prealertas/addons";
import {
  ServiceRequestDrawer,
  type ServiceRequestContext,
} from "./ServiceRequestDrawer";

/** Contexto de la compra por prealerta_id (resuelto en el server). */
export type PrealertaLite = { code: string; description: string };

const GRID = "minmax(120px,1fr) 150px minmax(160px,1.4fr) 96px 128px";

// Pendientes primero (lo accionable), luego el resto; dentro, más viejo primero.
const PENDING: ReadonlySet<string> = new Set(["solicitada", "en_proceso"]);

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function ServiceRequestsTab({
  requests,
  prealertaById,
}: {
  requests: PrealertaServiceRequest[];
  prealertaById: Record<string, PrealertaLite>;
}) {
  const [onlyPending, setOnlyPending] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServiceRequestContext | null>(null);

  const pendingCount = useMemo(
    () => requests.filter((r) => PENDING.has(r.status)).length,
    [requests],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = requests.filter((r) => !onlyPending || PENDING.has(r.status));
    if (q) {
      out = out.filter((r) => {
        const p = prealertaById[r.prealerta_id];
        const label = defaultAddon(r.addon_code)?.label ?? r.addon_code;
        return (
          r.client_markbox.toLowerCase().includes(q) ||
          (p?.code ?? "").toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q)
        );
      });
    }
    const rank = (r: PrealertaServiceRequest) => (PENDING.has(r.status) ? 0 : 1);
    return [...out].sort(
      (a, b) =>
        rank(a) - rank(b) || a.created_at.localeCompare(b.created_at),
    );
  }, [requests, onlyPending, search, prealertaById]);

  if (requests.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin solicitudes"
        title="Ningún cliente ha pedido servicios de recepción todavía."
        description="Cuando un cliente pida verificación, inspección, reempaque u otro servicio sobre su compra desde el portal, aparecerá acá para que lo atiendas antes de que la mercancía llegue a la bodega."
      />
    );
  }

  return (
    <>
      {/* Toolbar: búsqueda + filtro pendientes/todas */}
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
            placeholder="Buscar cliente, compra, servicio o nota…"
            aria-label="Buscar solicitudes de servicio"
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
          onClick={() => setOnlyPending(true)}
          className={`studio-btn ${
            onlyPending ? "studio-btn-primary" : "studio-btn-ghost"
          }`}
        >
          Pendientes
          <span style={{ marginLeft: 6, opacity: 0.85 }}>{pendingCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setOnlyPending(false)}
          className={`studio-btn ${
            !onlyPending ? "studio-btn-primary" : "studio-btn-ghost"
          }`}
        >
          Todas
          <span style={{ marginLeft: 6, opacity: 0.85 }}>{requests.length}</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={search.trim() ? "Sin resultados" : "Sin pendientes"}
          title={
            search.trim()
              ? "Nada coincide con tu búsqueda."
              : "No hay solicitudes pendientes."
          }
          description={
            search.trim()
              ? "Prueba con el Shipping Mark del cliente, el código de la compra o el servicio."
              : 'Todas las solicitudes están atendidas o descartadas. Toca "Todas" para ver el historial.'
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
            <span>Servicio</span>
            <span>Fecha</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </div>

          {rows.map((r, i) => {
            const p = prealertaById[r.prealerta_id] ?? null;
            const addon = defaultAddon(r.addon_code);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  setSelected({
                    request: r,
                    prealertaCode: p?.code ?? null,
                    prealertaDescription: p?.description ?? null,
                  })
                }
                className="studio-tracking-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: "var(--s-3)",
                  padding: "14px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
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
                  {r.client_markbox || "—"}
                </span>
                <code
                  style={{
                    font: "700 11.5px/1.2 var(--f-mono)",
                    color: "var(--wine-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p?.code ?? "—"}
                </code>
                <div style={{ overflow: "hidden", display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      font: "600 12.5px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {addon?.label ?? r.addon_code}
                  </span>
                  {r.timing === "tardia" && (
                    <Badge tone="warning" size="sm">
                      Tarde
                    </Badge>
                  )}
                </div>
                <span
                  style={{
                    font: "500 11px/1.2 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {shortDate(r.created_at)}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Badge tone={psrStatusTone(r.status)} size="sm" dot>
                    {psrStatusLabel(r.status)}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ServiceRequestDrawer
          ctx={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      )}
    </>
  );
}
