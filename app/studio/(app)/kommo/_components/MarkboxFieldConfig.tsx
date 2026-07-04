"use client";

/**
 * Config del custom field de Kommo donde se escribe el MARKBOX al convertir un lead
 * (SDD-0086). Va dentro de un SectionCard de la pestaña Dirección: un dropdown con
 * los campos de leads del espejo + botón Guardar. Solo tokens `var(--*)` + clases
 * del sistema (studio-input/btn/label) + Badge — coherente con el mapa de etapas.
 */

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { KommoCustomFieldRow } from "@/lib/studio/kommo-types";
import { saveKommoMarkboxFieldAction } from "../actions";

export function MarkboxFieldConfig({
  fields,
  initialFieldId,
  canEdit,
}: {
  fields: KommoCustomFieldRow[];
  initialFieldId: number | null;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [fieldId, setFieldId] = useState<number | null>(initialFieldId);
  const [pending, startTransition] = useTransition();

  const configured = fieldId != null && fieldId > 0;

  const save = () => {
    if (fieldId === initialFieldId) {
      toast.success("No hay cambios que guardar.");
      return;
    }
    startTransition(async () => {
      const res = await saveKommoMarkboxFieldAction(fieldId);
      if (res.ok) toast.success("Campo de Shipping Mark guardado.");
      else toast.error(res.error ?? "No se pudo guardar el campo.");
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Badge tone={configured ? "success" : "neutral"} dot>
          {configured ? "Configurado" : "Sin configurar"}
        </Badge>
      </div>

      <p
        style={{
          font: "400 12px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Al convertir un lead en cliente, su <strong>Shipping Mark</strong> se
        escribe en este campo del lead en Kommo, para que el asesor vea ahí que ya es
        cliente DTD. Déjalo en <strong>Sin configurar</strong> para no escribir nada. Se
        aplica con el mismo interruptor del write-back (hoy en ensayo).
      </p>

      {fields.length === 0 ? (
        <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
          No hay campos de lead sincronizados todavía. Corre el sync de Kommo y vuelve.
        </p>
      ) : (
        <div style={{ maxWidth: 380 }}>
          <label className="studio-label" htmlFor="markbox-field">
            Campo del lead en Kommo
          </label>
          <select
            id="markbox-field"
            className="studio-input"
            disabled={!canEdit || pending}
            value={fieldId ?? ""}
            onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sin configurar</option>
            {fields.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {(f.name?.trim() || `Campo #${f.id}`) + (f.type ? ` (${f.type})` : "")}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-sm"
          disabled={!canEdit || pending || fields.length === 0}
          onClick={save}
        >
          {pending ? "Guardando…" : "Guardar campo"}
        </button>
        {!canEdit ? (
          <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
            Solo un administrador puede editar el campo.
          </span>
        ) : fields.length === 0 ? (
          <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
            Sincroniza los campos de Kommo para habilitarlo.
          </span>
        ) : null}
      </div>
    </div>
  );
}
