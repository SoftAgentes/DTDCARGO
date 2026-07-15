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
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import {
  bookingStatusLabel,
  bookingStatusTone,
  containerStatusLabel,
  containerStatusTone,
  normalizeContainerNo,
  sailingStatusLabel,
  sailingStatusTone,
  spaceTone,
  type Booking,
  type Carrier,
  type ContainerType,
  type Port,
  type Sailing,
} from "@/lib/studio/naviera/types";
import { buildSeaRatesTrackingUrl } from "@/lib/studio/naviera-tracking/searates-deeplink";
import type {
  ConsolidationDetail,
  LooseCargo,
  NavieraKpis,
} from "@/lib/studio/naviera/queries";
import {
  closeConsolidation,
  changeConsolidationStatus,
  setConsolidationContainerNo,
  refreshTracking,
} from "../actions";
import type { TrackingSnapshotRow } from "@/lib/studio/naviera-tracking/snapshot-queries";
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
  trackingByConsolidation,
}: {
  sailings: Sailing[];
  bookings: Booking[];
  consolidations: ConsolidationDetail[];
  looseCargo: LooseCargo[];
  carriers: Carrier[];
  ports: Port[];
  containerTypes: ContainerType[];
  kpis: NavieraKpis;
  /** Snapshots de tracking SeaRates por consolidación (SDD-0101 · Slice B.2). */
  trackingByConsolidation?: Record<string, TrackingSnapshotRow>;
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
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
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
            Agrupa carga suelta LCL de China en contenedores FCL, mide la
            utilización CBM/peso, cierra el contenedor y átalo a un zarpe y su
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
          valueColor={kpis.looseCbm > 0 ? "var(--wine-text)" : "var(--ink)"}
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
          trackingByConsolidation={trackingByConsolidation}
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
        description="Carga un itinerario (manual en V1) con la naviera, la ruta CN→VE y las fechas de cut-off / ETD / ETA."
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
                color: "var(--ink-soft)",
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
  trackingByConsolidation,
  onNew,
  onAssign,
}: {
  consolidations: ConsolidationDetail[];
  carriers: Carrier[];
  sailings: Sailing[];
  trackingByConsolidation?: Record<string, TrackingSnapshotRow>;
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
        description="Crea un contenedor (DTD-CONSOL-NNNN), elige el tipo y empieza a sumarle carga suelta de China."
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
                  color: "var(--ink-soft)",
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
          key={selected.consolidation.id}
          detail={selected}
          carriers={carriers}
          sailings={sailings}
          snapshot={trackingByConsolidation?.[selected.consolidation.id] ?? null}
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
  snapshot,
  onAssign,
}: {
  detail: ConsolidationDetail;
  carriers: Carrier[];
  sailings: Sailing[];
  snapshot: TrackingSnapshotRow | null;
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
  const carrierScac = sailing
    ? carriers.find((cr) => cr.id === sailing.carrier_id)?.scac ?? null
    : null;

  // Nº de contenedor + deep-link de tracking (SDD-0101). Se carga post-creación;
  // el editor inicializa con lo guardado y se resetea al cambiar de contenedor
  // (key={consolidation.id} en el render). El deep-link abre SeaRates (0 cuota).
  const [containerNo, setContainerNo] = useState(c.container_no ?? "");
  const [containerErr, setContainerErr] = useState<string | null>(null);
  const normalizedNo = normalizeContainerNo(containerNo);
  const containerDirty = (normalizedNo ?? "") !== (c.container_no ?? "");
  // El deep-link sale del input en vivo (rastrear no requiere guardar primero).
  const trackUrl = normalizedNo
    ? buildSeaRatesTrackingUrl({
        kind: "container",
        value: normalizedNo,
        scac: carrierScac,
      })
    : null;

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

        {/* Nº de contenedor + tracking SeaRates (SDD-0101) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 18,
            paddingBottom: 18,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Nº de contenedor
            </span>
            <input
              className="studio-input studio-input-mono"
              style={{ width: 200 }}
              value={containerNo}
              onChange={(e) => {
                setContainerNo(e.target.value);
                setContainerErr(null);
              }}
              placeholder="COSU1234567"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <ActionButton
            variant="dark"
            size="sm"
            idleLabel="Guardar"
            loadingLabel="Guardando…"
            successLabel="Guardado"
            disabled={!containerDirty}
            onAction={() => {
              setContainerErr(null);
              return setConsolidationContainerNo(c.id, containerNo);
            }}
            onError={setContainerErr}
          />
          {trackUrl ? (
            <a
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              aria-label="Ver en SeaRates (abre en otra pestaña)"
            >
              Ver en SeaRates →
            </a>
          ) : (
            <span
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                alignSelf: "center",
              }}
            >
              Carga el nº para rastrear en SeaRates.
            </span>
          )}
          {containerErr ? (
            <span
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--danger)",
                width: "100%",
                marginTop: 2,
              }}
            >
              {containerErr}
            </span>
          ) : null}
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
            Quedan <strong>{st.freeCbm.toFixed(1)} CBM</strong> libres · puedes
            sumar carga suelta de CN para optimizar el flete antes del cut-off.
          </div>
        )}
      </div>

      {/* Tracking en vivo desde SeaRates (SDD-0101 · Slice B.2) */}
      <LiveTrackingCard snapshot={snapshot} consolidationId={c.id} />

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
              color: "var(--ink-soft)",
            }}
          >
            Sin carga asignada todavía. Usa “+ Asignar carga”.
          </div>
        ) : (
          <>
            <HeaderRow grid={ITEM_GRID}>
              <span>Shipping Mark</span>
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
                  padding: "var(--s-3) var(--s-5)",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                }}
              >
                <code
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--wine-text)",
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
                        color: "var(--ink-soft)",
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
                padding: "var(--s-3) var(--s-5)",
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

