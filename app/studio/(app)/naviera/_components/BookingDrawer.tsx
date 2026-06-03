"use client";

/**
 * Drawer de alta/edición de reserva de espacio (booking) — SDD-0047, Slice B.
 * Naviera, itinerario, modo FCL/LCL, tipo de contenedor, shipper/commodity y
 * captura MANUAL del bl_number cuando la naviera lo emite (BL como PDF = Slice C).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  BOOKING_MODES,
  BOOKING_STATUS,
  BOOKING_STATUSES,
  type Booking,
  type BookingInput,
  type BookingMode,
  type BookingStatus,
  type Carrier,
  type ContainerType,
  type Sailing,
} from "@/lib/studio/naviera/types";
import { createBooking, updateBooking } from "../actions";
import { Field, FormError } from "./SailingDrawer";

export function BookingDrawer({
  booking,
  carriers,
  sailings,
  containerTypes,
  onClose,
}: {
  booking?: Booking;
  carriers: Carrier[];
  sailings: Sailing[];
  containerTypes: ContainerType[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!booking;

  const [carrierId, setCarrierId] = useState(booking?.carrier_id ?? "");
  const [sailingId, setSailingId] = useState(booking?.sailing_id ?? "");
  const [mode, setMode] = useState<BookingMode>(booking?.mode ?? "LCL");
  const [containerType, setContainerType] = useState(
    booking?.container_type ?? "",
  );
  const [blNumber, setBlNumber] = useState(booking?.bl_number ?? "");
  const [shipper, setShipper] = useState(booking?.shipper ?? "");
  const [commodity, setCommodity] = useState(booking?.commodity ?? "");
  const [status, setStatus] = useState<BookingStatus>(
    booking?.status ?? "abierto",
  );
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const payload: Partial<BookingInput> = {
      carrierId: carrierId || null,
      sailingId: sailingId || null,
      blNumber: blNumber.trim() || null,
      containerType: containerType || null,
      mode,
      shipper: shipper.trim() || null,
      commodity: commodity.trim() || null,
      status,
      notes: notes.trim() || null,
    };
    const r = editing
      ? await updateBooking(booking!.id, payload)
      : await createBooking(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(
      editing
        ? `Reserva ${booking!.code} actualizada`
        : `Reserva ${(r as { bookingCode?: string }).bookingCode ?? ""} creada`,
    );
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? booking!.code : "Nueva reserva"}
      subtitle={
        editing
          ? `${mode} · ${containerType || "sin tipo"}`
          : "Reserva de espacio · BKG-YYYY-NNNN"
      }
      onClose={onClose}
      pending={pending}
      width={600}
    >
      <form
        id="booking-form"
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
          <Field label="Naviera" optional>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Modo">
            <select
              className="studio-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as BookingMode)}
            >
              {BOOKING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo contenedor" optional>
            <select
              className="studio-input"
              value={containerType}
              onChange={(e) => setContainerType(e.target.value)}
            >
              <option value="">— Tipo —</option>
              {containerTypes.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="BL marítimo (Bill of Lading)" optional>
          <input
            className="studio-input studio-input-mono"
            placeholder="Se captura cuando la naviera lo emite · COSU6620041X"
            value={blNumber}
            onChange={(e) => setBlNumber(e.target.value)}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Shipper" optional>
            <input
              className="studio-input"
              placeholder="DTD-Cargo Consol"
              value={shipper}
              onChange={(e) => setShipper(e.target.value)}
            />
          </Field>
          <Field label="Commodity" optional>
            <input
              className="studio-input"
              placeholder="Carga consolidada"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            />
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
        formId="booking-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear reserva"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}
