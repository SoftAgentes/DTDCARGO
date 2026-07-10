"use client";

/**
 * Drawer "Asignar carga suelta" a un contenedor — SDD-0047, Slice B.
 *
 * Eliges una pieza de carga suelta (loose_cargo) o la cargas a mano, ajustas
 * CBM/peso/bultos, y se asigna como consolidation_item. Preview EN VIVO de la
 * utilización resultante con guard de capacidad ADVISORY (§4.4): si supera el
 * CBM/kg del tipo, avisa en wine pero NO bloquea — se asigna igual.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  containerStats,
  evaluateCapacity,
  type ConsolidationItemInput,
  type StatItem,
} from "@/lib/studio/naviera/types";
import type {
  ConsolidationDetail,
  LooseCargo,
} from "@/lib/studio/naviera/queries";
import { assignLooseCargo } from "../actions";
import { UtilizationBar, utilizationTone } from "./UtilizationBar";
import { Field, FormError } from "./SailingDrawer";

export function AssignCargoDrawer({
  detail,
  looseCargo,
  onClose,
}: {
  detail: ConsolidationDetail;
  looseCargo: LooseCargo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [shipmentId, setShipmentId] = useState("");
  const [clientMarkbox, setClientMarkbox] = useState("");
  const [clientName, setClientName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [cbm, setCbm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [pieces, setPieces] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Al elegir una pieza suelta, prellenar markbox/cliente/cbm/peso.
  const onPickLoose = (id: string) => {
    setShipmentId(id);
    const l = looseCargo.find((x) => x.shipment_id === id);
    if (l) {
      setClientMarkbox(l.client_markbox ?? "");
      setClientName(l.client_name ?? "");
      setCbm(l.cbm ?? null);
      setWeightKg(l.weight_kg ?? null);
    }
  };

  const existing: StatItem[] = useMemo(
    () =>
      detail.items.map((it) => ({
        cbm: it.cbm,
        weight_kg: it.weight_kg,
        pieces: it.pieces,
      })),
    [detail.items],
  );

  const incoming: StatItem = {
    cbm: cbm ?? 0,
    weight_kg: weightKg ?? 0,
    pieces: pieces ?? 0,
  };

  // Utilización proyectada (existentes + lo que se está por agregar).
  const projected = useMemo(
    () => containerStats([...existing, incoming], detail.consolidation.container_type),
    [existing, incoming, detail.consolidation.container_type],
  );
  const guard = useMemo(
    () => evaluateCapacity(existing, incoming, detail.consolidation.container_type),
    [existing, incoming, detail.consolidation.container_type],
  );

  const canSubmit = (cbm ?? 0) > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<ConsolidationItemInput> = {
      shipmentId: shipmentId || null,
      clientMarkbox: clientMarkbox.trim() || null,
      clientName: clientName.trim() || null,
      supplierName: supplierName.trim() || null,
      cbm: cbm ?? 0,
      weightKg: weightKg ?? 0,
      pieces: pieces ?? 0,
    };
    const r = await assignLooseCargo(detail.consolidation.id, payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.warning) {
      toast.warning(r.warning);
    } else {
      toast.success(
        `Carga asignada a ${detail.consolidation.ref}`,
      );
    }
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={`Asignar carga · ${detail.consolidation.ref}`}
      subtitle={`${detail.consolidation.container_type ?? "sin tipo"} · ${detail.items.length} pieza(s) asignada(s)`}
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="assign-cargo-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && <FormError message={error} />}

        {/* Preview de utilización proyectada */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="studio-eyebrow">Utilización proyectada · CBM</span>
            <span
              style={{
                font: "800 13px/1 var(--f-mono)",
                color: utilizationTone(projected.cbmPct),
              }}
            >
              {projected.cbmPct.toFixed(0)}%
            </span>
          </div>
          <UtilizationBar pct={projected.cbmPct} height={10} />
          {projected.cap && (
            <div
              style={{
                font: "500 11px/1 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {projected.usedCbm.toFixed(1)} / {projected.cap.cbm} CBM · peso{" "}
              {(projected.usedKg / 1000).toFixed(1)} /{" "}
              {(projected.cap.kg / 1000).toFixed(1)} t ({projected.kgPct.toFixed(0)}%)
            </div>
          )}
          {guard.over && (
            <div
              style={{
                font: "600 11.5px/1.4 var(--f-sans)",
                color: "var(--wine)",
              }}
            >
              {guard.message}
            </div>
          )}
        </div>

        {/* Elegir pieza suelta (opcional) */}
        <Field label="Carga suelta candidata" optional>
          <select
            className="studio-input"
            value={shipmentId}
            onChange={(e) => onPickLoose(e.target.value)}
          >
            <option value="">— Cargar a mano —</option>
            {looseCargo.map((l) => (
              <option key={l.shipment_id} value={l.shipment_id}>
                {l.code} · {l.client_markbox ?? "—"} · {l.cbm ?? 0} CBM
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Shipping Mark" optional>
            <input
              className="studio-input studio-input-mono"
              placeholder="DTD-5418"
              value={clientMarkbox}
              onChange={(e) => setClientMarkbox(e.target.value)}
            />
          </Field>
          <Field label="Cliente" optional>
            <input
              className="studio-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Proveedor" optional>
          <input
            className="studio-input"
            placeholder="Shenzhen Trading Co"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="CBM">
            <NumericInput
              type="volume"
              min={0}
              placeholder="3.40"
              value={cbm}
              onChange={setCbm}
            />
          </Field>
          <Field label="Peso">
            <NumericInput
              type="weight"
              min={0}
              placeholder="1800"
              value={weightKg}
              onChange={setWeightKg}
            />
          </Field>
          <Field label="Bultos">
            <NumericInput
              type="count"
              unit="bultos"
              min={0}
              placeholder="14"
              value={pieces}
              onChange={setPieces}
            />
          </Field>
        </div>

        <p
          style={{
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          El guard de capacidad es{" "}
          <Badge tone="info" size="sm">
            advisory
          </Badge>{" "}
          — si superas el CBM o el peso del tipo, igual se asigna y queda avisado.
        </p>
      </form>

      <DrawerFooter
        formId="assign-cargo-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Asignar al contenedor"
        pendingLabel="Asignando…"
      />
    </DrawerShell>
  );
}
