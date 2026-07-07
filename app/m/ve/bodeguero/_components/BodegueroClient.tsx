"use client";

/**
 * BodegueroClient — UI mobile del bodeguero VE (SDD-0030).
 *
 * Cola de ODs activas del tenant en estados creada/cargando/lista.
 * Click en una OD → vista detalle inline con paquetes + acciones.
 * Acciones:
 *  - Abrir carga (creada → cargando)
 *  - Fraccionar paquete (split P1/P2)
 *  - Cerrar carga (cargando → lista)
 *
 * Sprint G (handoff v1.7): ActionButton anti-double-submit en "Abrir/Cerrar
 * carga", SettingsMenu con cerrar sesión + tema, tier badge por paquete,
 * botones Llamar (tel:) + WhatsApp (wa.me/), grouping de paquetes por
 * ciudad (cada ciudad es una "parada").
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { RealtimeIndicator } from "@/app/studio/_components/ui/RealtimeIndicator";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";
import {
  SettingsMenu,
  useThemeMode,
  type ThemeMode,
} from "@/app/m/_components/SettingsMenu";
import {
  advanceOdAction,
  reassignOdAction,
  signOutAction,
  splitPackageP2Action,
} from "../actions";
import { switchModeAction } from "../../modos/actions";
import { SplitQueueRetryRunner } from "./SplitQueueRetryRunner";
import {
  enqueueSplit,
  makeSplitLocalId,
} from "@/app/m/_lib/split-queue";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  computeCapacity,
  DISPATCH_ORDER_STATUS_LABELS,
  DISPATCH_ORDER_STATUS_TONES,
  DISPATCH_SPLIT_REASON_LABELS,
  type DispatchOrderRow,
  type DispatchSplitReason,
} from "@/lib/studio/dispatch-types";
import { tierLabel, tierBadgeTone, type ClientTier } from "@/lib/studio/client-types";
import type { MobileActionState } from "@/lib/studio/dispatch-mobile-types";
import type { OperarioRole } from "@/lib/studio/operario-types";
import type {
  AvailableDriver,
  AvailableTruck,
} from "@/lib/studio/dispatch-mobile-queries";

const INITIAL: MobileActionState = {};

type LoadMode = "cargar" | "despachar";

interface Props {
  operario: {
    operario_id: string;
    displayName: string;
    firstName: string;
    initials: string;
    role: string;
    /** Sprint D · multi-rol. Si length > 1, header muestra "Cambiar modo". */
    roles: OperarioRole[];
  };
  ods: DispatchOrderRow[];
  tenantId: string;
  /** Sprint 2 · pool para reasignación inline. */
  availableTrucks: AvailableTruck[];
  availableDrivers: AvailableDriver[];
  /** Sprint 2 · feature flag warehouse_location render. */
  showWarehouseLocation: boolean;
}

