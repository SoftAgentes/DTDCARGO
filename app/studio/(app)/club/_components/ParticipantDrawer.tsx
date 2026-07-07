"use client";

/**
 * Drawer para sumar/editar un participante de una compra grupal (SDD-0116,
 * Slice B). D5: solo miembros del Club (selector de miembros). D7: solo intención
 * (CBM/valor estimado), cero montos cobrables.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Field, FormError } from "./Field";
import {
  PARTICIPANT_STATUSES,
  participantStatusLabel,
  type ParticipantInput,
  type ParticipantRow,
  type ParticipantStatus,
} from "@/lib/studio/club/group-buy-types";
import type { EligibleMember } from "@/lib/studio/club/group-buy-queries";
import { addParticipantAction, updateParticipantAction } from "../actions";

export function ParticipantDrawer({
  groupBuyId,
  groupBuyTitle,
  participant,
  eligibleMembers,
  takenMemberIds,
  onClose,
}: {
  groupBuyId: string;
  groupBuyTitle: string;
  participant?: ParticipantRow | null;
  eligibleMembers: EligibleMember[];
  takenMemberIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!participant;

  const taken = new Set(takenMemberIds);
  // En alta, solo miembros que aún no participan en esta ronda.
  const pickable = eligibleMembers.filter((m) => !taken.has(m.member_id));

  const [memberId, setMemberId] = useState(participant?.member_id ?? "");
  const [estimatedCbm, setEstimatedCbm] = useState<string>(
    participant?.estimated_cbm != null ? String(participant.estimated_cbm) : "",
  );
  const [estimatedValue, setEstimatedValue] = useState<string>(
    participant?.estimated_value_usd != null ? String(participant.estimated_value_usd) : "",
  );
  const [status, setStatus] = useState<ParticipantStatus>(participant?.status ?? "interesado");
  const [note, setNote] = useState(participant?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = (isEdit || memberId.length > 0) && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    const payload: Partial<ParticipantInput> = {
      memberId: isEdit ? participant!.member_id : memberId,
      estimatedCbm: estimatedCbm === "" ? null : Number(estimatedCbm),
      estimatedValueUsd: estimatedValue === "" ? null : Number(estimatedValue),
      status,
      note: note.trim() || null,
    };

    const r = isEdit
      ? await updateParticipantAction(participant!.id, payload)
      : await addParticipantAction(groupBuyId, payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");

    toast.success(isEdit ? "Participante actualizado" : "Miembro sumado a la compra grupal");
    onClose();
    // Trazabilidad: al sumar, resaltamos la fila nueva del participante (la tab
    // Compras se abre sola al detectar el ?highlight= en ClubClient).
    if (!isEdit && r.participantId) {
      router.push(`/studio/club?highlight=${r.participantId}&hl-tone=warm`);
    } else {
      router.refresh();
    }
  };

  // En alta sin miembros pickeables, avisamos (todos ya participan o no hay miembros).
  const noPickable = !isEdit && pickable.length === 0;

  return (
    <DrawerShell
      title={isEdit ? "Editar participante" : "Sumar miembro"}
      subtitle={groupBuyTitle}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <form
        id="participant-form"
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

        {isEdit ? (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {participant?.member_name}
            </div>
            <div
              style={{
                font: "500 12px/1.4 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {participant?.member_national_id ?? "Sin cédula"}
            </div>
          </div>
        ) : noPickable ? (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            No hay miembros disponibles para sumar. Da de alta miembros en la
            pestaña <strong>Miembros</strong> o revisa quiénes ya participan.
          </p>
        ) : (
          <Field label="Miembro del Club">
            <select
              className="studio-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              autoFocus
            >
              <option value="">Selecciona un miembro…</option>
              {pickable.map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.person_name}
                  {m.national_id ? ` · ${m.national_id}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!noPickable && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="CBM estimado" optional>
                <NumericInput
                  id="p-cbm"
                  name="estimatedCbm"
                  type="volume"
                  min={0}
                  placeholder="3.40"
                  value={estimatedCbm === "" ? null : Number(estimatedCbm)}
                  onChange={(v) => setEstimatedCbm(v != null ? String(v) : "")}
                />
              </Field>
              <Field label="Valor estimado" optional>
                <NumericInput
                  id="p-value"
                  name="estimatedValueUsd"
                  type="currency"
                  min={0}
                  placeholder="0.00"
                  value={estimatedValue === "" ? null : Number(estimatedValue)}
                  onChange={(v) => setEstimatedValue(v != null ? String(v) : "")}
                />
              </Field>
            </div>

            <Field label="Estado">
              <select
                className="studio-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ParticipantStatus)}
              >
                {PARTICIPANT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {participantStatusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nota" optional>
              <textarea
                className="studio-input"
                rows={2}
                placeholder="Qué quiere traer, observaciones…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </Field>

            <p style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              El valor estimado es intención, no un monto cobrable. El cobro va por
              facturas cuando se factura la consolidación.
            </p>
          </>
        )}
      </form>

      <DrawerFooter
        formId="participant-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit && !noPickable}
        submitLabel={isEdit ? "Guardar" : "Sumar miembro"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}
