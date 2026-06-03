"use client";

/**
 * Orquestador client de Naviera & Consolidación (SDD-0047, Slice B).
 *
 * Header + 4 KPIs (Salidas con espacio · Contenedores consolidando · Carga
 * suelta CBM · Próximo cut-off) + 4 tabs:
 *   - Itinerarios (sailings)            · lista + drawer alta/edición.
 *   - Contenedores / consolidación ⭐   · lista lateral + detalle con barra de
 *                                          utilización + asignar carga suelta.
 *   - Carga suelta (loose_cargo)        · candidatos a consolidar.
 *   - Reservas (bookings)               · alta + captura manual de BL.
 *
 * Calca el layout del Norte (erp/modules/naviera.jsx) con las primitivas reales
 * del repo. Solo tokens var(--*).
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import {
  bookingStatusLabel,
  bookingStatusTone,
  containerStatusLabel,
  containerStatusTone,
  sailingStatusLabel,
  sailingStatusTone,
  spaceTone,
  type Booking,
  type Carrier,
  type ContainerType,
  type Port,
  type Sailing,
} from "@/lib/studio/naviera/types";
import type {
  ConsolidationDetail,
  LooseCargo,
  NavieraKpis,
} from "@/lib/studio/naviera/queries";
import {
  closeConsolidation,
  changeConsolidationStatus,
} from "../actions";
import { SailingDrawer } from "./SailingDrawer";
import { BookingDrawer } from "./BookingDrawer";
import { ConsolidationDrawer } from "./ConsolidationDrawer";
import { AssignCargoDrawer } from "./AssignCargoDrawer";
import { UtilizationBar, utilizationTone } from "./UtilizationBar";

type Tab = "sailings" | "consolidation" | "loose" | "bookings";

const TABS: { value: Tab; label: string }[] = [
  { value: "sailings", label: "Itinerarios" },
  { value: "consolidation", label: "Consolidación" },
  { value: "loose", label: "Carga suelta" },
  { value: "bookings", label: "Reservas" },
];

function carrierNameById(carriers: Carrier[], id: string | null): string {
  if (!id) return "—";
  return carriers.find((c) => c.id === id)?.name ?? "—";
}

export function NavieraClient({
  sailings,
  bookings,
  consolidations,
  looseCargo,
  carriers,
  ports,
  containerTypes,
  kpis,
}: {
  sailings: Sailing[];
  bookings: Booking[];
  consolidations: ConsolidationDetail[];
  looseCargo: LooseCargo[];
  carriers: Carrier[];
  ports: Port[];
  containerTypes: ContainerType[];
  kpis: NavieraKpis;
}) {
  const [tab, setTab] = useState<Tab>("consolidation");
  const [showNewSailing, setShowNewSailing] = useState(false);
  const [editSailing, setEditSailing] = useState<Sailing | null>(null);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [showNewConsolidation, setShowNewConsolidation] = useState(false);
  const [assignTo, setAssignTo] = useState<ConsolidationDetail | null>(null);

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
          <span className="studio-eyebrow">Operación · Logística marítima</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Naviera & Consolidación.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Agrupá carga suelta LCL de China en contenedores FCL, medí la
            utilización CBM/peso, cerrá el contenedor y atalo a un zarpe y su
            reserva de espacio.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={() => setShowNewSailing(true)}
          >
            + Nuevo itinerario
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNewConsolidation(true)}
            disabled={containerTypes.length === 0}
            title={
              containerTypes.length === 0
                ? "Falta el catálogo de tipos de contenedor (migración 0096)"
                : undefined
            }
          >
            + Nuevo contenedor
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard
          value={kpis.openSailings}
          label="Salidas con espacio"
          sub={`${carriers.length} naviera(s) · CN→VE`}
        />
        <KpiCard
          value={kpis.consolidating}
          label="Contenedores consolidando"
          valueColor={kpis.consolidating > 0 ? "var(--warning)" : "var(--ink)"}
          sub="LCL → FCL abiertos"
        />
        <KpiCard
          value={`${kpis.looseCbm.toFixed(1)} CBM`}
          label="Carga suelta en CN"
          valueColor={kpis.looseCbm > 0 ? "var(--wine)" : "var(--ink)"}
          sub={`${kpis.looseCount} embarque(s) sin asignar`}
        />
        <KpiCard
          value={bookings.length}
          label="Reservas"
          sub="Bookings vivos del tenant"
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

      {tab === "sailings" && (
        <SailingsTab
          sailings={sailings}
          carriers={carriers}
          onNew={() => setShowNewSailing(true)}
          onEdit={(s) => setEditSailing(s)}
        />
      )}

      {tab === "consolidation" && (
        <ConsolidationTab
          consolidations={consolidations}
          carriers={carriers}
          sailings={sailings}
          onNew={() => setShowNewConsolidation(true)}
          onAssign={(d) => setAssignTo(d)}
        />
      )}

      {tab === "loose" && (
        <LooseCargoTab
          looseCargo={looseCargo}
          onGoConsolidation={() => setTab("consolidation")}
        />
      )}

      {tab === "bookings" && (
        <BookingsTab
          bookings={bookings}
          carriers={carriers}
          onNew={() => setShowNewBooking(true)}
          onEdit={(b) => setEditBooking(b)}
        />
      )}

      {/* Drawers */}
      {showNewSailing && (
        <SailingDrawer
          carriers={carriers}
          ports={ports}
          onClose={() => setShowNewSailing(false)}
        />
      )}
      {editSailing && (
        <SailingDrawer
          sailing={editSailing}
          carriers={carriers}
          ports={ports}
          onClose={() => setEditSailing(null)}
        />
      )}
      {showNewBooking && (
        <BookingDrawer
          carriers={carriers}
          sailings={sailings}
          containerTypes={containerTypes}
          onClose={() => setShowNewBooking(false)}
        />
      )}
      {editBooking && (
        <BookingDrawer
          booking={editBooking}
          carriers={carriers}
          sailings={sailings}
          containerTypes={containerTypes}
          onClose={() => setEditBooking(null)}
        />
      )}
      {showNewConsolidation && (
        <ConsolidationDrawer
          containerTypes={containerTypes}
          bookings={bookings}
          sailings={sailings}
          onClose={() => setShowNewConsolidation(false)}
        />
      )}
      {assignTo && (
        <AssignCargoDrawer
          detail={assignTo}
          looseCargo={looseCargo}
          onClose={() => setAssignTo(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Itinerarios
// ════════════════════════════════════════════════════════════════

const SAILING_GRID = "1.3fr 1fr 100px 100px 90px 150px";

function SailingsTab({
  sailings,
  carriers,
  onNew,
  onEdit,
}: {
  sailings: Sailing[];
  carriers: Carrier[];
  onNew: () => void;
  onEdit: (s: Sailing) => void;
}) {
  // Abiertos / cut-off primero (los que aún reciben carga), luego el resto.
  const order = (s: Sailing) =>
    s.status === "abierto" ? 0 : s.status === "cutoff" ? 1 : 2;
  const rows = [...sailings].sort((a, b) => order(a) - order(b));

  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin itinerarios"
        title="Todavía no hay zarpes cargados."
        description="Cargá un itinerario (manual en V1) con la naviera, la ruta CN→VE y las fechas de cut-off / ETD / ETA."
        action={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onNew}
          >
            + Nuevo itinerario
          </button>
        }
      />
    );
  }

  return (
    <TableShell>
      <HeaderRow grid={SAILING_GRID}>
        <span>Naviera · buque</span>
        <span>Ruta</span>
        <span>ETD</span>
        <span>Cut-off</span>
        <span>Tránsito</span>
        <span style={{ textAlign: "right" }}>Estado</span>
      </HeaderRow>
      {rows.map((s, i) => (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={() => onEdit(s)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(s);
            }
          }}
          className="studio-tracking-row"
          style={{
            display: "grid",
            gridTemplateColumns: SAILING_GRID,
            gap: 12,
            padding: "14px 20px",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                font: "700 12.5px/1.2 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              {carrierNameById(carriers, s.carrier_id)}
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-mono)",
                color: "var(--ink-mute)",
                marginTop: 4,
              }}
            >
              {s.vessel}
              {s.voyage ? ` · ${s.voyage}` : ""}
            </div>
          </div>
          <div
            style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink)" }}
          >
            {s.pol} <span style={{ color: "var(--ink-mute)" }}>→</span> {s.pod}
          </div>
          <span
            style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink)" }}
          >
            {s.etd ?? "—"}
          </span>
          <span
            style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink)" }}
          >
            {s.cutoff ?? "—"}
          </span>
          <span
            style={{
              font: "500 11.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {s.transit_days != null ? `${s.transit_days} días` : "—"}
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 5,
            }}
          >
            <Badge tone={sailingStatusTone(s.status)} size="sm" dot>
              {sailingStatusLabel(s.status)}
            </Badge>
            {(s.status === "abierto" || s.status === "cutoff") && (
              <Badge tone={spaceTone(s.space)} size="sm">
                espacio {s.space}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </TableShell>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Consolidación ⭐
// ════════════════════════════════════════════════════════════════

function ConsolidationTab({
  consolidations,
  carriers,
  sailings,
  onNew,
  onAssign,
}: {
  consolidations: ConsolidationDetail[];
  carriers: Carrier[];
  sailings: Sailing[];
  onNew: () => void;
  onAssign: (d: ConsolidationDetail) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    consolidations[0]?.consolidation.id ?? null,
  );
  const selected =
    consolidations.find((d) => d.consolidation.id === selectedId) ??
    consolidations[0] ??
    null;

  if (consolidations.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin contenedores"
        title="Todavía no hay contenedores de consolidación."
        description="Creá un contenedor (DTD-CONSOL-NNNN), elegí el tipo y empezá a sumarle carga suelta de China."
        action={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onNew}
          >
            + Nuevo contenedor
          </button>
        }
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      {/* Lista lateral */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {consolidations.map((d) => {
          const c = d.consolidation;
          const active = selected?.consolidation.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: "var(--r-lg)",
                background: "var(--bg-surface)",
                border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                boxShadow: active ? "var(--shadow-sm)" : "none",
                cursor: "pointer",
                transition: "border-color var(--dur-fast) var(--ease)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <code
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: active ? "var(--wine)" : "var(--ink)",
                  }}
                >
                  {c.ref}
                </code>
                <Badge tone={containerStatusTone(c.status)} size="sm">
                  {containerStatusLabel(c.status)}
                </Badge>
              </div>
              <div
                style={{
                  font: "500 11px/1 var(--f-sans)",
                  color: "var(--ink-mute)",
                  marginBottom: 8,
                }}
              >
                {c.container_type ?? "sin tipo"} · {d.stats.clients} cliente(s) ·{" "}
                {d.stats.pieces} pzs
              </div>
              <UtilizationBar pct={d.stats.cbmPct} height={6} />
              <div
                style={{
                  font: "700 10.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  marginTop: 6,
                }}
              >
                {d.stats.cbmPct.toFixed(0)}%
                {d.stats.cap
                  ? ` · ${d.stats.usedCbm.toFixed(1)}/${d.stats.cap.cbm} CBM`
                  : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalle */}
      {selected && (
        <ContainerDetail
          detail={selected}
          carriers={carriers}
          sailings={sailings}
          onAssign={() => onAssign(selected)}
        />
      )}
    </div>
  );
}

function ContainerDetail({
  detail,
  carriers,
  sailings,
  onAssign,
}: {
  detail: ConsolidationDetail;
  carriers: Carrier[];
  sailings: Sailing[];
  onAssign: () => void;
}) {
  const c = detail.consolidation;
  const st = detail.stats;
  const sailing = c.sailing_id
    ? sailings.find((s) => s.id === c.sailing_id) ?? null
    : null;
  const carrierName = sailing
    ? carrierNameById(carriers, sailing.carrier_id)
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + ocupación */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <code
                style={{
                  font: "900 18px/1 var(--f-display)",
                  color: "var(--ink)",
                }}
              >
                {c.ref}
              </code>
              <Badge tone={containerStatusTone(c.status)} dot>
                {containerStatusLabel(c.status)}
              </Badge>
            </div>
            <div
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 6,
              }}
            >
              {c.container_type ?? "sin tipo"} · {carrierName} ·{" "}
              {sailing ? `${sailing.pol} → ${sailing.pod}` : "sin itinerario"}
            </div>
          </div>
          {c.status === "consolidando" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={onAssign}
              >
                + Asignar carga
              </button>
              <ActionButton
                variant="dark"
                size="sm"
                idleLabel="Cerrar contenedor"
                loadingLabel="Cerrando…"
                successLabel="Cerrado"
                onAction={() => closeConsolidation(c.id)}
              />
            </div>
          )}
          {c.status === "cerrado" && (
            <ActionButton
              variant="dark"
              size="sm"
              idleLabel="Marcar zarpado"
              loadingLabel="Marcando…"
              successLabel="Zarpado"
              onAction={() => changeConsolidationStatus(c.id, "zarpado")}
            />
          )}
        </div>

        {/* Barras CBM + peso */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
          }}
        >
          <UtilMetric
            label="Volumen · CBM"
            pct={st.cbmPct}
            detail={
              st.cap
                ? `${st.usedCbm.toFixed(1)} de ${st.cap.cbm} CBM · libre ${st.freeCbm.toFixed(1)}`
                : "Sin tipo de contenedor"
            }
          />
          <UtilMetric
            label="Peso · kg"
            pct={st.kgPct}
            detail={
              st.cap
                ? `${(st.usedKg / 1000).toFixed(1)} de ${(st.cap.kg / 1000).toFixed(1)} t · libre ${(st.freeKg / 1000).toFixed(1)} t`
                : "Sin tipo de contenedor"
            }
          />
        </div>

        {st.cap && st.freeCbm > 3 && c.status === "consolidando" && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "var(--info-bg)",
              borderLeft: "3px solid var(--info)",
              borderRadius: "var(--r-md)",
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Quedan <strong>{st.freeCbm.toFixed(1)} CBM</strong> libres · podés
            sumar carga suelta de CN para optimizar el flete antes del cut-off.
          </div>
        )}
      </div>

      {/* Items consolidados */}
      <TableShell>
        <div
          style={{
            padding: "16px 20px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="studio-eyebrow">
            Carga consolidada · {st.clients} cliente(s)
          </div>
        </div>
        {detail.items.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              textAlign: "left",
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            Sin carga asignada todavía. Usá “+ Asignar carga”.
          </div>
        ) : (
          <>
            <HeaderRow grid={ITEM_GRID}>
              <span>MARKBOX</span>
              <span>Cliente · proveedor</span>
              <span>Bultos</span>
              <span style={{ textAlign: "right" }}>CBM</span>
              <span style={{ textAlign: "right" }}>Peso</span>
            </HeaderRow>
            {detail.items.map((it, i) => (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: ITEM_GRID,
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                }}
              >
                <code
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--wine)",
                  }}
                >
                  {it.client_markbox ?? "—"}
                </code>
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      font: "600 12.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {it.client_name ?? "—"}
                  </div>
                  {it.supplier_name && (
                    <div
                      style={{
                        font: "500 10.5px/1.3 var(--f-sans)",
                        color: "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {it.supplier_name}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    font: "500 12px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {it.pieces} bultos
                </span>
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {it.cbm.toFixed(1)}
                </span>
                <span
                  style={{
                    font: "600 11.5px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    textAlign: "right",
                  }}
                >
                  {(it.weight_kg / 1000).toFixed(1)}t
                </span>
              </div>
            ))}
            {/* Totales */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ITEM_GRID,
                gap: 12,
                padding: "12px 20px",
                borderTop: "2px solid var(--ink)",
                background: "var(--bg-elevated)",
                alignItems: "center",
              }}
            >
              <span className="studio-eyebrow">Total</span>
              <span />
              <span
                style={{
                  font: "700 11.5px/1 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {st.pieces} bultos
              </span>
              <span
                style={{
                  font: "900 13px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {st.usedCbm.toFixed(1)}
              </span>
              <span
                style={{
                  font: "800 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {(st.usedKg / 1000).toFixed(1)}t
              </span>
            </div>
          </>
        )}
      </TableShell>
    </div>
  );
}

const ITEM_GRID = "110px 1fr 100px 90px 90px";

function UtilMetric({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number;
  detail: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            font: "800 13px/1 var(--f-mono)",
            color: utilizationTone(pct),
          }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <UtilizationBar pct={pct} height={12} />
      <div
        style={{
          font: "500 11px/1 var(--f-mono)",
          color: "var(--ink-mute)",
          marginTop: 6,
        }}
      >
        {detail}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Carga suelta
// ════════════════════════════════════════════════════════════════

const LOOSE_GRID = "150px 110px 1fr 100px 100px";

function LooseCargoTab({
  looseCargo,
  onGoConsolidation,
}: {
  looseCargo: LooseCargo[];
  onGoConsolidation: () => void;
}) {
  if (looseCargo.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin carga suelta"
        title="No hay embarques LCL sueltos esperando consolidar."
        description="La carga suelta son embarques de consolidación recibidos en el almacén CN que todavía no están asignados a un contenedor."
      />
    );
  }

  return (
    <>
      <TableShell>
        <HeaderRow grid={LOOSE_GRID}>
          <span>Embarque</span>
          <span>MARKBOX</span>
          <span>Cliente</span>
          <span style={{ textAlign: "right" }}>CBM</span>
          <span style={{ textAlign: "right" }}>Peso</span>
        </HeaderRow>
        {looseCargo.map((l, i) => (
          <div
            key={l.shipment_id}
            style={{
              display: "grid",
              gridTemplateColumns: LOOSE_GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
            }}
          >
            <code
              style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}
            >
              {l.code}
            </code>
            <code
              style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine)" }}
            >
              {l.client_markbox ?? "—"}
            </code>
            <span
              style={{
                font: "600 12px/1.3 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {l.client_name ?? "—"}
            </span>
            <span
              style={{
                font: "800 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {(l.cbm ?? 0).toFixed(1)}
            </span>
            <span
              style={{
                font: "600 11.5px/1 var(--f-mono)",
                color: "var(--ink-soft)",
                textAlign: "right",
              }}
            >
              {l.weight_kg != null ? `${(l.weight_kg / 1000).toFixed(1)}t` : "—"}
            </span>
          </div>
        ))}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onGoConsolidation}
          >
            Ir a consolidación →
          </button>
        </div>
      </TableShell>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Reservas
// ════════════════════════════════════════════════════════════════

const BOOKING_GRID = "130px 1fr 120px 120px 1fr 110px";

function BookingsTab({
  bookings,
  carriers,
  onNew,
  onEdit,
}: {
  bookings: Booking[];
  carriers: Carrier[];
  onNew: () => void;
  onEdit: (b: Booking) => void;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin reservas"
        title="Todavía no hay reservas de espacio."
        description="Creá una reserva (BKG-YYYY-NNNN) con la naviera y el itinerario; capturá el BL marítimo cuando la naviera lo emita."
        action={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onNew}
          >
            + Nueva reserva
          </button>
        }
      />
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onNew}
        >
          + Nueva reserva
        </button>
      </div>
      <TableShell>
        <HeaderRow grid={BOOKING_GRID}>
          <span>Booking</span>
          <span>Naviera</span>
          <span>Modo · tipo</span>
          <span>BL marítimo</span>
          <span>Shipper · carga</span>
          <span style={{ textAlign: "right" }}>Estado</span>
        </HeaderRow>
        {bookings.map((b, i) => (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => onEdit(b)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(b);
              }
            }}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: BOOKING_GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <code
              style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--ink)" }}
            >
              {b.code}
            </code>
            <span
              style={{
                font: "600 12px/1.2 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {carrierNameById(carriers, b.carrier_id)}
            </span>
            <span>
              <Badge tone={b.mode === "LCL" ? "info" : "wine"} size="sm">
                {b.mode}
              </Badge>
              {b.container_type && (
                <span
                  style={{
                    font: "500 11px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginLeft: 6,
                  }}
                >
                  {b.container_type}
                </span>
              )}
            </span>
            <code
              style={{
                font: "600 10.5px/1 var(--f-mono)",
                color: b.bl_number ? "var(--ink)" : "var(--ink-mute)",
              }}
            >
              {b.bl_number || "pendiente"}
            </code>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: "600 12px/1.2 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.shipper ?? "—"}
              </div>
              {b.commodity && (
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink-mute)",
                    marginTop: 3,
                  }}
                >
                  {b.commodity}
                </div>
              )}
            </div>
            <span style={{ textAlign: "right" }}>
              <Badge tone={bookingStatusTone(b.status)} size="sm" dot>
                {bookingStatusLabel(b.status)}
              </Badge>
            </span>
          </div>
        ))}
      </TableShell>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Primitivas locales de tabla
// ════════════════════════════════════════════════════════════════

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
      {children}
    </div>
  );
}
