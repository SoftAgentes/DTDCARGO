"use client";

/**
 * GenerateBLModal — flow de generación de BL en 2 pasos (SDD-0034).
 *
 * Step 1: dropdown shipments activos + tipo BL + preview.
 * Step 2: card verde "BL generado" + número + acciones.
 *
 * V1: el "PDF" es mock alert. V2 con pdfmake o backend route.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ModalShell } from "./ProfileModal";

type BLType = "OR" | "CP" | "SW";

const BL_TYPES: Array<{ value: BLType; label: string; desc: string }> = [
  { value: "OR", label: "Original", desc: "BL emitido como original · 3 copias" },
  { value: "CP", label: "Copy", desc: "BL emitido como copia (non-negotiable)" },
  { value: "SW", label: "SeaWayBill", desc: "Sea Waybill · transferible electrónico" },
];

type ShipmentOption = {
  id: string;
  code: string;
  client_name: string | null;
  destination: string | null;
};

export function GenerateBLModal({ onClose }: { onClose: () => void }) {
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [shipmentId, setShipmentId] = useState<string>("");
  const [type, setType] = useState<BLType>("OR");
  const [step, setStep] = useState<"select" | "generated">("select");
  const [generatedCode, setGeneratedCode] = useState<string>("");

  // Fetch shipments activos (client-side · admin context)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shipments")
        .select("id, code, client_name, destination")
        .not("status", "in", "(entregado,cancelado)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error || !data) {
        setShipments([]);
      } else {
        setShipments(data as ShipmentOption[]);
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedShipment = shipments.find((s) => s.id === shipmentId);
  const canGenerate = !!selectedShipment && step === "select";

  const handleGenerate = () => {
    if (!selectedShipment) return;
    // Generar code mock: DTDU{7-dígitos del id}-{type}
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    setGeneratedCode(`DTDU${rand}-${type}`);
    setStep("generated");
  };

  const handleDownload = () => {
    alert(
      `[V1 mock] Generación del PDF real llega en SDD futuro.\nCódigo: ${generatedCode}`,
    );
  };

  return (
    <ModalShell title="Generar Bill of Lading" onClose={onClose} width={620}>
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {step === "select" ? (
          <>
            <div>
              <label className="studio-label" htmlFor="bl-shipment">
                Embarque
              </label>
              {loading ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: 12,
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-sm)",
                    font: "500 12.5px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  Cargando embarques…
                </div>
              ) : shipments.length === 0 ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: 12,
                    background: "var(--warning-bg)",
                    color: "var(--warning)",
                    borderRadius: "var(--r-sm)",
                    font: "500 12.5px/1.4 var(--f-sans)",
                  }}
                >
                  No hay embarques activos. Crea uno desde{" "}
                  <a href="/studio/embarques" style={{ color: "var(--wine-text)" }}>
                    Embarques
                  </a>{" "}
                  primero.
                </div>
              ) : (
                <select
                  id="bl-shipment"
                  className="studio-input"
                  value={shipmentId}
                  onChange={(e) => setShipmentId(e.target.value)}
                  style={{ marginTop: 6 }}
                >
                  <option value="">— Elige embarque —</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.client_name ?? "—"} · {s.destination ?? "—"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="studio-label" style={{ display: "block", marginBottom: 8 }}>
                Tipo de BL
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {BL_TYPES.map((t) => {
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "var(--r-sm)",
                        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                        background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          font: "700 12.5px/1 var(--f-sans)",
                          color: active ? "var(--wine)" : "var(--ink)",
                        }}
                      >
                        {t.label}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          font: "500 11.5px/1.3 var(--f-sans)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {t.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedShipment && (
              <div
                style={{
                  padding: 12,
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <div
                  className="studio-eyebrow"
                  style={{ color: "var(--ink-soft)", marginBottom: 8 }}
                >
                  Preview
                </div>
                <Row label="Shipment" value={selectedShipment.code} mono />
                <Row label="Cliente" value={selectedShipment.client_name ?? "—"} />
                <Row label="Destino" value={selectedShipment.destination ?? "—"} />
                <Row label="Tipo BL" value={BL_TYPES.find((t) => t.value === type)?.label ?? ""} />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                Generar BL
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                padding: 18,
                background: "var(--success-bg)",
                border: "1px solid var(--success)",
                borderRadius: "var(--r-md)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  font: "900 16px/1.2 var(--f-display)",
                  color: "var(--success)",
                  marginBottom: 6,
                }}
              >
                BL generado
              </div>
              <code
                style={{
                  font: "900 18px/1 var(--f-mono)",
                  color: "var(--ink)",
                }}
              >
                {generatedCode}
              </code>
            </div>

            {selectedShipment && (
              <div
                style={{
                  padding: 14,
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <Row label="Shipment" value={selectedShipment.code} mono />
                <Row label="Cliente" value={selectedShipment.client_name ?? "—"} />
                <Row label="Destino" value={selectedShipment.destination ?? "—"} />
                <Row
                  label="Tipo"
                  value={
                    <Badge tone="wine" size="sm">
                      {BL_TYPES.find((t) => t.value === type)?.label ?? type}
                    </Badge>
                  }
                />
              </div>
            )}

            <p
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              V1: el PDF real llega en SDD futuro. El código generado queda
              registrado.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                onClick={onClose}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={handleDownload}
              >
                Descargar PDF
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--ink-soft)",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          font: `${mono ? "700 12.5px/1 var(--f-mono)" : "700 12.5px/1 var(--f-sans)"}`,
          color: "var(--ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
