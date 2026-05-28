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

import { useActionState, useEffect, useMemo, useState } from "react";
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
  signOutAction,
  splitPackageP2Action,
} from "../actions";
import { switchModeAction } from "../../modos/actions";
import {
  DISPATCH_ORDER_STATUS_LABELS,
  DISPATCH_ORDER_STATUS_TONES,
  DISPATCH_SPLIT_REASON_LABELS,
  type DispatchOrderRow,
  type DispatchSplitReason,
} from "@/lib/studio/dispatch-types";
import { tierLabel, tierBadgeTone, type ClientTier } from "@/lib/studio/client-types";
import type { MobileActionState } from "@/lib/studio/dispatch-mobile-types";
import type { OperarioRole } from "@/lib/studio/operario-types";

const INITIAL: MobileActionState = {};

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
}

export function BodegueroClient({ operario, ods, tenantId }: Props) {
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
      <Header
        operario={operario}
        realtimeStatus={realtime.status}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMultiRole={operario.roles.length > 1}
      />

      {selected ? (
        <OdDetail od={selected} onBack={() => setSelectedOdId(null)} />
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
          Bodeguero · DTD
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
          Cuando el admin asigne ODs nuevas las vas a ver acá. Refrescá la
          pantalla para chequear.
        </p>
      </div>
    );
  }

  return (
    <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
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
                color: "var(--ink-mute)",
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

function OdDetail({ od, onBack }: { od: DispatchOrderRow; onBack: () => void }) {
  const [splitForId, setSplitForId] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

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
  const groupedByCity = useMemo(() => {
    return groupPackagesByCity(od.packages, od.cities_ordered);
  }, [od.packages, od.cities_ordered]);

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
      </div>

      {/* Stops grouped by city · Sprint G (handoff v1.7) */}
      <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
        Paradas · {groupedByCity.length} ciudades · {od.packages.length} paquetes
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
                  color: "var(--ink-mute)",
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
}: {
  pkg: DispatchOrderRow["packages"][number];
  odStatus: DispatchOrderRow["status"];
  onRequestSplit: () => void;
}) {
  const isPartial = pkg.boxes_shipped < pkg.boxes_total;
  const tier: ClientTier | null = pkg.client_tier ?? null;
  const phone = pkg.client_phone ?? null;
  const phoneClean = phone ? phone.replace(/[^\d+]/g, "") : null;

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

      {pkg.description && (
        <div
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
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
  const [boxes, setBoxes] = useState(Math.max(1, Math.floor(pkg.boxes_total / 2)));
  const [reason, setReason] = useState<DispatchSplitReason>("falta_volumen");
  const [reasonText, setReasonText] = useState("");

  const [state, formAction, isPending] = useActionState(splitPackageP2Action, INITIAL);

  // M1 fix: setTimeout fuera del render body para evitar leaks en cada render
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 100);
      return () => clearTimeout(t);
    }
  }, [state?.ok, onClose]);

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

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="od_id" value={od.id} />
          <input type="hidden" name="package_id" value={pkg.package_id} />
          <input type="hidden" name="boxes_shipped" value={boxes} />
          <input type="hidden" name="split_reason" value={reason} />
          <input type="hidden" name="split_reason_text" value={reasonText} />

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
                color: "var(--ink-mute)",
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
                Especificá
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

          {state?.error && <ErrorBanner msg={state.error} />}
          {state?.fieldErrors?.boxes_shipped && (
            <ErrorBanner msg={state.fieldErrors.boxes_shipped} />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={isPending}
              style={{ flex: 2 }}
            >
              {isPending ? "Fraccionando…" : "Confirmar P1/P2"}
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
