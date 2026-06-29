"use client";

/**
 * Drawer de alta/edición de una compra grupal (SDD-0116, Slice B). El estado de
 * la ronda (abierta → cerrada → en_consolidación → completada/cancelada) se
 * cambia desde acá (edición). No mueve dinero (D7).
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
  GROUP_BUY_STATUSES,
  groupBuyStatusLabel,
  type GroupBuyDetail,
  type GroupBuyInput,
  type GroupBuyStatus,
} from "@/lib/studio/club/group-buy-types";
import { createGroupBuyAction, updateGroupBuyAction } from "../actions";

export function GroupBuyDrawer({
  groupBuy,
  onClose,
}: {
  groupBuy?: GroupBuyDetail | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!groupBuy;

  const [title, setTitle] = useState(groupBuy?.title ?? "");
  const [summary, setSummary] = useState(groupBuy?.summary ?? "");
  const [status, setStatus] = useState<GroupBuyStatus>(groupBuy?.status ?? "abierta");
  const [closesAt, setClosesAt] = useState(
    groupBuy?.closes_at ? groupBuy.closes_at.slice(0, 10) : "",
  );
  const [targetCbm, setTargetCbm] = useState<string>(
    groupBuy?.target_cbm != null ? String(groupBuy.target_cbm) : "",
  );
  const [origin, setOrigin] = useState(groupBuy?.origin ?? "");
  const [destination, setDestination] = useState(groupBuy?.destination ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = title.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    const payload: Partial<GroupBuyInput> = {
      title: title.trim(),
      summary: summary.trim() || null,
      status,
      closesAt: closesAt.trim() || null,
      targetCbm: targetCbm === "" ? null : Number(targetCbm),
      origin: origin.trim() || null,
      destination: destination.trim() || null,
    };

    const r = isEdit
      ? await updateGroupBuyAction(groupBuy!.id, payload)
      : await createGroupBuyAction(payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");

    toast.success(
      isEdit ? `Compra grupal "${title.trim()}" actualizada` : `Compra grupal "${title.trim()}" creada`,
    );
    onClose();
    if (!isEdit && r.createdId) {
      router.push(`/studio/club?highlight=${r.createdId}&hl-tone=warm`);
    } else {
      router.refresh();
    }
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar compra grupal" : "Nueva compra grupal"}
      subtitle="Club DTD · ronda de consolidación"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="group-buy-form"
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

        <Field label="Título">
          <input
            className="studio-input"
            placeholder="Consolidación Yiwu · julio"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Resumen" optional>
          <textarea
            className="studio-input"
            rows={2}
            placeholder="Qué junta esta ronda, para quién…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as GroupBuyStatus)}
            >
              {GROUP_BUY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {groupBuyStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cierra el" optional>
            <input
              className="studio-input"
              type="date"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>
        </div>

        <Field label="CBM meta" optional>
          <NumericInput
            id="gb-target-cbm"
            name="targetCbm"
            type="volume"
            min={0}
            placeholder="40.0"
            value={targetCbm === "" ? null : Number(targetCbm)}
            onChange={(v) => setTargetCbm(v != null ? String(v) : "")}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Origen" optional>
            <input
              className="studio-input"
              placeholder="Yiwu, CN"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </Field>
          <Field label="Destino" optional>
            <input
              className="studio-input"
              placeholder="Valencia, VE"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </Field>
        </div>
      </form>

      <DrawerFooter
        formId="group-buy-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={isEdit ? "Guardar cambios" : "Crear compra grupal"}
        pendingLabel={isEdit ? "Guardando…" : "Creando…"}
      />
    </DrawerShell>
  );
}
