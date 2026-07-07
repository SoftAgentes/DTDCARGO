"use client";

/**
 * Drawer de alta/edición de itinerario (sailing) — SDD-0047, Slice B.
 * Carga manual (V1; scraping = Slice C). Buque, viaje, ruta POL→POD, fechas
 * (ETD/ETA/cut-off), tránsito, estado + disponibilidad de espacio.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  SAILING_STATUS,
  SAILING_STATUSES,
  SPACE_LEVELS,
  type Carrier,
  type Port,
  type Sailing,
  type SailingInput,
  type SailingStatus,
  type SpaceLevel,
} from "@/lib/studio/naviera/types";
import { createSailing, updateSailing } from "../actions";

const SPACE_LABEL: Record<SpaceLevel, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  cerrada: "Cerrada",
};

export function SailingDrawer({
  sailing,
  carriers,
  ports,
  onClose,
}: {
  sailing?: Sailing;
  carriers: Carrier[];
  ports: Port[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!sailing;

  const [carrierId, setCarrierId] = useState(sailing?.carrier_id ?? "");
  const [vessel, setVessel] = useState(sailing?.vessel ?? "");
  const [voyage, setVoyage] = useState(sailing?.voyage ?? "");
  const [pol, setPol] = useState(sailing?.pol ?? "");
  const [pod, setPod] = useState(sailing?.pod ?? "");
  const [etd, setEtd] = useState(sailing?.etd ?? "");
  const [eta, setEta] = useState(sailing?.eta ?? "");
  const [cutoff, setCutoff] = useState(sailing?.cutoff ?? "");
  const [transitDays, setTransitDays] = useState(
    sailing?.transit_days != null ? String(sailing.transit_days) : "",
  );
  const [status, setStatus] = useState<SailingStatus>(
    sailing?.status ?? "abierto",
  );
  const [space, setSpace] = useState<SpaceLevel>(sailing?.space ?? "alta");
  const [notes, setNotes] = useState(sailing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit =
    vessel.trim().length > 0 && pol.trim().length > 0 && pod.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);
    const payload: Partial<SailingInput> = {
      carrierId: carrierId || null,
      vessel: vessel.trim(),
      voyage: voyage.trim() || null,
      pol: pol.trim(),
      pod: pod.trim(),
      etd: etd || null,
      eta: eta || null,
      cutoff: cutoff || null,
      transitDays: transitDays.trim() === "" ? null : Number(transitDays),
      status,
      space,
      notes: notes.trim() || null,
    };
    const r = editing
      ? await updateSailing(sailing!.id, payload)
      : await createSailing(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(
      editing ? "Itinerario actualizado" : `Itinerario ${vessel.trim()} creado`,
    );
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? sailing!.vessel : "Nuevo itinerario"}
      subtitle={
        editing
          ? `${sailing!.pol} → ${sailing!.pod}`
          : "Carga manual de zarpe · naviera, ruta y fechas"
      }
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="sailing-form"
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Naviera">
            <select
              className="studio-input"
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
            >
              <option value="">— Sin naviera —</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buque (vessel)">
            <input
              className="studio-input"
              placeholder="COSCO FORTUNE"
              value={vessel}
              onChange={(e) => setVessel(e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Viaje (voyage)" optional>
            <input
              className="studio-input studio-input-mono"
              placeholder="048W"
              value={voyage}
              onChange={(e) => setVoyage(e.target.value)}
            />
          </Field>
          <Field label="POL (carga)">
            <PortSelect ports={ports} value={pol} onChange={setPol} country="CN" />
          </Field>
          <Field label="POD (descarga)">
            <PortSelect ports={ports} value={pod} onChange={setPod} country="VE" />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <Field label="ETD" optional>
            <input
              type="date"
              className="studio-input"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
            />
          </Field>
          <Field label="ETA" optional>
            <input
              type="date"
              className="studio-input"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </Field>
          <Field label="Cut-off" optional>
            <input
              type="date"
              className="studio-input"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
            />
          </Field>
          <Field label="Tránsito (días)" optional>
            <input
              type="number"
              min={0}
              className="studio-input"
              placeholder="32"
              value={transitDays}
              onChange={(e) => setTransitDays(e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as SailingStatus)}
            >
              {SAILING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SAILING_STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Espacio disponible">
            <select
              className="studio-input"
              value={space}
              onChange={(e) => setSpace(e.target.value as SpaceLevel)}
            >
              {SPACE_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {SPACE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notas" optional>
          <textarea
            className="studio-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="sailing-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear itinerario"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

// ── Helpers compartidos de form ────────────────────────────────

export function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="studio-label">
        {label}
        {optional && (
          <span style={{ color: "var(--ink-soft)" }}> (opcional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        margin: 0,
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
      }}
    >
      {message}
    </p>
  );
}

export function PortSelect({
  ports,
  value,
  onChange,
  country,
}: {
  ports: Port[];
  value: string;
  onChange: (v: string) => void;
  country?: string;
}) {
  const filtered = country
    ? ports.filter((p) => p.country === country)
    : ports;
  const list = filtered.length > 0 ? filtered : ports;
  return (
    <select
      className="studio-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Puerto —</option>
      {list.map((p) => (
        <option key={p.id} value={p.code}>
          {p.code} · {p.name}
        </option>
      ))}
    </select>
  );
}
