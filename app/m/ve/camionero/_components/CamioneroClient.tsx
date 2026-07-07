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
 *
 * Sprint G (handoff v1.7): wrapper data-theme="dark" por default (per-rol),
 * SettingsMenu con toggle sun/moon, ActionButton en "Iniciar ruta",
 * numeración paradas 1/N.
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { RealtimeIndicator } from "@/app/studio/_components/ui/RealtimeIndicator";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";
import {
  SettingsMenu,
  useThemeMode,
  type ThemeMode,
} from "@/app/m/_components/SettingsMenu";
import { advanceOdAction, signOutAction } from "../actions";
import { switchModeAction } from "../../modos/actions";
import { PodModal } from "./PodModal";
import { CurrentDelivery } from "./CurrentDelivery";
import { GpsBlock, GpsLiveProvider } from "./GpsBlock";
import { PodRetryRunner } from "./PodRetryRunner";
import {
  DISPATCH_ORDER_STATUS_LABELS,
  DISPATCH_ORDER_STATUS_TONES,
  type DispatchOrderRow,
} from "@/lib/studio/dispatch-types";
import type { OperarioRole } from "@/lib/studio/operario-types";
import { useRouter } from "next/navigation";

interface Props {
  operario: {
    operario_id: string;
    displayName: string;
    firstName: string;
    initials: string;
    /** Sprint D · multi-rol. Si length > 1, header muestra "Cambiar modo". */
    roles: OperarioRole[];
  };
  ods: DispatchOrderRow[];
  tenantId: string;
  /** Sprint 3 · markbox → signed URL del bucket client-facades (10min). */
  facadeSignedUrls: Record<string, string>;
}

export function CamioneroClient({
  operario,
  ods,
  tenantId,
  facadeSignedUrls,
}: Props) {
  const router = useRouter();
  const [activeOdId, setActiveOdId] = useState<string | null>(ods[0]?.id ?? null);
  const [podOpen, setPodOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useThemeMode("camionero");

  const activeOd = ods.find((o) => o.id === activeOdId);

  // Realtime: refresh cuando el admin cambia la asignación o status de OD.
  const realtime = useRealtimeRefresh({
    table: "dispatch_orders",
    filter: `tenant_id=eq.${tenantId}`,
  });

  return (
    <GpsLiveProvider>
    {/* Sprint 3.5 · reintenta PODs que quedaron offline */}
    <PodRetryRunner />
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
              facadeSignedUrls={facadeSignedUrls}
              onRefresh={() => router.refresh()}
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
    </GpsLiveProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Header
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
          Transportista · DTD
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
        salir. Refresca para chequear.
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
  facadeSignedUrls,
  onRefresh,
}: {
  od: DispatchOrderRow;
  onOpenPod: () => void;
  facadeSignedUrls: Record<string, string>;
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  // Sprint 3: partial-delivery + currentDelivery
  const totalPkgs = od.packages.length;
  const pendingPkgs = od.packages.filter(
    (p) => (p.delivery_status ?? "pendiente") === "pendiente",
  );
  const completedCount = totalPkgs - pendingPkgs.length;
  const allDone = pendingPkgs.length === 0 && totalPkgs > 0;
  const currentIdx = od.packages.findIndex(
    (p) => (p.delivery_status ?? "pendiente") === "pendiente",
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
          <span>
            {completedCount}/{totalPkgs} entregadas
          </span>
          <span>{od.total_kg.toFixed(0)} kg</span>
          <span>{od.total_cbm.toFixed(1)} cbm</span>
        </div>
      </div>

      {/* GPS Live Block (Sprint 3) */}
      {od.status === "en_ruta" && <GpsBlock />}

      {/* Current Delivery + paquetes restantes */}
      {od.status === "en_ruta" && pendingPkgs.length > 0 && (
        <>
          <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Próxima entrega · {currentIdx + 1}/{totalPkgs}
          </div>
          {od.packages.map((p, idx) => {
            const status = p.delivery_status ?? "pendiente";
            const isPending = status === "pendiente";
            // Render expandido el primer pendiente, los demás compactos
            const isCurrent = idx === currentIdx;
            return (
              <CurrentDelivery
                key={p.package_id}
                pkg={p}
                odId={od.id}
                facadeSignedUrl={facadeSignedUrls[p.markbox] ?? null}
                position={idx + 1}
                total={totalPkgs}
                readOnly={!isCurrent && !isPending}
                onRefresh={onRefresh}
              />
            );
          })}
        </>
      )}

      {/* Si status es lista, lista compacta de packages */}
      {od.status === "lista" && (
        <>
          <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            {totalPkgs} paradas · arranca cuando estés listo
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {od.packages.map((p, idx) => (
              <div
                key={p.package_id}
                style={{
                  padding: 10,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "var(--r-pill)",
                    background:
                      idx === 0 ? "var(--wine-tint)" : "var(--bg-elevated)",
                    color: idx === 0 ? "var(--wine)" : "var(--ink-soft)",
                    font: "800 11px/1 var(--f-mono)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border:
                      idx === 0
                        ? "1px solid var(--wine)"
                        : "1px solid var(--border)",
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "700 12.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {p.client_name}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {p.city}
                  </div>
                </div>
                <code
                  style={{
                    font: "700 11px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {p.boxes_shipped} cj
                </code>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      {od.status === "lista" && (
        <div style={{ marginTop: 8 }}>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Iniciar ruta"
            loadingLabel="Iniciando…"
            successLabel="Ruta iniciada"
            onAction={async () => {
              setError(null);
              const fd = new FormData();
              fd.append("od_id", od.id);
              fd.append("status", "en_ruta");
              const result = await advanceOdAction({}, fd);
              if (result?.error) return { error: result.error };
              return undefined;
            }}
            onError={setError}
          />
        </div>
      )}

      {od.status === "en_ruta" && allDone && (
        <button
          type="button"
          onClick={onOpenPod}
          className="studio-btn studio-btn-primary"
          style={{ width: "100%", height: 52, fontSize: 14, marginTop: 8 }}
        >
          Cerrar ruta · POD final
        </button>
      )}

      {od.status === "en_ruta" && !allDone && (
        <div
          style={{
            padding: 10,
            background: "var(--bg-elevated)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--r-sm)",
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
          }}
        >
          Marca cada parada como entregada / rechazada / retornada arriba.
          Cuando termines, podrás cerrar la ruta con el POD final.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 10,
            background: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "600 12.5px/1.4 var(--f-sans)",
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}