export function BodegueroClient({
  operario,
  ods,
  tenantId,
  availableTrucks,
  availableDrivers,
  showWarehouseLocation,
}: Props) {
  const [selectedOdId, setSelectedOdId] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useThemeMode("bodeguero");

  const selected = ods.find((o) => o.id === selectedOdId);

  // Realtime: cuando un OD del tenant cambia (admin asigna, status update),
  // refresh server data para que la cola del bodeguero se mantenga sincronizada.
  const realtime = useRealtimeRefresh({
    table: "dispatch_orders",
    filter: `tenant_id=eq.${tenantId}`,
  });

  return (
    <div
      data-theme={theme}
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
      {/* Drena la cola offline de fraccionamientos al volver la señal */}
      <SplitQueueRetryRunner />
      <Header
        operario={operario}
        realtimeStatus={realtime.status}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMultiRole={operario.roles.length > 1}
      />

      {selected ? (
        <OdDetail
          od={selected}
          onBack={() => setSelectedOdId(null)}
          availableTrucks={availableTrucks}
          availableDrivers={availableDrivers}
          showWarehouseLocation={showWarehouseLocation}
        />
      ) : (
        <OdList ods={ods} onPick={setSelectedOdId} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header sticky
// ─────────────────────────────────────────────────────────────

function Header({
  operario,
  realtimeStatus,
  theme,
  onToggleTheme,
  isMultiRole,
}: {
  operario: Props["operario"];
  realtimeStatus: import("@/lib/studio/hooks/use-realtime-table").RealtimeStatus;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isMultiRole: boolean;
}) {
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
          Almacenista · DTD
        </div>
        <div
          style={{
            font: "900 18px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginTop: 3,
          }}
        >
          Despacho del día
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <RealtimeIndicator status={realtimeStatus} />
        <SettingsMenu
          theme={theme}
          onToggleTheme={onToggleTheme}
          signOutAction={signOutAction}
          onSwitchMode={isMultiRole ? () => switchModeAction() : undefined}
        />
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Lista de ODs activas
// ─────────────────────────────────────────────────────────────

function OdList({
  ods,
  onPick,
}: {
  ods: DispatchOrderRow[];
  onPick: (id: string) => void;
}) {
  if (ods.length === 0) {
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
          Sin ODs por armar
        </div>
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            maxWidth: "32ch",
            margin: 0,
          }}
        >
          Cuando el admin asigne ODs nuevas las vas a ver acá. Refresca la
          pantalla para chequear.
        </p>
      </div>
    );
  }

  return (
    <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Recepción VE entry point · Sprint E */}
      <Link
        href="/m/ve/bodeguero/recepcion"
        style={{
          padding: 12,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--info)",
          borderRadius: "var(--r-md)",
          textDecoration: "none",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--r-sm)",
            background: "var(--info-bg)",
            color: "var(--info)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path
              d="M3 14h18M5 14V8a2 2 0 012-2h10a2 2 0 012 2v6M8 14v4M16 14v4M3 18h18"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "800 13.5px/1.2 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Recepción VE
          </div>
          <div
            style={{
              font: "500 11.5px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            Escanear contenedores que llegaron
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          style={{ color: "var(--ink-mute)" }}
        >
          <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <div
        className="studio-eyebrow"
        style={{ color: "var(--ink-soft)" }}
      >
        Cola · {ods.length} ODs
      </div>
      {ods.map((od) => {
        const tone = DISPATCH_ORDER_STATUS_TONES[od.status];
        return (
          <button
            key={od.id}
            type="button"
            onClick={() => onPick(od.id)}
            style={{
              padding: 14,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderLeft: "4px solid var(--wine)",
              borderRadius: "var(--r-md)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <code style={{ font: "800 13px/1 var(--f-mono)", color: "var(--wine)" }}>
                {od.order_code}
              </code>
              <Badge tone={tone} size="sm">
                {DISPATCH_ORDER_STATUS_LABELS[od.status]}
              </Badge>
            </div>
            <div
              style={{
                font: "700 13.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              {od.route?.name ?? "Sin ruta"}
            </div>
            <div
              style={{
                font: "500 11.5px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                marginBottom: 8,
              }}
            >
              {od.truck?.plate ?? "—"} · {od.driver?.name ?? "—"}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                font: "600 11px/1 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              <span>{od.package_count} pkg</span>
              <span>{od.total_kg.toFixed(0)} kg</span>
              <span>{od.total_cbm.toFixed(1)} cbm</span>
            </div>
          </button>
        );
      })}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Detalle de OD + acciones
// ─────────────────────────────────────────────────────────────

function OdDetail({
  od,
  onBack,
  availableTrucks,
  availableDrivers,
  showWarehouseLocation,
}: {
  od: DispatchOrderRow;
  onBack: () => void;
  availableTrucks: AvailableTruck[];
  availableDrivers: AvailableDriver[];
  showWarehouseLocation: boolean;
}) {
  const [splitForId, setSplitForId] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);

  // Sprint 2 · LIFO/FIFO mode toggle (defaults a 'cargar' = LIFO).
  // cargar  → load order: last stop first (LIFO). El bodeguero llena el
  //           camión con el paquete que sale ÚLTIMO primero · stack.
  // despachar → delivery order: first stop first (FIFO). Visualiza en orden
  //           cronológico de entrega del camionero.
  const [loadMode, setLoadMode] = useState<LoadMode>("cargar");

  const splittingPkg = od.packages.find((p) => p.package_id === splitForId);

  const nextStatus =
    od.status === "creada" ? "cargando" : od.status === "cargando" ? "lista" : null;
  const nextLabel =
    nextStatus === "cargando" ? "Abrir carga" : nextStatus === "lista" ? "Cerrar carga · lista para salir" : null;
  const nextLoadingLabel =
    nextStatus === "cargando" ? "Abriendo…" : "Cerrando…";
  const nextSuccessLabel =
    nextStatus === "cargando" ? "Carga abierta" : "Lista para salir";

  // Sprint G (handoff v1.7): agrupar paquetes por ciudad → cada ciudad es
  // una "parada". Usamos el orden de `cities_ordered` si existe (lo setea
  // el admin al crear la OD desde la ruta), si no caemos al orden de
  // aparición.
  // Sprint 2: la dirección del array depende de loadMode (cargar=LIFO,
  // despachar=FIFO).
  const groupedByCity = useMemo(() => {
    const groups = groupPackagesByCity(od.packages, od.cities_ordered);
    return loadMode === "cargar" ? [...groups].reverse() : groups;
  }, [od.packages, od.cities_ordered, loadMode]);

  // Sprint 2: capacity de la OD (snapshot vs total acumulado).
  const capacity = useMemo(() => {
    const cap = {
      capacity_kg: Number(od.capacity_kg_snapshot ?? 0),
      capacity_cbm: Number(od.capacity_cbm_snapshot ?? 0),
    };
    if (cap.capacity_kg === 0 || cap.capacity_cbm === 0) return null;
    return computeCapacity(od.packages, cap);
  }, [od.packages, od.capacity_kg_snapshot, od.capacity_cbm_snapshot]);

  // Sprint 2: DoneState · todos los paquetes con status non-pendiente
  const allDelivered = useMemo(() => {
    if (od.status !== "en_ruta" && od.status !== "entregada") return false;
    return od.packages.every(
      (p) => (p.delivery_status ?? "pendiente") !== "pendiente",
    );
  }, [od.packages, od.status]);

  return (
    <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <button
        type="button"
        onClick={onBack}
        className="studio-btn studio-btn-ghost studio-btn-sm"
        style={{ alignSelf: "flex-start", color: "var(--ink-soft)" }}
      >
        ← Volver
      </button>

      {/* Card hero */}
      <div
        style={{
          padding: 16,
          background: "var(--bg-sidebar)",
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
          <code style={{ font: "900 16px/1 var(--f-mono)", color: "var(--wine-soft)" }}>
            {od.order_code}
          </code>
          <Badge tone={DISPATCH_ORDER_STATUS_TONES[od.status]} size="sm">
            {DISPATCH_ORDER_STATUS_LABELS[od.status]}
          </Badge>
        </div>
        <div style={{ font: "900 18px/1.2 var(--f-display)", marginBottom: 6 }}>
          {od.route?.name ?? "Sin ruta"}
        </div>
        <div style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-inv-soft)" }}>
          {od.truck?.plate ?? "—"} · {od.truck?.brand ?? "—"} · {od.driver?.name ?? "—"}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            font: "700 12px/1 var(--f-mono)",
            color: "var(--ink-inv)",
          }}
        >
          <span>{od.package_count} pkg</span>
          <span>{od.total_kg.toFixed(0)} kg</span>
          <span>{od.total_cbm.toFixed(1)} cbm</span>
        </div>

        {/* Sprint 2 · capacity progress bars · solo si snapshot existe */}
        {capacity && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <CapacityBar
              label="Peso"
              used={capacity.kg_used}
              total={Number(od.capacity_kg_snapshot ?? 0)}
              unit="kg"
              pct={capacity.kg_pct}
              overflow={capacity.kg_pct > 100}
            />
            <CapacityBar
              label="Volumen"
              used={capacity.cbm_used}
              total={Number(od.capacity_cbm_snapshot ?? 0)}
              unit="m³"
              pct={capacity.cbm_pct}
              overflow={capacity.cbm_pct > 100}
            />
          </div>
        )}

        {/* Sprint 2 · botón Reasignar inline · solo si OD editable */}
        {(od.status === "creada" || od.status === "cargando") && (
          <button
            type="button"
            onClick={() => setReassignOpen(true)}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{
              marginTop: 10,
              color: "var(--wine-soft)",
              borderColor: "var(--wine-soft)",
            }}
          >
            Reasignar camión / chofer
          </button>
        )}
      </div>

      {/* Sprint 2 · DoneState · cuando todos los paquetes entregados/etc */}
      {allDelivered && (
        <div
          style={{
            padding: 14,
            background: "var(--success-bg)",
            color: "var(--success)",
            border: "1px solid var(--success)",
            borderRadius: "var(--r-md)",
            font: "700 13px/1.4 var(--f-sans)",
            textAlign: "center",
          }}
        >
          ✓ Todos los paquetes marcados · esperando POD final del transportista.
        </div>
      )}

      {/* Sprint 2 · LIFO/FIFO toggle · solo si carga activa */}
      {(od.status === "creada" || od.status === "cargando") && groupedByCity.length > 1 && (
        <LoadModeToggle mode={loadMode} onChange={setLoadMode} />
      )}

      {/* Stops grouped by city · Sprint G (handoff v1.7) · Sprint 2 · dir LIFO/FIFO */}
      <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
        Paradas · {groupedByCity.length} ciudades · {od.packages.length} paquetes
        {(od.status === "creada" || od.status === "cargando") && groupedByCity.length > 1 && (
          <span
            style={{
              marginLeft: 8,
              color: "var(--wine-soft)",
              textTransform: "none",
              letterSpacing: 0,
              font: "500 11px/1 var(--f-sans)",
            }}
          >
            {loadMode === "cargar" ? "Orden de carga (LIFO)" : "Orden de entrega (FIFO)"}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groupedByCity.map((group, gIdx) => (
          <section
            key={group.city || `__no-city-${gIdx}`}
            aria-label={`Parada ${gIdx + 1}: ${group.city || "Sin ciudad"}`}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "var(--r-pill)",
                  background: "var(--wine-tint)",
                  color: "var(--wine)",
                  font: "900 11px/1 var(--f-mono)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--wine)",
                }}
              >
                {gIdx + 1}
              </div>
              <div
                style={{
                  font: "800 13px/1.2 var(--f-display)",
                  color: "var(--ink)",
                }}
              >
                {group.city || "Sin ciudad"}
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {group.packages.length} pkg
              </div>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.packages.map((p) => (
                <PackageCard
                  key={p.package_id}
                  pkg={p}
                  odStatus={od.status}
                  onRequestSplit={() => setSplitForId(p.package_id)}
                  showWarehouseLocation={showWarehouseLocation}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Advance action */}
      {nextStatus && nextLabel && (
        <div style={{ marginTop: 8 }}>
          <ActionButton
            variant={nextStatus === "lista" ? "primary" : "dark"}
            size="default"
            idleLabel={nextLabel}
            loadingLabel={nextLoadingLabel}
            successLabel={nextSuccessLabel}
            onAction={async () => {
              setAdvanceError(null);
              const fd = new FormData();
              fd.append("od_id", od.id);
              fd.append("status", nextStatus);
              const result = await advanceOdAction({}, fd);
              if (result?.error) return { error: result.error };
              return undefined;
            }}
            onError={setAdvanceError}
          />
        </div>
      )}

      {advanceError && <ErrorBanner msg={advanceError} />}

      {/* Split modal */}
      {splittingPkg && (
        <SplitModal
          od={od}
          pkg={splittingPkg}
          onClose={() => setSplitForId(null)}
        />
      )}

      {/* Reassign modal · Sprint 2 v3 */}
      {reassignOpen && (
        <ReassignModal
          od={od}
          trucks={availableTrucks}
          drivers={availableDrivers}
          onClose={() => setReassignOpen(false)}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Package card · tier badge + tel + WA + descripción + fraccionar
// ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  odStatus,
  onRequestSplit,
  showWarehouseLocation,
}: {
  pkg: DispatchOrderRow["packages"][number];
  odStatus: DispatchOrderRow["status"];
  onRequestSplit: () => void;
  showWarehouseLocation: boolean;
}) {
  const isPartial = pkg.boxes_shipped < pkg.boxes_total;
  const tier: ClientTier | null = pkg.client_tier ?? null;
  const phone = pkg.client_phone ?? null;
  const phoneClean = phone ? phone.replace(/[^\d+]/g, "") : null;

  // Sprint 2: warehouse_location · `{pasillo, zona, estante}` jsonb opcional
  const warehouseLoc = showWarehouseLocation
    ? (pkg as DispatchOrderRow["packages"][number] & {
        warehouse_location?: {
          pasillo?: string;
          zona?: string;
          estante?: string;
        } | null;
      }).warehouse_location ?? null
    : null;

  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-surface)",
        border: `1px solid ${isPartial ? "var(--warning)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
          gap: 8,
        }}
      >
        <code style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine)" }}>
          {pkg.markbox}
        </code>
        <code style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>
          {pkg.boxes_shipped} / {pkg.boxes_total} cj
        </code>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 2,
        }}
      >
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          {pkg.client_name}
        </div>
        {tier && (
          <Badge tone={tierBadgeTone(tier)} size="sm">
            {tierLabel(tier)}
          </Badge>
        )}
      </div>

      {/* Warehouse location · Sprint 2 (feature flag) */}
      {warehouseLoc && (
        <div
          style={{
            marginTop: 6,
            padding: "4px 8px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            font: "700 11px/1.2 var(--f-mono)",
            color: "var(--ink-soft)",
            display: "inline-flex",
            gap: 8,
          }}
        >
          {warehouseLoc.pasillo && <span>Pasillo {warehouseLoc.pasillo}</span>}
          {warehouseLoc.zona && <span>Zona {warehouseLoc.zona}</span>}
          {warehouseLoc.estante && <span>Est. {warehouseLoc.estante}</span>}
        </div>
      )}

      {pkg.description && (
        <div
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px dashed var(--border)",
          }}
        >
          {pkg.description}
        </div>
      )}

      {isPartial && (
        <div
          style={{
            marginTop: 6,
            font: "600 11px/1.3 var(--f-sans)",
            color: "var(--warning)",
          }}
        >
          Parcial · motivo: {pkg.split_reason ? DISPATCH_SPLIT_REASON_LABELS[pkg.split_reason] : "—"}
        </div>
      )}

      {/* Tel + WhatsApp (Sprint G handoff v1.7) */}
      {phoneClean && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <a
            href={`tel:${phoneClean}`}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ flex: 1, textDecoration: "none" }}
            aria-label={`Llamar a ${pkg.client_name}`}
          >
            Llamar
          </a>
          <a
            href={`https://wa.me/${phoneClean.replace(/^\+/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ flex: 1, textDecoration: "none" }}
            aria-label={`WhatsApp a ${pkg.client_name}`}
          >
            WhatsApp
          </a>
        </div>
      )}

      {odStatus !== "lista" && !isPartial && pkg.boxes_total > 1 && (
        <button
          type="button"
          onClick={onRequestSplit}
          className="studio-btn studio-btn-ghost studio-btn-xs"
          style={{ marginTop: 8 }}
        >
          Fraccionar P1/P2
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers · grouping de paquetes por ciudad
// ─────────────────────────────────────────────────────────────

type CityGroup = {
  city: string;
  packages: DispatchOrderRow["packages"];
};

/**
 * Agrupa paquetes por ciudad respetando `cities_ordered` si está populated.
 * Caso fallback: orden de primera aparición en `packages[]`. Paquetes con
 * city = "" o null caen en grupo "Sin ciudad" al final.
 */
function groupPackagesByCity(
  packages: DispatchOrderRow["packages"],
  citiesOrdered: string[],
): CityGroup[] {
  const byCity = new Map<string, DispatchOrderRow["packages"]>();
  for (const p of packages) {
    const key = (p.city || "").trim();
    const list = byCity.get(key);
    if (list) list.push(p);
    else byCity.set(key, [p]);
  }

  const orderedKeys: string[] = [];
  const seen = new Set<string>();

  // 1. Orden canónico del admin (`cities_ordered`)
  for (const c of citiesOrdered ?? []) {
    const key = (c || "").trim();
    if (byCity.has(key) && !seen.has(key)) {
      orderedKeys.push(key);
      seen.add(key);
    }
  }
  // 2. Cualquier ciudad presente en paquetes pero NO en cities_ordered
  for (const key of byCity.keys()) {
    if (!seen.has(key)) {
      orderedKeys.push(key);
      seen.add(key);
    }
  }

  // 3. Mover "Sin ciudad" al final
  const out: CityGroup[] = [];
  const noCityKey = "";
  for (const key of orderedKeys) {
    if (key === noCityKey) continue;
    out.push({ city: key, packages: byCity.get(key)! });
  }
  if (byCity.has(noCityKey)) {
    out.push({ city: "", packages: byCity.get(noCityKey)! });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Split modal (P1/P2)
// ─────────────────────────────────────────────────────────────

function SplitModal({
  od,
  pkg,
  onClose,
}: {
  od: DispatchOrderRow;
  pkg: DispatchOrderRow["packages"][number];
  onClose: () => void;
}) {
  const toast = useToast();
  const [boxes, setBoxes] = useState(Math.max(1, Math.floor(pkg.boxes_total / 2)));
  const [reason, setReason] = useState<DispatchSplitReason>("falta_volumen");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Submit offline-aware: si la action tira por red, encolamos el split para
  // reintento automático (SplitQueueRetryRunner). La idempotencia de la DB
  // (migr 0184, P0013) evita un fraccionamiento duplicado si el original sí
  // entró pero la respuesta se perdió.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (reason === "otro" && !reasonText.trim()) {
      setError("Indica un motivo libre para 'Otro'.");
      return;
    }
    setError(null);
    setPending(true);

    const fd = new FormData();
    fd.set("od_id", od.id);
    fd.set("package_id", pkg.package_id);
    fd.set("boxes_shipped", String(boxes));
    fd.set("split_reason", reason);
    fd.set("split_reason_text", reasonText);

    try {
      const res = await splitPackageP2Action(INITIAL, fd);
      if (res.fieldErrors) {
        setError(Object.values(res.fieldErrors)[0] ?? "Datos inválidos.");
        setPending(false);
        return;
      }
      if (res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      // OK · revalidatePath en la action refresca la cola del bodeguero.
      toast.success("Paquete fraccionado · P2 en bodega ✓");
      onClose();
    } catch {
      enqueueSplit({
        localId: makeSplitLocalId(pkg.package_id),
        odId: od.id,
        odCode: od.order_code,
        packageId: pkg.package_id,
        markbox: pkg.markbox,
        boxesShipped: boxes,
        splitReason: reason,
        splitReasonText: reasonText.trim() || null,
        queuedAt: Date.now(),
      });
      toast.info("Sin señal · el fraccionamiento se hará solo al volver la conexión.");
      onClose();
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "var(--r-lg) var(--r-lg) 0 0",
          padding: "20px 18px calc(env(safe-area-inset-bottom) + 18px)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border-strong)",
            borderRadius: 999,
            margin: "0 auto 14px",
          }}
        />
        <div
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            marginBottom: 4,
          }}
        >
          Fraccionar paquete
        </div>
        <div
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginBottom: 14,
          }}
        >
          <code style={{ color: "var(--wine)" }}>{pkg.markbox}</code> · {pkg.client_name} · {pkg.boxes_total} cajas
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="studio-label">
              Cajas P1 (sale ahora) · {boxes} de {pkg.boxes_total}
            </label>
            <input
              type="range"
              min={1}
              max={pkg.boxes_total - 1}
              value={boxes}
              onChange={(e) => setBoxes(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--wine)", marginTop: 8 }}
            />
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "6px 0 0",
              }}
            >
              P2 queda en bodega: {pkg.boxes_total - boxes} cajas (OD nueva en `creada`).
            </p>
          </div>

          <div>
            <label className="studio-label" htmlFor="split-reason">
              Motivo
            </label>
            <select
              id="split-reason"
              className="studio-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as DispatchSplitReason)}
              style={{ marginTop: 6 }}
            >
              {(Object.keys(DISPATCH_SPLIT_REASON_LABELS) as DispatchSplitReason[]).map((r) => (
                <option key={r} value={r}>
                  {DISPATCH_SPLIT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {reason === "otro" && (
            <div>
              <label className="studio-label" htmlFor="split-text">
                Especifica
              </label>
              <input
                id="split-text"
                className="studio-input"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Ej: cliente pidió postergar"
                style={{ marginTop: 6 }}
              />
            </div>
          )}

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={pending}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={pending}
              style={{ flex: 2 }}
            >
              {pending ? "Fraccionando…" : "Confirmar P1/P2"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: 10,
        background: "var(--danger-bg)",
        color: "var(--danger)",
        borderRadius: "var(--r-sm)",
        font: "600 12.5px/1.4 var(--f-sans)",
      }}
    >
      {msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sprint 2 · LoadModeToggle (LIFO / FIFO)
// ─────────────────────────────────────────────────────────────

function LoadModeToggle({
  mode,
  onChange,
}: {
  mode: LoadMode;
  onChange: (m: LoadMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Modo de visualización: cargar (LIFO) o despachar (FIFO)"
      style={{
        display: "flex",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-pill)",
        padding: 3,
        gap: 2,
      }}
    >
      {(["cargar", "despachar"] as LoadMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 999,
              border: "none",
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-soft)",
              font: "700 12px/1 var(--f-sans)",
              cursor: "pointer",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              transition: "background var(--dur) var(--ease), color var(--dur) var(--ease)",
            }}
          >
            {m === "cargar" ? "Cargar (LIFO)" : "Despachar (FIFO)"}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sprint 2 · CapacityBar
// ─────────────────────────────────────────────────────────────

function CapacityBar({
  label,
  used,
  total,
  unit,
  pct,
  overflow,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  pct: number;
  overflow: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = overflow
    ? "var(--danger)"
    : pct > 90
      ? "var(--warning)"
      : "var(--success)";
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          font: "600 10.5px/1 var(--f-mono)",
          color: "var(--ink-inv-soft)",
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span>
          {used.toFixed(0)}/{total.toFixed(0)} {unit} · {pct.toFixed(0)}%
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "var(--border-inv)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            background: color,
            transition: "width var(--dur) var(--ease)",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sprint 2 · ReassignModal (truck / driver runtime)
// ─────────────────────────────────────────────────────────────

function ReassignModal({
  od,
  trucks,
  drivers,
  onClose,
}: {
  od: DispatchOrderRow;
  trucks: AvailableTruck[];
  drivers: AvailableDriver[];
  onClose: () => void;
}) {
  const [truckId, setTruckId] = useState<string | "">(od.truck_id ?? "");
  const [driverId, setDriverId] = useState<string | "">(od.driver_id ?? "");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const truckChanged = truckId !== "" && truckId !== (od.truck_id ?? "");
  const driverChanged = driverId !== "" && driverId !== (od.driver_id ?? "");
  const hasChange = truckChanged || driverChanged;

  // Validación capacidad client-side cuando cambia el truck
  const selectedTruck = trucks.find((t) => t.id === truckId);
  let capacityWarning: string | null = null;
  if (selectedTruck) {
    const cap = {
      capacity_kg: Number(selectedTruck.capacity_kg ?? 0),
      capacity_cbm: Number(selectedTruck.capacity_cbm ?? 0),
    };
    if (cap.capacity_kg > 0 && cap.capacity_cbm > 0) {
      const u = computeCapacity(od.packages, cap);
      if (u.overflow) {
        capacityWarning = `Capacidad insuficiente · ${u.kg_pct.toFixed(0)}% peso · ${u.cbm_pct.toFixed(0)}% volumen.`;
      }
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const r = await reassignOdAction({
      od_id: od.id,
      truck_id: truckChanged ? truckId : null,
      driver_id: driverChanged ? driverId : null,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onClose();
  }

  return (
    <div
      onClick={submitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "var(--r-lg) var(--r-lg) 0 0",
          padding: "20px 18px calc(env(safe-area-inset-bottom) + 18px)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border-strong)",
            borderRadius: 999,
            margin: "0 auto 14px",
          }}
        />
        <h2
          id="reassign-title"
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            margin: "0 0 6px",
          }}
        >
          Reasignar camión / chofer
        </h2>
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 14px",
          }}
        >
          <code style={{ color: "var(--wine)" }}>{od.order_code}</code> · cambia
          truck o driver del OD activo. Acción destructiva · el camionero
          original deja de ver esta entrega.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="reassign-truck">
              Camión
            </label>
            <select
              id="reassign-truck"
              className="studio-input"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              disabled={submitting}
              style={{ marginTop: 6 }}
            >
              <option value="">— sin cambio —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} {t.brand ?? ""} ·{" "}
                  {t.capacity_cbm ?? "?"}m³ · {t.capacity_kg ?? "?"}kg
                </option>
              ))}
            </select>
            {capacityWarning && (
              <div
                style={{
                  marginTop: 6,
                  padding: 8,
                  background: "var(--warning-bg)",
                  color: "var(--warning)",
                  border: "1px solid var(--warning)",
                  borderRadius: "var(--r-sm)",
                  font: "600 11.5px/1.3 var(--f-sans)",
                }}
              >
                {capacityWarning}
              </div>
            )}
          </div>

          <div>
            <label className="studio-label" htmlFor="reassign-driver">
              Chofer
            </label>
            <select
              id="reassign-driver"
              className="studio-input"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              disabled={submitting}
              style={{ marginTop: 6 }}
            >
              <option value="">— sin cambio —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.hub_code ? ` · ${d.hub_code}` : ""}
                  {d.rating != null ? ` · ${d.rating.toFixed(1)}★` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="studio-label" htmlFor="reassign-reason">
              Motivo (opcional)
            </label>
            <textarea
              id="reassign-reason"
              className="studio-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: camión X rompió · chofer Y no llegó"
              rows={2}
              disabled={submitting}
              style={{ marginTop: 6, resize: "vertical" }}
            />
          </div>

          {error && <ErrorBanner msg={error} />}

          {!confirm ? (
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                onClick={onClose}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-warning"
                onClick={() => setConfirm(true)}
                disabled={!hasChange || submitting}
                style={{ flex: 2 }}
              >
                Reasignar
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: 6,
                padding: 12,
                background: "var(--warning-bg)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div
                style={{
                  font: "700 12.5px/1.3 var(--f-sans)",
                  color: "var(--warning)",
                  marginBottom: 8,
                }}
              >
                ¿Confirmas la reasignación? Acción destructiva.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setConfirm(false)}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  Atrás
                </button>
                <ActionButton
                  variant="warning"
                  size="sm"
                  idleLabel="Sí, reasignar"
                  loadingLabel="Reasignando…"
                  successLabel="Reasignado"
                  onAction={async () => {
                    await handleSubmit();
                    return undefined;
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