/** "hace X" relativo (corto) para el fetched_at del snapshot. */
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Texto del último hito (el más reciente). */
function lastMilestoneText(snapshot: TrackingSnapshotRow): string {
  const last = snapshot.milestones[snapshot.milestones.length - 1];
  if (!last) return "—";
  const where = last.location ? ` · ${last.location}` : "";
  const when = last.date ? ` · ${last.date}` : "";
  return `${last.description}${where}${when}`;
}

function LiveStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "700 10.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono ? "600 13px/1.3 var(--f-mono)" : "600 13px/1.3 var(--f-sans)",
          color: "var(--ink)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Tracking en vivo desde SeaRates (SDD-0101 · Slice B.2). Muestra el snapshot
 * cacheado (estado/buque/ETA/posición/último hito) + un botón MEDIDO "Actualizar
 * desde SeaRates" (1 llamada, guardada por la cuota). El operador lo dispara a mano
 * — nunca por pageview. El deep-link gratis vive arriba (bloque del nº de contenedor).
 */
function LiveTrackingCard({
  snapshot,
  consolidationId,
}: {
  snapshot: TrackingSnapshotRow | null;
  consolidationId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const hasData = snapshot != null && snapshot.fetchStatus === "ok";

  return (
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
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: hasData ? 16 : 0,
        }}
      >
        <div className="studio-eyebrow">Tracking en vivo · SeaRates</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            {snapshot ? `Actualizado ${timeAgo(snapshot.fetchedAt)}` : "Sin rastrear todavía"}
          </span>
          {snapshot?.apiRemaining != null ? (
            <span
              style={{
                font: "700 11px/1 var(--f-mono)",
                // Aviso cuando escasea el plan (cuota dura compartida con fletes).
                color: snapshot.apiRemaining <= 3 ? "var(--warning)" : "var(--ink-soft)",
              }}
            >
              quedan {snapshot.apiRemaining}
            </span>
          ) : null}
          <ActionButton
            variant="dark"
            size="sm"
            idleLabel="Actualizar desde SeaRates"
            loadingLabel="Consultando…"
            successLabel="Actualizado"
            onAction={() => {
              setError(null);
              return refreshTracking(consolidationId);
            }}
            onSuccess={() => {
              toast.success("Tracking actualizado desde SeaRates");
              router.refresh();
            }}
            onError={setError}
          />
        </div>
      </div>

      {error ? (
        <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--danger)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {snapshot && snapshot.fetchStatus === "error" && !error ? (
        <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 12 }}>
          SeaRates no devolvió datos para este número
          {snapshot.errorCode ? ` (${snapshot.errorCode})` : ""}. Verifica el contenedor/BL.
        </div>
      ) : null}

      {hasData ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
          }}
        >
          <LiveStat label="Estado" value={snapshot.status ?? "—"} />
          <LiveStat label="Buque" value={snapshot.vessel ?? "—"} />
          <LiveStat
            label={snapshot.podActual ? "Arribo (real)" : "ETA a puerto"}
            value={snapshot.podEta ?? "—"}
            mono
          />
          {snapshot.lastLat != null && snapshot.lastLng != null ? (
            <LiveStat
              label="Última posición"
              value={`${snapshot.lastLat.toFixed(2)}, ${snapshot.lastLng.toFixed(2)}`}
              mono
            />
          ) : null}
          {snapshot.milestones.length > 0 ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  font: "700 10.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Último hito
              </div>
              <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                {lastMilestoneText(snapshot)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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
          color: "var(--ink-soft)",
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
          <span>Shipping Mark</span>
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
              style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine-text)" }}
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
            padding: "var(--s-3) var(--s-5)",
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
        description="Crea una reserva (BKG-YYYY-NNNN) con la naviera y el itinerario; captura el BL marítimo cuando la naviera lo emita."
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
                color: b.bl_number ? "var(--ink)" : "var(--ink-soft)",
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
                    color: "var(--ink-soft)",
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
