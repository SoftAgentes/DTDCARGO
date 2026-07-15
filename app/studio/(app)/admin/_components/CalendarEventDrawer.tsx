"use client";

/**
 * CalendarEventDrawer — crear/editar un feriado o feria (SDD-0127).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { deleteCalendarEventAction, saveCalendarEventAction } from "../calendar-actions";
import {
  CAL_COUNTRIES,
  CAL_KINDS,
  calCountryLabel,
  calKindLabel,
  type CalendarActionState,
  type CalendarEvent,
} from "@/lib/studio/op-calendar-types";

const FORM_ID = "cal-event-form";
const INITIAL: CalendarActionState = {};

export function CalendarEventDrawer({
  mode,
  event,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  event: CalendarEvent | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [country, setCountry] = useState<string>(event?.country ?? "CN");
  const [kind, setKind] = useState<string>(event?.kind ?? "holiday");
  const [name, setName] = useState(event?.name ?? "");
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [state, formAction, isPending] = useActionState(saveCalendarEventAction, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteCalendarEventAction, INITIAL);

  const handledSave = useRef<CalendarActionState | null>(null);
  const handledDel = useRef<CalendarActionState | null>(null);
  useEffect(() => {
    if (state?.ok && handledSave.current !== state) {
      handledSave.current = state;
      onSaved(mode === "create" ? "Evento agregado" : "Evento actualizado");
      onClose();
    }
  }, [state, mode, onSaved, onClose]);
  useEffect(() => {
    if (delState?.ok && handledDel.current !== delState) {
      handledDel.current = delState;
      onSaved("Evento eliminado");
      onClose();
    }
  }, [delState, onSaved, onClose]);

  const fe = state?.fieldErrors ?? {};
  const busy = isPending || delPending;
  const canSubmit = !!country && !!kind && name.trim().length > 0 && startDate.length > 0;

  return (
    <DrawerShell
      title={mode === "create" ? "Nuevo feriado o feria" : `Editar ${event?.name ?? ""}`}
      subtitle="Calendario operativo CN/VE"
      onClose={onClose}
      pending={busy}
      width={560}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {mode === "edit" && event && <input type="hidden" name="id" value={event.id} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <div>
            <label className="studio-label" htmlFor="cal-country">País</label>
            <select id="cal-country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="studio-input" style={{ marginTop: 6 }}>
              {CAL_COUNTRIES.map((c) => (
                <option key={c} value={c}>{calCountryLabel(c)} ({c})</option>
              ))}
            </select>
            <FieldError msg={fe.country} />
          </div>
          <div>
            <label className="studio-label" htmlFor="cal-kind">Tipo</label>
            <select id="cal-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="studio-input" style={{ marginTop: 6 }}>
              {CAL_KINDS.map((k) => (
                <option key={k} value={k}>{calKindLabel(k)}</option>
              ))}
            </select>
            <FieldError msg={fe.kind} />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="cal-name">Nombre</label>
          <input id="cal-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="studio-input" placeholder={kind === "fair" ? "Canton Fair · Fase 1" : "Año Nuevo Chino"} style={{ marginTop: 6 }} />
          <FieldError msg={fe.name} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <div>
            <label className="studio-label" htmlFor="cal-start">Inicio</label>
            <input id="cal-start" name="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="studio-input" style={{ marginTop: 6 }} />
            <FieldError msg={fe.start_date} />
          </div>
          <div>
            <label className="studio-label" htmlFor="cal-end">Fin (opcional)</label>
            <input id="cal-end" name="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="studio-input" style={{ marginTop: 6 }} />
            <FieldError msg={fe.end_date} />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="cal-note">Nota (opcional)</label>
          <textarea id="cal-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} className="studio-input" rows={2} placeholder="Impacto en lead times, fábricas cerradas…" style={{ marginTop: 6, resize: "vertical" }} />
        </div>

        {state?.error && <FormError msg={state.error} />}
        {delState?.error && <FormError msg={delState.error} />}
      </form>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        {mode === "edit" && event ? (
          <button type="button" className="studio-btn studio-btn-ghost" disabled={busy} style={{ color: "var(--danger)" }} onClick={() => setConfirmDelete(true)}>
            Eliminar
          </button>
        ) : (
          <div />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form={FORM_ID} className="studio-btn studio-btn-primary" disabled={busy || !canSubmit}>
            {isPending ? "Guardando…" : mode === "create" ? "Agregar" : "Guardar"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete && !!event}
        danger
        title="¿Eliminar evento?"
        message={`"${event?.name ?? "Este evento"}" dejará de aparecer en el calendario operativo.`}
        confirmLabel="Eliminar"
        pending={delPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!event) return;
          setConfirmDelete(false);
          const fd = new FormData();
          fd.set("id", event.id);
          delAction(fd);
        }}
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{msg}</p>;
}

function FormError({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "var(--s-3)", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "var(--r-md)", font: "600 13px/1.3 var(--f-sans)" }}>
      {msg}
    </div>
  );
}
