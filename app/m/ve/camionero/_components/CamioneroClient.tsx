"use client";

/**
 * CamioneroClient — UI mobile del camionero VE (SDD-0030).
 *
 * Lista de ODs asignadas en estado `lista` o `en_ruta`.
 * Por cada OD: header + paquetes + botón "Iniciar ruta" (si lista)
 * + "Confirmar entrega" (si en_ruta · abre modal POD).
 *
 * El POD modal sube foto + firma canvas → server action `podAction`.
 * Después de la última entrega, advance a `entregada`.
 */

import { useActionState, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { advanceOdAction, signOutAction } from "../actions";
import { PodModal } from "./PodModal";
import {
  DISPATCH_ORDER_STATUS_LABELS,
  DISPATCH_ORDER_STATUS_TONES,
  type DispatchOrderRow,
} from "@/lib/studio/dispatch-types";
import type { MobileActionState } from "@/lib/studio/dispatch-mobile-types";

const INITIAL: MobileActionState = {};

interface Props {
  operario: {
    operario_id: string;
    displayName: string;
    firstName: string;
    initials: string;
  };
  ods: DispatchOrderRow[];
}

export function CamioneroClient({ operario, ods }: Props) {
  const [activeOdId, setActiveOdId] = useState<string | null>(ods[0]?.id ?? null);
  const [podOpen, setPodOpen] = useState(false);

  const activeOd = ods.find((o) => o.id === activeOdId);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--bg-base)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Header operario={operario} />

      {ods.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* OD selector si hay más de 1 */}
          {ods.length > 1 && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--bg-surface)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {ods.map((o) => {
                const active = o.id === activeOdId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setActiveOdId(o.id)}
                    style={{
                      padding: "8px 12px",
                      background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                      color: active ? "var(--wine)" : "var(--ink-soft)",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      borderRadius: "var(--r-pill)",
                      font: "700 11px/1 var(--f-mono)",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  >
                    {o.order_code}
                  </button>
                );
              })}
            </div>
          )}

          {activeOd && (
            <OdView
              od={activeOd}
              onOpenPod={() => setPodOpen(true)}
            />
          )}
        </>
      )}

      {podOpen && activeOd && (
        <PodModal
          od={activeOd}
          onClose={() => setPodOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

function Header({ operario }: { operario: Props["operario"] }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        padding: "env(safe-area-inset-top) 16px 12px",
        paddingTop: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Camionero · DTD
        </div>
        <div
          style={{
            font: "900 18px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginTop: 3,
          }}
        >
          Ruta del día
        </div>
        <div
          style={{
            font: "500 11.5px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          Hola, {operario.firstName}
        </div>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          style={{ color: "var(--ink-soft)" }}
        >
          Salir
        </button>
      </form>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div style={{ font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}>
        Sin rutas asignadas hoy
      </div>
      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "32ch",
          margin: 0,
        }}
      >
        Cuando el bodeguero cierre una carga vas a ver acá la OD lista para
        salir. Refrescá para chequear.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OD view (route info + packages + actions)
// ─────────────────────────────────────────────────────────────

function OdView({
  od,
  onOpenPod,
}: {
  od: DispatchOrderRow;
  onOpenPod: () => void;
}) {
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceOdAction,
    INITIAL,
  );

  return (
    <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Route hero (gradient wine) */}
      <div
        style={{
          padding: 16,
          background: "linear-gradient(135deg, var(--wine) 0%, var(--wine-deep, var(--wine)) 100%)",
          color: "var(--ink-inv)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <code style={{ font: "900 14px/1 var(--f-mono)", color: "var(--ink-inv)" }}>
            {od.order_code}
          </code>
          <Badge tone={DISPATCH_ORDER_STATUS_TONES[od.status]} size="sm">
            {DISPATCH_ORDER_STATUS_LABELS[od.status]}
          </Badge>
        </div>
        <div style={{ font: "900 18px/1.2 var(--f-display)", marginBottom: 6 }}>
          {od.route?.name ?? "Sin ruta"}
        </div>
        <div style={{ font: "500 12.5px/1.3 var(--f-sans)", opacity: 0.85 }}>
          {od.truck?.plate ?? "—"} · {od.truck?.brand ?? "—"}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            font: "700 12px/1 var(--f-mono)",
          }}
        >
          <span>{od.package_count} pkg</span>
          <span>{od.total_kg.toFixed(0)} kg</span>
          <span>{od.total_cbm.toFixed(1)} cbm</span>
        </div>
      </div>

      {/* Packages */}
      <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
        Paradas · {od.packages.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {od.packages.map((p) => (
          <div
            key={p.package_id}
            style={{
              padding: 12,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <code style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine)" }}>
                {p.markbox}
              </code>
              <code style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                {p.boxes_shipped} cj · {p.weight_kg.toFixed(0)} kg
              </code>
            </div>
            <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {p.client_name}
            </div>
            <div style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
              {p.city}
            </div>
            {p.description && (
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-mute)",
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px dashed var(--border)",
                }}
              >
                {p.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {od.status === "lista" && (
        <form action={advanceAction} style={{ marginTop: 8 }}>
          <input type="hidden" name="od_id" value={od.id} />
          <input type="hidden" name="status" value="en_ruta" />
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            style={{ width: "100%", height: 52, fontSize: 14 }}
            disabled={advancePending}
          >
            {advancePending ? "Iniciando…" : "Iniciar ruta"}
          </button>
        </form>
      )}

      {od.status === "en_ruta" && (
        <button
          type="button"
          onClick={onOpenPod}
          className="studio-btn studio-btn-primary"
          style={{ width: "100%", height: 52, fontSize: 14, marginTop: 8 }}
        >
          Confirmar entrega · POD
        </button>
      )}

      {advanceState?.error && (
        <div
          style={{
            padding: 10,
            background: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "600 12.5px/1.4 var(--f-sans)",
          }}
        >
          {advanceState.error}
        </div>
      )}
    </main>
  );
}
