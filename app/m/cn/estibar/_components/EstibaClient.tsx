"use client";

/**
 * SDD-0155 · Estibar por lotes (operario CN).
 *
 * Flujo: escanear UNA caja → "es un lote de 12" → elegir Izq/Centro/Der (+ ajustar
 * la cantidad si es lote partido) → montar las 12 de un golpe. La posición a lo
 * largo la da el orden de carga (la primera al fondo); el operario NO la elige.
 *
 * Reemplaza el tapeo caja-por-caja de 1-de-18-zonas de SDD-0152: en el galpón, con
 * guantes y apurado, montar el lote entero con un escaneo es lo que pidió el founder.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrScanner } from "@/app/m/_components/QrScanner";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { LOT_WIDTH_LABELS } from "@/lib/studio/naviera/zones";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import {
  lookupLotAction,
  stuffLotAction,
  unstuffLotAction,
  type LotLookup,
} from "../actions";

type Props = {
  consolidationId: string;
  consolidationRef: string;
  containerLabel: string;
  containerNo: string | null;
  status: string;
  initialStuffedCount: number;
  lotsCount: number;
};

export function EstibaClient({
  consolidationId,
  consolidationRef,
  containerLabel,
  containerNo,
  status,
  initialStuffedCount,
  lotsCount,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [scanning, setScanning] = useState(false);
  const [lot, setLot] = useState<LotLookup | null>(null);
  const [count, setCount] = useState<string>("");
  const [width, setWidth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stuffedCount, setStuffedCount] = useState(initialStuffedCount);
  const [lots, setLots] = useState(lotsCount);
  const [busy, setBusy] = useState(false);

  const closed = status !== "consolidando";

  function reset() {
    setLot(null);
    setCount("");
    setWidth(null);
    setError(null);
  }

  async function onDetected(raw: string) {
    const parsed = parseScannedLabel(raw);
    if (parsed.kind === "verify_url") {
      setScanning(false);
      setError(
        `Esa es la etiqueta del proveedor (${parsed.markbox}) · identifica al cliente, no a la caja. Escanea la etiqueta DTD-B del hub.`,
      );
      return;
    }
    if (parsed.kind !== "box_code") {
      setScanning(false);
      setError("No reconozco ese código · escanea la etiqueta DTD-B del hub.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await lookupLotAction(parsed.code);
    setBusy(false);
    setScanning(false);
    if (!res.found) {
      setError(res.error);
      return;
    }
    setLot(res);
    setCount(String(res.lotSize));
    setWidth(null);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-sidebar)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-inv)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Link
            href="/m/cn"
            style={{
              font: "600 10px/1.4 var(--f-sans)",
              color: "var(--ink-side-soft)",
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            ← Mi día
          </Link>
          <div
            style={{
              font: "800 13px/1.3 var(--f-sans)",
              color: "var(--ink-side-strong)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Estibar · {consolidationRef}
          </div>
          <div style={{ font: "500 10px/1.3 var(--f-sans)", color: "var(--ink-side-soft)" }}>
            {containerLabel}
            {containerNo ? ` · ${containerNo}` : ""}
          </div>
        </div>
        <div
          style={{
            font: "700 13px/1 var(--f-mono)",
            color: "var(--ink-side-strong)",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            textAlign: "right",
          }}
          aria-label={`${stuffedCount} cajas montadas en ${lots} lotes`}
        >
          {stuffedCount}
          <span style={{ color: "var(--ink-side-soft)", font: "500 10px/1 var(--f-sans)" }}>
            {" "}
            cajas · {lots} {lots === 1 ? "lote" : "lotes"}
          </span>
        </div>
      </header>

      {closed && (
        <p
          style={{
            margin: 14,
            padding: "10px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg-strong)",
            border: "1px solid var(--danger-border)",
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--ink-side-strong)",
          }}
        >
          Este contenedor está {status} · ya no admite carga.
        </p>
      )}

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              background: "var(--danger-bg-strong)",
              border: "1px solid var(--danger-border)",
              font: "600 12px/1.4 var(--f-sans)",
              color: "var(--ink-side-strong)",
            }}
          >
            {error}
          </p>
        )}

        {/* Escanear */}
        {scanning ? (
          <QrScanner
            placeholder="DTD-B-000123"
            manualLabel="Escribir el código de la caja"
            hint={busy ? "Buscando el lote…" : "Escanea una caja del lote."}
            onDetected={onDetected}
            onClose={() => setScanning(false)}
          />
        ) : !lot ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setScanning(true);
            }}
            disabled={closed}
            style={{
              border: "1.5px dashed var(--border-inv)",
              borderRadius: "var(--r-md)",
              padding: 22,
              background: "var(--surface-inv-soft)",
              color: "var(--ink-side)",
              font: "800 14px/1.3 var(--f-sans)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: closed ? "not-allowed" : "pointer",
              opacity: closed ? 0.5 : 1,
              minHeight: 64,
            }}
          >
            {Icon.search(18)} Escanear una caja del lote
          </button>
        ) : (
          <LotCard
            lot={lot}
            count={count}
            setCount={setCount}
            width={width}
            setWidth={setWidth}
            onCancel={reset}
            onConfirm={async () => {
              if (width == null) return { error: "Elige izquierda, centro o derecha." };
              const cnt = count.trim() === "" ? null : Number(count);
              const res = await stuffLotAction(consolidationId, lot.boxCode, width, cnt);
              if (!res.ok) return { error: res.error ?? "Error" };
              setStuffedCount((n) => n + (res.stuffed ?? 0));
              setLots((n) => n + 1);
              toast.success(
                `Lote montado · ${res.stuffed} ${res.stuffed === 1 ? "caja" : "cajas"}${
                  res.remaining && res.remaining > 0 ? ` · quedan ${res.remaining}` : ""
                }`,
              );
              reset();
              router.refresh();
              return undefined;
            }}
          />
        )}

        {/* Deshacer el último lote */}
        {!lot && lots > 0 && !closed && (
          <ActionButton
            variant="ghost"
            size="sm"
            idleLabel="Deshacer el último lote"
            loadingLabel="Deshaciendo…"
            successLabel="Lote deshecho"
            onAction={async () => {
              const res = await unstuffLotAction(consolidationId);
              if (!res.ok) return { error: res.error };
              setStuffedCount((n) => Math.max(0, n - (res.stuffed ?? 0)));
              setLots((n) => Math.max(0, n - 1));
              toast.success(`Lote deshecho · ${res.stuffed} cajas vuelven al almacén`);
              router.refresh();
              return undefined;
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function LotCard({
  lot,
  count,
  setCount,
  width,
  setWidth,
  onCancel,
  onConfirm,
}: {
  lot: LotLookup;
  count: string;
  setCount: (v: string) => void;
  width: number | null;
  setWidth: (w: number) => void;
  onCancel: () => void;
  onConfirm: () => Promise<{ error: string } | undefined>;
}) {
  const partial = count.trim() !== "" && Number(count) < lot.lotSize;
  return (
    <div
      style={{
        background: "var(--surface-inv)",
        border: "1px solid var(--border-inv)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--wine)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Lote de {lot.lotSize} {lot.lotSize === 1 ? "caja" : "cajas"}
      </div>
      <div style={{ font: "800 18px/1.2 var(--f-sans)", color: "var(--ink-side-strong)" }}>
        {lot.clientName ?? "Cliente sin nombre"}
      </div>
      <div style={{ font: "700 12px/1.3 var(--f-mono)", color: "var(--wine)", marginTop: 3 }}>
        {lot.clientMarkbox ?? "—"} · {lot.prealertaCode}
      </div>

      {/* Cantidad (lote partido) */}
      <label
        style={{
          display: "block",
          marginTop: 14,
          font: "700 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-side-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Cuántas montas ahora
      </label>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={lot.lotSize}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        aria-label="Cantidad de cajas a montar"
        style={{
          width: "100%",
          marginTop: 6,
          padding: "12px 14px",
          borderRadius: "var(--r-md)",
          background: "var(--surface-inv-soft)",
          border: "1px solid var(--border-inv)",
          color: "var(--ink-side-strong)",
          font: "800 22px/1 var(--f-mono)",
          textAlign: "center",
        }}
      />
      {partial && (
        <p style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-side-soft)", margin: "6px 0 0" }}>
          Lote partido: las {lot.lotSize - Number(count)} que faltan quedan en el
          almacén para el próximo contenedor.
        </p>
      )}

      {/* Izq / Centro / Der */}
      <div
        style={{
          font: "700 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-side-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "14px 0 6px",
        }}
      >
        ¿A qué lado del contenedor?
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {LOT_WIDTH_LABELS.map((label, i) => {
          const active = width === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setWidth(i)}
              aria-pressed={active}
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: "var(--r-md)",
                border: active ? "1.5px solid var(--wine)" : "1px solid var(--border-inv)",
                background: active ? "var(--surface-sel)" : "var(--surface-inv-soft)",
                color: active ? "var(--ink-side-strong)" : "var(--ink-side-soft)",
                font: "700 13px/1.2 var(--f-sans)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: "var(--r-md)",
            background: "transparent",
            border: "1px solid var(--border-inv)",
            color: "var(--ink-side)",
            font: "700 13px/1 var(--f-sans)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <div style={{ flex: 2 }}>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Montar el lote"
            loadingLabel="Montando…"
            successLabel="Montado ✓"
            idleIcon={Icon.check(16)}
            successIcon={Icon.check(16)}
            disabled={width == null}
            onAction={onConfirm}
          />
        </div>
      </div>
    </div>
  );
}
