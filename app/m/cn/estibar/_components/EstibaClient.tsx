"use client";

/**
 * SDD-0152 · Estibar el contenedor (operario CN).
 *
 * Flujo: escanear la caja → tapear la zona → confirmar.
 *
 * La grilla es PLANA (vista cenital + toggle de nivel), no isométrica: el
 * operario tapea con guantes y apurado. La isométrica del Studio es para MIRAR;
 * acá hay que TRABAJAR, y la perspectiva convierte un tap en una adivinanza.
 * Celdas de 44×44 mínimo (Apple HIG / WCAG 2.5.8).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrScanner } from "@/app/m/_components/QrScanner";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import {
  heightLabels,
  lengthLabels,
  widthLabels,
  zoneCodeOf,
  zoneLabel,
  type StuffedBox,
  type ZoneCoord,
  type ZoneLayout,
} from "@/lib/studio/naviera/zones";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import { stuffBoxAction, unstuffBoxAction } from "../actions";

type Props = {
  consolidationId: string;
  consolidationRef: string;
  containerLabel: string;
  containerNo: string | null;
  status: string;
  layout: ZoneLayout;
  initialStuffed: StuffedBox[];
  expectedCount: number;
};

export function EstibaClient({
  consolidationId,
  consolidationRef,
  containerLabel,
  containerNo,
  status,
  layout,
  initialStuffed,
  expectedCount,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<{ code: string; manual: boolean } | null>(null);
  const [level, setLevel] = useState(0);
  const [pick, setPick] = useState<ZoneCoord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stuffed, setStuffed] = useState<StuffedBox[]>(initialStuffed);

  const closed = status !== "consolidando";

  // zone_code → cajas que ya están ahí
  const occupied = useMemo(() => {
    const m = new Map<string, StuffedBox[]>();
    for (const b of stuffed) {
      const k = zoneCodeOf(b);
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [stuffed]);

  const lengthL = lengthLabels(layout.nx);
  const widthL = widthLabels(layout.nz);
  const heightL = heightLabels(layout.ny);

  function reset() {
    setScanned(null);
    setPick(null);
    setError(null);
  }

  async function confirm() {
    if (!scanned || !pick) return { error: "Falta escanear la caja o elegir la zona." };
    const res = await stuffBoxAction(consolidationId, scanned.code, pick, layout, scanned.manual);
    if (res.error) return { error: res.error };

    // Pintar la zona al instante · el server ya confirmó
    setStuffed((prev) => [
      ...prev,
      {
        boxId: `${res.code}`,
        code: res.code ?? scanned.code,
        markbox: res.markbox ?? null,
        clientName: res.clientName ?? null,
        zx: pick.zx,
        zy: pick.zy,
        zz: pick.zz,
        seq: prev.length + 1,
      },
    ]);
    toast.success(
      `${res.code} · ${zoneLabel(layout, pick)}${res.markbox ? ` · ${res.markbox}` : ""}`,
    );
    reset();
    router.refresh();
    return;
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
      {/* Header */}
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
          }}
          aria-label={`${stuffed.length} de ${expectedCount || "?"} cajas estibadas`}
        >
          {stuffed.length}
          <span style={{ color: "var(--ink-side-soft)" }}>/{expectedCount || "?"}</span>
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

      {/* Paso 1 · escanear */}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {scanning ? (
          <QrScanner
            placeholder="DTD-B-000123"
            manualLabel="Escribir el código de la caja"
            hint="Escanea el QR de la etiqueta de la caja."
            onDetected={(raw) => {
              // Conviven dos etiquetas físicas: la del proveedor (identifica al
              // CLIENTE, no a la caja) y la del hub (código único DTD-B). Sin
              // distinguirlas, escanear la del proveedor daría "esa caja no
              // existe" y el operario saldría a buscar un problema que no hay.
              const parsed = parseScannedLabel(raw);
              if (parsed.kind === "box_code") {
                setScanned({ code: parsed.code, manual: false });
                setScanning(false);
                setError(null);
                return;
              }
              if (parsed.kind === "verify_url") {
                setScanning(false);
                setError(
                  `Esa es la etiqueta del proveedor (${parsed.markbox}) · identifica al cliente, no a la caja. Escanea la etiqueta DTD-B del hub o escribe su código.`,
                );
                return;
              }
              setScanning(false);
              setError("No reconozco ese código · escanea la etiqueta DTD-B del hub.");
            }}
            onClose={() => setScanning(false)}
          />
        ) : scanned ? (
          <button
            type="button"
            onClick={reset}
            style={{
              border: "1.5px dashed var(--wine-soft)",
              borderRadius: "var(--r-md)",
              padding: 12,
              background: "var(--surface-inv)",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              alignItems: "center",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            <span
              style={{
                font: "700 9px/1.3 var(--f-sans)",
                color: "var(--ink-side-soft)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Caja escaneada · toca para cambiar
            </span>
            <span
              style={{ font: "700 15px/1.2 var(--f-mono)", color: "var(--ink-side-strong)" }}
            >
              {scanned.code}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setScanning(true)}
            disabled={closed}
            style={{
              border: "1.5px dashed var(--border-inv)",
              borderRadius: "var(--r-md)",
              padding: 18,
              background: "var(--surface-inv-soft)",
              color: "var(--ink-side)",
              font: "700 13px/1.3 var(--f-sans)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: closed ? "not-allowed" : "pointer",
              opacity: closed ? 0.5 : 1,
              minHeight: 56,
            }}
          >
            {Icon.search(16)} Escanear caja
          </button>
        )}

        {/* Paso 2 · elegir la zona */}
        <div
          style={{
            font: "700 10px/1.4 var(--f-sans)",
            color: "var(--ink-side)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginTop: 4,
          }}
        >
          {scanned ? "¿Dónde la pusiste?" : "Zonas ocupadas"}
        </div>

        {/* Nivel (altura) */}
        {layout.ny > 1 && (
          <div style={{ display: "flex", gap: 5 }}>
            {heightL.map((h, i) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setLevel(i);
                  setPick(null);
                }}
                aria-pressed={level === i}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: "var(--r-pill)",
                  border: "none",
                  font: "700 12px/1 var(--f-sans)",
                  cursor: "pointer",
                  background: level === i ? "var(--surface-inv-strong)" : "var(--surface-inv)",
                  color: level === i ? "var(--ink-inv)" : "var(--ink-side-soft)",
                }}
              >
                {h}
              </button>
            ))}
          </div>
        )}

        {/* Grilla cenital · filas = ancho (izq→der), columnas = largo (fondo→puerta) */}
        <div
          role="grid"
          aria-label={`Zonas del contenedor · nivel ${heightL[level]}`}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${layout.nx}, 1fr)`,
            gap: 6,
          }}
        >
          {Array.from({ length: layout.nz }).flatMap((_, zz) =>
            Array.from({ length: layout.nx }).map((__, zx) => {
              const zone: ZoneCoord = { zx, zy: level, zz };
              const here = occupied.get(zoneCodeOf(zone)) ?? [];
              const isPicked =
                pick != null && pick.zx === zx && pick.zy === level && pick.zz === zz;
              const taken = here.length > 0;
              return (
                <button
                  key={`${zx}-${zz}`}
                  type="button"
                  role="gridcell"
                  disabled={closed || !scanned}
                  aria-pressed={isPicked}
                  aria-label={`${zoneLabel(layout, zone)}${
                    taken ? ` · ocupada por ${here[0].markbox ?? "sin dueño"}` : " · libre"
                  }`}
                  onClick={() => setPick(zone)}
                  style={{
                    aspectRatio: "1",
                    minHeight: 44,
                    borderRadius: "var(--r-sm)",
                    cursor: closed || !scanned ? "default" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: 2,
                    background: isPicked
                      ? "var(--surface-sel)"
                      : taken
                        ? "var(--surface-inv-soft)"
                        : "var(--surface-inv)",
                    border: isPicked
                      ? "1.5px solid var(--wine-soft)"
                      : taken
                        ? "1px dashed var(--border-inv)"
                        : "1px solid var(--border-inv)",
                    color: isPicked ? "var(--ink-side-strong)" : "var(--ink-side-soft)",
                    font: "700 9px/1.2 var(--f-sans)",
                  }}
                >
                  <span>{lengthL[zx]}</span>
                  <span style={{ font: "500 8px/1.2 var(--f-sans)", opacity: 0.75 }}>
                    {widthL[zz]}
                  </span>
                  {taken && (
                    <span
                      style={{
                        font: "600 8px/1.2 var(--f-mono)",
                        opacity: 0.85,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {here[0].markbox ?? "—"}
                      {here.length > 1 ? ` +${here.length - 1}` : ""}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>

        {error && (
          <p
            style={{
              margin: 0,
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--danger-bg-strong)",
              border: "1px solid var(--danger-border)",
              font: "600 12px/1.4 var(--f-sans)",
              color: "var(--ink-side-strong)",
            }}
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Paso 3 · confirmar */}
        <ActionButton
          variant="primary"
          idleLabel={
            pick && scanned ? `Confirmar · ${zoneLabel(layout, pick)}` : "Confirmar zona"
          }
          loadingLabel="Guardando…"
          successLabel="Estibada"
          idleIcon={Icon.check(14)}
          successIcon={Icon.check(14)}
          disabled={closed || !scanned || !pick}
          onAction={confirm}
          onError={setError}
        />

        {/* Corregir · sacar la última caja */}
        {stuffed.length > 0 && !scanned && (
          <ActionButton
            variant="ghost"
            size="sm"
            idleLabel={`Sacar la última · ${stuffed[stuffed.length - 1].code}`}
            loadingLabel="Sacando…"
            successLabel="Sacada"
            disabled={closed}
            onAction={async () => {
              const last = stuffed[stuffed.length - 1];
              const res = await unstuffBoxAction(consolidationId, last.code);
              if (res.error) return { error: res.error };
              setStuffed((prev) => prev.slice(0, -1));
              toast.success(`${last.code} sacada del contenedor`);
              router.refresh();
              return;
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}
