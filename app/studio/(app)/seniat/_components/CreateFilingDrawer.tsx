"use client";

/**
 * CreateFilingDrawer — drawer para crear un nuevo trámite SENIAT desde
 * un shipment elegible (status in_customs/arrived_destination sin filing).
 *
 * Form mini con:
 * - Select shipment elegible
 * - Select agente
 * - Port code (auto-suggest desde shipment.destination matching)
 * - HS codes input chips
 * - Cost inputs con CostHelpers
 * - Observations
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { createFilingAction } from "../actions";
import { CostHelpers } from "./CostHelpers";
import type {
  CustomsAgent,
  CustomsFilingActionState,
} from "@/lib/studio/customs-types";
import {
  VE_PORTS,
  filingTotal,
} from "@/lib/studio/customs-types";
import type { EligibleShipment } from "@/lib/studio/customs-queries";

interface Props {
  agents: CustomsAgent[];
  shipments: EligibleShipment[];
  onClose: () => void;
}

const initialState: CustomsFilingActionState = {};

function detectPortFromDestination(dest: string | null): string {
  if (!dest) return "";
  const d = dest.toLowerCase();
  if (d.includes("cabello")) return "PBL";
  if (d.includes("guaira")) return "LGU";
  if (d.includes("maracaibo") || d.includes("zulia")) return "MAR";
  if (d.includes("punto fijo") || d.includes("falcón") || d.includes("falcon")) return "PFI";
  return "";
}

export function CreateFilingDrawer({ agents, shipments, onClose }: Props) {
  const [state, formAction, isPending] = useActionState(
    createFilingAction,
    initialState,
  );

  // Form state
  const [shipmentId, setShipmentId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [portCode, setPortCode] = useState("");
  const [hsInput, setHsInput] = useState("");
  const [hsCodes, setHsCodes] = useState<string[]>([]);
  const [totalDuty, setTotalDuty] = useState("");
  const [igtf, setIgtf] = useState("");
  const [iva, setIva] = useState("");
  const [agentFee, setAgentFee] = useState("");
  const [observations, setObservations] = useState("");

  const selectedShipment = useMemo(
    () => shipments.find((s) => s.id === shipmentId),
    [shipments, shipmentId],
  );

  if (selectedShipment && !portCode) {
    const suggested = detectPortFromDestination(selectedShipment.destination);
    if (suggested) setPortCode(suggested);
  }
  if (portCode && !agentId) {
    const match = agents.find((agent) => agent.port_code === portCode);
    if (match) setAgentId(match.id);
  }

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const addHsCode = () => {
    const code = hsInput.trim();
    if (!code) return;
    if (hsCodes.includes(code)) return;
    setHsCodes((prev) => [...prev, code]);
    setHsInput("");
  };

  const removeHs = (code: string) => {
    setHsCodes((prev) => prev.filter((c) => c !== code));
  };

  const hsCodesJson = JSON.stringify(hsCodes);

  const totalComputed = filingTotal({
    total_duty: totalDuty,
    igtf,
    iva,
    agent_fee: agentFee,
  });

  const canSubmit = useMemo(() => {
    if (!shipmentId) return false;
    if (!portCode) return false;
    if (hsCodes.length === 0) return false;
    return true;
  }, [shipmentId, portCode, hsCodes]);

  return (
    <DrawerShell
      title="Nuevo trámite SENIAT"
      subtitle="DUA + cost breakdown + checklist se crean automáticamente"
      onClose={onClose}
      pending={isPending}
      width={700}
    >
        <form
          id="create-filing-form"
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Hidden fields */}
          <input type="hidden" name="shipment_id" value={shipmentId} />
          <input type="hidden" name="agent_id" value={agentId} />
          <input type="hidden" name="port_code" value={portCode} />
          <input type="hidden" name="hs_codes_json" value={hsCodesJson} />
          <input type="hidden" name="total_duty" value={totalDuty} />
          <input type="hidden" name="igtf" value={igtf} />
          <input type="hidden" name="iva" value={iva} />
          <input type="hidden" name="agent_fee" value={agentFee} />
          <input type="hidden" name="observations" value={observations} />

          {/* 1. Shipment */}
          <div>
            <label htmlFor="cf-shipment" className="studio-label">
              Shipment <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            {shipments.length === 0 ? (
              <Aviso tono="atencion" compacto>
                No hay shipments elegibles. Solo se pueden crear trámites
                para shipments en estado <strong>in_customs</strong> o{" "}
                <strong>arrived_destination</strong> que aún no tengan
                trámite asignado.
              </Aviso>
            ) : (
              <select
                id="cf-shipment"
                className="studio-input"
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                required
              >
                <option value="">Selecciona un shipment elegible…</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.client_name ?? "—"}
                    {s.destination ? ` · ${s.destination}` : ""}
                  </option>
                ))}
              </select>
            )}
            {state.fieldErrors?.shipment_id && (
              <FieldError msg={state.fieldErrors.shipment_id} />
            )}
          </div>

          {/* 2. Puerto + Agente */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "var(--s-3)",
            }}
          >
            <div>
              <label htmlFor="cf-port" className="studio-label">
                Puerto <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <select
                id="cf-port"
                className="studio-input"
                value={portCode}
                onChange={(e) => setPortCode(e.target.value)}
                required
              >
                <option value="">Selecciona puerto…</option>
                {VE_PORTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.port_code && (
                <FieldError msg={state.fieldErrors.port_code} />
              )}
            </div>
            <div>
              <label htmlFor="cf-agent" className="studio-label">
                Agente aduanal
              </label>
              <select
                id="cf-agent"
                className="studio-input"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Sin agente asignado</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.port_code ? ` (${a.port_code})` : ""}
                    {a.rating ? ` · ★ ${a.rating}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. HS codes */}
          <div>
            <label htmlFor="cf-hs" className="studio-label">
              HS codes <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: "var(--s-2)" }}>
              <input
                id="cf-hs"
                type="text"
                className="studio-input studio-input-mono"
                value={hsInput}
                onChange={(e) => setHsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHsCode();
                  }
                }}
                placeholder="0000.00 o 0000.00.00"
              />
              <button
                type="button"
                onClick={addHsCode}
                disabled={!hsInput.trim()}
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{
                  height: 38,
                  whiteSpace: "nowrap",
                  opacity: hsInput.trim() ? 1 : 0.5,
                }}
              >
                + Agregar
              </button>
            </div>
            {hsCodes.length > 0 && (
              <div
                style={{
                  marginTop: "var(--s-2)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {hsCodes.map((code) => (
                  <span
                    key={code}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "var(--s-1) var(--s-2)",
                      background: "var(--wine-tint)",
                      color: "var(--wine-text)",
                      borderRadius: "var(--r-sm)",
                      font: "700 11.5px/1 var(--f-mono)",
                    }}
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeHs(code)}
                      aria-label={`Quitar ${code}`}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--wine-text)",
                        cursor: "pointer",
                        padding: 0,
                        display: "inline-flex",
                      }}
                    >
                      {Icon.close(10)}
                    </button>
                  </span>
                ))}
              </div>
            )}
            {state.fieldErrors?.hs_codes && (
              <FieldError msg={state.fieldErrors.hs_codes} />
            )}
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "var(--s-1) 0 0",
              }}
            >
              Formato: 4 dígitos + punto + 2 dígitos (+ opcional .2 dígitos
              más). Ej: 8517.12.10
            </p>
          </div>

          {/* 4. Cost helpers */}
          <CostHelpers
            onApplyIgtf={(v) => setIgtf(v.toFixed(2))}
            onApplyIva={(v) => setIva(v.toFixed(2))}
          />

          {/* 5. Cost inputs */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
              Costos del trámite (USD)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <CostInput
                label="Arancel"
                value={totalDuty}
                onChange={setTotalDuty}
                error={state.fieldErrors?.total_duty}
              />
              <CostInput
                label="IGTF 3%"
                value={igtf}
                onChange={setIgtf}
                error={state.fieldErrors?.igtf}
              />
              <CostInput
                label="IVA 16%"
                value={iva}
                onChange={setIva}
                error={state.fieldErrors?.iva}
              />
              <CostInput
                label="Honor. agente"
                value={agentFee}
                onChange={setAgentFee}
                error={state.fieldErrors?.agent_fee}
              />
            </div>
            {totalComputed > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "var(--bg-sidebar)",
                  color: "var(--ink-side)",
                  borderRadius: "var(--r-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    font: "700 11px/1 var(--f-sans)",
                    color: "var(--wine-soft)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Total a pagar SENIAT
                </span>
                <code
                  style={{
                    font: "900 18px/1 var(--f-mono)",
                    color: "var(--ink-side-strong)",
                  }}
                >
                  ${totalComputed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </code>
              </div>
            )}
          </div>

          {/* 6. Observations */}
          <div>
            <label htmlFor="cf-obs" className="studio-label">
              Observaciones
            </label>
            <textarea
              id="cf-obs"
              rows={3}
              className="studio-input"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Estado documental, comentarios del agente, observaciones SENIAT…"
              style={{ resize: "vertical" }}
            />
          </div>

          {state.error && (
            <Aviso tono="error" compacto>
              {state.error}
            </Aviso>
          )}

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-filing-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
          >
            {isPending ? "Creando…" : "Crear trámite"}
          </button>
        </footer>
    </DrawerShell>
  );
}

function CostInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="studio-label">{label}</label>
      <NumericInput
        type="currency"
        currency="USD"
        min={0}
        placeholder="0.00"
        value={value === "" ? null : Number(value)}
        onChange={(v) => onChange(v != null ? String(v) : "")}
      />
      {error && <FieldError msg={error} />}
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
