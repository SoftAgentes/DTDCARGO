"use client";

/**
 * ReceptionScanClient — pantalla de scan del receipt VE (Sprint E · plan v3).
 *
 * Layout:
 *  - Hero (ink background): progress recibidas X/Y + CBM acumulado.
 *  - QR scanner + manual entry input.
 *  - Lista de cajas agrupadas por cliente (collapse default si > 12 cajas).
 *  - Sticky footer: botón "Sellar recepción".
 *
 * Correcciones vs handoff `bodeguero.jsx:569-730`:
 *  - Confirm modal cuando se sella con N faltantes (handoff no lo tenía).
 *  - Grid por cliente con collapse default si boxes > 12 (handoff colapsaba
 *    siempre, perdiendo visibility en receipts chicos).
 *  - prefers-reduced-motion en la scan line del QrScanner (WCAG 2.3.3).
 *  - Tokens var(--*) en lugar de hex hardcoded.
 *  - Sin emojis decorativos (handoff usaba 🚢 / 📦).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { RealtimeIndicator } from "@/app/studio/_components/ui/RealtimeIndicator";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";
import { QrScanner } from "@/app/m/_components/QrScanner";
import { scanBoxAction, sealReceiptAction } from "../actions";
import {
  computeReceiptProgress,
  groupBoxesByClient,
  RECEIPT_VE_STATUS_LABELS,
  RECEIPT_VE_STATUS_TONES,
  type WarehouseReceiptVeWithBoxes,
} from "@/lib/studio/warehouse-receipt-ve-types";

interface Props {
  receipt: WarehouseReceiptVeWithBoxes;
  tenantId: string;
  operario: {
    operario_id: string;
    firstName: string;
  };
}

const COLLAPSE_THRESHOLD = 12;

export function ReceptionScanClient({ receipt, tenantId, operario }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [confirmIncident, setConfirmIncident] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");

  // Realtime: si otro bodeguero escanea cajas del mismo receipt, refresh.
  const realtime = useRealtimeRefresh({
    table: "warehouse_receipt_ve_boxes",
    filter: `receipt_id=eq.${receipt.id}`,
  });

  void tenantId; // referenciado pero el query ya filtró por tenant

  const progress = useMemo(() => computeReceiptProgress(receipt.boxes), [receipt.boxes]);
  const groups = useMemo(() => groupBoxesByClient(receipt.boxes), [receipt.boxes]);
  const totalCbmExpected = useMemo(() => {
    let sum = 0;
    for (const b of receipt.boxes) sum += Number(b.cbm ?? 0);
    return sum;
  }, [receipt.boxes]);

  const isSealed = receipt.status === "sellado" || receipt.status === "con_incidencia";
  const isReady = progress.scanned > 0;
  const missing = progress.expected - progress.scanned;

  const handleScan = useCallback(
    async (code: string, source: "camera" | "manual") => {
      const result = await scanBoxAction(receipt.id, code, source === "manual");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Caja ${code} ✓`, { durationMs: 1200 });
      router.refresh();
    },
    [receipt.id, toast, router],
  );

  async function handleSeal(force: boolean) {
    setSealing(true);
    setSealError(null);
    const r = await sealReceiptAction(receipt.id, {
      force,
      incidentNote: force ? incidentNote || null : null,
    });
    setSealing(false);
    if (r.error) {
      setSealError(r.error);
      return;
    }
    const finalStatus = r.resultingStatus ?? "sellado";
    toast.success(
      finalStatus === "con_incidencia"
        ? `Sellado con incidencia · ${r.scannedCount}/${r.expectedCount}`
        : `Sellado · ${r.scannedCount}/${r.expectedCount} cajas`,
      {
        link: { href: "/m/ve/bodeguero/recepcion", label: "Volver a recepción" },
      },
    );
    router.push("/m/ve/bodeguero/recepcion");
  }

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
      {/* Header */}
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
        <div style={{ minWidth: 0 }}>
          <Link
            href="/m/ve/bodeguero/recepcion"
            style={{
              font: "600 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              textDecoration: "none",
            }}
          >
            ← Lista
          </Link>
          <div
            style={{
              font: "900 16px/1.1 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              marginTop: 4,
            }}
          >
            {receipt.receipt_code}
          </div>
        </div>
        <RealtimeIndicator status={realtime.status} />
      </header>

      <main
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Hero progress (ink bg) */}
        <section
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
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--wine-soft)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                {receipt.vessel ?? "Sin vessel"}
                {receipt.container_code && ` · ${receipt.container_code}`}
              </div>
            </div>
            <Badge tone={RECEIPT_VE_STATUS_TONES[receipt.status]} size="sm">
              {RECEIPT_VE_STATUS_LABELS[receipt.status]}
            </Badge>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 6,
            }}
          >
            <div>
              <div
                style={{
                  font: "900 32px/1 var(--f-display)",
                  letterSpacing: "-0.02em",
                }}
              >
                {progress.scanned}
                <span
                  style={{
                    font: "700 16px/1 var(--f-display)",
                    color: "var(--ink-inv-soft)",
                  }}
                >
                  {" / "}
                  {progress.expected}
                </span>
              </div>
              <div
                style={{
                  font: "500 11.5px/1.2 var(--f-sans)",
                  color: "var(--ink-inv-soft)",
                  marginTop: 4,
                }}
              >
                Cajas recibidas
              </div>
            </div>
            <div>
              <div
                style={{
                  font: "900 24px/1 var(--f-display)",
                  letterSpacing: "-0.02em",
                }}
              >
                {progress.scannedCbm.toFixed(1)}
                <span
                  style={{
                    font: "700 14px/1 var(--f-display)",
                    color: "var(--ink-inv-soft)",
                  }}
                >
                  {" / "}
                  {totalCbmExpected.toFixed(1)} m³
                </span>
              </div>
              <div
                style={{
                  font: "500 11.5px/1.2 var(--f-sans)",
                  color: "var(--ink-inv-soft)",
                  marginTop: 4,
                }}
              >
                CBM escaneado
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              marginTop: 14,
              height: 6,
              background: "var(--border-inv)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress.pct}%`,
                height: "100%",
                background:
                  progress.pct === 100
                    ? "var(--success)"
                    : "var(--wine-soft)",
                transition: "width var(--dur) var(--ease)",
              }}
            />
          </div>
        </section>

        {/* QR Scanner */}
        {!isSealed && (
          <section
            style={{
              padding: 14,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              className="studio-eyebrow"
              style={{ color: "var(--ink-soft)", marginBottom: 10 }}
            >
              Escanear caja
            </div>
            <QrScanner
              onDetected={handleScan}
              placeholder="DTDU-2026-0042"
              hint={
                missing > 0
                  ? `Faltan ${missing} caja${missing === 1 ? "" : "s"}`
                  : "Todas las cajas escaneadas · puedes sellar"
              }
            />
          </section>
        )}

        {/* Cajas agrupadas por cliente */}
        <section>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--ink-soft)", marginBottom: 8 }}
          >
            Cajas · {groups.length} clientes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.map((g) => (
              <ClientGroup key={g.markbox} group={g} />
            ))}
          </div>
        </section>
      </main>

      {/* Sticky footer · Sellar */}
      {!isSealed && (
        <footer
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border)",
            padding: "12px 16px calc(env(safe-area-inset-bottom) + 12px)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {sealError && (
            <div
              role="alert"
              style={{
                padding: 10,
                background: "var(--danger-bg)",
                color: "var(--danger)",
                borderRadius: "var(--r-sm)",
                font: "600 12.5px/1.4 var(--f-sans)",
              }}
            >
              {sealError}
            </div>
          )}
          <ActionButton
            variant="primary"
            size="default"
            idleLabel={
              missing === 0
                ? "Sellar recepción"
                : `Sellar · faltan ${missing}`
            }
            loadingLabel="Sellando…"
            successLabel="Sellado"
            disabled={!isReady || sealing}
            onAction={async () => {
              setSealError(null);
              if (missing > 0) {
                // Forzar confirm modal — no llamamos al action acá
                setConfirmIncident(true);
                return { error: undefined as unknown as string };
              }
              await handleSeal(false);
              return undefined;
            }}
            onError={setSealError}
          />
        </footer>
      )}

      {/* Confirm incidencia modal */}
      {confirmIncident && (
        <ConfirmIncidentModal
          missing={missing}
          incidentNote={incidentNote}
          onIncidentNoteChange={setIncidentNote}
          onCancel={() => {
            setConfirmIncident(false);
            setIncidentNote("");
          }}
          onConfirm={async () => {
            setConfirmIncident(false);
            await handleSeal(true);
          }}
          submitting={sealing}
          operarioFirstName={operario.firstName}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ClientGroup · grid por cliente con collapse default si > 12
// ─────────────────────────────────────────────────────────────

function ClientGroup({
  group,
}: {
  group: ReturnType<typeof groupBoxesByClient>[number];
}) {
  const shouldCollapse = group.boxes.length > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(shouldCollapse);
  const totalScanned = group.scannedCount;
  const totalCount = group.boxes.length;
  const fullyDone = totalScanned === totalCount;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${fullyDone ? "var(--success)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => shouldCollapse && setCollapsed((v) => !v)}
        disabled={!shouldCollapse}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          textAlign: "left",
          padding: 12,
          background: fullyDone ? "var(--success-bg)" : "transparent",
          border: "none",
          cursor: shouldCollapse ? "pointer" : "default",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <code
            style={{
              font: "800 12px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            {group.markbox}
          </code>
          <div
            style={{
              font: "700 13px/1.2 var(--f-sans)",
              color: "var(--ink)",
              marginTop: 4,
            }}
          >
            {group.client_name}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <code
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: fullyDone ? "var(--success)" : "var(--ink-soft)",
            }}
          >
            {totalScanned}/{totalCount}
          </code>
          {shouldCollapse && (
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              style={{
                transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform var(--dur) var(--ease)",
                color: "var(--ink-mute)",
              }}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </button>

      {!collapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 6,
            padding: 10,
            borderTop: "1px solid var(--border)",
          }}
        >
          {group.boxes.map((b) => (
            <div
              key={b.id}
              style={{
                padding: "8px 10px",
                background: b.scanned_at ? "var(--success-bg)" : "var(--bg-elevated)",
                border: `1px solid ${b.scanned_at ? "var(--success)" : "var(--border)"}`,
                borderRadius: "var(--r-sm)",
                font: "700 10.5px/1.2 var(--f-mono)",
                color: b.scanned_at ? "var(--success)" : "var(--ink-soft)",
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {b.code}
              {b.cbm != null && (
                <div
                  style={{
                    font: "500 10px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  {Number(b.cbm).toFixed(2)} m³
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ConfirmIncidentModal
// ─────────────────────────────────────────────────────────────

function ConfirmIncidentModal({
  missing,
  incidentNote,
  onIncidentNoteChange,
  onCancel,
  onConfirm,
  submitting,
  operarioFirstName,
}: {
  missing: number;
  incidentNote: string;
  onIncidentNoteChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
  operarioFirstName: string;
}) {
  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-incident-title"
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
        <h2
          id="confirm-incident-title"
          style={{
            font: "900 18px/1.2 var(--f-display)",
            color: "var(--ink)",
            margin: "0 0 8px",
          }}
        >
          Sellar con incidencia
        </h2>
        <p
          style={{
            font: "500 13px/1.45 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 14px",
          }}
        >
          {operarioFirstName}, estás por sellar el receipt con{" "}
          <strong style={{ color: "var(--danger)" }}>
            {missing} caja{missing === 1 ? "" : "s"} sin escanear
          </strong>
          . El supervisor revisa los faltantes después. ¿Confirmas?
        </p>

        <label
          className="studio-label"
          htmlFor="incident-note-input"
          style={{ display: "block", marginBottom: 6 }}
        >
          Nota de incidencia (opcional)
        </label>
        <textarea
          id="incident-note-input"
          value={incidentNote}
          onChange={(e) => onIncidentNoteChange(e.target.value)}
          placeholder="Ej: 3 cajas dañadas · 2 falta sleeve, 1 sin etiqueta"
          rows={3}
          className="studio-input"
          style={{ width: "100%", resize: "vertical", marginBottom: 12 }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onCancel}
            disabled={submitting}
            style={{ flex: 1 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-danger"
            onClick={onConfirm}
            disabled={submitting}
            style={{ flex: 2 }}
          >
            {submitting ? "Sellando…" : "Sí, sellar con incidencia"}
          </button>
        </div>
      </div>
    </div>
  );
}
