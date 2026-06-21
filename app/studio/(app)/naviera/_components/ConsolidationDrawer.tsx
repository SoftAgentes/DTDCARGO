"use client";

/**
 * Drawer de alta de contenedor de consolidación — SDD-0047, Slice B.
 * Tipo de contenedor (requerido) + atado opcional a reserva/itinerario.
 * El ref DTD-CONSOL-NNNN lo genera el RPC al crear.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type {
  Booking,
  ConsolidationInput,
  ContainerType,
  Sailing,
} from "@/lib/studio/naviera/types";
import { createConsolidation } from "../actions";
import { Field, FormError } from "./SailingDrawer";

export function ConsolidationDrawer({
  containerTypes,
  bookings,
  sailings,
  onClose,
}: {
  containerTypes: ContainerType[];
  bookings: Booking[];
  sailings: Sailing[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [containerType, setContainerType] = useState(
    containerTypes[0]?.code ?? "",
  );
  const [bookingId, setBookingId] = useState("");
  const [sailingId, setSailingId] = useState("");
  const [containerNo, setContainerNo] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = containerType.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<ConsolidationInput> = {
      containerType,
      bookingId: bookingId || null,
      sailingId: sailingId || null,
      containerNo: containerNo.trim() || null,
      status: "consolidando",
      notes: notes.trim() || null,
    };
    const r = await createConsolidation(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(`Contenedor ${r.consolidationRef ?? ""} creado`);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title="Nuevo contenedor"
      subtitle="Consolidación LCL → FCL · DTD-CONSOL-NNNN"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="consolidation-form"
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

        <Field label="Tipo de contenedor">
          <select
            className="studio-input"
            value={containerType}
            onChange={(e) => setContainerType(e.target.value)}
          >
            {containerTypes.length === 0 && (
              <option value="">— Sin catálogo —</option>
            )}
            {containerTypes.map((t) => (
              <option key={t.id} value={t.code}>
                {t.label} · {t.cbm_capacity} CBM / {(t.kg_capacity / 1000).toFixed(1)} t
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Reserva" optional>
            <select
              className="studio-input"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            >
              <option value="">— Sin reserva —</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Itinerario" optional>
            <select
              className="studio-input"
              value={sailingId}
              onChange={(e) => setSailingId(e.target.value)}
            >
              <option value="">— Sin itinerario —</option>
              {sailings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.vessel} · {s.pol}→{s.pod}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Nº de contenedor" optional>
          <input
            className="studio-input studio-input-mono"
            value={containerNo}
            onChange={(e) => setContainerNo(e.target.value)}
            placeholder="COSU1234567"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>

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
        formId="consolidation-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Crear contenedor"
        pendingLabel="Creando…"
      />
    </DrawerShell>
  );
}
